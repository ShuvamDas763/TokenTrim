const { compress } = require('./src/main/tier0/compressor');
const { parseSegments } = require('./src/main/tier0/segment-parser');

const text = "I just wanted to say that I think we should rewrite this in order to make it faster. Here is the code:\n```javascript\nfunction test() {\n  return \"I just wanted to say that\";\n}\n```\nAlso check https://example.com/in-order-to\nIf that makes sense, let me know.";

console.log("Original text:\n" + text + "\n");
const result = compress(text, 2);
console.log("Compressed text:\n" + result.result + "\n");
console.log("Removals:", result.removals);
