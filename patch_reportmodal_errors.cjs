const fs = require('fs');
let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

// 1. Fix autoTable import and usage
code = code.replace("import 'jspdf-autotable';", "import autoTable from 'jspdf-autotable';");

code = code.replace(/\(doc as any\)\.autoTable\(\{\n\s*startY/g, "autoTable(doc, {\n            startY");
code = code.replace(/\(doc as any\)\.autoTable\(\{\n\s*startY: 35/g, "autoTable(doc, {\n          startY: 35");

// 2. Fix the proxy URL
const oldProxy = "const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(mapUrl);";
const newProxy = "const proxyUrl = '/api/proxy-image?url=' + encodeURIComponent(mapUrl);";

code = code.replace(oldProxy, newProxy);

fs.writeFileSync('src/components/ReportModal.tsx', code);
console.log("Patched ReportModal.tsx");
