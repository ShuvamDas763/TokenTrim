'use strict';

const compressor = require('./tier0/compressor');

const testText = `hey can you help me with this java problem im doing? i have an array of integers and a target number and i need to find two numbers in the array that add up to the target. i know one way is just using nested loops but i feel like thats probably not the best way.

i was thinking of hashmap maybe but honestly im not sure how to use it here. can you suggest a good approach and explain it a little? maybe give the code too but dont make it too complicated because im still learning. also what would happen if there are duplicate or negative numbers?`;

console.log('=== VERIFICATION: Tier 0 Compression Fixes ===\n');
console.log('Original text (' + testText.length + ' chars):');
console.log(testText);
console.log('\n--- Running compress() with NO explicit aggressiveness (should use default=3 now) ---\n');

const result = compressor.compress(testText);

console.log('\nCompressed text (' + result.compressedLength + ' chars):');
console.log(result.result);
console.log('\n--- STATS ---');
console.log('Original length:', result.originalLength);
console.log('Compressed length:', result.compressedLength);
console.log('Reduction:', result.originalLength - result.compressedLength, 'chars');
console.log('Reduction %:', ((1 - result.compressedLength / result.originalLength) * 100).toFixed(1) + '%');
console.log('Changed:', result.changed);
console.log('\nRemovals (' + result.removals.length + '):');
result.removals.forEach(r => {
  console.log(`  - "${r.phrase}" → "${r.replacement}" (matched: "${r.original}")`);
});

// Verify specific expected removals
const expectedPatterns = [
  'hey can you help me with',
  'i feel like',
  'maybe',
  'honestly',
  'but dont make it too complicated',
];

console.log('\n--- EXPECTED PATTERN CHECK ---');
const removedPhrases = result.removals.map(r => r.phrase);
for (const pat of expectedPatterns) {
  const found = removedPhrases.includes(pat);
  console.log(`  ${found ? '✓' : '✗'} "${pat}" ${found ? 'WAS removed' : 'was NOT removed'}`);
}
