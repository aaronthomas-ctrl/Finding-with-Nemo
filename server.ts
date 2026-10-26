import { handleAgentRequest } from "./server/agent.js";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Gemini
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Proxy endpoint for Google Places API Text Search
app.post("/api/places-search", async (req, res) => {
  const { textQuery, locationRestriction, pageToken } = req.body;
  const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Google Maps API Key not configured." });
  }

  try {
    const requestBody: any = {
      textQuery: textQuery || "business",
      locationRestriction,
      pageSize: 20
    };
    if (pageToken) {
      requestBody.pageToken = pageToken;
    }

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.primaryTypeDisplayName,places.businessStatus,places.googleMapsUri,places.formattedAddress,places.location"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error searching places:", error);
    res.status(500).json({ error: "Failed to search places" });
  }
});

// Proxy endpoint for searching / geocoding places, areas, and regions in UAE
app.post("/api/geocode-place", async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: "Query is required" });
  }

  const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Google Maps API Key not configured." });
  }

  try {
    const textQuery = query.toLowerCase().includes('uae') || query.toLowerCase().includes('emirates') || query.toLowerCase().includes('dubai') || query.toLowerCase().includes('abu dhabi') || query.toLowerCase().includes('sharjah')
      ? query.trim()
      : `${query.trim()}, UAE`;

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.viewport,places.types"
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 6
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Places searchText error:", errText);
      return res.status(response.status).json({ error: "Place search request failed" });
    }

    const data = await response.json();
    const places = (data.places || []).map((p: any) => ({
      id: p.id,
      name: p.displayName?.text || query,
      formattedAddress: p.formattedAddress || '',
      location: {
        lat: p.location?.latitude || 0,
        lng: p.location?.longitude || 0
      },
      viewport: p.viewport ? {
        low: { lat: p.viewport.low.latitude, lng: p.viewport.low.longitude },
        high: { lat: p.viewport.high.latitude, lng: p.viewport.high.longitude }
      } : null,
      types: p.types || []
    }));

    res.json({ places });
  } catch (error) {
    console.error("Error geocoding place:", error);
    res.status(500).json({ error: "Failed to geocode place" });
  }
});

