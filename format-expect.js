const calls = require('./apps/agent/calls.json');

// Convert object to string without quoting keys when possible
function stringify(obj, indent = "") {
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const nextIndent = indent + "  ";
    const items = obj.map(item => nextIndent + stringify(item, nextIndent)).join(",\n");
    return "[\n" + items + "\n" + indent + "]";
  } else if (obj !== null && typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    const nextIndent = indent + "  ";
    const props = keys.map(k => {
      const keyStr = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `"${k}"`;
      return nextIndent + keyStr + ": " + stringify(obj[k], nextIndent);
    }).join(",\n");
    return "{\n" + props + "\n" + indent + "}";
  } else if (typeof obj === "string") {
    return `"${obj.replace(/\n/g, '\\n')}"`;
  }
  return String(obj);
}

const formatted = `    expect(slidesClient.presentations.batchUpdate).toHaveBeenNthCalledWith(2, ${stringify(calls, "    ")});\n`;
require('fs').writeFileSync('new-block.txt', formatted);
