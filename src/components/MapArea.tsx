import React, { useEffect, useState, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  Polygon,
  Polyline
} from '@vis.gl/react-google-maps';
import { CompanyResult } from '../types';
import { Client } from '../db';
import { calculateDistanceKm, createGeoCirclePoints } from '../lib/geo';
import { PlaceSearchBar, PlaceSearchResult } from './PlaceSearchBar';
import { NearbySavedCustomersTray } from './NearbySavedCustomersTray';
import { RouteStop, OptimizedRouteResult } from '../lib/routeOptimization';
import {
  MapPin,
  User,
  Phone,
  Globe,
  Building2,
  CheckCircle2,
  Navigation,
  Sparkles,
  Check,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

const API_KEY =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MapAreaProps {
  companies: CompanyResult[];
  onBoundsChange: (bounds: google.maps.LatLngBounds | null) => void;
  selectedCompanyId: string | null;
  onSelectCompany: (id: string) => void;
  pastSearches?: google.maps.LatLngLiteral[][];
  customPath: google.maps.LatLngLiteral[] | null;
  setCustomPath: (path: google.maps.LatLngLiteral[] | null) => void;
  // Pipeline Saved Customers props
  savedClients?: Client[];
  onOpenClientProfile?: (clientId: string) => void;
  searchedPlace?: PlaceSearchResult | null;
  setSearchedPlace?: (place: PlaceSearchResult | null) => void;
  searchRadiusKm?: number;
  setSearchRadiusKm?: (radius: number) => void;
  onSearchBusinessesInRegion?: () => void;
  isSearchingBusinesses?: boolean;
  // Route Optimization props
  routeStops?: RouteStop[];
  onToggleRouteStop?: (client: Client) => void;
  onAddAllRegionalToRoute?: () => void;
  optimizedRoute?: OptimizedRouteResult | null;
  onOpenRouteDrawer?: () => void;
  isRouteDrawerOpen?: boolean;
  // Unified toolbar & mobile props
  onOpenCustomerUpload?: () => void;
  mobileView?: 'map' | 'sidebar';
  onToggleMobileView?: () => void;
}

function MapController({
  onBoundsChange,
  customPath,
  searchedPlace,
  searchRadiusKm,
  optimizedRoute,
  onMapReady,
  onMapClick
}: {
  onBoundsChange: (bounds: google.maps.LatLngBounds | null) => void;
  customPath: google.maps.LatLngLiteral[] | null;
  searchedPlace?: PlaceSearchResult | null;
  searchRadiusKm?: number;
  optimizedRoute?: OptimizedRouteResult | null;
  onMapReady?: (map: google.maps.Map | null) => void;
  onMapClick?: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (onMapReady) onMapReady(map);

    const clickListener = map.addListener('click', () => {
      if (onMapClick) onMapClick();
    });

    return () => {
      google.maps.event.removeListener(clickListener);
    };
  }, [map, onMapReady, onMapClick]);

  // Pan and zoom when searchedPlace changes (if no route optimization is active)
  useEffect(() => {
    if (!map || !searchedPlace) return;
    if (optimizedRoute && optimizedRoute.polylinePath.length > 0) return;

    map.panTo(searchedPlace.location);

    const radius = searchRadiusKm || 5;
    let targetZoom = 13;
    if (radius <= 2) targetZoom = 14;
    else if (radius <= 5) targetZoom = 13;
    else if (radius <= 10) targetZoom = 12;
    else if (radius <= 15) targetZoom = 11;
    else targetZoom = 10;

    map.setZoom(targetZoom);
  }, [map, searchedPlace, searchRadiusKm, optimizedRoute]);

  // Fit bounds when optimized route is generated
  useEffect(() => {
    if (!map || !optimizedRoute || !optimizedRoute.polylinePath || optimizedRoute.polylinePath.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    optimizedRoute.polylinePath.forEach(pt => bounds.extend(pt));
    optimizedRoute.orderedStops.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));

    map.fitBounds(bounds, {
      top: 90,
      right: 90,
      bottom: 90,
      left: 90
    });
  }, [map, optimizedRoute]);

  // Standard bounds update
  useEffect(() => {
    if (!map) return;
    if (customPath) return;

    let timeout: ReturnType<typeof setTimeout>;

    const updateBounds = () => {
      onBoundsChange(map.getBounds() || null);
    };

    const listener = map.addListener('bounds_changed', () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateBounds, 300);
    });

    if (map.getBounds()) {
      updateBounds();
    } else {
      google.maps.event.addListenerOnce(map, 'tilesloaded', updateBounds);
    }

    return () => {
      google.maps.event.removeListener(listener);
      clearTimeout(timeout);
    };
  }, [map, onBoundsChange, customPath]);

  return null;
}

