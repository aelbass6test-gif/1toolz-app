import { db as firebaseDb, auth } from './firebaseClient';
import { 
    doc, 
    updateDoc, 
    arrayUnion, 
    getDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { 
    SharedAudit, 
    SharedAuditLogEntry, 
    SharedAuditProtocol 
} from '../types';

/**
 * Robust Audit Logging
 */
export const addSharedAuditLog = async (
    sessionId: string, 
    log: Omit<SharedAuditLogEntry, 'id' | 'timestamp' | 'userId' | 'userName'>,
    userName: string
) => {
    const sessionRef = doc(firebaseDb, 'shared_audits', sessionId);
    const newLog: SharedAuditLogEntry = {
        ...log,
        id: Math.random().toString(36).substring(2, 15),
        timestamp: new Date().toISOString(),
        userId: auth.currentUser?.uid || 'anonymous',
        userName: userName || auth.currentUser?.displayName || 'User',
        userEmail: auth.currentUser?.email || undefined
    };
    
    await updateDoc(sessionRef, {
        logs: arrayUnion(newLog)
    });
};

/**
 * Protocol Enforcement Guard
 */
export const verifySharedAuditProtocol = async (sessionId: string, requestedProtocol: SharedAuditProtocol): Promise<boolean> => {
    const sessionRef = doc(firebaseDb, 'shared_audits', sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) return false;
    
    const audit = snap.data() as SharedAudit;
    
    // Rule: Reject change if locked and different
    if (audit.isProtocolLocked && audit.protocol !== requestedProtocol) {
        return false;
    }
    
    return true;
};

/**
 * Supervisor Unlock Action
 */
export const unlockSharedAuditProtocol = async (
    sessionId: string, 
    reason: string, 
    supervisorName: string
) => {
    const sessionRef = doc(firebaseDb, 'shared_audits', sessionId);
    
    await updateDoc(sessionRef, {
        isProtocolLocked: false,
        unlockReason: reason,
        unlockedBy: supervisorName,
        unlockedAt: new Date().toISOString()
    });

    await addSharedAuditLog(sessionId, {
        action: 'فتح قفل البروتوكول',
        details: `تم إلغاء قفل الجلسة بواسطة ${supervisorName}. السبب: ${reason}`,
        type: 'unlock'
    }, supervisorName);
};

/**
 * Centralized Protocol Lock
 */
export const lockSharedAuditProtocol = async (sessionId: string, supervisorName: string) => {
    const sessionRef = doc(firebaseDb, 'shared_audits', sessionId);
    
    await updateDoc(sessionRef, {
        isProtocolLocked: true
    });

    await addSharedAuditLog(sessionId, {
        action: 'تثبيت البروتوكول',
        details: 'تم قفل إعدادات الجلسة والبروتوكول بنجاح.',
        type: 'protocol_change'
    }, supervisorName);
};
