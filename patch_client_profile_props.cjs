const fs = require('fs');
let code = fs.readFileSync('src/components/ClientProfileView.tsx', 'utf8');

code = code.replace(
  'export function ClientProfileView() {',
  'export function ClientProfileView({ clientId, onClose }: { clientId?: string; onClose?: () => void }) {'
);

code = code.replace(
  'const { id } = useParams<{ id: string }>();',
  'const { id: paramId } = useParams<{ id: string }>();\n  const id = clientId || paramId;'
);

code = code.replace(
  'onClick={() => navigate(-1)}',
  'onClick={() => { if (onClose) onClose(); else navigate(-1); }}'
);

fs.writeFileSync('src/components/ClientProfileView.tsx', code);
