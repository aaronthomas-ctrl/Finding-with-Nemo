const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

// Update sorting logic
const filterTarget = `      let clientsToEnrich = validClients;
      if (!enrichForceReTag) {
        clientsToEnrich = clientsToEnrich.filter((c: any) => !c.autoTagged);
      }`;
const filterReplacement = `      let clientsToEnrich = validClients;
      if (!enrichForceReTag) {
        clientsToEnrich = clientsToEnrich.filter((c: any) => !c.autoTagged);
      } else {
        // If force re-tagging, sort by oldest enrichment first so it cycles through the database
        clientsToEnrich.sort((a: any, b: any) => (a.lastMapEnrich || 0) - (b.lastMapEnrich || 0));
      }`;
      
code = code.replace(filterTarget, filterReplacement);

// Update saving logic to include lastMapEnrich
const saveTarget1 = `await db.clients.update(c.id, {
                  tags: updatedTags,
                  autoTagged: true,
                  ...statusUpdate
                });`;
const saveReplacement1 = `await db.clients.update(c.id, {
                  tags: updatedTags,
                  autoTagged: true,
                  lastMapEnrich: Date.now(),
                  ...statusUpdate
                });`;

const saveTarget2 = `await db.clients.update(c.id, { autoTagged: true, ...statusUpdate });`;
const saveReplacement2 = `await db.clients.update(c.id, { autoTagged: true, lastMapEnrich: Date.now(), ...statusUpdate });`;

const saveTarget3 = `await db.clients.update(c.id, { autoTagged: true });`;
const saveReplacement3 = `await db.clients.update(c.id, { autoTagged: true, lastMapEnrich: Date.now() });`;

code = code.replace(saveTarget1, saveReplacement1);
code = code.replace(saveTarget2, saveReplacement2);
code = code.replace(saveTarget3, saveReplacement3);

fs.writeFileSync('src/components/SettingsView.tsx', code);
console.log("Patched enrichment cycling logic");
