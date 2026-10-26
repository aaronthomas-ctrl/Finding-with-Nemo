const fs = require('fs');
let code = fs.readFileSync('src/lib/backup.ts', 'utf8');

const oldFunc = `export async function exportClientsCsv() {
  const data = await db.clients.toArray();
  if (!data.length) return;
  const headers = ['id', 'name', 'category', 'tier', 'status', 'phone', 'website', 'address', 'nextFollowUpDate', 'createdAt', 'updatedAt'];
  const csv = [headers.join(',')];
  for (const row of data) {
    csv.push(headers.map(h => escapeCsv((row as any)[h])).join(','));
  }
  downloadCsv('clients.csv', csv.join('\\n'));
}`;

const newFunc = `export async function exportClientsCsv() {
  const data = await db.clients.toArray();
  if (!data.length) return;
  
  // Find max targetBrands length to create dynamic headers
  let maxBrands = 0;
  data.forEach(client => {
    if (client.targetBrands && client.targetBrands.length > maxBrands) {
      maxBrands = client.targetBrands.length;
    }
  });

  const baseHeaders = ['id', 'name', 'category', 'tier', 'status', 'phone', 'website', 'address', 'nextFollowUpDate', 'createdAt', 'updatedAt'];
  const brandHeaders = [];
  for (let i = 1; i <= maxBrands; i++) {
    brandHeaders.push(\`Target Brand \${i}\`);
  }
  
  const allHeaders = [...baseHeaders, ...brandHeaders];
  const csv = [allHeaders.join(',')];

  for (const row of data) {
    const rowValues = baseHeaders.map(h => escapeCsv((row as any)[h]));
    
    // Fill in the brand columns
    for (let i = 0; i < maxBrands; i++) {
      if (row.targetBrands && row.targetBrands[i]) {
        rowValues.push(escapeCsv(row.targetBrands[i]));
      } else {
        rowValues.push('""'); // Empty column if brand doesn't exist for this index
      }
    }
    
    csv.push(rowValues.join(','));
  }

  downloadCsv('clients.csv', csv.join('\\n'));
}`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync('src/lib/backup.ts', code);
console.log("Patched exportClientsCsv in src/lib/backup.ts");
