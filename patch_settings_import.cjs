const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

code = code.replace(
  "import { Settings as SettingsIcon, Save, Download, Upload, Trash2, AlertTriangle, X, MapPin, Wand2 } from 'lucide-react';",
  "import { Settings as SettingsIcon, Save, Download, Upload, Trash2, AlertTriangle, X, MapPin, Wand2, Tag } from 'lucide-react';"
);

fs.writeFileSync('src/components/SettingsView.tsx', code);
console.log("Patched SettingsView import");
