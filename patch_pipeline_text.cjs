const fs = require('fs');
let code = fs.readFileSync('src/components/PipelineView.tsx', 'utf8');

code = code.replace("Generate PDF", "Generate Report");

fs.writeFileSync('src/components/PipelineView.tsx', code);
console.log("Patched text in PipelineView");
