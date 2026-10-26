import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CompanyResult, PolygonZone } from '../types';
import { Search, MapPin, Phone, Globe, Building2, Clock, Info, CheckCircle, Download, ExternalLink, Plus, ShieldAlert, FileText, ChevronDown, ChevronUp, FileSpreadsheet, User, Navigation, Layers, Eye, EyeOff, Tags } from 'lucide-react';
import { checkDuplicate, saveCompanyToPipeline } from '../lib/pipeline';
import { useNavigate } from 'react-router-dom';
import { AddTier1Modal } from './AddTier1Modal';
import { PlaceSearchResult } from './PlaceSearchBar';
import { UAE_INDUSTRIAL_REGIONS } from '../lib/geo';

const SEARCH_TAGS = [
  "EPC contractor",
  "Engineering procurement construction",
  "EPC oil and gas",
  "EPC industrial services",
  "EPC mechanical contractor",
  "EPC electrical contractor",
  "EPC pipeline contractor",
  "EPC turnkey projects",
  "EPC Middle East",
  "EPC UAE",
  "EPC Abu Dhabi",
  "steel fabricator",
  "structural steel fabrication",
  "industrial steel fabrication",
  "metal fabrication workshop",
  "stainless steel fabrication",
  "steel structure fabrication",
  "heavy steel fabrication",
  "steel machining",
  "steel fabrication UAE",
  "steel fabrication Abu Dhabi"
];

interface ResultsSidebarProps {
  bounds: google.maps.LatLngBounds | null;
  customPath: google.maps.LatLngLiteral[] | null;
  onSearch: (queries: string[]) => void;
  isSearching: boolean;
  companies: CompanyResult[];
  onClearRect: () => void;
  onEnrich: (companyId: string, website: string, name: string) => void;
  onGetInsights: (companyId: string, name: string, address: string) => void;
  onClearPastSearches: () => void;
  hasPastSearches: boolean;
  savedZones: PolygonZone[];
  onSaveZone: (name: string, tags: string[]) => void;
  onLoadZone: (zone: PolygonZone) => void;
  onDeleteZone: (id: string) => void;
  onGenerateReport: (zone: PolygonZone) => void;
  onOpenCustomerUpload?: () => void;
  // Regional Place & Nearby Saved Customers props
  searchedPlace?: PlaceSearchResult | null;
  onSelectPlace?: (place: PlaceSearchResult | null) => void;
  radiusKm?: number;
  onChangeRadius?: (radius: number) => void;
  nearbySavedClients?: Array<{ client: any; distance: number }>;
  onOpenClientProfile?: (clientId: string) => void;
  routeStopIds?: Set<string>;
  onToggleRouteStop?: (client: any) => void;
  onOpenRouteOptimizer?: () => void;
}

