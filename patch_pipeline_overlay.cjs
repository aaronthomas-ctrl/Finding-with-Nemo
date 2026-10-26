const fs = require('fs');
let code = fs.readFileSync('src/components/PipelineView.tsx', 'utf8');

// 1. Add import
if (!code.includes('import { ClientProfileView }')) {
  code = code.replace(
    "import { AddClientModal } from './AddClientModal';",
    "import { AddClientModal } from './AddClientModal';\nimport { ClientProfileView } from './ClientProfileView';"
  );
}

// 2. Add state
code = code.replace(
  "const [search, setSearch] = useState('');",
  "const [search, setSearch] = useState('');\n  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);"
);

// 3. Update onClick handlers
code = code.replace(/onClick=\{\(\) => navigate\(\`\/pipeline\/\$\{client\.id\}\`\)\}/g, "onClick={() => setSelectedClientId(client.id)}");

// 4. Update the render
const originalReturn = `  return (
    <div className="flex flex-col h-full relative">`;

const newReturn = `  return (
    <>
      {selectedClientId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedClientId(null)}></div>
          <div className="relative w-[95vw] md:w-[85vw] lg:w-[1000px] max-w-full h-full bg-[#0c0e12] shadow-2xl animate-in slide-in-from-right-8 duration-300 flex flex-col border-l border-slate-800">
            <ClientProfileView clientId={selectedClientId} onClose={() => setSelectedClientId(null)} />
          </div>
        </div>
      )}
      <div className="flex flex-col h-full relative">`;

code = code.replace(originalReturn, newReturn);
// Make sure to close the React Fragment at the very end of the component
const lastDivIndex = code.lastIndexOf('</div>\n  );');
if (lastDivIndex !== -1) {
  code = code.substring(0, lastDivIndex) + '</div>\n    </>\n  );' + code.substring(lastDivIndex + 14);
}

fs.writeFileSync('src/components/PipelineView.tsx', code);
console.log("Patched PipelineView overlay");
