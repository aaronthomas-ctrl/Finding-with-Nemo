const fs = require('fs');
let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

// I will look for the first occurrence of "const generateExcel = async () => {" 
// and the final "return (" and replace everything in between with just one generateExcel implementation.
const firstIndex = code.indexOf("const generateExcel = async () => {");
const returnIndex = code.lastIndexOf("return (");

if (firstIndex !== -1 && returnIndex !== -1) {
  const newExcelLogic = `const generateExcel = async () => {
    setIsGenerating(true);
    setProgress('Preparing data...');
    try {
      const allClients = await db.clients.toArray();
      const validClients = allClients.filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
      
      const filteredZones = zones.filter(z => selectedZones.has(z.id));
      let allocatedClients = new Set<string>();
      
      const workbook = new ExcelJS.Workbook();
      const masterSheet = workbook.addWorksheet('Master Report');
      
      // Set column widths
      masterSheet.columns = [
        { header: 'Company Name', key: 'name', width: 30 },
        { header: 'Tier', key: 'tier', width: 10 },
        { header: 'Website', key: 'website', width: 30 },
        { header: 'Contact', key: 'contact', width: 25 },
        { header: 'Location', key: 'location', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Category', key: 'category', width: 25 },
      ];
      masterSheet.getRow(1).font = { bold: true };
      
      let currentRow = 2;

      for (const zone of filteredZones) {
        let zoneClients = [];
        if (zone.path && zone.path.length > 0) {
          zoneClients = validClients.filter(c => 
            c.lat && c.lng && isPointInPolygon({ lat: c.lat, lng: c.lng }, zone.path)
          );
        }
        
        zoneClients.forEach(c => allocatedClients.add(c.id));
        
        const headerRow = masterSheet.getRow(currentRow);
        headerRow.getCell(1).value = \`Zone: \${zone.name.split('|||')[0]}\`;
        headerRow.getCell(1).font = { bold: true, size: 14 };
        currentRow++;

        if (zone.path && zone.path.length > 0) {
          setProgress(\`Loading map for \${zone.name}...\`);
          const pathString = zone.path.map(p => \`\${p.lat},\${p.lng}\`).join('|');
          let mapUrl = \`https://maps.googleapis.com/maps/api/staticmap?size=600x300&path=color:0x4285F4AA|fillcolor:0x4285F433|weight:2|\${pathString}&key=\${API_KEY}\`;
          
          const markerClients = zoneClients.slice(0, 50);
          if (markerClients.length > 0) {
            const markers = markerClients.map(c => \`\${c.lat},\${c.lng}\`).join('|');
            mapUrl += \`&markers=color:red|size:small|\${markers}\`;
          }
          
          try {
            const proxyUrl = '/api/proxy-image?url=' + encodeURIComponent(mapUrl);
            const imgRes = await fetch(proxyUrl);
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const imageId = workbook.addImage({
                buffer: arrayBuffer,
                extension: 'png',
              });
              masterSheet.addImage(imageId, {
                tl: { col: 0, row: currentRow - 1 },
                ext: { width: 500, height: 250 }
              });
              currentRow += 14; 
            }
          } catch (e) {
            console.error("Map fetch error", e);
            masterSheet.getRow(currentRow).getCell(1).value = "[Map Image failed to load]";
            currentRow++;
          }
        }
        
        if (zoneClients.length > 0) {
          zoneClients.forEach(c => {
            masterSheet.addRow({
              name: c.name || '',
              tier: c.tier || '',
              website: c.website || '',
              contact: c.phone || c.email || '',
              location: c.address || '',
              status: c.status || '',
              category: c.tags?.join(', ') || c.category || ''
            });
            currentRow++;
          });
        } else {
          masterSheet.getRow(currentRow).getCell(1).value = "No companies found in this zone.";
          currentRow++;
        }
        
        currentRow += 2;
      }
      
      const unallocated = validClients.filter(c => !allocatedClients.has(c.id));
      if (unallocated.length > 0) {
        const headerRow = masterSheet.getRow(currentRow);
        headerRow.getCell(1).value = \`Unallocated Companies (No Map Region)\`;
        headerRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFF0000' } };
        currentRow++;
        
        unallocated.forEach(c => {
          masterSheet.addRow({
            name: c.name || '',
            tier: c.tier || '',
            website: c.website || '',
            contact: c.phone || c.email || '',
            location: c.address || '',
            status: c.status || '',
            category: c.tags?.join(', ') || c.category || ''
          });
        });
      }
      
      setProgress('Saving Excel...');
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'Prospecting_Zones_Report.xlsx');
      
      onClose();
    } catch (err: any) {
      console.error("[Report] Fatal Error", err);
      alert('Failed to generate excel: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  `;
  code = code.substring(0, firstIndex) + newExcelLogic + code.substring(returnIndex);
}

fs.writeFileSync('src/components/ReportModal.tsx', code);
console.log("Fixed ReportModal.tsx");