export function ResultsSidebar({ 
  bounds, 
  customPath, 
  onSearch, 
  isSearching, 
  companies, 
  onClearRect, 
  onEnrich, 
  onGetInsights, 
  onClearPastSearches, 
  hasPastSearches, 
  savedZones, 
  onSaveZone, 
  onLoadZone, 
  onDeleteZone, 
  onGenerateReport, 
  onOpenCustomerUpload,
  searchedPlace,
  onSelectPlace,
  radiusKm = 5,
  onChangeRadius,
  nearbySavedClients = [],
  onOpenClientProfile,
  routeStopIds = new Set(),
  onToggleRouteStop,
  onOpenRouteOptimizer
}: ResultsSidebarProps) {
  const [showNearbyClientsList, setShowNearbyClientsList] = useState(true);
  const [zoneName, setZoneName] = useState('');
  const [showSaveZone, setShowSaveZone] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [activeSearchTags, setActiveSearchTags] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [showTagsFilterBoard, setShowTagsFilterBoard] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [focusedTagIndex, setFocusedTagIndex] = useState(-1);
  const [tier1AddingCompany, setTier1AddingCompany] = useState<CompanyResult | null>(null);
  const [showSavedZonesList, setShowSavedZonesList] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleSearchClick = () => {
    setShowTags(false);
    const tagsToSearch = [...activeSearchTags];
    if (currentInput.trim() && !tagsToSearch.includes(currentInput.trim())) {
      tagsToSearch.push(currentInput.trim());
      setActiveSearchTags(tagsToSearch);
      setCurrentInput('');
    }
    onSearch(tagsToSearch);
  };

  const handleAddTag = (tag: string) => {
    if (!activeSearchTags.includes(tag)) {
      setActiveSearchTags([...activeSearchTags, tag]);
    }
    setCurrentInput('');
    setShowTags(false);
  };
  
  const handleRemoveTag = (tag: string) => {
    setActiveSearchTags(activeSearchTags.filter(t => t !== tag));
  };

  const filteredTags = useMemo(() => {
    const lower = currentInput.toLowerCase();
    return SEARCH_TAGS.filter(t => t.toLowerCase().includes(lower) && !activeSearchTags.includes(t));
  }, [currentInput, activeSearchTags]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showTags) {
      if (e.key === 'Enter') {
        if (currentInput.trim()) {
           handleAddTag(currentInput.trim());
        } else {
           handleSearchClick();
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedTagIndex(prev => (prev < filteredTags.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedTagIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedTagIndex >= 0 && focusedTagIndex < filteredTags.length) {
        handleAddTag(filteredTags[focusedTagIndex]);
      } else if (currentInput.trim()) {
        handleAddTag(currentInput.trim());
      }
    } else if (e.key === 'Escape') {
      setShowTags(false);
    }
  };

  // Close tags popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tagsRef.current && 
        !tagsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowTags(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { filteredCompanies, uniqueTags } = useMemo(() => {
    let result = companies;
    
    // Extract unique tags from current companies (excluding Customer: tags)
    const tagsSet = new Set<string>();
    companies.forEach(c => {
      if (c.tags) {
        c.tags.forEach(t => {
          if (!t.toLowerCase().startsWith('customer:')) {
            tagsSet.add(t);
          }
        });
      }
    });

    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(lower) || 
        c.category.toLowerCase().includes(lower)
      );
    }
    
    if (tagFilters.length > 0) {
      result = result.filter(c => tagFilters.some(t => c.tags?.includes(t)));
    }
    
    return { filteredCompanies: result, uniqueTags: Array.from(tagsSet).sort() };
  }, [companies, filterText, tagFilters]);

  const handleExportCSV = () => {
    const headers = ['Name', 'Address', 'Phone', 'Website', 'Category', 'Rating', 'Company Background', 'Insights', 'Latitude', 'Longitude'];
    const rows = filteredCompanies.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.address.replace(/"/g, '""')}"`,
      `"${c.phone || ''}"`,
      `"${c.website || ''}"`,
      `"${c.category || ''}"`,
      c.rating || '',
      `"${(c.summary || '').replace(/"/g, '""')}"`,
      `"${(c.insights || '').replace(/"/g, '""')}"`,
      c.location.latitude,
      c.location.longitude
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prospects.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveToPipeline = async (company: CompanyResult) => {
    setSavingId(company.id);
    try {
      const dedupe = await checkDuplicate(company);
      if (dedupe.isDuplicate) {
        if (!confirm(`This looks like a duplicate of "${dedupe.existingClient?.name}". Save anyway?`)) {
          setSavingId(null);
          return;
        }
      }
      const client = await saveCompanyToPipeline(company);
      alert(`Saved! You can view it in the Pipeline.`);
      // Optional: navigate(`/pipeline/${client.id}`)
    } catch (err) {
      console.error(err);
      alert("Failed to save client.");
    } finally {
      setSavingId(null);
    }
  };

  const handleBulkSave = async () => {
    setBulkSaving(true);
    let saved = 0;
    let skipped = 0;
    try {
      for (const c of filteredCompanies.filter(c => !c.isSaved)) {
        const dedupe = await checkDuplicate(c);
        if (dedupe.isDuplicate) {
          skipped++;
        } else {
          await saveCompanyToPipeline(c);
          saved++;
        }
      }
      alert(`${saved} saved, ${skipped} skipped as duplicates.`);
    } catch (err) {
      console.error(err);
      alert("Error during bulk save.");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="w-full h-full bg-[#111419] flex flex-col">
      {/* Header & Search Controls */}
      <div className="p-4 border-b border-slate-800 flex-shrink-0 bg-[#12151a]">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-500" /> B2B Prospect Explorer</span>
          {hasPastSearches && (
            <button 
              onClick={onClearPastSearches}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Clear Hist
            </button>
          )}
        </h2>

        {/* Existing Customer List Excel Upload */}
        <div className="mb-4">
          <button
            onClick={onOpenCustomerUpload}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent hover:from-emerald-500/20 hover:via-teal-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-left transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="text-xs font-bold text-slate-100 block group-hover:text-emerald-300 transition-colors truncate">
                  Upload Customer Excel
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Search 1-by-1, map sites & match zones
                </span>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0 ml-1">
              Upload
            </span>
          </button>
        </div>
        
        {/* Zones Management */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-slate-300">Saved Search Areas (Zones)</label>
            {savedZones.length > 0 && (
              <button 
                onClick={() => setShowSavedZonesList(!showSavedZonesList)} 
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {showSavedZonesList ? "Hide" : "Show"} ({savedZones.length})
                {showSavedZonesList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
          
          {savedZones.length > 0 && showSavedZonesList && (
            <div className="flex flex-col gap-1 mb-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {savedZones.map(z => (
                <div key={z.id} className="flex flex-col bg-[#1a1d23] border border-slate-700 px-2 py-1.5 rounded text-xs gap-1">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-slate-200 font-medium truncate flex-1 cursor-pointer hover:text-blue-400" onClick={() => onLoadZone(z)}>{z.name}</span>
                    <button onClick={() => onGenerateReport(z)} className="text-slate-500 hover:text-blue-400 ml-2 p-1" title="Generate Report for this Zone"><FileText className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onDeleteZone(z.id)} className="text-slate-500 hover:text-red-400 ml-1 p-1">✕</button>
                  </div>
                  {z.tags && z.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {z.tags.map(t => (
                        <span key={t} className="text-[9px] bg-slate-800 text-slate-400 px-1.5 rounded border border-slate-700">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {customPath && !showSaveZone && (
            <button 
              onClick={() => setShowSaveZone(true)}
              className="w-full py-1.5 border border-dashed border-slate-600 rounded text-xs text-slate-400 hover:text-blue-400 hover:border-blue-500 transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> Save current drawn area
            </button>
          )}

          {showSaveZone && (
            <div className="flex gap-2 items-center mt-2">
              <input 
                type="text"
                placeholder="Zone name (e.g. ICAD 2)"
                value={zoneName}
                onChange={e => setZoneName(e.target.value)}
                className="flex-1 bg-[#161a22] border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button 
                onClick={() => {
                  if (zoneName.trim()) {
                    onSaveZone(zoneName, activeSearchTags);
                    setZoneName('');
                    setShowSaveZone(false);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium"
              >
                Save
              </button>
              <button 
                onClick={() => setShowSaveZone(false)}
                className="text-slate-400 hover:text-slate-200 px-2 text-xs"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#1a1d23] p-4 rounded-xl shadow-sm border border-slate-800 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-300">1. Search Area & Region</h3>
            {searchedPlace && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold">
                Region Focus
              </span>
            )}
          </div>

          {/* Active Searched Place & Regional Saved Clients Summary */}
          {searchedPlace ? (
            <div className="space-y-3">
              <div className="bg-[#12151a] p-3 rounded-lg border border-slate-700/80">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                      <Navigation className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{searchedPlace.name}</span>
                    </div>
                    {searchedPlace.formattedAddress && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {searchedPlace.formattedAddress}
                      </p>
                    )}
                  </div>
                  {onSelectPlace && (
                    <button
                      onClick={() => onSelectPlace(null)}
                      className="text-slate-500 hover:text-slate-300 text-xs p-1"
                      title="Clear place focus"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Radius selector */}
                {onChangeRadius && (
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium">Radius:</span>
                    <div className="flex bg-[#0b0d10] p-0.5 rounded border border-slate-800">
                      {[2, 5, 10, 15, 25].map(r => (
                        <button
                          key={r}
                          onClick={() => onChangeRadius(r)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                            radiusKm === r
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {r}km
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Nearby Saved Customers in this region */}
              <div className="bg-[#12151a] p-3 rounded-lg border border-slate-700/80">
                <div 
                  onClick={() => setShowNearbyClientsList(!showNearbyClientsList)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Nearby Pipeline Customers ({nearbySavedClients.length})
                    </span>
                  </div>
                  <span className="text-slate-500 hover:text-slate-300 text-xs">
                    {showNearbyClientsList ? '▲' : '▼'}
                  </span>
                </div>

                {showNearbyClientsList && (
                  <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {nearbySavedClients.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-1">
                        No saved pipeline customers in this radius yet.
                      </p>
                    ) : (
                      nearbySavedClients.map(({ client, distance }) => {
                        const isInRoute = routeStopIds.has(client.id);
                        return (
                          <div
                            key={client.id}
                            className={`border p-2 rounded flex items-center justify-between gap-2 text-xs transition-colors ${
                              isInRoute
                                ? 'bg-indigo-950/30 border-indigo-500/50'
                                : 'bg-[#181d25] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-200 block truncate">
                                {client.name}
                              </span>
                              <span className="text-[10px] text-cyan-400 font-mono">
                                {distance} km away • {client.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {onToggleRouteStop && (
                                <button
                                  onClick={() => onToggleRouteStop(client)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors border ${
                                    isInRoute
                                      ? 'bg-indigo-600 text-white border-indigo-500'
                                      : 'bg-slate-800 text-slate-300 hover:text-indigo-300 border-slate-700'
                                  }`}
                                  title={isInRoute ? 'Remove from Route' : 'Add to Route'}
                                >
                                  {isInRoute ? '✓' : '+Route'}
                                </button>
                              )}

                              {onOpenClientProfile && (
                                <button
                                  onClick={() => onOpenClientProfile(client.id)}
                                  className="px-2 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded text-[10px] font-semibold shrink-0 transition-colors flex items-center gap-1"
                                  title="Open customer profile popup window"
                                >
                                  <User className="w-3 h-3" />
                                  <span>Profile</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {routeStopIds.size > 0 && onOpenRouteOptimizer && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] text-indigo-400 font-medium flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          <span>{routeStopIds.size} stops in route</span>
                        </span>
                        <button
                          onClick={onOpenRouteOptimizer}
                          className="text-[10px] px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                        >
                          Optimize Route →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Quick Preset Hubs Chips */}
              <div>
                <span className="text-[11px] text-slate-400 font-medium block mb-1.5">
                  Focus UAE Industrial Region:
                </span>
                <div className="flex flex-wrap gap-1">
                  {UAE_INDUSTRIAL_REGIONS.slice(0, 6).map(hub => (
                    <button
                      key={hub.name}
                      onClick={() => {
                        if (onSelectPlace) {
                          onSelectPlace({
                            id: hub.name.toLowerCase().replace(/\s+/g, '-'),
                            name: hub.name,
                            formattedAddress: `${hub.name}, ${hub.emirate}, UAE`,
                            location: { lat: hub.lat, lng: hub.lng }
                          });
                        }
                      }}
                      className="text-[10px] px-2 py-1 bg-[#12151a] hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-slate-700 hover:border-blue-500/40 rounded transition-colors"
                      title={hub.description}
                    >
                      {hub.name.replace(' Industrial Area', '').replace(' (Industrial City Abu Dhabi)', '').replace(' Free Zone', '')}
                    </button>
                  ))}
                </div>
              </div>

              {bounds ? (
                <div className="text-[10px] text-slate-400 bg-black/40 p-2 rounded border border-slate-800 font-mono">
                  SW: {bounds.getSouthWest().lat().toFixed(4)}, {bounds.getSouthWest().lng().toFixed(4)}<br/>
                  NE: {bounds.getNorthEast().lat().toFixed(4)}, {bounds.getNorthEast().lng().toFixed(4)}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Search a place above or pan/zoom the map to define your search area.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-[#1a1d23] p-4 rounded-xl shadow-sm border border-slate-800">
          <h3 className="text-sm font-medium text-slate-300 mb-2">2. Search Businesses</h3>
          <div className="flex flex-col gap-2 relative">
            {activeSearchTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-1">
                {activeSearchTags.map(tag => (
                  <div key={tag} className="flex items-center gap-1 bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs border border-blue-500/30">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-blue-100 ml-1">
                      <Plus className="w-3 h-3 rotate-45" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 relative">
              <div className="flex-1 relative">
                <input 
                  ref={searchInputRef}
                  type="text"
                  placeholder={activeSearchTags.length ? "Add another keyword..." : "e.g., 'steel fabrication', 'EPC'"}
                  value={currentInput}
                  onChange={(e) => {
                    setCurrentInput(e.target.value);
                    setShowTags(true);
                    setFocusedTagIndex(-1);
                  }}
                  onFocus={() => {
                    setShowTags(true);
                    setFocusedTagIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={!bounds || isSearching}
                  className="w-full text-sm px-3 py-2 border border-slate-700 bg-black/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200 placeholder-slate-500 disabled:bg-[#15181e] disabled:text-slate-600"
                />
              {showTags && filteredTags.length > 0 && (
                <div 
                  ref={tagsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-[#1a1d23] border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 custom-scrollbar"
                >
                  {filteredTags.map((tag, index) => (
                    <div
                      key={tag}
                      className={`px-3 py-2 text-sm cursor-pointer transition-colors ${index === focusedTagIndex ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                      onClick={() => {
                        handleAddTag(tag);
                      }}
                      onMouseEnter={() => setFocusedTagIndex(index)}
                    >
                      {tag}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSearchClick}
              disabled={!bounds || isSearching || (activeSearchTags.length === 0 && !currentInput.trim())}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSearching ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            Results
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-xs border border-slate-700">
              {filteredCompanies.length}
            </span>
          </h3>
          <div className="flex gap-2">
            {companies.length > 0 && (
              <>
                <button 
                  onClick={handleBulkSave}
                  disabled={bulkSaving}
                  className="text-slate-200 hover:text-white text-xs font-medium flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 px-2 py-1 rounded transition-colors"
                >
                  {bulkSaving ? <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span> : <Plus className="w-3.5 h-3.5" />} 
                  Save All
                </button>
                <button 
                  onClick={handleExportCSV}
                  className="text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </>
            )}
          </div>
        </div>

        {companies.length > 0 && (
          <div className="mb-4 space-y-3">
            <input
              type="text"
              placeholder="Filter results by name or category..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-700 bg-[#1a1d23] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200 placeholder-slate-500"
            />
            {uniqueTags.length > 0 && (
              <div className="bg-[#12151a] p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5 text-slate-400" />
                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Filter by Tags</h4>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {uniqueTags.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tagFilters.length > 0 && (
                      <button
                        onClick={() => setTagFilters([])}
                        className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={() => setShowTagsFilterBoard(!showTagsFilterBoard)}
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                      title={showTagsFilterBoard ? "Hide tags board" : "Show tags board"}
                    >
                      {showTagsFilterBoard ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showTagsFilterBoard ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                </div>
                {showTagsFilterBoard && (
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar pt-1">
                    {uniqueTags.map(tag => (
                      <label key={tag} className="flex items-center gap-1.5 bg-[#1a1d23] border border-slate-700 px-2 py-1 rounded cursor-pointer hover:border-slate-500 transition-colors">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 w-3 h-3"
                          checked={tagFilters.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTagFilters(prev => [...prev, tag]);
                            } else {
                              setTagFilters(prev => prev.filter(t => t !== tag));
                            }
                          }}
                        />
                        <span className="text-[10px] text-slate-300 font-medium">{tag}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 pb-4">
          {filteredCompanies.map(c => (
            <div key={c.id} className="bg-[#1a1d23] border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-all cursor-pointer shadow-sm relative overflow-hidden group">
              {/* Status indicator */}
              <div className={`absolute top-0 left-0 w-1 h-full ${c.status === 'OPERATIONAL' ? 'bg-green-500' : 'bg-slate-600'}`}></div>
              
              <div className="pl-2">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-100 leading-tight pr-2">{c.name}</h4>
                  <div className="flex flex-col items-end gap-1">
                    {c.rating && (
                      <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                        ★ {c.rating.toFixed(1)}
                      </span>
                    )}
                    {!c.isSaved ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSaveToPipeline(c); }}
                      disabled={savingId === c.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded whitespace-nowrap flex items-center gap-1"
                    >
                      {savingId === c.id ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span> : <Plus className="w-3 h-3" />}
                      Save
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-emerald-500 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3" /> Saved
                      </span>
                      {onOpenClientProfile && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenClientProfile(c.id); }}
                          className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-1 transition-colors"
                          title="Open customer profile popup window"
                        >
                          <User className="w-3 h-3" /> Profile
                        </button>
                      )}
                    </div>
                  )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setTier1AddingCompany(c); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded whitespace-nowrap flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Add to Tier 1
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className="inline-block bg-blue-900/40 text-blue-400 text-[10px] px-2 py-0.5 rounded border border-blue-800/50">
                    {c.category}
                  </span>
                  {c.isExistingCustomer && (
                    <span className="inline-block bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-500/30">
                      Existing Customer
                    </span>
                  )}
                  {c.matchedZoneName && (
                    <span className="inline-block bg-purple-500/20 text-purple-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-purple-500/30">
                      Zone: {c.matchedZoneName}
                    </span>
                  )}
                  {c.emirate && (
                    <span className="inline-block bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700">
                      {c.emirate}
                    </span>
                  )}
                  {c.businessStatus && c.businessStatus !== 'OPERATIONAL' && (
                    <span className="inline-block bg-red-900/40 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-800/50">
                      {c.businessStatus}
                    </span>
                  )}
                  {c.foundByTags && c.foundByTags.map(tag => (
                    <span key={tag} className="inline-block bg-indigo-900/40 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-800/50">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="space-y-1 mb-3 text-xs text-slate-400">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">{c.address}</span>
                  </div>
                  {c.phone && (
                    <div className="flex gap-2 items-center">
                      <Phone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex gap-2 items-center">
                      <Globe className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-[200px]">
                        {c.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    </div>
                  )}
                  {c.googleMapsUri && (
                    <div className="flex gap-2 items-center">
                      <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <a href={c.googleMapsUri} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline truncate max-w-[200px]">
                        View on Google Maps
                      </a>
                    </div>
                  )}
                  {c.openingHours && (
                    <div className="flex gap-2 items-start">
                      <Clock className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="text-green-500 font-medium">Opening Hours Available</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enrichment Section */}
                <div className="bg-black/30 rounded-lg p-3 border border-slate-800 mt-3">
                  {c.summary ? (
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tighter mb-1 font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" /> Company Background
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-300">{c.summary}</p>
                    </div>
                  ) : c.enrichError ? (
                    <div>
                      <h5 className="text-[10px] font-bold text-red-500 uppercase tracking-tighter mb-1">Enrichment Failed</h5>
                      <p className="text-[11px] text-red-400">{c.enrichError}</p>
                    </div>
                  ) : c.website ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEnrich(c.id, c.website!, c.name); }}
                      disabled={c.enriching}
                      className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                    >
                      {c.enriching ? (
                        <>
                          <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                          Extracting website data...
                        </>
                      ) : (
                        <>
                          <Info className="w-3.5 h-3.5" /> Fetch Company Background
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic flex items-center justify-between">
                      No website available
                      <a 
                        href={`https://www.google.com/search?q=${encodeURIComponent(c.name + ' ' + c.address)}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline not-italic flex items-center gap-1 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Search Web <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Insights Section */}
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    {c.insights ? (
                      <div>
                        <div className="text-[10px] text-amber-500 uppercase tracking-tighter mb-1 font-bold flex items-center gap-1">
                          ✨ Web Context Extraction
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-300">{c.insights}</p>
                        {c.tags && c.tags.filter(t => !t.toLowerCase().startsWith('customer:')).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {c.tags
                              .filter(t => !t.toLowerCase().startsWith('customer:'))
                              .map((t, idx) => (
                              <span key={idx} className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onGetInsights(c.id, c.name, c.address); }}
                        disabled={c.insightsLoading}
                        className="text-[11px] font-medium text-amber-500 hover:text-amber-400 flex items-center gap-1 disabled:opacity-50"
                      >
                        {c.insightsLoading ? (
                          <>
                            <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                            Generating AI Intelligence...
                          </>
                        ) : (
                          <>
                            ✨ Get AI Intelligence
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          ))}
          
          {companies.length === 0 && !isSearching && (
            <div className="text-center text-slate-500 py-10 text-xs">
              No results to display.<br/>Define your search area and click search.
            </div>
          )}
        </div>
      </div>
      {tier1AddingCompany && (
        <AddTier1Modal
          company={tier1AddingCompany}
          onClose={() => setTier1AddingCompany(null)}
          onSuccess={(clientId) => {
            setTier1AddingCompany(null);
            alert('Saved! You can view it in the Tier 1 Watch list.');
            // Optional: navigate(`/tier1/${clientId}`)
          }}
        />
      )}
    </div>
  );
}