// Proxy endpoint for optimizing multi-stop routes using Google Directions API
app.post("/api/optimize-route", async (req, res) => {
  const { origin, destination, waypoints = [], roundTrip = false } = req.body;
  const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Google Maps API Key not configured." });
  }

  if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
    return res.status(400).json({ error: "Valid origin {lat, lng} is required." });
  }

  const effectiveDest = destination || (roundTrip ? origin : (waypoints.length > 0 ? waypoints[waypoints.length - 1] : origin));
  const effectiveWaypoints = destination ? waypoints : (roundTrip ? waypoints : waypoints.slice(0, -1));

  try {
    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${effectiveDest.lat},${effectiveDest.lng}`;
    const wpStr = effectiveWaypoints.length > 0
      ? `optimize:true|${effectiveWaypoints.map((w: any) => `${w.lat},${w.lng}`).join('|')}`
      : '';

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", originStr);
    url.searchParams.set("destination", destStr);
    if (wpStr) {
      url.searchParams.set("waypoints", wpStr);
    }
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      return res.status(200).json({ 
        fallback: true, 
        status: data.status, 
        error_message: data.error_message || "Directions not available" 
      });
    }

    const route = data.routes[0];
    const totalDistanceMeters = route.legs.reduce((acc: number, l: any) => acc + (l.distance?.value || 0), 0);
    const totalDurationSeconds = route.legs.reduce((acc: number, l: any) => acc + (l.duration?.value || 0), 0);

    res.json({
      success: true,
      waypoint_order: route.waypoint_order || [],
      overview_polyline: route.overview_polyline?.points || '',
      legs: route.legs || [],
      summary: route.summary || '',
      total_distance_km: Math.round((totalDistanceMeters / 1000) * 10) / 10,
      total_duration_minutes: Math.round(totalDurationSeconds / 60)
    });
  } catch (error: any) {
    console.error("Error optimizing route:", error);
    res.status(500).json({ error: "Failed to optimize route", details: error.message });
  }
});


// Endpoint to fetch website and optionally summarize via Gemini

const TAGS_MAP = {
  EPC: ['EPC', 'engineering procurement construction', 'turnkey contractor', 'general contractor', 'main contractor', 'prime contractor', 'EPCC', 'EPCM', 'project contractor', 'design and build', 'lump sum turnkey', 'LSTK'],
  FABRICATOR: ['fabrication', 'fabricator', 'steel fabrication', 'structural fabrication', 'pipe fabrication', 'piping fabrication', 'spool fabrication', 'module fabrication', 'vessel fabrication', 'tank fabrication', 'skid fabrication', 'fabrication yard', 'fabrication shop', 'fabrication facility', 'fab shop', 'plate work'],
  MANUFACTURER: ['manufacturer', 'manufacturing', 'production facility', 'production plant', 'factory', 'plant production', 'made in UAE', 'local manufacturing', 'industrial manufacturing', 'assembly plant', 'mass production'],
  MAINTENANCE: ['maintenance', 'maintenance contractor', 'maintenance services', 'plant maintenance', 'preventive maintenance', 'corrective maintenance', 'predictive maintenance', 'asset maintenance', 'facility maintenance', 'operation and maintenance', 'O&M', 'turnaround', 'shutdown', 'TAR', 'TA contractor', 'scheduled maintenance', 'inspection and maintenance', 'repair and maintenance', 'integrity management'],
  OIL_GAS: ['oil and gas', 'oil & gas', 'oilfield', 'upstream', 'downstream', 'midstream', 'petroleum', 'refinery', 'refining', 'gas processing', 'LNG', 'NGL', 'ADNOC', 'offshore oil', 'onshore oil', 'subsea', 'wellhead', 'gas plant', 'processing plant', 'hydrocarbon'],
  PIPELINE: ['pipeline', 'pipeline contractor', 'pipeline construction', 'pipeline installation', 'cross country pipeline', 'mainline', 'piping', 'pipe laying', 'pipe installation', 'flowline', 'trunkline', 'water pipeline', 'gas pipeline', 'oil pipeline'],
  STEEL: ['steel industry', 'steel contractor', 'steel structure', 'structural steel', 'steel works', 'steelwork', 'steel erection', 'steel construction', 'steel fabrication', 'metal works', 'metalwork', 'metal fabrication', 'iron works', 'rebar', 'reinforcement steel'],
  OFFSHORE_MARINE: ['offshore', 'marine contractor', 'marine construction', 'shipyard', 'drydock', 'dry dock', 'vessel', 'ship repair', 'ship building', 'EPCI', 'subsea contractor', 'diving contractor', 'underwater contractor', 'ROV', 'barge', 'offshore platform', 'jacket', 'topsides', 'mooring', 'offshore installation'],
  WORKSHOP: ['workshop', 'machine shop', 'mechanical workshop', 'engineering workshop', 'repair workshop', 'service workshop', 'welding workshop', 'maintenance workshop'],
  CAR_WORKSHOP: ['auto repair', 'automobile repair', 'car repair', 'vehicle repair', 'garage', 'auto workshop', 'car workshop', 'auto body', 'panel beating', 'body shop', 'automotive repair', 'car service', 'vehicle service', 'fleet maintenance', 'heavy vehicle repair', 'truck repair', 'equipment repair', 'plant equipment repair'],
  CIVIL_INFRA: ['civil contractor', 'civil construction', 'civil works', 'infrastructure', 'road works', 'road construction', 'bridge construction', 'tunnel construction', 'earthworks', 'excavation', 'concrete works', 'building contractor', 'construction company'],
  MEP: ['MEP', 'mechanical electrical plumbing', 'mechanical contractor', 'electrical contractor', 'HVAC', 'instrumentation', 'E&I', 'electrical and instrumentation', 'plumbing contractor', 'fire fighting', 'fire protection'],
  POWER_ENERGY: ['power plant', 'power station', 'power generation', 'CCGT', 'combined cycle', 'gas turbine', 'substation', 'transmission line', 'solar power', 'solar EPC', 'photovoltaic', 'wind power', 'renewable energy', 'BESS', 'battery storage', 'DEWA', 'FEWA', 'EWEC', 'electricity contractor'],
  TRADER: ['trading company', 'trader', 'general trading', 'industrial trading', 'technical trading', 'supplier', 'distributor', 'stockist', 'importer', 'exporter', 'wholesale', 'reseller', 'merchant', 'procurement agent', 'sourcing agent', 'supply chain', 'materials supply', 'industrial supply'],
  INSPECTION_QC: ['inspection', 'third party inspection', 'QA QC', 'quality assurance', 'quality control', 'NDT', 'non destructive testing', 'radiography', 'ultrasonic testing', 'ASNT', 'AWS', 'CSWIP', 'TWI', 'IWS', 'welding inspection', 'coating inspection'],
  TANK_VESSEL: ['storage tank', 'pressure vessel', 'heat exchanger', 'boiler', 'column', 'reactor', 'separator', 'API tank', 'ASME vessel', 'tank builder', 'tank farm', 'cryogenic tank', 'LNG tank'],
  SCAFFOLDING: ['scaffolding', 'scaffolding contractor', 'access solutions', 'temporary works', 'formwork', 'shuttering'],
  INSULATION_COATING: ['insulation', 'coating', 'painting', 'surface preparation', 'blasting', 'protective coating', 'thermal insulation', 'anti corrosion', 'paint contractor'],
  DEFENCE_GOVT: ['defence', 'defense', 'military', 'armed forces', 'government contract', 'ministry', 'federal authority', 'municipality'],
  RAIL_TRANSPORT: ['railway', 'railroad', 'rail contractor', 'metro', 'tram', 'high speed rail', 'track works', 'tunnel boring', 'TBM', 'underground works', 'station construction'],
  HIRE_RENTAL: ['equipment rental', 'plant hire', 'equipment hire', 'tool rental', 'machinery hire', 'plant rental', 'generator rental', 'compressor rental'],
  WELDING: ['welding', 'welder', 'weld', 'welding services', 'welding contractor', 'welding works', 'welding shop', 'MIG', 'TIG', 'SMAW', 'FCAW', 'SAW', 'submerged arc', 'arc welding', 'gas welding', 'spot welding', 'resistance welding', 'plasma cutting', 'oxy cutting', 'thermal cutting', 'weld inspection', 'weld procedure', 'WPS', 'PQR', 'PWHT', 'post weld heat treatment', 'preheat', 'interpass'],
  ALUMINIUM: ['aluminium', 'aluminum', 'aluminium fabrication', 'aluminium structure', 'aluminium works', 'aluminium manufacturer'],
  STAINLESS: ['stainless steel', 'stainless fabrication', 'SS fabrication', 'duplex', 'super duplex', 'CRA', 'corrosion resistant alloy', 'Inconel', 'nickel alloy'],
  MANPOWER: ['manpower supply', 'manpower contractor', 'labour supply', 'labour contractor', 'skilled labour', 'workforce supply', 'staffing', 'recruitment', 'secondment', 'welding manpower'],
  SOUR_SERVICE: ['sour service', 'sour gas', 'H2S', 'hydrogen sulphide', 'NACE', 'HIC', 'SSC', 'sulphide stress', 'sour environment', 'NACE MR0175'],
  ASME_CERTIFIED: ['ASME', 'ASME certified', 'ASME stamp', 'U stamp', 'R stamp', 'S stamp', 'pressure code', 'code welding', 'code work'],
  LOW_RELEVANCE: ['real estate developer', 'property developer', 'retail', 'hospitality', 'hotel', 'restaurant', 'food and beverage', 'IT company', 'software', 'consultancy only', 'law firm', 'insurance', 'financial services', 'medical clinic', 'school']
};

function analyzeWebsiteText(text) {
  const foundTags = [];
  
  for (const [tag, words] of Object.entries(TAGS_MAP)) {
    for (const word of words) {
      // Escape for regex safely
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
      if (regex.test(text)) {
        foundTags.push(tag);
        break; 
      }
    }
  }

  if (foundTags.includes('LOW_RELEVANCE')) {
    return { tier: 4, tags: ['LOW_RELEVANCE'], category: 'Other', skip: true };
  }

  const priorityA = ['WELDING', 'FABRICATOR', 'EPC', 'OIL_GAS', 'TANK_VESSEL'];
  const priorityB = ['MAINTENANCE', 'PIPELINE', 'STEEL', 'OFFSHORE_MARINE', 'MANUFACTURER', 'WORKSHOP'];
  const priorityC = ['MEP', 'CIVIL_INFRA', 'POWER_ENERGY', 'RAIL_TRANSPORT', 'CAR_WORKSHOP', 'HIRE_RENTAL'];
  const priorityD = ['TRADER', 'SCAFFOLDING', 'INSULATION_COATING', 'MANPOWER'];

  let aHits = 0, bHits = 0, cHits = 0, dHits = 0;
  foundTags.forEach(t => {
    if (priorityA.includes(t)) aHits++;
    else if (priorityB.includes(t)) bHits++;
    else if (priorityC.includes(t)) cHits++;
    else if (priorityD.includes(t)) dHits++;
  });

  let tier = 4;
  if (aHits > 1) tier = 1;
  else if (aHits === 1) tier = 2;
  else if (bHits > 0) tier = 3;
  else if (cHits > 0 || dHits > 0) tier = 4;
  else tier = 4; 

  const sortedTags = [...foundTags].sort((a, b) => {
    const getPri = t => priorityA.includes(t) ? 1 : priorityB.includes(t) ? 2 : priorityC.includes(t) ? 3 : priorityD.includes(t) ? 4 : 5;
    return getPri(a) - getPri(b);
  });

  const categoryMap: Record<string, string> = {
    'EPC': 'EPC Contractor',
    'FABRICATOR': 'Steel Fabricator',
    'STEEL': 'Steel Fabricator',
    'OIL_GAS': 'Oilfield & Petrochemical Services',
    'TANK_VESSEL': 'Steel Fabricator', 
    'PIPELINE': 'Oilfield & Petrochemical Services',
    'OFFSHORE_MARINE': 'Marine/Shipbuilding',
    'MEP': 'Electromechanical/MEP',
    'WELDING': 'Welding Trade/Distributor',
    'TRADER': 'Trader'
  };

  const rawCat = sortedTags.length > 0 ? sortedTags[0] : 'Other';
  const category = categoryMap[rawCat] || 'Other';

  return { tier, tags: foundTags, category, skip: false };
}


app.post("/api/enrich-company", async (req, res) => {
  const { websiteUri, companyName } = req.body;
  if (!websiteUri) {
    return res.status(400).json({ error: "No website URL provided." });
  }

  try {
    const fetchController = new AbortController();
    const timeoutId = setTimeout(() => fetchController.abort(), 8000);
    const websiteRes = await fetch(websiteUri, { 
      signal: fetchController.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(timeoutId);
    
    if (!websiteRes.ok) {
      return res.status(websiteRes.status).json({ error: `Failed to fetch website (${websiteRes.status})` });
    }

    const html = await websiteRes.text();
    const $ = cheerio.load(html);
    const title = $("title").text().trim();
    const metaDescription = $('meta[name="description"]').attr("content")?.trim() || "";
    // Remove scripts, styles, etc.
    $("script, style, noscript, nav, footer, header").remove();
    let visibleText = $("body").text().replace(/\s+/g, " ").trim();
    
    // Do the tagging on the FULL visible text
    const tagResults = analyzeWebsiteText(visibleText);
    
    if (visibleText.length > 500) {
      visibleText = visibleText.substring(0, 500) + "...";
    }

    let summaryText = `Title: ${title}\nDescription: ${metaDescription}\nText: ${visibleText}`;
    const fallbackSummary = visibleText.substring(0, 300) + "...";

    // Skip Gemini for now since they said NO AI
    res.json({ 
      summary: fallbackSummary, 
      raw: summaryText,
      category: tagResults.category,
      tags: tagResults.tags,
      tier: tagResults.tier,
      skip: tagResults.skip
    });
  } catch (error) {
    console.error("Error enriching company:", error);
    res.status(500).json({ error: "Failed to fetch and enrich website content." });
  }
});




// Endpoint to auto-tag a batch of clients based on their websites
app.post('/api/auto-tag-batch', async (req, res) => {
  const { clients } = req.body;
  if (!clients || !Array.isArray(clients)) {
    return res.status(400).json({ error: 'No clients provided.' });
  }

  try {
    const results = {};

    const fetchPromises = clients.map(async (client) => {
      if (!client.websiteUri) return;
      try {
        const fetchController = new AbortController();
        const timeoutId = setTimeout(() => fetchController.abort(), 8000);
        const websiteRes = await fetch(client.websiteUri, { 
          signal: fetchController.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        clearTimeout(timeoutId);
        
        if (websiteRes.ok) {
          const html = await websiteRes.text();
          const $ = cheerio.load(html);
          $("script, style, noscript, nav, footer, header").remove();
          let visibleText = $("body").text().replace(/\s+/g, " ").trim();
          
          if (visibleText.length > 50) {
             results[client.id] = analyzeWebsiteText(visibleText);
          } else {
             results[client.id] = { tier: 4, category: 'Other', tags: [], skip: false };
          }
        } else {
          results[client.id] = { tier: 4, category: 'Other', tags: [], skip: false };
        }
      } catch (err) {
        results[client.id] = { tier: 4, category: 'Other', tags: [], skip: false };
      }
    });

    await Promise.all(fetchPromises);
    res.json({ results });
  } catch (error) {
    console.error('Error auto-tagging batch:', error);
    res.status(500).json({ error: 'Failed to auto-tag', details: error.message || String(error) });
  }
});

// Endpoint for explicit map grounding insights
app.post("/api/company-insights", async (req, res) => {
  const { companyName, address, existingTags = [] } = req.body;
  try {
    const prompt = `Perform a comprehensive web search (including their official site, directories like 2gis, yellow pages, b2bhint, etc.) to investigate "${companyName}" located at "${address}" in the UAE. 
1. Determine what they do, their industry, equipment brands they use (e.g., Lincoln, Miller, ESAB), and their customer profile (e.g., EPC contractor, ship repair, tank manufacturer).
2. Write a 2-3 sentence professional business insight.
3. Classify them with tags. Use the existing tags if relevant: [${existingTags.join(', ')}]. If they need new tags to accurately describe their operations, distributors, or brands, create them. Limit to 3-6 highly relevant tags.`;

    const geminiRes = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "You are a professional B2B intelligence analyst. Return your findings as a JSON object.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["insights", "tags"]
          }
      }
    });

    let result;
    try {
      result = JSON.parse(geminiRes.text || "{}");
    } catch(e) {
      result = { insights: geminiRes.text, tags: [] };
    }

    res.json({ insights: result.insights || "No insights found.", tags: result.tags || [] });
  } catch (error: any) {
    const isQuotaError = error?.status === 429 || error?.message?.includes("depleted") || error?.status === "RESOURCE_EXHAUSTED";
    if (isQuotaError) {
      console.warn("Error getting insights (API quota exceeded).");
    } else {
      console.error("Error getting insights:", error);
    }
    const errorMessage = isQuotaError
      ? "AI Insights unavailable (API quota exceeded)."
      : "Failed to generate AI insights.";
    res.status(500).json({ error: errorMessage });
  }
});

// Endpoint to get recent data from Google Places & Web Search (No Gemini AI usage)
app.post("/api/client-google-search", async (req, res) => {
  const { companyName, website = "" } = req.body;
  if (!companyName) {
    return res.status(400).json({ error: "Company name is required." });
  }

  // Reduced strictly to just the name of the company, nothing else
  const cleanCompanyName = companyName.trim();
  const cleanWebsite = website ? website.trim() : "";

  const sources: Array<{ title: string; uri: string; domain: string; snippet?: string }> = [];
  let summary = "";
  const searchQueries: string[] = [cleanCompanyName];

  let topWebsite = cleanWebsite;

  try {
    // 1. Google Places API (Query reduced to strictly the company name)
    const mapsKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
    if (mapsKey) {
      try {
        const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": mapsKey,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.nationalPhoneNumber,places.primaryTypeDisplayName,places.editorialSummary,places.rating,places.userRatingCount"
          },
          body: JSON.stringify({
            textQuery: cleanCompanyName
          })
        });

        if (placesRes.ok) {
          const placesData = await placesRes.json();
          const places = placesData.places || [];
          if (places.length > 0) {
            const primary = places[0];
            const pName = primary.displayName?.text || cleanCompanyName;
            const pAddr = primary.formattedAddress || "";
            const pType = primary.primaryTypeDisplayName?.text;
            const pPhone = primary.nationalPhoneNumber;
            const pRating = primary.rating;
            const pReviews = primary.userRatingCount;
            if (primary.websiteUri) topWebsite = primary.websiteUri;

            summary += `### Google Business Profile: ${pName}\n\n`;
            if (pType) summary += `- **Category/Industry**: ${pType}\n`;
            if (pAddr) summary += `- **Verified Address**: ${pAddr}\n`;
            if (pPhone) summary += `- **Official Phone**: ${pPhone}\n`;
            if (pRating) summary += `- **Google Rating**: ${pRating} ★ (${pReviews || 0} reviews)\n`;
            if (primary.editorialSummary?.text) summary += `- **Profile Overview**: ${primary.editorialSummary.text}\n`;
            summary += `\n`;

            if (primary.googleMapsUri) {
              sources.push({
                title: `${pName} - Google Maps Location`,
                uri: primary.googleMapsUri,
                domain: "maps.google.com",
                snippet: `Verified Google Business listing: ${pAddr}`
              });
            }

            // If additional branches or sister facilities are found
            if (places.length > 1) {
              summary += `#### Additional Verified Locations in UAE (${places.length} found):\n`;
              places.slice(1, 4).forEach((pl: any) => {
                const bName = pl.displayName?.text || pName;
                const bAddr = pl.formattedAddress || "";
                summary += `- **${bName}**: ${bAddr}\n`;
                if (pl.googleMapsUri && !sources.some(s => s.uri === pl.googleMapsUri)) {
                  sources.push({
                    title: `${bName} - Google Maps`,
                    uri: pl.googleMapsUri,
                    domain: "maps.google.com"
                  });
                }
              });
              summary += `\n`;
            }
          }
        }
      } catch (placesErr) {
        console.warn("Google Places search error:", placesErr);
      }
    }

    // 2. Direct Website Search & Extraction
    if (topWebsite) {
      try {
        const webUrl = topWebsite.startsWith("http") ? topWebsite : `https://${topWebsite}`;
        const webRes = await fetch(webUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(4500)
        });

        if (webRes.ok) {
          const html = await webRes.text();
          const $ = cheerio.load(html);
          const pageTitle = $("title").text().trim();
          const metaDesc = $("meta[name=\"description\"]").attr("content") || $("meta[property=\"og:description\"]").attr("content") || "";

          summary += `### Official Website Intelligence\n\n`;
          if (pageTitle) summary += `- **Site Title**: ${pageTitle}\n`;
          if (metaDesc) summary += `- **Business Description**: ${metaDesc}\n`;

          const headings: string[] = [];
          $("h1, h2").each((i, el) => {
            const hText = $(el).text().trim().replace(/\s+/g, ' ');
            if (hText && hText.length > 5 && hText.length < 120 && !headings.includes(hText) && headings.length < 4) {
              headings.push(hText);
            }
          });
          if (headings.length > 0) {
            summary += `- **Key Focus Areas**: ${headings.join(" • ")}\n`;
          }
          summary += `\n`;

          let domain = "website";
          try { domain = new URL(webUrl).hostname.replace(/^www\./, ''); } catch {}
          if (!sources.some(s => s.uri === webUrl)) {
            sources.push({
              title: pageTitle || `${cleanCompanyName} - Official Website`,
              uri: webUrl,
              domain: domain,
              snippet: metaDesc || `Official website for ${cleanCompanyName}`
            });
          }
        }
      } catch (webErr) {
        console.warn("Website intelligence extraction error:", webErr);
      }
    }

    // 3. Corporate Encyclopedia / Registry Search (Wikipedia API)
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanCompanyName)}&format=json`,
        {
          headers: { "User-Agent": "CompanyIntelligenceBot/1.0" },
          signal: AbortSignal.timeout(3000)
        }
      );
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const topHit = wikiData.query?.search?.[0];
        if (topHit) {
          const cleanSnippet = topHit.snippet.replace(/<[^>]*>/g, "");
          const nameWords = cleanCompanyName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const matches = nameWords.some(w => topHit.title.toLowerCase().includes(w) || cleanSnippet.toLowerCase().includes(w));
          if (matches) {
            summary += `### Corporate Registry & Group Background\n\n`;
            summary += `- **Article**: [${topHit.title}](https://en.wikipedia.org/wiki/${encodeURIComponent(topHit.title)})\n`;
            summary += `- **Overview**: ${cleanSnippet}...\n\n`;
            const wikiUri = `https://en.wikipedia.org/wiki/${encodeURIComponent(topHit.title)}`;
            if (!sources.some(s => s.uri === wikiUri)) {
              sources.push({
                title: `Wikipedia: ${topHit.title}`,
                uri: wikiUri,
                domain: "wikipedia.org",
                snippet: cleanSnippet
              });
            }
          }
        }
      }
    } catch (wikiErr) {
      console.warn("Wikipedia search error:", wikiErr);
    }

    if (!summary.trim()) {
      summary = `### Search Results for ${cleanCompanyName}\n\n` +
        `Direct search query executed: "${searchQueries[0]}".\n` +
        `No public listing returned under this exact name. Please check company registration or verify location directly.`;
    }

    return res.json({
      success: true,
      companyName: cleanCompanyName,
      summary: summary,
      sources: sources,
      searchQueries: searchQueries,
      fetchedAt: new Date().toISOString(),
      groundedWith: sources.some(s => s.domain === 'maps.google.com') 
        ? "Google Places & Verified Web Search" 
        : "Direct Web Search"
    });
  } catch (error: any) {
    console.error("Search endpoint error:", error);
    return res.status(500).json({
      error: "Failed to perform search: " + (error?.message || "unknown error")
    });
  }
});

