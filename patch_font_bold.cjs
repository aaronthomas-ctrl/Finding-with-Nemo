const fs = require('fs');
let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

const target = `doc.addFileToVFS('NotoNaskhArabic.ttf', fontBase64);
          doc.addFont('NotoNaskhArabic.ttf', 'NotoNaskhArabic', 'normal');
          doc.setFont('NotoNaskhArabic');`;

const replacement = `doc.addFileToVFS('NotoNaskhArabic.ttf', fontBase64);
          doc.addFont('NotoNaskhArabic.ttf', 'NotoNaskhArabic', 'normal');
          doc.addFont('NotoNaskhArabic.ttf', 'NotoNaskhArabic', 'bold');
          doc.setFont('NotoNaskhArabic');`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/ReportModal.tsx', code);
console.log("Patched ReportModal to add bold font registration");
