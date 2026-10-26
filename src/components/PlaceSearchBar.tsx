import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2, Navigation, Layers, ChevronDown, Building2, Sparkles } from 'lucide-react';
import { UAE_INDUSTRIAL_REGIONS, PresetRegion } from '../lib/geo';

export interface PlaceSearchResult {
  id?: string;
  name: string;
  formattedAddress?: string;
  location: { lat: number; lng: number };
  viewport?: {
    low: { lat: number; lng: number };
    high: { lat: number; lng: number };
  } | null;
}

interface PlaceSearchBarProps {
  searchedPlace: PlaceSearchResult | null;
  onSelectPlace: (place: PlaceSearchResult | null) => void;
  radiusKm: number;
  onChangeRadius: (radius: number) => void;
  nearbySavedCount: number;
  onSearchBusinessesInRegion?: () => void;
  isSearchingBusinesses?: boolean;
}

const RADIUS_OPTIONS = [2, 5, 10, 15, 25];

export function PlaceSearchBar({
  searchedPlace,
  onSelectPlace,
  radiusKm,
  onChangeRadius,
  nearbySavedCount,
  onSearchBusinessesInRegion,
  isSearchingBusinesses = false,
}: PlaceSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showPresetsOnly, setShowPresetsOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch geocoded suggestions as user types
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('/api/geocode-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() })
        });

        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.places || []);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error('Failed to geocode place:', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleSelectPreset = (preset: PresetRegion) => {
    onSelectPlace({
      id: preset.name.toLowerCase().replace(/\s+/g, '-'),
      name: preset.name,
      formattedAddress: `${preset.name}, ${preset.emirate}, UAE`,
      location: { lat: preset.lat, lng: preset.lng }
    });
    setQuery('');
    setIsOpen(false);
  };

  const handleSelectSuggestion = (place: PlaceSearchResult) => {
    onSelectPlace(place);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelectPlace(null);
    setQuery('');
    setSuggestions([]);
  };

  const filteredPresets = query.trim()
    ? UAE_INDUSTRIAL_REGIONS.filter(
        p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.emirate.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase())
      )
    : UAE_INDUSTRIAL_REGIONS;

  return (
    <div ref={containerRef} className="relative z-30 w-full max-w-md">
      {/* If a place is selected, show active regional bar */}
      {searchedPlace ? (
        <div className="bg-[#12151a]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 transition-all">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-100 truncate">{searchedPlace.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold shrink-0">
                    Active Region
                  </span>
                </div>
                {searchedPlace.formattedAddress && (
                  <p className="text-[11px] text-slate-400 truncate max-w-xs">{searchedPlace.formattedAddress}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setIsOpen(true);
                  setShowPresetsOnly(true);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                title="Change searched place"
              >
                Change
              </button>
              <button
                onClick={handleClear}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-colors"
                title="Clear place search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Controls: Radius & Nearby Saved Customer Stats */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
            {/* Radius Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" /> Radius:
              </span>
              <div className="flex bg-[#0b0d10] p-0.5 rounded-lg border border-slate-800">
                {RADIUS_OPTIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => onChangeRadius(r)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                      radiusKm === r
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {r}km
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Clients Badge in this radius */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium text-[11px]">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  <strong className="font-bold text-white">{nearbySavedCount}</strong> Saved Pipeline {nearbySavedCount === 1 ? 'Customer' : 'Customers'}
                </span>
              </div>

              {onSearchBusinessesInRegion && (
                <button
                  onClick={onSearchBusinessesInRegion}
                  disabled={isSearchingBusinesses}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-medium text-[11px] transition-colors disabled:opacity-50"
                  title="Search business leads in this region"
                >
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span>{isSearchingBusinesses ? 'Searching...' : 'Find Leads Here'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Search Input when no place is active */
        <div className="bg-[#12151a]/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 flex flex-col transition-all">
          <div className="flex items-center px-2.5 py-1 gap-2">
            <Search className="w-4 h-4 text-cyan-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setIsOpen(true);
                setShowPresetsOnly(false);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search a place or region (e.g. Mussafah, JAFZA, Hamriyah, Al Quoz)..."
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {isLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
            {query && !isLoading && (
              <button
                onClick={() => setQuery('')}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                setIsOpen(!isOpen);
                setShowPresetsOnly(!isOpen);
              }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 shrink-0 transition-colors"
              title="Show popular UAE industrial hubs"
            >
              <Navigation className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">Hubs</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* Dropdown Suggestions & Industrial Presets */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#12151a] border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto custom-scrollbar z-50 animate-in fade-in-50 duration-150">
          {/* Real-time Google Places Search Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2 border-b border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>Map Search Places</span>
              </div>
              <div className="space-y-1 mt-1">
                {suggestions.map(place => (
                  <button
                    key={place.id || place.name}
                    onClick={() => handleSelectSuggestion(place)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 group"
                  >
                    <div className="w-6 h-6 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-100 group-hover:text-cyan-300 truncate">
                        {place.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {place.formattedAddress}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Select: Top UAE Industrial Regions */}
          <div className="p-2">
            <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-blue-400" />
                <span>Key UAE Industrial Hubs</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Click to focus & reveal saved clients</span>
            </div>
            <div className="space-y-1 mt-1">
              {filteredPresets.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => handleSelectPreset(preset)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 truncate">
                        {preset.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                        {preset.emirate}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{preset.description}</div>
                  </div>
                  <span className="text-[10px] font-semibold text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    Select →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
