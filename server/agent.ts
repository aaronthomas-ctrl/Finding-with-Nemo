import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export async function handleAgentRequest(req: any, res: any) {
  const { prompt, history, currentBounds, currentPath } = req.body;
  
  // Tools definition
  const searchPlacesByText = {
    name: "search_places_by_text",
    description: "Searches for companies/businesses using Google Places API. Use this to find companies. Can optionally restrict to a bounding box.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "The search query (e.g. 'EPC contractors', 'steel fabricators')" },
        useCurrentBounds: { type: Type.BOOLEAN, description: "If true, restricts search to the user's current map view bounds." },
        locationName: { type: Type.STRING, description: "Optional. If useCurrentBounds is false, specify a location name like 'Musaffah' to search within." }
      },
      required: ["query"]
    }
  };

  const saveCompanies = {
    name: "save_companies_to_pipeline",
    description: "Saves a list of companies to the user's CRM pipeline database.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        companies: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              category: { type: Type.STRING },
              phone: { type: Type.STRING },
              website: { type: Type.STRING },
              latitude: { type: Type.NUMBER },
              longitude: { type: Type.NUMBER },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["name"]
          }
        }
      },
      required: ["companies"]
    }
  };

  const saveSearchZone = {
    name: "save_search_zone",
    description: "Saves an area as a search zone in the database.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "The name of the zone (e.g., 'Musaffah EPCs')" },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tags associated with this zone search." }
      },
      required: ["name"]
    }
  };

  const tools = [
    
    { functionDeclarations: [searchPlacesByText, saveCompanies, saveSearchZone] }
  ];

  try {
    
    const chatConfig: any = {
      model: "gemini-3.7-flash",
      config: {
        systemInstruction: "You are an AI Prospecting Co-Pilot for a B2B sales application. You help users find and save businesses to their pipeline CRM. You have access to tools for searching Google Places, saving companies, saving search zones. When saving a search zone, make sure to add descriptive tags like 'industrial area' or 'industrial city' if applicable. ALWAYS explicitly tell the user exactly what you saved to the pipeline and what zones you saved, so they know the action was completed.",
        tools: tools,
      }
    };
    
    // Pass history if available
    if (history && history.length > 0) {
      chatConfig.history = history;
    }

    const chat = ai.chats.create(chatConfig);



    let response = await chat.sendMessage({ message: prompt });
    
    // Handle function calls
    let iterations = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && iterations < 5) {
      iterations++;
      const call = response.functionCalls[0];
      const name = call.name;
      const args = call.args as any;
      let resultData: any = {};

      console.log(`[Agent] Calling function: ${name}`, args);

      if (name === "search_places_by_text") {
        let rect = currentBounds;
        if (!args.useCurrentBounds && args.locationName) {
           // Geocode locationName
           const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(args.locationName)}&key=${process.env.GOOGLE_MAPS_PLATFORM_KEY}`);
           const geoData = await geoRes.json();
           if (geoData.results && geoData.results.length > 0) {
             const geom = geoData.results[0].geometry;
             if (geom.bounds) {
               rect = {
                 low: { latitude: geom.bounds.southwest.lat, longitude: geom.bounds.southwest.lng },
                 high: { latitude: geom.bounds.northeast.lat, longitude: geom.bounds.northeast.lng }
               };
             } else if (geom.viewport) {
               rect = {
                 low: { latitude: geom.viewport.southwest.lat, longitude: geom.viewport.southwest.lng },
                 high: { latitude: geom.viewport.northeast.lat, longitude: geom.viewport.northeast.lng }
               };
             }
           }
        }

        const reqBody: any = { textQuery: args.query };
        if (rect) {
          reqBody.locationRestriction = { rectangle: rect };
        }

        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': process.env.GOOGLE_MAPS_PLATFORM_KEY!,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.rating,places.websiteUri,places.internationalPhoneNumber'
          },
          body: JSON.stringify(reqBody)
        });
        const data = await res.json();
        const companies = (data.places || []).slice(0, 10).map((p: any) => ({
          name: p.displayName?.text || 'Unknown',
          address: p.formattedAddress,
          rating: p.rating,
          category: p.primaryTypeDisplayName?.text,
          website: p.websiteUri,
          phone: p.internationalPhoneNumber,
          latitude: p.location?.latitude,
          longitude: p.location?.longitude
        }));
        resultData = { companies, count: companies.length };
      } 
      else if (name === "save_companies_to_pipeline") {
        const toSnake = (obj: any) => {
          const res: any = {};
          for (const k in obj) {
            const snakeK = k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
            res[snakeK] = obj[k];
          }
          return res;
        };

        const records = (args.companies || []).map((c: any) => {
          const id = uuidv4();
          return {
             id,
             name: c.name || "",
             address: c.address || "",
             lat: c.latitude,
             lng: c.longitude,
             phone: c.phone || "",
             website: c.website || "",
             category: c.category || "Other",
             tier: 4,
             status: "New",
             tags: c.tags || [],
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString()
          };
        });
        
        if (records.length > 0) {
          const { error } = await supabase.from('clients').insert(records);
          if (error) {
            resultData = { success: false, error: error.message };
          } else {
            resultData = { success: true, savedCount: records.length };
          }
        } else {
          resultData = { success: false, error: "No companies provided." };
        }
      }
      else if (name === "save_search_zone") {
        const id = uuidv4();
        // Mimic the frontend encoding: "Name ||| Tag1,Tag2"
        let encodedName = args.name;
        if (args.tags && args.tags.length > 0) {
          encodedName = `${args.name} ||| ${args.tags.join(',')}`;
        }
        
        let path = currentPath || [];
        if (path.length === 0 && currentBounds) {
          path = [
            { lat: currentBounds.low.latitude, lng: currentBounds.low.longitude },
            { lat: currentBounds.low.latitude, lng: currentBounds.high.longitude },
            { lat: currentBounds.high.latitude, lng: currentBounds.high.longitude },
            { lat: currentBounds.high.latitude, lng: currentBounds.low.longitude }
          ];
        }
        
        const dbZone = {
          id,
          name: encodedName,
          path: path,
          created_at: new Date().toISOString()
        };
        const { error } = await supabase.from('search_zones').insert(dbZone);
        if (error) {
          resultData = { success: false, error: error.message };
        } else {
          resultData = { success: true };
        }
      }

      // Send the tool response back to the model
      response = await chat.sendMessage({
        message: [{
          functionResponse: {
            name: name,
            response: resultData
          }
        }]
      } as any); // Using 'as any' if type is strict
    }

    // Return the final text
    res.json({ text: response.text });

  } catch (error: any) {
    const isQuotaError = error?.status === 429 || error?.message?.includes("depleted") || error?.status === "RESOURCE_EXHAUSTED" || error?.message?.includes("quota");
    if (isQuotaError) {
      console.warn("Agent quota exceeded.");
      return res.status(500).json({ error: "AI Assistant is currently unavailable (API quota exceeded). Please try again later." });
    }
    console.error("Agent error:", error);
    res.status(500).json({ error: error.message || "Agent failed" });
  }
}
