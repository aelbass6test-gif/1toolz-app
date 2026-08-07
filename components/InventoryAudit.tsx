import React, { useState, useMemo, useEffect } from 'react';
import { 
    Plus, Search, ClipboardList, Calendar, User, Eye, ArrowRight, CheckCircle, 
    AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Printer, AlertCircle, FileText, Check, 
    Layers, Trash2, Sliders, Layout, Filter, Sparkles, HelpCircle, Package, Info, Clock,
    Share2, Copy, Trash, Lock, ShieldCheck, CheckSquare, XCircle, Volume2, VolumeX, Camera, MapPin,
    Mic, Zap, Target, Gauge, Timer, Trophy
} from 'lucide-react';
import { Settings, Product, ProductVariant, InventoryAuditSession, InventoryAuditItemDiscrepancy } from '../types';
import { printHTMLDirectly } from '../utils/printHelper';
import { audioSynth } from '../utils/audioSynth';
import { db as firestoreDb } from '../services/firebaseClient';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import confetti from 'canvas-confetti';

// Import newly created subcomponents
import AuditDashboard from './audit/AuditDashboard';
import AuditVarianceCenter from './audit/AuditVarianceCenter';
import AuditAnalyticsReports from './audit/AuditAnalyticsReports';
import AuditSettings from './audit/AuditSettings';
import ActiveSessionWorksheet from './audit/ActiveSessionWorksheet';
import SharedAuditsTab from './audit/SharedAuditsTab';
import SupervisorDashboard from './audit/SupervisorDashboard';

interface InventoryAuditProps {
    settings: Settings;
    setSettings: (updater: React.SetStateAction<Settings>) => void;
    currentUser: any;
}

