import { cfFetch } from './cloudflareClient';
import {
    SharedAudit,
    SharedAuditLogEntry,
    SharedAuditProtocol
} from '../types';

/**
 * Robust Audit Logging (Cloudflare D1)
 */
export const addSharedAuditLog = async (
    sessionId: string,
    log: Omit<SharedAuditLogEntry, 'id' | 'timestamp' | 'userId' | 'userName'>,
    userName: string
) => {
    const newLog: SharedAuditLogEntry = {
        ...log,
        id: Math.random().toString(36).substring(2, 15),
        timestamp: new Date().toISOString(),
        userId: 'user',
        userName: userName || 'User',
        userEmail: undefined
    };

    try {
        const res = await cfFetch<{ success: boolean; audit?: SharedAudit }>(
            `/api/db/audits/item/${encodeURIComponent(sessionId)}`
        );
        const existingLogs = Array.isArray(res?.audit?.logs) ? res.audit.logs : [];
        await cfFetch(`/api/db/audits/item/${encodeURIComponent(sessionId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                logs: [...existingLogs, newLog]
            })
        });
    } catch (e) {
        console.error('Error updating audit logs:', e);
    }
};

/**
 * Protocol Enforcement Guard (Cloudflare D1)
 */
export const verifySharedAuditProtocol = async (
    sessionId: string,
    requestedProtocol: SharedAuditProtocol
): Promise<boolean> => {
    try {
        const res = await cfFetch<{ success: boolean; audit?: SharedAudit }>(
            `/api/db/audits/item/${encodeURIComponent(sessionId)}`
        );
        const audit = res?.audit;
        if (!audit) return false;

        if (audit.isProtocolLocked && audit.protocol !== requestedProtocol) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
};

/**
 * Supervisor Unlock Action (Cloudflare D1)
 */
export const unlockSharedAuditProtocol = async (
    sessionId: string,
    reason: string,
    supervisorName: string
) => {
    try {
        await cfFetch(`/api/db/audits/item/${encodeURIComponent(sessionId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                isProtocolLocked: false,
                unlockReason: reason,
                unlockedBy: supervisorName,
                unlockedAt: new Date().toISOString()
            })
        });
    } catch (e) {
        console.error('Error unlocking audit protocol:', e);
    }

    await addSharedAuditLog(
        sessionId,
        {
            action: 'فتح قفل البروتوكول',
            details: `تم إلغاء قفل الجلسة بواسطة ${supervisorName}. السبب: ${reason}`,
            type: 'unlock'
        },
        supervisorName
    );
};

/**
 * Centralized Protocol Lock (Cloudflare D1)
 */
export const lockSharedAuditProtocol = async (sessionId: string, supervisorName: string) => {
    try {
        await cfFetch(`/api/db/audits/item/${encodeURIComponent(sessionId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                isProtocolLocked: true
            })
        });
    } catch (e) {
        console.error('Error locking audit protocol:', e);
    }

    await addSharedAuditLog(
        sessionId,
        {
            action: 'تثبيت البروتوكول',
            details: 'تم قفل إعدادات الجلسة والبروتوكول بنجاح.',
            type: 'protocol_change'
        },
        supervisorName
    );
};
