const fs = require('fs');
let code = fs.readFileSync('src/components/PipelineView.tsx', 'utf8');

const startIndex = code.indexOf("const handleBulkEnrichMaps = async () => {");
const endIndex = code.indexOf("const { filteredClients, uniqueTags, uniqueStatuses }", startIndex);

const newLogic = `
  const handleBulkEnrichMaps = async () => {
    if (!clients) return;
    
    const clientsToEnrich = clients.filter(c => !c.autoTagged);
    
    if (clientsToEnrich.length === 0) {
      setMapEnrichMessage('No new clients to enrich'); setTimeout(() => setMapEnrichMessage(''), 3000);
      return;
    }
    
    setIsMapEnriching(true);
    setMapEnrichProgress({ current: 0, total: clientsToEnrich.length });
    
    let current = 0;
    let log = "Map Enrichment Report\\n=======================\\n\\n";
    let successCount = 0;
    let failCount = 0;
    let notFoundCount = 0;

    for (const c of clientsToEnrich) {
      try {
        const response = await fetch('/api/places-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ textQuery: c.name })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.places && data.places.length > 0) {
            const place = data.places[0];
            const category = place.primaryTypeDisplayName?.text;
            
            if (category) {
              const updatedTags = Array.from(new Set([...(c.tags || []), category]));
              await db.clients.update(c.id, {
                tags: updatedTags,
                autoTagged: true
              });
              log += \`[SUCCESS] \${c.name}: Added category '\${category}'\\n\`;
              successCount++;
            } else {
              await db.clients.update(c.id, { autoTagged: true });
              log += \`[SKIPPED] \${c.name}: Google Maps profile found, but no primary category listed.\\n\`;
              failCount++;
            }
          } else {
            await db.clients.update(c.id, { autoTagged: true });
            log += \`[NOT FOUND] \${c.name}: Could not find a matching business on Google Maps.\\n\`;
            notFoundCount++;
          }
        } else {
          log += \`[ERROR] \${c.name}: API request failed with status \${response.status}.\\n\`;
          failCount++;
        }
      } catch (err) {
        console.error("Failed to map enrich", c.name, err);
        log += \`[ERROR] \${c.name}: Request threw an error (\${err.message}).\\n\`;
        failCount++;
      }
      
      current++;
      setMapEnrichProgress({ current, total: clientsToEnrich.length });
      
      await new Promise(res => setTimeout(res, 500));
    }
    
    setIsMapEnriching(false);
    setMapEnrichMessage('Enrichment Complete');
    setTimeout(() => setMapEnrichMessage(''), 3000);
    setRefreshKey(Date.now());

    // Generate log file download
    log += \`\\nSummary:\\n-----------------\\nSuccessfully Tagged: \${successCount}\\nSkipped (No Category): \${failCount}\\nNot Found: \${notFoundCount}\\n\`;
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Enrichment_Report.txt';
    a.click();
  };
`;

code = code.substring(0, startIndex) + newLogic + "\n  " + code.substring(endIndex);

fs.writeFileSync('src/components/PipelineView.tsx', code);
console.log("Patched PipelineView.tsx");
