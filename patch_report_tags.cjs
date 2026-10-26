const fs = require('fs');
let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

// Update PDF table headers
code = code.replace(
  /head: \[\['Company Name', 'Tier', 'Website', 'Contact', 'Location', 'Status'\]\]/g,
  "head: [['Company Name', 'Tier', 'Website', 'Contact', 'Location', 'Status', 'Tags']]"
);

// Update PDF row data
code = code.replace(
  /c\.name \|\| 'N\/A',\s*c\.tier \? `Tier \$\{c\.tier\}` : 'N\/A',\s*c\.website \|\| 'N\/A',\s*c\.phone \|\| c\.email \|\| 'N\/A',\s*c\.address \|\| 'N\/A',\s*c\.status \|\| 'N\/A'/g,
  "c.name || 'N/A',\n            c.tier ? `Tier ${c.tier}` : 'N/A',\n            c.website || 'N/A',\n            c.phone || c.email || 'N/A',\n            c.address || 'N/A',\n            c.status || 'N/A',\n            c.tags?.join(', ') || 'N/A'"
);

// Update Excel columns
code = code.replace(
  /{ header: 'Category', key: 'category', width: 25 },/,
  "{ header: 'Category', key: 'category', width: 20 },\n        { header: 'Tags', key: 'tags', width: 30 },"
);

// Update Excel row mapping (zone clients)
code = code.replace(
  /category: c\.tags\?\.join\(\', \'\) \|\| c\.category \|\| \'\'\s*}\)/g,
  "category: c.category || '',\n              tags: c.tags?.join(', ') || ''\n            })"
);

fs.writeFileSync('src/components/ReportModal.tsx', code);
console.log("Patched ReportModal.tsx with Tags column");
