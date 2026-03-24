const deukpack = require('./dist/index.js');
const obj = { str: "hello", count: 123 };
console.log("Original obj:", obj);
const bytes = deukpack.serialize(obj, 'json', { pretty: true });
console.log("JSON bytes:", bytes);
console.log("ToString (pretty):");
console.log(deukpack.toString(obj, true));

const decoded = deukpack.deserialize(bytes, 'json');
console.log("Decoded obj:", decoded);
console.log("SUCCESS!");
