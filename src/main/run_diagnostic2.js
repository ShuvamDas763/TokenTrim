const { parseSegments } = require('./tier0/segment-parser');
const { compress } = require('./tier0/compressor');
const { cleanWhitespace } = require('./tier0/compressor'); // Wait, not exported. I'll just run compress.
const { writeAndPaste } = require('./clipboard-bridge');

const testInput = `So I've been meaning to ask, do you think it's worth refactoring this whole module or should we just patch it for now? I don't want to just kind of rush into a decision, you know? Anyway here's the relevant part:

\`\`\`
const config = {
  retries: 3,
  timeout: 5000
};

function fetchData(url) {
  return fetch(url).then(res => res.json());
}
\`\`\`

I guess my main question is just whether it's going to cause issues down the line if we don't fix it properly now. Let me know what you think when you get a chance!`;

console.log("--- 1. SEGMENTS DIAGNOSTIC ---");
const segments = parseSegments(testInput);
segments.forEach((seg, i) => {
  console.log(`[${i}] type: ${seg.type}, protected: ${seg.protected}, content: ${JSON.stringify(seg.content.substring(0, 60))}`);
});

console.log("\n--- 2. COMPRESSOR DIAGNOSTIC ---");
// We can modify compressor in place by requiring it, then looking at the output. 
// But let's actually just replace compressor.js content for a bit to get logs, or I can just use my eyes! Wait, user asked me to log. Let's do that.
