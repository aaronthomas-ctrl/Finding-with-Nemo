const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

const target = `<div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">`;
const replacement = `<div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

        <section className="bg-[#12151a] border border-slate-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
            <Tag className="w-5 h-5 text-slate-400" /> Brands We Distribute
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Manage the list of brands you distribute. These will be available as tags in the Customer Profile.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {(settings.distributedBrands || []).map((brand, i) => (
              <span key={i} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-300 flex items-center gap-2">
                {brand}
                <button 
                  onClick={() => setSettings(prev => prev ? {...prev, distributedBrands: prev.distributedBrands?.filter(b => b !== brand)} : prev)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-sm">
            <input 
              type="text" 
              id="new-brand-input"
              placeholder="Add new brand..."
              className="flex-1 bg-[#1e222a] border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.trim();
                  if (val && !settings.distributedBrands?.includes(val)) {
                    setSettings(prev => prev ? {...prev, distributedBrands: [...(prev.distributedBrands || []), val]} : prev);
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
            <button 
              onClick={() => {
                const input = document.getElementById('new-brand-input') as HTMLInputElement;
                const val = input.value.trim();
                if (val && !settings.distributedBrands?.includes(val)) {
                  setSettings(prev => prev ? {...prev, distributedBrands: [...(prev.distributedBrands || []), val]} : prev);
                }
                input.value = '';
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded transition-colors"
            >
              Add
            </button>
          </div>
        </section>`;

code = code.replace(target, replacement);

// Also add the 'Tag' and 'X' icons if not present
if (!code.includes('Tag,')) {
    code = code.replace(`import { Settings as SettingsIcon, Save, Upload, Trash2, Download, Search, Play, AlertTriangle } from 'lucide-react';`, 
    `import { Settings as SettingsIcon, Save, Upload, Trash2, Download, Search, Play, AlertTriangle, Tag, X } from 'lucide-react';`);
} else {
    code = code.replace(`import { Settings as SettingsIcon, Save, Upload, Trash2, Download, Search, Play, AlertTriangle, X } from 'lucide-react';`,
    `import { Settings as SettingsIcon, Save, Upload, Trash2, Download, Search, Play, AlertTriangle, X, Tag } from 'lucide-react';`);
}

fs.writeFileSync('src/components/SettingsView.tsx', code);
console.log("Patched SettingsView with Brands");
