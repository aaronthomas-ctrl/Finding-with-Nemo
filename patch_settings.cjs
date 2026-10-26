const fs = require('fs');

let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

code = code.replace(
  'clientsToEnrich.sort((a: any, b: any) => (a.lastMapEnrich || 0) - (b.lastMapEnrich || 0));',
  'clientsToEnrich.sort((a: any, b: any) => ((a.metadata?.lastMapEnrich || a.metadata?.last_map_enrich) || 0) - ((b.metadata?.lastMapEnrich || b.metadata?.last_map_enrich) || 0));'
);

code = code.replace(
  `                  lastMapEnrich: Date.now(),`,
  `                  metadata: { ...(c.metadata || {}), lastMapEnrich: Date.now() },`
);

code = code.replace(
  `{ autoTagged: true, lastMapEnrich: Date.now(), ...statusUpdate }`,
  `{ autoTagged: true, metadata: { ...(c.metadata || {}), lastMapEnrich: Date.now() }, ...statusUpdate }`
);

code = code.replace(
  `{ autoTagged: true, lastMapEnrich: Date.now() }`,
  `{ autoTagged: true, metadata: { ...(c.metadata || {}), lastMapEnrich: Date.now() } }`
);

fs.writeFileSync('src/components/SettingsView.tsx', code);
console.log("Patched lastMapEnrich to use metadata");
