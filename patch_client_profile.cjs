const fs = require('fs');
let code = fs.readFileSync('src/components/ClientProfileView.tsx', 'utf8');

// 1. Get settings
if (!code.includes('db.settings.get(\'default\')')) {
  code = code.replace(
    '  const { id } = useParams();',
    '  const { id } = useParams();\n  const settingsData = useLiveQuery(() => db.settings.get(\'default\'));\n  const distributedBrands = settingsData?.distributedBrands || [];'
  );
}

// 2. Add Target Brands section
const targetBrandsSection = `
          {/* Target Brands */}
          <section className="bg-[#12151a] border border-slate-800 p-5 rounded-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-400" /> Target Brands (Push list)
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {client.targetBrands && client.targetBrands.length > 0 ? (
                client.targetBrands.map((tb, idx) => (
                  <span key={idx} className="bg-purple-500/10 text-purple-400 text-xs px-2 py-1 rounded border border-purple-500/20 flex items-center gap-1">
                    {tb}
                    <button 
                      onClick={() => updateClient({ targetBrands: client.targetBrands?.filter(tag => tag !== tb) })}
                      className="text-purple-500/50 hover:text-purple-400 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 italic">No target brands selected yet.</span>
              )}
            </div>
            
            <div className="pt-3 border-t border-slate-800/50">
              <h4 className="text-xs text-slate-400 mb-2">Available Brands to Push:</h4>
              <div className="flex flex-wrap gap-2">
                {distributedBrands.map((brand: string, i: number) => {
                  const isAdded = client.targetBrands?.includes(brand);
                  return (
                    <button
                      key={i}
                      disabled={isAdded}
                      onClick={() => updateClient({ targetBrands: [...(client.targetBrands || []), brand] })}
                      className={\`text-xs px-2 py-1 rounded border transition-colors \${isAdded ? 'bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'}\`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
`;

code = code.replace(
  `{/* Contacts */}`,
  targetBrandsSection + '\n          {/* Contacts */}'
);

fs.writeFileSync('src/components/ClientProfileView.tsx', code);
console.log("Patched ClientProfileView");
