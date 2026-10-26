import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from '../db';
import { db, Client, Tier1Employee, Tier1Opportunity, Tier1Project } from '../db';
import { ArrowLeft, ShieldAlert, MapPin, Users, Target, Activity, FileText, Plus, ExternalLink, Settings, MessageSquare, AlertTriangle, Building } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function Tier1ProfileView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'employees' | 'opportunities' | 'projects' | 'allocation' | 'activity'>('employees');

  const client = useLiveQuery(() => db.clients.get(id || ''), [id]);
  const employees = useLiveQuery(() => db.tier1Employees.where('clientId').equals(id || '').toArray(), [id]);
  const opportunities = useLiveQuery(() => db.tier1Opportunities.where('clientId').equals(id || '').toArray(), [id]);
  const projects = useLiveQuery(() => db.tier1Projects.where('clientId').equals(id || '').toArray(), [id]);
  const stageTransitions = useLiveQuery(async () => {
    try {
    if (!opportunities) return [];
    const oppIds = opportunities.map(o => o.id);
    const trans = [];
    for (const oppId of oppIds) {
      const t = await db.tier1StageTransitions.where('opportunityId').equals(oppId).toArray();
      trans.push(...t);
    }
    return trans;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [opportunities]);

  if (!client) return <div className="p-8 text-slate-400">Loading profile...</div>;

  const t1 = client.tier1;
  if (!t1) return <div className="p-8 text-red-400">This client is not a Tier 1 Watch account.</div>;

  let statusColor = "bg-slate-500/20 text-slate-400 border-slate-500/30";
  if (t1.allocationStatus === 'Open') statusColor = "bg-green-500/20 text-green-400 border-green-500/30";
  if (t1.allocationStatus === 'Allocated — Ours') statusColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (t1.allocationStatus === 'Allocated — Other Distributor') statusColor = "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (t1.allocationStatus === 'Allocated — Brand Direct') statusColor = "bg-purple-500/20 text-purple-400 border-purple-500/30";

  return (
    <div className="flex flex-col h-full bg-[#0a0c10] overflow-hidden">
      {/* Header */}
      <div className="bg-[#111419] border-b border-slate-800 p-6 shrink-0">
        <button onClick={() => navigate('/tier1')} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Tier 1 Watch
        </button>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
              <h1 className="text-2xl font-bold text-slate-100">{client.name}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusColor}`}>
                {t1.allocationStatus}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {t1.emirate}</span>
              <span>{t1.primarySiteAddress}</span>
            </div>
          </div>
          <button 
            onClick={() => navigate(`/pipeline/${client.id}`)}
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 border border-blue-900 bg-blue-950/30 px-3 py-1.5 rounded"
          >
            Open in Pipeline <ExternalLink className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4 p-3 bg-[#1a1d23] border border-slate-700/50 rounded-lg text-sm text-slate-300">
          <span className="font-semibold text-slate-400">Justification:</span> {t1.justification}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-slate-800 bg-[#111419] shrink-0 overflow-x-auto custom-scrollbar">
        {[
          { id: 'employees', label: 'Employees & Roles', icon: Users, count: employees?.length || 0 },
          { id: 'opportunities', label: 'RFQ Tracker', icon: Target, count: opportunities?.length || 0 },
          { id: 'projects', label: 'Projects', icon: FileText, count: projects?.length || 0 },
          { id: 'allocation', label: 'Allocation', icon: Settings },
          { id: 'activity', label: 'Timeline', icon: Activity }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id 
                ? 'border-amber-500 text-amber-500' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {activeTab === 'employees' && <EmployeesTab clientId={client.id} employees={employees} />}
        {activeTab === 'opportunities' && <OpportunitiesTab clientId={client.id} opportunities={opportunities} employees={employees} stageTransitions={stageTransitions} />}
        {activeTab === 'projects' && <ProjectsTab clientId={client.id} projects={projects} />}
        {activeTab === 'allocation' && <AllocationTab client={client} />}
        {activeTab === 'activity' && <TimelineTab client={client} employees={employees} opportunities={opportunities} projects={projects} stageTransitions={stageTransitions} />}
      </div>
    </div>
  );
}

function EmployeesTab({ clientId, employees }: { clientId: string, employees: Tier1Employee[] | undefined }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEmp, setNewEmp] = useState<Partial<Tier1Employee>>({ department: 'Procurement', avgReplyTime: '', preferredChannel: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.name) return;
    await db.tier1Employees.add({
      id: uuidv4(),
      clientId,
      name: newEmp.name || '',
      role: newEmp.role || '',
      department: newEmp.department as any || 'Other',
      email: newEmp.email || '',
      phone: newEmp.phone || '',
      linkedin: newEmp.linkedin || '',
      processNotes: newEmp.processNotes || '',
      avgReplyTime: newEmp.avgReplyTime as any || '',
      preferredChannel: newEmp.preferredChannel as any || ''
    });
    setShowAdd(false);
    setNewEmp({ department: 'Procurement', avgReplyTime: '', preferredChannel: '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Mapped Buying Center</h2>
          <p className="text-xs text-amber-500/80 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Track process and conduct only — not personal information.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 transition-colors border border-slate-700">
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-[#111419] border border-amber-500/30 p-4 rounded-xl space-y-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input required type="text" value={newEmp.name || ''} onChange={e => setNewEmp({...newEmp, name: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role / Title</label>
              <input type="text" value={newEmp.role || ''} onChange={e => setNewEmp({...newEmp, role: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Department</label>
              <select value={newEmp.department} onChange={e => setNewEmp({...newEmp, department: e.target.value as any})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white">
                <option value="Procurement">Procurement</option>
                <option value="Engineering">Engineering</option>
                <option value="Site">Site</option>
                <option value="Management">Management</option>
                <option value="Finance">Finance</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Avg Reply Time</label>
              <select value={newEmp.avgReplyTime} onChange={e => setNewEmp({...newEmp, avgReplyTime: e.target.value as any})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white">
                <option value="">Unknown</option>
                <option value="Same day">Same day</option>
                <option value="1-2 days">1-2 days</option>
                <option value="3-7 days">3-7 days</option>
                <option value="Rarely responds">Rarely responds</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Process Notes (Role in buying process)</label>
            <input type="text" placeholder="e.g. raises RFQs for piping consumables, final technical sign-off" value={newEmp.processNotes || ''} onChange={e => setNewEmp({...newEmp, processNotes: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-slate-400">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-amber-500 text-amber-950 text-sm font-medium rounded">Save Contact</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees?.map(emp => (
          <div key={emp.id} className="bg-[#111419] border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-slate-100">{emp.name}</h3>
                  <p className="text-xs text-slate-400">{emp.role} • {emp.department}</p>
                </div>
                {emp.avgReplyTime && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    Replies: {emp.avgReplyTime}
                  </span>
                )}
              </div>
              <div className="mt-3 p-2 bg-[#1a1d23] rounded border border-slate-800/50">
                <p className="text-xs text-slate-300 font-medium mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-slate-500" /> Process Note
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">{emp.processNotes || 'No process notes.'}</p>
              </div>
            </div>
          </div>
        ))}
        {employees?.length === 0 && !showAdd && (
          <div className="col-span-full py-8 text-center text-slate-500 bg-[#111419] rounded-xl border border-dashed border-slate-800">
            No contacts mapped yet. Map the buying center to track RFQ authority.
          </div>
        )}
      </div>
    </div>
  );
}

// Other tabs are stubs for now to save space, but you'd implement them similarly.
function OpportunitiesTab({ clientId, opportunities, employees, stageTransitions }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newOpp, setNewOpp] = useState<Partial<Tier1Opportunity>>({ stage: 'RFQ Received', productLine: 'ESAB Machines' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpp.ownerEmployeeId) {
      alert('Please select an owning employee');
      return;
    }
    const oppId = uuidv4();
    const now = new Date();
    await db.tier1Opportunities.add({
      id: oppId,
      clientId,
      stage: newOpp.stage as any || 'RFQ Received',
      value: newOpp.value || null,
      productLine: newOpp.productLine || 'ESAB Machines',
      ownerEmployeeId: newOpp.ownerEmployeeId,
      createdAt: now,
      updatedAt: now
    });
    
    await db.tier1StageTransitions.add({
      id: uuidv4(),
      opportunityId: oppId,
      stage: newOpp.stage as any || 'RFQ Received',
      date: now,
      employeeId: newOpp.ownerEmployeeId
    });
    
    setShowAdd(false);
    setNewOpp({ stage: 'RFQ Received', productLine: 'ESAB Machines' });
  };

  const handleStageChange = async (oppId: string, newStage: any) => {
    const opp = opportunities.find((o: any) => o.id === oppId);
    if (!opp || opp.stage === newStage) return;

    const now = new Date();
    await db.tier1Opportunities.update(oppId, { 
      stage: newStage,
      updatedAt: now
    });

    await db.tier1StageTransitions.add({
      id: uuidv4(),
      opportunityId: oppId,
      stage: newStage,
      date: now,
      employeeId: opp.ownerEmployeeId // In a real app we might pick the acting employee
    });
  };

  // Compute average cycle time
  // For each opp, find transition to 'Quote Sent' and 'PO Issued'
  let quoteTimes: number[] = [];
  let poTimes: number[] = [];
  
  opportunities?.forEach((opp: any) => {
    const trans = stageTransitions?.filter((t: any) => t.opportunityId === opp.id).sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
    if (!trans) return;
    
    const rfq = trans.find((t: any) => t.stage === 'RFQ Received');
    const quote = trans.find((t: any) => t.stage === 'Quote Sent');
    const po = trans.find((t: any) => t.stage === 'PO Issued');
    
    if (rfq && quote) {
      quoteTimes.push((quote.date.getTime() - rfq.date.getTime()) / (1000 * 3600 * 24));
    }
    if (quote && po) {
      poTimes.push((po.date.getTime() - quote.date.getTime()) / (1000 * 3600 * 24));
    }
  });

  const avgQuoteTime = quoteTimes.length ? (quoteTimes.reduce((a, b) => a + b, 0) / quoteTimes.length).toFixed(1) : '-';
  const avgPoTime = poTimes.length ? (poTimes.reduce((a, b) => a + b, 0) / poTimes.length).toFixed(1) : '-';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-slate-100">RFQ → PO Pipeline</h2>
        <button onClick={() => setShowAdd(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 transition-colors border border-slate-700">
          <Plus className="w-4 h-4" /> Add Opportunity
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#1a1d23] border border-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1 font-medium">Avg Cycle: RFQ → Quote</div>
          <div className="text-xl font-bold text-amber-500">{avgQuoteTime} <span className="text-sm font-normal text-slate-500">days</span></div>
        </div>
        <div className="bg-[#1a1d23] border border-slate-800/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1 font-medium">Avg Cycle: Quote → PO</div>
          <div className="text-xl font-bold text-green-500">{avgPoTime} <span className="text-sm font-normal text-slate-500">days</span></div>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-[#111419] border border-slate-700 p-4 rounded-xl space-y-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Product Line</label>
              <select required value={newOpp.productLine} onChange={e => setNewOpp({...newOpp, productLine: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white">
                <option value="ESAB Machines">ESAB Machines</option>
                <option value="ESAB Consumables">ESAB Consumables</option>
                <option value="EWM Machines">EWM Machines</option>
                <option value="Callington">Callington</option>
                <option value="CNC/Automated">CNC/Automated</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Est. Value (AED)</label>
              <input type="number" value={newOpp.value || ''} onChange={e => setNewOpp({...newOpp, value: Number(e.target.value)})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Initial Stage</label>
              <select value={newOpp.stage} onChange={e => setNewOpp({...newOpp, stage: e.target.value as any})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white">
                <option value="RFQ Received">RFQ Received</option>
                <option value="Quote Sent">Quote Sent</option>
                <option value="Under Review">Under Review</option>
                <option value="PO Issued">PO Issued</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Owner (Contact)</label>
              <select required value={newOpp.ownerEmployeeId || ''} onChange={e => setNewOpp({...newOpp, ownerEmployeeId: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white">
                <option value="">Select contact...</option>
                {employees?.map((emp: Tier1Employee) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-slate-400">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-amber-500 text-amber-950 text-sm font-medium rounded">Save Opportunity</button>
          </div>
        </form>
      )}

      <div className="bg-[#111419] border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#15181e] border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="p-3 pl-4">Product Line</th>
              <th className="p-3">Stage</th>
              <th className="p-3">Value</th>
              <th className="p-3">Age</th>
              <th className="p-3">Owner</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-800/50">
            {opportunities?.map((opp: Tier1Opportunity) => {
              const owner = employees?.find((e: Tier1Employee) => e.id === opp.ownerEmployeeId);
              const ageDays = Math.floor((new Date().getTime() - opp.updatedAt.getTime()) / (1000 * 3600 * 24));
              
              let badgeColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
              if (opp.stage === 'PO Issued') badgeColor = "bg-green-500/10 text-green-400 border-green-500/20";
              if (opp.stage === 'Quote Sent') badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
              if (opp.stage === 'RFQ Received') badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
              
              return (
                <tr key={opp.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 pl-4 font-medium text-slate-200">{opp.productLine}</td>
                  <td className="p-3">
                    <select 
                      value={opp.stage} 
                      onChange={e => handleStageChange(opp.id, e.target.value)}
                      className={`text-[10px] px-2 py-0.5 rounded border outline-none appearance-none cursor-pointer ${badgeColor}`}
                    >
                      <option value="RFQ Received">RFQ Received</option>
                      <option value="Quote Sent">Quote Sent</option>
                      <option value="Under Review">Under Review</option>
                      <option value="PO Issued">PO Issued</option>
                      <option value="Lost/Cancelled">Lost/Cancelled</option>
                    </select>
                  </td>
                  <td className="p-3 text-slate-400">{opp.value ? `AED ${opp.value.toLocaleString()}` : '-'}</td>
                  <td className="p-3 text-slate-400">{ageDays}d</td>
                  <td className="p-3 text-slate-400">{owner?.name || 'Unknown'}</td>
                </tr>
              )
            })}
            {opportunities?.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">No active opportunities.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ProjectsTab({ clientId, projects }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newProj, setNewProj] = useState<Partial<Tier1Project>>({ status: 'Tendering', clientRole: 'Main Contractor' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProj.name) return;
    await db.tier1Projects.add({
      id: uuidv4(),
      clientId,
      name: newProj.name || '',
      location: newProj.location || '',
      clientRole: newProj.clientRole as any || 'Main Contractor',
      status: newProj.status as any || 'Tendering',
      relevance: newProj.relevance || '',
      sourceLink: newProj.sourceLink || '',
      createdAt: new Date()
    });
    setShowAdd(false);
    setNewProj({ status: 'Tendering', clientRole: 'Main Contractor' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-slate-100">Project Pipeline</h2>
        <button onClick={() => setShowAdd(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1 transition-colors border border-slate-700">
          <Plus className="w-4 h-4" /> Add Project
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-[#111419] border border-slate-700 p-4 rounded-xl space-y-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Project Name</label>
              <input required type="text" value={newProj.name || ''} onChange={e => setNewProj({...newProj, name: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select value={newProj.status} onChange={e => setNewProj({...newProj, status: e.target.value as any})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white">
                <option value="Tendering">Tendering</option>
                <option value="Awarded">Awarded</option>
                <option value="Active">Active</option>
                <option value="Complete">Complete</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Client Role</label>
              <select value={newProj.clientRole} onChange={e => setNewProj({...newProj, clientRole: e.target.value as any})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white">
                <option value="Main Contractor">Main Contractor</option>
                <option value="Subcontractor">Subcontractor</option>
                <option value="EPC">EPC</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Location</label>
              <input type="text" value={newProj.location || ''} onChange={e => setNewProj({...newProj, location: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Source / Link (optional)</label>
              <input type="text" value={newProj.sourceLink || ''} onChange={e => setNewProj({...newProj, sourceLink: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Relevance (Estimated burn)</label>
            <input type="text" value={newProj.relevance || ''} onChange={e => setNewProj({...newProj, relevance: e.target.value})} className="w-full bg-[#1a1d23] border border-slate-700 rounded px-3 py-1.5 text-sm text-white" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-slate-400">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-amber-500 text-amber-950 text-sm font-medium rounded">Save Project</button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {projects?.map((proj: Tier1Project) => {
          let statusColor = "bg-slate-500 text-white";
          if (proj.status === 'Active') statusColor = "bg-green-500 text-green-950";
          if (proj.status === 'Tendering') statusColor = "bg-blue-500 text-blue-950";
          
          return (
            <div key={proj.id} className="bg-[#111419] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${statusColor}`}>{proj.status}</span>
                  <h3 className="font-bold text-slate-200">{proj.name}</h3>
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {proj.location || 'Unknown location'}</span>
                  <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {proj.clientRole}</span>
                </div>
                {proj.relevance && (
                  <p className="text-xs text-slate-300 mt-3 p-2 bg-[#1a1d23] rounded border border-slate-800">
                    <span className="text-slate-500 font-medium">Relevance:</span> {proj.relevance}
                  </p>
                )}
              </div>
              {proj.sourceLink && (
                <a href={proj.sourceLink} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 self-start md:self-center">
                  Source <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )
        })}
        {projects?.length === 0 && !showAdd && (
          <div className="py-8 text-center text-slate-500 bg-[#111419] rounded-xl border border-dashed border-slate-800">
            No projects mapped yet.
          </div>
        )}
      </div>
    </div>
  );
}

