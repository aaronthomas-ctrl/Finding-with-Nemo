import React from 'react';
import { useLiveQuery } from '../db';
import { db } from '../db';
import { useNavigate } from 'react-router-dom';
import { Clock, TrendingUp, AlertTriangle, Megaphone, ArrowRight, MessageCircle } from 'lucide-react';
import { computePredictions } from '../lib/forecast';
import { executeOutreach } from '../lib/outreach';

export function DashboardView() {
  const navigate = useNavigate();
  const allClients = useLiveQuery(async () => {
    const cls = await db.clients.toArray();
    return cls.filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
  }, []);
  const allInteractions = useLiveQuery(() => db.interactions.toArray(), []);
  const allEnquiries = useLiveQuery(() => db.enquiries.toArray(), []);
  const allCampaigns = useLiveQuery(() => db.campaigns.toArray(), []);
  const settingsArray = useLiveQuery(() => db.settings.toArray(), []);

  if (!allClients || !allInteractions || !settingsArray || !allEnquiries || !allCampaigns) {
    return <div className="p-8 text-slate-400 flex items-center justify-center h-full">Loading dashboard...</div>;
  }

  const settings = settingsArray[0];
  if (!settings) return <div className="p-8 text-slate-400">Settings not initialized...</div>;

  const now = new Date();
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  // 1. Due Today
  const dueClients = allClients
    .filter(c => (c.nextFollowUpDate && c.nextFollowUpDate <= today) || c.retryFlag)
    .sort((a, b) => {
      if (a.retryFlag && !b.retryFlag) return -1;
      if (!a.retryFlag && b.retryFlag) return 1;
      return (a.nextFollowUpDate?.getTime() || 0) - (b.nextFollowUpDate?.getTime() || 0);
    });

  const getDaysOverdue = (date: Date) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const diff = startOfToday.getTime() - date.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 3600 * 24)));
  };

  const handleWhatsApp = async (e: React.MouseEvent, client: any) => {
    e.stopPropagation();
    try {
      await executeOutreach(client, 'WhatsApp', 'followUp');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 2. Predicted Demand
  const pastLimit = new Date(today.getTime() - 15 * 24 * 3600 * 1000);
  const futureLimit = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
  const forecastItems = [];
  for (const client of allClients) {
    const clientEnquiries = allEnquiries.filter(e => e.clientId === client.id);
    const predictions = computePredictions(clientEnquiries);
    for (const p of predictions) {
      if (p.predictedNextDate >= pastLimit && p.predictedNextDate <= futureLimit) {
        forecastItems.push({ ...p, client });
      }
    }
  }
  forecastItems.sort((a, b) => a.predictedNextDate.getTime() - b.predictedNextDate.getTime());

  // 3. Going Cold
  const tierWeights = { 1: 3, 2: 2, 3: 1.2, 4: 1 };
  const goingCold = allClients
    .filter(c => !c.nextFollowUpDate)
    .map(c => {
      const ci = allInteractions
        .filter(i => i.clientId === c.id)
        .sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
      if (ci.length === 0) return null;
      const daysSince = (now.getTime() - ci[0].timestamp.getTime()) / (1000 * 3600 * 24);
      const cadence = settings.cadenceDays[c.tier as keyof typeof settings.cadenceDays];
      if (daysSince > cadence) {
        return { client: c, daysSince, score: (daysSince - cadence) * tierWeights[c.tier as keyof typeof tierWeights] };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  // 4. Active Campaign
  const activeCampaigns = allCampaigns.filter(c => c.validFrom <= now && c.validTo >= now).sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
  const latestCampaign = activeCampaigns.length > 0 ? activeCampaigns[0] : null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0c0e12]">
      <div className="p-6 border-b border-slate-800 shrink-0">
        <h2 className="text-xl font-bold text-slate-100">Dashboard</h2>
        <p className="text-sm text-slate-400">Overview of your sales pipeline and activity.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. Due Today */}
          <div className="bg-[#12151a] border border-slate-800 rounded-xl flex flex-col h-80">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-slate-200">Due Today</h3>
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full">{dueClients.length}</span>
              </div>
              <button onClick={() => navigate('/due-today')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
              {dueClients.slice(0, 5).map(c => {
                const isOverdue = c.nextFollowUpDate && getDaysOverdue(c.nextFollowUpDate) > 0;
                return (
                  <div key={c.id} onClick={() => navigate(`/pipeline/${c.id}`)} className="flex items-center justify-between p-3 hover:bg-slate-800/50 rounded-lg cursor-pointer group">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate group-hover:text-blue-400">{c.name}</p>
                      {c.retryFlag ? (
                        <p className="text-xs text-red-400">Retry — No Response</p>
                      ) : (
                        <p className={`text-xs ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                          {isOverdue ? `${getDaysOverdue(c.nextFollowUpDate!)}d overdue` : 'Due today'}
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={(e) => handleWhatsApp(e, c)}
                      className="p-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded transition-colors ml-2 shrink-0"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {dueClients.length === 0 && <p className="text-sm text-slate-500 p-4 text-center">Nothing due today.</p>}
            </div>
          </div>

          {/* 2. Predicted Demand */}
          <div className="bg-[#12151a] border border-slate-800 rounded-xl flex flex-col h-80">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-slate-200">Predicted Demand</h3>
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full">{forecastItems.length}</span>
              </div>
              <button onClick={() => navigate('/forecast')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
              {forecastItems.slice(0, 5).map((item, idx) => (
                <div key={idx} onClick={() => navigate(`/pipeline/${item.client.id}`)} className="flex items-center justify-between p-3 hover:bg-slate-800/50 rounded-lg cursor-pointer group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-amber-400">{item.client.name}</p>
                    <p className="text-xs text-slate-400 truncate">{item.productLine} • {item.predictedNextDate.toLocaleDateString()}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${item.confidence === 'High' ? 'bg-green-500' : item.confidence === 'Medium' ? 'bg-amber-500' : 'bg-slate-500'}`} title={`${item.confidence} confidence`} />
                </div>
              ))}
              {forecastItems.length === 0 && <p className="text-sm text-slate-500 p-4 text-center">No predictions in window.</p>}
            </div>
          </div>

          {/* 3. Going Cold */}
          <div className="bg-[#12151a] border border-slate-800 rounded-xl flex flex-col h-80">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-slate-200">Going Cold</h3>
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full">{goingCold.length}</span>
              </div>
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
              {goingCold.slice(0, 5).map(item => {
                if (!item) return null;
                return (
                  <div key={item.client.id} onClick={() => navigate(`/pipeline/${item.client.id}`)} className="flex items-center justify-between p-3 hover:bg-slate-800/50 rounded-lg cursor-pointer group">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate group-hover:text-red-400">{item.client.name}</p>
                      <p className="text-xs text-slate-500">Tier {item.client.tier}</p>
                    </div>
                    <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-1 rounded shrink-0 ml-2">
                      {Math.floor(item.daysSince)}d ago
                    </span>
                  </div>
                );
              })}
              {goingCold.length === 0 && <p className="text-sm text-slate-500 p-4 text-center">No clients going cold.</p>}
            </div>
          </div>

          {/* 4. Active Campaign */}
          <div className="bg-[#12151a] border border-slate-800 rounded-xl flex flex-col h-80">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-slate-200">Active Campaign</h3>
              </div>
              <button onClick={() => navigate('/campaigns')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center">
              {latestCampaign ? (
                <div>
                  <h4 className="text-base font-medium text-slate-200 mb-6 text-center">{latestCampaign.title}</h4>
                  
                  {/* Calculate stats */}
                  {(() => {
                    const total = latestCampaign.targetClientIds?.length || 1; // avoid /0
                    let sent = 0, responded = 0, converted = 0;
                    Object.values(latestCampaign.perClientState || {}).forEach(st => {
                      if (st === 'Sent') sent++;
                      if (st === 'Responded') responded++;
                      if (st === 'Converted') converted++;
                    });
                    const pending = total - (sent + responded + converted);

                    return (
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex">
                          <div style={{ width: `${(converted/total)*100}%` }} className="bg-green-500" title="Converted"></div>
                          <div style={{ width: `${(responded/total)*100}%` }} className="bg-blue-500" title="Responded"></div>
                          <div style={{ width: `${(sent/total)*100}%` }} className="bg-purple-500" title="Sent"></div>
                          <div style={{ width: `${(pending/total)*100}%` }} className="bg-slate-700" title="Pending"></div>
                        </div>
                        <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider pt-2">
                          <span className="text-green-400">{converted} Conv</span>
                          <span className="text-blue-400">{responded} Resp</span>
                          <span className="text-purple-400">{sent} Sent</span>
                          <span className="text-slate-500">{pending} Pend</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center">No active campaigns.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
