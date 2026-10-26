const fs = require('fs');

let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

const stateInjectionPoint = "const [saveStatus, setSaveStatus] = useState<string | null>(null);";
const enrichmentState = `
  const [isMapEnriching, setIsMapEnriching] = useState(false);
  const [enrichBatchSize, setEnrichBatchSize] = useState('50');
  const [enrichForceReTag, setEnrichForceReTag] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });
  const [enrichMessage, setEnrichMessage] = useState('');

  const handleBulkEnrichMaps = async () => {
    try {
      const allClients = await db.clients.toArray();
      const validClients = allClients.filter((c: any) => c.id !== '00000000-0000-0000-0000-000000000000');
      
      let clientsToEnrich = validClients;
      if (!enrichForceReTag) {
        clientsToEnrich = clientsToEnrich.filter((c: any) => !c.autoTagged);
      }
      
      const batchLimit = parseInt(enrichBatchSize, 10) || 50;
      clientsToEnrich = clientsToEnrich.slice(0, batchLimit);
      
      if (clientsToEnrich.length === 0) {
        setEnrichMessage('No clients to enrich based on current settings.');
        setTimeout(() => setEnrichMessage(''), 3000);
        return;
      }
      
      setIsMapEnriching(true);
      setEnrichProgress({ current: 0, total: clientsToEnrich.length });
      
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
              const businessStatus = place.businessStatus;
              
              let statusUpdate: any = {};
              if (businessStatus === 'CLOSED_PERMANENTLY') {
                statusUpdate.status = 'Closed Permanently';
              } else if (businessStatus === 'CLOSED_TEMPORARILY') {
                statusUpdate.status = 'Closed Temporarily';
              }
              
              if (category) {
                const updatedTags = Array.from(new Set([...(c.tags || []), category]));
                await db.clients.update(c.id, {
                  tags: updatedTags,
                  autoTagged: true,
                  ...statusUpdate
                });
                let statusMsg = statusUpdate.status ? \` (\${statusUpdate.status})\` : '';
                log += \`[SUCCESS] \${c.name}: Added category '\${category}'\${statusMsg}\\n\`;
                successCount++;
              } else {
                await db.clients.update(c.id, { autoTagged: true, ...statusUpdate });
                let statusMsg = statusUpdate.status ? \` (\${statusUpdate.status})\` : '';
                log += \`[SKIPPED] \${c.name}: Google Maps profile found\${statusMsg}, but no primary category listed.\\n\`;
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
        } catch (err: any) {
          console.error("Failed to map enrich", c.name, err);
          log += \`[ERROR] \${c.name}: Request threw an error (\${err.message}).\\n\`;
          failCount++;
        }
        
        current++;
        setEnrichProgress({ current, total: clientsToEnrich.length });
        
        await new Promise(res => setTimeout(res, 1000));
      }
      
      setIsMapEnriching(false);
      setEnrichMessage(\`Enrichment Complete (\${successCount} tagged)\`);
      setTimeout(() => setEnrichMessage(''), 5000);

      // Generate log file download
      log += \`\\nSummary:\\n-----------------\\nSuccessfully Tagged: \${successCount}\\nSkipped (No Category): \${failCount}\\nNot Found: \${notFoundCount}\\n\`;
      const blob = new Blob([log], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Enrichment_Report.txt';
      a.click();
    } catch (err) {
      console.error(err);
      setIsMapEnriching(false);
    }
  };
`;

if (code.includes(stateInjectionPoint)) {
  code = code.replace(stateInjectionPoint, stateInjectionPoint + '\n' + enrichmentState);
  fs.writeFileSync('src/components/SettingsView.tsx', code);
  console.log("Fixed missing states in SettingsView.tsx");
} else {
  console.log("Could not find injection point.");
}

