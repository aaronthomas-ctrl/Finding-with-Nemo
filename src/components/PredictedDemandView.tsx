import React from 'react';
import { Activity } from 'lucide-react';

export function PredictedDemandView() {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d10]">
      <header className="px-6 py-4 border-b border-slate-800 bg-[#161a22]">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold text-slate-100">Market Signals & Predicted Demand</h1>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Activity className="w-16 h-16 text-blue-500/20 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-200 mb-2">Demand Signals Engine</h2>
          <p className="text-slate-400">
            This module aggregates external market indicators, recent search volume, and competitor intelligence to predict incoming stock demand.
          </p>
          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm font-medium">
            Signal processing is currently running in the background. Analytics will appear here once the baseline data collection is complete.
          </div>
        </div>
      </main>
    </div>
  );
}
