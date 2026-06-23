import { readFileSync } from 'fs';

try {
  const content = readFileSync('captured.json', 'utf8');
  const data = JSON.parse(content);
  const items = Array.isArray(data) ? data : (data.items || []);
  console.log("Total items:", items.length);
  const sample = items.find((o: any) => o.productPrice !== undefined || o.details !== undefined || o.totalPrice !== undefined);
  if (sample) {
    console.log("Found sample with fields:", JSON.stringify(sample, null, 2));
  } else {
    console.log("No sample has productPrice, details or totalPrice at top-level. Showing keys of first item:", Object.keys(items[0] || {}));
    console.log("First item:", JSON.stringify(items[0] || {}, null, 2));
  }
} catch (e) {
  console.error(e);
}
