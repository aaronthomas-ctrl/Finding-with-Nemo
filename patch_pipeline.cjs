const fs = require('fs');
let code = fs.readFileSync('src/components/PipelineView.tsx', 'utf8');

code = code.replace(
  '{Object.entries(groupedClients).sort((a,b) => b[1].length - a[1].length).map(([region, regionClients]) => {',
  '{Object.entries(groupedClients).sort((a: any, b: any) => b[1].length - a[1].length).map(([region, regionClients]: [string, any]) => {'
);

code = code.replace(
  '{regionClients.map((client) => (',
  '{regionClients.map((client: any) => ('
);

fs.writeFileSync('src/components/PipelineView.tsx', code);
console.log("Patched PipelineView");
