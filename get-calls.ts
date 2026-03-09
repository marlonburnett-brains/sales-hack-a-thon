import fs from 'fs';
const content = fs.readFileSync('apps/agent/src/generation/__tests__/multi-source-assembler.test.ts', 'utf8');
const testName = 'copies the primary source, rebuilds supported secondary elements';
const lines = content.split('\n');
let inTest = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(testName)) {
    inTest = true;
  }
}
