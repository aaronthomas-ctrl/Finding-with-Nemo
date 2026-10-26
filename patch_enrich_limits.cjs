const fs = require('fs');

// Patch server.ts
let serverCode = fs.readFileSync('server.ts', 'utf8');
const oldMask = '"X-Goog-FieldMask": "places.id,places.displayName,places.primaryTypeDisplayName,places.businessStatus"';
const newMask = '"X-Goog-FieldMask": "places.id,places.displayName,places.primaryTypeDisplayName,places.businessStatus,places.googleMapsUri,places.formattedAddress,places.location"';

serverCode = serverCode.replace(oldMask, newMask);
fs.writeFileSync('server.ts', serverCode);

// Patch SettingsView.tsx to remove 1s delay
let settingsCode = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');
settingsCode = settingsCode.replace('await new Promise(res => setTimeout(res, 1000));', 'await new Promise(res => setTimeout(res, 100));');
fs.writeFileSync('src/components/SettingsView.tsx', settingsCode);

// Patch PipelineView.tsx to use businessStatus logic correctly if it exists, wait, we removed it from PipelineView.

console.log("Patched limits and server");
