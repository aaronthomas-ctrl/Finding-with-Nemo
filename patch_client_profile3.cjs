const fs = require('fs');
let code = fs.readFileSync('src/components/ClientProfileView.tsx', 'utf8');

code = code.replace(
  'db.settings.get(\\\'default\\\')',
  'db.settings.get("default")'
);

fs.writeFileSync('src/components/ClientProfileView.tsx', code);
console.log("Fixed escaped quotes");
