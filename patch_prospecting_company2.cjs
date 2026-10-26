const fs = require('fs');
let code = fs.readFileSync('src/components/ProspectingView.tsx', 'utf8');

const oldStr = `status: p.businessStatus,`;
const newStr = `status: p.businessStatus,
            businessStatus: p.businessStatus,
            googleMapsUri: p.googleMapsUri,`;

if(code.includes(oldStr)) {
  code = code.replace(oldStr, newStr);
  fs.writeFileSync('src/components/ProspectingView.tsx', code);
  console.log("Patched mapping.");
}
