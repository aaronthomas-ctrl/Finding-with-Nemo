const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

// 1. Add "All" option to dropdown and change default state
code = code.replace("useState('50')", "useState('All')");
code = code.replace(
  '<option value="250">250 Clients at a time</option>',
  '<option value="250">250 Clients at a time</option>\n                <option value="All">All Clients</option>'
);

// 2. Fix batch limit logic
const limitTarget = `const batchLimit = parseInt(enrichBatchSize, 10) || 50;
      clientsToEnrich = clientsToEnrich.slice(0, batchLimit);`;
const limitReplacement = `const batchLimit = enrichBatchSize === 'All' ? clientsToEnrich.length : (parseInt(enrichBatchSize, 10) || 50);
      clientsToEnrich = clientsToEnrich.slice(0, batchLimit);`;
code = code.replace(limitTarget, limitReplacement);

// 3. Update logging to include full output
const successTarget = `let statusMsg = statusUpdate.status ? \` (\${statusUpdate.status})\` : '';
                log += \`[SUCCESS] \${c.name}: Added category '\${category}'\${statusMsg}\\n\`;
                successCount++;`;
const successReplacement = `let statusMsg = statusUpdate.status ? \` (\${statusUpdate.status})\` : '';
                log += \`[SUCCESS] \${c.name}: Added category '\${category}'\${statusMsg}\\n    Raw API Output: \${JSON.stringify(place)}\\n\`;
                successCount++;`;
code = code.replace(successTarget, successReplacement);

const skipTarget = `let statusMsg = statusUpdate.status ? \` (\${statusUpdate.status})\` : '';
                log += \`[SKIPPED] \${c.name}: Google Maps profile found\${statusMsg}, but no primary category listed.\\n\`;
                failCount++;`;
const skipReplacement = `let statusMsg = statusUpdate.status ? \` (\${statusUpdate.status})\` : '';
                log += \`[SKIPPED] \${c.name}: Google Maps profile found\${statusMsg}, but no primary category listed.\\n    Raw API Output: \${JSON.stringify(place)}\\n\`;
                failCount++;`;
code = code.replace(skipTarget, skipReplacement);

// 4. Increase interval
const intervalTarget = `await new Promise(res => setTimeout(res, 100));`;
const intervalReplacement = `await new Promise(res => setTimeout(res, 300)); // Increased interval to protect against rate limits on full list`;
code = code.replace(intervalTarget, intervalReplacement);

fs.writeFileSync('src/components/SettingsView.tsx', code);
console.log("Patched full list & logging");
