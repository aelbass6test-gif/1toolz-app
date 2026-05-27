import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://keqmlcqymkohxzcouxfi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlcW1sY3F5bWtvaHh6Y291eGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODU0NzAsImV4cCI6MjA4NjE2MTQ3MH0.OfxqWM9CFCcLj62u5KLWZyiiBhUH-miUu882Cqlwf4I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findWuiltStoreId() {
  const { data: stores, error } = await supabase
    .from('stores_data')
    .select('id, settings');

  if (error || !stores) {
    console.error('Failed to fetch stores', error);
    return null;
  }

  const wuiltStore = stores.find(s => 
    s.settings?.integration?.platform === 'wuilt' || 
    (s.settings?.platformConfigs?.wuilt && s.settings.platformConfigs.wuilt.isActive)
  );

  return wuiltStore ? wuiltStore.id : null;
}

async function runSync() {
  const storeId = await findWuiltStoreId();
  if (!storeId) {
    console.log("No Wuilt store found in stores_data settings.");
    return;
  }

  console.log(`Triggering sync for store: ${storeId}`);
  
  const url = `http://localhost:3000/api/sync/platform/wuilt/${storeId}`;
  let attempts = 0;
  const maxAttempts = 6;
  const delay = 5000;

  while (attempts < maxAttempts) {
    try {
      console.log(`[Attempt ${attempts + 1}/${maxAttempts}] POST ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (response.ok) {
          console.log("Sync triggered successfully:", JSON.stringify(data, null, 2));
          return;
        } else {
          console.error("Sync API returned error status:", response.status, data);
        }
      } catch (e) {
        if (text.startsWith('<!DOCTYPE html>')) {
           console.log(`Received HTML response (Attempt ${attempts + 1}). Server might still be starting or route not ready...`);
        } else {
           console.error("Failed to parse Sync response as JSON (showing first 200 chars):", text.substring(0, 200));
        }
      }
    } catch (error: any) {
       console.error(`Connection error (Attempt ${attempts + 1}):`, error.message);
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      console.log(`Waiting ${delay/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error("Sync failed after multiple attempts.");
}

runSync();
