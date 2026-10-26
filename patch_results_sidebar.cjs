const fs = require('fs');
let code = fs.readFileSync('src/components/ResultsSidebar.tsx', 'utf8');

const targetStr = `                  <span className="inline-block bg-blue-900/40 text-blue-400 text-[10px] px-2 py-0.5 rounded border border-blue-800/50">
                    {c.category}
                  </span>`;
const newStr = `                  <span className="inline-block bg-blue-900/40 text-blue-400 text-[10px] px-2 py-0.5 rounded border border-blue-800/50">
                    {c.category}
                  </span>
                  {c.businessStatus && c.businessStatus !== 'OPERATIONAL' && (
                    <span className="inline-block bg-red-900/40 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-800/50">
                      {c.businessStatus}
                    </span>
                  )}`;

if(code.includes(targetStr)) {
  code = code.replace(targetStr, newStr);
  fs.writeFileSync('src/components/ResultsSidebar.tsx', code);
  console.log("Patched ResultsSidebar tags");
} else {
    console.log("Target string not found.");
}
