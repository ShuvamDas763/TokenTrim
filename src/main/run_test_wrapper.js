// Self-running wrapper: executes test and writes output to file
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, 'test_output.txt');

try {
  const result = execSync('node test_segment_parser.js', {
    cwd: __dirname,
    encoding: 'utf8',
    timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  fs.writeFileSync(outFile, result + '\n\nSTDERR: (none)\nEXIT: 0\n');
} catch (err) {
  const out = (err.stdout || '') + '\n\nSTDERR:\n' + (err.stderr || '') + '\nEXIT: ' + err.status + '\n';
  fs.writeFileSync(outFile, out);
}
