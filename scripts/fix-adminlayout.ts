// scripts/fix-adminlayout.ts
// Limpa o AdminLayout.tsx: remove 'Content-Type' órfão e converte body: JSON.stringify(x) → body: x
import fs from 'fs';

const path = 'src/components/AdminLayout.tsx';
let src = fs.readFileSync(path, 'utf8');

// Remove 'Content-Type': 'application/json', (órfão em init)
src = src.replace(/^\s*'Content-Type':\s*'application\/json',?\s*$/gm, '');

// Converte body: JSON.stringify(xxx) → body: xxx  (precisa balancear parênteses)
src = src.replace(/body:\s*JSON\.stringify\(([\s\S]*?)\)(?=\s*\n\s*}\s*\))/g, 'body: $1');

fs.writeFileSync(path, src);
console.log('OK');
