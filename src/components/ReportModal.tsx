import React, { useState, useEffect } from 'react';
import { FileText, Loader2, X, CheckSquare, Square } from 'lucide-react';
import { db } from '../db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { encodePolyline } from '../lib/polyline';

const API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

// Point inside polygon using ray casting
function isPointInPolygon(point: {lat: number, lng: number}, vs: {lat: number, lng: number}[]) {
  if (!vs || vs.length === 0) return false;
  let x = point.lng, y = point.lat;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].lng, yi = vs[i].lat;
    let xj = vs[j].lng, yj = vs[j].lat;
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function ReportModal({ onClose }: { onClose: () => void }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    db.searchZones.toArray().then(z => {
      setZones(z);
      setSelectedZones(new Set(z.map((x:any) => x.id)));
    });
  }, []);

  const toggleZone = (id: string) => {
    const newSet = new Set(selectedZones);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedZones(newSet);
  };
  
  const selectAll = () => {
    setSelectedZones(new Set(zones.map(z => z.id)));
  };
  
  const deselectAll = () => {
    setSelectedZones(new Set());
  };

  const loadImageAsBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error('Canvas context failed'));
        }
      };
      img.onerror = () => {
        console.warn("Failed to load map image natively, trying via proxy...");
        // Google static maps often block pure client-side cors requests, 
        // we can try fetching via a generic cors proxy as fallback, or just return empty
        resolve(""); 
      };
      img.src = url;
    });
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      setProgress('Loading data...');
      console.log("[Report] Starting data load");
      const allClients = await db.clients.toArray();
      const allZones = await db.searchZones.toArray();
      const validClients = allClients.filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
      
      const filteredZones = allZones.filter(z => selectedZones.has(z.id));

      console.log(`[Report] Valid clients: ${validClients.length}, Filtered zones: ${filteredZones.length}`);

      const doc = new jsPDF();
      
      // Load Arabic/English Font
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
      }

      let allocatedClients = new Set<string>();

      setProgress('Generating zone pages...');
      for (let i = 0; i < filteredZones.length; i++) {
        const zone = filteredZones[i];
        console.log(`[Report] Processing zone ${i+1}/${filteredZones.length}: ${zone.name}`);
        if (i > 0) doc.addPage();

        // Find clients in this zone
        const zoneClients = validClients.filter(c => {
          if (!c.lat || !c.lng) return false;
          return isPointInPolygon({ lat: c.lat, lng: c.lng }, zone.path);
        });

        zoneClients.forEach(c => allocatedClients.add(c.id));

        // Header
        doc.setFontSize(18);
        doc.text(`Zone Report: ${zone.name.split('|||')[0].trim()}`, 14, 20);
        doc.setFontSize(12);
        const tags = zone.name.includes('|||') ? zone.name.split('|||')[1].trim() : 'None';
        doc.text(`Tags: ${tags}`, 14, 28);
        doc.text(`Total Clients Found: ${zoneClients.length}`, 14, 34);

        if (zone.path && zone.path.length > 0 && API_KEY) {
          setProgress(`Fetching map for ${zone.name.split('|||')[0].trim()}...`);
          // Generate Static Map URL
          const encPath = encodePolyline(zone.path);
          let mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&path=color:0x4285F480|weight:2|fillcolor:0x4285F430|enc:${encPath}&key=${API_KEY}`;
          
          // Add markers, batch if too many to avoid URL length issues (limit to ~50 markers)
          const markerClients = zoneClients.slice(0, 50);
          if (markerClients.length > 0) {
            const markers = markerClients.map(c => `${c.lat},${c.lng}`).join('|');
            mapUrl += `&markers=color:red|size:small|${markers}`;
          }

          try {
            console.log("[Report] Requesting map image");
            
            // Try fetching via an open CORS proxy just to be safe, because Google restricts client-side fetching
            const proxyUrl = '/api/proxy-image?url=' + encodeURIComponent(mapUrl);
            const imgRes = await fetch(proxyUrl);
            if (!imgRes.ok) throw new Error("Proxy failed");
            
            const blob = await imgRes.blob();
            const reader = new FileReader();
            const base64data = await new Promise<string>((resolve) => {
              reader.readAsDataURL(blob);
              reader.onloadend = () => resolve(reader.result as string);
            });
            console.log("[Report] Map image loaded");
            doc.addImage(base64data, 'PNG', 14, 40, 180, 90);
          } catch (e) {
            console.error("[Report] Map fetch error", e);
            doc.text("[Map Image failed to load or CORS blocked]", 14, 50);
          }
        }

        // Table
        if (zoneClients.length > 0) {
          console.log(`[Report] Rendering table for ${zoneClients.length} clients`);
          const startY = zone.path && zone.path.length > 0 ? 140 : 45;
          const tableData = zoneClients.map(c => [
            c.name || 'N/A',
            c.tier ? `Tier ${c.tier}` : 'N/A',
            c.website || 'N/A',
            c.phone || c.email || 'N/A',
            c.address || 'N/A',
            c.status || 'N/A',
            c.tags?.join(', ') || 'N/A'
          ]);

                    autoTable(doc, {
            startY,
            head: [['Company Name', 'Tier', 'Website', 'Contact', 'Location', 'Status', 'Tags']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 2, font: 'Amiri' },
            headStyles: { fillColor: [66, 133, 244] },
            columnStyles: {
              2: { cellWidth: 30 },
              4: { cellWidth: 40 }
            },
            willDrawCell: function(data) {
              // Ensure we draw the text with Amiri for Arabic text
              doc.setFont('Amiri', 'normal');
            },
            didDrawCell: function(data) {
              // Add links to location column
              if (data.column.index === 4 && data.cell.section === 'body') {
                const rowIndex = data.row.index;
                const client = zoneClients[rowIndex];
                if (client && client.lat && client.lng) {
                  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${client.lat},${client.lng}`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: mapUrl });
                }
              }
            }
          });
        }
      }

      // Unallocated page by region (PDF)
      setProgress('Generating unallocated clients...');
      console.log("[Report] Generating unallocated clients");
      
      const unallocatedPdf = validClients.filter(c => !allocatedClients.has(c.id));
      const regionsPdf = Array.from(new Set(unallocatedPdf.map(c => c.region || '').filter(Boolean))) as string[];
      const groupedPdf: { [key: string]: typeof validClients } = { 'Other Regions': [] };
      regionsPdf.forEach(e => groupedPdf[e] = []);
      
      unallocatedPdf.forEach(c => {
        const addressUpper = ((c.region || '') + ' ' + (c.address || '')).toUpperCase();
        let matched = false;
        for (const e of regionsPdf) {
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
      for (const groupName of [...regionsPdf, 'Other Regions']) {
        const groupClients = groupedPdf[groupName];
        if (groupClients.length > 0) {
          if (filteredZones.length > 0 || !isFirstUnallocatedPage) doc.addPage();
          isFirstUnallocatedPage = false;
          
          doc.setFontSize(18);
          doc.text(`${groupName} (No Map Region)`, 14, 20);
          doc.setFontSize(10);
          doc.text(`These companies did not fall within any selected map zone, categorized by address.`, 14, 28);
          
          const tableData = groupClients.map(c => [
            c.name || 'N/A',
              c.tier ? `Tier ${c.tier}` : 'N/A',
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
                  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${client.lat},${client.lng}`;
                  doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: mapUrl });
                }
              }
            }
          });
        }
      }
      
      setProgress('Saving PDF...');
      console.log("[Report] Saving PDF");
      doc.save('Prospecting_Zones_Report.pdf');
      console.log("[Report] PDF Saved");
      onClose();
    } catch (err: any) {
      console.error("[Report] Fatal Error", err);
      alert('Failed to generate report: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };


  
  const generateExcel = async () => {
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
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Tags', key: 'tags', width: 30 },
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
        headerRow.getCell(1).value = `Zone: ${zone.name.split('|||')[0]}`;
        headerRow.getCell(1).font = { bold: true, size: 14 };
        currentRow++;

        if (zone.path && zone.path.length > 0) {
          setProgress(`Loading map for ${zone.name}...`);
          const pathString = zone.path.map(p => `${p.lat},${p.lng}`).join('|');
          let mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&path=color:0x4285F4AA|fillcolor:0x4285F433|weight:2|${pathString}&key=${API_KEY}`;
          
          const markerClients = zoneClients.slice(0, 50);
          if (markerClients.length > 0) {
            const markers = markerClients.map(c => `${c.lat},${c.lng}`).join('|');
            mapUrl += `&markers=color:red|size:small|${markers}`;
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
              category: c.category || '',
              tags: c.tags?.join(', ') || ''
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
      const regions = Array.from(new Set(unallocated.map(c => c.region || '').filter(Boolean))) as string[];
      const groupedUnallocated: { [key: string]: typeof validClients } = { 'Other Regions': [] };
      regions.forEach(e => groupedUnallocated[e] = []);
      
      unallocated.forEach(c => {
        const addressUpper = ((c.region || '') + ' ' + (c.address || '')).toUpperCase();
        let matched = false;
        for (const e of regions) {
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
      
      for (const groupName of [...regions, 'Other Regions']) {
        const groupClients = groupedUnallocated[groupName];
        if (groupClients.length > 0) {
          const headerRow = masterSheet.getRow(currentRow);
          headerRow.getCell(1).value = `${groupName} (No Map Region)`;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1e222a] border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-700 bg-[#15181e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-slate-200">Generate Report</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 text-slate-400 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col h-[60vh] max-h-[500px]">
          <p className="text-slate-300 text-sm mb-4 leading-relaxed shrink-0">
            Select the Search Zones to include in the report. Unallocated companies will automatically be appended at the end.
          </p>
          
          <div className="flex items-center gap-4 mb-2 shrink-0">
            <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300">Select All</button>
            <button onClick={deselectAll} className="text-xs text-slate-400 hover:text-slate-300">Deselect All</button>
          </div>

          <div className="flex-1 overflow-y-auto mb-6 bg-[#15181e] border border-slate-700 rounded-lg p-2 custom-scrollbar">
            {zones.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">No saved zones found</div>
            ) : (
              <div className="space-y-1">
                {zones.map(zone => (
                  <button 
                    key={zone.id}
                    onClick={() => toggleZone(zone.id)}
                    className="w-full flex items-center justify-between p-2 hover:bg-[#1e222a] rounded transition-colors"
                  >
                    <span className="text-sm text-slate-200 truncate pr-4 text-left">
                      {zone.name.split('|||')[0]}
                    </span>
                    {selectedZones.has(zone.id) ? (
                      <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 shrink-0">
          <button
            onClick={generatePDF}
            disabled={isGenerating || (selectedZones.size === 0 && zones.length > 0)}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-medium transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              `Export PDF`
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
              `Export Excel`
            )}
          </button>
          </div>
          {isGenerating && <div className="text-center text-xs text-slate-400 mt-2">{progress}</div>}

        </div>
      </div>
    </div>
  );
}
