const fs = require('fs');
const oldStr = fs.readFileSync('old-block.txt', 'utf8');
const newStr = fs.readFileSync('new-block.txt', 'utf8');
let code = fs.readFileSync('apps/agent/src/generation/__tests__/multi-source-assembler.test.ts', 'utf8');
if (code.includes(oldStr)) {
  code = code.replace(oldStr, newStr);
  fs.writeFileSync('apps/agent/src/generation/__tests__/multi-source-assembler.test.ts', code);
  console.log("Success");
} else {
  console.log("Old string not found in file");
}