// Helper to determine UAE Emirate from address and coordinates
function detectEmirateFromPlace(address = "", lat?: number, lng?: number): string {
  const addr = (address || "").toLowerCase();
  
  if (
    addr.includes("abu dhabi") || addr.includes("mussafah") || addr.includes("musaffah") ||
    addr.includes("icad") || addr.includes("al ain") || addr.includes("ruwais") ||
    addr.includes("khalifa port") || addr.includes("al dhafra") || addr.includes("habshan") ||
    addr.includes("أبو ظبي") || addr.includes("مصفح") || addr.includes("العين")
  ) {
    return "Abu Dhabi";
  }

  if (
    addr.includes("dubai") || addr.includes("al quoz") || addr.includes("dip") ||
    addr.includes("dubai investment park") || addr.includes("jebel ali") || addr.includes("jafza") ||
    addr.includes("deira") || addr.includes("ras al khor") || addr.includes("al qusais") ||
    addr.includes("al barsha") || addr.includes("bur dubai") || addr.includes("dubai industrial") ||
    addr.includes("saih shuaib") || addr.includes("دبي") || addr.includes("القوز")
  ) {
    return "Dubai";
  }

  if (
    addr.includes("sharjah") || addr.includes("sajaa") || addr.includes("al sajjah") ||
    addr.includes("hamriyah") || addr.includes("industrial area") || addr.includes("الشارقة")
  ) {
    return "Sharjah";
  }

  if (addr.includes("ajman") || addr.includes("jurf") || addr.includes("al jurf") || addr.includes("عجمان")) {
    return "Ajman";
  }

  if (
    addr.includes("ras al khaimah") || addr.includes("ras al-khaimah") || addr.includes("rak") ||
    addr.includes("al jazeera al hamra") || addr.includes("al hamra") || addr.includes("رأس الخيمة")
  ) {
    return "Ras Al Khaimah";
  }

  if (addr.includes("fujairah") || addr.includes("al hayl") || addr.includes("الفجيرة")) {
    return "Fujairah";
  }

  if (addr.includes("umm al quwain") || addr.includes("umm al-quwain") || addr.includes("uaq") || addr.includes("أم القيوين")) {
    return "Umm Al Quwain";
  }

  // Fallback by coordinates if available
  if (lat && lng) {
    if (lat >= 25.55 && lng >= 55.8) return "Ras Al Khaimah";
    if (lat >= 25.0 && lat <= 25.6 && lng >= 56.1) return "Fujairah";
    if (lat >= 25.26 && lat <= 25.55 && lng >= 55.36 && lng <= 55.75) return "Sharjah";
    if (lat >= 24.8 && lat <= 25.35 && lng >= 55.0 && lng <= 55.45) return "Dubai";
    if (lat < 24.85 || lng < 55.0) return "Abu Dhabi";
  }

  return "Dubai"; // Default commercial hub
}