function AllocationTab({ client }: any) {
  const t1 = client.tier1;
  return (
    <div className="bg-[#111419] border border-slate-800 rounded-xl p-6">
      <h2 className="text-lg font-bold text-slate-100 mb-4">Allocation & Restriction</h2>
      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <div className="text-sm text-slate-200">{t1.allocationStatus}</div>
        </div>
        {t1.allocatedTo && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Allocated Entity</label>
            <div className="text-sm text-slate-200">{t1.allocatedTo}</div>
          </div>
        )}
        {t1.allocatedProductLines?.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Restricted Product Lines</label>
            <div className="flex gap-2 flex-wrap">
              {t1.allocatedProductLines.map((pl: string) => (
                <span key={pl} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">{pl}</span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-500/90 leading-relaxed">
          <strong className="block mb-1">Note on Observation:</strong>
          Despite any allocation restriction, the client remains in Tier 1 Watch and should be monitored normally (projects, employees, RFQ activity). Allocation restricts selling action, not observation.
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ client, employees, opportunities, projects, stageTransitions }: any) {
  // Combine all activities into a single array
  const events = [];

  // Add client creation
  if (client?.createdAt) {
    events.push({
      id: `client_created`,
      date: client.createdAt,
      type: 'Client',
      title: 'Added to Tier 1 Watch',
      description: `Client initialized in the watch list. Justification: ${client.tier1?.justification || 'N/A'}`
    });
  }

  // Add employees
  employees?.forEach((emp: any) => {
    // We don't have createdAt on employees yet, so we'll just skip them in timeline 
    // or we could add it if it was on the schema. The current schema doesn't have it.
  });

  // Add opportunities created
  opportunities?.forEach((opp: any) => {
    if (opp.createdAt) {
      events.push({
        id: `opp_created_${opp.id}`,
        date: opp.createdAt,
        type: 'Opportunity',
        title: `Opportunity Identified: ${opp.productLine}`,
        description: `Initial estimated value: ${opp.value ? 'AED ' + opp.value.toLocaleString() : 'Unknown'}`
      });
    }
  });

  // Add projects
  projects?.forEach((proj: any) => {
    if (proj.createdAt) {
      events.push({
        id: `proj_created_${proj.id}`,
        date: proj.createdAt,
        type: 'Project',
        title: `Project Logged: ${proj.name}`,
        description: `Status: ${proj.status} — Role: ${proj.clientRole} in ${proj.location || 'Unknown'}`
      });
    }
  });

  // Add stage transitions
  stageTransitions?.forEach((trans: any) => {
    const opp = opportunities?.find((o: any) => o.id === trans.opportunityId);
    const emp = employees?.find((e: any) => e.id === trans.employeeId);
    if (trans.date) {
      events.push({
        id: `trans_${trans.id}`,
        date: trans.date,
        type: 'Transition',
        title: `${opp?.productLine || 'Opportunity'} moved to ${trans.stage}`,
        description: `Transitioned by ${emp?.name || 'Unknown Contact'}`
      });
    }
  });

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-bold text-slate-100 mb-4">Activity Timeline</h2>
      <div className="relative border-l border-slate-700 ml-3 space-y-6">
        {events.map((event, index) => {
          let dotColor = "bg-slate-500";
          if (event.type === 'Client') dotColor = "bg-purple-500";
          if (event.type === 'Opportunity') dotColor = "bg-blue-500";
          if (event.type === 'Project') dotColor = "bg-green-500";
          if (event.type === 'Transition') dotColor = "bg-amber-500";

          return (
            <div key={event.id} className="relative pl-6">
              <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full border-[3px] border-[#0a0c10] ${dotColor}`}></div>
              <div className="bg-[#111419] border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-slate-200">{event.title}</h3>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{event.date.toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-400">{event.description}</p>
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="pl-6 text-slate-500 italic py-4">No activity recorded yet.</div>
        )}
      </div>
    </div>
  );
}