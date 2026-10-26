const fs = require('fs');
let code = fs.readFileSync('src/db/index.ts', 'utf8');

code = code.replace("mapEnriched?: boolean;", "");

fs.writeFileSync('src/db/index.ts', code);
console.log("Patched db/index.ts");
