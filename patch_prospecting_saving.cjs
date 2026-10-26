const fs = require('fs');

// Patch src/lib/pipeline.ts to include googleMapsUri
let pipelineCode = fs.readFileSync('src/lib/pipeline.ts', 'utf8');

const targetStr = `    status: "New", // default`;
const newStr = `    status: company.businessStatus || "New", // use businessStatus if available
    googleMapsLink: company.googleMapsUri || '',`;

if (pipelineCode.includes(targetStr)) {
  pipelineCode = pipelineCode.replace(targetStr, newStr);
  fs.writeFileSync('src/lib/pipeline.ts', pipelineCode);
  console.log("Updated pipeline save defaults.");
} else {
  console.log("Could not find pipeline save defaults string.");
}
