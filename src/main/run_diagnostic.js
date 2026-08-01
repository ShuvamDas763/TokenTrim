const { parseSegments } = require('./tier0/segment-parser');
const { compress } = require('./tier0/compressor');
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

console.log("--- START DIAGNOSTIC ---");

// Monkey-patch segment-parser
const originalParseSegments = parseSegments;
const patchedParseSegments = (text) => {
  const segments = originalParseSegments(text);
  console.log('--- DIAGNOSTIC: SEGMENTS ---');
  segments.forEach((seg, i) => {
    console.log(`[${i}] type: ${seg.type}, protected: ${seg.protected}, content: ${JSON.stringify(seg.content.substring(0, 60))}`);
  });
  console.log('----------------------------');
  return segments;
};
require.cache[require.resolve('./tier0/segment-parser')].exports.parseSegments = patchedParseSegments;

// Monkey-patch compressor to log before and after cleanWhitespace
// Wait, I can't easily monkeypatch inner functions of compressor.js unless I modify the file.
// Let's modify compressor.js for the test.
