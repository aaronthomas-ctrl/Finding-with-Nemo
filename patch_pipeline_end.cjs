const fs = require('fs');
let code = fs.readFileSync('src/components/PipelineView.tsx', 'utf8');

if (!code.endsWith('}')) {
  // Let's check how it ends.
  if (code.endsWith('  );')) {
    code += '\n}\n';
  } else if (code.endsWith('  );\n')) {
    code += '}\n';
  } else if (code.trim().endsWith(');')) {
    code += '\n}\n';
  }
}

fs.writeFileSync('src/components/PipelineView.tsx', code);
