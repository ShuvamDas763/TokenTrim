'use strict';

/**
 * Verification test for the isIndentedCode gate removal fix.
 * Tests that balance-tracked blocks are accepted without the heuristic scorer.
 */

// Inline the segment parser to avoid module resolution issues
const path = require('path');
const parser = require(path.join(__dirname, 'src/main/tier0/segment-parser.js'));

const testInput = `So I keep going back and forth on this, should we cache the response or just refetch every time? Honestly I don't think it matters that much for now but here's what I have:

const settings = {

cacheEnabled: true,

maxRetries: 5,

timeout: 3000

}

function loadUser(id) {

return db.query(id)

}

Anyway let me know if you think this is fine or if I'm missing something obvious.`;

console.log('=== TEST INPUT ===');
console.log(testInput);
console.log('');

const segments = parser.parseSegments(testInput);

console.log('');
console.log('=== SEGMENT SUMMARY ===');
segments.forEach((seg, i) => {
  const preview = seg.content.replace(/\n/g, '\\n').substring(0, 80);
  console.log(`[${i}] ${seg.type.padEnd(12)} protected=${String(seg.protected).padEnd(5)} "${preview}"`);
});

// Count code blocks
const codeBlocks = segments.filter(s => s.type === 'code_block');
console.log(`\n=== RESULTS ===`);
console.log(`Code blocks found: ${codeBlocks.length}`);

if (codeBlocks.length === 2) {
  console.log('✓ PASS: Exactly 2 code blocks detected');
  codeBlocks.forEach((block, i) => {
    console.log(`  Block ${i+1}: ${JSON.stringify(block.content)}`);
  });
} else {
  console.log(`✗ FAIL: Expected 2 code blocks, got ${codeBlocks.length}`);
}

// Check no numbers are extracted from inside code blocks
const numberSegs = segments.filter(s => s.type === 'number');
console.log(`\nStandalone number segments: ${numberSegs.length}`);
if (numberSegs.length === 0) {
  console.log('✓ PASS: No numbers extracted from code blocks');
} else {
  console.log(`✗ FAIL: ${numberSegs.length} numbers leaked out:`);
  numberSegs.forEach(n => console.log(`  "${n.content}"`));
}

// Also test the earlier "const config = {retries, timeout}" case
console.log('\n\n=== TEST 2: const config object ===');
const testInput2 = `Here's the config:

const config = {
  retries: 3,
  timeout: 5000,
  debug: false
}

Does this look right?`;

const segments2 = parser.parseSegments(testInput2);
const codeBlocks2 = segments2.filter(s => s.type === 'code_block');
console.log(`Code blocks found: ${codeBlocks2.length}`);
if (codeBlocks2.length >= 1) {
  console.log('✓ PASS: Config object detected as code block');
  codeBlocks2.forEach((block, i) => {
    console.log(`  Block ${i+1}: ${JSON.stringify(block.content)}`);
  });
} else {
  console.log('✗ FAIL: Config object not detected as code block');
}
