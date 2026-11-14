import { useState, useEffect, useCallback, useRef } from 'react';
import { cfFetch, getStoredCfAuthUser, subscribePolling } from '../../services/cloudflareClient';
import { SharedAudit, SharedAuditPresence } from '../../types';

export function useLiveCollaboration(auditId: string, currentUserName: string = 'User') {
    const [collaborators, setCollaborators] = useState<SharedAuditPresence[]>([]);
    const [lockedItems, setLockedItems] = useState<Record<string, { userId: string; userName: string; lockedAt: string }>>({});
    const [auditData, setAuditData] = useState<SharedAudit | null>(null);

    const authUser = getStoredCfAuthUser<any>();
    const currentUserId = authUser?.phone || authUser?.id || currentUserName || 'anonymous';
    const lastLockedItemRef = useRef<string | null>(null);

    const applyAuditSnapshot = useCallback((data: SharedAudit | null) => {
        if (!data) return;
        setAuditData(data);
        const presenceMap = data.presence || {};
        const activeCollaborators = Object.values(presenceMap)
            .filter((p: any) => p.userId !== currentUserId) as SharedAuditPresence[];
        setCollaborators(activeCollaborators);
        setLockedItems(data.locks || {});
    }, [currentUserId]);

    useEffect(() => {
        if (!auditId) return;

        const unsubscribe = subscribePolling(
            async () => {
                const res = await cfFetch<{ success: boolean; audit?: SharedAudit }>(
                    `/api/db/audits/item/${encodeURIComponent(auditId)}`
                );
                return res?.audit || null;
            },
            (audit) => applyAuditSnapshot(audit),
            5000
        );

        const cleanup = async () => {
            try {
                const res = await cfFetch<{ success: boolean; audit?: SharedAudit }>(
                    `/api/db/audits/item/${encodeURIComponent(auditId)}`
                );
                if (res?.audit) {
                    const presence = { ...(res.audit.presence || {}) };
                    const locks = { ...(res.audit.locks || {}) };
                    delete presence[currentUserId];
                    if (lastLockedItemRef.current) {
                        delete locks[lastLockedItemRef.current];
                    }
                    await cfFetch(`/api/db/audits/item/${encodeURIComponent(auditId)}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ presence, locks })
                    });
                }
            } catch (err) {
                console.error('Failed to cleanup presence/locks', err);
            }
        };

        window.addEventListener('beforeunload', cleanup);

        return () => {
            unsubscribe();
            void cleanup();
            window.removeEventListener('beforeunload', cleanup);
        };
    }, [auditId, currentUserId, applyAuditSnapshot]);

    useEffect(() => {
        if (!auditId || !currentUserId) return;

        const interval = setInterval(async () => {
            const now = new Date().toISOString();
            try {
                const res = await cfFetch<{ success: boolean; audit?: SharedAudit }>(
                    `/api/db/audits/item/${encodeURIComponent(auditId)}`
                );
                if (res?.audit) {
                    const presence = { ...(res.audit.presence || {}) };
                    if (presence[currentUserId]) {
                        presence[currentUserId] = { ...presence[currentUserId], lastActive: now };
                        await cfFetch(`/api/db/audits/item/${encodeURIComponent(auditId)}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ presence })
                        });
                    }
                }
            } catch {
                // Ignore heartbeat failures
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [auditId, currentUserId]);

    const broadcastPresence = useCallback(async (itemKey: string) => {
        if (!auditId || !currentUserId) return;
        const now = new Date().toISOString();

        try {
            const res = await cfFetch<{ success: boolean; audit?: SharedAudit }>(
                `/api/db/audits/item/${encodeURIComponent(auditId)}`
            );
            const presence = { ...(res?.audit?.presence || {}) };
            presence[currentUserId] = {
                userId: currentUserId,
                userName: currentUserName,
                status: 'online',
                activeProductId: itemKey,
                lastActive: now
            };
            await cfFetch(`/api/db/audits/item/${encodeURIComponent(auditId)}`, {
                method: 'PATCH',
                body: JSON.stringify({ presence })
            });
        } catch (err) {
            console.error('Failed to broadcast presence', err);
        }
    }, [auditId, currentUserId, currentUserName]);

    const lockItem = useCallback(async (productId: string) => {
        if (!auditId || !currentUserId) return;

        try {
            const res = await cfFetch<{ success: boolean; audit?: SharedAudit }>(
                `/api/db/audits/item/${encodeURIComponent(auditId)}`
            );
            const locks = { ...(res?.audit?.locks || {}) };
            if (lastLockedItemRef.current && lastLockedItemRef.current !== productId) {
                delete locks[lastLockedItemRef.current];
            }
            locks[productId] = {
                userId: currentUserId,
                userName: currentUserName,
                lockedAt: new Date().toISOString()
            };
            await cfFetch(`/api/db/audits/item/${encodeURIComponent(auditId)}`, {
                method: 'PATCH',
                body: JSON.stringify({ locks })
            });
            lastLockedItemRef.current = productId;
        } catch (err) {
            console.error('Failed to lock item', err);
        }
    }, [auditId, currentUserId, currentUserName]);

    const unlockItem = useCallback(async (productId: string) => {
        if (!auditId || !currentUserId) return;

        try {
            const res = await cfFetch<{ success: boolean; audit?: SharedAudit }>(
                `/api/db/audits/item/${encodeURIComponent(auditId)}`
            );
            const locks = { ...(res?.audit?.locks || {}) };
            delete locks[productId];
            await cfFetch(`/api/db/audits/item/${encodeURIComponent(auditId)}`, {
                method: 'PATCH',
                body: JSON.stringify({ locks })
            });
            if (lastLockedItemRef.current === productId) {
                lastLockedItemRef.current = null;
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
