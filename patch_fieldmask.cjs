const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');
const oldMask = '"X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.rating,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.regularOpeningHours,nextPageToken"';
const newMask = '"X-Goog-FieldMask": "places.id,places.displayName,places.primaryTypeDisplayName,places.businessStatus"';

code = code.replace(oldMask, newMask);
fs.writeFileSync('server.ts', code);
console.log("Optimized FieldMask");
