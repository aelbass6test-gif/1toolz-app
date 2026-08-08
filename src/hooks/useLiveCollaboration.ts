import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../../services/firebaseClient';
import { getSupabaseClient } from '../../services/databaseService';
import { SharedAudit, SharedAuditPresence } from '../../types';

export function useLiveCollaboration(auditId: string, currentUserName: string = 'User') {
    const [collaborators, setCollaborators] = useState<SharedAuditPresence[]>([]);
    const [lockedItems, setLockedItems] = useState<Record<string, { userId: string; userName: string; lockedAt: string }>>({});
    const [auditData, setAuditData] = useState<SharedAudit | null>(null);

    const currentUserId = auth.currentUser?.uid || 'anonymous';
    const lastLockedItemRef = useRef<string | null>(null);

    useEffect(() => {
        if (!auditId) return;

        const supabase = getSupabaseClient();
        if (!supabase) return;

        let channel: any;

        const loadInitialData = async () => {
            const { data } = await supabase.from('shared_audits').select('*').eq('id', auditId).single();
            if (data) {
                setAuditData(data as SharedAudit);
                const presenceMap = data.presence || {};
                const activeCollaborators = Object.values(presenceMap)
                    .filter((p: any) => p.userId !== currentUserId) as SharedAuditPresence[];
                setCollaborators(activeCollaborators);
                const locksMap = data.locks || {};
                setLockedItems(locksMap);
            }
        };

        loadInitialData();

        channel = supabase.channel('public:shared_audits:' + auditId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_audits', filter: 'id=eq.' + auditId }, (payload: any) => {
                const data = payload.new;
                if (data) {
                    setAuditData(data as SharedAudit);
                    const presenceMap = data.presence || {};
                    const activeCollaborators = Object.values(presenceMap)
                        .filter((p: any) => p.userId !== currentUserId) as SharedAuditPresence[];
                    setCollaborators(activeCollaborators);
                    const locksMap = data.locks || {};
                    setLockedItems(locksMap);
                }
            })
            .subscribe();

        const cleanup = async () => {
            try {
                const sb = getSupabaseClient();
                if (!sb) return;
                const { data } = await sb.from('shared_audits').select('presence, locks').eq('id', auditId).single();
                if (data) {
                    const presence = data.presence || {};
                    const locks = data.locks || {};
                    delete presence[currentUserId];
                    if (lastLockedItemRef.current) {
                        delete locks[lastLockedItemRef.current];
                    }
                    await sb.from('shared_audits').update({ presence, locks }).eq('id', auditId);
                }
            } catch (err) {
                console.error('Failed to cleanup presence/locks', err);
            }
        };

        window.addEventListener('beforeunload', cleanup);

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
            cleanup();
            window.removeEventListener('beforeunload', cleanup);
        };
    }, [auditId, currentUserId]);

    useEffect(() => {
        if (!auditId || !currentUserId) return;

        const interval = setInterval(async () => {
            const supabase = getSupabaseClient();
            if (!supabase) return;
            const now = new Date().toISOString();
            
            try {
                const { data } = await supabase.from('shared_audits').select('presence').eq('id', auditId).single();
                if (data) {
                    const presence = data.presence || {};
                    if (presence[currentUserId]) {
                        presence[currentUserId].lastActive = now;
                        await supabase.from('shared_audits').update({ presence }).eq('id', auditId);
                    }
                }
            } catch (err) {
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [auditId, currentUserId]);

    const broadcastPresence = useCallback(async (itemKey: string) => {
        if (!auditId || !currentUserId) return;
        
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const now = new Date().toISOString();

        try {
            const { data } = await supabase.from('shared_audits').select('presence').eq('id', auditId).single();
            if (data) {
                const presence = data.presence || {};
                presence[currentUserId] = {
                    userId: currentUserId,
                    userName: currentUserName,
                    status: 'online',
                    activeProductId: itemKey,
                    lastActive: now
                };
                await supabase.from('shared_audits').update({ presence }).eq('id', auditId);
            }
        } catch (err) {
            console.error('Failed to broadcast presence', err);
        }
    }, [auditId, currentUserId, currentUserName]);

    const lockItem = useCallback(async (productId: string) => {
        if (!auditId || !currentUserId) return;
        
        const supabase = getSupabaseClient();
        if (!supabase) return;

        try {
            const { data } = await supabase.from('shared_audits').select('locks').eq('id', auditId).single();
            if (data) {
                const locks = data.locks || {};
                if (lastLockedItemRef.current && lastLockedItemRef.current !== productId) {
                    delete locks[lastLockedItemRef.current];
                }
                locks[productId] = {
                    userId: currentUserId,
                    userName: currentUserName,
                    lockedAt: new Date().toISOString()
                };
                await supabase.from('shared_audits').update({ locks }).eq('id', auditId);
                lastLockedItemRef.current = productId;
            }
        } catch (err) {
            console.error('Failed to lock item', err);
        }
    }, [auditId, currentUserId, currentUserName]);

    const unlockItem = useCallback(async (productId: string) => {
        if (!auditId || !currentUserId) return;
        
        const supabase = getSupabaseClient();
        if (!supabase) return;
        
        try {
            const { data } = await supabase.from('shared_audits').select('locks').eq('id', auditId).single();
            if (data) {
                const locks = data.locks || {};
                delete locks[productId];
                await supabase.from('shared_audits').update({ locks }).eq('id', auditId);
                if (lastLockedItemRef.current === productId) {
                    lastLockedItemRef.current = null;
                }
            }
        } catch (err) {
            console.error('Failed to unlock item', err);
        }
    }, [auditId, currentUserId]);

    const isLockedByOther = useCallback((productId: string) => {
        const lock = lockedItems[productId];
        return !!lock && lock.userId !== currentUserId;
    }, [lockedItems, currentUserId]);

    const getLockerInfo = useCallback((productId: string) => {
        const lock = lockedItems[productId];
        if (!lock || lock.userId === currentUserId) return null;
        return {
            userId: lock.userId,
            userName: lock.userName,
            lastActive: lock.lockedAt
        } as SharedAuditPresence;
    }, [lockedItems, currentUserId]);

    return {
        collaborators,
        broadcastPresence,
        lockItem,
        unlockItem,
        isLockedByOther,
        getLockerInfo,
        auditData
    };
}
