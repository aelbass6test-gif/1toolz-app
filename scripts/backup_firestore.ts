import { db } from "../services/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";

const COLLECTIONS_TO_BACKUP = [
  "stores_data",
  "orders",
  "products",
  "users",
  "suppliers",
  "partners",
  "transactions",
  "partner_transactions",
  "treasury_accounts",
  "treasury_transactions",
  "customers",
  "employees"
];

async function runFullBackup() {
  console.log("[BACKUP] Starting comprehensive Firestore cloud backup...");
  const fullBackup: Record<string, Record<string, any>> = {
    _metadata: {
      createdAt: new Date().toISOString(),
      collections: COLLECTIONS_TO_BACKUP
    }
  };

  for (const colName of COLLECTIONS_TO_BACKUP) {
    try {
      const colRef = collection(db, colName);
      const snap = await getDocs(colRef);
      const colDocs: Record<string, any> = {};
      snap.forEach(docSnap => {
        colDocs[docSnap.id] = docSnap.data();
      });
      fullBackup[colName] = colDocs;
      console.log(` - Collection [${colName}]: backed up ${Object.keys(colDocs).length} documents`);
    } catch (err: any) {
      console.warn(` - Collection [${colName}] warning:`, err?.message || err);
      fullBackup[colName] = {};
    }
  }

  const backupDir = path.resolve("./data/backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fullFilename = path.join(backupDir, `full_firestore_backup_${timestamp}.json`);
  const latestFullFilename = path.join(backupDir, `full_firestore_backup_latest.json`);
  const latestStoresFilename = path.join(backupDir, `stores_data_backup_latest.json`);

  fs.writeFileSync(fullFilename, JSON.stringify(fullBackup, null, 2), "utf8");
  fs.writeFileSync(latestFullFilename, JSON.stringify(fullBackup, null, 2), "utf8");
  fs.writeFileSync(latestStoresFilename, JSON.stringify(fullBackup.stores_data || {}, null, 2), "utf8");

  console.log(`[BACKUP] Cloud backup completed successfully:`);
  console.log(` - ${fullFilename}`);
  console.log(` - ${latestFullFilename}`);
}

runFullBackup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("[BACKUP-ERROR]", err);
    process.exit(1);
  });
