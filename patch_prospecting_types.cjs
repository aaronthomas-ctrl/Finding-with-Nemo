const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace("status?: string;", "status?: string;\n  businessStatus?: string;\n  googleMapsUri?: string;");
fs.writeFileSync('src/types.ts', code);
console.log("Patched types");
