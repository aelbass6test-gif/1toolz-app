import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixWalletTxs() {
  const storeId = "STORE_ID_HERE"; // We need to find the store ID. Let's find it.
}
fixWalletTxs();
