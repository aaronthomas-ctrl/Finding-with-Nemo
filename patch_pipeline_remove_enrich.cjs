const fs = require('fs');
let code = fs.readFileSync('src/components/PipelineView.tsx', 'utf8');

// Remove Maps Enrich function block safely using regex boundaries or string index
const startIndex = code.indexOf("const handleBulkEnrichMaps = async () => {");
const endIndex = code.indexOf("const { filteredClients, uniqueTags, uniqueStatuses }", startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + code.substring(endIndex);
}

// Remove the button
const buttonRegex = /<button\s+onClick=\{handleBulkEnrichMaps\}[\s\S]*?<\/button>/;
code = code.replace(buttonRegex, "");

// Remove the state variables for enrichment to avoid TS warnings
code = code.replace("const [isMapEnriching, setIsMapEnriching] = useState(false);", "");
code = code.replace("const [mapEnrichProgress, setMapEnrichProgress] = useState({ current: 0, total: 0 });", "");
code = code.replace("const [mapEnrichMessage, setMapEnrichMessage] = useState('');", "");

fs.writeFileSync('src/components/PipelineView.tsx', code);
console.log("Pipeline updated!");
