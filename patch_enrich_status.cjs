const fs = require('fs');
let code = fs.readFileSync('src/components/PipelineView.tsx', 'utf8');

// We need to inject the businessStatus logic inside the enrichment loop
const searchString = `            if (category) {
              const updatedTags = Array.from(new Set([...(c.tags || []), category]));
              await db.clients.update(c.id, {
                tags: updatedTags,
                autoTagged: true
              });
              log += \`[SUCCESS] \${c.name}: Added category '\${category}'\\n\`;
              successCount++;
            } else {
              await db.clients.update(c.id, { autoTagged: true });
              log += \`[SKIPPED] \${c.name}: Google Maps profile found, but no primary category listed.\\n\`;
              failCount++;
            }`;

const replaceString = `            const businessStatus = place.businessStatus;
            let statusUpdate: any = {};
            
            if (businessStatus === 'CLOSED_PERMANENTLY') {
              statusUpdate.status = 'Closed Permanently';
            } else if (businessStatus === 'CLOSED_TEMPORARILY') {
              statusUpdate.status = 'Closed Temporarily';
            }
            
            if (category) {
              const updatedTags = Array.from(new Set([...(c.tags || []), category]));
              await db.clients.update(c.id, {
                tags: updatedTags,
                autoTagged: true,
                ...statusUpdate
              });
              let statusMsg = statusUpdate.status ? \` (\${statusUpdate.status})\` : '';
              log += \`[SUCCESS] \${c.name}: Added category '\${category}'\${statusMsg}\\n\`;
              successCount++;
            } else {
              await db.clients.update(c.id, { autoTagged: true, ...statusUpdate });
              let statusMsg = statusUpdate.status ? \` (\${statusUpdate.status})\` : '';
              log += \`[SKIPPED] \${c.name}: Google Maps profile found\${statusMsg}, but no primary category listed.\\n\`;
              failCount++;
            }`;

code = code.replace(searchString, replaceString);

fs.writeFileSync('src/components/PipelineView.tsx', code);
console.log("Patched PipelineView.tsx with businessStatus logic");
