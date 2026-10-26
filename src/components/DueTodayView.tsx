import React, { useState, useMemo } from 'react';
import { useLiveQuery } from '../db';
import { db, Client, Lead, CampaignTarget, Interaction } from '../db';
import { OutreachButtons } from './OutreachButtons';
import { QuickPicker } from './QuickPicker';
import { MessageCircle, Mail, Linkedin, CheckCircle, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';

interface CallTask {
  id: string; // unique for the task list
  type: 'manual' | 'stagnant' | 'campaign';
  client: Client;
  reason: string;
  dueDate: Date;
  daysOverdue: number;
}

export function DueTodayView() {
  const navigate = useNavigate();
  const [pickerClient, setPickerClient] = useState<{id: string, name: string} | null>(null);

  const allClients = useLiveQuery(() => db.clients.toArray(), []) || [];
  const allInteractions = useLiveQuery(() => db.interactions.toArray(), []) || [];
  const allLeads = useLiveQuery(() => db.leads.toArray(), []) || [];
  const allCampaignTargets = useLiveQuery(() => db.campaignTargets.toArray(), []) || [];

  const getLastInteraction = (clientId: string) => {
    const ci = allInteractions.filter(i => i.clientId === clientId).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
    return ci.length > 0 ? ci[0] : null;
  };

  const tasks: CallTask[] = useMemo(() => {
    if (!allClients.length) return [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const getOverdue = (d: Date) => {
      const diff = startOfToday.getTime() - d.getTime();
      return Math.max(0, Math.floor(diff / (1000 * 3600 * 24)));
    };

    const taskList: CallTask[] = [];

    allClients.forEach(c => {
      // 1. Manual/FollowUp
      if (c.nextFollowUpDate && c.nextFollowUpDate <= today && !c.retryFlag) {
        taskList.push({
          id: `manual-${c.id}`,
          type: 'manual',
          client: c,
          reason: 'Manual Follow-up scheduled',
          dueDate: c.nextFollowUpDate,
          daysOverdue: getOverdue(c.nextFollowUpDate)
        });
      }

      // 2. Stagnant Pipeline
      const cLeads = allLeads.filter(l => l.clientId === c.id && l.stage && !['Won', 'Lost'].includes(l.stage));
      cLeads.forEach(l => {
        const lastI = getLastInteraction(c.id);
        const refDate = lastI ? lastI.timestamp : l.date;
        const diffDays = Math.floor((today.getTime() - refDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays >= 5) { // 5+ days stagnant
          taskList.push({
            id: `stagnant-${l.id}`,
            type: 'stagnant',
            client: c,
            reason: `Stagnant Lead (${l.stage}): ${l.productLine} (>5 days no activity)`,
            dueDate: new Date(refDate.getTime() + 5 * 24 * 3600 * 1000),
            daysOverdue: diffDays - 5
          });
        }
      });

      // 3. Campaign Targets Response Deadline
      const cTargets = allCampaignTargets.filter(t => t.clientId === c.id && t.state === 'Sent' && t.responseDeadline && t.responseDeadline <= today);
      cTargets.forEach(t => {
        taskList.push({
          id: `campaign-${t.id}`,
          type: 'campaign',
          client: c,
          reason: 'Campaign Response Deadline Approaching/Overdue',
          dueDate: t.responseDeadline!,
          daysOverdue: getOverdue(t.responseDeadline!)
        });
      });
    });

    // Deduplicate by client ID for simplicity, keeping the most urgent (highest overdue)
    const deduped = new Map<string, CallTask>();
    taskList.forEach(t => {
      if (!deduped.has(t.client.id) || deduped.get(t.client.id)!.daysOverdue < t.daysOverdue) {
        deduped.set(t.client.id, t);
      }
    });

    return Array.from(deduped.values()).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [allClients, allInteractions, allLeads, allCampaignTargets]);

  const handleLogOutcome = async (e: React.MouseEvent, task: CallTask, outcome: string) => {
    e.stopPropagation();
    await db.interactions.add({
      id: uuidv4(),
      clientId: task.client.id,
      timestamp: new Date(),
      channel: 'Call',
      summary: `Call Outcome: ${outcome} (${task.reason})`
    });
    
    // Clear nextFollowUpDate if it's a manual task to remove it from the list
    if (task.type === 'manual') {
      await db.clients.update(task.client.id, { nextFollowUpDate: null });
    }
    
    // Prompt next action
    setPickerClient({ id: task.client.id, name: task.client.name });
  };

  const renderTaskRow = (task: CallTask) => {
    const lastInteraction = getLastInteraction(task.client.id);

    return (
      <div 
        key={task.id}
        onClick={() => navigate(`/pipeline/${task.client.id}`)}
        className="bg-[#12151a] border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center gap-4 group"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors text-base">{task.client.name}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${task.daysOverdue > 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
              {task.daysOverdue === 0 ? 'Due Today' : `${task.daysOverdue}d overdue`}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
              {task.type === 'stagnant' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
              {task.type === 'campaign' && <MegaphoneIcon className="w-3 h-3 text-purple-400" />}
              {task.type === 'manual' && <Calendar className="w-3 h-3 text-blue-400" />}
              {task.reason}
            </span>
          </div>
          <p className="text-xs text-slate-500 line-clamp-2 mt-2">
            <span className="font-medium text-slate-400">Last Interaction:</span> {lastInteraction ? `${lastInteraction.channel} - ${lastInteraction.summary}` : 'None'}
          </p>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={(e) => handleLogOutcome(e, task, 'Reached - interested')} className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs rounded border border-green-500/20 transition-colors">Reached (Interested)</button>
            <button onClick={(e) => handleLogOutcome(e, task, 'Reached - not now')} className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs rounded border border-amber-500/20 transition-colors">Not Now</button>
            <button onClick={(e) => handleLogOutcome(e, task, 'No answer')} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition-colors">No Answer</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0c10] overflow-hidden">
      {pickerClient && (
        <QuickPicker 
          companyName={pickerClient.name} 
          onSave={async (date) => {
            if (date) {
              await db.clients.update(pickerClient.id, { nextFollowUpDate: date });
            }
            setPickerClient(null);
          }}
          onClose={() => setPickerClient(null)} 
        />
      )}
      
      <div className="p-6 border-b border-slate-800 shrink-0">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-500" /> Daily Call Calendar
        </h1>
        <p className="text-sm text-slate-400 mt-1">Smart call list aggregated from manual pins, campaigns, and stagnant pipeline.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Due Calls ({tasks.length})</h2>
          {tasks.length > 0 ? (
            tasks.map(t => renderTaskRow(t))
          ) : (
            <div className="text-center py-12 bg-[#12151a] border border-slate-800 rounded-xl">
              <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300">All caught up!</h3>
              <p className="text-slate-500 text-sm mt-1">No pending calls for today.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MegaphoneIcon = ({className}:any) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>;
