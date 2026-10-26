const fs = require('fs');
let code = fs.readFileSync('src/db/index.ts', 'utf8');

// 1. Settings interface
code = code.replace(
  `  cadenceDays: { 1: number; 2: number; 3: number; 4: number };`,
  `  cadenceDays: { 1: number; 2: number; 3: number; 4: number };\n  distributedBrands?: string[];`
);

// 2. Client interface
code = code.replace(
  `  restrictedBrands?: string[];`,
  `  restrictedBrands?: string[];\n  targetBrands?: string[];`
);

// 3. Default Settings seeding
code = code.replace(
  `cadence_days: { "1": 7, "2": 14, "3": 30, "4": 30 },`,
  `cadence_days: { "1": 7, "2": 14, "3": 30, "4": 30 },\n        distributed_brands: ["EWM", "Callington", "ESAB Machines", "ESAB Consummables", "ESAB Wear Parts", "Grindex", "SPY", "Umbrella", "Victor", "Arcmaster Oven", "Arcmaster Accessories"],`
);

// 4. Default array ensuring for Client
code = code.replace(
  `if (!newObj.restrictedBrands) newObj.restrictedBrands = [];`,
  `if (!newObj.restrictedBrands) newObj.restrictedBrands = [];\n      if (!newObj.targetBrands) newObj.targetBrands = [];`
);

fs.writeFileSync('src/db/index.ts', code);
console.log("Patched src/db/index.ts");
