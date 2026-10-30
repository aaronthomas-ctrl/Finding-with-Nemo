import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from '../db';
import { db, Settings } from '../db';
import { Settings as SettingsIcon, Save, Download, Upload, Trash2, AlertTriangle, X, MapPin, Wand2, Tag } from 'lucide-react';
import { exportClientsCsv, exportEnquiriesCsv, exportInteractionsCsv, exportCampaignsCsv, exportFullJson, importFullJson, clearAllData } from '../lib/backup';
import { renderTemplate } from '../lib/templates';
import { AdminPanels } from './AdminPanels';
import { PlaybooksPanel } from './PlaybooksPanel';

export function SettingsView() {
  const settingsData = useLiveQuery(() => db.settings.get('default'));
  const allClients = useLiveQuery(() => db.clients.toArray());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const [isMapEnriching, setIsMapEnriching] = useState(false);
  const [enrichBatchSize, setEnrichBatchSize] = useState('All');
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
      } else {
        // If force re-tagging, sort by oldest enrichment first so it cycles through the database
        clientsToEnrich.sort((a: any, b: any) => ((a.metadata?.lastMapEnrich || a.metadata?.last_map_enrich) || 0) - ((b.metadata?.lastMapEnrich || b.metadata?.last_map_enrich) || 0));
      }
      
      const batchLimit = enrichBatchSize === 'All' ? clientsToEnrich.length : (parseInt(enrichBatchSize, 10) || 50);
      clientsToEnrich = clientsToEnrich.slice(0, batchLimit);
      
      if (clientsToEnrich.length === 0) {
        setEnrichMessage('No clients to enrich based on current settings.');
        setTimeout(() => setEnrichMessage(''), 3000);
        return;
      }
      
      setIsMapEnriching(true);
      setEnrichProgress({ current: 0, total: clientsToEnrich.length });
      
      let current = 0;
      let log = "Map Enrichment Report\n=======================\n\n";
      let successCount = 0;
      let failCount = 0;
      let notFoundCount = 0;

      for (const c of clientsToEnrich) {
        try {
          const response = await apiFetch('/api/places-search', {
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
                  metadata: { ...(c.metadata || {}), lastMapEnrich: Date.now() },
                  ...statusUpdate
                });
                let statusMsg = statusUpdate.status ? ` (${statusUpdate.status})` : '';
                log += `[SUCCESS] ${c.name}: Added category '${category}'${statusMsg}\n    Raw API Output: ${JSON.stringify(place)}\n`;
                successCount++;
              } else {
                await db.clients.update(c.id, { autoTagged: true, metadata: { ...(c.metadata || {}), lastMapEnrich: Date.now() }, ...statusUpdate });
                let statusMsg = statusUpdate.status ? ` (${statusUpdate.status})` : '';
                log += `[SKIPPED] ${c.name}: Google Maps profile found${statusMsg}, but no primary category listed.\n    Raw API Output: ${JSON.stringify(place)}\n`;
                failCount++;
              }
            } else {
              await db.clients.update(c.id, { autoTagged: true, metadata: { ...(c.metadata || {}), lastMapEnrich: Date.now() } });
              log += `[NOT FOUND] ${c.name}: Could not find a matching business on Google Maps.\n`;
              notFoundCount++;
            }
          } else {
            log += `[ERROR] ${c.name}: API request failed with status ${response.status}.\n`;
            failCount++;
          }
        } catch (err: any) {
          console.error("Failed to map enrich", c.name, err);
          log += `[ERROR] ${c.name}: Request threw an error (${err.message}).\n`;
          failCount++;
        }
        
        current++;
        setEnrichProgress({ current, total: clientsToEnrich.length });
        
        await new Promise(res => setTimeout(res, 300)); // Increased interval to protect against rate limits on full list
      }
      
      setIsMapEnriching(false);
      setEnrichMessage(`Enrichment Complete (${successCount} tagged)`);
      setTimeout(() => setEnrichMessage(''), 5000);

      // Generate log file download
      log += `\nSummary:\n-----------------\nSuccessfully Tagged: ${successCount}\nSkipped (No Category): ${failCount}\nNot Found: ${notFoundCount}\n`;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (settingsData && !settings) {
      setSettings(JSON.parse(JSON.stringify(settingsData)));
    }
  }, [settingsData]);

  if (!settings) {
    return <div className="p-8 text-slate-400 flex items-center justify-center h-full">Loading settings...</div>;
  }

  const handleSave = async () => {
    await db.settings.put(settings);
    setSaveStatus("Saved successfully!");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const updateCadence = (tier: 1 | 2 | 3 | 4, days: number) => {
    setSettings(prev => prev ? {
      ...prev,
      cadenceDays: {
        ...prev.cadenceDays,
        [tier]: days
      }
    } : prev);
  };

  const updateTemplate = (purpose: 'firstOutreach' | 'followUp' | 'campaign', channel: string, value: string) => {
    setSettings(prev => prev ? {
      ...prev,
      templates: {
        ...prev.templates,
        [purpose]: {
          ...prev.templates[purpose],
          [channel]: value
        }
      }
    } : prev);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importFullJson(file);
      alert('Import successful!');
      window.location.reload();
    } catch (err: any) {
      alert('Import failed: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAll = async () => {
    await clearAllData();
    setShowClearConfirm(false);
    alert('All data cleared.');
    window.location.reload();
  };

  const sampleData = {
    company: allClients?.[0]?.name || "Acme Corp",
    contact_name: allClients?.[0]?.contacts?.[0]?.name || "John",
    product_line: "Sample product",
    offer: "Introductory offer"
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0e12] overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-800 shrink-0 flex flex-wrap gap-3 justify-between items-center bg-[#12151a]">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-slate-400" /> Settings
          </h2>
          <p className="text-sm text-slate-400 mt-1">Configure your outreach cadences and message templates.</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus && <span className="text-sm text-green-400 font-medium">{saveStatus}</span>}
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 custom-scrollbar">

        <PlaybooksPanel />
        <AdminPanels />

        <section className="bg-[#12151a] border border-slate-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
            <Tag className="w-5 h-5 text-slate-400" /> Products and Services
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Manage the list of brands you distribute. These will be available as tags in the Customer Profile.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {(settings.distributedBrands || []).map((brand, i) => (
              <span key={i} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-300 flex items-center gap-2">
                {brand}
                <button 
                  onClick={() => setSettings(prev => prev ? {...prev, distributedBrands: prev.distributedBrands?.filter(b => b !== brand)} : prev)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-sm">
            <input 
              type="text" 
              id="new-brand-input"
              placeholder="Add new brand..."
              className="flex-1 bg-[#1e222a] border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.trim();
                  if (val && !settings.distributedBrands?.includes(val)) {
                    setSettings(prev => prev ? {...prev, distributedBrands: [...(prev.distributedBrands || []), val]} : prev);
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
            <button 
              onClick={() => {
                const input = document.getElementById('new-brand-input') as HTMLInputElement;
                const val = input.value.trim();
                if (val && !settings.distributedBrands?.includes(val)) {
                  setSettings(prev => prev ? {...prev, distributedBrands: [...(prev.distributedBrands || []), val]} : prev);
                }
                input.value = '';
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded transition-colors"
            >
              Add
            </button>
          </div>
        </section>
        
        <section className="bg-[#12151a] border border-slate-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
            <Download className="w-5 h-5 text-slate-400" /> Data Management
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Export Data</h4>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportClientsCsv} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors">Clients CSV</button>
                <button onClick={exportEnquiriesCsv} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors">Enquiries CSV</button>
                <button onClick={exportInteractionsCsv} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors">Interactions CSV</button>
                <button onClick={exportCampaignsCsv} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors">Campaigns CSV</button>
                <button onClick={exportFullJson} className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/20 transition-colors">Full JSON Backup</button>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-3">Import & Danger Zone</h4>
              <div className="flex flex-wrap gap-2 items-center">
                <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImport} />
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Import JSON
                </button>
                <div className="w-[1px] h-4 bg-slate-700 mx-2"></div>
                <button onClick={() => setShowClearConfirm(true)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded border border-red-500/20 transition-colors flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear All Data
                </button>
              </div>
            </div>
          </div>
        </section>

        
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
                <option value="All">All Clients</option>
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
                <Wand2 className={`w-4 h-4 ${isMapEnriching ? 'animate-spin' : ''}`} />
                {isMapEnriching ? `Enriching (${enrichProgress.current}/${enrichProgress.total})` : 'Start Maps Enrich'}
              </button>
            </div>
          </div>
          {enrichMessage && <div className="text-sm text-emerald-400 font-medium">{enrichMessage}</div>}
        </section>

<section className="bg-[#12151a] border border-slate-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2">Follow-up Cadence (Days)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(t => (
              <div key={t}>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tier {t}</label>
                <input 
                  type="number"
                  value={settings.cadenceDays[t as 1|2|3|4]}
                  onChange={e => updateCadence(t as 1|2|3|4, parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#12151a] border border-slate-800 p-6 rounded-xl">
          <div className="flex justify-between items-end border-b border-slate-800 pb-2 mb-4">
            <h3 className="text-lg font-semibold text-slate-200">Outreach Templates</h3>
            <p className="text-xs text-slate-400">
              Live Preview using: <span className="text-slate-300 font-medium">{sampleData.company}</span>
            </p>
          </div>
          <p className="text-sm text-slate-400 mb-6">
            Available placeholders: <code className="bg-slate-800 text-blue-300 px-1 py-0.5 rounded text-xs">{'{company}'}</code> <code className="bg-slate-800 text-blue-300 px-1 py-0.5 rounded text-xs">{'{contact_name}'}</code> <code className="bg-slate-800 text-blue-300 px-1 py-0.5 rounded text-xs">{'{product_line}'}</code> <code className="bg-slate-800 text-blue-300 px-1 py-0.5 rounded text-xs">{'{offer}'}</code>
          </p>

          <div className="space-y-8">
            {(['firstOutreach', 'followUp', 'campaign'] as const).map(purpose => (
              <div key={purpose} className="border border-slate-700/50 rounded-lg p-4 bg-black/10">
                <h4 className="font-semibold text-slate-300 mb-4 capitalize">{purpose.replace(/([A-Z])/g, ' $1').trim()}</h4>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">WhatsApp</label>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <textarea 
                        value={settings.templates[purpose].WhatsApp}
                        onChange={e => updateTemplate(purpose, 'WhatsApp', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 h-24 custom-scrollbar"
                      />
                      <div className="bg-black/20 rounded-lg p-3 text-sm text-slate-300 border border-slate-800/50 whitespace-pre-wrap">
                        {renderTemplate(settings.templates[purpose].WhatsApp, sampleData)}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Email Subject</label>
                        <input 
                          type="text"
                          value={settings.templates[purpose].EmailSubject}
                          onChange={e => updateTemplate(purpose, 'EmailSubject', e.target.value)}
                          className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Email Body</label>
                        <textarea 
                          value={settings.templates[purpose].EmailBody}
                          onChange={e => updateTemplate(purpose, 'EmailBody', e.target.value)}
                          className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 h-32 custom-scrollbar"
                        />
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 text-sm text-slate-300 border border-slate-800/50 flex flex-col">
                      <div className="font-medium text-slate-200 mb-2 pb-2 border-b border-slate-700/50">
                        {renderTemplate(settings.templates[purpose].EmailSubject, sampleData)}
                      </div>
                      <div className="whitespace-pre-wrap flex-1 overflow-y-auto custom-scrollbar">
                        {renderTemplate(settings.templates[purpose].EmailBody, sampleData)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">LinkedIn</label>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <textarea 
                        value={settings.templates[purpose].LinkedIn}
                        onChange={e => updateTemplate(purpose, 'LinkedIn', e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 h-20 custom-scrollbar"
                      />
                      <div className="bg-black/20 rounded-lg p-3 text-sm text-slate-300 border border-slate-800/50 whitespace-pre-wrap">
                        {renderTemplate(settings.templates[purpose].LinkedIn, sampleData)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161a20] border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Confirm Clear Data
              </h3>
              <button onClick={() => setShowClearConfirm(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-300 text-sm mb-4">
              Are you sure you want to delete all clients, enquiries, interactions, and campaigns? This action cannot be undone.
            </p>
            <p className="text-amber-500 text-sm font-medium mb-6">
              Please ensure you have exported a JSON backup first!
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors border border-slate-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleClearAll}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Yes, clear everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
