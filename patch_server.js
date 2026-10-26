const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const newEndpoint = `
// Endpoint to auto-tag a client based on their website
app.post("/api/auto-tag", async (req, res) => {
  const { websiteUri, companyName } = req.body;
  if (!websiteUri) {
    return res.status(400).json({ error: "No website URL provided." });
  }

  try {
    const fetchController = new AbortController();
    const timeoutId = setTimeout(() => fetchController.abort(), 8000);
    const websiteRes = await fetch(websiteUri, { 
      signal: fetchController.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    clearTimeout(timeoutId);
    
    if (!websiteRes.ok) throw new Error(\`Failed to fetch website (\${websiteRes.status})\`);

    const html = await websiteRes.text();
    const $ = cheerio.load(html);
    const title = $("title").text().trim();
    const metaDesc = $('meta[name="description"]').attr("content")?.trim() || "";
    $("script, style, noscript, nav, footer, header").remove();
    let visibleText = $("body").text().replace(/\\s+/g, " ").trim();
    if (visibleText.length > 2000) visibleText = visibleText.substring(0, 2000);

    const summaryText = \`Title: \${title}\\nDescription: \${metaDesc}\\nText: \${visibleText}\`;

    const prompt = \`Analyze this B2B company's website content. Company name: "\${companyName}".
Determine their primary industry category.
Choose the BEST match from this list, or create a similar short professional category if none fit perfectly:
- EPC Contractor
- Steel Fabricator
- Maintenance & Repair
- Welding Shop
- Engineering
- Marine/Shipbuilding
- Oilfield & Petrochemical Services
- MEP
- Manufacturing

Return ONLY a JSON object with a single field "category" containing the best matching string.

Website Content:
\${summaryText}\`;

    const geminiRes = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING }
          },
          required: ["category"]
        }
      }
    });

    if (geminiRes.text) {
      const result = JSON.parse(geminiRes.text);
      return res.json({ category: result.category });
    }
    throw new Error("No text generated");
  } catch (error) {
    console.error("Error auto-tagging company:", error);
    res.status(500).json({ error: "Failed to auto-tag" });
  }
});
`;

fs.writeFileSync('server.ts', content.replace('// Endpoint for explicit map grounding insights', newEndpoint + '\n// Endpoint for explicit map grounding insights'));
