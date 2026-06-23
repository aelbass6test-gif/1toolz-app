import { readFileSync } from 'fs';

try {
  const content = readFileSync('captured.json', 'utf8');
  const data = JSON.parse(content);
  const items = Array.isArray(data) ? data : (data.items || []);
  
  items.forEach((item: any, index: number) => {
    const itemStr = JSON.stringify(item);
    if (itemStr.includes("1593") || itemStr.includes("108.93") || itemStr.includes("115.93") || itemStr.includes("1500")) {
      console.log(`Match at index ${index} (ID: ${item.id}):`);
      console.log(JSON.stringify(item, null, 2));
    }
  });
} catch (e) {
  console.error(e);
}