export const InventoryAudit: React.FC<InventoryAuditProps> = ({ settings, setSettings, currentUser }) => {
    // Portals main tab selection
    const [currentTab, setCurrentTab] = useState<'dashboard' | 'supervisor' | 'hub' | 'variance' | 'analytics' | 'settings'>('dashboard');
    
    // Sub-modules state
    const [isDirectWorksheetOpen, setIsDirectWorksheetOpen] = useState(false);
    const [sharedAudits, setSharedAudits] = useState<any[]>([]);
    const [loadingShared, setLoadingShared] = useState(false);

    // Selected sessions to view
    const [selectedPastSession, setSelectedPastSession] = useState<InventoryAuditSession | null>(null);

    // Custom UI Dialog States
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void | Promise<void>;
        type?: 'info' | 'warning' | 'danger' | 'success';
    } | null>(null);

    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'info' | 'warning' | 'danger' | 'success';
    } | null>(null);

    const [fullImageView, setFullImageView] = useState<string | null>(null);

    // Helpers for modals
    const customConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>, type: 'info' | 'warning' | 'danger' | 'success' = 'warning') => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            onConfirm,
            type
        });
    };

    const customAlert = (title: string, message: string, type: 'info' | 'warning' | 'danger' | 'success' = 'info') => {
        setAlertDialog({
            isOpen: true,
            title,
            message,
            type
        });
    };

    // Firebase real-time listeners for external shared audits
    const loadSharedAudits = async () => {
        const activeStoreId = localStorage.getItem('lastActiveStoreId') || 'default';
        setLoadingShared(true);
        try {
            const q = query(
                collection(firestoreDb, 'shared_audits'),
                where('storeId', '==', activeStoreId)
            );
            const querySnapshot = await getDocs(q);
            const list: any[] = [];
            querySnapshot.forEach(doc => {
                list.push({ id: doc.id, ...doc.data() });
            });
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setSharedAudits(list);
        } catch (err) {
            console.error('Error loading shared audits:', err);
        } finally {
            setLoadingShared(false);
        }
    };

    useEffect(() => {
        loadSharedAudits();
        
        // Setup Firestore listener for updates
        const activeStoreId = localStorage.getItem('lastActiveStoreId') || 'default';
        const q = query(
            collection(firestoreDb, 'shared_audits'),
            where('storeId', '==', activeStoreId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach(doc => {
                list.push({ id: doc.id, ...doc.data() });
            });
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setSharedAudits(list);
        });

        return () => unsubscribe();
    }, []);

    // 1. Create External Shared Audit Link
    const handleCreateSharedAudit = async (title: string, warehouseId: string, protocol: string, passcode: string) => {
        const activeStoreId = localStorage.getItem('lastActiveStoreId') || 'default';
        const allProducts = settings.products || [];
        
        const itemsToCount: any[] = [];
        allProducts.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const variantDesc = Object.entries(v.options)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(' | ');

                    const warehouseQty = warehouseId === 'all' 
                        ? (v.stockQuantity || 0)
                        : (v.warehouseStock?.[warehouseId] || 0);

                    const costPrice = v.costPrice ?? p.costPrice ?? 0;

                    if (warehouseQty <= 0 && costPrice <= 0) return; // skip stale items

                    itemsToCount.push({
                        productId: p.id,
                        variantId: v.id,
                        name: `${p.name} (${variantDesc})`,
                        sku: v.sku || p.sku || '',
                        systemQty: warehouseQty,
                        costPrice: costPrice,
                    });
                });
            } else {
                const warehouseQty = warehouseId === 'all' 
                    ? (p.stockQuantity || 0)
                    : (p.warehouseStock?.[warehouseId] || 0);

                const costPrice = p.costPrice || 0;

                if (warehouseQty <= 0 && costPrice <= 0) return;

                itemsToCount.push({
                    productId: p.id,
                    name: p.name,
                    sku: p.sku || '',
                    systemQty: warehouseQty,
                    costPrice: costPrice,
                });
            }
        });

        if (itemsToCount.length === 0) {
            customAlert('تنبيه', 'لا توجد منتجات مطابقة لهذا المخزن المختار!', 'warning');
            return;
        }

        try {
            setLoadingShared(true);
            const warehouseObj = settings.warehouses?.find(w => w.id === warehouseId);
            const warehouseName = warehouseObj ? warehouseObj.name : (warehouseId === 'all' ? 'الرصيد الإجمالي' : 'مخزن رئيسي');

            const docId = `sa-${Date.now()}`;
            const newAuditDoc = {
                id: docId,
                storeId: activeStoreId,
                title: title,
                warehouseId: warehouseId,
                warehouseName: warehouseName,
                scope: 'all',
                status: 'pending',
                createdAt: new Date().toISOString(),
                passcode: passcode || null,
                protocol: protocol,
                isProtocolLocked: true, // Auto-lock on creation
                isBlindCount: protocol === 'blind',
                items: itemsToCount,
                logs: [{
                    id: 'init',
                    timestamp: new Date().toISOString(),
                    userId: currentUser?.uid || 'manager',
                    userName: currentUser?.fullName || 'المشرف',
                    action: 'إنشاء جلسة جرد',
                    details: `تم إنشاء جلسة الجرد ببروتوكول: ${protocol}`,
                    type: 'info'
                }]
            };

            const docRef = doc(firestoreDb, 'shared_audits', docId);
            await setDoc(docRef, newAuditDoc);

            audioSynth.playTone('success');
            customAlert('تم التوليد', 'تم تفعيل وحفظ رابط الجرد الخارجي بنجاح وبانتظار عد الموظف!', 'success');
            loadSharedAudits();
        } catch (err: any) {
            console.error('Error creating shared audit:', err);
            customAlert('خطأ', 'حدث خطأ أثناء الاتصال بقاعدة البيانات السحابية.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };

    const handleUpdateAssignments = async (sessionId: string, assignments: any[]) => {
        try {
            const docRef = doc(firestoreDb, 'shared_audits', sessionId);
            await updateDoc(docRef, { assignments });
            audioSynth.playTone('info');
        } catch (err) {
            console.error('Error updating assignments:', err);
            customAlert('خطأ', 'فشل في تحديث تكليفات الموظفين.', 'danger');
        }
    };

    const handleResolveConflict = async (sessionId: string, productId: string, resolvedQty: number, userName: string) => {
        const session = sharedAudits.find(s => s.id === sessionId);
        if (!session) return;

        try {
            const updatedConflicts = (session.conflicts || []).filter((c: any) => c.productId !== productId);
            const updatedItems = session.items.map((item: any) => {
                if (item.productId === productId) {
                    return { ...item, actualQty: resolvedQty, lockedBy: null, lockedAt: null };
                }
                return item;
            });

            const docRef = doc(firestoreDb, 'shared_audits', sessionId);
            await updateDoc(docRef, {
                conflicts: updatedConflicts,
                items: updatedItems,
                logs: arrayUnion({
                    id: `resolve-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    userId: currentUser?.uid || 'manager',
                    userName: currentUser?.fullName || 'المشرف',
                    action: 'حل تضارب',
                    details: `تم اعتماد كمية (${resolvedQty}) للمنتج من جرد الموظف: ${userName}`,
                    type: 'success'
                })
            });
            audioSynth.playTone('success');
            customAlert('تم الحل', 'تم اعتماد الكمية المختارة وحل التضارب بنجاح.', 'success');
        } catch (err) {
            console.error('Error resolving conflict:', err);
            customAlert('خطأ', 'فشل في حل التضارب.', 'danger');
        }
    };

    // 2. Approve External Shared Audit & apply Stock Adjustments
    const handleApproveSharedAudit = async (sessionId: string) => {
        const session = sharedAudits.find(s => s.id === sessionId);
        if (!session) return;

        try {
            setLoadingShared(true);
            const auditDateStr = new Date().toISOString();
            const auditWarehouseId = session.warehouseId;
            
            const worksheetRecord: Record<string, { actualQty: number; notes: string }> = {};
            session.items.forEach((item: any) => {
                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                worksheetRecord[key] = {
                    actualQty: item.actualQty !== undefined ? item.actualQty : item.systemQty,
                    notes: item.notes || ''
                };
            });

            // Update local products stock
            const updatedProducts = [...(settings.products || [])].map(product => {
                let updatedProduct = { ...product };

                if (product.hasVariants && product.variants && product.variants.length > 0) {
                    const updatedVariants = product.variants.map(v => {
                        const wsKey = `${product.id}_${v.id}`;
                        if (worksheetRecord[wsKey] !== undefined) {
                            const newStockQty = worksheetRecord[wsKey].actualQty;
                            let updatedVariant = { ...v };

                            if (auditWarehouseId === 'all') {
                                updatedVariant.stockQuantity = newStockQty;
                            } else {
                                if (!updatedVariant.warehouseStock) updatedVariant.warehouseStock = {};
                                updatedVariant.warehouseStock[auditWarehouseId] = newStockQty;
                                const total = Object.values(updatedVariant.warehouseStock).reduce((sum, val) => sum + (val || 0), 0);
                                updatedVariant.stockQuantity = total;
                            }

                            if (!updatedVariant.lastAudited) updatedVariant.lastAudited = {};
                            updatedVariant.lastAudited[auditWarehouseId] = auditDateStr;

                            return updatedVariant;
                        }
                        return v;
                    });

                    const totalStock = updatedVariants.reduce((s, vr) => s + (vr.stockQuantity || 0), 0);
                    updatedProduct.variants = updatedVariants;
                    updatedProduct.stockQuantity = totalStock;
                    updatedProduct.inStock = totalStock > 0;

                    if (!updatedProduct.lastAudited) updatedProduct.lastAudited = {};
                    updatedProduct.lastAudited[auditWarehouseId] = auditDateStr;
                } else {
                    const wsKey = product.id;
                    if (worksheetRecord[wsKey] !== undefined) {
                        const newStockQty = worksheetRecord[wsKey].actualQty;
                        
                        if (auditWarehouseId === 'all') {
                            updatedProduct.stockQuantity = newStockQty;
                        } else {
                            if (!updatedProduct.warehouseStock) updatedProduct.warehouseStock = {};
                            updatedProduct.warehouseStock[auditWarehouseId] = newStockQty;
                            const total = Object.values(updatedProduct.warehouseStock).reduce((sum, val) => sum + (val || 0), 0);
                            updatedProduct.stockQuantity = total;
                        }
                        
                        updatedProduct.inStock = updatedProduct.stockQuantity > 0;
                        
                        if (!updatedProduct.lastAudited) updatedProduct.lastAudited = {};
                        updatedProduct.lastAudited[auditWarehouseId] = auditDateStr;
                    }
                }

                return updatedProduct;
            });

            // Calculate metrics for financial logs
            let totalSystemQty = 0;
            let totalActualQty = 0;
            let totalVarianceQty = 0;
            let totalVarianceValue = 0;
            const discrepancies: InventoryAuditItemDiscrepancy[] = [];

            session.items.forEach((item: any) => {
                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                const record = worksheetRecord[key];
                const actual = record.actualQty;
                const system = item.systemQty;
                const diff = actual - system;

                totalSystemQty += system;
                totalActualQty += actual;
                totalVarianceQty += diff;
                totalVarianceValue += diff * item.costPrice;

                if (diff !== 0) {
                    discrepancies.push({
                        productId: item.productId,
                        variantId: item.variantId,
                        name: item.name,
                        sku: item.sku,
                        systemQty: system,
                        actualQty: actual,
                        variance: diff,
                        costPrice: item.costPrice,
                        varianceValue: diff * item.costPrice,
                        method: diff > 0 ? 'surplus' : 'scrap',
                        notes: record.notes || 'تسوية معتمدة من الجرد الخارجي'
                    });
                }
            });

            const managerName = session.managerName || 'مسؤول الأرفف الميداني';
            const newSessionLog: InventoryAuditSession = {
                id: `audit-${Date.now()}`,
                title: `${session.title} (معتمد من الجرد الخارجي)`,
                date: auditDateStr,
                performedBy: `الميداني: ${managerName} (معتمد)`,
                scope: session.scope,
                warehouseId: session.warehouseId,
                totalSystemQty,
                totalActualQty,
                totalVarianceQty,
                totalVarianceValue,
                totalItemsAudited: session.items.length,
                discrepancies,
                notes: `تم اعتماد وتسوية جرد خارجي ومطابقته للسيستم الكلي.`
            };

            const updatedActivityLogs = [
                {
                    id: `log-${Date.now()}`,
                    user: currentUser?.fullName || 'التاجر',
                    action: 'اعتماد جرد خارجي',
                    details: `تم اعتماد ومطابقة جرد الموظف الميداني للرابط "${session.title}" وحصر ${discrepancies.length} فوارق بتسوية مالية ${totalVarianceValue.toLocaleString()} ج.م`,
                    date: new Date().toLocaleDateString('ar-EG'),
                    timestamp: Date.now()
                },
                ...(settings.activityLogs || [])
            ];

            // Push all updates to settings (for local persistence and UI sync)
            setSettings(prev => ({
                ...prev,
                products: updatedProducts,
                inventoryAudits: [newSessionLog, ...(prev.inventoryAudits || [])],
                activityLogs: updatedActivityLogs
            }));

            // Sync approved status on Firebase
            const docRef = doc(firestoreDb, 'shared_audits', sessionId);
            await updateDoc(docRef, { status: 'approved' });

            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 }
            });

            audioSynth.announce("تم اعتماد ترحيل وتسوية الجرد الخارجي بنجاح وتعديل أرصدة السيستم.", "success");
            customAlert('تم الاعتماد والترحيل', 'تم اعتماد ومطابقة جميع القيم الفعلية المرفوعة، وتعديل كميات المستودع وتأكيد الأثر المالي.', 'success');
            loadSharedAudits();
        } catch (err: any) {
            console.error(err);
            customAlert('خطأ', 'فشل في اعتماد وترحيل بيانات الجلسة.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };

    // 3. Reject External Shared Audit
    const handleRejectSharedAudit = async (sessionId: string, reason: string) => {
        try {
            setLoadingShared(true);
            const docRef = doc(firestoreDb, 'shared_audits', sessionId);
            await updateDoc(docRef, { 
                status: 'rejected',
                rejectReason: reason.trim(),
                rejectedAt: new Date().toISOString()
            });
            
            audioSynth.playTone('error');
            customAlert('تم الرفض', 'تم رفض طلب الجرد الخارجي وإعادته لتصحيح كميات الأرفف من الموظف.', 'warning');
            loadSharedAudits();
        } catch (err: any) {
            console.error(err);
            customAlert('خطأ', 'فشل في تسجيل رفض الجلسة.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };

    // 4. Delete External Shared Session
    const handleDeleteSharedAudit = async (sessionId: string) => {
        try {
            setLoadingShared(true);
            const docRef = doc(firestoreDb, 'shared_audits', sessionId);
            await deleteDoc(docRef);
            
            audioSynth.playTone('click');
            customAlert('تم الحذف', 'تم إلغاء وحذف رابط الجرد الخارجي بالكامل.', 'success');
            loadSharedAudits();
        } catch (err: any) {
            console.error(err);
            customAlert('خطأ', 'فشل في حذف المستند من السحابة.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };

    // 5. Unlock Protocol Handler
    const handleUnlockProtocol = async (sessionId: string, reason: string) => {
        try {
            setLoadingShared(true);
            const docRef = doc(firestoreDb, 'shared_audits', sessionId);
            
            const logEntry = {
                id: `unlock-${Date.now()}`,
                timestamp: new Date().toISOString(),
                userId: currentUser?.uid || 'manager',
                userName: currentUser?.fullName || 'المشرف',
                action: 'فتح قفل البروتوكول',
                details: `تم إلغاء قفل الجلسة. السبب: ${reason}`,
                type: 'unlock'
            };

            await updateDoc(docRef, { 
                isProtocolLocked: false,
                unlockReason: reason,
                unlockedBy: currentUser?.fullName || 'المشرف',
                unlockedAt: new Date().toISOString(),
                logs: arrayUnion(logEntry)
            });
            
            audioSynth.playTone('success');
            customAlert('تم فك القفل', 'تم فتح إعدادات البروتوكول للموظف لتعديل أسلوب العد.', 'success');
            loadSharedAudits();
        } catch (err: any) {
            console.error(err);
            customAlert('خطأ', 'فشل في فك قفل الجلسة.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };

    // Past Session Print Handler
    const handlePrintPastSession = (session: InventoryAuditSession) => {
        const whName = settings.warehouses?.find(w => w.id === session.warehouseId)?.name || 'كل المستودعات';
        const dateStr = new Date(session.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        let discrepanciesRows = '';
        session.discrepancies?.forEach((d, index) => {
            discrepanciesRows += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px; font-weight: bold;">${index + 1}</td>
                    <td style="padding: 10px; font-weight: bold;">${d.name}<br/><span style="font-size:9px; color:#64748b; font-family:sans-serif;">${d.sku}</span></td>
                    <td style="padding: 10px; text-align: center; font-family:sans-serif;">${d.systemQty}</td>
                    <td style="padding: 10px; text-align: center; font-family:sans-serif; color: #4f46e5; font-weight: bold;">${d.actualQty}</td>
                    <td style="padding: 10px; text-align: center; font-family:sans-serif; font-weight: bold; color: ${d.variance < 0 ? '#dc2626' : '#16a34a'}">
                        ${d.variance > 0 ? '+' : ''}${d.variance}
                    </td>
                    <td style="padding: 10px; text-align: center; font-family:sans-serif;">${d.costPrice.toLocaleString()} ج.م</td>
                    <td style="padding: 10px; text-align: left; font-family:sans-serif; font-weight: bold; color: ${d.varianceValue < 0 ? '#dc2626' : '#16a34a'}">
                        ${d.varianceValue > 0 ? '+' : ''}${d.varianceValue.toLocaleString()} ج.م
                    </td>
                </tr>
            `;
        });

        const html = `
            <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; color: #1e293b;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                    <div>
                        <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #4f46e5;">تقرير تسوية جرد المستودع المعتمد</h1>
                        <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold; color: #64748b;">${session.title}</p>
                    </div>
                    <div style="text-align: left;">
                        <span style="font-size: 10px; font-weight: bold; background: #f1f5f9; padding: 5px 10px; border-radius: 5px; color: #4f46e5;">مستند معتمد 🧾</span>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; font-weight: bold; background: #f8fafc; border-radius: 10px;">
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">المخزن المجرود:</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${whName}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">تاريخ الجلسة والترحيل:</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: sans-serif;">${dateStr}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; color: #64748b;">المشرف / المدقق المسؤول:</td>
                        <td style="padding: 12px; color: #4f46e5;">${session.performedBy}</td>
                        <td style="padding: 12px; color: #64748b;">عدد الأصناف المجرودة:</td>
                        <td style="padding: 12px;">${session.totalItemsAudited} صنف</td>
                    </tr>
                </table>

                <h3 style="font-size: 13px; font-weight: 900; color: #1e293b; margin-bottom: 10px; border-right: 4px solid #4f46e5; padding-right: 8px;">جدول ومواصفات الفروقات المسجلة والتسويات</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: right; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #475569; font-weight: 900;">
                            <th style="padding: 10px;">#</th>
                            <th style="padding: 10px;">اسم السلعة و SKU</th>
                            <th style="padding: 10px; text-align: center;">الرصيد الدفتري</th>
                            <th style="padding: 10px; text-align: center;">العد الفعلي</th>
                            <th style="padding: 10px; text-align: center;">الفارق</th>
                            <th style="padding: 10px; text-align: center;">سعر التكلفة</th>
                            <th style="padding: 10px; text-align: left;">القيمة المالية للتسوية</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${discrepanciesRows || `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #94a3b8;">كل المنتجات مطابقة تماماً للمستندات والسيستم.</td></tr>`}
                    </tbody>
                </table>

                <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
                    <table style="width: 320px; border-collapse: collapse; font-size: 12px; font-weight: bold; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">إجمالي رصيد الدفاتر:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: sans-serif;">${session.totalSystemQty} قطعة</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">إجمالي العد الفعلي:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: sans-serif; color: #4f46e5;">${session.totalActualQty} قطعة</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">مجموع فارق الكميات:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-family: sans-serif; color: ${session.totalVarianceQty < 0 ? '#dc2626' : '#16a34a'}">
                                ${session.totalVarianceQty > 0 ? '+' : ''}${session.totalVarianceQty} قطعة
                            </td>
                        </tr>
                        <tr style="font-size: 13px; font-weight: 900; background: #e0e7ff; color: #312e81;">
                            <td style="padding: 12px;">الأثر المالي الصافي للتسوية:</td>
                            <td style="padding: 12px; text-align: left; font-family: sans-serif;">
                                ${session.totalVarianceValue >= 0 ? '+' : ''}${session.totalVarianceValue.toLocaleString()} ج.م
                            </td>
                        </tr>
                    </table>
                </div>

                <div style="border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 10px; font-weight: bold; color: #94a3b8; text-align: center;">
                    تم ترحيل هذا الجرد تلقائياً وبشكل سحابي متزامن عبر منظومة الجرد والتحقق واللوجستيات الموحدة 2.0.
                </div>
            </div>
        `;

        printHTMLDirectly(html);
    };

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6 md:p-8 dir-rtl text-right font-sans">
            
            {/* If direct worksheet is active, render the full-screen Worksheet component with full scope */}
            {isDirectWorksheetOpen ? (
                <ActiveSessionWorksheet 
                    settings={settings}
                    setSettings={setSettings}
                    currentUser={currentUser}
                    onCloseSession={() => setIsDirectWorksheetOpen(false)}
                    onAlert={customAlert}
                    onConfirm={customConfirm}
                />
            ) : (
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* Header bar and main CTA */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">ENTERPRISE INVENTORY AUDIT 2.0</span>
                            <h1 className="text-xl font-black text-slate-850 dark:text-white">منظومة جرد ومطابقة المستودعات الموحدة</h1>
                            <p className="text-xs text-slate-400 font-bold">بوابة ذكية لإصدار روابط العد لموظفي الأرفف، واعتماد تسويات العجز والتالف مالياً.</p>
                        </div>

                        {/* Direct Jurd Trigger button */}
                        <button 
                            onClick={() => {
                                setIsDirectWorksheetOpen(true);
                                audioSynth.playTone('success');
                            }}
                            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs shadow-lg shadow-indigo-600/15 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus size={15} />
                            بدء جرد مباشر وتسوية للأرصدة
                        </button>
                    </div>

                    {/* Premium Navigation Tabs Bar */}
                    <div className="flex overflow-x-auto gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 max-w-3xl text-xs font-black">
                        <button 
                            onClick={() => {
                                setCurrentTab('dashboard');
                                audioSynth.playTone('click');
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-center whitespace-nowrap transition-all ${currentTab === 'dashboard' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            لوحة معلومات الجرد
                        </button>
                        <button 
                            onClick={() => {
                                setCurrentTab('supervisor');
                                audioSynth.playTone('click');
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-center whitespace-nowrap transition-all ${currentTab === 'supervisor' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            مراقبة العدادين 📡
                        </button>
                        <button 
                            onClick={() => {
                                setCurrentTab('hub');
                                audioSynth.playTone('click');
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-center whitespace-nowrap transition-all ${currentTab === 'hub' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            روابط الجرد الخارجي
                        </button>
                        <button 
                            onClick={() => {
                                setCurrentTab('variance');
                                audioSynth.playTone('click');
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-center whitespace-nowrap transition-all ${currentTab === 'variance' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            تسوية الفروقات
                        </button>
                        <button 
                            onClick={() => {
                                setCurrentTab('analytics');
                                audioSynth.playTone('click');
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-center whitespace-nowrap transition-all ${currentTab === 'analytics' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            التقرير والترحيل المالي
                        </button>
                        <button 
                            onClick={() => {
                                setCurrentTab('settings');
                                audioSynth.playTone('click');
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-center whitespace-nowrap transition-all ${currentTab === 'settings' ? 'bg-white dark:bg-slate-800 text-indigo-650 dark:text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            إعدادات الجرد
                        </button>
                    </div>

                    {/* Portals rendering */}
                    {currentTab === 'dashboard' && (
                        <AuditDashboard 
                            settings={settings}
                            pastSessions={settings.inventoryAudits || []}
                            sharedSessions={sharedAudits}
                            onNavigateTab={(tab: any) => setCurrentTab(tab)}
                            onViewPastSession={(session) => setSelectedPastSession(session)}
                            onViewSharedSession={(session) => {
                                // Redirect and open detail review
                                setCurrentTab('hub');
                            }}
                            loadingShared={loadingShared}
                        />
                    )}

                    {currentTab === 'supervisor' && (
                        <SupervisorDashboard 
                            settings={settings}
                            sharedSessions={sharedAudits}
                            onApproveSharedSession={handleApproveSharedAudit}
                            onRejectSharedSession={handleRejectSharedAudit}
                            onNavigateTab={(tab: any) => setCurrentTab(tab)}
                            loadingShared={loadingShared}
                        />
                    )}

                    {currentTab === 'hub' && (
                        <SharedAuditsTab 
                            settings={settings}
                            sharedSessions={sharedAudits}
                            onCreateSharedSession={handleCreateSharedAudit}
                            onApproveSharedSession={handleApproveSharedAudit}
                            onRejectSharedSession={handleRejectSharedAudit}
                            onDeleteSharedSession={handleDeleteSharedAudit}
                            onUnlockProtocol={handleUnlockProtocol}
                            onUpdateAssignments={handleUpdateAssignments}
                            onResolveConflict={handleResolveConflict}
                            onAlert={customAlert}
                            onConfirm={customConfirm}
                            loadingShared={loadingShared}
                        />
                    )}

                    {currentTab === 'variance' && (
                        <AuditVarianceCenter 
                            settings={settings}
                            pastSessions={settings.inventoryAudits || []}
                            onNavigateTab={(tab: any) => setCurrentTab(tab)}
                        />
                    )}

                    {currentTab === 'analytics' && (
                        <AuditAnalyticsReports 
                            settings={settings}
                            pastSessions={settings.inventoryAudits || []}
                            onViewPastSession={(session) => setSelectedPastSession(session)}
                            onPrintSession={handlePrintPastSession}
                        />
                    )}

                    {currentTab === 'settings' && (
                        <AuditSettings 
                            settings={settings}
                            setSettings={setSettings}
                            onSaveSuccess={customAlert}
                        />
                    )}

                </div>
            )}

            {/* Past Session View / Discrepancy Detail Modal */}
            {selectedPastSession && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/85 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        
                        <div className="p-5 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                            <div className="space-y-0.5">
                                <h4 className="font-black text-sm">مراجعة تقرير جرد تاريخي معتمد ومرحل</h4>
                                <p className="text-[10px] text-indigo-100 font-bold">المدقق: {selectedPastSession.performedBy} • بتاريخ: {new Date(selectedPastSession.date).toLocaleDateString('ar-EG')}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedPastSession(null)}
                                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all text-xs"
                            >
                                إغلاق ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                                    <span className="text-[9px] text-slate-400 font-black block">إجمالي كمية الدفاتر</span>
                                    <h5 className="text-sm font-black text-slate-700 dark:text-slate-350">{selectedPastSession.totalSystemQty} قطعة</h5>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                                    <span className="text-[9px] text-slate-400 font-black block">إجمالي العد الفعلي</span>
                                    <h5 className="text-sm font-black text-indigo-600">{selectedPastSession.totalActualQty} قطعة</h5>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                                    <span className="text-[9px] text-slate-400 font-black block">الأثر المالي المتراكم للتسوية</span>
                                    <h5 className={`text-sm font-black font-sans ${selectedPastSession.totalVarianceValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {selectedPastSession.totalVarianceValue >= 0 ? '+' : ''}{selectedPastSession.totalVarianceValue.toLocaleString()} ج.م
                                    </h5>
                                </div>
                            </div>

                            {/* Discrepancies Table */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-black text-slate-800 dark:text-white">جدول السلع ذات الفوارق والكسور</h5>
                                {(!selectedPastSession.discrepancies || selectedPastSession.discrepancies.length === 0) ? (
                                    <div className="py-8 text-center text-slate-400 text-xs">
                                        كل السلع في هذه الجلسة كانت مطابقة تماماً لرصيد النظام!
                                    </div>
                                ) : (
                                    <div className="border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden">
                                        <table className="w-full text-right text-[11px]">
                                            <thead className="bg-slate-50 dark:bg-slate-800/60 font-black border-b border-slate-100 dark:border-slate-855">
                                                <tr>
                                                    <th className="px-4 py-2.5">اسم السلعة و SKU</th>
                                                    <th className="px-4 py-2.5 text-center">رصيد الدفاتر</th>
                                                    <th className="px-4 py-2.5 text-center">العد الفعلي</th>
                                                    <th className="px-4 py-2.5 text-center">الفارق</th>
                                                    <th className="px-4 py-2.5 text-center">التكلفة والأسلوب</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 bg-white dark:bg-slate-900">
                                                {selectedPastSession.discrepancies.map((d, index) => {
                                                    const isLoss = d.variance < 0;
                                                    return (
                                                        <tr key={index} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-2.5 font-bold">
                                                                <div>{d.name}</div>
                                                                <span className="text-[9px] text-slate-400 font-mono">{d.sku}</span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-650 dark:text-slate-400">{d.systemQty}</td>
                                                            <td className="px-4 py-2.5 text-center font-mono font-black text-indigo-650">{d.actualQty}</td>
                                                            <td className="px-4 py-2.5 text-center font-mono font-black">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${isLoss ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                    {d.variance > 0 ? '+' : ''}{d.variance}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className="block font-sans font-bold text-slate-700 dark:text-slate-300">{d.varianceValue.toLocaleString()} ج.م</span>
                                                                <span className="text-[8px] text-slate-400 font-bold">({d.method})</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 flex justify-between shrink-0">
                            <button 
                                onClick={() => handlePrintPastSession(selectedPastSession)}
                                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-350 text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
                            >
                                <Printer size={13} />
                                طباعة هذا التقرير الكلي
                            </button>
                            <button 
                                onClick={() => setSelectedPastSession(null)}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md"
                            >
                                موافق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirm Dialog Modal */}
            {confirmDialog?.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-right">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${
                                confirmDialog.type === 'danger' ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/20' :
                                confirmDialog.type === 'success' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20' :
                                confirmDialog.type === 'info' ? 'bg-blue-50 text-blue-500 dark:bg-blue-950/20' :
                                'bg-amber-50 text-amber-500 dark:bg-amber-950/20'
                            }`}>
                                <AlertTriangle size={24} />
                            </div>
                            <h4 className="text-base font-black text-slate-850 dark:text-white">
                                {confirmDialog.title}
                            </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                            {confirmDialog.message}
                        </p>
                        <div className="flex justify-end gap-3 mt-2">
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={async () => {
                                    const callback = confirmDialog.onConfirm;
                                    setConfirmDialog(null);
                                    await callback();
                                }}
                                className={`px-5 py-2 rounded-xl text-xs font-black text-white shadow-sm transition-all ${
                                    confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' :
                                    confirmDialog.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                    confirmDialog.type === 'info' ? 'bg-blue-600 hover:bg-blue-700' :
                                    'bg-indigo-650 hover:bg-indigo-700'
                                }`}
                            >
                                تأكيد العمل
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Alert Dialog Modal */}
            {alertDialog?.isOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-right">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${
                                alertDialog.type === 'danger' ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/20' :
                                alertDialog.type === 'success' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20' :
                                alertDialog.type === 'warning' ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/20' :
                                'bg-blue-50 text-blue-500 dark:bg-blue-950/20'
                            }`}>
                                <CheckCircle size={24} />
                            </div>
                            <h4 className="text-base font-black text-slate-850 dark:text-white">
                                {alertDialog.title}
                            </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                            {alertDialog.message}
                        </p>
                        <div className="flex justify-end gap-3 mt-2">
                            <button
                                onClick={() => setAlertDialog(null)}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-all"
                            >
                                حسناً
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Image Viewer Modal */}
            {fullImageView && (
                <div 
                    className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setFullImageView(null)}
                >
                    <div className="relative max-w-4xl w-full flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
                        <img 
                            src={fullImageView} 
                            className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl border-2 border-white/10" 
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setFullImageView(null)}
                            className="px-8 py-3 bg-white text-slate-900 font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"
                        >
                            إغلاق الصورة
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};