// Endpoint to look up existing customer sites 1-by-1 using just company name
app.post("/api/customer-lookup", async (req, res) => {
  const { companyName } = req.body;
  if (!companyName || typeof companyName !== "string") {
    return res.status(400).json({ error: "Company name is required." });
  }

  const cleanCompanyName = companyName.trim();
  const mapsKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
  if (!mapsKey) {
    return res.status(500).json({ error: "GOOGLE_MAPS_PLATFORM_KEY is not configured." });
  }

  try {
    // Search query is strictly reduced to just the name of the company, nothing else
    const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.nationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.editorialSummary"
      },
      body: JSON.stringify({
        textQuery: cleanCompanyName
      })
    });

    if (!placesRes.ok) {
      const errText = await placesRes.text();
      console.error("Places searchText error for", cleanCompanyName, ":", errText);
      return res.json({
        success: true,
        companyName: cleanCompanyName,
        places: []
      });
    }

    const data = await placesRes.json();
    const rawPlaces = data.places || [];

    const formattedPlaces = rawPlaces.map((p: any) => {
      const pName = p.displayName?.text || cleanCompanyName;
      const pAddr = p.formattedAddress || "";
      const lat = p.location?.latitude || null;
      const lng = p.location?.longitude || null;
      const detectedEmirate = detectEmirateFromPlace(pAddr, lat, lng);

      return {
        id: p.id || `loc-${Math.random().toString(36).substr(2, 9)}`,
        name: pName,
        originalQuery: cleanCompanyName,
        address: pAddr,
        location: {
          latitude: lat,
          longitude: lng
        },
        phone: p.nationalPhoneNumber || "",
        website: p.websiteUri || "",
        category: p.primaryTypeDisplayName?.text || "Industrial Client",
        rating: p.rating || null,
        reviews: p.userRatingCount || 0,
        summary: p.editorialSummary?.text || "",
        googleMapsUri: p.googleMapsUri || "",
        emirate: detectedEmirate
      };
    });

    return res.json({
      success: true,
      companyName: cleanCompanyName,
      places: formattedPlaces
    });
  } catch (err: any) {
    console.error("Customer lookup error for", cleanCompanyName, ":", err);
    return res.status(500).json({ error: "Failed to lookup customer: " + err?.message });
  }
});


