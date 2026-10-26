import { useLiveQuery, db, supabase } from '../db';
import { Plus, Search, MapPin, Globe, Phone, MoreHorizontal, LayoutGrid, List, Copy, Mail, X, Wand2, ChevronDown, Check, Edit2, ShieldAlert, Eye, EyeOff, Tags, Trash2, AlertTriangle, FileText } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { AddClientModal } from './AddClientModal';
import { ClientProfileView } from './ClientProfileView';
import { ReportModal } from './ReportModal';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

export function PipelineView() {
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [isAutoTagsBoardHidden, setIsAutoTagsBoardHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hide_auto_tags_board') === 'true';
    } catch {
      return false;
    }
  });
  const [isRemovingExisting, setIsRemovingExisting] = useState(false);
  
  // Bulk BCC Modal
  const [showBccModal, setShowBccModal] = useState(false);
  const [bccSubject, setBccSubject] = useState('');
  const [bccCampaign, setBccCampaign] = useState('');
  const [bccDetails, setBccDetails] = useState('');

  // Phone Questionnaire Modal
  const [phoneCallClient, setPhoneCallClient] = useState<any>(null);
  const [phoneObjective, setPhoneObjective] = useState('');
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-Tagging State
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({'Abu Dhabi': true, 'Dubai': true});
  const [autoTagProgress, setAutoTagProgress] = useState({ current: 0, total: 0 });
  
  
  
  const [tagMessage, setTagMessage] = useState('');

  const navigate = useNavigate();
  
  const clients = useLiveQuery(
    async () => {
      const all = await db.clients.orderBy('updatedAt').reverse().toArray();
      return all.filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
    },
    [refreshKey]
  );

  
  
  const { filteredClients, uniqueTags, uniqueStatuses } = useMemo(() => {
    if (!clients) return { filteredClients: [], uniqueTags: [], uniqueStatuses: [] };
    
    // Extract unique values
    const allTags = new Set<string>();
    const stats = new Set<string>();
    clients.forEach(c => {
      if (c.tags) {
        c.tags.forEach(t => {
          // Remove any tags starting with Customer:
          if (!t.toLowerCase().startsWith('customer:')) {
            allTags.add(t);
          }
        });
      }
      if (c.status && c.status.toLowerCase() !== 'new') stats.add(c.status);
    });
    
    const filtered = clients.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) 
        || (c.category || '').toLowerCase().includes(search.toLowerCase())
        || (c.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
        || (c.phone || '').includes(search);
      const matchStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchTags = tagFilters.length === 0 || tagFilters.some(t => c.tags?.includes(t));
      
      return matchSearch && matchStatus && matchTags;
    });

    return { 
      filteredClients: filtered, 
      uniqueTags: Array.from(allTags).sort(),
      uniqueStatuses: Array.from(stats).sort()
    };
  }, [clients, search, statusFilter, tagFilters]);

  const existingCustomersCount = useMemo(() => {
    if (!clients) return 0;
    return clients.filter(c => 
      c.status?.toLowerCase() === 'existing customer' || 
      c.status?.toLowerCase() === 'existing account' || 
      c.status?.toLowerCase().includes('existing') ||
      c.metadata?.isExistingCustomer === true ||
      c.tags?.some((t: string) => t.toLowerCase() === 'existing customer')
    ).length;
  }, [clients]);

  const handleRemoveAllExistingCustomers = async () => {
    if (!window.confirm(`Are you sure you want to remove all ${existingCustomersCount} customer(s) having status "Existing Customer" from the pipeline?`)) {
      return;
    }
    setIsRemovingExisting(true);
    try {
      const all = await db.clients.toArray();
      const existingIds = all
        .filter(c => 
          c.status?.toLowerCase() === 'existing customer' || 
          c.status?.toLowerCase() === 'existing account' || 
          c.status?.toLowerCase().includes('existing') ||
          c.metadata?.isExistingCustomer === true ||
          c.tags?.some((t: string) => t.toLowerCase() === 'existing customer')
        )
        .map(c => c.id);
      
      if (existingIds.length === 0) {
        alert('No customers with status "Existing Customer" found.');
        return;
      }
      
      for (let i = 0; i < existingIds.length; i += 100) {
        const chunk = existingIds.slice(i, i + 100);
        await supabase.from('clients').delete().in('id', chunk);
      }
      alert(`Successfully removed ${existingIds.length} existing customer(s).`);
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      console.error('Failed to remove existing customers:', err);
      alert('Failed to remove existing customers: ' + (err.message || 'Error occurred'));
    } finally {
      setIsRemovingExisting(false);
    }
  };


  const groupedClients = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredClients.forEach(c => {
      const region = c.region || c.tier1?.region || 'Unassigned';
      
      if (!groups[region]) groups[region] = [];
      groups[region].push(c);
    });
    return groups;
  }, [filteredClients]);

  
  const handleSavePhone = async (clientId: string) => {
    try {
      await db.clients.update(clientId, { phone: editPhoneValue });
      setEditingPhoneId(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Failed to update phone", err);
    }
  };
  
  const handleBlacklist = async (clientId: string) => {
    try {
      await db.clients.update(clientId, { status: 'Blacklisted' });
      setActiveDropdownId(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Failed to blacklist", err);
    }
  };
  
  const toggleRegion = (region) => {
    setExpandedRegions(prev => ({
      ...prev,
      [region]: !prev[region]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Pursuing': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Quoted': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Won': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Lost': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Parked': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'Blacklisted': return 'bg-red-900/30 text-red-500 border-red-900/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const handleCopyBccEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extract all emails from filtered clients (Client level phone/email might not exist directly, but we use contacts)
    const allEmails = new Set<string>();
    filteredClients.forEach(c => {
      c.contacts?.forEach(contact => {
        if (contact.email) {
           allEmails.add(contact.email.trim());
        }
      });
    });

    const emailList = Array.from(allEmails).join(', ');
    
    if (emailList) {
      try {
        await navigator.clipboard.writeText(emailList);
      } catch (err) {
        console.error("Clipboard API failed", err);
        // Fallback or ignore for this env
      }
    }

    // Log Interactions for all these clients
    const now = new Date();
    const interactions = filteredClients.map(c => ({
      id: uuidv4(),
      clientId: c.id,
      timestamp: now,
      channel: 'Bulk Email (BCC)',
      summary: `Subject: ${bccSubject} | Campaign: ${bccCampaign} | Details: ${bccDetails} | Filters applied: Category=${tagFilters}, Status=${statusFilter}, Search="${search}"`
    }));

    // Perform DB save
    try {
      await db.interactions.bulkAdd(interactions);
      alert(`Copied ${allEmails.size} unique emails to clipboard and logged interaction for ${filteredClients.length} clients.`);
    } catch (err) {
      console.error(err);
      alert("Failed to log interactions.");
    }
    
    setShowBccModal(false);
    setBccSubject('');
    setBccCampaign('');
    setBccDetails('');
  };

  return (
    <>
      {selectedClientId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedClientId(null)}></div>
          <div className="relative w-[95vw] md:w-[85vw] lg:w-[1000px] max-w-full h-full bg-[#0c0e12] shadow-2xl animate-in slide-in-from-right-8 duration-300 flex flex-col border-l border-slate-800">
            <ClientProfileView clientId={selectedClientId} onClose={() => setSelectedClientId(null)} />
          </div>
        </div>
      )}
      <div className="flex flex-col h-full relative">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Pipeline</h2>
          <p className="text-sm text-slate-400">Manage your prospective and active clients.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>
      
      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
        {/* Banner if any Existing Customers are detected */}
        {existingCustomersCount > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-200">
                  {existingCustomersCount} Client(s) with Status "Existing Customer"
                </h4>
                <p className="text-xs text-red-300/80 mt-0.5">
                  Would you like to purge and remove all existing customer accounts from this prospecting pipeline?
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveAllExistingCustomers}
              disabled={isRemovingExisting}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isRemovingExisting ? 'Removing...' : `Remove All (${existingCustomersCount})`}</span>
            </button>
          </div>
        )}

        {/* Tags Filter Board (Collapsible / Hideable) */}
        {isAutoTagsBoardHidden ? (
          <div className="mb-6 bg-[#12151a] p-3 px-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs text-slate-400">
              <Tags className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-300">Filter by Auto-Tags</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Hidden ({uniqueTags.length} tags)
              </span>
              {tagFilters.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                  {tagFilters.length} active filter{tagFilters.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {tagFilters.length > 0 && (
                <button
                  onClick={() => setTagFilters([])}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors mr-1"
                >
                  Clear filters
                </button>
              )}
              <button
                onClick={() => {
                  setIsAutoTagsBoardHidden(false);
                  try { localStorage.setItem('hide_auto_tags_board', 'false'); } catch {}
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-blue-400" />
                <span>Show Auto-Tags Board</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-[#12151a] p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tags className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filter by Auto-Tags</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {uniqueTags.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {tagFilters.length > 0 && (
                  <button
                    onClick={() => setTagFilters([])}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors mr-2"
                  >
                    Clear tags ({tagFilters.length})
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsAutoTagsBoardHidden(true);
                    try { localStorage.setItem('hide_auto_tags_board', 'true'); } catch {}
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                  title="Hide the filter by auto-tags board"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide Board</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar p-0.5">
              {uniqueTags.map(tag => (
                <label key={tag} className="flex items-center gap-2 bg-[#161a22] border border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer hover:border-slate-500 transition-colors">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    checked={tagFilters.includes(tag)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTagFilters(prev => [...prev, tag]);
                      } else {
                        setTagFilters(prev => prev.filter(t => t !== tag));
                      }
                    }}
                  />
                  <span className="text-sm text-slate-300 font-medium">{tag}</span>
                </label>
              ))}
              {uniqueTags.length === 0 && (
                <span className="text-sm text-slate-500 italic">No tags created yet.</span>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mb-6">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center flex-wrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#12151a] border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-slate-200 placeholder-slate-500"
              />
            </div>
            
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#12151a] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              {uniqueStatuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <button
              onClick={() => {
                const next = !isAutoTagsBoardHidden;
                setIsAutoTagsBoardHidden(next);
                try { localStorage.setItem('hide_auto_tags_board', String(next)); } catch {}
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                isAutoTagsBoardHidden
                  ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30'
              }`}
              title={isAutoTagsBoardHidden ? "Show Filter by Auto-Tags Board" : "Hide Filter by Auto-Tags Board"}
            >
              {isAutoTagsBoardHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{isAutoTagsBoardHidden ? 'Show Auto-Tags' : 'Hide Auto-Tags'}</span>
            </button>

            {existingCustomersCount > 0 && (
              <button
                onClick={handleRemoveAllExistingCustomers}
                disabled={isRemovingExisting}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 hover:text-white rounded-lg text-xs font-semibold shadow-md transition-all"
                title="Remove all customers having status Existing Customer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Remove Existing ({existingCustomersCount})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            
            

            

            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-lg text-sm font-medium transition-colors mr-3"
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </button>
            <button
              onClick={() => setShowBccModal(true)}
              className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Copy className="w-4 h-4" /> Copy Emails (BCC)
            </button>

            <div className="flex bg-[#12151a] border border-slate-800 rounded-lg p-0.5">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        
        {!clients ? (
          <div className="text-center py-20 text-slate-500">Loading pipeline...</div>
        ) : filteredClients?.length === 0 ? (
          <div className="text-center py-20 bg-[#12151a] rounded-xl border border-slate-800">
            <h3 className="text-lg font-medium text-slate-300 mb-2">No clients found</h3>
            <p className="text-sm text-slate-500 mb-6">
              {search || tagFilters.length > 0 || statusFilter !== 'All' 
                 ? "No clients match your filters." 
                 : "Your pipeline is empty."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedClients).sort((a: any, b: any) => b[1].length - a[1].length).map(([region, regionClients]: [string, any]) => {
              const total = regionClients.length;
              const untouched = regionClients.filter(c => c.status === 'New').length;
              const approached = total - untouched;
              const isExpanded = expandedRegions[region] === true;

              return (
                <div key={region} className="bg-[#12151a] border border-slate-800 rounded-xl overflow-hidden">
                  <div 
                    className="p-4 bg-[#161a22] flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => toggleRegion(region)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        <h3 className="text-lg font-bold text-slate-100">{region}</h3>
                      </div>
                      <div className="hidden sm:flex items-center gap-2">
                        <span className="text-xs font-medium bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Total: {total}</span>
                        <span className="text-xs font-medium bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">Approached: {approached}</span>
                        <span className="text-xs font-medium bg-slate-500/10 text-slate-400 px-2 py-1 rounded border border-slate-500/20">Untouched: {untouched}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800 bg-[#0f1115]">
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {regionClients.map(client => (
                            <div 
                              key={client.id} 
                              onClick={() => setSelectedClientId(client.id)}
                              className="bg-[#12151a] border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-colors cursor-pointer flex flex-col group shadow-sm"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col gap-1">
                                  <h4 className="font-bold text-slate-100 leading-tight group-hover:text-blue-400 transition-colors pr-4">{client.name}</h4>
                                  {client.tier1?.isWatch && (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded w-fit">
                                      Tier 1 Watch
                                    </span>
                                  )}
                                </div>
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={() => setActiveDropdownId(activeDropdownId === client.id ? null : client.id)} 
                                    className="text-slate-500 hover:text-slate-300 p-1"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                  {activeDropdownId === client.id && (
                                    <div className="absolute right-0 mt-1 w-36 bg-[#1a1d23] border border-slate-700 rounded-lg shadow-xl z-10 py-1">
                                      <button 
                                        onClick={() => handleBlacklist(client.id)}
                                        className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-slate-800 flex items-center gap-2"
                                      >
                                        <ShieldAlert className="w-3.5 h-3.5" /> Blacklist
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 mb-4">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(client.status)} font-medium`}>
                                  {client.status}
                                </span>
                                {Boolean(client.metadata?.isExistingCustomer || client.tags?.includes('Existing Customer')) && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-semibold">
                                    Existing Customer
                                  </span>
                                )}
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300 font-medium">
                                  Tier {client.tier}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded border border-slate-800 bg-slate-900 text-slate-400 truncate max-w-[120px]">
                                  {client.metadata?.originalCategory || client.category}
                                </span>
                              </div>

                              <div className="space-y-2 mt-auto text-xs text-slate-400">
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{client.address || 'No address provided'}</span>
                                </div>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                  {editingPhoneId === client.id ? (
                                    <div className="flex items-center gap-1 w-full">
                                      <input 
                                        type="text"
                                        value={editPhoneValue}
                                        onChange={(e) => setEditPhoneValue(e.target.value)}
                                        className="bg-[#0f1115] border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 w-full focus:outline-none focus:border-blue-500"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSavePhone(client.id);
                                          if (e.key === 'Escape') setEditingPhoneId(null);
                                        }}
                                      />
                                      <button onClick={() => handleSavePhone(client.id)} className="text-green-500 hover:text-green-400 p-1">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => setEditingPhoneId(null)} className="text-slate-500 hover:text-slate-400 p-1">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group/phone cursor-text" onClick={() => {
                                      setEditingPhoneId(client.id);
                                      setEditPhoneValue(client.phone || '');
                                    }}>
                                      <span>{client.phone || <span className="text-slate-600 italic">No phone</span>}</span>
                                      <Edit2 className="w-3 h-3 text-slate-600 opacity-0 group-hover/phone:opacity-100 transition-opacity" />
                                    </div>
                                  )}
                                </div>
                                {client.contacts && client.contacts.length > 1 && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pl-5">
                                    <span className="text-slate-500">Alt:</span>
                                    <span className="text-slate-400 font-mono truncate">
                                      {client.contacts.slice(1).map((c: any) => c.mobile).filter(Boolean).join(', ')}
                                    </span>
                                  </div>
                                )}
                                {client.website && (
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate" onClick={e => e.stopPropagation()}>
                                      {client.website.replace(/^https?:\/\/(www\.)?/, '')}
                                    </a>
                                  </div>
                                )}
                              </div>

                              {/* Tags preview */}
                              {client.tags && client.tags.filter((t: string) => !t.toLowerCase().startsWith('customer:')).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3 pt-2.5 border-t border-slate-800/80">
                                  {client.tags
                                    .filter((t: string) => !t.toLowerCase().startsWith('customer:'))
                                    .map((tag: string, tIdx: number) => (
                                    <span 
                                      key={tIdx} 
                                      className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                        tag === 'Existing Customer' 
                                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                                          : tag.startsWith('Zone:')
                                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                          : tag.startsWith('Region:')
                                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                          : 'bg-blue-900/30 text-blue-300 border border-blue-700/40'
                                      }`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-[#12151a] border border-slate-800 rounded-xl overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-[#161a22] border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                  <th className="p-4 pl-6">Company</th>
                                  <th className="p-4">Status</th>
                                  <th className="p-4">Tier</th>
                                  <th className="p-4">Category</th>
                                  <th className="p-4">Phone</th>
                                  <th className="p-4">Contacts</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {regionClients.map(client => (
                                  <tr 
                                    key={client.id} 
                                    onClick={() => setSelectedClientId(client.id)}
                                    className="hover:bg-slate-800/20 transition-colors cursor-pointer"
                                  >
                                    <td className="p-4 pl-6">
                                      <div className="font-bold text-sm text-slate-200">{client.name}</div>
                                      <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{client.address}</div>
                                      {client.tags && client.tags.filter((t: string) => !t.toLowerCase().startsWith('customer:')).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5 max-w-sm">
                                          {client.tags
                                            .filter((t: string) => !t.toLowerCase().startsWith('customer:'))
                                            .slice(0, 3)
                                            .map((tag: string, tIdx: number) => (
                                            <span 
                                              key={tIdx} 
                                              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                                tag === 'Existing Customer' 
                                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                                  : tag.startsWith('Zone:')
                                                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                                  : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                                              }`}
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                          {client.tags.filter((t: string) => !t.toLowerCase().startsWith('customer:')).length > 3 && (
                                            <span className="text-[9px] text-slate-500">
                                              +{client.tags.filter((t: string) => !t.toLowerCase().startsWith('customer:')).length - 3}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-4">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(client.status)} font-medium`}>
                                        {client.status}
                                      </span>
                                    </td>
                                    <td className="p-4">
                                      <span className="text-xs text-slate-300 font-medium">Tier {client.tier}</span>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {Boolean(client.metadata?.isExistingCustomer || client.tags?.includes('Existing Customer')) && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                                            Existing
                                          </span>
                                        )}
                                        <span className="text-xs text-slate-400">
                                          {client.metadata?.originalCategory || client.category}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        {editingPhoneId === client.id ? (
                                          <div className="flex items-center gap-1">
                                            <input 
                                              type="text"
                                              value={editPhoneValue}
                                              onChange={(e) => setEditPhoneValue(e.target.value)}
                                              className="bg-[#0f1115] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-32 focus:outline-none focus:border-blue-500"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSavePhone(client.id);
                                                if (e.key === 'Escape') setEditingPhoneId(null);
                                              }}
                                            />
                                            <button onClick={() => handleSavePhone(client.id)} className="text-green-500 hover:text-green-400 p-1">
                                              <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => setEditingPhoneId(null)} className="text-slate-500 hover:text-slate-400 p-1">
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 group/phone">
                                            {client.phone ? (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setPhoneCallClient(client);
                                                }}
                                                className="text-xs text-blue-400 hover:underline flex items-center gap-1.5"
                                              >
                                                <Phone className="w-3 h-3" />
                                                {client.phone}
                                              </button>
                                            ) : (
                                              <span className="text-xs text-slate-600">No phone</span>
                                            )}
                                            <button 
                                              onClick={() => {
                                                setEditingPhoneId(client.id);
                                                setEditPhoneValue(client.phone || '');
                                              }}
                                              className="text-slate-600 hover:text-slate-400 opacity-0 group-hover/phone:opacity-100 transition-opacity p-1"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                                          <span>{client.contacts?.length || 0} Listed</span>
                                        </div>
                                        <div className="relative">
                                          <button 
                                            onClick={() => setActiveDropdownId(activeDropdownId === client.id ? null : client.id)} 
                                            className="text-slate-500 hover:text-slate-300 p-1"
                                          >
                                            <MoreHorizontal className="w-4 h-4" />
                                          </button>
                                          {activeDropdownId === client.id && (
                                            <div className="absolute right-0 mt-1 w-36 bg-[#1a1d23] border border-slate-700 rounded-lg shadow-xl z-10 py-1">
                                              <button 
                                                onClick={() => handleBlacklist(client.id)}
                                                className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-slate-800 flex items-center gap-2"
                                              >
                                                <ShieldAlert className="w-3.5 h-3.5" /> Blacklist
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} />}

      {showBccModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#161a22] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Copy className="w-5 h-5 text-indigo-400" />
                Copy Emails & Log BCC
              </h3>
              <button onClick={() => setShowBccModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCopyBccEmails} className="p-5 space-y-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <p className="text-xs text-indigo-300 leading-relaxed">
                  This will copy all available contact emails from the <strong>{filteredClients.length}</strong> filtered clients to your clipboard, and log a bulk interaction to prevent duplicate outreach.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Email Subject</label>
                <input 
                  type="text" 
                  required
                  value={bccSubject}
                  onChange={e => setBccSubject(e.target.value)}
                  placeholder="e.g. Q4 Restock Offer"
                  className="w-full bg-[#0d0f12] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Campaign / Initiative Name</label>
                <input 
                  type="text" 
                  required
                  value={bccCampaign}
                  onChange={e => setBccCampaign(e.target.value)}
                  placeholder="e.g. End of Year Clearance"
                  className="w-full bg-[#0d0f12] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Additional Details / FUP Requirements</label>
                <textarea 
                  value={bccDetails}
                  onChange={e => setBccDetails(e.target.value)}
                  placeholder="e.g. Follow up with Tier 1s via WhatsApp in 3 days..."
                  rows={3}
                  className="w-full bg-[#0d0f12] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  Copy to Clipboard & Log Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {phoneCallClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#161a22] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-blue-400" />
                  Pre-Call Prep: {phoneCallClient.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Dialing: {phoneCallClient.phone}</p>
              </div>
              <button onClick={() => setPhoneCallClient(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const logEntry = {
                id: uuidv4(),
                clientId: phoneCallClient.id,
                timestamp: new Date(),
                channel: 'Phone Call',
                summary: `Objective: ${phoneObjective}`
              };
              try {
                await db.interactions.add(logEntry);
                alert("Call preparation logged.");
                setPhoneCallClient(null);
                setPhoneObjective('');
              } catch(err) {
                console.error(err);
                alert("Failed to log call prep.");
              }
            }} className="p-5 space-y-5">
              
              <div className="bg-[#12151a] p-4 rounded-xl border border-slate-700/50 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1">1. Identify the Objective</h4>
                  <p className="text-xs text-slate-400">Are you aiming for a meeting, a quote, or just gathering intelligence (e.g. current supplier)?</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1">2. Lead with Value</h4>
                  <p className="text-xs text-slate-400">What specific pain point are you solving for a <strong>{phoneCallClient.category}</strong> company?</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1">3. Prepare for Objections</h4>
                  <p className="text-xs text-slate-400">"We are happy with our current supplier." / "Your price is too high." — Be ready to pivot to quality/service.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Call Objective / Notes (Will be logged)</label>
                <textarea 
                  required
                  value={phoneObjective}
                  onChange={e => setPhoneObjective(e.target.value)}
                  placeholder="e.g. Asking about their upcoming pipeline and pitching our new offer..."
                  rows={3}
                  className="w-full bg-[#0d0f12] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <a 
                  href={`tel:${phoneCallClient.phone?.replace(/[^0-9+]/g, '')}`}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors text-center flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Phone className="w-4 h-4 text-slate-400" /> Dial Number
                </a>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  Log Prep & Start
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showReportModal && (
        <ReportModal onClose={() => setShowReportModal(false)} />
      )}
    </div>
    </>
  );
}
