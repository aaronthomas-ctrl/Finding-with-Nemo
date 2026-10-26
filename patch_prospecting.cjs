const fs = require('fs');
let code = fs.readFileSync('src/components/ProspectingView.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { v4 as uuidv4 } from 'uuid';",
  "import { v4 as uuidv4 } from 'uuid';\nimport { checkDuplicate, saveCompanyToPipeline } from '../lib/pipeline';"
);

// 2. Update saveZone
const saveZoneOld = `  const saveZone = async (name: string, tags: string[]) => {
    if (!customPath) return;
    const id = uuidv4();
    const encodedName = tags && tags.length > 0 ? \`\${name} ||| \${tags.join(',')}\` : name;
    
    // For DB
    const dbZone: any = {
      id,
      name: encodedName,
      path: customPath,
      createdAt: new Date().toISOString()
    };
    
    // For UI
    const uiZone: PolygonZone = {
      id,
      name,
      path: customPath,
      createdAt: new Date().toISOString(),
      tags
    };

    try {
      await db.searchZones.add(dbZone);
      setSavedZones(prev => [...prev, uiZone]);
    } catch (err) {
      console.error("Error saving zone:", err);
      alert("Failed to save zone to database: " + (err.message || err));
    }
  };`;

const saveZoneNew = `  const saveZone = async (name: string, tags: string[]) => {
    if (!customPath) return;
    const id = uuidv4();
    const encodedName = tags && tags.length > 0 ? \`\${name} ||| \${tags.join(',')}\` : name;
    
    // For DB
    const dbZone: any = {
      id,
      name: encodedName,
      path: customPath,
      createdAt: new Date().toISOString()
    };
    
    // For UI
    const uiZone: PolygonZone = {
      id,
      name,
      path: customPath,
      createdAt: new Date().toISOString(),
      tags
    };

    try {
      await db.searchZones.add(dbZone);
      setSavedZones(prev => [...prev, uiZone]);

      // Auto-save the companies currently inside this drawn zone
      if (companies && companies.length > 0) {
        let savedCount = 0;
        const inZone = companies.filter(c => 
          c.location && pointInPolygon({ lat: c.location.latitude, lng: c.location.longitude }, customPath)
        );
        
        for (const c of inZone) {
          if (!c.isSaved) {
            const dedupe = await checkDuplicate(c);
            if (!dedupe.isDuplicate) {
              await saveCompanyToPipeline(c);
              c.isSaved = true; // Update local state so it shows as saved
              savedCount++;
            }
          }
        }
        if (savedCount > 0) {
          setCompanies([...companies]); // force re-render
          console.log(\`Auto-saved \${savedCount} leads inside the new zone.\`);
        }
      }

    } catch (err: any) {
      console.error("Error saving zone:", err);
      alert("Failed to save zone to database: " + (err.message || err));
    }
  };`;

code = code.replace(saveZoneOld, saveZoneNew);
fs.writeFileSync('src/components/ProspectingView.tsx', code);
console.log("Patched ProspectingView");
