import { apiFetch } from '../lib/api';
import { AgentPanel, UiAction } from './AgentPanel';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { MapArea } from './MapArea';
import { ResultsSidebar } from './ResultsSidebar';
import { CustomerExcelUploadModal } from './CustomerExcelUploadModal';
import { ClientProfileView } from './ClientProfileView';
import { PlaceSearchResult } from './PlaceSearchBar';
import { RouteOptimizerDrawer } from './RouteOptimizerDrawer';
import { RouteStop, OptimizedRouteResult } from '../lib/routeOptimization';
import { CompanyResult, PolygonZone } from '../types';
import { db, useLiveQuery, Client } from '../db';
import { pointInPolygon, calculateDistanceKm } from '../lib/geo';
import { v4 as uuidv4 } from 'uuid';
import { checkDuplicate, saveCompanyToPipeline } from '../lib/pipeline';
import { FileSpreadsheet, Layers, Navigation } from 'lucide-react';

export function ProspectingView() {
  const [bounds, setBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [customPath, setCustomPath] = useState<google.maps.LatLngLiteral[] | null>(null);
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  // Place search and regional saved clients state
  const [searchedPlace, setSearchedPlace] = useState<PlaceSearchResult | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(5);
  const [selectedProfileClientId, setSelectedProfileClientId] = useState<string | null>(null);

  // Route Optimization State
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRouteResult | null>(null);
  const [isRouteDrawerOpen, setIsRouteDrawerOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'sidebar'>('map');

  // Load saved clients from pipeline
  const savedClients = useLiveQuery(
    async () => {
      const all = await db.clients.toArray();
      return all.filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
    },
    []
  ) || [];

  // Calculate nearby saved clients around active searched place
  const nearbySavedClients = useMemo(() => {
    if (!searchedPlace || !savedClients) return [];
    return savedClients
      .filter(c => typeof c.lat === 'number' && typeof c.lng === 'number' && c.lat !== 0)
      .map(client => ({
        client,
        distance: calculateDistanceKm(
          searchedPlace.location.lat,
          searchedPlace.location.lng,
          client.lat!,
          client.lng!
        )
      }))
      .filter(item => item.distance <= searchRadiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [searchedPlace, savedClients, searchRadiusKm]);

  // Route Stop Management Handlers
  const handleToggleRouteStop = (client: Client) => {
    setRouteStops(prev => {
      const exists = prev.some(s => s.id === client.id);
      if (exists) {
        return prev.filter(s => s.id !== client.id);
      }
      if (typeof client.lat !== 'number' || typeof client.lng !== 'number') return prev;
      const newStop: RouteStop = {
        id: client.id,
        name: client.name,
        address: client.address,
        lat: client.lat,
        lng: client.lng,
        category: client.category,
        phone: client.phone,
        status: client.status,
        tier: client.tier
      };
      return [...prev, newStop];
    });
    setOptimizedRoute(null);
  };

  const handleAddStop = (client: Client) => {
    if (typeof client.lat !== 'number' || typeof client.lng !== 'number') return;
    setRouteStops(prev => {
      if (prev.some(s => s.id === client.id)) return prev;
      return [
        ...prev,
        {
          id: client.id,
          name: client.name,
          address: client.address,
          lat: client.lat!,
          lng: client.lng!,
          category: client.category,
          phone: client.phone,
          status: client.status,
          tier: client.tier
        }
      ];
    });
    setOptimizedRoute(null);
  };

  const handleRemoveStop = (stopId: string) => {
    setRouteStops(prev => prev.filter(s => s.id !== stopId));
    setOptimizedRoute(null);
  };

  const handleClearRoute = () => {
    setRouteStops([]);
    setOptimizedRoute(null);
  };

  const handleReorderStops = (newStops: RouteStop[]) => {
    setRouteStops(newStops);
  };

  const handleAddAllRegionalToRoute = () => {
    const existingIds = new Set(routeStops.map(s => s.id));
    const newStops: RouteStop[] = [];
    nearbySavedClients.forEach(({ client }) => {
      if (!existingIds.has(client.id) && typeof client.lat === 'number' && typeof client.lng === 'number') {
        newStops.push({
          id: client.id,
          name: client.name,
          address: client.address,
          lat: client.lat!,
          lng: client.lng!,
          category: client.category,
          phone: client.phone,
          status: client.status,
          tier: client.tier
        });
      }
    });
    if (newStops.length > 0) {
      setRouteStops(prev => [...prev, ...newStops]);
      setOptimizedRoute(null);
      setIsRouteDrawerOpen(true);
    }
  };

  const navigate = useNavigate();

  /** The chat agent drives the screen: draw an area, show results, open a route. */
  const handleAgentAction = async (a: UiAction) => {
    switch (a.type) {
      case 'draw_area':
        setCustomPath(a.path);
        break;
      case 'focus_place':
        setSearchedPlace({ id: a.name.toLowerCase().replace(/\s+/g, '-'), name: a.name, location: { lat: a.lat, lng: a.lng } });
        break;
      case 'show_places':
        setCompanies(a.places.map((x) => ({
          id: x.placeId, name: x.name, address: x.address, location: { latitude: x.lat, longitude: x.lng },
          category: x.category || 'Other', website: x.website, region: x.region, businessStatus: 'OPERATIONAL',
        })));
        break;
      case 'show_nearby':
        setSearchedPlace({ id: 'agent-focus', name: 'Search centre', location: a.center });
        setSearchRadiusKm(Math.min(25, Math.max(2, Math.round(a.radiusKm))));
        break;
      case 'open_route': {
        const all = await db.clients.toArray();
        const stops: RouteStop[] = a.clientIds
          .map((id) => all.find((c: Client) => c.id === id))
          .filter((c: Client | undefined): c is Client => !!c && typeof c.lat === 'number' && typeof c.lng === 'number')
          .map((c: Client) => ({ id: c.id, name: c.name, address: c.address, lat: c.lat as number, lng: c.lng as number, category: c.category, phone: c.phone, status: c.status, tier: c.tier }));
        setRouteStops(stops);
        setOptimizedRoute(null);
        setIsRouteDrawerOpen(true);
        break;
      }
      case 'navigate':
        navigate(a.to);
        break;
    }
  };

  const handleFocusStop = (stop: RouteStop) => {
    const boundsObj = new google.maps.LatLngBounds();
    boundsObj.extend({ lat: stop.lat, lng: stop.lng });
    setBounds(boundsObj);
  };
  
  // Past searches are paths now
  const [pastSearches, setPastSearches] = useState<google.maps.LatLngLiteral[][]>([]);
  
  // Saved Zones
  const [savedZones, setSavedZones] = useState<PolygonZone[]>([]);
  const [reportZone, setReportZone] = useState<PolygonZone | null>(null);
  const [showCustomerUploadModal, setShowCustomerUploadModal] = useState(false);

  const loadSavedZones = async () => {
    try {
      const zones = (await db.searchZones.toArray()).map((z: any) => {
        if (z.name && z.name.includes('|||')) {
          const [name, tagsStr] = z.name.split('|||');
          return { ...z, name: name.trim(), tags: tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) };
        }
        return z;
      });
      setSavedZones(zones);
    } catch (err) {
      console.error("Error loading saved zones from DB:", err);
    }
  };

  useEffect(() => {
    loadSavedZones();
  }, []);


  
  const saveZone = async (name: string, tags: string[]) => {
    if (!customPath) return;
    const id = uuidv4();
    const encodedName = tags && tags.length > 0 ? `${name} ||| ${tags.join(',')}` : name;
    
    // For DB
    const dbZone: any = {
      id,
      name: encodedName,
      path: customPath,
      createdAt: new Date().toISOString()
    };
    
    // For UI
    const uiZone: PolygonZone = {
      id,
      name,
      path: customPath,
      createdAt: new Date().toISOString(),
      tags
    };

    try {
      await db.searchZones.add(dbZone);
      setSavedZones(prev => [...prev, uiZone]);

      // Auto-save the companies currently inside this drawn zone
      if (companies && companies.length > 0) {
        let savedCount = 0;
        const inZone = companies.filter(c => 
          c.location && pointInPolygon({ lat: c.location.latitude, lng: c.location.longitude }, customPath)
        );
        
        for (const c of inZone) {
          if (!c.isSaved) {
            const dedupe = await checkDuplicate(c);
            if (!dedupe.isDuplicate) {
              await saveCompanyToPipeline(c);
              c.isSaved = true; // Update local state so it shows as saved
              savedCount++;
            }
          }
        }
        if (savedCount > 0) {
          setCompanies([...companies]); // force re-render
          console.log(`Auto-saved ${savedCount} leads inside the new zone.`);
        }
      }

    } catch (err: any) {
      console.error("Error saving zone:", err);
      alert("Failed to save zone to database: " + (err.message || err));
    }
  };


  const loadZone = async (zone: PolygonZone) => {
    setCustomPath(zone.path);
    // compute bounds
    const boundsObj = new google.maps.LatLngBounds();
    zone.path.forEach(pt => boundsObj.extend(pt));
    setBounds(boundsObj);
    
    try {
      setIsSearching(true);
      const allClients = (await db.clients.toArray()).filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
      const inZone = allClients.filter((c: any) => 
        c.lat && c.lng && pointInPolygon({ lat: c.lat, lng: c.lng }, zone.path)
      );
      
      const mappedCompanies: CompanyResult[] = inZone.map((c: any) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        location: { latitude: c.lat, longitude: c.lng },
        category: c.category,
        phone: c.phone,
        website: c.website,
        status: c.status,
        tags: c.tags,
        tier: c.tier,
        isSaved: true,
      }));
      setCompanies(mappedCompanies);
    } catch (err) {
      console.error("Error fetching clients for map pins:", err);
    } finally {
      setIsSearching(false);
    }
  };
  
  
  const deleteZone = async (id: string) => {
    try {
      await db.searchZones.delete(id);
      setSavedZones(prev => prev.filter(z => z.id !== id));
    } catch (err) {
      console.error("Error deleting zone:", err);
      alert("Failed to delete zone from database.");
    }
  }


  const handleBoundsChange = useCallback((newBounds: google.maps.LatLngBounds | null) => {
    setBounds(newBounds);
  }, []);

  const handleClearRect = () => {
    window.dispatchEvent(new Event('clear-rectangle'));
    setCustomPath(null);
  };

  const handleSearch = async (queries: string[]) => {
    if (!bounds) return;
    setIsSearching(true);
    setCompanies([]);
    setSelectedCompanyId(null);
    
    // Add to past searches if using customPath
    if (customPath) {
      setPastSearches(prev => [...prev, customPath]);
    }

    let allResults: CompanyResult[] = [];
    
    try {
      const queriesToRun = queries.length > 0 ? queries : ["business"];
      
      for (const q of queriesToRun) {
        let nextPageToken: string | undefined = undefined;
        let pagesFetched = 0;
        const MAX_PAGES = 10; // ~200 results
        
        do {
          const reqBody: any = {
            textQuery: q,
            locationRestriction: {
              rectangle: {
                low: {
                  latitude: bounds.getSouthWest().lat(),
                  longitude: bounds.getSouthWest().lng()
                },
                high: {
                  latitude: bounds.getNorthEast().lat(),
                  longitude: bounds.getNorthEast().lng()
                }
              }
            }
          };

          if (nextPageToken) {
             reqBody.pageToken = nextPageToken;
          }

          const res = await apiFetch('/api/places-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
          });

          if (!res.ok) {
            console.error('Failed to search for query:', q);
            break;
          }

          const data = await res.json();
          
          let newCompanies = (data.places || []).map((p: any) => ({
            id: p.id,
            name: p.displayName?.text || 'Unknown',
            address: p.formattedAddress || 'No address',
            location: {
              latitude: p.location?.latitude || 0,
              longitude: p.location?.longitude || 0
            },
            category: p.primaryTypeDisplayName?.text || 'Business',
            rating: p.rating,
            phone: p.internationalPhoneNumber || p.nationalPhoneNumber,
            website: p.websiteUri,
            status: p.businessStatus,
            businessStatus: p.businessStatus,
            googleMapsUri: p.googleMapsUri,
            foundByTags: [q]
          }));
          
          // Filter by polygon if customPath is set
          if (customPath && customPath.length >= 3) {
             newCompanies = newCompanies.filter((c: CompanyResult) => 
                pointInPolygon({ lat: c.location.latitude, lng: c.location.longitude }, customPath)
             );
          }

          // Merge and keep track of tags
          for (const nc of newCompanies) {
            const existingIdx = allResults.findIndex(r => r.id === nc.id);
            if (existingIdx !== -1) {
              if (!allResults[existingIdx].foundByTags?.includes(q)) {
                allResults[existingIdx].foundByTags = [...(allResults[existingIdx].foundByTags || []), q];
              }
            } else {
              allResults.push(nc);
            }
          }

          nextPageToken = data.nextPageToken;
          pagesFetched++;
          
          if (nextPageToken) {
            await new Promise(r => setTimeout(r, 2000));
          }
          
        } while (nextPageToken && pagesFetched < MAX_PAGES);
      }

      setCompanies(allResults);
      
    } catch (err) {
      console.error(err);
      alert("Search failed. Ensure your API key has Places API (New) enabled.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnrich = async (companyId: string, website: string, name: string) => {
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, enriching: true, enrichError: undefined } : c));
    try {
      const res = await apiFetch('/api/enrich-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUri: website, companyName: name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, summary: data.summary, tags: data.tags || [], category: data.category || 'Other', tier: data.tier || 4, enriching: false } : c));
    } catch (err: any) {
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, enrichError: err.message, enriching: false } : c));
    }
  };

  const handleGetInsights = async (companyId: string, name: string, address: string) => {
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, insightsLoading: true } : c));
    try {
      const allClients = (await db.clients.toArray()).filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
      const existingTagsSet = new Set<string>();
      allClients.forEach((c: any) => {
        if (c.tags) {
          c.tags.forEach((t: string) => existingTagsSet.add(t));
        }
      });
      const existingTags = Array.from(existingTagsSet);

      const res = await apiFetch('/api/company-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name, address, existingTags })
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Failed');

      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, insights: data.insights, tags: data.tags, insightsLoading: false } : c));
    } catch (err) {
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, insights: "Failed to load insights.", insightsLoading: false } : c));
    }
  };

  const handleClearPastSearches = () => {
    setPastSearches([]);
  };

  return (
    <div className="flex w-full h-[calc(100vh-64px)] overflow-hidden relative">
      {/* SIDEBAR: Responsively toggleable on mobile */}
      <div className={`w-full md:w-96 flex-shrink-0 border-r border-slate-800 bg-[#12151a] overflow-y-auto z-10 custom-scrollbar shadow-2xl relative ${
        mobileView === 'sidebar' ? 'block' : 'hidden md:block'
      }`}>
        {/* Mobile-only header to return to map */}
        <div className="md:hidden p-3 bg-[#181d25] border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Prospecting & Search Filters</span>
          <button
            onClick={() => setMobileView('map')}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
          >
            🗺️ Back to Map
          </button>
        </div>

        <ResultsSidebar 
          bounds={bounds}
          customPath={customPath}
          onSearch={handleSearch} 
          isSearching={isSearching}
          companies={companies}
          onClearRect={handleClearRect}
          onEnrich={handleEnrich}
          onGetInsights={handleGetInsights}
          onClearPastSearches={handleClearPastSearches}
          hasPastSearches={pastSearches.length > 0}
          savedZones={savedZones}
          onSaveZone={saveZone}
          onLoadZone={loadZone}
          onDeleteZone={deleteZone}
          onGenerateReport={setReportZone}
          onOpenCustomerUpload={() => setShowCustomerUploadModal(true)}
          searchedPlace={searchedPlace}
          onSelectPlace={setSearchedPlace}
          radiusKm={searchRadiusKm}
          onChangeRadius={setSearchRadiusKm}
          nearbySavedClients={nearbySavedClients}
          onOpenClientProfile={(clientId) => setSelectedProfileClientId(clientId)}
          routeStopIds={new Set(routeStops.map(s => s.id))}
          onToggleRouteStop={handleToggleRouteStop}
          onOpenRouteOptimizer={() => setIsRouteDrawerOpen(true)}
        />
      </div>
      
      <AgentPanel 
        bounds={bounds} 
        customPath={customPath} 
        searchedPlace={searchedPlace}
        onUiAction={handleAgentAction}
        onRefreshDB={() => {
           // Basic refresh for saved zones
           db.searchZones.toArray().then((zones: any) => {
             const decoded = zones.map((z: any) => {
                if (z.name && z.name.includes('|||')) {
                  const [name, tagsStr] = z.name.split('|||');
                  return { ...z, name: name.trim(), tags: tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean) };
                }
                return z;
             });
             setSavedZones(decoded);
           });
        }}
        isHidden={isRouteDrawerOpen || !!selectedProfileClientId || (mobileView === 'sidebar')}
      />

      {/* MAP CONTAINER: Fullscreen on mobile when viewing map */}
      <div className={`flex-1 relative bg-[#0b0d10] ${
        mobileView === 'map' ? 'block' : 'hidden md:block'
      }`}>
        <MapArea 
          companies={companies} 
          onBoundsChange={handleBoundsChange}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={setSelectedCompanyId}
          pastSearches={pastSearches}
          customPath={customPath}
          setCustomPath={setCustomPath}
          savedClients={savedClients}
          onOpenClientProfile={(clientId) => setSelectedProfileClientId(clientId)}
          searchedPlace={searchedPlace}
          setSearchedPlace={setSearchedPlace}
          searchRadiusKm={searchRadiusKm}
          setSearchRadiusKm={setSearchRadiusKm}
          onSearchBusinessesInRegion={() => handleSearch([])}
          isSearchingBusinesses={isSearching}
          routeStops={routeStops}
          onToggleRouteStop={handleToggleRouteStop}
          onAddAllRegionalToRoute={handleAddAllRegionalToRoute}
          optimizedRoute={optimizedRoute}
          onOpenRouteDrawer={() => setIsRouteDrawerOpen(true)}
          isRouteDrawerOpen={isRouteDrawerOpen}
          onOpenCustomerUpload={() => setShowCustomerUploadModal(true)}
          mobileView={mobileView}
          onToggleMobileView={() => setMobileView(prev => prev === 'map' ? 'sidebar' : 'map')}
        />
      </div>
      {reportZone && <ZoneReportModal zone={reportZone} onClose={() => setReportZone(null)} />}
      
      {showCustomerUploadModal && (
        <CustomerExcelUploadModal 
          isOpen={showCustomerUploadModal}
          onClose={() => setShowCustomerUploadModal(false)}
          savedZones={savedZones}
          onSitesDiscovered={(newSites) => {
            setCompanies(prev => {
              const prevMap = new Map(prev.map(p => [p.id, p]));
              newSites.forEach(s => prevMap.set(s.id, s));
              return Array.from(prevMap.values());
            });
          }}
          onRefreshZones={loadSavedZones}
        />
      )}

      {/* ROUTE OPTIMIZER DRAWER (RESPONSIVE & MOBILE FRIENDLY) */}
      <RouteOptimizerDrawer
        isOpen={isRouteDrawerOpen}
        onClose={() => setIsRouteDrawerOpen(false)}
        selectedStops={routeStops}
        onRemoveStop={handleRemoveStop}
        onAddStop={handleAddStop}
        onClearRoute={handleClearRoute}
        onReorderStops={handleReorderStops}
        optimizedResult={optimizedRoute}
        setOptimizedResult={setOptimizedRoute}
        allSavedClients={savedClients}
        onOpenProfile={(clientId) => setSelectedProfileClientId(clientId)}
        onFocusStop={handleFocusStop}
        nearbyRegionalClients={nearbySavedClients.map(i => i.client)}
      />

      {/* POPUP WINDOW LIKE IN PIPELINE FOR CUSTOMER PROFILE */}
      {selectedProfileClientId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedProfileClientId(null)} 
          />
          <div className="relative w-[95vw] md:w-[85vw] lg:w-[1050px] max-w-full h-full bg-[#0c0e12] shadow-2xl animate-in slide-in-from-right-8 duration-300 flex flex-col border-l border-slate-800">
            <ClientProfileView 
              clientId={selectedProfileClientId} 
              onClose={() => setSelectedProfileClientId(null)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}


