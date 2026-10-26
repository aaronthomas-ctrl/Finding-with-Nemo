import { logActivity } from '../lib/activity';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from '../db';
import { db, Client, Lead, Interaction, PRODUCT_LINES } from '../db';
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  ArrowLeft, MessageCircle, Mail, Linkedin, Phone, MapPin, 
  Plus, Trash2, Calendar, FileText, ChevronDown, Check,
  Briefcase, ShieldAlert, Globe, Search, ExternalLink, RefreshCw, Sparkles, Copy, Clock, X
} from 'lucide-react';
import { QuickPicker } from './QuickPicker';
import { computePredictions } from '../lib/forecast';
import { OutreachButtons } from './OutreachButtons';
import { getLocalStockPushes, getLocalBrands, getLocalWarehouseProducts, getLocalSalesmen } from '../lib/stockData';
import { LogDirectPushModal } from './campaigns/LogDirectPushModal';
import { StockPushLog, Brand, WarehouseProduct, Salesman } from '../types/stockist';
import { Package, Flame, CheckCircle2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Pursuing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Quoted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Won: 'bg-green-500/20 text-green-400 border-green-500/30',
  Lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  Parked: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Blacklisted: 'bg-red-900/30 text-red-500 border-red-900/50',
};

const CATEGORIES = [
  "EPC Contractor", "Steel Fabricator", "Oilfield & Petrochemical Services",
  "Electromechanical/MEP", "Marine/Shipbuilding", "Welding Trade/Distributor",
  "Trader", "Other"
];

