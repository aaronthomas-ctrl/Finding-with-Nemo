const fs = require('fs');

let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

const targetStr = `      // Unallocated Page
      setProgress('Generating unallocated clients...');
      console.log("[Report] Generating unallocated clients");
      const unallocated = validClients.filter(c => !allocatedClients.has(c.id));
      if (unallocated.length > 0) {
        if (filteredZones.length > 0) doc.addPage();
        doc.setFontSize(18);
        doc.text(\`Unallocated Companies (No Region)\`, 14, 20);
        doc.setFontSize(10);
        doc.text(\`These companies did not fall within any selected map zone.\`, 14, 28);
        const tableData = unallocated.map(c => [
          c.name || 'N/A',
            c.tier ? \`Tier \${c.tier}\` : 'N/A',
            c.website || 'N/A',
            c.phone || c.email || 'N/A',
            c.address || 'N/A',
            c.status || 'N/A',
            c.tags?.join(', ') || 'N/A'
        ]);
        
        autoTable(doc, {
          startY: 35,
          head: [['Company Name', 'Tier', 'Website', 'Contact', 'Location', 'Status', 'Tags']],
          body: tableData,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [41, 128, 185] }
        });
      }`;

const newStr = `      // Unallocated Page by Emirates
      setProgress('Generating unallocated clients...');
      console.log("[Report] Generating unallocated clients");
      // Note: We use the already grouped variables from Excel if they existed at the top level, 
      // but they are scoped differently, so let's recalculate for PDF
      const unallocatedForPdf = validClients.filter(c => !allocatedClients.has(c.id));
      
      const emiratesForPdf = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
      const groupedPdf: { [key: string]: typeof validClients } = { 'Other Regions': [] };
      emiratesForPdf.forEach(e => groupedPdf[e] = []);
      
      unallocatedForPdf.forEach(c => {
        const addressUpper = (c.address || '').toUpperCase();
        let matched = false;
        for (const e of emiratesForPdf) {
          if (addressUpper.includes(e.toUpperCase())) {
            groupedPdf[e].push(c);
            matched = true;
            break;
          }
        }
        if (!matched) {
          groupedPdf['Other Regions'].push(c);
        }
      });
      
      let isFirstUnallocatedPage = true;
      for (const groupName of [...emiratesForPdf, 'Other Regions']) {
        const groupClients = groupedPdf[groupName];
        if (groupClients.length > 0) {
          if (filteredZones.length > 0 || !isFirstUnallocatedPage) doc.addPage();
          isFirstUnallocatedPage = false;
          
          doc.setFontSize(18);
          doc.text(\`\${groupName} (No Map Region)\`, 14, 20);
          doc.setFontSize(10);
          doc.text(\`These companies did not fall within any selected map zone, categorized by address.\`, 14, 28);
          
          const tableData = groupClients.map(c => [
            c.name || 'N/A',
              c.tier ? \`Tier \${c.tier}\` : 'N/A',
              c.website || 'N/A',
              c.phone || c.email || 'N/A',
              c.address || 'N/A',
              c.status || 'N/A',
              c.tags?.join(', ') || 'N/A'
          ]);
          
          autoTable(doc, {
            startY: 35,
            head: [['Company Name', 'Tier', 'Website', 'Contact', 'Location', 'Status', 'Tags']],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
          });
        }
      }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('src/components/ReportModal.tsx', code);
  console.log("Patched PDF Report");
} else {
    console.log("Target not found.");
}