function ZoneReportModal({ zone, onClose }: { zone: PolygonZone, onClose: () => void }) {
  const [clientsInZone, setClientsInZone] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClients() {
      try {
        const allClients = (await db.clients.toArray()).filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
        const inZone = allClients.filter((c: any) => 
          c.lat && c.lng && pointInPolygon({ lat: c.lat, lng: c.lng }, zone.path)
        );
        setClientsInZone(inZone);
      } catch (err) {
        console.error("Error fetching clients for report:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, [zone]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111419] border border-slate-700 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-[#161a22]">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Zone Report: {zone.name}</h2>
            <p className="text-sm text-slate-400 mt-1">Saved Clients located within this defined area</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full p-2">✕</button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 bg-[#0b0d10]">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading clients...</div>
          ) : clientsInZone.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-lg mb-2">No saved clients found in this zone.</p>
              <p className="text-sm">Run a search and save prospects to see them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientsInZone.map(c => (
                <div key={c.id} className="bg-[#161a22] p-4 rounded-lg border border-slate-700 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-200 text-lg">{c.name}</h3>
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 bg-slate-800 text-slate-300 rounded">{c.category || 'Other'}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2 flex-1 line-clamp-2">{c.address}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(c.tags || []).slice(0, 4).map((t: string) => (
                      <span key={t} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                    {(c.tags && c.tags.length > 4) && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">+{c.tags.length - 4}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-[#161a22] flex justify-between items-center text-sm text-slate-400">
          <span>Total found: <strong>{clientsInZone.length}</strong></span>
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors">Close Report</button>
        </div>
      </div>
    </div>
  );
}
