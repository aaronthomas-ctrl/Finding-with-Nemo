import React, { useState } from 'react';
import {
  RouteStop,
  OptimizedRouteResult,
  getOptimizedRoute
} from '../lib/routeOptimization';
import { Client } from '../db';
import {
  Navigation,
  MapPin,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Clock,
  Car,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  ArrowUpDown,
  Search,
  Building2,
  Phone,
  User,
  Share2
} from 'lucide-react';

interface RouteOptimizerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStops: RouteStop[];
  onRemoveStop: (stopId: string) => void;
  onAddStop: (client: Client) => void;
  onClearRoute: () => void;
  onReorderStops: (newStops: RouteStop[]) => void;
  optimizedResult: OptimizedRouteResult | null;
  setOptimizedResult: (res: OptimizedRouteResult | null) => void;
  allSavedClients: Client[];
  onOpenProfile: (clientId: string) => void;
  onFocusStop: (stop: RouteStop) => void;
  nearbyRegionalClients?: Client[];
}

export function RouteOptimizerDrawer({
  isOpen,
  onClose,
  selectedStops,
  onRemoveStop,
  onAddStop,
  onClearRoute,
  onReorderStops,
  optimizedResult,
  setOptimizedResult,
  allSavedClients,
  onOpenProfile,
  onFocusStop,
  nearbyRegionalClients = []
}: RouteOptimizerDrawerProps) {
  const [roundTrip, setRoundTrip] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [mobileHeight, setMobileHeight] = useState<'collapsed' | 'half' | 'full'>('half');
  const [activeTab, setActiveTab] = useState<'stops' | 'itinerary'>('stops');

  if (!isOpen) return null;

  const handleOptimize = async () => {
    if (selectedStops.length < 2) return;
    setIsOptimizing(true);
    try {
      const origin = selectedStops[0];
      const intermediates = selectedStops.slice(1);
      const result = await getOptimizedRoute(origin, intermediates, roundTrip);
      setOptimizedResult(result);
      setActiveTab('itinerary');
      if (mobileHeight === 'collapsed') {
        setMobileHeight('half');
      }
    } catch (err) {
      console.error('Route optimization error:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === selectedStops.length - 1)
    ) {
      return;
    }
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    const newStops = [...selectedStops];
    const [moved] = newStops.splice(index, 1);
    newStops.splice(newIdx, 0, moved);
    onReorderStops(newStops);
    // Invalidate cached result so user can re-optimize if manual order changed
    setOptimizedResult(null);
  };

  const handleAddAllRegional = () => {
    const existingIds = new Set(selectedStops.map(s => s.id));
    nearbyRegionalClients.forEach(c => {
      if (!existingIds.has(c.id) && typeof c.lat === 'number' && typeof c.lng === 'number') {
        onAddStop(c);
      }
    });
    setShowAddDropdown(false);
  };

  const filteredClientsToAdd = allSavedClients
    .filter(
      c =>
        typeof c.lat === 'number' &&
        typeof c.lng === 'number' &&
        c.lat !== 0 &&
        !selectedStops.some(s => s.id === c.id) &&
        (c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          (c.category || '').toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          (c.address || '').toLowerCase().includes(clientSearchQuery.toLowerCase()))
    )
    .slice(0, 8);

  const displayStops = optimizedResult ? optimizedResult.orderedStops : selectedStops;

  return (
    <>
      {/* Mobile Backdrop on full sheet */}
      <div
        className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Main Drawer Container */}
      <div
        className={`fixed z-50 transition-all duration-300 flex flex-col bg-[#12151a] border border-slate-700/80 shadow-2xl
          ${/* Mobile Styling (Bottom Sheet) */ ''}
          max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-3xl max-md:border-b-0
          ${
            mobileHeight === 'full'
              ? 'max-md:h-[90vh]'
              : mobileHeight === 'half'
              ? 'max-md:h-[62vh]'
              : 'max-md:h-[68px]'
          }
          ${/* Desktop Styling (Floating Right Panel) */ ''}
          md:top-20 md:right-6 md:w-[420px] md:h-[calc(100vh-100px)] md:rounded-2xl
        `}
      >
        {/* Mobile Pull / Swipe Handle */}
        <div
          onClick={() =>
            setMobileHeight(prev =>
              prev === 'collapsed' ? 'half' : prev === 'half' ? 'full' : 'half'
            )
          }
          className="md:hidden w-full flex flex-col items-center pt-2.5 pb-1 cursor-pointer select-none"
        >
          <div className="w-12 h-1.5 bg-slate-600 rounded-full mb-1" />
        </div>

        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 bg-[#161a22] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-100 truncate">Route Optimizer</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold shrink-0">
                  {selectedStops.length} {selectedStops.length === 1 ? 'Stop' : 'Stops'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Most efficient visiting path & turn-by-turn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop / Mobile Toggle */}
            <button
              onClick={() =>
                setMobileHeight(prev => (prev === 'full' ? 'half' : 'full'))
              }
              className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              title="Resize Drawer"
            >
              {mobileHeight === 'full' ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Close Route Optimizer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Quick Stats */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-[#12151a] shrink-0 text-xs">
          <div className="flex bg-[#0b0d10] p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('stops')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-all ${
                activeTab === 'stops'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Stops ({selectedStops.length})
            </button>
            <button
              onClick={() => setActiveTab('itinerary')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-all flex items-center gap-1 ${
                activeTab === 'itinerary'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Itinerary</span>
              {optimizedResult && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </button>
          </div>

          {selectedStops.length > 0 && (
            <button
              onClick={onClearRoute}
              className="text-[11px] text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* TAB 1: STOPS & SETUP */}
          {activeTab === 'stops' && (
            <div className="space-y-4">
              {/* Controls Header: Round-trip & Optimize Button */}
              <div className="bg-[#181d25] border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={roundTrip}
                      onChange={e => {
                        setRoundTrip(e.target.checked);
                        setOptimizedResult(null);
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 w-3.5 h-3.5"
                    />
                    <span>Round-trip (Return to Stop 1)</span>
                  </label>

                  <span className="text-[10px] text-slate-500">
                    {roundTrip ? 'Circular Loop' : 'Point-to-Point'}
                  </span>
                </div>

                {/* Primary Optimize Button */}
                <button
                  onClick={handleOptimize}
                  disabled={selectedStops.length < 2 || isOptimizing}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
                  <span>
                    {isOptimizing
                      ? 'Calculating Optimal Sequence...'
                      : selectedStops.length < 2
                      ? 'Add at least 2 stops to optimize'
                      : '⚡ Suggest Most Efficient Route'}
                  </span>
                </button>
              </div>

              {/* Add Customer Stop Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Customer Stops</span>
                  <div className="flex items-center gap-2">
                    {nearbyRegionalClients.length > 0 && (
                      <button
                        onClick={handleAddAllRegional}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                        title="Add all pipeline customers found around the searched place"
                      >
                        + Add All Regional ({nearbyRegionalClients.length})
                      </button>
                    )}
                    <button
                      onClick={() => setShowAddDropdown(!showAddDropdown)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Customer</span>
                    </button>
                  </div>
                </div>

                {/* Dropdown to pick customer */}
                {showAddDropdown && (
                  <div className="bg-[#181d25] border border-slate-700 rounded-xl p-2.5 shadow-xl space-y-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search pipeline customer by name or area..."
                        value={clientSearchQuery}
                        onChange={e => setClientSearchQuery(e.target.value)}
                        className="w-full bg-[#12151a] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1">
                      {filteredClientsToAdd.length === 0 ? (
                        <p className="text-[11px] text-slate-500 py-2 text-center">
                          No matching pipeline customers found with coordinates.
                        </p>
                      ) : (
                        filteredClientsToAdd.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              onAddStop(c);
                              setClientSearchQuery('');
                              setShowAddDropdown(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-between group"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 block truncate">
                                {c.name}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block">
                                {c.category || 'Business'} • {c.address}
                              </span>
                            </div>
                            <span className="text-[11px] text-indigo-400 font-semibold shrink-0 ml-2">
                              + Add
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Stops List */}
                {selectedStops.length === 0 ? (
                  <div className="bg-[#181d25]/60 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300">
                      No stops added to route yet
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Click any customer on the map or click <strong>"+ Add Customer"</strong> above to build your daily route.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStops.map((stop, index) => {
                      const isFirst = index === 0;
                      const isLast = index === selectedStops.length - 1;
                      return (
                        <div
                          key={stop.id}
                          className="bg-[#181d25] border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center gap-3 transition-colors group"
                        >
                          {/* Waypoint Number Badge */}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isFirst
                                ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/30'
                                : isLast && !roundTrip
                                ? 'bg-rose-500 text-white'
                                : 'bg-indigo-600 text-white'
                            }`}
                          >
                            {index + 1}
                          </div>

                          {/* Stop Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                                {stop.name}
                              </span>
                              {isFirst && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                                  Start
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {stop.address || stop.category || ''}
                            </div>
                          </div>

                          {/* Re-order & Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="flex flex-col">
                              <button
                                onClick={() => handleMoveStop(index, 'up')}
                                disabled={isFirst}
                                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                                title="Move earlier"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveStop(index, 'down')}
                                disabled={isLast}
                                className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                                title="Move later"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              onClick={() => onFocusStop(stop)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                              title="Locate on map"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onRemoveStop(stop.id)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                              title="Remove stop"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: OPTIMIZED ITINERARY & NAVIGATION */}
          {activeTab === 'itinerary' && (
            <div className="space-y-4">
              {!optimizedResult ? (
                <div className="bg-[#181d25]/60 border border-slate-800 rounded-xl p-6 text-center space-y-3">
                  <Car className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">
                    Route not optimized yet
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Click the button below to generate the most fuel-efficient sequence and turn-by-turn driving steps.
                  </p>
                  <button
                    onClick={handleOptimize}
                    disabled={selectedStops.length < 2 || isOptimizing}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs shadow-md transition-colors"
                  >
                    Optimize Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Metric Card */}
                  <div className="bg-gradient-to-r from-indigo-950/60 to-cyan-950/60 border border-indigo-700/50 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-indigo-300 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        Optimized Path
                      </span>
                      {optimizedResult.savingsKm && optimizedResult.savingsKm > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Saved ~{optimizedResult.savingsKm} km
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-[#12151a]/80 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-medium">Total Distance</div>
                        <div className="text-lg font-black text-slate-100">
                          {optimizedResult.totalDistanceKm} <span className="text-xs font-normal text-slate-400">km</span>
                        </div>
                      </div>
                      <div className="bg-[#12151a]/80 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-medium">Estimated Drive</div>
                        <div className="text-lg font-black text-slate-100">
                          {optimizedResult.totalDurationMinutes} <span className="text-xs font-normal text-slate-400">mins</span>
                        </div>
                      </div>
                    </div>

                    {/* Google Maps Mobile App GPS Navigation Link */}
                    <a
                      href={optimizedResult.googleMapsNavUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all text-center"
                      title="Open full route in Google Maps for live GPS turn-by-turn navigation"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Start GPS in Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                    </a>
                  </div>

                  {/* Step-by-Step Leg Itinerary */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
                      Turn-by-Turn Stop Itinerary
                    </h4>

                    {optimizedResult.orderedStops.map((stop, idx) => {
                      const leg = optimizedResult.legs[idx];
                      const isFirst = idx === 0;
                      const isLast = idx === optimizedResult.orderedStops.length - 1;

                      return (
                        <div key={`${stop.id}-${idx}`} className="space-y-2">
                          {/* Stop Card */}
                          <div className="bg-[#181d25] border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col gap-2 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                                    isFirst
                                      ? 'bg-emerald-500 text-slate-950 font-black'
                                      : isLast && !roundTrip
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-indigo-600 text-white'
                                  }`}
                                >
                                  {idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-bold text-xs text-slate-100 truncate">
                                    {stop.name}
                                  </h5>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {stop.address || stop.category || ''}
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() => onFocusStop(stop)}
                                className="p-1 text-slate-400 hover:text-cyan-400 transition-colors shrink-0"
                                title="Locate stop on map"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Stop Actions: Profile & Call */}
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                              {stop.id && !stop.id.includes('return') && (
                                <button
                                  onClick={() => onOpenProfile(stop.id)}
                                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                                >
                                  <User className="w-3 h-3" />
                                  <span>View Profile</span>
                                </button>
                              )}

                              {stop.phone && (
                                <a
                                  href={`tel:${stop.phone.replace(/[^0-9+]/g, '')}`}
                                  className="flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition-colors ml-auto"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{stop.phone}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Drive Connecting Leg */}
                          {leg && (
                            <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-cyan-400 font-mono">
                              <div className="h-4 w-px bg-slate-700" />
                              <span className="px-2 py-0.5 rounded-full bg-[#12151a] border border-slate-800 flex items-center gap-1.5 shadow-sm">
                                <Car className="w-3 h-3" />
                                <span>
                                  {leg.durationMinutes} mins ({leg.distanceKm} km)
                                </span>
                              </span>
                              <div className="h-4 w-px bg-slate-700" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
