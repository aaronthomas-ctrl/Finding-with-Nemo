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
        
        autoTable(doc, {`;

const newStr = `      // Unallocated Page by Emirates
      setProgress('Generating unallocated clients...');
      console.log("[Report] Generating unallocated clients");
      const unallocated = validClients.filter(c => !allocatedClients.has(c.id));
      
      const emirates = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
      
      const groupedUnallocated: { [key: string]: typeof validClients } = { 'Other Regions': [] };
      emirates.forEach(e => groupedUnallocated[e] = []);
      
      unallocated.forEach(c => {
        const addressUpper = (c.address || '').toUpperCase();
        let matched = false;
        for (const e of emirates) {
          if (addressUpper.includes(e.toUpperCase())) {
            groupedUnallocated[e].push(c);
            matched = true;
            break;
          }
        }
        if (!matched) {
          groupedUnallocated['Other Regions'].push(c);
        }
      });
      
      for (const groupName of [...emirates, 'Other Regions']) {
        const groupClients = groupedUnallocated[groupName];
        if (groupClients.length > 0) {
          if (filteredZones.length > 0 || groupName !== emirates[0]) doc.addPage();
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
          
          autoTable(doc, {`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('src/components/ReportModal.tsx', code);
  console.log("Patched PDF Report");
} else {
    console.log("PDF Report target string not found.");
}

const excelTargetStr = `      const unallocated = validClients.filter(c => !allocatedClients.has(c.id));
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
            category: c.category || '',
              tags: c.tags?.join(', ') || ''
            });
        });
      }`;

const excelNewStr = `      const unallocated = validClients.filter(c => !allocatedClients.has(c.id));
      const emirates = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
      const groupedUnallocated: { [key: string]: typeof validClients } = { 'Other Regions': [] };
      emirates.forEach(e => groupedUnallocated[e] = []);
      
      unallocated.forEach(c => {
        const addressUpper = (c.address || '').toUpperCase();
        let matched = false;
        for (const e of emirates) {
          if (addressUpper.includes(e.toUpperCase())) {
            groupedUnallocated[e].push(c);
            matched = true;
            break;
          }
        }
        if (!matched) {
          groupedUnallocated['Other Regions'].push(c);
        }
      });
      
      for (const groupName of [...emirates, 'Other Regions']) {
        const groupClients = groupedUnallocated[groupName];
        if (groupClients.length > 0) {
          const headerRow = masterSheet.getRow(currentRow);
          headerRow.getCell(1).value = \`\${groupName} (No Map Region)\`;
          headerRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFF0000' } };
          currentRow++;
          
          groupClients.forEach(c => {
            masterSheet.addRow({
              name: c.name || '',
              tier: c.tier || '',
              website: c.website || '',
              contact: c.phone || c.email || '',
              location: c.address || '',
              status: c.status || '',
              category: c.category || '',
              tags: c.tags?.join(', ') || ''
            });
          });
          currentRow += 2;
        }
      }`;

if(code.includes(excelTargetStr)) {
    code = code.replace(excelTargetStr, excelNewStr);
    fs.writeFileSync('src/components/ReportModal.tsx', code);
    console.log("Patched Excel Report");
} else {
    console.log("Excel target string not found.");
}
