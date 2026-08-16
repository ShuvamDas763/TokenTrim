'use strict';

const compressor = require('./tier1/llm-compressor');
const providerChain = require('./tier1/provider-chain');

async function run() {
  providerChain.load();
  if (!providerChain.hasAnyAvailable()) {
    console.error('No providers available. Please configure an API key in ~/.trimtoken/config.json');
    return;
  }

  const text1 = "can you help me with this java problem... can you suggest a good approach and explain it a little? maybe give the code too...";
  console.log('--- TEST 1 ---');
  console.log('Original Text:', text1);
  console.log('Original Length:', text1.length);
  
  const result1 = await compressor.compress(text1);
  console.log('Result 1:', result1);
  if (result1.success) {
    console.log('Result Length:', result1.result.length);
  }

  const text2 = "what's the difference between let and const in javascript and when should I use each one, especially in loops?";
  console.log('\n--- TEST 2 ---');
  console.log('Original Text:', text2);
  console.log('Original Length:', text2.length);

  const result2 = await compressor.compress(text2);
  console.log('Result 2:', result2);
  if (result2.success) {
    console.log('Result Length:', result2.result.length);
  }
}

run().catch(console.error);
