const { compress } = require('./src/main/tier0/compressor');

const testMessage2 = `"Hey so you could just kind of help me out with something real quick, I think there might possibly be an issue in this code I'm working on, like it's not really working the way I want it to. To fix it I was thinking maybe we could just take a look at it together if that's okay? Here's the code:

function getData(x) {

if (x ==1) {

return true;

}

}

I just want to know now what's wrong with it,. Thanks so much in advance, I really appreciate any help you can give me on this!"`;

console.log("--- Compression test 2 ---");
const result = compress(testMessage2, 2);
console.log("Removals:", result.removals);

console.log("\n--- Compressed output ---");
console.log(result.result);
