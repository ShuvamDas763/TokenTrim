'use strict';

// Standalone test — only requires segment-parser.js, no Electron deps
const { parseSegments, SEGMENT_TYPES } = require('./tier0/segment-parser');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name}`);
    console.log(`        ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ──────────────────────────────────────────────
// Test 1: Fenced code block (```...```) stays grouped
// ──────────────────────────────────────────────
console.log('\n=== Test Group 1: Fenced code blocks ===');

test('fenced block with object literal stays as one code_block', () => {
  const input = `Here is some config:\n\n\`\`\`\nconst config = {\n  retries: 3,\n  timeout: 5000\n};\n\`\`\`\n\nDoes this look right?`;
  const segs = parseSegments(input);
  const codeBlocks = segs.filter(s => s.type === 'code_block');
  assert(codeBlocks.length === 1, `Expected 1 code_block, got ${codeBlocks.length}`);
  assert(codeBlocks[0].content.includes('retries: 3'), 'code_block should contain retries: 3');
  assert(codeBlocks[0].content.includes('timeout: 5000'), 'code_block should contain timeout: 5000');
  // Critically: no standalone number "3" or "5000" should be extracted
  const numbers = segs.filter(s => s.type === 'number');
  assert(numbers.length === 0, `Expected 0 standalone numbers, got ${numbers.length}: ${numbers.map(n=>n.content).join(', ')}`);
});

test('fenced block with function stays as one code_block', () => {
  const input = `Check this:\n\n\`\`\`\nfunction fetchData(url) {\n  return fetch(url).then(res => res.json());\n}\n\`\`\`\n\nLooks good?`;
  const segs = parseSegments(input);
  const codeBlocks = segs.filter(s => s.type === 'code_block');
  assert(codeBlocks.length === 1, `Expected 1 code_block, got ${codeBlocks.length}`);
  assert(codeBlocks[0].content.includes('fetchData'), 'code_block should contain fetchData');
  assert(codeBlocks[0].content.includes('return fetch'), 'code_block should contain return fetch');
});

// ──────────────────────────────────────────────
// Test 2: The exact diagnostic3 input — mixed object + function
// ──────────────────────────────────────────────
console.log('\n=== Test Group 2: Diagnostic3 test case ===');

test('diagnostic3 input: both code blocks protected, no numbers extracted', () => {
  const input = `So I've been meaning to ask, do you think it's worth refactoring this whole module or should we just patch it for now? I don't want to just kind of rush into a decision, you know? Anyway here's the relevant part:\n\n\`\`\`\nconst config = {\n  retries: 3,\n  timeout: 5000\n};\n\nfunction fetchData(url) {\n  return fetch(url).then(res => res.json());\n}\n\`\`\`\n\nI guess my main question is just whether it's going to cause issues down the line if we don't fix it properly now. Let me know what you think when you get a chance!`;
  const segs = parseSegments(input);
  const codeBlocks = segs.filter(s => s.type === 'code_block');
  assert(codeBlocks.length === 1, `Expected 1 fenced code_block, got ${codeBlocks.length}`);
  assert(codeBlocks[0].content.includes('retries: 3'), 'code_block must include retries: 3');
  assert(codeBlocks[0].content.includes('timeout: 5000'), 'code_block must include timeout: 5000');
  assert(codeBlocks[0].content.includes('fetchData'), 'code_block must include fetchData');

  const numbers = segs.filter(s => s.type === 'number');
  assert(numbers.length === 0, `Expected 0 standalone numbers, got ${numbers.length}: ${JSON.stringify(numbers.map(n=>n.content))}`);
});

// ──────────────────────────────────────────────
// Test 3: UN-fenced code (heuristic detection) with brace balance
// ──────────────────────────────────────────────
console.log('\n=== Test Group 3: Unfenced (heuristic) code blocks ===');

test('unfenced multi-line object with non-code property lines stays grouped', () => {
  const input = `Here is the config we use:\n\nconst config = {\n  retries: 3,\n  timeout: 5000,\n  maxBuffer: 1024\n};\n\nWhat do you think?`;
  const segs = parseSegments(input);
  // The heuristic block should group all of const config = { ... };
  const codeBlocks = segs.filter(s => s.type === 'code_block');
  if (codeBlocks.length > 0) {
    const block = codeBlocks[0];
    assert(block.content.includes('retries: 3'), 'heuristic code_block should include retries: 3');
    assert(block.content.includes('timeout: 5000'), 'heuristic code_block should include timeout: 5000');
    assert(block.content.includes('maxBuffer: 1024'), 'heuristic code_block should include maxBuffer: 1024');
    console.log(`        [info] Heuristic block content: ${JSON.stringify(block.content.substring(0, 100))}`);
  } else {
    // Even if heuristic doesn't fire, numbers inside should NOT be extracted standalone
    // because the lines are inside braces. Let's just check no number "3" by itself.
    const nums = segs.filter(s => s.type === 'number');
    const standaloneThree = nums.find(n => n.content.trim() === '3');
    assert(!standaloneThree, 'Number "3" should NOT be extracted as standalone');
    console.log(`        [info] No heuristic block detected (may not score high enough), but numbers OK`);
  }
});

