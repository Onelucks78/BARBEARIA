// fix script: replace setProfileError'string' → setProfileError('string'
import fs from 'fs';
let s = fs.readFileSync('src/components/VisitorLayout.tsx', 'utf8');
s = s.replace(/setProfileError'/g, "setProfileError('");
s = s.replace(/setProfileErrorerr/g, "setProfileError(err");
fs.writeFileSync('src/components/VisitorLayout.tsx', s);
console.log('OK');
