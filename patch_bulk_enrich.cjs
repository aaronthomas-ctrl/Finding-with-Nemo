const fs = require('fs');
let code = fs.readFileSync('src/components/PipelineView.tsx', 'utf8');

// Add states for Map Enrich
code = code.replace(
  "const [autoTagProgress, setAutoTagProgress] = useState({ current: 0, total: 0 });",
  "const [autoTagProgress, setAutoTagProgress] = useState({ current: 0, total: 0 });\n  const [isMapEnriching, setIsMapEnriching] = useState(false);\n  const [mapEnrichProgress, setMapEnrichProgress] = useState({ current: 0, total: 0 });\n  const [mapEnrichMessage, setMapEnrichMessage] = useState('');"
);

// Add Map Enrich function
const mapEnrichLogic = `
  const handleBulkEnrichMaps = async () => {
    if (!clients) return;
    
    // Only enrich if we haven't already marked them as map-enriched (we can just add a flag or just do it for all if they miss tags)
    // For simplicity, let's just do it for all clients that don't have a specific tag like "Google Maps Enriched" or let's do all.
    // Better: let's filter those we haven't enriched. We will add mapEnriched field.
    const clientsToEnrich = clients.filter(c => !c.mapEnriched);
    
    if (clientsToEnrich.length === 0) {
      setMapEnrichMessage('No new clients to enrich'); setTimeout(() => setMapEnrichMessage(''), 3000);
      return;
    }
    
    setIsMapEnriching(true);
    setMapEnrichProgress({ current: 0, total: clientsToEnrich.length });
    
    let current = 0;
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
                mapEnriched: true
              });
            } else {
              await db.clients.update(c.id, { mapEnriched: true });
            }
          } else {
            await db.clients.update(c.id, { mapEnriched: true });
          }
        }
      } catch (err) {
        console.error("Failed to map enrich", c.name, err);
      }
      
      current++;
      setMapEnrichProgress({ current, total: clientsToEnrich.length });
      
      // Delay to respect API rate limits
      await new Promise(res => setTimeout(res, 500));
    }
    
    setIsMapEnriching(false);
    setMapEnrichMessage('Enrichment Complete');
    setTimeout(() => setMapEnrichMessage(''), 3000);
    setRefreshKey(Date.now());
  };
`;

code = code.replace(
  "const handleAutoTag = async () => {",
  mapEnrichLogic + "\n  const handleAutoTag = async () => {"
);

// Add the UI button
const uiButton = `
            <button
              onClick={handleBulkEnrichMaps}
              disabled={isMapEnriching}
              className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wand2 className={\`w-4 h-4 \${isMapEnriching ? 'animate-spin' : ''}\`} />
              {mapEnrichMessage ? mapEnrichMessage : isMapEnriching ? \`Maps Enriching (\${mapEnrichProgress.current}/\${mapEnrichProgress.total})\` : 'Maps Enrich (Free)'}
            </button>
`;

code = code.replace(
  /<button\s+onClick=\{handleAutoTag\}/,
  uiButton + "\n            <button\n              onClick={handleAutoTag}"
);

fs.writeFileSync('src/components/PipelineView.tsx', code);
console.log("Patched PipelineView for Map Enrich");
