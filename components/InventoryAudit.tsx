import React, { useState, useMemo, useEffect } from 'react';
import { 
    Plus, Search, ClipboardList, Calendar, User, Eye, ArrowRight, CheckCircle, 
    AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Printer, AlertCircle, FileText, Check, 
    Layers, SearchCode, Trash2, Sliders, Layout, Filter, Sparkles, HelpCircle, Package, Info, Clock,
    Share2, Copy, Trash, Lock, ShieldCheck, CheckSquare, XCircle, Volume2, VolumeX, Camera, MapPin,
    Mic, Zap, Target, Gauge, Timer, Trophy
} from 'lucide-react';
import { Settings, Product, ProductVariant, InventoryAuditSession, InventoryAuditItemDiscrepancy } from '../types';
import { printHTMLDirectly } from '../utils/printHelper';
import { audioSynth } from '../utils/audioSynth';
import { db as firestoreDb } from '../services/firebaseClient';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';

interface InventoryAuditProps {
    settings: Settings;
    setSettings: (updater: React.SetStateAction<Settings>) => void;
    currentUser: any;
}

export const InventoryAudit: React.FC<InventoryAuditProps> = ({ settings, setSettings, currentUser }) => {
    // Audit main tabs: 'history' (سجل الجلسات), 'active' (بدء جرد نشط), or 'shared' (روابط الجرد لمسؤول المخزن)
    const [subTab, setSubTab] = useState<'history' | 'active' | 'shared'>('history');
    
    // Shared Audit Session State
    const [sharedAudits, setSharedAudits] = useState<any[]>([]);
    const [loadingShared, setLoadingShared] = useState(false);
    
    // Creating shared link state
    const [creatingShared, setCreatingShared] = useState(false);
    const [newSharedTitle, setNewSharedTitle] = useState('');
    const [newSharedWarehouse, setNewSharedWarehouse] = useState('all');
    const [newSharedScope, setNewSharedScope] = useState('all');
    const [newSharedPasscode, setNewSharedPasscode] = useState('');
    const [newSharedBlindCount, setNewSharedBlindCount] = useState(true);

    // Review/Approve Session State
    const [activeReviewSession, setActiveReviewSession] = useState<any | null>(null);
    const [reviewSearch, setReviewSearch] = useState('');

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

    // Reject shared audit modal state
    const [rejectModalSession, setRejectModalSession] = useState<any | null>(null);
    const [rejectReasonText, setRejectReasonText] = useState('');

    const customConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>, type: 'info' | 'warning' | 'danger' | 'success' = 'warning') => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            onConfirm,
            type
        });
    };

    const [fullImageView, setFullImageView] = useState<string | null>(null);

    const customAlert = (title: string, message: string, type: 'info' | 'warning' | 'danger' | 'success' = 'info') => {
        setAlertDialog({
            isOpen: true,
            title,
            message,
            type
        });
    };

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
        if (subTab === 'shared') {
            loadSharedAudits();
        }
    }, [subTab]);

    const handleCreateSharedAudit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSharedTitle.trim()) {
            customAlert('تنبيه', 'يرجى إدخال عنوان جلسة الجرد المشترك', 'warning');
            return;
        }

        const activeStoreId = localStorage.getItem('lastActiveStoreId') || 'default';
        const allProducts = settings.products || [];
        let filtered = allProducts;

        // Apply Scope Collection
        if (newSharedScope !== 'all') {
            filtered = allProducts.filter(p => p.collectionId === newSharedScope);
        }

        const itemsToCount: any[] = [];
        filtered.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const variantDesc = Object.entries(v.options)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(' | ');

                    const warehouseQty = newSharedWarehouse === 'all' 
                        ? (v.stockQuantity || 0)
                        : (v.warehouseStock?.[newSharedWarehouse] || 0);

                    const costPrice = v.costPrice ?? p.costPrice ?? 0;

                    // Hide products/variants that have no cost price AND no stock balance
                    if (warehouseQty <= 0 && costPrice <= 0) {
                        return; // skip
                    }

                    itemsToCount.push({
                        productId: p.id,
                        variantId: v.id,
                        name: `${p.name} (${variantDesc})`,
                        sku: v.sku || p.sku,
                        systemQty: warehouseQty,
                        costPrice: costPrice,
                    });
                });
            } else {
                const warehouseQty = newSharedWarehouse === 'all' 
                    ? (p.stockQuantity || 0)
                    : (p.warehouseStock?.[newSharedWarehouse] || 0);

                const costPrice = p.costPrice || 0;

                // Hide products that have no cost price AND no stock balance
                if (warehouseQty <= 0 && costPrice <= 0) {
                    return; // skip
                }

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
            customAlert('تنبيه', 'لا توجد منتجات مطابقة لهذا النطاق المختار!', 'warning');
            return;
        }

        try {
            setLoadingShared(true);
            const warehouseObj = settings.warehouses?.find(w => w.id === newSharedWarehouse);
            const warehouseName = warehouseObj ? warehouseObj.name : (newSharedWarehouse === 'all' ? 'الرصيد الإجمالي (جميع المخازن)' : 'مخزن غير معروف');

            const docId = `sa-${Date.now()}`;
            const newAuditDoc = {
                id: docId,
                storeId: activeStoreId,
                title: newSharedTitle.trim(),
                warehouseId: newSharedWarehouse,
                warehouseName: warehouseName,
                scope: newSharedScope,
                status: 'pending',
                createdAt: new Date().toISOString(),
                passcode: newSharedPasscode.trim() || null,
                isBlindCount: newSharedBlindCount,
                items: itemsToCount
            };

            const docRef = doc(firestoreDb, 'shared_audits', docId);
            await setDoc(docRef, newAuditDoc);

            setCreatingShared(false);
            setNewSharedTitle('');
            setNewSharedWarehouse('all');
            setNewSharedScope('all');
            setNewSharedPasscode('');
            
            audioSynth.playTone('success');
            customAlert('تم الإنشاء', 'تم إنشاء رابط الجرد المشترك بنجاح!', 'success');
            loadSharedAudits();
        } catch (err: any) {
            console.error('Error creating shared audit:', err);
            customAlert('خطأ', 'حدث خطأ أثناء إنشاء الجلسة في قاعدة البيانات.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };

    const handleApproveSharedAudit = async (session: any) => {
        try {
            setLoadingShared(true);

            // 1. Prepare values & products array
            const auditDateStr = new Date().toISOString();
            const auditWarehouseId = session.warehouseId;
            
            // Map session items to a record for easy lookup
            const worksheetRecord: Record<string, { actualQty: number; notes: string }> = {};
            session.items.forEach((item: any) => {
                const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
                worksheetRecord[key] = {
                    actualQty: item.actualQty !== undefined ? item.actualQty : item.systemQty,
                    notes: item.notes || ''
                };
            });

            // 2. Loop and update products array
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
                                
                                // Re-calculate total from warehouses if they exist
                                const totalFromWarehouses = Object.values(updatedVariant.warehouseStock).reduce((sum, val) => sum + (val || 0), 0);
                                updatedVariant.stockQuantity = totalFromWarehouses;
                            }

                            if (!updatedVariant.lastAudited) updatedVariant.lastAudited = {};
                            updatedVariant.lastAudited[auditWarehouseId] = auditDateStr;

                            return updatedVariant;
                        }
                        return v;
                    });

                    // Update total stock quantity across variants
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
                            
                            // Re-calculate total from warehouses if they exist
                            const totalFromWarehouses = Object.values(updatedProduct.warehouseStock).reduce((sum, val) => sum + (val || 0), 0);
                            updatedProduct.stockQuantity = totalFromWarehouses;
                        }
                        
                        updatedProduct.inStock = updatedProduct.stockQuantity > 0;
                        
                        if (!updatedProduct.lastAudited) updatedProduct.lastAudited = {};
                        updatedProduct.lastAudited[auditWarehouseId] = auditDateStr;
                    }
                }

                return updatedProduct;
            });

            // 3. Compute stats for session log
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
                        notes: record.notes || 'تسوية خارجية من مسؤول المخزن'
                    });
                }
            });

            // 4. Create Audit Session session structure
            const managerName = session.managerName || 'مسؤول المخزن';
            const newSessionLog: InventoryAuditSession = {
                id: `audit-${Date.now()}`,
                title: `${session.title} (معتمد من جرد خارجي)`,
                date: auditDateStr,
                performedBy: `مسؤول المخزن: ${managerName} (اعتماد التاجر)`,
                scope: session.scope,
                warehouseId: session.warehouseId,
                totalSystemQty,
                totalActualQty,
                totalVarianceQty,
                totalVarianceValue,
                totalItemsAudited: session.items.length,
                discrepancies,
                notes: `تم اعتماد وتسوية الجرد الخارجي بنجاح. القائم بالجرد: ${managerName}. ملاحظات التاجر: معتمد ومرحل للتحديث المالي.`
            };

            // 5. Update Activity Logs
            const updatedActivityLogs = [
                {
                    id: `log-${Date.now()}`,
                    user: currentUser?.fullName || 'التاجر',
                    action: 'اعتماد جرد خارجي',
                    details: `تم اعتماد وتسوية جلسة الجرد المشترك "${session.title}" وتعديل خامات المخزن لعدد ${discrepancies.length} أصناف بنسبة صافي أثر مالي ${totalVarianceValue.toLocaleString()} ج.م`,
                    date: new Date().toLocaleDateString('ar-EG'),
                    timestamp: Date.now()
                },
                ...(settings.activityLogs || [])
            ];

            // 6. Push to Settings (propagating local update + cloud sync)
            setSettings(prev => ({
                ...prev,
                products: updatedProducts,
                inventoryAudits: [newSessionLog, ...(prev.inventoryAudits || [])],
                activityLogs: updatedActivityLogs
            }));

            // 7. Update status in Firestore
            const docRef = doc(firestoreDb, 'shared_audits', session.id);
            await updateDoc(docRef, { status: 'approved' });

            setActiveReviewSession(null);
            audioSynth.announce("تم اعتماد الجرد وتعديل أرصدة السيستم بنجاح، مبروك.", "success");
            customAlert('اعتماد التسوية', 'تم اعتماد الجرد وتسوية الكميات وتحديث أرصدة المنظومة الموحدة بنجاح!', 'success');
            loadSharedAudits();
        } catch (err: any) {
            console.error('Error approving shared audit:', err);
            customAlert('خطأ', 'حدث خطأ أثناء اعتماد وتسوية الجلسة.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };

    const handleRejectSharedAudit = async (session: any, reason: string) => {
        try {
            setLoadingShared(true);
            const docRef = doc(firestoreDb, 'shared_audits', session.id);
            await updateDoc(docRef, { 
                status: 'rejected',
                rejectReason: reason.trim() || 'يرجى إعادة العد الفعلي للأصناف والتحقق من الفروقات والكميات الفجائية.',
                rejectedAt: new Date().toISOString()
            });
            
            setActiveReviewSession(null);
            setRejectModalSession(null);
            setRejectReasonText('');
            audioSynth.playTone('error');
            customAlert('تم رفض الجرد', 'تم تسجيل رفض الجلسة وإبلاغ مسؤول المخزن بالسبب لإعادة العد الفعلي.', 'warning');
            loadSharedAudits();
        } catch (err: any) {
            console.error('Error rejecting shared audit:', err);
            customAlert('خطأ', 'حدث خطأ أثناء تحديث حالة الجلسة.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };

    const handleDeleteSharedAudit = async (sessionId: string) => {
        try {
            setLoadingShared(true);
            const docRef = doc(firestoreDb, 'shared_audits', sessionId);
            await deleteDoc(docRef);
            
            audioSynth.playTone('click');
            customAlert('حذف الرابط', 'تم حذف الرابط بنجاح!', 'success');
            loadSharedAudits();
        } catch (err: any) {
            console.error('Error deleting shared audit:', err);
            customAlert('خطأ', 'حدث خطأ أثناء حذف الرابط.', 'danger');
        } finally {
            setLoadingShared(false);
        }
    };
    
    const [auditTitle, setAuditTitle] = useState('');
    const [auditScope, setAuditScope] = useState<'all' | string>('all'); // all or collection id
    const [auditWarehouseId, setAuditWarehouseId] = useState<'all' | string>('all'); // all or warehouse id
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [activeSessionStarted, setActiveSessionStarted] = useState(false);
    const [blindCount, setBlindCount] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [auditStartTime] = useState(Date.now());
    const [lastScanTime, setLastScanTime] = useState<number | null>(null);
    const [recentScans, setRecentScans] = useState<{name: string, time: string}[]>([]);

    // Voice Synthesis Helper
    const speak = (text: string) => {
        if (!isVoiceEnabled || !window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar-SA';
            utterance.rate = 1.1;
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error('Speech synthesis failed:', e);
        }
    };

    const triggerHaptic = () => {
        if ('vibrate' in navigator) {
            try { navigator.vibrate(50); } catch (e) {}
        }
    };
    const [activeZone, setActiveZone] = useState('');
    const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);
    const [isMuted, setIsMuted] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('inventory_audit_muted') === 'true' : false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerError, setScannerError] = useState('');
    
    // Session Worksheet data: map of productId (or prodId-variantId) to physical quantity, method and notes
    const [worksheet, setWorksheet] = useState<Record<string, {
        actualQty: number;
        method: 'correction' | 'scrap' | 'surplus' | 'gift' | 'missing';
        notes: string;
        zone?: string;
        proofImage?: string;
    }>>({});

    // Filter and search inside active worksheet
    const [worksheetSearch, setWorksheetSearch] = useState('');
    const [worksheetFilter, setWorksheetFilter] = useState<'all' | 'discrepancy' | 'matching'>('all');
    const [worksheetZoneFilter, setWorksheetZoneFilter] = useState<string>('all');

    // Connection Status Listeners
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleOnline = () => {
            setIsOnline(true);
            try {
                audioSynth.playTone('success');
            } catch (e) {}
            customAlert('تم استعادة الاتصال 🌐', 'متصل بالشبكة بنجاح. جاري مزامنة التغييرات سحابياً بشكل تلقائي.', 'success');
        };
        const handleOffline = () => {
            setIsOnline(false);
            customAlert('وضع عدم الاتصال 📶', 'يعمل النظام حالياً دون اتصال بالإنترنت. سيتم حفظ كافة عمليات العد بأمان داخل المتصفح تلقائياً.', 'warning');
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Load active session counting state from localStorage on mount (offline-first restore)
    useEffect(() => {
        const isStarted = localStorage.getItem('active_audit_session_started') === 'true';
        if (isStarted) {
            try {
                const savedWorksheet = localStorage.getItem('active_audit_worksheet');
                const savedTitle = localStorage.getItem('active_audit_title');
                const savedScope = localStorage.getItem('active_audit_scope');
                const savedWarehouseId = localStorage.getItem('active_audit_warehouse_id');
                const savedOnlyInStock = localStorage.getItem('active_audit_only_in_stock') === 'true';
                const savedBlindCount = localStorage.getItem('active_audit_blind_count') === 'true';
                const savedZone = localStorage.getItem('active_audit_selected_zone') || '';

                if (savedWorksheet) {
                    setWorksheet(JSON.parse(savedWorksheet));
                }
                if (savedTitle) setAuditTitle(savedTitle);
                if (savedScope) setAuditScope(savedScope);
                if (savedWarehouseId) setAuditWarehouseId(savedWarehouseId);
                setOnlyInStock(savedOnlyInStock);
                setBlindCount(savedBlindCount);
                setActiveZone(savedZone);
                setActiveSessionStarted(true);
                
                console.log('[OFFLINE-FIRST] Restored active audit session from local storage!');
            } catch (err) {
                console.error('Failed to restore active audit session:', err);
            }
        }
    }, []);

    // Save active session counting state to localStorage for robust offline-first persistence
    useEffect(() => {
        if (activeSessionStarted) {
            localStorage.setItem('active_audit_worksheet', JSON.stringify(worksheet));
            localStorage.setItem('active_audit_title', auditTitle);
            localStorage.setItem('active_audit_scope', auditScope);
            localStorage.setItem('active_audit_warehouse_id', auditWarehouseId);
            localStorage.setItem('active_audit_only_in_stock', String(onlyInStock));
            localStorage.setItem('active_audit_session_started', 'true');
            localStorage.setItem('active_audit_blind_count', String(blindCount));
            localStorage.setItem('active_audit_selected_zone', activeZone);
        } else {
            // If active session is not started, clear these
            localStorage.removeItem('active_audit_worksheet');
            localStorage.removeItem('active_audit_title');
            localStorage.removeItem('active_audit_scope');
            localStorage.removeItem('active_audit_warehouse_id');
            localStorage.removeItem('active_audit_only_in_stock');
            localStorage.removeItem('active_audit_session_started');
            localStorage.removeItem('active_audit_blind_count');
            localStorage.removeItem('active_audit_selected_zone');
        }
    }, [worksheet, activeSessionStarted, auditTitle, auditScope, auditWarehouseId, onlyInStock, blindCount, activeZone]);

    // Handle barcode scanner successfully identifying an item SKU or barcode
    const handleBarcodeScanned = (decodedText: string) => {
        if (!decodedText) return;
        const cleanedText = decodedText.trim();
        
        // Find matching product variant or product in our active scoped list
        const match = scopedProductsList.find(row => {
            return (
                row.sku === cleanedText || 
                row.productId === cleanedText || 
                (row.variantId && row.variantId === cleanedText)
            );
        });

        if (match) {
            // Found! Let's update its quantity in the worksheet
            setWorksheet(prev => {
                const currentData = prev[match.key] || { actualQty: match.systemQty, method: 'correction', notes: '', zone: activeZone };
                const newQty = currentData.actualQty + 1;
                return {
                    ...prev,
                    [match.key]: {
                        ...currentData,
                        actualQty: newQty,
                        zone: activeZone || currentData.zone
                    }
                };
            });

            // Play successful scan beep sound
            playBeepSound();
            triggerHaptic();
            speak(match.name);
            setRecentScans(prev => [{name: match.name, time: new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}, ...prev].slice(0, 5));
            
            customAlert('تم التعرف والمسح بنجاح 🎯', `المنتج: "${match.name}"\nالرف الحالي: "${activeZone || 'عام'}"\nتمت زيادة العدد بـ 1 قطعة!`, 'success');
        } else {
            // Barcode doesn't match any active item in the session
            audioSynth.playTone('error');
            triggerHaptic();
            speak('الصنف ده مش معروف');
            customAlert('رمز باركود غير معروف ⚠️', `الرمز: "${cleanedText}" غير مبرمج أو خارج نطاق المنتجات المشمولة في جلسة الجرد الحالية.`, 'danger');
        }
    };

    // Camera Barcode Scanner startup and teardown effect
    useEffect(() => {
        if (!isScannerOpen) return;
        setScannerError('');

        let scannerInstance: any = null;

        import('html5-qrcode').then(({ Html5Qrcode }) => {
            const scanner = new Html5Qrcode("reader");
            scannerInstance = scanner;
            
            scanner.start(
                { facingMode: "environment" },
                {
                    fps: 15,
                    qrbox: { width: 280, height: 160 } // Horizontal scan area optimized for barcodes
                },
                (decodedText) => {
                    handleBarcodeScanned(decodedText);
                },
                (errorMessage) => {
                    // Fail silently for sub-frame scan misses
                }
            ).catch(err => {
                console.error("Camera access or init failed:", err);
                setScannerError("عذراً، لم نتمكن من تشغيل الكاميرا. يرجى تفعيل صلاحية الكاميرا للمتصفح والمحاولة مجدداً.");
            });
        }).catch(err => {
            console.error("Failed to dynamically import html5-qrcode library:", err);
            setScannerError("فشل تحميل قارئ الباركود البرمجي.");
        });

        return () => {
            if (scannerInstance) {
                if (scannerInstance.isScanning) {
                    scannerInstance.stop()
                        .then(() => console.log('Scanner stopped successfully.'))
                        .catch((e: any) => console.error('Failed to stop scanner.', e));
                }
            }
        };
    }, [isScannerOpen]);

    // Past session details modal state
    const [selectedPastSession, setSelectedPastSession] = useState<InventoryAuditSession | null>(null);
    const [selectedPastSessionSearch, setSelectedPastSessionSearch] = useState('');

    // List of past audit sessions
    const pastSessions = useMemo(() => {
        return settings.inventoryAudits || [];
    }, [settings.inventoryAudits]);

    // Financial KPI stats
    const auditStats = useMemo(() => {
        let totalSessions = pastSessions.length;
        let totalShortageValue = 0;
        let totalSurplusValue = 0;
        let lastAuditDate = pastSessions.length > 0 ? pastSessions[0].date : '';

        pastSessions.forEach(session => {
            session.discrepancies.forEach(item => {
                if (item.variance < 0) {
                    totalShortageValue += Math.abs(item.varianceValue);
                } else if (item.variance > 0) {
                    totalSurplusValue += item.varianceValue;
                }
            });
        });

        return {
            totalSessions,
            totalShortageValue,
            totalSurplusValue,
            lastAuditDate
        };
    }, [pastSessions]);

    // Prepare products and variants list for the new session setup
    const scopedProductsList = useMemo(() => {
        if (!activeSessionStarted) return [];

        const allProducts = settings.products || [];
        let filtered = allProducts;

        // Apply Scope Collection
        if (auditScope !== 'all') {
            filtered = allProducts.filter(p => p.collectionId === auditScope);
        }

        // Apply In-stock only option
        if (onlyInStock) {
            filtered = filtered.filter(p => {
                const stock = p.hasVariants && p.variants 
                    ? p.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0)
                    : (p.stockQuantity || 0);
                return stock > 0;
            });
        }

        // Flatten to include variants as their own rows where applicable
        const worksheetRows: Array<{
            key: string; // prodId or prodId-varId
            productId: string;
            variantId?: string;
            name: string;
            sku: string;
            systemQty: number;
            costPrice: number;
            image?: string;
            variance?: number;
            lastAudited?: string;
        }> = [];

        filtered.forEach(p => {
            const productLastAudited = p.lastAudited?.[auditWarehouseId] || p.lastAudited?.['all'];

            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const variantDesc = Object.entries(v.options)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(' | ');

                    const warehouseQty = auditWarehouseId === 'all' 
                        ? (v.stockQuantity || 0)
                        : (v.warehouseStock?.[auditWarehouseId] || 0);

                    const costPrice = v.costPrice ?? p.costPrice ?? 0;

                    // Hide products/variants that have no cost price AND no stock balance
                    if (warehouseQty <= 0 && costPrice <= 0) {
                        return; // skip
                    }

                    worksheetRows.push({
                        key: `${p.id}_${v.id}`,
                        productId: p.id,
                        variantId: v.id,
                        name: `${p.name} (${variantDesc})`,
                        sku: v.sku || p.sku,
                        systemQty: warehouseQty,
                        costPrice: costPrice,
                        image: p.thumbnail || p.images?.[0],
                        lastAudited: v.lastAudited?.[auditWarehouseId] || v.lastAudited?.['all'] || productLastAudited
                    });
                });
            } else {
                const warehouseQty = auditWarehouseId === 'all' 
                    ? (p.stockQuantity || 0)
                    : (p.warehouseStock?.[auditWarehouseId] || 0);

                const costPrice = p.costPrice || 0;

                // Hide products/variants that have no cost price AND no stock balance
                if (warehouseQty <= 0 && costPrice <= 0) {
                    return; // skip
                }

                worksheetRows.push({
                    key: p.id,
                    productId: p.id,
                    name: p.name,
                    sku: p.sku || '',
                    systemQty: warehouseQty,
                    costPrice: costPrice,
                    image: p.thumbnail || p.images?.[0],
                    lastAudited: productLastAudited
                });
            }
        });

        return worksheetRows;
    }, [activeSessionStarted, auditScope, auditWarehouseId, onlyInStock, settings.products]);

    // Start New Session
    const handleStartSession = (e: React.FormEvent) => {
        e.preventDefault();
        if (!auditTitle.trim()) {
            customAlert('تنبيه', 'الرجاء إدخال اسم أو عنوان لجلسة الجرد', 'warning');
            return;
        }

        // Initialize worksheet with actual values matching system values
        const initialWorksheet: Record<string, {
            actualQty: number;
            method: 'correction' | 'scrap' | 'surplus';
            notes: string;
        }> = {};

        // Find applicable products
        const allProducts = settings.products || [];
        let filtered = allProducts;
        if (auditScope !== 'all') {
            filtered = allProducts.filter(p => p.collectionId === auditScope);
        }
        if (onlyInStock) {
            filtered = filtered.filter(p => {
                const stock = p.hasVariants && p.variants 
                    ? p.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0)
                    : (p.stockQuantity || 0);
                return stock > 0;
            });
        }

        filtered.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const warehouseQty = auditWarehouseId === 'all' 
                        ? (v.stockQuantity || 0)
                        : (v.warehouseStock?.[auditWarehouseId] || 0);

                    const costPrice = v.costPrice ?? p.costPrice ?? 0;

                    // Hide products/variants that have no cost price AND no stock balance
                    if (warehouseQty <= 0 && costPrice <= 0) {
                        return; // skip
                    }

                    initialWorksheet[`${p.id}_${v.id}`] = {
                        actualQty: warehouseQty,
                        method: 'correction',
                        notes: ''
                    };
                });
            } else {
                const warehouseQty = auditWarehouseId === 'all' 
                    ? (p.stockQuantity || 0)
                    : (p.warehouseStock?.[auditWarehouseId] || 0);

                const costPrice = p.costPrice || 0;

                // Hide products/variants that have no cost price AND no stock balance
                if (warehouseQty <= 0 && costPrice <= 0) {
                    return; // skip
                }

                initialWorksheet[p.id] = {
                    actualQty: warehouseQty,
                    method: 'correction',
                    notes: ''
                };
            }
        });

        setWorksheet(initialWorksheet);
        setActiveSessionStarted(true);
        audioSynth.announce("بدأنا جلسة جرد جديدة، بالتوفيق، ركز في الكميات وفروقات المخزن.", "info");
    };

    // Audio and Speech Utilities
    const playBeepSound = () => {
        if (isMuted) return;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now); // 1200Hz high pitch clean beep
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } catch (e) {
            console.warn("Failed to play beep sound:", e);
        }
    };

    const playCelebrationSound = () => {
        if (isMuted) return;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            const now = ctx.currentTime;
            const playNote = (freq: number, start: number, duration: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + start);
                gain.gain.setValueAtTime(0, now + start);
                gain.gain.linearRampToValueAtTime(0.12, now + start + 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + start);
                osc.stop(now + start + duration);
            };
            playNote(523.25, 0, 0.2); // C5
            playNote(659.25, 0.1, 0.2); // E5
            playNote(783.99, 0.2, 0.2); // G5
            playNote(1046.50, 0.3, 0.5); // C6
        } catch (e) {
            console.warn("Failed to play celebration sound:", e);
        }
    };

    const playChangeSound = () => {
        if (isMuted) return;
        try {
            audioSynth.playTone('click');
        } catch (e) {}
    };

    // Update specific SKU quantity
    const handleQtyChange = (key: string, value: number) => {
        const cleanValue = Math.max(0, value);
        playChangeSound();
        triggerHaptic();
        
        const product = scopedProductsList.find(p => p.key === key);
        if (product) {
            speak(`${product.name}: ${cleanValue}`);
        }

        setWorksheet(prev => {
            const currentItem = prev[key] || { actualQty: 0, method: 'correction', notes: '', zone: activeZone };
            const sysQty = scopedProductsList.find(r => r.key === key)?.systemQty || 0;
            const diff = cleanValue - sysQty;

            // Pre-select highly appropriate method based on discrepancy
            let defaultMethod: 'correction' | 'scrap' | 'surplus' | 'gift' | 'missing' = currentItem.method;
            if (diff < 0) {
                // Shortage: select scrap, missing or correction
                if (currentItem.method === 'surplus' || currentItem.method === 'correction') {
                    defaultMethod = 'scrap';
                }
            } else if (diff > 0) {
                // Surplus: select surplus, gift or correction
                if (currentItem.method === 'scrap' || currentItem.method === 'missing' || currentItem.method === 'correction') {
                    defaultMethod = 'surplus';
                }
            } else {
                defaultMethod = 'correction';
            }

            return {
                ...prev,
                [key]: {
                    ...currentItem,
                    actualQty: cleanValue,
                    method: defaultMethod,
                    zone: currentItem.zone || activeZone // Set active zone if empty
                }
            };
        });
    };

    const handleMethodChange = (key: string, method: 'correction' | 'scrap' | 'surplus' | 'gift' | 'missing') => {
        playChangeSound();
        setWorksheet(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { actualQty: 0, method: 'correction', notes: '', zone: activeZone }),
                method
            }
        }));
    };

    const handleNotesChange = (key: string, notes: string) => {
        setWorksheet(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { actualQty: 0, method: 'correction', notes: '', zone: activeZone }),
                notes
            }
        }));
    };

    const handleZoneChange = (key: string, zone: string) => {
        setWorksheet(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { actualQty: 0, method: 'correction', notes: '', zone: activeZone }),
                zone
            }
        }));
    };

    const handleProofImageChange = (key: string, proofImage: string) => {
        setWorksheet(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { actualQty: 0, method: 'correction', notes: '', zone: activeZone }),
                proofImage
            }
        }));
    };

    // Live calculation for current active worksheet
    const activeSessionStats = useMemo(() => {
        let totalChecked = 0;
        let totalAudited = 0; // Number of items actually counted/touched
        let totalWithDiscrepancies = 0;
        let totalSystemQty = 0;
        let totalActualQty = 0;
        let totalNetValueAdjustment = 0;
        let surplusCount = 0;
        let shortageCount = 0;

        scopedProductsList.forEach(row => {
            const data = worksheet[row.key];
            if (data) totalAudited += 1;
            
            const effectiveData = data || { actualQty: row.systemQty, method: 'correction', notes: '' };
            totalChecked += 1;
            totalSystemQty += row.systemQty;
            totalActualQty += effectiveData.actualQty;

            const diff = effectiveData.actualQty - row.systemQty;
            if (diff !== 0) {
                totalWithDiscrepancies += 1;
                const valueOfDiff = diff * row.costPrice;
                totalNetValueAdjustment += valueOfDiff;

                if (diff > 0) surplusCount += 1;
                if (diff < 0) shortageCount += 1;
            }
        });

        const progressPercent = scopedProductsList.length > 0 ? (totalAudited / scopedProductsList.length) * 100 : 0;
        
        // Calculate velocity (items per minute)
        const elapsedMinutes = (Date.now() - auditStartTime) / 60000;
        const velocity = elapsedMinutes > 0 ? totalAudited / elapsedMinutes : 0;
        const etc = velocity > 0 ? (scopedProductsList.length - totalAudited) / velocity : 0;

        return {
            totalChecked,
            totalAudited,
            progressPercent,
            velocity,
            etc,
            totalWithDiscrepancies,
            totalSystemQty,
            totalActualQty,
            totalNetValueAdjustment,
            surplusCount,
            shortageCount
        };
    }, [scopedProductsList, worksheet, auditStartTime]);

    // Milestones tracking effects
    const [milestonesReached, setMilestonesReached] = useState<number[]>([]);
    
    useEffect(() => {
        if (!activeSessionStarted) return;
        const progress = activeSessionStats.progressPercent;
        const milestones = [25, 50, 75, 100];
        milestones.forEach(m => {
            if (progress >= m && !milestonesReached.includes(m)) {
                setMilestonesReached(prev => [...prev, m]);
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#4f46e5', '#10b981', '#f59e0b']
                });
                speak(`رائع! لقد أنجزت ${m} بالمئة من الجرد`);
            }
        });
    }, [activeSessionStats.progressPercent, activeSessionStarted, milestonesReached]);

    const handleFocusBarcodeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const input = (e.currentTarget.elements.namedItem('focusBarcode') as HTMLInputElement);
        if (input.value) {
            handleBarcodeScanned(input.value);
            input.value = '';
        }
    };

    // Gather unique zones for filtering
    const worksheetZones = useMemo(() => {
        const zonesSet = new Set<string>();
        Object.values(worksheet).forEach((item: any) => {
            if (item.zone) {
                zonesSet.add(item.zone);
            }
        });
        return Array.from(zonesSet).filter(Boolean);
    }, [worksheet]);

    // Active session rows filtered
    const filteredWorksheetRows = useMemo(() => {
        return scopedProductsList.filter(row => {
            // Apply Search
            const matchesSearch = 
                row.name.toLowerCase().includes(worksheetSearch.toLowerCase()) || 
                row.sku.toLowerCase().includes(worksheetSearch.toLowerCase());

            if (!matchesSearch) return false;

            // Apply filter
            const data = worksheet[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '', zone: '' };
            const diff = data.actualQty - row.systemQty;

            if (worksheetFilter === 'discrepancy') return diff !== 0;
            if (worksheetFilter === 'matching') return diff === 0;

            // Apply zone filter
            if (worksheetZoneFilter !== 'all') {
                const itemZone = data.zone || '';
                if (worksheetZoneFilter === 'unassigned') {
                    if (itemZone !== '') return false;
                } else {
                    if (itemZone !== worksheetZoneFilter) return false;
                }
            }

            return true;
        });
    }, [scopedProductsList, worksheet, worksheetSearch, worksheetFilter, worksheetZoneFilter]);

    // Apply entire audit session to products and save to history
    const handleFinalizeAudit = () => {
        // 1. Loop and update products array
        const auditDateStr = new Date().toISOString();
        const updatedProducts = [...(settings.products || [])].map(product => {
            let updatedProduct = { ...product };

            if (product.hasVariants && product.variants && product.variants.length > 0) {
                const updatedVariants = product.variants.map(v => {
                    const wsKey = `${product.id}_${v.id}`;
                    if (worksheet[wsKey] !== undefined) {
                        const newStockQty = worksheet[wsKey].actualQty;
                        let updatedVariant = { ...v };

                        if (auditWarehouseId === 'all') {
                            updatedVariant.stockQuantity = newStockQty;
                        } else {
                            if (!updatedVariant.warehouseStock) updatedVariant.warehouseStock = {};
                            updatedVariant.warehouseStock[auditWarehouseId] = newStockQty;
                            
                            // Re-calculate total from warehouses if they exist
                            const totalFromWarehouses = Object.values(updatedVariant.warehouseStock).reduce((sum, val) => sum + (val || 0), 0);
                            updatedVariant.stockQuantity = totalFromWarehouses;
                        }

                        if (!updatedVariant.lastAudited) updatedVariant.lastAudited = {};
                        updatedVariant.lastAudited[auditWarehouseId] = auditDateStr;

                        return updatedVariant;
                    }
                    return v;
                });

                // Update total stock quantity across variants
                const totalStock = updatedVariants.reduce((s, vr) => s + (vr.stockQuantity || 0), 0);
                updatedProduct.variants = updatedVariants;
                updatedProduct.stockQuantity = totalStock;
                updatedProduct.inStock = totalStock > 0;

                if (!updatedProduct.lastAudited) updatedProduct.lastAudited = {};
                updatedProduct.lastAudited[auditWarehouseId] = auditDateStr;
            } else {
                const wsKey = product.id;
                if (worksheet[wsKey] !== undefined) {
                    const newStockQty = worksheet[wsKey].actualQty;
                    
                    if (auditWarehouseId === 'all') {
                        updatedProduct.stockQuantity = newStockQty;
                    } else {
                        if (!updatedProduct.warehouseStock) updatedProduct.warehouseStock = {};
                        updatedProduct.warehouseStock[auditWarehouseId] = newStockQty;
                        
                        // Re-calculate total from warehouses if they exist
                        const totalFromWarehouses = Object.values(updatedProduct.warehouseStock).reduce((sum, val) => sum + (val || 0), 0);
                        updatedProduct.stockQuantity = totalFromWarehouses;
                    }
                    
                    updatedProduct.inStock = updatedProduct.stockQuantity > 0;
                    
                    if (!updatedProduct.lastAudited) updatedProduct.lastAudited = {};
                    updatedProduct.lastAudited[auditWarehouseId] = auditDateStr;
                }
            }

            return updatedProduct;
        });

        // 2. Build Discrepancies report records
        const discrepancies: InventoryAuditItemDiscrepancy[] = [];
        scopedProductsList.forEach(row => {
            const data = worksheet[row.key];
            if (data) {
                const variance = data.actualQty - row.systemQty;
                if (variance !== 0) {
                    discrepancies.push({
                        productId: row.productId,
                        variantId: row.variantId,
                        name: row.name,
                        sku: row.sku,
                        systemQty: row.systemQty,
                        actualQty: data.actualQty,
                        variance: variance,
                        costPrice: row.costPrice,
                        varianceValue: variance * row.costPrice,
                        method: data.method,
                        notes: data.notes,
                        zone: data.zone,
                        proofImage: data.proofImage
                    });
                }
            }
        });

        // 3. Create Audit Session session structure
        const userName = currentUser?.fullName || currentUser?.name || currentUser?.email || 'مسؤول الجرد';
        const newSessionLog: InventoryAuditSession = {
            id: `audit-${Date.now()}`,
            title: auditTitle,
            date: auditDateStr,
            performedBy: userName,
            scope: auditScope,
            warehouseId: auditWarehouseId,
            totalSystemQty: activeSessionStats.totalSystemQty,
            totalActualQty: activeSessionStats.totalActualQty,
            totalVarianceQty: activeSessionStats.totalActualQty - activeSessionStats.totalSystemQty,
            totalVarianceValue: activeSessionStats.totalNetValueAdjustment,
            totalItemsAudited: scopedProductsList.length,
            discrepancies,
            notes: `تم ترحيل الجرد وحفظ التسويات المخزنية بنجاح. الفروقات المكتشفة: عجز في ${activeSessionStats.shortageCount} صنوف، وزيادة في ${activeSessionStats.surplusCount} صنوف.`
        };

        // 4. Update Settings State
        const updatedActivityLogs = [
            {
                id: `log-${Date.now()}`,
                user: userName,
                action: 'جرد وتسوية المخزون',
                details: `تم الانتهاء من جلسة الجرد "${auditTitle}" وتعديل خامات المخزون لعدد ${discrepancies.length} أصناف بنسبة صافي تعديل مالي ${activeSessionStats.totalNetValueAdjustment.toLocaleString()} ج.م`,
                date: new Date().toLocaleDateString('ar-EG'),
                timestamp: Date.now()
            },
            ...(settings.activityLogs || [])
        ];

        setSettings(prev => ({
            ...prev,
            products: updatedProducts,
            inventoryAudits: [newSessionLog, ...(prev.inventoryAudits || [])],
            activityLogs: updatedActivityLogs
        }));

        // Reset state and exit active view
        setActiveSessionStarted(false);
        setAuditTitle('');
        setAuditScope('all');
        setSubTab('history');
        setBlindCount(false);
        setActiveZone('');

        // Clear local storage for active session
        localStorage.removeItem('active_audit_worksheet');
        localStorage.removeItem('active_audit_title');
        localStorage.removeItem('active_audit_scope');
        localStorage.removeItem('active_audit_warehouse_id');
        localStorage.removeItem('active_audit_only_in_stock');
        localStorage.removeItem('active_audit_session_started');
        localStorage.removeItem('active_audit_blind_count');
        localStorage.removeItem('active_audit_selected_zone');

        // Play celebration audio and launch confetti
        playCelebrationSound();
        try {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 }
            });
        } catch (e) {
            console.warn(e);
        }

        audioSynth.announce("تم ترحيل وحفظ جلسة الجرد بنجاح، وتعديل كميات المخزن بالكامل وتسوية الفروقات بميزانية النشاط.", "success");
        customAlert('ترحيل الجرد الميداني', 'تم ترحيل الجرد وحفظ كافة التسويات بنجاح، وتمت مزامنة كميات المستودع الحالية!', 'success');
    };

    // Print past report details
    const handlePrintReport = (session: InventoryAuditSession) => {
        const dateStr = new Date(session.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>تقرير جرد المخزون - ${session.title}</title>
                <style>
                    body { font-family: 'Cairo', system-ui, sans-serif; padding: 20px; color: #334155; }
                    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 25px; }
                    .title { font-size: 24px; font-weight: bold; color: #1e293b; margin: 0; }
                    .meta { display: flex; justify-content: space-between; flex-wrap: wrap; margin-top: 10px; font-size: 14px; color: #64748b; }
                    .stats-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
                    .stat-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
                    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
                    td { border: 1px solid #e2e8f0; padding: 10px; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
                    .badge-deficit { background: #fee2e2; color: #b91c1c; }
                    .badge-surplus { background: #dcfce7; color: #15803d; }
                    .badge-correct { background: #f1f5f9; color: #475569; }
                    .text-right { text-align: left; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="title">تقرير جرد المخزون والتسوية الحسابية</h1>
                    <div class="meta">
                        <span>جلسة الجرد: <strong>${session.title}</strong></span>
                        <span>تاريخ الترحيل: <strong>${dateStr}</strong></span>
                        <span>المسؤول: <strong>${session.performedBy}</strong></span>
                    </div>
                </div>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div>إجمالي ما جُرِد</div>
                        <div class="stat-val">${session.totalItemsAudited || (session.discrepancies.length + 0)} صنف</div>
                    </div>
                    <div class="stat-card">
                        <div>أصناف بها فروقات</div>
                        <div class="stat-val">${session.discrepancies.length} صنف</div>
                    </div>
                    <div class="stat-card">
                        <div>صافي الفوارق</div>
                        <div class="stat-val" style="color: ${session.totalVarianceQty >= 0 ? '#16a34a' : '#dc2626'}">${session.totalVarianceQty > 0 ? '+' : ''}${session.totalVarianceQty} وحدة</div>
                    </div>
                    <div class="stat-card">
                        <div>صافي القيمة</div>
                        <div class="stat-val" style="color: ${session.totalVarianceValue >= 0 ? '#16a34a' : '#dc2626'}">${session.totalVarianceValue.toLocaleString()} ج.م</div>
                    </div>
                </div>
                <h3>تفاصيل الأصناف والمستوى التفصيلي للفروقات:</h3>
                <table>
                    <thead>
                        <tr>
                            <th>الصنف / المنتج</th>
                            <th>الـ SKU</th>
                            <th>الرصيد بالنظام</th>
                            <th>الرصيد الفعلي</th>
                            <th>الفارق المبرمجي</th>
                            <th>سعر التكلفة</th>
                            <th>تأثير التسوية المالي</th>
                            <th>الأسلوب المتبع</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${session.discrepancies.length === 0 ? `
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px; color: #64748b; font-style: italic;">
                                    لم يتم رصد أي فجوات أو فوارق في هذه الجلسة. جميع الأصناف مطابقة تماماً لأرصدة النظام.
                                </td>
                            </tr>
                        ` : session.discrepancies.map(item => `
                            <tr>
                                <td><strong>${item.name}</strong></td>
                                <td>${item.sku}</td>
                                <td>${item.systemQty}</td>
                                <td>${item.actualQty}</td>
                                <td>
                                    <span class="badge ${item.variance < 0 ? 'badge-deficit' : 'badge-surplus'}">
                                        ${item.variance > 0 ? '+' : ''}${item.variance}
                                    </span>
                                </td>
                                <td class="text-right">${item.costPrice.toLocaleString()} ج.م</td>
                                <td class="text-right" style="color: ${item.varianceValue >= 0 ? '#16a34a' : '#b91c1c'}; font-weight: bold;">
                                    ${item.varianceValue > 0 ? '+' : ''}${item.varianceValue.toLocaleString()} ج.م
                                </td>
                                <td>
                                    ${item.method === 'scrap' ? 'شطب هالك / مفقود' : item.method === 'surplus' ? 'إضافة بضاعة زائدة' : 'تصحيح عهدة مباشر'}
                                    ${item.notes ? `<div style="font-size: 10px; color: #64748b; margin-top:2px;">ملاحظات: ${item.notes}</div>` : ''}
                                    ${item.zone ? `<div style="font-size: 10px; color: #6366f1; margin-top:2px;">الرف: ${item.zone}</div>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 50px; text-align: left; display: flex; justify-content: space-between;">
                    <div>توقيع مسؤول المستودع: _____________________</div>
                    <div>توقيع المدير المسؤول: _____________________</div>
                </div>
            </body>
            </html>
        `;

        printHTMLDirectly(html);
    };

    const toggleMute = () => {
        setIsMuted(prev => {
            const next = !prev;
            localStorage.setItem('inventory_audit_muted', String(next));
            return next;
        });
    };

    return (
        <div className="space-y-6">
            {/* Tabs for Sub Audit Page */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-nowrap scrollbar-none">
                <button 
                    onClick={() => { setSubTab('history'); setActiveSessionStarted(false); }}
                    className={`pb-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${subTab === 'history' && !activeSessionStarted ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <ClipboardList size={18}/> سجل جلسات الجرد والتسوية
                </button>
                <button 
                    onClick={() => { setSubTab('active'); }}
                    className={`pb-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${subTab === 'active' || activeSessionStarted ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Plus size={18}/> {activeSessionStarted ? 'جلسة جرد نشطة حالياً' : 'بدء عملية جرد جديدة'}
                </button>
                <button 
                    onClick={() => { setSubTab('shared'); setActiveSessionStarted(false); }}
                    className={`pb-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${subTab === 'shared' && !activeSessionStarted ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Layers size={18}/> روابط جرد مسؤول المخزن (المشترك)
                </button>
            </div>

            {/* System Integrity & Feedback Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-2.5 text-xs font-black text-slate-700 dark:text-slate-300">
                        <span className={`w-3 h-3 rounded-full inline-block shrink-0 ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-bounce'}`} />
                        {isOnline ? 'متصل بالشبكة ومزامّن سحابياً بشكل مستمر 🌐' : 'يعمل دون اتصال بالإنترنت (أوفلاين) 📶'}
                    </span>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={toggleMute}
                        className={`w-full sm:w-auto p-2 px-4 rounded-xl border transition-all flex items-center justify-center gap-2 text-xs font-bold shadow-sm ${isMuted ? 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-950/40' : 'bg-slate-100/80 border-slate-200 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-750'}`}
                    >
                        {isMuted ? <VolumeX size={14} className="animate-wiggle"/> : <Volume2 size={14}/>}
                        {isMuted ? 'كتم المؤثرات الصوتية' : 'المؤثرات الصوتية نشطة'}
                    </button>
                </div>
            </div>

            {/* Sub Tab: HISTORY (سجل تسويات الجرد) */}
            {subTab === 'history' && !activeSessionStarted && (
                <div className="space-y-6">
                    {/* Header stats overview cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                            <span className="text-xs text-slate-400 font-bold block mb-1">دورية الجرد (تنبيه)</span>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
                                    <Clock size={20}/>
                                </span>
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="number" 
                                        value={settings.auditAlertDays || 30} 
                                        onChange={(e) => setSettings(s => ({ ...s, auditAlertDays: Number(e.target.value) }))}
                                        className="w-12 bg-transparent text-xl font-black text-slate-800 dark:text-white border-none outline-none focus:ring-0 p-0"
                                    />
                                    <span className="text-xs font-bold text-slate-400">يوم</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                            <span className="text-xs text-slate-400 font-bold block mb-1">إجمالي عمليات الجرد</span>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <ClipboardList size={20}/>
                                </span>
                                <span className="text-xl font-black text-slate-800 dark:text-white">{auditStats.totalSessions} جلسة</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                            <span className="text-xs text-slate-400 font-bold block mb-1">إجمالي قيمة عجز الجرد</span>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg">
                                    <TrendingDown size={20}/>
                                </span>
                                <span className="text-xl font-black text-rose-600">{auditStats.totalShortageValue.toLocaleString()} ج.م</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                            <span className="text-xs text-slate-400 font-bold block mb-1">إجمالي قيمة الوفر والزيادات</span>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                    <TrendingUp size={20}/>
                                </span>
                                <span className="text-xl font-black text-emerald-600">{auditStats.totalSurplusValue.toLocaleString()} ج.م</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
                            <span className="text-xs text-slate-500 font-bold block mb-1">آخر موعد جرد متكامل</span>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                    <Calendar size={20}/>
                                </span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    {auditStats.lastAuditDate ? new Date(auditStats.lastAuditDate).toLocaleDateString('ar-EG') : 'لا يوجد جرد سابق'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Past sessions container */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white">جلسات الجرد السابقة والتسويات المرحلة</h3>
                            <button 
                                onClick={() => setSubTab('active')} 
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all"
                            >
                                <Plus size={14}/> بدء جرد جديد
                            </button>
                        </div>

                        {pastSessions.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <ClipboardList className="mx-auto mb-3 opacity-30 text-slate-400" size={48}/>
                                <p className="font-bold text-slate-600 dark:text-slate-400">لم يتم تسجيل أي تسوية أو جلسة جرد من قبل بنظامك</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">تساعدك جلسات الجرد على مطابقة مخزونك المالي والكميات المبرمجة بالواقع في المستودعات مع الاحتفاظ بتقارير دقيقة.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {pastSessions.map(session => {
                                    const dateFormatted = new Date(session.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    const netDiscrepancyColor = session.totalVarianceValue >= 0 ? 'text-emerald-600' : 'text-rose-600';
                                    const itemsDiscrepancyCount = session.discrepancies.length;

                                    return (
                                        <div key={session.id} className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                            <div className="space-y-1">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                                                    {session.title}
                                                </h4>
                                                <p className="text-xs text-slate-500 font-bold flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <span className="flex items-center gap-1"><Calendar size={13}/> {dateFormatted}</span>
                                                    <span className="flex items-center gap-1"><User size={13}/> بواسطة: {session.performedBy}</span>
                                                    <span className="flex items-center gap-1"><Layers size={13}/> النطاق: {session.scope === 'all' ? 'المخزن بالكامل' : 'تصنيف محدد'}</span>
                                                    <span className="flex items-center gap-1"><Package size={13}/> المخزن: {session.warehouseId === 'all' ? 'جميع المخازن' : settings.warehouses?.find(w => w.id === session.warehouseId)?.name || 'غير معروف'}</span>
                                                </p>
                                            </div>

                                            <div className="flex w-full sm:w-auto justify-between sm:justify-end items-center gap-6 border-t sm:border-0 pt-3 sm:pt-0">
                                                <div className="text-left">
                                                    <div className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">المطابقة والتسوية</div>
                                                    <div className={`font-black text-sm sm:text-base ${netDiscrepancyColor}`}>
                                                        {session.totalVarianceValue >= 0 ? '+' : ''}
                                                        {session.totalVarianceValue.toLocaleString()} ج.م
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-bold">
                                                        {itemsDiscrepancyCount} أصناف بها فجوات
                                                    </div>
                                                </div>

                                                <div className="flex gap-1.5">
                                                    <button 
                                                        onClick={() => setSelectedPastSession(session)}
                                                        className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 transition-all flex items-center gap-1 text-xs font-bold"
                                                        title="عرض تقرير الجرد"
                                                    >
                                                        <Eye size={15}/> عرض التقرير
                                                    </button>
                                                    <button 
                                                        onClick={() => handlePrintReport(session)}
                                                        className="p-2 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/20 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 transition-all"
                                                        title="طباعة التقرير"
                                                    >
                                                        <Printer size={15}/>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sub Tab: NEW ACTIVE SESSION (إعداد أو إدارة جلسة الجرد) */}
            {subTab === 'active' && !activeSessionStarted && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm mx-auto max-w-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                            <ClipboardList size={24}/>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white">إطلاق جلسة جرد وتسوية مخزنية جديدة</h3>
                            <p className="text-xs text-slate-500">حدد نطاق الجرد وجدول المطابقة لبدء حساب الفروقات وتعديل العهود الحالية.</p>
                        </div>
                    </div>

                    <form onSubmit={handleStartSession} className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">اسم جلسة الجرد (عنوان تسوية المخازن) *</label>
                            <input 
                                type="text" 
                                required
                                value={auditTitle}
                                onChange={e => setAuditTitle(e.target.value)}
                                placeholder="مثال: جرد الربع الأول 2026، أو تسوية جرد تالف الملابس"
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold dark:text-white transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">المستودع / المخزن المستهدف</label>
                                <select 
                                    value={auditWarehouseId}
                                    onChange={e => setAuditWarehouseId(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold dark:text-white transition-all"
                                >
                                    <option value="all">الرصيد الإجمالي (جميع المخازن)</option>
                                    {(settings.warehouses || []).map(w => (
                                        <option key={w.id} value={w.id}>مخزن: {w.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">نطاق البضائع المشمولة بالجرد</label>
                                <select 
                                    value={auditScope}
                                    onChange={e => setAuditScope(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-bold dark:text-white transition-all"
                                >
                                    <option value="all">كل المنتجات بالمخزن</option>
                                    {settings.collections?.map(col => (
                                        <option key={col.id} value={col.id}>مجموعة: {col.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center">
                                <label className="flex items-center gap-2.5 cursor-pointer mt-3">
                                    <input 
                                        type="checkbox"
                                        checked={onlyInStock}
                                        onChange={e => setOnlyInStock(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-350 bg-slate-100"
                                    />
                                    <span className="text-xs text-slate-600 dark:text-slate-350 font-bold">تحميل المنتجات المتوفرة فقط (تخطى المنتهية)</span>
                                </label>
                            </div>
                        </div>

                        {/* Blind Count Option Card */}
                        <div className="flex items-center justify-between p-4 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/20 rounded-2xl">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0 mt-0.5">
                                    <Lock size={18} />
                                </div>
                                <div className="text-right">
                                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-white">نمط الجرد الأعمى (Blind Count)</h5>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-normal mt-0.5">إخفاء الأرصدة الدفترية وفوارق الكميات والمبالغ عن مسؤول المخزن لمنع الانحياز وتأكيد صحة العد الميداني.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setBlindCount(!blindCount);
                                    playChangeSound();
                                }}
                                className={`w-12 h-6 rounded-full p-1 transition-colors relative flex items-center shrink-0 ${blindCount ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'}`}
                            >
                                <div className="w-4 h-4 bg-white rounded-full shadow-md transform transition-all" />
                            </button>
                        </div>

                        <div className="bg-slate-100/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
                            <Info size={16} className="text-indigo-500 shrink-0 mt-0.5"/>
                            <div className="space-y-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300">كيف تعمل جلسة الجرد والبرمجة؟</p>
                                <p className="leading-relaxed">سيقوم النظام بتجميع الكميات والمخازن المسجلة حالياً كملخص أساسي. بعد ذلك، يمكنك إدراج الكميات الفعلية المكتشفة باليد، وسيقوم النظام فوراً بحساب قيمة الفجوة أو العجز المالي وتكلفة الخسائر والمكاسب، وتطبيقها للمخزن بضغطة واحدة مع تدوين التسوية بسهم حسابي.</p>
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={18}/> بدء الجلسة وتجهيز الاستمارة
                        </button>
                    </form>
                </div>
            )}

            {/* Sub View: ACTIVE WORKSHEET (جلسة الجرد الفعالة) */}
            {activeSessionStarted && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Focus Mode Overlay */}
                    {isFocusMode && (
                        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in zoom-in duration-300">
                            <button 
                                onClick={() => setIsFocusMode(false)}
                                className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
                            >
                                <XCircle size={32}/>
                            </button>
                            
                            <div className="w-full max-w-2xl space-y-10 text-center">
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-full border border-indigo-500/30 text-sm font-black uppercase tracking-widest">
                                        <Zap size={16} className="animate-pulse"/> وضع التركيز النشط
                                    </div>
                                    <h2 className="text-4xl font-black text-white">ابدأ بالمسح الضوئي الآن</h2>
                                    <p className="text-slate-400 font-bold">هذا الوضع مخصص للسرعة القصوى. استخدم قارئ الباركود اليدوي مباشرة.</p>
                                </div>

                                <form onSubmit={handleFocusBarcodeSubmit} className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur opacity-25 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200"></div>
                                    <input 
                                        name="focusBarcode"
                                        autoFocus
                                        placeholder="امسح الباركود هنا..."
                                        className="relative w-full bg-slate-900 border-2 border-white/10 rounded-2xl px-8 py-6 text-3xl font-black text-white text-center outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                                        onBlur={(e) => e.target.focus()} // Keep focus for speed
                                    />
                                    <div className="mt-4 flex justify-center gap-6">
                                        <div className="flex flex-col items-center">
                                            <span className="text-indigo-400 text-3xl font-black">{activeSessionStats.totalAudited}</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">صنف تم جره</span>
                                        </div>
                                        <div className="w-px h-10 bg-white/10" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-emerald-400 text-3xl font-black">{Math.round(activeSessionStats.progressPercent)}%</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">التقدم</span>
                                        </div>
                                    </div>
                                </form>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-right">
                                        <span className="text-[10px] text-slate-500 block font-bold uppercase mb-2">الرف الحالي</span>
                                        <div className="flex items-center gap-3 justify-end">
                                            <span className="text-xl font-black text-white">{activeZone || 'غير محدد'}</span>
                                            <MapPin className="text-indigo-500"/>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-right">
                                        <span className="text-[10px] text-slate-500 block font-bold uppercase mb-2">المساعد الصوتي</span>
                                        <div className="flex items-center gap-3 justify-end">
                                            <span className="text-xl font-black text-white">{isVoiceEnabled ? 'مفعل' : 'معطل'}</span>
                                            <Mic className={isVoiceEnabled ? 'text-emerald-500' : 'text-slate-500'}/>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 w-full">
                                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-500 transition-all duration-500"
                                            style={{ width: `${activeSessionStats.progressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Recent Activity Feed in Focus Mode */}
                                <div className="w-full max-w-lg mx-auto">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">آخر عمليات المسح</h4>
                                        <span className="w-12 h-px bg-white/10" />
                                    </div>
                                    <div className="space-y-2">
                                        {recentScans.length === 0 ? (
                                            <div className="py-4 text-slate-600 text-sm font-bold">لا توجد عمليات مسح نشطة حالياً</div>
                                        ) : recentScans.map((scan, idx) => (
                                            <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 animate-in slide-in-from-top-2 duration-300 ${idx === 0 ? 'ring-1 ring-indigo-500/50 scale-[1.02] shadow-lg shadow-indigo-500/10' : 'opacity-60'}`}>
                                                <span className="text-[10px] font-mono text-slate-500">{scan.time}</span>
                                                <span className="text-sm font-black text-white">{scan.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20}/>
                            <div>
                                <h4 className="font-extrabold text-amber-800 dark:text-amber-300 text-sm">أنت في وضع الجرد النشط: "{auditTitle}"</h4>
                                <p className="text-xs text-amber-600 dark:text-amber-400">يرجى تسجيل الرصيد الفعلي بدقة لكل صنف، والتطبيق للتسوية بأسفل الصفحة للتعديل المؤرشف.</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                customConfirm(
                                    'إلغاء جلسة الجرد',
                                    'هل أنت متأكد من إلغاء جلسة الجرد الحالية؟ لن يتم حفظ أي تغيرات بالكميات.',
                                    () => {
                                        setActiveSessionStarted(false);
                                        setBlindCount(false);
                                        setActiveZone('');
                                        localStorage.removeItem('active_audit_worksheet');
                                        localStorage.removeItem('active_audit_title');
                                        localStorage.removeItem('active_audit_scope');
                                        localStorage.removeItem('active_audit_warehouse_id');
                                        localStorage.removeItem('active_audit_only_in_stock');
                                        localStorage.removeItem('active_audit_session_started');
                                        localStorage.removeItem('active_audit_blind_count');
                                        localStorage.removeItem('active_audit_selected_zone');
                                    },
                                    'danger'
                                );
                            }}
                            className="bg-white hover:bg-red-50 dark:bg-slate-900 border border-amber-300 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 transition-all shadow-sm flex items-center gap-1"
                        >
                            إلغاء جلسة الجرد
                        </button>
                    </div>

                    {/* Tech & Progress Analytics Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {/* Audit Progress Circle/Bar */}
                        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm overflow-hidden relative">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">التقدم الإجمالي للجلسة</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                                            {Math.round(activeSessionStats.progressPercent)}%
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">({activeSessionStats.totalAudited}/{activeSessionStats.totalChecked})</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center gap-1.5 text-indigo-500 font-black text-xs">
                                        <Zap size={14} className="animate-pulse"/>
                                        {activeSessionStats.velocity.toFixed(1)} صنف/د
                                    </div>
                                    {activeSessionStats.etc > 0 && (
                                        <span className="text-[10px] text-slate-400 font-bold block mt-1">
                                            متبقي: ~{Math.ceil(activeSessionStats.etc)} دقيقة
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                <div 
                                    className="h-full bg-indigo-600 transition-all duration-700 ease-out shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                                    style={{ width: `${activeSessionStats.progressPercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Discrepancy Status */}
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">الحالات المكتشفة</span>
                            <div className="flex items-center justify-between mt-1">
                                <div className="flex flex-col">
                                    <span className="text-xl font-black text-slate-800 dark:text-white">
                                        {activeSessionStats.totalWithDiscrepancies}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400">فجوات جردية</span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1 text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded-lg">
                                        <TrendingDown size={10}/> {activeSessionStats.shortageCount}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-lg">
                                        <TrendingUp size={10}/> {activeSessionStats.surplusCount}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Financial Impact */}
                        <div className="md:col-span-1 lg:col-span-2 p-4 bg-slate-800 dark:bg-slate-900 rounded-2xl border border-slate-700 dark:border-slate-800 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-indigo-500/20 transition-all"/>
                            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider relative z-10">الأثر المالي المباشر</span>
                            <div className="mt-1 relative z-10">
                                <span className={`text-2xl font-black block leading-none font-mono ${activeSessionStats.totalNetValueAdjustment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {activeSessionStats.totalNetValueAdjustment > 0 ? '+' : ''}
                                    {activeSessionStats.totalNetValueAdjustment.toLocaleString()} <small className="text-xs font-bold">ج.م</small>
                                </span>
                                <p className="text-[9px] text-slate-500 font-bold mt-1">القيمة المحتسبة للتسويات المخزنية الجارية</p>
                            </div>
                        </div>

                        {/* Tech Controls */}
                        <div className="p-4 bg-indigo-600 rounded-2xl flex flex-col justify-between shadow-lg shadow-indigo-500/20">
                            <span className="text-[10px] text-indigo-200 block font-bold uppercase tracking-wider">تكنولوجيا الجرد</span>
                            <div className="flex items-center gap-3 mt-1">
                                <button
                                    onClick={() => {
                                        setIsVoiceEnabled(!isVoiceEnabled);
                                        playChangeSound();
                                        if (!isVoiceEnabled) speak('تم تفعيل المساعد الصوتي');
                                    }}
                                    className={`p-2 rounded-xl transition-all ${isVoiceEnabled ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-300'}`}
                                    title="المساعد الصوتي (نطق الأسماء)"
                                >
                                    {isVoiceEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsFocusMode(!isFocusMode);
                                        playChangeSound();
                                    }}
                                    className={`p-2 rounded-xl transition-all ${isFocusMode ? 'bg-amber-400 text-white shadow-md' : 'bg-indigo-700 text-indigo-300'}`}
                                    title="وضع التركيز (سرعة قصوى)"
                                >
                                    <Target size={18}/>
                                </button>
                                <button
                                    className="p-2 bg-indigo-700 text-indigo-300 rounded-xl hover:bg-indigo-800 transition-all"
                                    title="إحصائيات متقدمة"
                                >
                                    <Gauge size={18}/>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Barcode Scanner & Zone Control Panel */}
                    <div className="flex flex-col lg:flex-row gap-4 p-4 bg-indigo-50/20 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative overflow-hidden">
                        {isFocusMode && (
                            <div className="absolute inset-0 bg-indigo-600/5 dark:bg-indigo-400/5 animate-pulse pointer-events-none" />
                        )}
                        {/* Active Zone configuration */}
                        <div className="flex items-center gap-2.5 flex-1 w-full">
                            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                                <MapPin size={16}/>
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-0.5">الرف النشط حالياً</label>
                                <input 
                                    type="text"
                                    value={activeZone}
                                    onChange={e => {
                                        setActiveZone(e.target.value);
                                        playChangeSound();
                                    }}
                                    placeholder="مثال: الرف A1، القطاع الرئيسي..."
                                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Scanner trigger button */}
                        <div className="flex items-center gap-2 w-full lg:w-auto">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsScannerOpen(true);
                                    playBeepSound();
                                }}
                                className="flex-1 lg:flex-none flex items-center justify-center gap-2 py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                            >
                                <Camera size={16}/>
                                فتح الماسح الضوئي (موبايل)
                            </button>
                            <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden lg:block" />
                            <div className="flex-1 lg:flex-none p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                                    <Mic size={14} className={isVoiceEnabled ? 'text-indigo-500' : 'text-slate-300'}/>
                                </div>
                                <span className="text-[9px] font-black text-slate-500 px-2 uppercase">مساعد صوتي</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter controls and search */}
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="flex items-center bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 rounded-xl w-full sm:max-w-md">
                            <Search size={18} className="text-slate-400 mr-2.5"/>
                            <input 
                                type="text"
                                value={worksheetSearch}
                                onChange={e => setWorksheetSearch(e.target.value)}
                                placeholder="بحث عن منتج بالاسم أو الكود (SKU)..."
                                className="w-full bg-transparent outline-none py-1.5 px-1 text-xs font-bold dark:text-white"
                            />
                        </div>

                        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                            <div className="flex items-center gap-1.5 px-2 mr-1 border-l border-slate-200 dark:border-slate-700">
                                <MapPin size={14} className="text-slate-400"/>
                                <select
                                    value={worksheetZoneFilter}
                                    onChange={e => {
                                        setWorksheetZoneFilter(e.target.value);
                                        playChangeSound();
                                    }}
                                    className="bg-transparent border-none text-[10px] font-black text-slate-600 dark:text-slate-400 outline-none focus:ring-0 cursor-pointer"
                                >
                                    <option value="all">كل الرفوف</option>
                                    <option value="unassigned">بلا رف</option>
                                    {worksheetZones.map(z => (
                                        <option key={z} value={z}>{z}</option>
                                    ))}
                                </select>
                            </div>
                            <button 
                                onClick={() => setWorksheetFilter('all')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${worksheetFilter === 'all' ? 'bg-white dark:bg-slate-950 text-slate-850 dark:text-slate-100 shadow-sm' : 'text-slate-500'}`}
                            >
                                عرض الكل ({scopedProductsList.length})
                            </button>
                            <button 
                                onClick={() => setWorksheetFilter('discrepancy')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${worksheetFilter === 'discrepancy' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-slate-500'}`}
                            >
                                الفروقات فقط ({activeSessionStats.totalWithDiscrepancies})
                            </button>
                            <button 
                                onClick={() => setWorksheetFilter('matching')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${worksheetFilter === 'matching' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                            >
                                المطابق فقط
                            </button>
                        </div>
                    </div>

                    {/* Sheet Grid Content */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto min-w-full">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-black border-b border-slate-200/50 dark:border-slate-700/50">
                                    <tr>
                                        <th className="px-4 py-3">المنتج / الصنف</th>
                                        <th className="px-4 py-3">كود الصنف (SKU)</th>
                                        <th className="px-4 py-3 text-center">{blindCount ? 'الرصيد بالنظام (🔒 مخفي)' : 'الرصيد بالنظام'}</th>
                                        <th className="px-4 py-3 text-center">الرصيد الفعلي</th>
                                        <th className="px-4 py-3 text-center">{blindCount ? 'الفروقات (🔒)' : 'فارق الكمية'}</th>
                                        <th className="px-4 py-3 text-center">{blindCount ? 'التكلفة (🔒)' : 'سعر التكلفة'}</th>
                                        <th className="px-4 py-3 text-center">{blindCount ? 'الأثر المالي (🔒)' : 'الأثر المالي'}</th>
                                        <th className="px-4 py-3">تصنيف الحالة السريع / مبرر التسوية والملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {filteredWorksheetRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-slate-400">
                                                <Info className="mx-auto mb-2 opacity-35 text-slate-400" size={24}/>
                                                لا يوجد منتجات تطابق خيارات الفلترة الحالية للبحث.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredWorksheetRows.map(row => {
                                            const data = worksheet[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '', zone: '', proofImage: '' };
                                            const diff = data.actualQty - row.systemQty;
                                            const valueOfDiff = diff * row.costPrice;

                                            return (
                                                <tr key={row.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                                                                {row.image ? (
                                                                    <img src={row.image} className="w-full h-full object-cover" />
                                                                ) : <Package className="text-slate-400" size={14}/>}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-800 dark:text-white flex flex-col items-start gap-0.5 leading-tight">
                                                                    <span className="font-extrabold">{row.name}</span>
                                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                                        {data.zone && (
                                                                            <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold rounded-md border border-indigo-150/40">
                                                                                📍 رف: {data.zone}
                                                                            </span>
                                                                        )}
                                                                        {!row.lastAudited && (
                                                                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 rounded-md font-bold flex items-center gap-1">
                                                                                <AlertCircle size={9}/> لم يجرد
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-355 font-mono">{row.sku}</td>
                                                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 font-bold">
                                                        {blindCount ? (
                                                            <span className="text-slate-400 font-medium text-xs flex items-center justify-center gap-1">
                                                                <Lock size={12}/> مخفي
                                                            </span>
                                                        ) : (
                                                            row.systemQty
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1 max-w-[130px] mx-auto">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleQtyChange(row.key, data.actualQty - 1)}
                                                                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-lg text-slate-600 dark:text-slate-300 font-bold transition-all text-sm shrink-0"
                                                            >
                                                                -
                                                            </button>
                                                            <input 
                                                                type="number"
                                                                min="0"
                                                                value={data.actualQty}
                                                                onChange={e => handleQtyChange(row.key, Number(e.target.value))}
                                                                className="w-14 p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-black outline-none text-xs dark:text-slate-200"
                                                            />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleQtyChange(row.key, data.actualQty + 1)}
                                                                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-lg text-slate-600 dark:text-slate-300 font-bold transition-all text-sm shrink-0"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {blindCount ? (
                                                            <span className="text-slate-400">🔒 أعمى</span>
                                                        ) : diff === 0 ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                                                <Check size={11}/> مطابق
                                                            </span>
                                                        ) : (
                                                            <span className={`px-2 py-1 rounded font-black font-mono inline-block ${diff > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600'}`}>
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-500 font-bold font-mono">
                                                        {blindCount ? (
                                                            <span className="text-slate-400">🔒</span>
                                                        ) : (
                                                            `${row.costPrice.toLocaleString()} ج.م`
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {blindCount ? (
                                                            <span className="text-slate-400">🔒 مخفي</span>
                                                        ) : valueOfDiff === 0 ? (
                                                            <span className="text-slate-400 font-mono">0 ج.م</span>
                                                        ) : (
                                                            <span className={`font-black font-mono ${valueOfDiff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {valueOfDiff > 0 ? '+' : ''}
                                                                {valueOfDiff.toLocaleString()} ج.m
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-2.5 min-w-[280px]">
                                                            {/* Quick Status Buttons */}
                                                            <div className="flex gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleQtyChange(row.key, row.systemQty);
                                                                        handleMethodChange(row.key, 'correction');
                                                                        playBeepSound();
                                                                    }}
                                                                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${data.actualQty === row.systemQty && data.method === 'correction' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-650 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                >
                                                                    سليم 👍
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleMethodChange(row.key, 'gift');
                                                                        playBeepSound();
                                                                    }}
                                                                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${data.method === 'gift' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-650 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                >
                                                                    هدية 🎁
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleMethodChange(row.key, 'scrap');
                                                                        playBeepSound();
                                                                    }}
                                                                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${data.method === 'scrap' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-650 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                >
                                                                    تالف ⚠️
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleQtyChange(row.key, 0);
                                                                        handleMethodChange(row.key, 'missing');
                                                                        playBeepSound();
                                                                    }}
                                                                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${data.actualQty === 0 && data.method === 'missing' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-650 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                >
                                                                    مفقود 🔍
                                                                </button>
                                                            </div>

                                                            {/* Dropdowns / Upload Proof for Scrap */}
                                                            <div className="flex items-center gap-1.5 w-full">
                                                                {data.method === 'scrap' && (
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <label className="cursor-pointer p-1.5 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 rounded-lg text-xs transition-all flex items-center gap-1">
                                                                            <Camera size={11} />
                                                                            <span className="text-[9px] font-bold">إثبات</span>
                                                                            <input 
                                                                                type="file" 
                                                                                accept="image/*" 
                                                                                className="hidden" 
                                                                                onChange={e => {
                                                                                    const file = e.target.files?.[0];
                                                                                    if (file) {
                                                                                        const reader = new FileReader();
                                                                                        reader.onloadend = () => {
                                                                                            handleProofImageChange(row.key, reader.result as string);
                                                                                            playBeepSound();
                                                                                            customAlert('تم الحفظ محلياً', 'تم إرفاق صورة إثبات التلف بالعد الجاري.', 'success');
                                                                                        };
                                                                                        reader.readAsDataURL(file);
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </label>
                                                                        {data.proofImage && (
                                                                            <img 
                                                                                src={data.proofImage} 
                                                                                className="w-6 h-6 object-cover rounded-md border border-slate-250 cursor-zoom-in" 
                                                                                onClick={() => setFullImageView(data.proofImage!)}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <input 
                                                                    type="text"
                                                                    value={data.notes}
                                                                    onChange={e => handleNotesChange(row.key, e.target.value)}
                                                                    placeholder="ملاحظة أو تتبع الرف..."
                                                                    className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-400"
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Finalize Section */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-right">
                            <h4 className="font-extrabold text-slate-800 dark:text-white">تأكيد وترحيل الجرد الحسابي</h4>
                            <p className="text-xs text-slate-550 dark:text-slate-400 mt-1 max-w-xl">
                                عند الضغط على الزر، سيتم تعديل كميات الأصناف مباشرة وتخزين جلسة الجرد بـ تاليفها وملاحظاتها في الأرشيف المالي.
                            </p>
                        </div>

                        <button 
                            type="button"
                            onClick={() => {
                                customConfirm(
                                    'تأكيد وترحيل الجرد الحسابي',
                                    `هل أنت متأكد من ترحيل وحفظ جلسة الجرد؟ سيتم تعديل كميات المخزون لعدد ${activeSessionStats.totalWithDiscrepancies} أصناف بها فروقات مباشرة.`,
                                    handleFinalizeAudit,
                                    'warning'
                                );
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 text-sm"
                        >
                            <CheckCircle size={18}/> ترحيل وحفظ تسوية الجرد
                        </button>
                    </div>
                </div>
            )}

            {subTab === 'shared' && !activeSessionStarted && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="space-y-1">
                            <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Share2 className="text-indigo-600" size={18} />
                                نظام الجرد والعد الميداني لمسؤولي المخازن
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">أرسل روابط جرد فجائية مخصصة لمسؤولي المخازن لعد البضائع ميدانياً ومراجعة الفروقات واعتمادها هنا.</p>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                onClick={loadSharedAudits}
                                disabled={loadingShared}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                                title="تحديث روابط الجرد"
                            >
                                <RefreshCw size={16} className={loadingShared ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={() => { audioSynth.playTone('click'); setCreatingShared(true); }}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/10"
                            >
                                <Plus size={15} />
                                توليد رابط جرد فجائي مشترك
                            </button>
                        </div>
                    </div>

                    {/* Creation Form Modal */}
                    {creatingShared && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
                            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 animate-in zoom-in duration-300">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        <Share2 className="text-indigo-600" size={18} />
                                        توليد رابط جرد خارجي جديد
                                    </h3>
                                    <button 
                                        onClick={() => setCreatingShared(false)} 
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <XCircle size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateSharedAudit} className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">عنوان جلسة الجرد لمسؤول المخزن *</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={newSharedTitle}
                                            onChange={e => setNewSharedTitle(e.target.value)}
                                            placeholder="مثال: جرد البضائع الصيفية - المخزن الرئيسي"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-bold dark:text-white transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">المستودع المستهدف</label>
                                            <select 
                                                value={newSharedWarehouse}
                                                onChange={e => setNewSharedWarehouse(e.target.value)}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-bold dark:text-white transition-all"
                                            >
                                                <option value="all">الرصيد الإجمالي (جميع المخازن)</option>
                                                {(settings.warehouses || []).map(w => (
                                                    <option key={w.id} value={w.id}>مخزن: {w.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">نطاق البضائع المستهدفة للعد</label>
                                            <select 
                                                value={newSharedScope}
                                                onChange={e => setNewSharedScope(e.target.value)}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-bold dark:text-white transition-all"
                                            >
                                                <option value="all">كل السلع بالمستودع</option>
                                                {settings.collections?.map(col => (
                                                    <option key={col.id} value={col.id}>مجموعة: {col.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">رمز حماية الرابط (اختياري - 4 أرقام لمنع التطفل)</label>
                                        <input 
                                            type="text" 
                                            maxLength={4}
                                            value={newSharedPasscode}
                                            onChange={e => setNewSharedPasscode(e.target.value.replace(/\D/g, ''))}
                                            placeholder="مثال: 1234"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-bold dark:text-white tracking-widest transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div 
                                                onClick={() => setNewSharedBlindCount(!newSharedBlindCount)}
                                                className={`w-10 h-5 rounded-full transition-all relative ${newSharedBlindCount ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${newSharedBlindCount ? 'left-6' : 'left-1'}`} />
                                            </div>
                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">تفعيل الجرد الأعمى (Blind Count)</span>
                                            <Info size={12} className="text-slate-400" />
                                        </label>
                                    </div>

                                    <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30 text-[10px] text-amber-700 dark:text-amber-400 flex gap-2">
                                        <Info size={14} className="shrink-0 mt-0.5" />
                                        <p className="leading-normal font-bold">بمجرد إنشاء الرابط، يمكنك نسخه وإرساله فوراً لمسؤول المخزن عبر الواتساب. سيقوم مسؤول المخزن بالعد الميداني وتقديم التقرير لمراجعته هنا.</p>
                                    </div>

                                    <div className="flex gap-2.5 pt-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setCreatingShared(false)} 
                                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all"
                                        >
                                            إلغاء
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={loadingShared}
                                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            {loadingShared ? <RefreshCw className="animate-spin" size={14} /> : <Share2 size={14} />}
                                            إنشاء وتوليد الرابط الآن
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Shared Audits List */}
                    {loadingShared && sharedAudits.length === 0 ? (
                        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                            <p className="text-xs text-slate-500 font-bold">جاري جلب روابط الجرد المشتركة...</p>
                        </div>
                    ) : sharedAudits.length === 0 ? (
                        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <Share2 className="text-slate-300 dark:text-slate-700 mx-auto" size={44} />
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">لا توجد روابط جرد مشترك حالياً</h4>
                            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">يمكنك إنشاء رابط مخصص لمسؤول المخزن في ثوانٍ. سيدخل الكميات الفعلية من هاتف المحمول، ثم تراجع الفروقات هنا وتعمد التسوية بضغطة واحدة.</p>
                            <button 
                                onClick={() => setCreatingShared(true)}
                                className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black transition-all"
                            >
                                توليد أول رابط جرد الآن
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {sharedAudits.map(audit => {
                                const isPending = audit.status === 'pending';
                                const isSubmitted = audit.status === 'submitted';
                                const isApproved = audit.status === 'approved';
                                const isRejected = audit.status === 'rejected';

                                const publicUrl = `${window.location.origin}/shared-audit/${audit.id}`;

                                return (
                                    <div key={audit.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className="font-black text-slate-800 dark:text-white text-sm line-clamp-1">{audit.title}</h4>
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                                                    isPending ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20' :
                                                    isSubmitted ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' :
                                                    isApproved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                    'bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                                                }`}>
                                                    {isPending && '⏳ بانتظار العد'}
                                                    {isSubmitted && '📝 تم العد والتقديم'}
                                                    {isApproved && '✅ معتمد حسابياً'}
                                                    {isRejected && '❌ مرفوض ومعدل'}
                                                </span>
                                            </div>

                                            <div className="text-[10px] text-slate-400 font-bold space-y-1 font-sans">
                                                <div className="flex items-center gap-1">
                                                    <span>📦 المستودع:</span>
                                                    <span className="text-slate-600 dark:text-slate-300">{audit.warehouseName || 'المخزن الرئيسي'}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span>🔢 الأصناف المشمولة:</span>
                                                    <span className="text-slate-600 dark:text-slate-300">{audit.items?.length || 0} صنف</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span>📅 تاريخ الإنشاء:</span>
                                                    <span className="text-slate-600 dark:text-slate-300">{new Date(audit.createdAt).toLocaleDateString('ar-EG')}</span>
                                                </div>
                                                {audit.passcode && (
                                                    <div className="flex items-center gap-1 text-indigo-500">
                                                        <Lock size={10} />
                                                        <span>رمز الحماية:</span>
                                                        <span className="font-mono">{audit.passcode}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Dynamic submission notes */}
                                        {audit.managerName && (
                                            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[10px] border border-slate-100 dark:border-slate-800 space-y-1">
                                                <p className="text-slate-400 font-bold">بيان تسليم مسؤول المخزن:</p>
                                                <p className="text-slate-700 dark:text-slate-300 font-bold"> القائم بالعد: <span className="text-indigo-600">{audit.managerName}</span></p>
                                                {audit.submittedAt && (
                                                    <p className="text-slate-500 font-bold">📅 تاريخ التسليم: {new Date(audit.submittedAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                                                )}
                                                {audit.notes && <p className="text-slate-500 italic font-medium leading-relaxed">" {audit.notes} "</p>}
                                            </div>
                                        )}

                                        <div className="flex gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            {isPending && (
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(publicUrl);
                                                        audioSynth.playTone('success');
                                                        customAlert('تم النسخ', 'تم نسخ رابط الجرد الخارجي بنجاح! يمكنك إرساله الآن لمسؤول المخزن عبر الواتساب.', 'success');
                                                    }}
                                                    className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all"
                                                >
                                                    <Copy size={12} />
                                                    نسخ رابط الجرد
                                                </button>
                                            )}

                                            {isSubmitted && (
                                                <button
                                                    onClick={() => { audioSynth.playTone('click'); setActiveReviewSession(audit); }}
                                                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-1 shadow-sm transition-all"
                                                >
                                                    <CheckSquare size={12} />
                                                    مراجعة واعتماد الفروقات
                                                </button>
                                            )}

                                            {(isApproved || isRejected) && (
                                                <div className="flex-1 text-center py-2 bg-slate-50 dark:bg-slate-800/20 text-slate-400 rounded-xl text-[10px] font-black flex items-center justify-center gap-1">
                                                    {isApproved ? <ShieldCheck size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-rose-500" />}
                                                    {isApproved ? 'تم اعتماد التسوية الكلية' : 'تم الرفض للمراجعة الميدانية'}
                                                </div>
                                            )}

                                            <button
                                                onClick={() => {
                                                    customConfirm(
                                                        'حذف رابط الجرد المشترك',
                                                        'هل أنت متأكد من حذف رابط الجرد المشترك هذا نهائياً؟ لن يتمكن مسؤول المخزن من الوصول إليه بعد الآن.',
                                                        () => handleDeleteSharedAudit(audit.id),
                                                        'danger'
                                                    );
                                                }}
                                                className="p-2 bg-slate-50 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all"
                                                title="حذف الجلسة"
                                            >
                                                <Trash size={12} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Active Review/Approval Modal */}
                    {activeReviewSession && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
                            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                                {/* Modal Header */}
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-3xl shadow-sm z-10">
                                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-3">
                                        <CheckSquare className="text-amber-500 animate-pulse" size={18} />
                                        <span>مراجعة واعتماد تسوية جرد مسؤول المخزن</span>
                                    </h3>
                                    <button 
                                        onClick={() => setActiveReviewSession(null)} 
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <XCircle size={20} />
                                    </button>
                                </div>

                                {/* Modal Body Scrollable */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center">
                                            <span className="text-[10px] text-slate-400 block font-black uppercase tracking-wider mb-1">بيانات الجلسة</span>
                                            <span className="text-sm font-black text-slate-800 dark:text-white leading-tight">{activeReviewSession.title}</span>
                                            <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-indigo-500">
                                                <User size={14}/>
                                                <span>{activeReviewSession.managerName}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-[1.5rem] border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                                            <TrendingUp className="absolute -bottom-2 -right-2 w-12 h-12 text-emerald-500/10 group-hover:scale-125 transition-transform" />
                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-black uppercase tracking-wider mb-1">إجمالي الزيادات</span>
                                            <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                                                +{(activeReviewSession.items || []).reduce((acc: number, item: any) => {
                                                    if (!item) return acc;
                                                    const actual = item.actualQty !== undefined ? item.actualQty : item.systemQty;
                                                    const diff = actual - item.systemQty;
                                                    return diff > 0 ? acc + (diff * (item.costPrice || 0)) : acc;
                                                }, 0).toLocaleString()} <small className="text-xs">ج.م</small>
                                            </span>
                                        </div>

                                        <div className="bg-rose-50 dark:bg-rose-950/20 p-5 rounded-[1.5rem] border border-rose-100 dark:border-rose-900/30 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                                            <TrendingDown className="absolute -bottom-2 -right-2 w-12 h-12 text-rose-500/10 group-hover:scale-125 transition-transform" />
                                            <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-black uppercase tracking-wider mb-1">إجمالي العجز</span>
                                            <span className="text-xl font-black text-rose-700 dark:text-rose-300">
                                                {(activeReviewSession.items || []).reduce((acc: number, item: any) => {
                                                    if (!item) return acc;
                                                    const actual = item.actualQty !== undefined ? item.actualQty : item.systemQty;
                                                    const diff = actual - item.systemQty;
                                                    return diff < 0 ? acc + (diff * (item.costPrice || 0)) : acc;
                                                }, 0).toLocaleString()} <small className="text-xs">ج.م</small>
                                            </span>
                                        </div>

                                        <div className="bg-indigo-600 p-5 rounded-[1.5rem] shadow-lg shadow-indigo-600/20 flex flex-col justify-center text-white relative overflow-hidden group">
                                            <Zap className="absolute -bottom-2 -right-2 w-12 h-12 text-white/10 group-hover:scale-125 transition-transform" />
                                            <span className="text-[10px] text-indigo-100 block font-black uppercase tracking-wider mb-1">صافي التسوية</span>
                                            <span className="text-xl font-black">
                                                {(activeReviewSession.items || []).reduce((acc: number, item: any) => {
                                                    if (!item) return acc;
                                                    const actual = item.actualQty !== undefined ? item.actualQty : item.systemQty;
                                                    const diff = actual - item.systemQty;
                                                    return acc + (diff * (item.costPrice || 0));
                                                }, 0).toLocaleString()} <small className="text-xs">ج.م</small>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Digital Signature Box if present */}
                                    {activeReviewSession.signatureData && (
                                        <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <span className="text-xs font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                                                    ✍️ الإمضاء والتوقيع الرقمي الموثق لمسؤول المخزن:
                                                </span>
                                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                    إقرار رسمي بالعد الميداني باسم: <strong className="text-slate-800 dark:text-white">{activeReviewSession.managerName}</strong>
                                                </p>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                                <img 
                                                    src={activeReviewSession.signatureData} 
                                                    alt="توقيع مسؤول المخزن الرقمي" 
                                                    className="h-12 max-w-[200px] object-contain"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Table Worksheet inside Review */}
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                            <h4 className="font-bold text-slate-850 dark:text-slate-200 text-xs">مطابقة الكميات الميدانية مع رصيد النظام</h4>
                                            
                                            <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 max-w-sm w-full">
                                                <Search size={14} className="text-slate-400 mr-1.5" />
                                                <input 
                                                    type="text"
                                                    value={reviewSearch}
                                                    onChange={e => setReviewSearch(e.target.value)}
                                                    placeholder="البحث في الأصناف..."
                                                    className="bg-transparent outline-none py-1 px-1 text-[11px] font-bold dark:text-white w-full"
                                                />
                                            </div>
                                        </div>

                                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                            <table className="w-full text-right text-[11px] sm:text-xs">
                                                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/50 dark:border-slate-800/50">
                                                    <tr>
                                                        <th className="px-4 py-3">الصنف</th>
                                                        <th className="px-4 py-3">الـ SKU</th>
                                                        <th className="px-4 py-3 text-center">كمية النظام</th>
                                                        <th className="px-4 py-3 text-center">الكمية الميدانية</th>
                                                        <th className="px-4 py-3 text-center">فارق العجز/الزيادة</th>
                                                        <th className="px-4 py-3 text-center">قيمة التكلفة</th>
                                                        <th className="px-4 py-3 text-center">الأثر المالي للفارق</th>
                                                        <th className="px-4 py-3 text-center">إثبات الصنف</th>
                                                        <th className="px-4 py-3">ملاحظات مسؤول المخزن</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                                    {activeReviewSession.items
                                                        .filter((item: any) => 
                                                            item.name.toLowerCase().includes(reviewSearch.toLowerCase()) ||
                                                            item.sku.toLowerCase().includes(reviewSearch.toLowerCase())
                                                        )
                                                        .map((item: any, index: number) => {
                                                            const actual = item.actualQty !== undefined ? item.actualQty : item.systemQty;
                                                            const variance = actual - item.systemQty;
                                                            const varianceValue = variance * item.costPrice;

                                                            return (
                                                                <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                                                                    <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                                                                    <td className="px-4 py-2.5 text-slate-550 font-mono font-bold">{item.sku}</td>
                                                                    <td className="px-4 py-2.5 text-center text-slate-550 font-mono font-bold">{item.systemQty}</td>
                                                                    <td className="px-4 py-2.5 text-center font-black text-indigo-600 font-mono">{actual}</td>
                                                                    <td className="px-4 py-2.5 text-center">
                                                                        {variance === 0 ? (
                                                                            <span className="text-slate-400 font-bold">مطابق</span>
                                                                        ) : (
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${variance < 0 ? 'bg-red-50 dark:bg-red-950/20 text-red-650' : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650'}`}>
                                                                                {variance > 0 ? '+' : ''}{variance}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-center text-slate-400 font-mono">{item.costPrice.toLocaleString()} ج.م</td>
                                                                    <td className="px-4 py-2.5 text-center font-bold font-mono">
                                                                        {variance === 0 ? (
                                                                            <span className="text-slate-450">0</span>
                                                                        ) : (
                                                                            <span className={varianceValue >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                                                                {varianceValue > 0 ? '+' : ''}{varianceValue.toLocaleString()} ج.م
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-center">
                                                                        {item.proofImage ? (
                                                                            <img 
                                                                                src={item.proofImage} 
                                                                                className="w-8 h-8 object-cover rounded-lg border border-slate-200 dark:border-slate-800 cursor-zoom-in mx-auto hover:scale-110 transition-transform shadow-sm" 
                                                                                onClick={() => setFullImageView(item.proofImage!)}
                                                                            />
                                                                        ) : (
                                                                            <span className="text-slate-300 dark:text-slate-700">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-slate-500 font-medium">{item.notes || '—'}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900 rounded-b-3xl z-10">
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={() => {
                                                customConfirm(
                                                    'هنرفض الجلسة دي؟ 🤨',
                                                    `هل أنت متأكد من رفض جرد "${activeReviewSession.managerName}"؟ هيوصله إشعار بالرفض وهيطالب بإعادة العد بدقة أكتر.`,
                                                    () => {
                                                        setRejectModalSession(activeReviewSession);
                                                        setRejectReasonText('');
                                                    },
                                                    'danger'
                                                );
                                            }}
                                            className="flex-1 sm:flex-none px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <XCircle size={15} />
                                            رفض الجرد ده
                                        </button>
                                        <button 
                                            onClick={() => {
                                                customConfirm(
                                                    'نعتمد التسوية ونعدل الأرصدة؟ ✅',
                                                    'بمجرد التأكيد، الكميات دي هتسمع في المخزن فوراً والأرصدة هتتعدل حسب العد الفعلي اللي قدمه مسؤول المخزن.',
                                                    () => handleApproveSharedAudit(activeReviewSession),
                                                    'success'
                                                );
                                            }}
                                            className="flex-1 sm:flex-none px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <CheckSquare size={15} />
                                            اعتمد يا باشا وسمّع في المخزن
                                        </button>
                                    </div>

                                    <button 
                                        onClick={() => setActiveReviewSession(null)}
                                        className="w-full sm:w-auto px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all"
                                    >
                                        إغلاق
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Camera Barcode Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/85 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 bg-indigo-600 text-white flex justify-between items-center">
                            <h4 className="font-extrabold text-sm flex items-center gap-2">
                                <span className="p-1.5 bg-white/20 rounded-lg">📷</span>
                                قارئ الباركود بالكاميرا (سريع وذكي)
                            </h4>
                            <button 
                                onClick={() => {
                                    setIsScannerOpen(false);
                                    playChangeSound();
                                }}
                                className="text-white/85 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full text-xs font-bold transition-all"
                            >
                                إغلاق ✕
                            </button>
                        </div>

                        {/* Scanner stage */}
                        <div className="p-6 flex flex-col items-center gap-4 text-center">
                            {/* Current Active Zone reminder */}
                            <div className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-150 dark:border-slate-850 flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-bold">📍 الرف / القطاع الحالي للعد:</span>
                                <input 
                                    type="text"
                                    value={activeZone}
                                    onChange={e => {
                                        setActiveZone(e.target.value);
                                        playChangeSound();
                                    }}
                                    placeholder="بلا رف محدد"
                                    className="font-black text-indigo-600 dark:text-indigo-400 bg-transparent border-b border-dashed border-indigo-300 text-left outline-none px-1 w-36 focus:border-indigo-500"
                                />
                            </div>

                            {/* Camera Scan Window wrapper */}
                            <div className="relative w-full aspect-[4/3] max-w-sm rounded-2xl overflow-hidden border-2 border-dashed border-indigo-400 bg-black shadow-inner flex flex-col items-center justify-center">
                                <div id="reader" className="w-full h-full" />
                                
                                {scannerError && (
                                    <div className="absolute inset-0 bg-slate-950/90 text-red-400 p-4 flex flex-col items-center justify-center gap-2 text-xs font-bold">
                                        <AlertTriangle size={24}/>
                                        <p className="px-4">{scannerError}</p>
                                    </div>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed max-w-sm">
                                ضع الرمز الشريطي (Barcode) أو الاستجابة السريعة (QR) داخل إطار الفحص. سيتم رصده وإضافته ومضاعفة الكمية بواحد لكل مسحة تلقائياً مع صوت Beep.
                            </p>

                            {/* Manual Entry Fallback Input */}
                            <div className="w-full border-t border-slate-100 dark:border-slate-900 pt-4 mt-2">
                                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-black block mb-2 text-right">في حال تعذر تشغيل الكاميرا، اكتب الباركود يدوياً:</label>
                                <form 
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const form = e.currentTarget;
                                        const input = form.elements.namedItem('manualBarcode') as HTMLInputElement;
                                        if (input && input.value.trim()) {
                                            handleBarcodeScanned(input.value.trim());
                                            input.value = '';
                                        }
                                    }}
                                    className="flex gap-2"
                                >
                                    <input 
                                        type="text"
                                        name="manualBarcode"
                                        placeholder="اكتب رمز SKU أو الباركود ثم اضغط إضافة..."
                                        className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                                    />
                                    <button 
                                        type="submit"
                                        className="px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black transition-all border border-indigo-100 dark:border-indigo-900"
                                    >
                                        إدراج
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: POPUP DETAILS VIEW (عرض تفاصيل جرد سابق) */}
            {selectedPastSession && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-3xl shadow-sm z-10">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                    <ClipboardList size={20}/>
                                </div>
                                <span>جلسة جرد مرحلة: {selectedPastSession.title}</span>
                            </h3>
                            <button 
                                onClick={() => setSelectedPastSession(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            >
                                <Trash2 size={20} className="hidden"/> <span className="font-bold text-sm">إغلاق</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Summary Metadata Card */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-705">
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">تاريخ الجرد</span>
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                                        {new Date(selectedPastSession.date).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">بواسطة</span>
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate" title={selectedPastSession.performedBy}>{selectedPastSession.performedBy}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">إجمالي ما جُرِد</span>
                                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{selectedPastSession.totalItemsAudited || (selectedPastSession.discrepancies.length + 0)} صنف</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">صافي الفارق (وحدة)</span>
                                    <span className={`text-xs font-black font-mono ${selectedPastSession.totalVarianceQty >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {selectedPastSession.totalVarianceQty > 0 ? '+' : ''}{selectedPastSession.totalVarianceQty} وحدة
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">صافي التسوية (قيمة)</span>
                                    <span className={`text-sm font-black font-mono ${selectedPastSession.totalVarianceValue >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {selectedPastSession.totalVarianceValue > 0 ? '+' : ''}{selectedPastSession.totalVarianceValue.toLocaleString()} ج.م
                                    </span>
                                </div>
                            </div>

                            {/* List of differences inside modal */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                    <h4 className="font-bold text-slate-850 dark:text-slate-205 text-sm">سجل الفروقات والتسويات التفصيلية</h4>
                                    
                                    <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 max-w-sm">
                                        <Search size={14} className="text-slate-400 mr-1.5"/>
                                        <input 
                                            type="text"
                                            value={selectedPastSessionSearch}
                                            onChange={e => setSelectedPastSessionSearch(e.target.value)}
                                            placeholder="بحث في فجوات الجرد..."
                                            className="bg-transparent outline-none py-1 px-1 text-[11px] font-bold dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                    <table className="w-full text-right text-xs">
                                        <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold border-b border-secondary">
                                            <tr>
                                                <th className="px-4 py-2.5">الصنف</th>
                                                <th className="px-4 py-2.5">الـ SKU</th>
                                                <th className="px-4 py-2.5 text-center">النظام</th>
                                                <th className="px-4 py-2.5 text-center">الفعلي</th>
                                                <th className="px-4 py-2.5 text-center">الفارق</th>
                                                <th className="px-4 py-2.5 text-center">الأثر الحسابي</th>
                                                <th className="px-4 py-2.5">الأسلوب والملاحظة</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                            {selectedPastSession.discrepancies.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-full">
                                                                <CheckCircle size={32}/>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-black text-slate-800 dark:text-white">لا توجد أي فروقات أو فجوات جردية</p>
                                                                <p className="text-[11px] text-slate-500 font-bold">تمت مطابقة كافة الأصناف التي شملتها الجلسة مع رصيد المنظومة الموحد بنجاح.</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                selectedPastSession.discrepancies
                                                    .filter(item => 
                                                        item.name.toLowerCase().includes(selectedPastSessionSearch.toLowerCase()) ||
                                                        item.sku.toLowerCase().includes(selectedPastSessionSearch.toLowerCase())
                                                    )
                                                    .map((item, index) => (
                                                        <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                                                            <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                                                            <td className="px-4 py-2.5 text-slate-500 font-mono">{item.sku}</td>
                                                            <td className="px-4 py-2.5 text-center text-slate-550 dark:text-slate-440 font-mono">{item.systemQty}</td>
                                                            <td className="px-4 py-2.5 text-center font-bold font-mono">{item.actualQty}</td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${item.variance < 0 ? 'bg-red-50 dark:bg-red-950/20 text-red-650' : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650'}`}>
                                                                    {item.variance > 0 ? '+' : ''}{item.variance}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center font-extrabold font-mono">
                                                                <span className={item.varianceValue >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                                                    {item.varianceValue > 0 ? '+' : ''}{item.varianceValue.toLocaleString()} ج.م
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-350">
                                                                    {item.method === 'scrap' ? 'شطب تالف/هالك' : item.method === 'surplus' ? 'إثبات بضاعة زائدة' : item.method === 'missing' ? 'مفقود' : item.method === 'gift' ? 'هدية' : 'تصحيح مباشر'}
                                                                </div>
                                                                {item.notes && <div className="text-[9px] text-slate-400 font-medium">{item.notes}</div>}
                                                                {item.zone && <div className="text-[9px] text-indigo-500 font-bold flex items-center gap-1 mt-0.5"><MapPin size={8}/> رف: {item.zone}</div>}
                                                            </td>
                                                        </tr>
                                                    ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-b-3xl">
                            <button 
                                onClick={() => handlePrintReport(selectedPastSession)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                            >
                                <Printer size={15}/> طباعة التقرير الكلي
                            </button>

                            <button 
                                onClick={() => setSelectedPastSession(null)}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
                            >
                                موافق وإغلاق السجل
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
                                    confirmDialog.type === 'danger' ? 'bg-rose-650 hover:bg-rose-700' :
                                    confirmDialog.type === 'success' ? 'bg-emerald-650 hover:bg-emerald-700' :
                                    confirmDialog.type === 'info' ? 'bg-blue-650 hover:bg-blue-700' :
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

            {/* Rejection Reason Modal */}
            {rejectModalSession && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-right animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 rounded-xl">
                                <XCircle size={26} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 dark:text-white">
                                    تحديد سبب رفض تسليم الجرد
                                </h3>
                                <p className="text-xs text-slate-400 font-bold">
                                    سيظهر هذا السبب مباشرة لمسؤول المخزن ({rejectModalSession.managerName || 'القائم بالعد'}) عند فتحه للرابط لإعادة العد الدقيق.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                                سبب الرفض والملاحظات المطلوبة لإعادة الجرد *
                            </label>
                            <textarea
                                rows={3}
                                required
                                value={rejectReasonText}
                                onChange={e => setRejectReasonText(e.target.value)}
                                placeholder="مثال: توجد فروقات عجز غير مبررة في الأصناف الأساسية، يرجى إعادة العد الدقيق بالقطعة وتصوير الأرفف..."
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs font-bold dark:text-white transition-all leading-relaxed"
                            />
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setRejectModalSession(null)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all"
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRejectSharedAudit(rejectModalSession, rejectReasonText)}
                                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-lg shadow-rose-600/10 transition-all flex items-center gap-1.5"
                            >
                                <XCircle size={15} />
                                إرسال الرفض لمسؤول المخزن
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
