const fs = require('fs');
let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

const target1 = `          const tableData = zoneClients.map(c => [
            c.name || 'N/A',
            c.tier ? \`Tier \${c.tier}\` : 'N/A',
            c.website || 'N/A',
            c.phone || c.email || 'N/A',
            c.address || 'N/A',
            c.status || 'N/A'
          ]);`;

const replacement1 = `          const tableData = zoneClients.map(c => [
            c.name || 'N/A',
            c.tier ? \`Tier \${c.tier}\` : 'N/A',
            c.website || 'N/A',
            c.phone || c.email || 'N/A',
            c.address || 'N/A',
            c.status || 'N/A'
          ]);`; // Keep as is for data structure, will handle links in drawCell

const drawCellLogic1 = `          autoTable(doc, {
            startY,
            head: [['Company Name', 'Tier', 'Website', 'Contact', 'Location', 'Status']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 2, font: 'NotoNaskhArabic' },
            headStyles: { fillColor: [66, 133, 244] },
            columnStyles: {
              2: { cellWidth: 30 },
              4: { cellWidth: 40 }
            },
            willDrawCell: function(data) {
              // Ensure we draw the text with NotoNaskhArabic for Arabic text
              doc.setFont('NotoNaskhArabic', 'normal');
            },
            didDrawCell: function(data) {
              // Add links to location column
              if (data.column.index === 4 && data.cell.section === 'body') {
                const rowIndex = data.row.index;
                const client = zoneClients[rowIndex];
                if (client && client.lat && client.lng) {
                  const mapUrl = \`https://www.google.com/maps/search/?api=1&query=\${client.lat},\${client.lng}\`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: mapUrl });
                }
              }
            }
          });`;

code = code.replace(/autoTable\(doc, \{\n\s*startY,\n\s*head: \[\[(?:.|\n)*?\}\n\s*\}\n\s*\}\);\n/m, drawCellLogic1 + "\n");

const drawCellLogic2 = `        autoTable(doc, {
          startY: 35,
          head: [['Company Name', 'Tier', 'Website', 'Contact', 'Location', 'Status']],
          body: tableData,
          styles: { fontSize: 8, cellPadding: 2, font: 'NotoNaskhArabic' },
          headStyles: { fillColor: [239, 68, 68] },
          columnStyles: {
            2: { cellWidth: 30 },
            4: { cellWidth: 40 }
          },
          willDrawCell: function(data) {
            doc.setFont('NotoNaskhArabic', 'normal');
          },
          didDrawCell: function(data) {
            if (data.column.index === 4 && data.cell.section === 'body') {
              const rowIndex = data.row.index;
              const client = unallocated[rowIndex];
              if (client && client.lat && client.lng) {
                const mapUrl = \`https://www.google.com/maps/search/?api=1&query=\${client.lat},\${client.lng}\`;
                doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: mapUrl });
              }
            }
          }
        });`;

code = code.replace(/autoTable\(doc, \{\n\s*startY: 35,\n\s*head: \[\[(?:.|\n)*?\}\n\s*\}\n\s*\}\);\n/m, drawCellLogic2 + "\n");

fs.writeFileSync('src/components/ReportModal.tsx', code);
console.log("Patched ReportModal to add Location links and fix bold font missing error");
