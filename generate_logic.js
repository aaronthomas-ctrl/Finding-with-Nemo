const fs = require('fs');

const tags = {
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

const regexes = {};
for (const [tag, words] of Object.entries(tags)) {
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  regexes[tag] = new RegExp(`\\\\b(${pattern})\\\\b`, 'i');
}

console.log(JSON.stringify(tags, null, 2));

