const { compress } = require('./src/main/tier0/compressor');
const { parseSegments } = require('./src/main/tier0/segment-parser');

const testMessage = `"Here is a filler-heavy prose. I just wanted to say that I think we should rewrite this in order to make it faster.

And here is some unrelated code:

\`\`\`javascript
function test() {
  return "I just wanted to say that";
}
\`\`\`

Hopefully this makes sense, let me know."`;

console.log("--- Segment parsing test ---");
const segments = parseSegments(testMessage);
segments.forEach((seg, i) => {
  let preview = seg.content.substring(0, 40).replace(/\n/g, '\\n');
  if (seg.content.length > 40) preview += '...';
  console.log(`[${i}] type=${seg.type}, protected=${seg.protected}, content="${preview}"`);
});

console.log("\n--- Compression test ---");
const result = compress(testMessage, 2);
console.log("Removals:", result.removals);

console.log("\n--- Compressed output ---");
console.log(result.result);
