const fs = require('fs');
let code = fs.readFileSync('src/components/ResultsSidebar.tsx', 'utf8');

const targetStr = `                  {c.website && (
                    <div className="flex gap-2 items-center">
                      <Globe className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
                        {c.website.replace(/^https?:\\/\\/(www\\.)?/, '')}
                      </a>
                    </div>
                  )}`;
const newStr = `                  {c.website && (
                    <div className="flex gap-2 items-center">
                      <Globe className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-[200px]">
                        {c.website.replace(/^https?:\\/\\/(www\\.)?/, '')}
                      </a>
                    </div>
                  )}
                  {c.googleMapsUri && (
                    <div className="flex gap-2 items-center">
                      <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <a href={c.googleMapsUri} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline truncate max-w-[200px]">
                        View on Google Maps
                      </a>
                    </div>
                  )}`;

if(code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('src/components/ResultsSidebar.tsx', code);
  console.log("Patched ResultsSidebar Maps url");
} else {
    console.log("Target string not found.");
}
