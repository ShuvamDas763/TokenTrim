const { compress } = require('./tier0/compressor');

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

console.log("--- RUNNING COMPRESS DIAGNOSTIC ---");
const result = compress(testInput, 3);
console.log("--- FINAL RESULT ---");
console.log(result.result);
