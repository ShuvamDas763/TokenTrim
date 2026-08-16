'use strict';

const compressor = require('./src/main/tier0/compressor');

const testA = `Here's the function I wrote: \n\n\n\n\`\`\`python\n\n   def process(data):\n\n       return [x for x in data if x > 0]\n\n\`\`\`\n\n\n\n   I think maybe this could be optimized`;
const resA = compressor.compress(testA, 1);
console.log("=== TEST A (Code Block) ===");
console.log(resA.result);
console.log("===========================\n");

const test7 = "I think we should use this approach: `const x = 5;` — it's simpler I feel";
const res7 = compressor.compress(test7, 1);
console.log("=== TEST 7 (Inline Code) ===");
console.log(res7.result);
console.log("============================\n");

const testB = 'As the docs say: "always validate input" and check https://example.com/docs — I think that\'s solid advice';
const resB = compressor.compress(testB, 1);
console.log("=== TEST B (Quote + URL) ===");
console.log(resB.result);
console.log("============================\n");
