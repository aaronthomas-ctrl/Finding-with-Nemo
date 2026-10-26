const fs = require('fs');
let code = fs.readFileSync('server/agent.ts', 'utf8');
code = code.replace('{ googleSearch: {} },', '');
fs.writeFileSync('server/agent.ts', code);
