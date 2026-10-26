const fs = require('fs');
let code = fs.readFileSync('src/components/ReportModal.tsx', 'utf8');

if (!code.includes("import * as XLSX from 'xlsx';")) {
  code = code.replace(
    "import autoTable from 'jspdf-autotable';",
    "import autoTable from 'jspdf-autotable';\nimport * as XLSX from 'xlsx';"
  );
}

// Rename generateReport to generatePDF
code = code.replace("const generateReport = async () => {", "const generatePDF = async () => {");

// Add generateExcel
const generateExcelLogic = `
  const generateExcel = async () => {
    setIsGenerating(true);
    setProgress('Preparing data...');
    try {
      const allClients = await db.clients.toArray();
      const validClients = allClients.filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
      
      const filteredZones = zones.filter(z => selectedZones.has(z.id));
      let allocatedClients = new Set<string>();
      
      const wb = XLSX.utils.book_new();
      
      for (const zone of filteredZones) {
        let zoneClients = [];
        if (zone.path && zone.path.length > 0) {
          zoneClients = validClients.filter(c => 
            c.lat && c.lng && pointInPolygon({ lat: c.lat, lng: c.lng }, zone.path)
          );
        }
        
        zoneClients.forEach(c => allocatedClients.add(c.id));
        
        if (zoneClients.length > 0) {
          const sheetData = zoneClients.map(c => ({
            'Company Name': c.name || '',
            'Tier': c.tier || '',
            'Website': c.website || '',
            'Contact (Phone/Email)': c.phone || c.email || '',
            'Location': c.address || '',
            'Status': c.status || '',
            'Category': c.tags?.join(', ') || c.category || ''
          }));
          
          let sheetName = zone.name.split('|||')[0].substring(0, 31); // Excel sheet names max 31 chars
          // Ensure unique sheet name
          let suffix = 1;
          let uniqueName = sheetName;
          while (wb.SheetNames.includes(uniqueName)) {
            uniqueName = \`\${sheetName.substring(0, 28)}_\${suffix}\`;
            suffix++;
          }
          
          const ws = XLSX.utils.json_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(wb, ws, uniqueName);
        }
      }
      
      // Unallocated
      const unallocated = validClients.filter(c => !allocatedClients.has(c.id));
      if (unallocated.length > 0) {
        const sheetData = unallocated.map(c => ({
          'Company Name': c.name || '',
          'Tier': c.tier || '',
          'Website': c.website || '',
          'Contact (Phone/Email)': c.phone || c.email || '',
          'Location': c.address || '',
          'Status': c.status || '',
          'Category': c.tags?.join(', ') || c.category || ''
        }));
        const ws = XLSX.utils.json_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, 'Unallocated');
      }
      
      if (wb.SheetNames.length === 0) {
        alert("No data to export.");
        setIsGenerating(false);
        return;
      }
      
      XLSX.writeFile(wb, 'Prospecting_Zones_Report.xlsx');
      onClose();
    } catch (err: any) {
      console.error("[Report] Fatal Error", err);
      alert('Failed to generate excel: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };
`;

code = code.replace(
  "  return (\n    <div className=\"fixed inset-0",
  generateExcelLogic + "\n  return (\n    <div className=\"fixed inset-0"
);

// Replace button with two buttons
const oldButton = `<button
            onClick={generateReport}
            disabled={isGenerating || selectedZones.size === 0 && zones.length > 0}
            className="w-full shrink-0 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-medium transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {progress || 'Generating...'}
              </>
            ) : (
              \`Generate Report (\${selectedZones.size} zones)\`
            )}
          </button>`;

const newButtons = `<div className="flex gap-3 shrink-0">
          <button
            onClick={generatePDF}
            disabled={isGenerating || (selectedZones.size === 0 && zones.length > 0)}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-medium transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              \`Export PDF\`
            )}
          </button>
          
          <button
            onClick={generateExcel}
            disabled={isGenerating || (selectedZones.size === 0 && zones.length > 0)}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-medium transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              \`Export Excel\`
            )}
          </button>
          </div>
          {isGenerating && <div className="text-center text-xs text-slate-400 mt-2">{progress}</div>}
`;

code = code.replace(oldButton, newButtons);
code = code.replace("Generate PDF Report", "Generate Report");

fs.writeFileSync('src/components/ReportModal.tsx', code);
console.log("Patched ReportModal for Excel Export");
