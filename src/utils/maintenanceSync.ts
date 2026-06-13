import { db } from '../../services/firebaseClient';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export async function syncMaintenanceStatus(orderNumber: string, orderStatus: string) {
    if (!orderNumber) return;

    const maintenanceQuery = query(collection(db, 'maintenance_requests'), where("orderNumber", "==", orderNumber));
    const maintenanceRequests = await getDocs(maintenanceQuery);

    maintenanceRequests.docs.forEach(async (doc) => {
        let maintenanceStatus: string | null = null;
        
        switch (orderStatus) {
            case 'تم_الارسال':
                maintenanceStatus = 'in_repair';
                break;
            case 'جاري_المراجعة':
                maintenanceStatus = 'received';
                break;
            case 'سحب_للصيانة':
                maintenanceStatus = 'received';
                break;
            case 'تم_توصيلها':
                maintenanceStatus = 'delivered';
                break;
            // Add more mappings as needed
            default:
                break;
        }

        if (maintenanceStatus) {
            await updateDoc(doc.ref, { status: maintenanceStatus });
        }
    });                
}
