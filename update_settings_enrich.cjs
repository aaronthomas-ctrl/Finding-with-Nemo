const fs = require('fs');

let settingsCode = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

// 1. Add imports to SettingsView
settingsCode = settingsCode.replace(
  "import { Settings as SettingsIcon, Save, Download, Upload, Trash2, AlertTriangle, X } from 'lucide-react';",
  "import { Settings as SettingsIcon, Save, Download, Upload, Trash2, AlertTriangle, X, MapPin, Wand2 } from 'lucide-react';"
);

// 2. Add State for Enrichment
const stateInjectionPoint = "const [saveStatus, setSaveStatus] = useState('');";
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
        
        // 1 second delay to strictly respect GMP limits and avoid 429
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
settingsCode = settingsCode.replace(stateInjectionPoint, stateInjectionPoint + '\n' + enrichmentState);

// 3. Add UI Section
const uiInjectionPoint = `<section className="bg-[#12151a] border border-slate-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2">Follow-up Cadence (Days)</h3>`;
          
const enrichmentUI = `
        <section className="bg-[#12151a] border border-slate-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" /> Google Maps Data Enrichment
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Connect to Google Maps to automatically find missing categories and check if businesses have permanently closed. 
            Google allows roughly 6,000 free Basic searches per month. Rate limits apply, so process in small batches.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 bg-black/20 p-4 rounded-lg border border-slate-800/50">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Batch Size (Max Clients)</label>
              <select 
                value={enrichBatchSize}
                onChange={(e) => setEnrichBatchSize(e.target.value)}
                disabled={isMapEnriching}
                className="w-full bg-[#1e222a] border border-slate-700 rounded p-2 text-sm text-slate-200"
              >
                <option value="10">10 Clients at a time</option>
                <option value="50">50 Clients at a time</option>
                <option value="100">100 Clients at a time</option>
                <option value="250">250 Clients at a time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Target Audience</label>
              <select 
                value={enrichForceReTag ? 'all' : 'new'}
                onChange={(e) => setEnrichForceReTag(e.target.value === 'all')}
                disabled={isMapEnriching}
                className="w-full bg-[#1e222a] border border-slate-700 rounded p-2 text-sm text-slate-200"
              >
                <option value="new">Only Untagged (Skip existing)</option>
                <option value="all">Force Re-tag All (Overwrites)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleBulkEnrichMaps}
                disabled={isMapEnriching}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className={\`w-4 h-4 \${isMapEnriching ? 'animate-spin' : ''}\`} />
                {isMapEnriching ? \`Enriching (\${enrichProgress.current}/\${enrichProgress.total})\` : 'Start Maps Enrich'}
              </button>
            </div>
          </div>
          {enrichMessage && <div className="text-sm text-emerald-400 font-medium">{enrichMessage}</div>}
        </section>

`;
settingsCode = settingsCode.replace(uiInjectionPoint, enrichmentUI + uiInjectionPoint);

fs.writeFileSync('src/components/SettingsView.tsx', settingsCode);
console.log("Settings updated!");
