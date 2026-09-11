import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const ordersRef = collection(db, 'orders');
    console.log("Querying for orderNumber #1 or '1'...");
    
    // We try query for orderNumber '1' or 1 or order_number '1' or 1 in Firestore
    const q1 = query(ordersRef, where('orderNumber', '==', '1'));
    const s1 = await getDocs(q1);
    console.log("Found with custom field orderNumber == '1':", s1.size);
    
    const q2 = query(ordersRef, where('order_number', '==', '1'));
    const s2 = await getDocs(q2);
    console.log("Found with custom field order_number == '1':", s2.size);
    
    const q3 = query(ordersRef, where('orderNumber', '==', 1));
    const s3 = await getDocs(q3);
    console.log("Found with custom field orderNumber == 1:", s3.size);
    
    // Let's print any matching document
    const allDocs = [...s1.docs, ...s2.docs, ...s3.docs];
    if (allDocs.length > 0) {
      console.log("\nMatching order details:");
      allDocs.forEach(d => {
        console.log(`Document ID: ${d.id}`);
        console.log(JSON.stringify(d.data(), null, 2));
      });
    } else {
      console.log("\nCould not find direct matches. Let's dump the first 3 orders found in the database to see their structure:");
      const sAll = await getDocs(ordersRef);
      console.log("Total orders in Firestore:", sAll.size);
      sAll.docs.slice(0, 3).forEach(d => {
        console.log(`\nDocument: ${d.id}`);
        console.log(JSON.stringify(d.data(), null, 2));
      });
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
