import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const storeIds = ['store-1771165841517-fkrbaec', 'store-1778212844642-kmq6cpc', 'store-1777107916622-sxw996d'];
  for (const storeId of storeIds) {
    const newStaff = [
      { id: '01029807778', name: 'محمد عرب', email: '01029807778', phone: '01029807778', permissions: ['ORDERS_VIEW', 'PRODUCTS_VIEW'], status: 'active', storeId: storeId },
      { id: '01095288069', name: 'ابراهيم حمدي', email: '01095288069', phone: '01095288069', permissions: ['ORDERS_VIEW', 'PRODUCTS_VIEW'], status: 'active', storeId: storeId }
    ];

    for (const emp of newStaff) {
      const docId = `${storeId}_${emp.phone}`;
      await setDoc(doc(db, 'employees', docId), emp, { merge: true });
    }
  }
  console.log("Employees restored to collection!");
  process.exit(0);
}
run();