// Agentic AI endpoint
app.post("/api/agent", handleAgentRequest);

// Endpoint for generating stock push campaign outreach pitches
app.post("/api/generate-campaign-pitch", async (req, res) => {
  const { brandName, productName, sku, category, offerPrice, regularPrice, discountPercent, moq, targetCategories = [] } = req.body;
  try {
    const prompt = `You are a top-performing B2B technical sales strategist for an industrial warehouse stockist/distributor.
Craft high-converting outreach pitch drafts for pushing the following warehouse inventory item to customers in these industries: [${targetCategories.join(', ')}].

Product Details:
- Brand: ${brandName}
- Product: ${productName}
- SKU: ${sku}
- Material Category: ${category}
- List Price: $${regularPrice}
- Promotional Push Price: $${offerPrice} (${discountPercent}% clearance discount)
- Minimum Order Qty (MOQ): ${moq}

Generate a JSON response with 3 channels tailored for B2B procurement managers:
1. "whatsApp": High-impact, formatted with WhatsApp bolding (*text*), concise, urgent, emphasizing immediate warehouse dispatch, test certs, and clear CTA. Include placeholders {contact_name}, {company}, and {salesman_name}.
2. "email": Professional subject line and body for procurement/purchasing directors. Includes specifications, commercial pricing table, logistics terms, and trial/sample offer. Placeholders: {contact_name}, {company}, {salesman_name}.
3. "callScript": Concise cold/warm phone script with an opening hook, handling the objection ("We already have stock / suppliers"), and a closing proposal for sample/order commitment.`;

    const geminiRes = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional B2B industrial sales director. Return the output as valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            whatsApp: { type: Type.STRING },
            email: { type: Type.STRING },
            emailSubject: { type: Type.STRING },
            callScript: { type: Type.STRING },
            targetHook: { type: Type.STRING },
          },
          required: ["whatsApp", "email", "emailSubject", "callScript"]
        }
      }
    });

    let result;
    try {
      result = JSON.parse(geminiRes.text || "{}");
    } catch (e) {
      result = {
        whatsApp: `Hi {contact_name}, this is {salesman_name} from Gulf Stockist. We have an exclusive promotion on genuine *${brandName} ${productName}* at *$${offerPrice}* (${discountPercent}% off list) available for immediate ex-stock delivery from our warehouse. How many units can we allocate for {company}?`,
        emailSubject: `Special Stock Allocation: ${brandName} ${productName} for {company}`,
        email: `Dear {contact_name},\n\nWe have a special warehouse allocation of genuine ${brandName} ${productName} (SKU: ${sku}) at an exclusive rate of $${offerPrice} (regular list $${regularPrice}).\n\n- MOQ: ${moq}\n- Warehouse: Ready for immediate dispatch\n\nPlease let us know if we can forward a formal quotation or dispatch samples.\n\nBest regards,\n{salesman_name}`,
        callScript: `Hook: "Hello Eng. {contact_name}, calling regarding your current consumption of ${brandName} consumables at {company}. We have an immediate ex-stock price of $${offerPrice} for ${productName}."`
      };
    }

    res.json(result);
  } catch (error: any) {
    console.warn("AI pitch generation fallback triggered:", error?.message);
    res.json({
      whatsApp: `Hi {contact_name}, this is {salesman_name} from Gulf Stockist. We have an exclusive promotion on genuine *${brandName} ${productName}* at *$${offerPrice}* (${discountPercent}% off list) available for immediate ex-stock delivery from our warehouse. How many units can we allocate for {company}?`,
      emailSubject: `Special Stock Allocation: ${brandName} ${productName} for {company}`,
      email: `Dear {contact_name},\n\nWe have a special warehouse allocation of genuine ${brandName} ${productName} (SKU: ${sku}) at an exclusive rate of $${offerPrice} (regular list $${regularPrice}).\n\n- MOQ: ${moq}\n- Warehouse: Ready for immediate dispatch\n\nPlease let us know if we can forward a formal quotation or dispatch samples.\n\nBest regards,\n{salesman_name}`,
      callScript: `Hook: "Hello Eng. {contact_name}, calling regarding your current consumption of ${brandName} consumables at {company}. We have an immediate ex-stock price of $${offerPrice} for ${productName}."`
    });
  }
});

