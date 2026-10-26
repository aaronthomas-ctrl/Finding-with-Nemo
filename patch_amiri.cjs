const fs = require('fs');
let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

const targetFontSetup = `      // Load Arabic Font
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
          doc.addFont('NotoNaskhArabic.ttf', 'NotoNaskhArabic', 'bold');
          doc.setFont('NotoNaskhArabic');
        }
      } catch (e) {
        console.error('Failed to load Arabic font', e);
      }`;

const newFontSetup = `      // Load Arabic/English Font
      setProgress('Loading fonts...');
      try {
        const fetchFont = async (path, filename, weight) => {
          const fontRes = await fetch(path);
          if (fontRes.ok) {
            const fontBuffer = await fontRes.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(fontBuffer);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const fontBase64 = btoa(binary);
            doc.addFileToVFS(filename, fontBase64);
            doc.addFont(filename, 'Amiri', weight);
          }
        };
        await fetchFont('/Amiri-Regular.ttf', 'Amiri-Regular.ttf', 'normal');
        await fetchFont('/Amiri-Bold.ttf', 'Amiri-Bold.ttf', 'bold');
        doc.setFont('Amiri');
      } catch (e) {
        console.error('Failed to load Amiri fonts', e);
      }`;

code = code.replace(targetFontSetup, newFontSetup);

// Replace NotoNaskhArabic with Amiri everywhere else
code = code.replace(/NotoNaskhArabic/g, 'Amiri');

fs.writeFileSync('src/components/ReportModal.tsx', code);
console.log("Patched ReportModal to use Amiri fonts");
