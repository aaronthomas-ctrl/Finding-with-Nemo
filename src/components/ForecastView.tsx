import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from '../db';
import { db, Client } from '../db';
import { computePredictions, Prediction } from '../lib/forecast';
import { MessageCircle, Mail, Linkedin, TrendingUp } from 'lucide-react';
import { OutreachButtons } from './OutreachButtons';
import { QuickPicker } from './QuickPicker';

interface ForecastItem extends Prediction {
  client: Client;
}

export function ForecastView() {
  const navigate = useNavigate();
  const [pickerClient, setPickerClient] = useState<{id: string, name: string} | null>(null);
  const allClients = useLiveQuery(async () => {
    const cls = await db.clients.toArray();
    return cls.filter(c => c.id !== '00000000-0000-0000-0000-000000000000');
  }, []);
  const allEnquiries = useLiveQuery(() => db.enquiries.toArray(), []);

  if (!allClients || !allEnquiries) {
    return <div className="p-8 text-slate-400 flex items-center justify-center h-full">Loading forecast...</div>;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastLimit = new Date(today.getTime() - 15 * 24 * 3600 * 1000);
  const futureLimit = new Date(today.getTime() + 30 * 24 * 3600 * 1000);

  const forecastItems: ForecastItem[] = [];

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

  return (
    <div className="flex flex-col h-full bg-[#0c0e12] overflow-hidden">
      <div className="p-6 border-b border-slate-800 shrink-0">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-500" /> Predicted Demand
        </h2>
        <p className="text-sm text-slate-400">Call them right before they need it again.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {forecastItems.length === 0 ? (
          <div className="bg-[#12151a] border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm">No predicted demand in the current window.</p>
          </div>
        ) : (
          forecastItems.map((item, idx) => (
            <div 
              key={idx}
              onClick={() => navigate(`/pipeline/${item.client.id}`)}
              className="bg-[#12151a] border border-slate-800 rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center gap-4 group"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors text-base">
                    {item.client.name}
                  </h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    item.confidence === 'High' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                    item.confidence === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}>
                    {item.confidence}
                  </span>
                  <span className="inline-block px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] rounded">
                    {item.productLine} {item.department ? `(${item.department})` : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  Expected around <span className="font-bold text-slate-200">{item.predictedNextDate.toLocaleDateString()}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <OutreachButtons 
                  client={item.client}
                  defaultPurpose="followUp"
                  productLine={item.productLine}
                  onActionComplete={() => setPickerClient({ id: item.client.id, name: item.client.name })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {pickerClient && (
        <QuickPicker 
          companyName={pickerClient.name}
          onSave={async (date) => {
            await db.clients.update(pickerClient.id, { 
              nextFollowUpDate: date, 
              retryFlag: false,
              updatedAt: new Date() 
            });
            setPickerClient(null);
          }}
          onClose={() => setPickerClient(null)}
        />
      )}
    </div>
  );
}
