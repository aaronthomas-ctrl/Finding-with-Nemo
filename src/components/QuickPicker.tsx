import React from 'react';

interface QuickPickerProps {
  companyName: string;
  onSave: (date: Date | null) => void;
  onClose: () => void;
}

export function QuickPicker({ companyName, onSave, onClose }: QuickPickerProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#12151a] border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl p-5 relative">
        <h3 className="text-lg font-semibold text-slate-100 mb-4 text-center leading-snug">
          When should you follow up with<br/>
          <span className="text-blue-400">{companyName}</span>?
        </h3>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[2, 7, 14, 30].map(days => (
            <button 
              key={days}
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() + days);
                onSave(date);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-3 rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1"
            >
              <span className="text-blue-400 font-bold">+{days}</span> days
            </button>
          ))}
          <button 
            onClick={() => {
              onSave(null);
            }}
            className="col-span-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium py-2 rounded-lg border border-red-500/20 transition-colors"
          >
            Clear Follow-up
          </button>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-800">
          <label className="block text-xs font-medium text-slate-400 mb-2">Pick date</label>
          <input 
            type="date" 
            className="w-full bg-black/30 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 [color-scheme:dark]"
            onChange={(e) => {
              if (e.target.value) {
                // Parse date assuming it's in user's local timezone
                const [year, month, day] = e.target.value.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                onSave(date);
              }
            }}
          />
        </div>
        
        <button 
          onClick={onClose}
          className="mt-6 w-full text-center text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
