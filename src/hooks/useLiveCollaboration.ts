import { useState, useEffect, useCallback, useRef } from 'react';
import { db as firestoreDb, auth } from '../../services/firebaseClient';
import { doc, onSnapshot, updateDoc, deleteField, writeBatch, getDoc } from 'firebase/firestore';
import { SharedAudit, SharedAuditPresence } from '../../types';

export function useLiveCollaboration(auditId: string, currentUserName: string = 'User') {
    const [collaborators, setCollaborators] = useState<SharedAuditPresence[]>([]);
    const [lockedItems, setLockedItems] = useState<Record<string, { userId: string; userName: string; lockedAt: string }>>({});
    const [auditData, setAuditData] = useState<SharedAudit | null>(null);

    const currentUserId = auth.currentUser?.uid || 'anonymous';
    const lastLockedItemRef = useRef<string | null>(null);

    // 1. Monitor Audit Document for Presence and Locks
    useEffect(() => {
        if (!auditId) return;

        const auditRef = doc(firestoreDb, 'shared_audits', auditId);
        
        const unsubscribe = onSnapshot(auditRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as any; // Using any to handle potential schema changes during transition
                setAuditData(data as SharedAudit);

                // Extract collaborators from presence map
                const presenceMap = data.presence || {};
                const activeCollaborators = Object.values(presenceMap)
                    .filter((p: any) => p.userId !== currentUserId) as SharedAuditPresence[];
                
                setCollaborators(activeCollaborators);

                // Extract locks from the NEW 'locks' map (migrating away from per-item lockedBy)
                const locksMap = data.locks || {};
                setLockedItems(locksMap);
            }
        });

        // 2. Cleanup Presence and Locks on Unmount
        const cleanup = async () => {
            try {
                const updates: any = {
                    [`presence.${currentUserId}`]: deleteField()
                };
                
                // Also unlock the item the user was working on
                if (lastLockedItemRef.current) {
                    updates[`locks.${lastLockedItemRef.current}`] = deleteField();
                }

                await updateDoc(auditRef, updates);
            } catch (err) {
                console.error('Failed to cleanup presence/locks', err);
            }
        };

        window.addEventListener('beforeunload', cleanup);

        return () => {
            unsubscribe();
            cleanup();
            window.removeEventListener('beforeunload', cleanup);
        };
    }, [auditId, currentUserId]);

    // 3. Heartbeat for Presence
    useEffect(() => {
        if (!auditId || !currentUserId) return;

        const interval = setInterval(async () => {
            const auditRef = doc(firestoreDb, 'shared_audits', auditId);
            const now = new Date().toISOString();
            
            try {
                await updateDoc(auditRef, {
                    [`presence.${currentUserId}.lastActive`]: now
                });
            } catch (err) {
                // Silent fail for heartbeat
            }
        }, 30000); // Heartbeat every 30s

        return () => clearInterval(interval);
    }, [auditId, currentUserId]);

    // 4. Broadcast Presence & Handle Locks
    const broadcastPresence = useCallback(async (itemKey: string) => {
        if (!auditId || !currentUserId) return;
        
        const auditRef = doc(firestoreDb, 'shared_audits', auditId);
        const now = new Date().toISOString();

        try {
            await updateDoc(auditRef, {
                [`presence.${currentUserId}`]: {
                    userId: currentUserId,
                    userName: currentUserName,
                    status: 'online',
                    activeProductId: itemKey,
                    lastActive: now
                }
            });
        } catch (err) {
            console.error('Failed to broadcast presence', err);
        }
    }, [auditId, currentUserId, currentUserName]);

    const lockItem = useCallback(async (productId: string) => {
        if (!auditId || !currentUserId) return;
        const auditRef = doc(firestoreDb, 'shared_audits', auditId);
        
        try {
            const batch: Record<string, any> = {};
            
            // Unlock previous item if any
            if (lastLockedItemRef.current && lastLockedItemRef.current !== productId) {
                batch[`locks.${lastLockedItemRef.current}`] = deleteField();
            }

            // Lock current item
            batch[`locks.${productId}`] = {
                userId: currentUserId,
                userName: currentUserName,
                lockedAt: new Date().toISOString()
            };

            await updateDoc(auditRef, batch);
            lastLockedItemRef.current = productId;
        } catch (err) {
            console.error('Failed to lock item', err);
        }
    }, [auditId, currentUserId, currentUserName]);

    const unlockItem = useCallback(async (productId: string) => {
        if (!auditId || !currentUserId) return;
        const auditRef = doc(firestoreDb, 'shared_audits', auditId);
        
        try {
            await updateDoc(auditRef, {
                [`locks.${productId}`]: deleteField()
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
