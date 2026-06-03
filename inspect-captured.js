import fs from 'fs';

if (fs.existsSync('captured.json')) {
  try {
    const data = JSON.parse(fs.readFileSync('captured.json', 'utf-8'));
    console.log("Keys in captured.json:", Object.keys(data));
    
    // Check if there is data about stores or supply orders
    const stores = data.stores || data.stores_data || data;
    console.log("Type of core data:", Array.isArray(stores) ? "array" : typeof stores);
    
    // Find store or supply orders
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      keys.forEach(k => {
        const item = data[k];
        if (item && item.settings) {
          console.log(`Key ${k} has settings`);
          const supplyOrders = item.settings.supplyOrders || [];
          console.log(`Supply Orders count for ${k}:`, supplyOrders.length);
          supplyOrders.forEach(so => {
            console.log(`  Order: ID=${so.id}, Ref=${so.referenceNumber}, Total=${so.totalCost}, Date=${so.date}`);
            if (so.referenceNumber === '5690' || so.id === '5690') {
              console.log("  Found target order 5690!");
              console.log("  Order details:", JSON.stringify(so, null, 2));
            }
          });
        }
      });
    }
  } catch (err) {
    console.error("Error reading captured.json:", err);
  }
} else {
  console.log("captured.json does not exist");
}
