const fs = require('fs');
let code = fs.readFileSync('src/db/index.ts', 'utf8');

if (code.includes("autoTagged?: boolean;")) {
  code = code.replace(
    "autoTagged?: boolean;",
    "autoTagged?: boolean;\n  mapEnriched?: boolean;"
  );
} else {
  code = code.replace(
    "tags: string[];",
    "tags: string[];\n  mapEnriched?: boolean;"
  );
}

fs.writeFileSync('src/db/index.ts', code);
console.log("Patched db/index.ts");
