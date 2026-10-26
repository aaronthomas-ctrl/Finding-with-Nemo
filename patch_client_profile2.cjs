const fs = require('fs');
let code = fs.readFileSync('src/components/ClientProfileView.tsx', 'utf8');

code = code.replace(
  'const { id } = useParams<{ id: string }>();',
  'const { id } = useParams<{ id: string }>();\n  const settingsData = useLiveQuery(() => db.settings.get(\\\'default\\\'));\n  const distributedBrands = settingsData?.distributedBrands || [];'
);

fs.writeFileSync('src/components/ClientProfileView.tsx', code);
console.log("Patched ClientProfileView again");
