const fs = require('fs');
let code = fs.readFileSync('src/components/ProspectingView.tsx', 'utf8');

// The pipeline search maps data from data.places to our internal representation.
// Let's make sure googleMapsUri and businessStatus map exactly correctly.
// we already added this mapping in the previous pipeline search in ProspectingView? Let's check.
