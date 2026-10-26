import React, { useState } from 'react';
import { useLiveQuery } from '../db';
import { db, Client } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { 
  Building2, Plus, Clock, X, Briefcase, MessageSquare, Link as LinkIcon
} from 'lucide-react';

const PROJECT_STAGES = [
  'FEED',
  'Main Contract Bid',
  'Bid Evaluation',
  'Awarded'
];

const LINK_ROLES = [
  'Bidder',
  'Main Contractor (Won Bid)',
  'Subcontractor',
  'Supplier'
];

export function ProjectsView() {
  const [refreshKey, setRefreshKey] = useState(0);
  // Get all clients, including our system record
  const allClients = useLiveQuery(() => db.clients.toArray(), [refreshKey]);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProject, setNewProject] = useState({ 
    name: '', developerName: '', stage: 'FEED' 
  });
  
  if (!allClients) return <div className="p-6 text-slate-400">Loading projects...</div>;

  // The system client where we store projects
  let systemClient = allClients.find(c => c.id === '00000000-0000-0000-0000-000000000000');
  
  // The actual CRM clients
  const crmClients = allClients.filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
  
  const allProjects = (systemClient?.metadata?.projects || []).filter(Boolean);
  const selectedProject = allProjects.find((p: any) => p.id === selectedProjectId);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;
    
    // Ensure system client exists locally if not loaded yet
    if (!systemClient) {
      systemClient = {
        id: '00000000-0000-0000-0000-000000000000',
        name: '_SYSTEM_PROJECTS',
        category: 'Other',
        tier: 4,
        status: 'Parked',
        address: '', phone: '', website: '', backgroundBlurb: '', whatTheyDo: '',
        metadata: { projects: [] }
      };
      await db.clients.add(systemClient);
    }

    const metadata = systemClient.metadata || { projects: [] };
    const projects = metadata.projects || [];
    
    const newProj = {
      id: uuidv4(),
      name: newProject.name,
      developerName: newProject.developerName,
      stage: newProject.stage,
      status: 'Active',
      notes: [],
      linkedClients: []
    };
    
    projects.push(newProj);

    await db.clients.update(systemClient.id, { metadata: { ...metadata, projects } });
    setShowAddProject(false);
    setNewProject({ name: '', developerName: '', stage: 'FEED' });
    setSelectedProjectId(newProj.id);
    setRefreshKey(k => k + 1);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'FEED': return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
      case 'Main Contract Bid': return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
      case 'Bid Evaluation': return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
      case 'Awarded': return 'text-green-400 border-green-400/30 bg-green-400/10';
      default: return 'text-slate-400 border-slate-400/30 bg-slate-400/10';
    }
  };

  return (
    <div className="flex h-full bg-[#0a0c10]">
      {/* Left List */}
      <div className="w-1/3 border-r border-slate-800 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#12151a]">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Projects Pipeline</h2>
            <p className="text-xs text-slate-400">{allProjects.length} projects tracked</p>
          </div>
          <button 
            onClick={() => setShowAddProject(true)}
            className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {allProjects.map((proj: any) => (
            <div 
              key={proj.id}
              onClick={() => setSelectedProjectId(proj.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${selectedProjectId === proj.id ? 'bg-slate-800 border-blue-500/50' : 'bg-[#12151a] border-slate-800 hover:border-slate-700'}`}
            >
              <div className="font-semibold text-slate-200 text-sm mb-1">{proj.name}</div>
              <div className="flex flex-col gap-2">
                {proj.developerName && (
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {proj.developerName}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {(proj.linkedClients || []).length} linked clients
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStageColor(proj.stage)}`}>
                    {proj.stage || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {allProjects.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-10">No projects found. Add one!</div>
          )}
        </div>
      </div>

      {/* Right Detail */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedProject ? (
          <ProjectDetail 
            project={selectedProject} 
            systemClient={systemClient} 
            crmClients={crmClients}
            onUpdate={() => setRefreshKey(k => k + 1)} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Select a project to view details
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12151a] border border-slate-800 rounded-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#161a22]">
              <h3 className="font-bold text-slate-200">New Project</h3>
              <button onClick={() => setShowAddProject(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddProject} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Project Name</label>
                <input required type="text" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="w-full bg-[#0a0c10] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" placeholder="e.g. Al Maktoum Airport Phase 2" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Developer / Owner (Optional)</label>
                <input type="text" value={newProject.developerName} onChange={e => setNewProject({...newProject, developerName: e.target.value})} className="w-full bg-[#0a0c10] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" placeholder="e.g. ADNOC, Emaar, etc." />
                <p className="text-[10px] text-slate-500 mt-1">Free text field for the ultimate project owner.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Current Stage</label>
                <select value={newProject.stage} onChange={e => setNewProject({...newProject, stage: e.target.value})} className="w-full bg-[#0a0c10] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                  {PROJECT_STAGES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddProject(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectDetail({ project, systemClient, crmClients, onUpdate }: { project: any, systemClient: any, crmClients: Client[], onUpdate: () => void }) {
  const [newNote, setNewNote] = useState('');
  const [importance, setImportance] = useState('Medium');
  
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [newLink, setNewLink] = useState({ clientId: '', role: 'Bidder' });

  const updateProjectData = async (updates: any) => {
    const metadata = systemClient.metadata || { projects: [] };
    const projects = metadata.projects || [];
    const pIndex = projects.findIndex((p: any) => p.id === project.id);
    if (pIndex !== -1) {
      projects[pIndex] = { ...projects[pIndex], ...updates };
      await db.clients.update(systemClient.id, { metadata: { ...metadata, projects } });
      onUpdate();
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const notes = project.notes || [];
    notes.push({
      id: uuidv4(),
      content: newNote.trim(),
      createdAt: new Date().toISOString(),
      importance
    });
    
    await updateProjectData({ notes });
    setNewNote('');
    setImportance('Medium');
  };
  
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.clientId || !newLink.role) return;

    const linkedClients = project.linkedClients || [];
    // Avoid exact duplicates
    if (!linkedClients.find((l: any) => l.clientId === newLink.clientId && l.role === newLink.role)) {
      linkedClients.push({
        id: uuidv4(),
        clientId: newLink.clientId,
        role: newLink.role,
        addedAt: new Date().toISOString()
      });
      await updateProjectData({ linkedClients });
    }
    setShowLinkModal(false);
    setNewLink({ clientId: '', role: 'Bidder' });
  };
  
  const handleRemoveLink = async (linkId: string) => {
    const linkedClients = (project.linkedClients || []).filter((l: any) => l.id !== linkId);
    await updateProjectData({ linkedClients });
  };

  const getImportanceColor = (imp: string) => {
    switch(imp) {
      case 'Critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'High': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'Low': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'FEED': return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
      case 'Main Contract Bid': return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
      case 'Bid Evaluation': return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
      case 'Awarded': return 'text-green-400 border-green-400/30 bg-green-400/10';
      default: return 'text-slate-400 border-slate-400/30 bg-slate-400/10';
    }
  };

  const sortedNotes = [...(project.notes || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const linkedClients = project.linkedClients || [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-800 bg-[#12151a]">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
          <select 
            value={project.stage || 'FEED'}
            onChange={e => updateProjectData({ stage: e.target.value })}
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border outline-none appearance-none cursor-pointer ${getStageColor(project.stage)}`}
          >
            {PROJECT_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        
        <div className="flex flex-wrap gap-4">
          {project.developerName && (
            <div className="flex items-center gap-1.5 text-sm text-slate-400 bg-[#0a0c10] px-3 py-1.5 rounded-lg border border-slate-800">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300 font-medium">{project.developerName} <span className="text-slate-500">(Developer/Owner)</span></span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 bg-[#0a0c10]">
        <div className="max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2">
            <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Project Notes & Updates
            </h3>
            
            <form onSubmit={handleAddNote} className="mb-8 bg-[#12151a] p-4 rounded-xl border border-slate-800">
              <textarea 
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a new update or note for this project..."
                className="w-full bg-[#0a0c10] border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 min-h-[100px] mb-3"
                required
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Importance:</span>
                  <select 
                    value={importance}
                    onChange={e => setImportance(e.target.value)}
                    className="bg-[#0a0c10] border border-slate-700 text-xs text-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                  Add Note
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {sortedNotes.map((note: any) => (
                <div key={note.id} className="bg-[#12151a] border border-slate-800 rounded-xl p-4 relative">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getImportanceColor(note.importance)}`}>
                      {note.importance}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(note.createdAt).toLocaleString(undefined, { 
                        month: 'short', day: 'numeric', year: 'numeric', 
                        hour: 'numeric', minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </div>
                </div>
              ))}
              {sortedNotes.length === 0 && (
                 <div className="text-center py-10 text-slate-500 text-sm bg-[#12151a] rounded-xl border border-slate-800 border-dashed">
                   No notes added yet for this project.
                 </div>
              )}
            </div>
          </div>

          <div className="md:col-span-1 space-y-6">
            <div className="bg-[#12151a] p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> Linked CRM Clients
                </h3>
                <button 
                  onClick={() => setShowLinkModal(true)}
                  className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                {linkedClients.map((link: any) => {
                  const linkedClient = crmClients.find(c => c.id === link.clientId);
                  if (!linkedClient) return null;
                  
                  return (
                    <div key={link.id} className="p-3 bg-[#0a0c10] border border-slate-700 rounded-lg relative group">
                      <div className="text-sm font-semibold text-slate-200">{linkedClient.name}</div>
                      <div className="text-[10px] uppercase font-bold text-blue-400 mt-1 tracking-wider">
                        Role: {link.role}
                      </div>
                      <button 
                        onClick={() => handleRemoveLink(link.id)}
                        className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Unlink Client"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                
                {linkedClients.length === 0 && (
                  <div className="text-xs text-slate-500 text-center py-4 border border-dashed border-slate-700 rounded-lg">
                    No clients linked. Link bidders, winners, or subcontractors from your CRM.
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
      
      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#12151a] border border-slate-800 rounded-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#161a22]">
              <h3 className="font-bold text-slate-200">Link Client to Project</h3>
              <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddLink} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Select Client</label>
                <select required value={newLink.clientId} onChange={e => setNewLink({...newLink, clientId: e.target.value})} className="w-full bg-[#0a0c10] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">Choose CRM Client...</option>
                  {crmClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1 block">Role in this Project</label>
                <select required value={newLink.role} onChange={e => setNewLink({...newLink, role: e.target.value})} className="w-full bg-[#0a0c10] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                  {LINK_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowLinkModal(false)} className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Link Client</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