// Endpoint for generating a personalized pitch for an individual client
app.post("/api/personalize-pitch", async (req, res) => {
  const { 
    contactName, 
    company, 
    salesmanName, 
    brandName, 
    productName, 
    offerPrice, 
    moq,
    baseWhatsApp,
    baseEmail,
    enquiryHistory 
  } = req.body;

  try {
    let prompt = `You are a top-performing B2B technical sales strategist. You are personalizing an outreach message for ${contactName} at ${company}.
Your base templates are:
WhatsApp: ${baseWhatsApp}
Email: ${baseEmail}

`;
    if (enquiryHistory && enquiryHistory.length > 0) {
      prompt += `The client has the following real, documented purchase/enquiry history in our CRM system:
${enquiryHistory.map((e: any) => `- ${e.date}: Enquired about ${e.productLine} (Qty: ${e.quantity}, Outcome: ${e.outcome})`).join('\n')}

Modify the base templates to subtly reference this specific past history to build rapport. For example, "knowing you previously ordered [Product] from us..."
Only reference the facts provided above. Do not invent or assume any other purchases. Keep it highly professional and brief.`;
    } else {
      prompt += `If no enquiry or lead history is provided for this client, do not reference any past purchase — use the generic opening instead. Do not fabricate a "based on your recent purchase of X" line when no such purchase exists. Just fill in the {variables} and refine the tone to be professional.`;
    }

    const geminiRes = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional B2B industrial sales director. Return the output as valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            whatsApp: { type: Type.STRING },
            email: { type: Type.STRING },
            contextUsed: { type: Type.STRING }
          },
          required: ["whatsApp", "email", "contextUsed"]
        }
      }
    });

    let result;
    try {
      result = JSON.parse(geminiRes.text || "{}");
    } catch (e) {
      result = null;
    }

    if (result && result.whatsApp) {
      res.json(result);
    } else {
      throw new Error("Invalid output format");
    }
  } catch (error: any) {
    console.warn("AI personalization fallback triggered:", error?.message);
    res.status(500).json({ error: "Personalization failed" });
  }
});



app.get('/api/proxy-image', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch from target URL');
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.set('Content-Type', response.headers.get('content-type') || 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error("Proxy image error:", error);
    res.status(500).json({ error: String(error) });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
