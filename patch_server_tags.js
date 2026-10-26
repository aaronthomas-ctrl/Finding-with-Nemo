const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `
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
      const regex = new RegExp(\`\\\\b\${word.replace(/[.*+?^\${}()|[\\]\\\\\\\\]/g, '\\\\\\\\$&')}\\\\b\`, 'i');
      if (regex.test(text)) {
        foundTags.push(tag);
        break; // found at least one word for this tag, move to next tag
      }
    }
  }

  if (foundTags.includes('LOW_RELEVANCE')) {
    return { tier: 4, tags: ['LOW_RELEVANCE'], category: 'Low Relevance', skip: true };
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
  else tier = 4; // Fallback

  // Sort tags by priority for category selection
  const sortedTags = [...foundTags].sort((a, b) => {
    const getPri = t => priorityA.includes(t) ? 1 : priorityB.includes(t) ? 2 : priorityC.includes(t) ? 3 : priorityD.includes(t) ? 4 : 5;
    return getPri(a) - getPri(b);
  });

  const category = sortedTags.length > 0 ? sortedTags[0] : 'Unknown';

  return { tier, tags: foundTags, category, skip: false };
}

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
        const timeoutId = setTimeout(() => fetchController.abort(), 6000);
        const websiteRes = await fetch(client.websiteUri, { 
          signal: fetchController.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        clearTimeout(timeoutId);
        
        if (websiteRes.ok) {
          const html = await websiteRes.text();
          const $ = cheerio.load(html);
          $("script, style, noscript, nav, footer, header").remove();
          let visibleText = $("body").text().replace(/\\s+/g, " ").trim();
          
          if (visibleText.length > 50) {
             results[client.id] = analyzeWebsiteText(visibleText);
          } else {
             results[client.id] = { tier: 4, category: 'Unknown', tags: [], skip: false };
          }
        } else {
          results[client.id] = { tier: 4, category: 'Unknown', tags: [], skip: false };
        }
      } catch (err) {
        results[client.id] = { tier: 4, category: 'Unknown', tags: [], skip: false };
      }
    });

    await Promise.all(fetchPromises);
    res.json({ results });
  } catch (error) {
    console.error('Error auto-tagging batch:', error);
    res.status(500).json({ error: 'Failed to auto-tag', details: error.message || String(error) });
  }
});
`;

code = code.replace(/\/\/ Endpoint to auto-tag a batch of clients based on their websites[\s\S]*?res\.status\(500\)\.json\({ error: 'Failed to auto-tag', details: error\.message \|\| String\(error\) }\);\n  }\n\}\);/g, replacement);

fs.writeFileSync('server.ts', code);
