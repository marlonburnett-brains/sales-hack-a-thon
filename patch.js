const fs = require('fs');
let code = fs.readFileSync('apps/agent/src/generation/__tests__/multi-source-assembler.test.ts', 'utf8');
code = code.replace(
  'expect(slidesClient.presentations.batchUpdate).toHaveBeenNthCalledWith(2, {',
  'require("fs").writeFileSync("calls.json", JSON.stringify(slidesClient.presentations.batchUpdate.mock.calls[1][0], null, 2));\n    expect(slidesClient.presentations.batchUpdate).toHaveBeenNthCalledWith(2, {'
);
fs.writeFileSync('apps/agent/src/generation/__tests__/multi-source-assembler.test.ts', code);
