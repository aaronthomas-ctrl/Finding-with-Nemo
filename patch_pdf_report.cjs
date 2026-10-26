const fs = require('fs');

let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

const startIndex = code.indexOf("// Unallocated Page");
const endIndex = code.indexOf("setProgress('Saving PDF...');");

if (startIndex !== -1 && endIndex !== -1) {
    const originalBlock = code.substring(startIndex, endIndex);

    const newBlock = `// Unallocated Page by Emirates (PDF)
      setProgress('Generating unallocated clients...');
      console.log("[Report] Generating unallocated clients");
      
      const unallocatedPdf = validClients.filter(c => !allocatedClients.has(c.id));
      const emiratesPdf = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
      const groupedPdf: { [key: string]: typeof validClients } = { 'Other Regions': [] };
      emiratesPdf.forEach(e => groupedPdf[e] = []);
      
      unallocatedPdf.forEach(c => {
        const addressUpper = (c.address || '').toUpperCase();
        let matched = false;
        for (const e of emiratesPdf) {
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
      for (const groupName of [...emiratesPdf, 'Other Regions']) {
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
            styles: { fontSize: 8, cellPadding: 2, font: 'Amiri' },
            headStyles: { fillColor: [239, 68, 68] },
            columnStyles: {
              2: { cellWidth: 30 },
              4: { cellWidth: 40 }
            },
            willDrawCell: function(data) {
              doc.setFont('Amiri', 'normal');
            },
            didDrawCell: function(data) {
              if (data.column.index === 4 && data.cell.section === 'body') {
                const rowIndex = data.row.index;
                const client = groupClients[rowIndex];
                if (client && client.lat && client.lng) {
                  const mapUrl = \`https://www.google.com/maps/search/?api=1&query=\${client.lat},\${client.lng}\`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: mapUrl });
                }
              }
            }
          });
        }
      }
      
      `;
      
    code = code.substring(0, startIndex) + newBlock + code.substring(endIndex);
    fs.writeFileSync('src/components/ReportModal.tsx', code);
    console.log("Patched PDF Unallocated.");
} else {
    console.log("Indexes not found", startIndex, endIndex);
}
