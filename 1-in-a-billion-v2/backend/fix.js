const fs = require('fs');
const file = 'src/promptEngine/triggerEngine/overlayTrigger.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/system\\\\'s/g, "system\\'s");
content = content.replace(/\.join\('\\\\n'\)/g, ".join('\\n')");
fs.writeFileSync(file, content);
console.log('Fixed file');