export function MapArea({
  companies,
  onBoundsChange,
  selectedCompanyId,
  onSelectCompany,
  pastSearches = [],
  customPath,
  setCustomPath,
  savedClients = [],
  onOpenClientProfile,
  searchedPlace = null,
  setSearchedPlace,
  searchRadiusKm = 5,
  setSearchRadiusKm,
  onSearchBusinessesInRegion,
  isSearchingBusinesses = false,
  routeStops = [],
  onToggleRouteStop,
  onAddAllRegionalToRoute,
  optimizedRoute = null,
  onOpenRouteDrawer,
  isRouteDrawerOpen = false,
  onOpenCustomerUpload,
  mobileView,
  onToggleMobileView
}: MapAreaProps) {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  // State for active popup InfoWindow on saved client pin
  const [activeClientInfo, setActiveClientInfo] = useState<{
    client: Client;
    distance?: number;
  } | null>(null);

  // State for active popup on unsaved business lead
  const [activeCompanyInfo, setActiveCompanyInfo] = useState<CompanyResult | null>(null);

  // Compute radius circular polygon around searched place
  const regionalCirclePath = useMemo(() => {
    if (!searchedPlace) return null;
    return createGeoCirclePoints(searchedPlace.location, searchRadiusKm);
  }, [searchedPlace, searchRadiusKm]);

  // When regionalCirclePath changes and there's no custom drawn polygon, update bounds
  useEffect(() => {
    if (regionalCirclePath && !customPath && !optimizedRoute) {
      const boundsObj = new google.maps.LatLngBounds();
      regionalCirclePath.forEach(pt => boundsObj.extend(pt));
      onBoundsChange(boundsObj);
    }
  }, [regionalCirclePath, customPath, optimizedRoute, onBoundsChange]);

  // Calculate nearby saved clients around searched region
  const nearbySavedClients = useMemo(() => {
    if (!searchedPlace) return [];

    return savedClients
      .filter(c => typeof c.lat === 'number' && typeof c.lng === 'number' && c.lat !== 0)
      .map(client => {
        const distance = calculateDistanceKm(
          searchedPlace.location.lat,
          searchedPlace.location.lng,
          client.lat!,
          client.lng!
        );
        return { client, distance };
      })
      .filter(item => item.distance <= searchRadiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [savedClients, searchedPlace, searchRadiusKm]);

  const nearbySavedClientIds = useMemo(() => {
    return new Set(nearbySavedClients.map(i => i.client.id));
  }, [nearbySavedClients]);

  // Map of client ID to route waypoint index
  const routeStopOrderMap = useMemo(() => {
    const orderMap = new window.Map<string, number>();
    const stopsList = optimizedRoute ? optimizedRoute.orderedStops : routeStops;
    stopsList.forEach((s, idx) => {
      if (!orderMap.has(s.id)) {
        orderMap.set(s.id, idx + 1);
      }
    });
    return orderMap;
  }, [optimizedRoute, routeStops]);

  // Handle Custom Area Polygon Actions
  const handleAddCustomArea = () => {
    if (!mapInstance) return;
    const center = mapInstance.getCenter();
    if (!center) return;

    const spanLat = 0.02;
    const spanLng = 0.02;

    const newPath = [
      { lat: center.lat() + spanLat, lng: center.lng() - spanLng },
      { lat: center.lat() + spanLat, lng: center.lng() + spanLng },
      { lat: center.lat() - spanLat, lng: center.lng() + spanLng },
      { lat: center.lat() - spanLat, lng: center.lng() - spanLng }
    ];

    setCustomPath(newPath);

    const boundsObj = new google.maps.LatLngBounds();
    newPath.forEach(pt => boundsObj.extend(pt));
    onBoundsChange(boundsObj);
  };

  const handleClearCustomArea = () => {
    setCustomPath(null);
    if (mapInstance) {
      onBoundsChange(mapInstance.getBounds() || null);
    }
  };

  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center h-full bg-[#15181e] p-8">
        <div className="max-w-md text-center text-slate-300">
          <h2 className="text-xl font-bold mb-4 text-slate-100">Google Maps API Key Required</h2>
        </div>
      </div>
    );
  }

  const handleSelectSavedClient = (client: Client) => {
    let distance: number | undefined = undefined;
    if (searchedPlace && client.lat && client.lng) {
      distance = calculateDistanceKm(
        searchedPlace.location.lat,
        searchedPlace.location.lng,
        client.lat,
        client.lng
      );
    }
    setActiveClientInfo({ client, distance });
    setActiveCompanyInfo(null);
  };

  return (
    <APIProvider apiKey={API_KEY} version="quarterly">
      <div className="relative w-full h-full">
        {/* UNIFIED TOP CONTROL BAR (RESPONSIVE, ZERO-OVERLAP FLEX CONTAINER) */}
        <div className="absolute top-3 inset-x-3 md:top-4 md:inset-x-4 z-20 pointer-events-none flex flex-wrap items-start justify-between gap-2.5">
          {/* Left: Place Search Bar */}
          <div className="pointer-events-auto flex-1 min-w-[240px] max-w-md shadow-2xl">
            <PlaceSearchBar
              searchedPlace={searchedPlace || null}
              onSelectPlace={place => {
                if (setSearchedPlace) {
                  setSearchedPlace(place);
                }
                setActiveClientInfo(null);
                setActiveCompanyInfo(null);
              }}
              radiusKm={searchRadiusKm}
              onChangeRadius={r => {
                if (setSearchRadiusKm) {
                  setSearchRadiusKm(r);
                }
              }}
              nearbySavedCount={nearbySavedClients.length}
              onSearchBusinessesInRegion={onSearchBusinessesInRegion}
              isSearchingBusinesses={isSearchingBusinesses}
            />
          </div>

          {/* Right: Quick Action Controls Group */}
          <div className="pointer-events-auto flex items-center gap-2 flex-wrap ml-auto">
            {/* Draw / Clear Custom Area */}
            {!customPath ? (
              <button
                onClick={handleAddCustomArea}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#151921]/90 hover:bg-[#1c222d] text-blue-400 hover:text-blue-300 border border-slate-700/80 hover:border-blue-500/50 shadow-xl backdrop-blur-md text-xs font-semibold transition-all group"
                title="Draw custom search polygon"
              >
                <Layers className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Draw Area</span>
              </button>
            ) : (
              <button
                onClick={handleClearCustomArea}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/80 hover:bg-red-900/90 text-red-300 border border-red-500/50 shadow-xl backdrop-blur-md text-xs font-semibold transition-all"
                title="Clear custom drawn polygon"
              >
                <span>Clear Area</span>
              </button>
            )}

            {/* Route Optimizer Trigger */}
            {onOpenRouteDrawer && (
              <button
                onClick={() => {
                  setActiveClientInfo(null);
                  setActiveCompanyInfo(null);
                  onOpenRouteDrawer();
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xl backdrop-blur-md border ${
                  routeStops.length > 0
                    ? 'bg-gradient-to-r from-indigo-600/95 to-cyan-600/95 hover:from-indigo-600 hover:to-cyan-600 text-white border-indigo-400/60 shadow-indigo-500/25 ring-2 ring-indigo-400/30'
                    : 'bg-[#151921]/90 hover:bg-[#1c222d] text-slate-200 hover:text-white border-slate-700/80 hover:border-indigo-500/50'
                }`}
                title="Open Route Optimization Tool"
              >
                <Navigation className={`w-3.5 h-3.5 text-cyan-300 ${routeStops.length > 0 ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">Route</span>
                {routeStops.length > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-white text-indigo-950 text-[10px] font-black">
                    {routeStops.length}
                  </span>
                ) : (
                  <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                    Plan
                  </span>
                )}
              </button>
            )}

            {/* Upload Customer Excel */}
            {onOpenCustomerUpload && (
              <button
                onClick={onOpenCustomerUpload}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#151921]/90 hover:bg-[#1c222d] text-slate-200 hover:text-white border border-slate-700/80 hover:border-emerald-500/50 shadow-xl backdrop-blur-md text-xs font-semibold transition-all group"
                title="Upload customer list Excel file"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="hidden md:inline">Upload Excel</span>
                <span className="md:hidden text-xs">Excel</span>
              </button>
            )}

            {/* Mobile View Toggle */}
            {onToggleMobileView && (
              <button
                onClick={onToggleMobileView}
                className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-xl text-xs font-bold transition-all"
                title="Switch between Map & Leads List"
              >
                <span>{mobileView === 'sidebar' ? '🗺️ Map' : '📋 Leads'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Floating Nearby Saved Customers Tray (Positioned at bottom-left, collapsible) */}
        {searchedPlace && !isRouteDrawerOpen && (
          <NearbySavedCustomersTray
            searchedPlace={searchedPlace}
            radiusKm={searchRadiusKm}
            nearbyClients={nearbySavedClients}
            onOpenProfile={clientId => {
              setActiveClientInfo(null);
              setActiveCompanyInfo(null);
              if (onOpenClientProfile) {
                onOpenClientProfile(clientId);
              }
            }}
            onFocusClient={client => {
              handleSelectSavedClient(client);
            }}
            routeStopIds={new Set(routeStops.map(s => s.id))}
            onToggleRouteStop={onToggleRouteStop}
            onAddAllToRoute={onAddAllRegionalToRoute}
            onOpenRouteOptimizer={() => {
              setActiveClientInfo(null);
              setActiveCompanyInfo(null);
              if (onOpenRouteDrawer) onOpenRouteDrawer();
            }}
          />
        )}

        <Map
          defaultCenter={{ lat: 24.4539, lng: 54.3773 }} // Abu Dhabi
          defaultZoom={12}
          mapId="PROSPECTING_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full"
          disableDefaultUI={true}
        >
          <MapController
            onBoundsChange={onBoundsChange}
            customPath={customPath}
            searchedPlace={searchedPlace}
            searchRadiusKm={searchRadiusKm}
            optimizedRoute={optimizedRoute}
            onMapReady={setMapInstance}
            onMapClick={() => {
              setActiveClientInfo(null);
              setActiveCompanyInfo(null);
            }}
          />

          {/* Past Searches Polygon */}
          {pastSearches.map((path, idx) => (
            <Polygon
              key={`past-search-${idx}`}
              paths={path}
              editable={false}
              draggable={false}
              fillColor="#9ca3af"
              fillOpacity={0.15}
              strokeColor="#9ca3af"
              strokeWeight={1}
              strokeOpacity={0.5}
              zIndex={0}
            />
          ))}

          {/* Custom Drawn Polygon */}
          {customPath && (
            <Polygon
              paths={customPath}
              editable={true}
              draggable={true}
              onPathsChanged={paths => {
                if (paths && paths.length > 0) {
                  const newPath = paths[0].map(p => ({ lat: p.lat(), lng: p.lng() }));
                  setCustomPath(newPath);

                  const boundsObj = new google.maps.LatLngBounds();
                  newPath.forEach(pt => boundsObj.extend(pt));
                  onBoundsChange(boundsObj);
                }
              }}
              fillColor="#4285F4"
              fillOpacity={0.2}
              strokeColor="#4285F4"
              strokeWeight={2}
              zIndex={1}
            />
          )}

          {/* Regional Radius Polygon around Searched Place */}
          {regionalCirclePath && (
            <Polygon
              paths={regionalCirclePath}
              editable={false}
              draggable={false}
              fillColor="#10b981"
              fillOpacity={0.08}
              strokeColor="#10b981"
              strokeWeight={2}
              strokeOpacity={0.8}
              zIndex={1}
            />
          )}

          {/* OPTIMIZED DRIVING ROUTE PATH LINE */}
          {optimizedRoute && optimizedRoute.polylinePath.length > 0 && (
            <Polyline
              path={optimizedRoute.polylinePath}
              strokeColor="#6366f1"
              strokeWeight={5}
              strokeOpacity={0.9}
              zIndex={6}
            />
          )}

          {/* Searched Place Center Pin / Beacon */}
          {searchedPlace && (
            <AdvancedMarker
              position={searchedPlace.location}
              title={`Searched Place: ${searchedPlace.name}`}
              zIndex={10}
            >
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-600/90 text-white rounded-full text-xs font-bold shadow-lg border border-cyan-300/40 backdrop-blur-sm -translate-y-1">
                  <Navigation className="w-3.5 h-3.5 animate-pulse" />
                  <span>{searchedPlace.name}</span>
                </div>
                <div className="w-4 h-4 bg-cyan-400 rounded-full border-2 border-white shadow-md animate-ping absolute -bottom-1" />
                <div className="w-3.5 h-3.5 bg-cyan-500 rounded-full border-2 border-white shadow-md relative z-10" />
              </div>
            </AdvancedMarker>
          )}

          {/* SAVED PIPELINE CUSTOMERS ON MAP */}
          {savedClients
            .filter(c => typeof c.lat === 'number' && typeof c.lng === 'number' && c.lat !== 0)
            .map(client => {
              const isNearby = nearbySavedClientIds.has(client.id);
              const waypointNumber = routeStopOrderMap.get(client.id);

              return (
                <AdvancedMarker
                  key={`saved-${client.id}`}
                  position={{ lat: client.lat!, lng: client.lng! }}
                  title={`${client.name} (Pipeline Customer)`}
                  zIndex={waypointNumber ? 12 : isNearby ? 8 : 4}
                  onClick={() => handleSelectSavedClient(client)}
                >
                  <div className="relative cursor-pointer group">
                    {/* If client is part of active route, show numbered badge marker */}
                    {waypointNumber ? (
                      <div className="flex flex-col items-center -translate-y-2">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shadow-xl border-2 border-white ${
                            waypointNumber === 1
                              ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-400/40'
                              : 'bg-indigo-600 text-white ring-2 ring-indigo-400/50'
                          }`}
                        >
                          {waypointNumber}
                        </div>
                        <div className="w-1.5 h-2 bg-slate-900 mx-auto" />
                      </div>
                    ) : (
                      <>
                        <Pin
                          background={isNearby ? '#059669' : '#10b981'}
                          glyphColor="#ffffff"
                          borderColor={isNearby ? '#022c22' : '#064e3b'}
                          scale={isNearby ? 1.25 : 1.05}
                        />
                        {isNearby && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3 pointer-events-none">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}

          {/* Business Lead Search Results */}
          {companies.map(c => (
            <AdvancedMarker
              key={c.id}
              position={{ lat: c.location.latitude, lng: c.location.longitude }}
              title={c.name}
              zIndex={selectedCompanyId === c.id ? 7 : 3}
              onClick={() => {
                onSelectCompany(c.id);
                setActiveCompanyInfo(c);
                setActiveClientInfo(null);
              }}
            >
              <Pin
                background={
                  selectedCompanyId === c.id
                    ? '#3b82f6'
                    : c.isExistingCustomer
                    ? '#059669'
                    : '#ef4444'
                }
                glyphColor="#fff"
                borderColor={
                  selectedCompanyId === c.id
                    ? '#1d4ed8'
                    : c.isExistingCustomer
                    ? '#064e3b'
                    : '#b91c1c'
                }
                scale={selectedCompanyId === c.id ? 1.2 : 0.95}
              />
            </AdvancedMarker>
          ))}

          {/* INFO WINDOW FOR SAVED PIPELINE CLIENT */}
          {activeClientInfo && activeClientInfo.client.lat && activeClientInfo.client.lng && (
            <InfoWindow
              position={{
                lat: activeClientInfo.client.lat,
                lng: activeClientInfo.client.lng
              }}
              onCloseClick={() => setActiveClientInfo(null)}
            >
              <div className="p-3 bg-[#12151a] text-slate-200 rounded-xl min-w-[260px] max-w-[320px] flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 mb-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Pipeline Customer
                    </span>
                    <h3 className="font-bold text-sm text-slate-100 leading-tight">
                      {activeClientInfo.client.name}
                    </h3>
                  </div>
                  {activeClientInfo.distance !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                      {activeClientInfo.distance} km
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                    {activeClientInfo.client.status}
                  </span>
                  <span>•</span>
                  <span>Tier {activeClientInfo.client.tier}</span>
                  <span>•</span>
                  <span className="truncate max-w-[120px]">
                    {activeClientInfo.client.category || 'Business'}
                  </span>
                </div>

                {activeClientInfo.client.address && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{activeClientInfo.client.address}</span>
                  </div>
                )}

                {activeClientInfo.client.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <a
                      href={`tel:${activeClientInfo.client.phone.replace(/[^0-9+]/g, '')}`}
                      className="hover:text-emerald-400 transition-colors"
                    >
                      {activeClientInfo.client.phone}
                    </a>
                  </div>
                )}

                {/* Actions: View Profile & Toggle Route */}
                <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (onOpenClientProfile) {
                          onOpenClientProfile(activeClientInfo.client.id);
                          setActiveClientInfo(null);
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Open Full Profile</span>
                    </button>

                    {onToggleRouteStop && (
                      <button
                        onClick={() => {
                          onToggleRouteStop(activeClientInfo.client);
                        }}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                          routeStopOrderMap.has(activeClientInfo.client.id)
                            ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:bg-red-500/20 hover:text-red-300'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                        }`}
                        title={
                          routeStopOrderMap.has(activeClientInfo.client.id)
                            ? 'Remove stop from route'
                            : 'Add stop to route optimizer'
                        }
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>
                          {routeStopOrderMap.has(activeClientInfo.client.id)
                            ? `Stop #${routeStopOrderMap.get(activeClientInfo.client.id)}`
                            : '+ Route'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* INFO WINDOW FOR SEARCH BUSINESS LEAD RESULT */}
          {activeCompanyInfo && (
            <InfoWindow
              position={{
                lat: activeCompanyInfo.location.latitude,
                lng: activeCompanyInfo.location.longitude
              }}
              onCloseClick={() => setActiveCompanyInfo(null)}
            >
              <div className="p-3 bg-[#12151a] text-slate-200 rounded-xl min-w-[240px] max-w-[300px] flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-block mb-1">
                      {activeCompanyInfo.category || 'Lead'}
                    </span>
                    <h3 className="font-bold text-xs text-slate-100 leading-tight">
                      {activeCompanyInfo.name}
                    </h3>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 line-clamp-2">
                  {activeCompanyInfo.address}
                </div>

                {activeCompanyInfo.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{activeCompanyInfo.phone}</span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Selected in Sidebar</span>
                  {activeCompanyInfo.website && (
                    <a
                      href={activeCompanyInfo.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" /> Website
                    </a>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