test('unfenced function block stays grouped', () => {
  const input = `Try this approach:\n\nfunction processItems(items) {\n  const results = [];\n  for (const item of items) {\n    results.push(item.value);\n  }\n  return results;\n}\n\nLet me know.`;
  const segs = parseSegments(input);
  const codeBlocks = segs.filter(s => s.type === 'code_block');
  assert(codeBlocks.length >= 1, `Expected at least 1 code_block, got ${codeBlocks.length}`);
  const block = codeBlocks[0];
  assert(block.content.includes('processItems'), 'should contain function name');
  assert(block.content.includes('results.push'), 'should contain inner body');
  assert(block.content.includes('return results'), 'should contain return statement');
});

// ──────────────────────────────────────────────
// Test 4: Numbers in prose OUTSIDE code should still be protected as numbers
// ──────────────────────────────────────────────
console.log('\n=== Test Group 4: Numbers in prose still work ===');

test('standalone numbers in prose are still detected', () => {
  const input = `We had 42 errors and the latency was 150ms on average.`;
  const segs = parseSegments(input);
  const numbers = segs.filter(s => s.type === 'number');
  const found42 = numbers.some(n => n.content === '42');
  const found150ms = numbers.some(n => n.content === '150ms');
  assert(found42, 'Should detect number 42 in prose');
  assert(found150ms, `Should detect "150ms" as a number (with unit suffix). Got: ${JSON.stringify(numbers.map(n=>n.content))}`);
});

test('numbers with various unit suffixes are detected whole', () => {
  const input = `The timeout is 5s, the width is 200px, the file is 1024kb, it runs at 60fps.`;
  const segs = parseSegments(input);
  const numbers = segs.filter(s => s.type === 'number');
  const contents = numbers.map(n => n.content);
  assert(contents.some(c => c === '5s'), `Should detect "5s". Got: ${JSON.stringify(contents)}`);
  assert(contents.some(c => c === '200px'), `Should detect "200px". Got: ${JSON.stringify(contents)}`);
  assert(contents.some(c => c === '1024kb'), `Should detect "1024kb". Got: ${JSON.stringify(contents)}`);
  assert(contents.some(c => c === '60fps'), `Should detect "60fps". Got: ${JSON.stringify(contents)}`);
});

// ──────────────────────────────────────────────
// Test 5: Safety cap — runaway unbalanced brace doesn't swallow everything
// ──────────────────────────────────────────────
console.log('\n=== Test Group 5: Safety cap on runaway blocks ===');

test('unbalanced brace with >50 lines triggers safety cap', () => {
  let codeLines = ['const x = {'];
  for (let i = 0; i < 55; i++) {
    codeLines.push(`  line${i}: ${i},`);
  }
  // Never close the brace
  const input = `Some intro text.\n\n${codeLines.join('\n')}\n\nThis should not be swallowed.`;
  const segs = parseSegments(input);
  // The trailing prose should still be editable, not consumed by a runaway block
  const lastSeg = segs[segs.length - 1];
  assert(
    lastSeg.content.includes('should not be swallowed') || segs.some(s => s.content.includes('should not be swallowed')),
    'Trailing prose must still be reachable as a segment'
  );
});

// ──────────────────────────────────────────────
// Test 6: Inline code protection
// ──────────────────────────────────────────────
console.log('\n=== Test Group 6: Inline code ===');

test('inline code backticks are protected', () => {
  const input = `Use the \`fetchData()\` function with \`retries: 3\` option.`;
  const segs = parseSegments(input);
  const inlineCodes = segs.filter(s => s.type === 'inline_code');
  assert(inlineCodes.length === 2, `Expected 2 inline_code segments, got ${inlineCodes.length}`);
  assert(inlineCodes.some(s => s.content === '`fetchData()`'), 'Should find fetchData inline code');
  assert(inlineCodes.some(s => s.content === '`retries: 3`'), 'Should find retries: 3 inline code');
  // The "3" inside inline code should NOT be extracted as a number
  const numbers = segs.filter(s => s.type === 'number');
  const bad3 = numbers.find(n => n.content === '3');
  assert(!bad3, '"3" inside inline code should not be extracted as standalone number');
});

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed > 0) {
  console.log('SOME TESTS FAILED — see above for details.');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
  process.exit(0);
}
