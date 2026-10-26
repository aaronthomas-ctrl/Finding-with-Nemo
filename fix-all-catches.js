const fs = require('fs');

function addCatch(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Replace `await db.xxx.add(...)` with `await db.xxx.add(...).catch(console.error)`
  code = code.replace(/await\s+db\.([a-zA-Z0-9_]+)\.(add|update|put|delete|clear)\(([\s\S]*?)\);/g, (match) => {
    if (match.includes('.catch(')) return match;
    // But wait, the match could be multiple lines and `([\s\S]*?)` matches until the FIRST `;`.
    // We can just safely replace `;` with `.catch(console.error);`?
    // Actually, just doing `.catch(console.error)` is risky if the await is inside a variable assignment like `const x = await db.x.add();`
    // Let's just do a simpler replacement or use sed for specific files.
    return match;
  });
  
  fs.writeFileSync(filePath, code);
}
