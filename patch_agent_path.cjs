const fs = require('fs');
let code = fs.readFileSync('server/agent.ts', 'utf8');

const target = `const path = currentPath || []; // Array of {lat, lng} from the UI`;
const replacement = `let path = currentPath || [];
        if (path.length === 0 && currentBounds) {
          path = [
            { lat: currentBounds.low.latitude, lng: currentBounds.low.longitude },
            { lat: currentBounds.low.latitude, lng: currentBounds.high.longitude },
            { lat: currentBounds.high.latitude, lng: currentBounds.high.longitude },
            { lat: currentBounds.high.latitude, lng: currentBounds.low.longitude }
          ];
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('server/agent.ts', code);
console.log("Patched agent.ts path logic");
