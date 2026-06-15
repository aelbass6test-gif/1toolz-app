import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('captured.json', 'utf8'));
console.log("Keys of captured.json:", Object.keys(data));
if (data.stores_data) {
  console.log("stores_data size:", data.stores_data.length);
}
if (data.items) {
  console.log("items size:", data.items.length);
  console.log("Sample item structure:", Object.keys(data.items[0]));
}
