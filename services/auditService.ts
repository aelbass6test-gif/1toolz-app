import { getSupabaseClient } from './databaseService';
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
    const newLog: SharedAuditLogEntry = {
        ...log,
        id: Math.random().toString(36).substring(2, 15),
        timestamp: new Date().toISOString(),
        userId: 'user',
        userName: userName || 'User',
        userEmail: undefined
    };
    
    const supabase = getSupabaseClient();
    if (supabase) {
        try {
            const { data: audit } = await supabase.from('shared_audits').select('logs').eq('id', sessionId).maybeSingle();
            const existingLogs = Array.isArray(audit?.logs) ? audit.logs : [];
            await supabase.from('shared_audits').update({
                logs: [...existingLogs, newLog]
            }).eq('id', sessionId);
        } catch (e) {
            console.error('Error updating audit logs:', e);
        }
    }
};

/**
 * Protocol Enforcement Guard
 */
export const verifySharedAuditProtocol = async (sessionId: string, requestedProtocol: SharedAuditProtocol): Promise<boolean> => {
    
    const supabase = getSupabaseClient();
    if(!supabase) return false;
    const { data: audit, error } = await supabase.from('shared_audits').select('*').eq('id', sessionId).single();
    if (error || !audit) return false;
    
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
    
    
    const supabase = getSupabaseClient(); if(supabase) await supabase.from('shared_audits').update({
        isProtocolLocked: false,
        unlockReason: reason,
        unlockedBy: supervisorName,
        unlockedAt: new Date().toISOString()
    }).eq('id', sessionId);

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
    
    
    const supabase = getSupabaseClient(); if(supabase) await supabase.from('shared_audits').update({
        isProtocolLocked: true
    }).eq('id', sessionId);

    await addSharedAuditLog(sessionId, {
        action: 'تثبيت البروتوكول',
        details: 'تم قفل إعدادات الجلسة والبروتوكول بنجاح.',
        type: 'protocol_change'
    }, supervisorName);
};
