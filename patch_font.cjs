const fs = require('fs');
let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

const target = `const doc = new jsPDF();
      let allocatedClients = new Set<string>();`;

const replacement = `const doc = new jsPDF();
      
      // Load Arabic Font
      setProgress('Loading fonts...');
      try {
        const fontRes = await fetch('/NotoNaskhArabic-Regular.ttf');
        if (fontRes.ok) {
          const fontBuffer = await fontRes.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(fontBuffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const fontBase64 = btoa(binary);
          
          doc.addFileToVFS('NotoNaskhArabic.ttf', fontBase64);
          doc.addFont('NotoNaskhArabic.ttf', 'NotoNaskhArabic', 'normal');
          doc.setFont('NotoNaskhArabic');
        }
      } catch (e) {
        console.error('Failed to load Arabic font', e);
      }

      let allocatedClients = new Set<string>();`;

code = code.replace(target, replacement);

const targetStyle1 = `styles: { fontSize: 8, cellPadding: 2 },`;
const replacementStyle1 = `styles: { fontSize: 8, cellPadding: 2, font: 'NotoNaskhArabic' },`;

code = code.replace(new RegExp(targetStyle1, 'g'), replacementStyle1);

fs.writeFileSync('src/components/ReportModal.tsx', code);
console.log("Patched ReportModal with Arabic Font");
