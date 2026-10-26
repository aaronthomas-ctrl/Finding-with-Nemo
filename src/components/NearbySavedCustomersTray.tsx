import React, { useState } from 'react';
import { Users, ChevronUp, ChevronDown, User, MapPin, Phone, ExternalLink, Sparkles, Building2, Navigation, Check } from 'lucide-react';
import { Client } from '../db';
import { PlaceSearchResult } from './PlaceSearchBar';

interface NearbySavedCustomersTrayProps {
  searchedPlace: PlaceSearchResult;
  radiusKm: number;
  nearbyClients: Array<{ client: Client; distance: number }>;
  onOpenProfile: (clientId: string) => void;
  onFocusClient: (client: Client) => void;
  routeStopIds?: Set<string>;
  onToggleRouteStop?: (client: Client) => void;
  onAddAllToRoute?: () => void;
  onOpenRouteOptimizer?: () => void;
}

export function NearbySavedCustomersTray({
  searchedPlace,
  radiusKm,
  nearbyClients,
  onOpenProfile,
  onFocusClient,
  routeStopIds = new Set(),
  onToggleRouteStop,
  onAddAllToRoute,
  onOpenRouteOptimizer
}: NearbySavedCustomersTrayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Won': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Pursuing': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Quoted': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'New': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      case 'Parked': return 'bg-slate-600/20 text-slate-400 border-slate-600/30';
      case 'Lost': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-slate-700/20 text-slate-300 border-slate-700/30';
    }
  };

  // Collapsed Pill Button at bottom-left
  if (!isExpanded) {
    return (
      <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-20 pointer-events-auto">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#12151a]/95 hover:bg-[#181d26] border border-emerald-500/40 hover:border-emerald-500/70 rounded-full shadow-2xl text-xs font-bold text-slate-100 backdrop-blur-md transition-all hover:scale-105 group"
          title="Click to view saved customers in this region"
        >
          <div className="relative flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
            {nearbyClients.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <span className="truncate max-w-[180px] sm:max-w-[240px]">
            {nearbyClients.length} Saved {nearbyClients.length === 1 ? 'Customer' : 'Customers'} in {searchedPlace.name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
            {radiusKm}km
          </span>
          <ChevronUp className="w-4 h-4 text-emerald-400 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-20 flex flex-col items-start pointer-events-auto w-[calc(100vw-32px)] sm:w-96 max-w-sm transition-all animate-in slide-in-from-bottom-3 duration-200">
      {/* Tray Container */}
      <div className="w-full bg-[#12151a]/95 backdrop-blur-md border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Tray Header */}
        <div 
          onClick={() => setIsExpanded(false)}
          className="p-3 bg-gradient-to-r from-[#161a22] to-[#12151a] hover:from-[#1b202a] border-b border-slate-800/80 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-slate-100 truncate">
                  Saved Customers in Region
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {nearbyClients.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                Within {radiusKm} km of {searchedPlace.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Minimize panel"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Route Optimization Header Action */}
        {isExpanded && nearbyClients.length > 0 && onAddAllToRoute && (
          <div className="px-3 py-2 bg-[#181d25] border-b border-slate-800 flex items-center justify-between text-xs">
            <button
              onClick={onAddAllToRoute}
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors"
              title="Add all these regional clients into the Route Optimizer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Add All to Route Optimizer</span>
            </button>

            {onOpenRouteOptimizer && (
              <button
                onClick={onOpenRouteOptimizer}
                className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/40 font-semibold transition-colors"
              >
                Open Route →
              </button>
            )}
          </div>
        )}

        {/* Tray Body */}
        {isExpanded && (
          <div className="p-3 max-h-72 overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {nearbyClients.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No saved customers found nearby</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Expand the radius or search new businesses in {searchedPlace.name} to save them to your pipeline.
                </p>
              </div>
            ) : (
              nearbyClients.map(({ client, distance }) => {
                const isInRoute = routeStopIds.has(client.id);

                return (
                  <div 
                    key={client.id}
                    className={`bg-[#181d25] border ${
                      isInRoute ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-slate-800 hover:border-slate-700/80'
                    } rounded-xl p-3 flex flex-col gap-2 transition-all group shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-100 group-hover:text-emerald-300 transition-colors truncate">
                            {client.name}
                          </span>
                          {isInRoute && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold">
                              In Route
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span className="truncate">{client.category || 'Business'}</span>
                          <span>•</span>
                          <span className="text-slate-400">Tier {client.tier}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusColor(client.status)}`}>
                          {client.status}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                          {distance} km away
                        </span>
                      </div>
                    </div>

                    {client.address && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{client.address}</span>
                      </div>
                    )}

                    {/* Actions: View Profile, Route Toggle & Focus Map */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        onClick={() => onOpenProfile(client.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-sm"
                        title="Open full customer profile popup like in Pipeline"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Profile</span>
                      </button>

                      {onToggleRouteStop && (
                        <button
                          onClick={() => onToggleRouteStop(client)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border ${
                            isInRoute
                              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'
                              : 'bg-slate-800 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-300 border-slate-700 hover:border-indigo-500/40'
                          }`}
                          title={isInRoute ? 'Remove from Route' : 'Add to Route'}
                        >
                          {isInRoute ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Route</span>
                            </>
                          ) : (
                            <>
                              <Navigation className="w-3.5 h-3.5 text-indigo-400" />
                              <span>+ Route</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => onFocusClient(client)}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-slate-700 transition-colors"
                        title="Center on map"
                      >
                        Locate
                      </button>

                      {client.phone && (
                        <a
                          href={`tel:${client.phone.replace(/[^0-9+]/g, '')}`}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 rounded-lg border border-slate-700 transition-colors"
                          title={`Call ${client.phone}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