export function ClientProfileView({ clientId, onClose }: { clientId?: string; onClose?: () => void }) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = clientId || paramId;
  const settingsData = useLiveQuery(() => db.settings.get("default"));
  const distributedBrands = settingsData?.distributedBrands || [];
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);

  const client = useLiveQuery(() => db.clients.get(id!), [id, refreshKey]);
  const leads = useLiveQuery(() => db.leads.where('clientId').equals(id!).toArray(), [id]);
  const interactions = useLiveQuery(() => db.interactions.where('clientId').equals(id!).reverse().sortBy('timestamp'), [id]);
  // We would also pull enquiries, but for now we focus on the requested features

  const enquiries = useLiveQuery(() => db.enquiries.where('clientId').equals(id!).reverse().sortBy('date'), [id]);
  
  // Option B: Query persistent client search results history from client_search_results table
  const searchHistory = useLiveQuery(
    () => db.clientSearchResults.where('clientId').equals(id!).reverse().sortBy('searchedAt'),
    [id, refreshKey]
  );
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

  const activeSearchResult = (searchHistory && searchHistory.length > 0)
    ? (searchHistory[selectedSearchIndex] || searchHistory[0])
    : (client?.googleSearchResults || null);
  
  // Forecast predictions
  const [predictions, setPredictions] = useState<any[]>([]);

  
  useEffect(() => {
    if (id) {
      logActivity('CUSTOMER_VIEWED', { clientId: id });
    }
  }, [id]);

  useEffect(() => {
    if (enquiries) {
      try {
        setPredictions(computePredictions(enquiries));
      } catch (err) {
        console.error(err);
      }
        
    }
  }, [enquiries]);

  const [activeTab, setActiveTab] = useState<'details' | 'enquiries' | 'pushes'>('details');
  const [whatTheyDo, setWhatTheyDo] = useState('');
  const [whatTheyDoTimeout, setWhatTheyDoTimeout] = useState<any>(null);
  const [localContacts, setLocalContacts] = useState<any[]>([]);

  // Stock Push State
  const [stockPushes, setStockPushes] = useState<StockPushLog[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [allProducts, setAllProducts] = useState<WarehouseProduct[]>([]);
  const [allSalesmen, setAllSalesmen] = useState<Salesman[]>([]);
  const [showLogPushModal, setShowLogPushModal] = useState(false);

  const loadPushData = () => {
    const p = getLocalStockPushes().filter(item => item.clientId === id);
    setStockPushes(p);
    setAllBrands(getLocalBrands());
    setAllProducts(getLocalWarehouseProducts());
    setAllSalesmen(getLocalSalesmen());
  };

  useEffect(() => {
    loadPushData();
  }, [id]);

  // Lead Form
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [newLead, setNewLead] = useState({ note: '', productLine: PRODUCT_LINES[0], estValue: '' });

  // Note Form
  const [newNote, setNewNote] = useState('');

  // Enquiry Form
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [newEnquiry, setNewEnquiry] = useState({
    date: new Date().toISOString().split('T')[0],
    productLine: PRODUCT_LINES[0],
    itemDescription: '',
    quantity: '',
    department: '',
    outcome: 'Pending' as const
  });

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lastPromptTime, setLastPromptTime] = useState(0);

  const showAutoPrompt = () => {
    const now = Date.now();
    if (now - lastPromptTime > 30000) {
      setShowDatePicker(true);
      setLastPromptTime(now);
    }
  };

  useEffect(() => {
    if (client && whatTheyDo === '' && client.whatTheyDo) {
      setWhatTheyDo(client.whatTheyDo);
    }
  }, [client]);

  useEffect(() => {
    if (client && client.contacts) {
      setLocalContacts(client.contacts);
    }
  }, [client?.contacts]);

  const [newTag, setNewTag] = useState('');

  // Google Search Grounding state
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [appendedSummary, setAppendedSummary] = useState(false);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const currentTags = client?.tags || [];
      if (!currentTags.includes(newTag.trim())) {
        updateClient({ tags: [...currentTags, newTag.trim()] });
      }
      setNewTag('');
    }
  };

  if (!client) {
    return <div className="p-8 text-slate-400">Loading profile...</div>;
  }

  const updateClient = async (updates: Partial<Client>) => {
    try {
      await db.clients.update(id!, { ...updates, updatedAt: new Date() });
      setRefreshKey(k => k + 1);
    } catch (e) { console.error(e); }
  };

  const handleWhatTheyDoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setWhatTheyDo(e.target.value);
    if (whatTheyDoTimeout) clearTimeout(whatTheyDoTimeout);
    setWhatTheyDoTimeout(setTimeout(() => {
      updateClient({ whatTheyDo: e.target.value });
    }, 1000));
  };

  const fetchGoogleSearchData = async () => {
    if (!client) return;
    setSearchLoading(true);
    setSearchError(null);

    try {
      const res = await fetch('/api/client-google-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: client.name,
          address: client.address || '',
          website: client.website || ''
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch search data');
      }

      const searchResultData = {
        clientId: id!,
        companyName: client.name,
        summary: data.summary || '',
        sources: Array.isArray(data.sources) ? data.sources : [],
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
        groundedWith: data.groundedWith || 'Live Web Search',
        searchedAt: data.fetchedAt || new Date().toISOString()
      };

      // 1. Insert into dedicated Option B client_search_results table in Supabase
      try {
        await db.clientSearchResults.add(searchResultData);
      } catch (dbErr) {
        console.warn('Could not save to client_search_results table:', dbErr);
      }

      // 2. Also cache latest search in client metadata for immediate reactivity
      try {
        await updateClient({
          googleSearchResults: {
            summary: searchResultData.summary,
            sources: searchResultData.sources,
            searchQueries: searchResultData.searchQueries,
            fetchedAt: searchResultData.searchedAt,
            groundedWith: searchResultData.groundedWith
          }
        });
      } catch (upErr) {
        console.warn('Client update warning:', upErr);
      }

      setSelectedSearchIndex(0);
      setRefreshKey(k => k + 1);

      // Scroll to the search section if on details tab
      if (activeTab === 'details') {
        const el = document.getElementById('google-search-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } catch (err: any) {
      console.error('Error fetching Google Search data:', err);
      setSearchError(err.message || 'Failed to fetch Google Search data');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAppendSummary = async () => {
    if (!activeSearchResult?.summary) return;
    const current = whatTheyDo || '';
    const dateVal = activeSearchResult.searchedAt || activeSearchResult.fetchedAt;
    const dateStr = dateVal ? new Date(dateVal).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : 'Recent';
    const toAppend = `\n\n[Google Search Findings - ${dateStr}]\n${activeSearchResult.summary}`;
    const updated = current ? `${current}${toAppend}` : activeSearchResult.summary;
    setWhatTheyDo(updated);
    await updateClient({ whatTheyDo: updated });
    setAppendedSummary(true);
    setTimeout(() => setAppendedSummary(false), 2500);
  };

  const handleCopySummary = () => {
    if (!activeSearchResult?.summary) return;
    navigator.clipboard.writeText(activeSearchResult.summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleDeleteSearchResult = async (resultId?: string) => {
    if (!resultId) return;
    try {
      await db.clientSearchResults.delete(resultId);
      setSelectedSearchIndex(0);
      setRefreshKey(k => k + 1);
    } catch (delErr) {
      console.error('Error deleting search result:', delErr);
    }
  };

  const addContact = async () => {
    const updatedContacts = [...localContacts, { name: '', role: '', mobile: '', email: '' }];
    setLocalContacts(updatedContacts);
    await updateClient({ contacts: updatedContacts });
  };

  const updateContact = async (index: number, field: string, value: string) => {
    const updatedContacts = [...localContacts];
    
    // Auto-format mobile on blur logic could go here, or just inline
    if (field === 'mobile' && /^\d{9}$/.test(value.trim())) {
      value = `+971${value.trim()}`;
    }

    (updatedContacts[index] as any)[field] = value;
    setLocalContacts(updatedContacts);
    await updateClient({ contacts: updatedContacts });
  };

  const removeContact = async (index: number) => {
    const updatedContacts = [...localContacts];
    updatedContacts.splice(index, 1);
    setLocalContacts(updatedContacts);
    await updateClient({ contacts: updatedContacts });
  };

  const addRestrictedBrand = async () => {
    const updatedBrands = [...(client.restrictedBrands || []), ''];
    await updateClient({ restrictedBrands: updatedBrands });
  };

  const updateRestrictedBrand = async (index: number, value: string) => {
    const updatedBrands = [...(client.restrictedBrands || [])];
    updatedBrands[index] = value;
    await updateClient({ restrictedBrands: updatedBrands });
  };

  const removeRestrictedBrand = async (index: number) => {
    const updatedBrands = [...(client.restrictedBrands || [])];
    updatedBrands.splice(index, 1);
    await updateClient({ restrictedBrands: updatedBrands });
  };


  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.note || !newLead.productLine) return;

    await db.leads.add({
      id: uuidv4(),
      clientId: id!,
      date: new Date(),
      note: newLead.note,
      productLine: newLead.productLine,
      estValue: newLead.estValue ? parseFloat(newLead.estValue) : null
    });

    setShowLeadForm(false);
    setNewLead({ note: '', productLine: PRODUCT_LINES[0], estValue: '' });
  };

  const handleAddEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnquiry.itemDescription) return;

    await db.enquiries.add({
      id: uuidv4(),
      clientId: id!,
      date: new Date(newEnquiry.date),
      productLine: newEnquiry.productLine,
      itemDescription: newEnquiry.itemDescription,
      quantity: parseFloat(newEnquiry.quantity) || 0,
      department: newEnquiry.department,
      outcome: newEnquiry.outcome
    });

    setShowEnquiryForm(false);
    setNewEnquiry({
      date: new Date().toISOString().split('T')[0],
      productLine: PRODUCT_LINES[0],
      itemDescription: '',
      quantity: '',
      department: '',
      outcome: 'Pending'
    });
  };

  const updateEnquiryOutcome = async (enquiryId: string, outcome: string) => {
    await db.enquiries.update(enquiryId, { outcome: outcome as any });
  };

  const handleAddNote = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newNote.trim()) {
      await db.interactions.add({
        id: uuidv4(),
        clientId: id!,
        timestamp: new Date(),
        channel: 'Note',
        summary: newNote.trim()
      });
      setNewNote('');
      showAutoPrompt();
    }
  };

  const handleAction = async (channel: "Call" | "Visit") => {
    // We will expand on these in Section 5. For now, log an interaction.
    await db.interactions.add({
      id: uuidv4(),
      clientId: id!,
      timestamp: new Date(),
      channel,
      summary: `${channel} initiated`
    });
    showAutoPrompt();
  };

  const openEstValue = leads?.reduce((sum, l) => sum + (l.estValue || 0), 0) || 0;

  const t1 = client?.tier1;
  const isAllocatedOther = t1?.allocationStatus === 'Allocated — Other Distributor';
  const showWarning = isAllocatedOther && t1?.allocatedProductLines?.includes(newEnquiry.productLine);

  return (
    <div className="flex flex-col h-full relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar">
        {/* Header */}
        <div className="bg-[#12151a] border-b border-slate-800 p-6 sticky top-0 z-10">
          <div className="flex flex-wrap items-center gap-4 mb-2">
            <button 
              onClick={() => { if (onClose) onClose(); else navigate(-1); }}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
              title={onClose ? "Close Profile" : "Go Back"}
            >
              {onClose ? <X className="w-5 h-5 text-slate-200" /> : <ArrowLeft className="w-5 h-5" />}
              {onClose && <span className="text-xs font-semibold text-slate-300 pr-1">Close</span>}
            </button>
            <h1 className="text-2xl font-bold text-slate-100 flex-1 truncate">{client.name}</h1>
            <div className="flex items-center gap-2">
              {(client.googleMapsLink || client.metadata?.googleMapsUri || client.metadata?.googleMapsLink || client.address) && (
                <a 
                  href={client.googleMapsLink || client.metadata?.googleMapsUri || client.metadata?.googleMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.name + ' ' + (client.address || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors shrink-0"
                  title="Open on Google Maps"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </a>
              )}
              {client.website && (
                <a 
                  href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs font-medium transition-colors shrink-0"
                  title="Visit Website"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Website</span>
                </a>
              )}
              <button
                onClick={fetchGoogleSearchData}
                disabled={searchLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg text-xs font-medium transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                title="Get matching recent results and sources from Google Search"
              >
                {searchLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>{activeSearchResult ? 'Update Search Data' : 'Google Search Data'}</span>
              </button>
            </div>
          </div>

          {client.address && (
            <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{client.address}</span>
            </p>
          )}

          <div className="flex flex-wrap gap-3 mb-4">
            <select 
              value={client.status}
              onChange={e => updateClient({ status: e.target.value as any })}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border outline-none appearance-none cursor-pointer ${STATUS_COLORS[client.status]}`}
            >
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select 
              value={client.tier}
              onChange={e => updateClient({ tier: parseInt(e.target.value) as any })}
              className="bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full outline-none appearance-none cursor-pointer hover:bg-slate-700 transition-colors"
              title="1=EPC giants/weekly, 2=large fabricators/bi-weekly, 3=mid-size/monthly, 4=workshops/monthly"
            >
              {[1, 2, 3, 4].map(t => <option key={t} value={t}>Tier {t}</option>)}
            </select>

            <select 
              value={client.category}
              onChange={e => updateClient({ category: e.target.value as any })}
              className="bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full outline-none appearance-none cursor-pointer hover:bg-slate-700 transition-colors max-w-[200px] truncate"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="flex gap-6 border-b border-slate-800">
            <button 
              onClick={() => setActiveTab('details')}
              className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'details' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Details
              {activeTab === 'details' && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('enquiries')}
              className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'enquiries' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Enquiries
              {activeTab === 'enquiries' && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('pushes')}
              className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${activeTab === 'pushes' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Package className="w-3.5 h-3.5" /> Stock Pushes ({stockPushes.length})
              {activeTab === 'pushes' && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 flex gap-2 overflow-x-auto custom-scrollbar border-b border-slate-800 bg-[#161a20]">
          <OutreachButtons 
            client={client}
            defaultPurpose="firstOutreach"
            onActionComplete={showAutoPrompt}
          />
          <div className="w-[1px] h-6 bg-slate-700 mx-1 shrink-0"></div>
          <button onClick={() => handleAction('Call')} className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors whitespace-nowrap">
            <Phone className="w-4 h-4" /> Log Call
          </button>
          <button onClick={() => handleAction('Visit')} className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors whitespace-nowrap">
            <MapPin className="w-4 h-4" /> Log Visit
          </button>
        </div>

        <div className="p-6 max-w-4xl mx-auto space-y-8">
          {activeTab === 'details' ? (
            <>
              {/* Google Search Intelligence & Recent Data Card */}
              <section id="google-search-section" className="bg-[#12151a] border border-slate-800 p-5 rounded-xl transition-all">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                          Recent Data from Google Search
                        </h3>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                          <Search className="w-3 h-3" /> Google Search & Places
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Real-time Google search data, verified place profile, and direct web sources
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={fetchGoogleSearchData}
                    disabled={searchLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    {searchLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Searching Google...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{activeSearchResult ? 'Refresh Search' : 'Fetch Google Search Data'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Option B: Search Runs History selector if multiple entries exist */}
                {searchHistory && searchHistory.length > 1 && (
                  <div className="mb-4 p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center gap-2 overflow-x-auto text-xs">
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0 uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5 text-sky-400" /> History ({searchHistory.length} runs):
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {searchHistory.map((item: any, idx: number) => {
                        const isSelected = selectedSearchIndex === idx;
                        const d = item.searchedAt ? new Date(item.searchedAt) : null;
                        const label = d && !isNaN(d.getTime())
                          ? `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : `Run #${searchHistory.length - idx}`;
                        return (
                          <button
                            key={item.id || idx}
                            onClick={() => setSelectedSearchIndex(idx)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                                : 'bg-black/30 text-slate-400 hover:text-slate-200 border-slate-800'
                            }`}
                          >
                            <span>{label}</span>
                            {idx === 0 && (
                              <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] rounded font-semibold">Latest</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {searchError && (
                  <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center justify-between gap-2">
                    <span>{searchError}</span>
                    <button
                      onClick={fetchGoogleSearchData}
                      className="px-2 py-1 bg-red-900/60 hover:bg-red-800 rounded text-red-200 text-[11px] font-medium"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {searchLoading ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-900/40 border border-slate-800/80 rounded-lg">
                    <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                    <p className="text-xs text-slate-300 font-medium">
                      Gathering recent data for &quot;{client.name}&quot; from Google Search...
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Querying live web sources and analyzing verified company information
                    </p>
                  </div>
                ) : activeSearchResult ? (
                  <div className="space-y-4">
                    {/* Timestamp & Grounding Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>
                          Searched: {activeSearchResult.searchedAt || activeSearchResult.fetchedAt 
                            ? new Date(activeSearchResult.searchedAt || activeSearchResult.fetchedAt).toLocaleString() 
                            : 'Recently'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[10px]">
                          {activeSearchResult.groundedWith || 'Live Web Search'}
                        </span>
                        {activeSearchResult.id && (
                          <button
                            onClick={() => handleDeleteSearchResult(activeSearchResult.id)}
                            className="text-red-400/70 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                            title="Delete this history entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Summary Block */}
                    <div className="bg-black/40 border border-slate-800 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Executive Overview & Recent Findings
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopySummary}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors cursor-pointer"
                            title="Copy summary to clipboard"
                          >
                            {copiedSummary ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={handleAppendSummary}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded border border-emerald-500/30 transition-colors cursor-pointer"
                            title="Append findings to 'What they do' field below"
                          >
                            {appendedSummary ? <Check className="w-3 h-3 text-emerald-400" /> : <Plus className="w-3 h-3" />}
                            <span>{appendedSummary ? 'Appended!' : '+ Append to "What they do"'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed space-y-2">
                        {activeSearchResult.summary}
                      </div>
                    </div>

                    {/* Sources List with Direct Access */}
                    {activeSearchResult.sources && Array.isArray(activeSearchResult.sources) && activeSearchResult.sources.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-sky-400" />
                            Top Search Sources & Direct Links ({activeSearchResult.sources.length})
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            Click any source to access live website
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeSearchResult.sources.map((source: any, idx: number) => {
                            const uri = typeof source === 'string' ? source : (source?.uri || '');
                            const title = (typeof source === 'object' && source?.title) ? source.title : uri;
                            const domain = (typeof source === 'object' && source?.domain) ? source.domain : 'web source';
                            if (!uri) return null;
                            return (
                              <a
                                key={idx}
                                href={uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex flex-col justify-between p-2.5 bg-black/30 hover:bg-slate-800/60 border border-slate-800 hover:border-sky-500/40 rounded-lg transition-all"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-xs font-medium text-slate-200 group-hover:text-sky-300 transition-colors line-clamp-2">
                                    {title}
                                  </span>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 shrink-0 mt-0.5 transition-colors" />
                                </div>
                                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 group-hover:text-slate-400">
                                  <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
                                    {domain}
                                  </span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Search Queries Used */}
                    {activeSearchResult.searchQueries && Array.isArray(activeSearchResult.searchQueries) && activeSearchResult.searchQueries.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="text-slate-400 font-medium">Search queries:</span>
                        {activeSearchResult.searchQueries.map((q: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-900 rounded text-slate-400 border border-slate-800">
                            &quot;{q}&quot;
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 text-center bg-black/20 border border-dashed border-slate-800 rounded-lg">
                    <p className="text-xs text-slate-300 font-medium mb-1">
                      No Google Search data fetched yet for {client.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mb-3 max-w-md mx-auto">
                      Click below to retrieve real-time matching business information, recent corporate news, and top web sources directly from Google Search.
                    </p>
                    <button
                      onClick={fetchGoogleSearchData}
                      disabled={searchLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Fetch Recent Data from Google Search</span>
                    </button>
                  </div>
                )}
              </section>

              {/* What they do */}
          <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">What they do</h3>
            
            {client.tags && client.tags.filter(t => !t.toLowerCase().startsWith('customer:')).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {client.tags
                  .filter(t => !t.toLowerCase().startsWith('customer:'))
                  .map((t, idx) => (
                  <span key={idx} className="bg-amber-500/10 text-amber-500 text-xs px-2 py-1 rounded border border-amber-500/20 flex items-center gap-1">
                    {t}
                    <button 
                      onClick={() => updateClient({ tags: client.tags?.filter(tag => tag !== t) })}
                      className="text-amber-500/50 hover:text-amber-500 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input 
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag and press Enter..."
              className="w-full bg-black/30 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-blue-500 outline-none mb-4"
            />

            <textarea
              value={whatTheyDo}
              onChange={handleWhatTheyDoChange}
              placeholder="Add background information..."
              className="w-full bg-black/30 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-blue-500 outline-none min-h-[100px] resize-y"
            />
          </section>

          
          {/* Target Brands */}
          <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" /> Target Brands (Push list)
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {client.targetBrands && client.targetBrands.length > 0 ? (
                client.targetBrands.map((tb, idx) => (
                  <span key={idx} className="bg-purple-500/10 text-purple-400 text-xs px-2 py-1 rounded border border-purple-500/20 flex items-center gap-1">
                    {tb}
                    <button 
                      onClick={() => updateClient({ targetBrands: client.targetBrands?.filter(tag => tag !== tb) })}
                      className="text-purple-500/50 hover:text-purple-400 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 italic">No target brands selected yet.</span>
              )}
            </div>
            
            <div className="pt-3 border-t border-slate-800/50">
              <h4 className="text-xs text-slate-400 mb-2">Available Brands to Push:</h4>
              <div className="flex flex-wrap gap-2">
                {distributedBrands.map((brand: string, i: number) => {
                  const isAdded = client.targetBrands?.includes(brand);
                  return (
                    <button
                      key={i}
                      disabled={isAdded}
                      onClick={() => updateClient({ targetBrands: [...(client.targetBrands || []), brand] })}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${isAdded ? 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'}`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Contacts */}
          <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Contacts</h3>
              <button onClick={addContact} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Contact
              </button>
            </div>
            
            <div className="space-y-3">
              {localContacts.map((contact, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-black/20 p-3 rounded-lg border border-slate-800/50">
                  <input
                    type="text"
                    placeholder="Name"
                    value={contact.name}
                    onChange={e => updateContact(idx, 'name', e.target.value)}
                    className="flex-1 bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-sm px-1 py-1 text-slate-200 w-full"
                  />
                  <input
                    type="text"
                    placeholder="Role"
                    value={contact.role}
                    onChange={e => updateContact(idx, 'role', e.target.value)}
                    className="flex-1 bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-sm px-1 py-1 text-slate-200 w-full"
                  />
                  <input
                    type="text"
                    placeholder="Mobile (+971...)"
                    value={contact.mobile}
                    onChange={e => updateContact(idx, 'mobile', e.target.value)}
                    onBlur={e => updateContact(idx, 'mobile', e.target.value)} // triggers the formatting
                    className="flex-1 bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-sm px-1 py-1 text-slate-200 w-full font-mono"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={contact.email}
                    onChange={e => updateContact(idx, 'email', e.target.value)}
                    className="flex-1 bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-sm px-1 py-1 text-slate-200 w-full"
                  />
                  <button onClick={() => removeContact(idx)} className="text-slate-500 hover:text-red-400 p-1 md:self-center self-end">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {client.contacts.length === 0 && (
                <p className="text-sm text-slate-500 italic">No contacts added yet.</p>
              )}
            </div>
          </section>

          {/* Restricted Brands */}
          <section className="bg-red-950/20 border border-red-900/30 p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Restricted Brands
              </h3>
              <button onClick={addRestrictedBrand} className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Restriction
              </button>
            </div>
            <div className="space-y-3">
              {(client.restrictedBrands || []).map((brand, idx) => (
                <div key={idx} className="flex gap-3 items-center bg-black/20 p-3 rounded-lg border border-red-900/20">
                  <input
                    type="text"
                    placeholder="E.g. ESAB (Dealer Exclusive)"
                    value={brand}
                    onChange={e => updateRestrictedBrand(idx, e.target.value)}
                    className="flex-1 bg-transparent border-b border-red-900/50 focus:border-red-500 outline-none text-sm px-1 py-1 text-slate-200"
                  />
                  <button onClick={() => removeRestrictedBrand(idx)} className="text-slate-500 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {!(client.restrictedBrands?.length) && (
                <p className="text-sm text-slate-500 italic">No brand restrictions logged.</p>
              )}
            </div>
          </section>

          {/* Leads & Opportunities */}
          <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-amber-500" /> Leads & Opportunities
                </h3>
                {openEstValue > 0 && (
                  <p className="text-xs text-amber-400 mt-1 font-medium">Pipeline Value: AED {openEstValue.toLocaleString()}</p>
                )}
              </div>
              <button 
                onClick={() => setShowLeadForm(!showLeadForm)} 
                className="text-xs flex items-center gap-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors font-medium border border-amber-500/20"
              >
                <Plus className="w-3.5 h-3.5" /> Add Lead
              </button>
            </div>

            {showLeadForm && (
              <form onSubmit={handleAddLead} className="bg-black/30 p-4 rounded-lg border border-slate-700 mb-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Product Line *</label>
                  <select 
                    required
                    value={newLead.productLine}
                    onChange={e => setNewLead({...newLead, productLine: e.target.value})}
                    className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {PRODUCT_LINES.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Note / Details *</label>
                  <input 
                    required
                    type="text"
                    value={newLead.note}
                    onChange={e => setNewLead({...newLead, note: e.target.value})}
                    className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="E.g. Interested in new welding machines"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Estimated Value (AED)</label>
                  <input 
                    type="number"
                    value={newLead.estValue}
                    onChange={e => setNewLead({...newLead, estValue: e.target.value})}
                    className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowLeadForm(false)} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200">Cancel</button>
                  <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-lg">Save Lead</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {leads?.map(lead => (
                <div key={lead.id} className="flex flex-col sm:flex-row justify-between sm:items-center bg-black/20 p-3 rounded-lg border border-slate-800/50 gap-2">
                  <div>
                    <span className="inline-block px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] rounded mb-1">{lead.productLine}</span>
                    <p className="text-sm text-slate-200">{lead.note}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{lead.date.toLocaleDateString()}</p>
                  </div>
                  {lead.estValue && (
                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-400">Est. Value</span>
                      <p className="text-sm font-semibold text-amber-500 font-mono">AED {lead.estValue.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              ))}
              {leads?.length === 0 && !showLeadForm && (
                <p className="text-sm text-slate-500 italic">No leads identified yet.</p>
              )}
            </div>
          </section>

          {/* Timeline & Notes */}
          <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Timeline</h3>
            
            <div className="relative mb-6">
              <input 
                type="text"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={handleAddNote}
                placeholder="Type a note and press Enter..."
                className="w-full bg-black/30 border border-slate-700 rounded-lg pl-4 pr-10 py-3 text-sm text-slate-200 focus:border-blue-500 outline-none"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="space-y-4 pl-2 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-slate-800">
              {interactions?.map(interaction => (
                <div key={interaction.id} className="relative pl-6">
                  <div className="absolute left-0 top-1.5 w-[6px] h-[6px] rounded-full bg-blue-500 ring-4 ring-[#12151a]" />
                  <div className="bg-black/20 p-3 rounded-lg border border-slate-800/50">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{interaction.channel}</span>
                      <span className="text-[10px] text-slate-500">{interaction.timestamp.toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{interaction.summary}</p>
                  </div>
                </div>
              ))}
              {interactions?.length === 0 && (
                <p className="text-sm text-slate-500 italic pl-6">No interactions logged yet.</p>
              )}
            </div>
          </section>
            </>
          ) : activeTab === 'enquiries' ? (
            <div className="space-y-8">
              {/* Predictions */}
              {predictions.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-blue-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                    Predicted Demand
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {predictions.map((p, idx) => (
                      <div key={idx} className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="inline-block px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded border border-blue-500/30">
                              {p.productLine} {p.department ? `(${p.department})` : ''}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              p.confidence === 'High' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                              p.confidence === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                              'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>
                              {p.confidence} Confidence
                            </span>
                          </div>
                          <p className="text-sm text-slate-200 mt-2">
                            Expected again around <span className="font-bold text-white">{p.predictedNextDate.toLocaleDateString()}</span>
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 mt-4">
                          Based on {p.n} enquiries (avg every {p.avgInterval} days)
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Enquiries List */}
              <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Enquiries Log</h3>
                  <button 
                    onClick={() => setShowEnquiryForm(!showEnquiryForm)} 
                    className="text-xs flex items-center gap-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors font-medium border border-blue-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Enquiry
                  </button>
                </div>

                {showEnquiryForm && (
                  <form onSubmit={handleAddEnquiry} className="bg-black/30 p-4 rounded-lg border border-slate-700 mb-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
                        <input 
                          required type="date"
                          value={newEnquiry.date}
                          onChange={e => setNewEnquiry({...newEnquiry, date: e.target.value})}
                          className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Product Line *</label>
                        <select 
                          required
                          value={newEnquiry.productLine}
                          onChange={e => setNewEnquiry({...newEnquiry, productLine: e.target.value})}
                          className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                          {PRODUCT_LINES.map(pl => <option key={pl} value={pl}>{pl}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Item Description *</label>
                      <input 
                        required type="text"
                        value={newEnquiry.itemDescription}
                        onChange={e => setNewEnquiry({...newEnquiry, itemDescription: e.target.value})}
                        className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        placeholder="E.g. 300A Welding Machine"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Quantity</label>
                        <input 
                          type="number"
                          value={newEnquiry.quantity}
                          onChange={e => setNewEnquiry({...newEnquiry, quantity: e.target.value})}
                          className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Department / Person</label>
                        <input 
                          type="text" list="departments"
                          value={newEnquiry.department}
                          onChange={e => setNewEnquiry({...newEnquiry, department: e.target.value})}
                          className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                          placeholder="E.g. Marine Div / John"
                        />
                        <datalist id="departments">
                          {Array.from(new Set(enquiries?.map(e => e.department).filter(Boolean))).map((d: any) => (
                            <option key={String(d)} value={String(d)} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Outcome</label>
                      <select 
                        value={newEnquiry.outcome}
                        onChange={e => setNewEnquiry({...newEnquiry, outcome: e.target.value as any})}
                        className="w-full px-3 py-2 bg-[#12151a] border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Quoted">Quoted</option>
                        <option value="Ordered">Ordered</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </div>
                    {showWarning && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-medium">
                        This product line is allocated to {t1?.allocatedTo || 'another distributor'} — confirm before proceeding
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setShowEnquiryForm(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200">Cancel</button>
                      <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg">Save Enquiry</button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  {enquiries?.map(enquiry => (
                    <div key={enquiry.id} className="bg-black/20 p-4 rounded-lg border border-slate-800/50 flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-block px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] rounded">{enquiry.productLine}</span>
                          <span className="text-[10px] text-slate-500">{enquiry.date.toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-200">{enquiry.itemDescription}</p>
                        <div className="text-xs text-slate-400 mt-1 flex gap-4">
                          {enquiry.quantity > 0 && <span>Qty: {enquiry.quantity}</span>}
                          {enquiry.department && <span>Dept: {enquiry.department}</span>}
                        </div>
                      </div>
                      <div className="sm:self-center shrink-0">
                        <select 
                          value={enquiry.outcome}
                          onChange={e => updateEnquiryOutcome(enquiry.id, e.target.value)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full border outline-none appearance-none cursor-pointer ${
                            enquiry.outcome === 'Ordered' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            enquiry.outcome === 'Quoted' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                            enquiry.outcome === 'Lost' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            'bg-slate-500/20 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Quoted">Quoted</option>
                          <option value="Ordered">Ordered</option>
                          <option value="Lost">Lost</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  {enquiries?.length === 0 && !showEnquiryForm && (
                    <p className="text-sm text-slate-500 italic">No enquiries logged yet.</p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            /* Stock Pushes Tab Content */
            <div className="space-y-6">
              <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-400" />
                      Warehouse Materials & Accessories Pushed to {client.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cross-salesman log of brand materials, prices offered, and collision tracking for this account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLogPushModal(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Material Push
                  </button>
                </div>

                {stockPushes.length === 0 ? (
                  <div className="p-8 text-center bg-black/20 rounded-xl border border-slate-800/60 space-y-2">
                    <Package className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">No warehouse stockist items have been pushed to this client yet.</p>
                    <button
                      type="button"
                      onClick={() => setShowLogPushModal(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      + Log a brand material pitch now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stockPushes.map((p) => {
                      const formattedDate = new Date(p.pushedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });
                      return (
                        <div
                          key={p.id}
                          className="p-4 bg-black/25 rounded-xl border border-slate-800/80 space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-slate-100">{p.brandName}</span>
                                <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                                  {p.sku}
                                </span>
                                <span
                                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                                    p.status === 'Ordered'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : p.status === 'Quoted' || p.status === 'Under Negotiation'
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                      : p.status === 'Sample Sent'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </div>
                              <div className="text-xs font-medium text-slate-300 mt-1">
                                {p.productName}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-sm font-bold text-emerald-400">
                                ${p.priceOffered} / unit
                              </div>
                              <div className="text-[10px] text-slate-400">{p.qtyDiscussed} units discussed</div>
                            </div>
                          </div>

                          <div className="text-xs text-slate-400 bg-[#161a22] p-2.5 rounded-lg border border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span>Pushed by: <strong className="text-slate-200">{p.salesmanName}</strong></span>
                              <span className="mx-2 text-slate-600">•</span>
                              <span>Channel: <strong className="text-slate-200">{p.channel}</strong></span>
                              <span className="mx-2 text-slate-600">•</span>
                              <span>Date: <strong className="text-slate-200">{formattedDate}</strong></span>
                            </div>
                            {p.campaignTitle && (
                              <span className="text-[10px] text-blue-400 font-semibold">
                                🎯 {p.campaignTitle}
                              </span>
                            )}
                          </div>

                          {p.notes && (
                            <p className="text-xs text-slate-300 italic pl-1">
                              "{p.notes}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Direct Push Modal */}
      {showLogPushModal && (
        <LogDirectPushModal
          isOpen={showLogPushModal}
          onClose={() => setShowLogPushModal(false)}
          onPushLogged={() => {
            loadPushData();
            setShowLogPushModal(false);
          }}
          clients={client ? [client] : []}
          products={allProducts}
          brands={allBrands}
          salesmen={allSalesmen}
          preselectedClientId={id}
        />
      )}

      {/* Sticky Follow-up Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#161a20] border-t border-slate-800 p-3 sm:p-4 z-20 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${client.nextFollowUpDate ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Next Follow-up</p>
            <p className={`text-sm font-bold ${client.nextFollowUpDate ? 'text-blue-400' : 'text-red-400'}`}>
              {client.nextFollowUpDate ? client.nextFollowUpDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No follow-up set'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowDatePicker(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Schedule
        </button>
      </div>

      {/* QuickPicker Modal */}
      {showDatePicker && (
        <QuickPicker
          companyName={client.name}
          onSave={async (date) => {
            await updateClient({ nextFollowUpDate: date, retryFlag: false });
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
}
