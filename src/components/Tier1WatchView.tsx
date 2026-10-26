import React, { useState, useMemo } from 'react';
import { useLiveQuery } from '../db';
import { db } from '../db';
import { ShieldAlert, MapPin, Users, Building, Plus, Search, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { AddTier1Modal } from './AddTier1Modal';

export function Tier1WatchView() {
  const [search, setSearch] = useState('');
  const [emirateFilter, setEmirateFilter] = useState('');
  const [allocationFilter, setAllocationFilter] = useState('');
  const [activeProjectFilter, setActiveProjectFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  const allClients = useLiveQuery(() => db.clients.filter(c => c.tier === 1 && c.tier1?.isWatch === true).toArray(), []);
  const allProjects = useLiveQuery(() => db.tier1Projects.toArray(), []);
  const allEmployees = useLiveQuery(() => db.tier1Employees.toArray(), []);
  const allOpportunities = useLiveQuery(() => db.tier1Opportunities.toArray(), []);
  const allTransitions = useLiveQuery(() => db.tier1StageTransitions.toArray(), []);

  // Compute stats
  const now = new Date();
  
  // 1. Idle Clients (>14 days)
  const idleClients = allClients?.filter(c => {
    const diffDays = (now.getTime() - c.updatedAt.getTime()) / (1000 * 3600 * 24);
    return diffDays > 14;
  }) || [];

  // 2. New Project Clients (project createdAt < 30 days)
  const newProjectClients = allClients?.filter(c => {
    return allProjects?.some(p => p.clientId === c.id && (now.getTime() - p.createdAt.getTime()) / (1000 * 3600 * 24) <= 30);
  }) || [];

  // 3. Stalling Opportunities
  const stallingOpps = (allOpportunities || []).filter(opp => {
    // Just a basic check for stalling, e.g. age > 14 days for now, to avoid complex stage math
    const diffDays = (now.getTime() - opp.updatedAt.getTime()) / (1000 * 3600 * 24);
    return diffDays > 14 && opp.stage !== 'PO Issued' && opp.stage !== 'Lost/Cancelled';
  });

  const filteredClients = useMemo(() => {
    if (!allClients) return [];
    
    return allClients.filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (emirateFilter && c.tier1?.emirate.toLowerCase() !== emirateFilter.toLowerCase()) return false;
      if (allocationFilter && c.tier1?.allocationStatus !== allocationFilter) return false;
      
      if (activeProjectFilter) {
        const hasActive = allProjects?.some(p => p.clientId === c.id && p.status === 'Active');
        if (!hasActive) return false;
      }
      return true;
    });
  }, [allClients, search, emirateFilter, allocationFilter, activeProjectFilter, allProjects]);

  if (!allClients) {
    return <div className="p-8 text-slate-400 flex items-center justify-center h-full">Loading Tier 1 Watch...</div>;
  }

  // Dashboard stats
  const countOpen = allClients.filter(c => c.tier1?.allocationStatus === 'Open').length;
  const countOurs = allClients.filter(c => c.tier1?.allocationStatus === 'Allocated — Ours').length;
  const countOther = allClients.filter(c => c.tier1?.allocationStatus === 'Allocated — Other Distributor').length;
  const countDirect = allClients.filter(c => c.tier1?.allocationStatus === 'Allocated — Brand Direct').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c10] overflow-hidden">
      <div className="p-6 border-b border-slate-800 bg-[#111419] shrink-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 text-amber-500" />
              Tier 1 Watch
            </h1>
            <p className="text-sm text-slate-400 mt-1">Strategic account intelligence & process tracking</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-amber-950 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Manual
          </button>
        </div>

        {/* Dashboard summary row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1d23] border border-slate-700/50 p-4 rounded-xl">
            <div className="text-xs text-slate-400 mb-1 font-medium">Open</div>
            <div className="text-2xl font-bold text-green-400">{countOpen}</div>
          </div>
          <div className="bg-[#1a1d23] border border-slate-700/50 p-4 rounded-xl">
            <div className="text-xs text-slate-400 mb-1 font-medium">Allocated — Ours</div>
            <div className="text-2xl font-bold text-blue-400">{countOurs}</div>
          </div>
          <div className="bg-[#1a1d23] border border-slate-700/50 p-4 rounded-xl">
            <div className="text-xs text-slate-400 mb-1 font-medium">Allocated — Other</div>
            <div className="text-2xl font-bold text-orange-400">{countOther}</div>
          </div>
          <div className="bg-[#1a1d23] border border-slate-700/50 p-4 rounded-xl">
            <div className="text-xs text-slate-400 mb-1 font-medium">Allocated — Direct</div>
            <div className="text-2xl font-bold text-purple-400">{countDirect}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#1a1d23] border border-slate-700/50 p-3 rounded-xl flex flex-col h-32">
            <div className="text-xs font-semibold text-amber-500 mb-2 uppercase tracking-wider">Stalling Opportunities</div>
            <div className="overflow-y-auto flex-1 custom-scrollbar text-xs text-slate-300">
              {stallingOpps.length > 0 ? stallingOpps.map(o => (
                <div key={o.id} className="truncate pb-1">{o.productLine} • {o.stage}</div>
              )) : <span className="text-slate-500">None</span>}
            </div>
          </div>
          <div className="bg-[#1a1d23] border border-slate-700/50 p-3 rounded-xl flex flex-col h-32">
            <div className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider">New Projects (30d)</div>
            <div className="overflow-y-auto flex-1 custom-scrollbar text-xs text-slate-300">
              {newProjectClients.length > 0 ? newProjectClients.map(c => (
                <div key={c.id} className="truncate pb-1">{c.name}</div>
              )) : <span className="text-slate-500">None</span>}
            </div>
          </div>
          <div className="bg-[#1a1d23] border border-slate-700/50 p-3 rounded-xl flex flex-col h-32">
            <div className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wider">No Activity (14d+)</div>
            <div className="overflow-y-auto flex-1 custom-scrollbar text-xs text-slate-300">
              {idleClients.length > 0 ? idleClients.map(c => (
                <div key={c.id} className="truncate pb-1">{c.name}</div>
              )) : <span className="text-slate-500">None</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-3 items-center bg-[#1a1d23] p-2 rounded-lg border border-slate-700">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search Tier 1 clients..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-200 pl-9 pr-4 py-1.5 focus:outline-none"
            />
          </div>
          <select 
            value={emirateFilter}
            onChange={(e) => setEmirateFilter(e.target.value)}
            className="bg-[#111419] border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-300 focus:outline-none"
          >
            <option value="">All Emirates</option>
            <option value="Abu Dhabi">Abu Dhabi</option>
            <option value="Dubai">Dubai</option>
            <option value="Sharjah">Sharjah</option>
            <option value="Ajman">Ajman</option>
            <option value="Ras Al Khaimah">Ras Al Khaimah</option>
            <option value="Fujairah">Fujairah</option>
            <option value="Umm Al Quwain">Umm Al Quwain</option>
          </select>
          <select 
            value={allocationFilter}
            onChange={(e) => setAllocationFilter(e.target.value)}
            className="bg-[#111419] border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-300 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Allocated — Ours">Allocated — Ours</option>
            <option value="Allocated — Other Distributor">Allocated — Other</option>
            <option value="Allocated — Brand Direct">Allocated — Direct</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-300 border-l border-slate-700 pl-3">
            <input 
              type="checkbox" 
              checked={activeProjectFilter}
              onChange={(e) => setActiveProjectFilter(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600 text-amber-500 focus:ring-amber-500/20"
            />
            Active Projects Only
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#0a0c10] custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(c => {
            const clientProjects = allProjects?.filter(p => p.clientId === c.id) || [];
            const activeProjectsCount = clientProjects.filter(p => p.status === 'Active').length;
            const employeeCount = allEmployees?.filter(e => e.clientId === c.id).length || 0;
            
            let statusColor = "bg-slate-500/20 text-slate-400 border-slate-500/30";
            if (c.tier1?.allocationStatus === 'Open') statusColor = "bg-green-500/20 text-green-400 border-green-500/30";
            if (c.tier1?.allocationStatus === 'Allocated — Ours') statusColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
            if (c.tier1?.allocationStatus === 'Allocated — Other Distributor') statusColor = "bg-orange-500/20 text-orange-400 border-orange-500/30";
            if (c.tier1?.allocationStatus === 'Allocated — Brand Direct') statusColor = "bg-purple-500/20 text-purple-400 border-purple-500/30";

            return (
              <div 
                key={c.id} 
                onClick={() => navigate(`/tier1/${c.id}`)}
                className="bg-[#111419] border border-slate-800 rounded-xl p-5 hover:border-amber-500/50 hover:bg-[#15181e] transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-slate-100 text-lg group-hover:text-amber-400 transition-colors">{c.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-medium whitespace-nowrap ml-2 ${statusColor}`}>
                    {c.tier1?.allocationStatus}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                  <MapPin className="w-3.5 h-3.5" /> {c.tier1?.emirate} — {c.tier1?.primarySiteAddress}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#1a1d23] rounded-lg p-3 flex flex-col items-center justify-center border border-slate-800/50">
                    <Users className="w-5 h-5 text-slate-500 mb-1" />
                    <span className="text-xl font-bold text-slate-200">{employeeCount}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Tracked Staff</span>
                  </div>
                  <div className="bg-[#1a1d23] rounded-lg p-3 flex flex-col items-center justify-center border border-slate-800/50">
                    <Building className="w-5 h-5 text-slate-500 mb-1" />
                    <span className="text-xl font-bold text-slate-200">{activeProjectsCount}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Active Projects</span>
                  </div>
                </div>
                
                <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-800 pt-3">
                  <span>Updated {c.updatedAt.toLocaleDateString()}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-500" />
                </div>
              </div>
            );
          })}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No Tier 1 Watch clients found.
            </div>
          )}
        </div>
      </div>
      {showAddModal && (
        <AddTier1Modal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newId) => {
            setShowAddModal(false);
            navigate(`/tier1/${newId}`);
          }}
        />
      )}
    </div>
  );
}