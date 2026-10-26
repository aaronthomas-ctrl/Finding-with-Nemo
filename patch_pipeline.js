const fs = require('fs');
let code = fs.readFileSync('src/lib/pipeline.ts', 'utf8');

const validCategories = [
  "EPC Contractor",
  "Steel Fabricator",
  "Oilfield & Petrochemical Services",
  "Electromechanical/MEP",
  "Marine/Shipbuilding",
  "Welding Trade/Distributor",
  "Trader",
  "Other"
];

code = code.replace(
  'category: company.category || "Other",',
  `category: ["EPC Contractor", "Steel Fabricator", "Oilfield & Petrochemical Services", "Electromechanical/MEP", "Marine/Shipbuilding", "Welding Trade/Distributor", "Trader", "Other"].includes(company.category as string) ? company.category : "Other",`
);

fs.writeFileSync('src/lib/pipeline.ts', code);
console.log("Patched pipeline.ts");
