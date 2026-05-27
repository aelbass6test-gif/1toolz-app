import React, { useState, useMemo } from 'react';
import { 
    Plus, Search, ClipboardList, Calendar, User, Eye, ArrowRight, CheckCircle, 
    AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Printer, AlertCircle, FileText, Check, 
    Layers, SearchCode, Trash2, Sliders, Layout, Filter, Sparkles, HelpCircle, Package, Info
} from 'lucide-react';
import { Settings, Product, ProductVariant, InventoryAuditSession, InventoryAuditItemDiscrepancy } from '../types';
import { printHTMLDirectly } from '../utils/printHelper';

interface InventoryAuditProps {
    settings: Settings;
    setSettings: (updater: React.SetStateAction<Settings>) => void;
    currentUser: any;
}

export const InventoryAudit: React.FC<InventoryAuditProps> = ({ settings, setSettings, currentUser }) => {
    // Audit main tabs: 'history' (سجل الجلسات) or 'active' (بدء جرد نشط)
    const [subTab, setSubTab] = useState<'history' | 'active'>('history');
    
    // Active Audit Session Form State
    const [auditTitle, setAuditTitle] = useState('');
    const [auditScope, setAuditScope] = useState<'all' | string>('all'); // all or collection id
    const [onlyInStock, setOnlyInStock] = useState(false);
    const [activeSessionStarted, setActiveSessionStarted] = useState(false);
    
    // Session Worksheet data: map of productId (or prodId-variantId) to physical quantity, method and notes
    const [worksheet, setWorksheet] = useState<Record<string, {
        actualQty: number;
        method: 'correction' | 'scrap' | 'surplus';
        notes: string;
    }>>({});

    // Filter and search inside active worksheet
    const [worksheetSearch, setWorksheetSearch] = useState('');
    const [worksheetFilter, setWorksheetFilter] = useState<'all' | 'discrepancy' | 'matching'>('all');

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
        }> = [];

        filtered.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const variantDesc = Object.entries(v.options)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(' | ');

                    worksheetRows.push({
                        key: `${p.id}_${v.id}`,
                        productId: p.id,
                        variantId: v.id,
                        name: `${p.name} (${variantDesc})`,
                        sku: v.sku || p.sku,
                        systemQty: v.stockQuantity || 0,
                        costPrice: v.costPrice ?? p.costPrice ?? 0,
                        image: p.thumbnail || p.images?.[0]
                    });
                });
            } else {
                worksheetRows.push({
                    key: p.id,
                    productId: p.id,
                    name: p.name,
                    sku: p.sku || '',
                    systemQty: p.stockQuantity || 0,
                    costPrice: p.costPrice || 0,
                    image: p.thumbnail || p.images?.[0]
                });
            }
        });

        return worksheetRows;
    }, [activeSessionStarted, auditScope, onlyInStock, settings.products]);

    // Start New Session
    const handleStartSession = (e: React.FormEvent) => {
        e.preventDefault();
        if (!auditTitle.trim()) {
            alert('الرجاء إدخال اسم أو عنوان لجلسة الجرد');
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
                    initialWorksheet[`${p.id}_${v.id}`] = {
                        actualQty: v.stockQuantity || 0,
                        method: 'correction',
                        notes: ''
                    };
                });
            } else {
                initialWorksheet[p.id] = {
                    actualQty: p.stockQuantity || 0,
                    method: 'correction',
                    notes: ''
                };
            }
        });

        setWorksheet(initialWorksheet);
        setActiveSessionStarted(true);
    };

    // Update specific SKU quantity
    const handleQtyChange = (key: string, value: number) => {
        const cleanValue = Math.max(0, value);
        setWorksheet(prev => {
            const currentItem = prev[key] || { actualQty: 0, method: 'correction', notes: '' };
            const sysQty = scopedProductsList.find(r => r.key === key)?.systemQty || 0;
            const diff = cleanValue - sysQty;

            // Pre-select highly appropriate method based on discrepancy
            let defaultMethod: 'correction' | 'scrap' | 'surplus' = currentItem.method;
            if (diff < 0) {
                // Shortage: select scrap or correction
                defaultMethod = currentItem.method === 'surplus' ? 'scrap' : currentItem.method;
            } else if (diff > 0) {
                // Surplus: select surplus or correction
                defaultMethod = currentItem.method === 'scrap' ? 'surplus' : currentItem.method;
            } else {
                defaultMethod = 'correction';
            }

            return {
                ...prev,
                [key]: {
                    ...currentItem,
                    actualQty: cleanValue,
                    method: defaultMethod
                }
            };
        });
    };

    const handleMethodChange = (key: string, method: 'correction' | 'scrap' | 'surplus') => {
        setWorksheet(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { actualQty: 0, method: 'correction', notes: '' }),
                method
            }
        }));
    };

    const handleNotesChange = (key: string, notes: string) => {
        setWorksheet(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || { actualQty: 0, method: 'correction', notes: '' }),
                notes
            }
        }));
    };

    // Live calculation for current active worksheet
    const activeSessionStats = useMemo(() => {
        let totalChecked = 0;
        let totalWithDiscrepancies = 0;
        let totalSystemQty = 0;
        let totalActualQty = 0;
        let totalNetValueAdjustment = 0;
        let surplusCount = 0;
        let shortageCount = 0;

        scopedProductsList.forEach(row => {
            const data = worksheet[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '' };
            totalChecked += 1;
            totalSystemQty += row.systemQty;
            totalActualQty += data.actualQty;

            const diff = data.actualQty - row.systemQty;
            if (diff !== 0) {
                totalWithDiscrepancies += 1;
                const valueOfDiff = diff * row.costPrice;
                totalNetValueAdjustment += valueOfDiff;

                if (diff > 0) surplusCount += 1;
                if (diff < 0) shortageCount += 1;
            }
        });

        return {
            totalChecked,
            totalWithDiscrepancies,
            totalSystemQty,
            totalActualQty,
            totalNetValueAdjustment,
            surplusCount,
            shortageCount
        };
    }, [scopedProductsList, worksheet]);

    // Active session rows filtered
    const filteredWorksheetRows = useMemo(() => {
        return scopedProductsList.filter(row => {
            // Apply Search
            const matchesSearch = 
                row.name.toLowerCase().includes(worksheetSearch.toLowerCase()) || 
                row.sku.toLowerCase().includes(worksheetSearch.toLowerCase());

            if (!matchesSearch) return false;

            // Apply filter
            const data = worksheet[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '' };
            const diff = data.actualQty - row.systemQty;

            if (worksheetFilter === 'discrepancy') return diff !== 0;
            if (worksheetFilter === 'matching') return diff === 0;

            return true;
        });
    }, [scopedProductsList, worksheet, worksheetSearch, worksheetFilter]);

    // Apply entire audit session to products and save to history
    const handleFinalizeAudit = () => {
        if (!window.confirm(`هل أنت متأكد من ترحيل وحفظ جلسة الجرد؟ سيتم تعديل كميات المخزون لعدد ${activeSessionStats.totalWithDiscrepancies} أصناف بها فروقات مباشرة.`)) {
            return;
        }

        // 1. Loop and update products array
        const updatedProducts = [...(settings.products || [])].map(product => {
            let updatedProduct = { ...product };

            if (product.hasVariants && product.variants && product.variants.length > 0) {
                const updatedVariants = product.variants.map(v => {
                    const wsKey = `${product.id}_${v.id}`;
                    if (worksheet[wsKey] !== undefined) {
                        return {
                            ...v,
                            stockQuantity: worksheet[wsKey].actualQty
                        };
                    }
                    return v;
                });

                // Update total stock quantity across variants
                const totalStock = updatedVariants.reduce((s, vr) => s + (vr.stockQuantity || 0), 0);
                updatedProduct.variants = updatedVariants;
                updatedProduct.stockQuantity = totalStock;
                updatedProduct.inStock = totalStock > 0;
            } else {
                const wsKey = product.id;
                if (worksheet[wsKey] !== undefined) {
                    updatedProduct.stockQuantity = worksheet[wsKey].actualQty;
                    updatedProduct.inStock = worksheet[wsKey].actualQty > 0;
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
                        notes: data.notes
                    });
                }
            }
        });

        // 3. Create Audit Session session structure
        const userName = currentUser?.fullName || currentUser?.name || currentUser?.email || 'مسؤول الجرد';
        const newSessionLog: InventoryAuditSession = {
            id: `audit-${Date.now()}`,
            title: auditTitle,
            date: new Date().toISOString(),
            performedBy: userName,
            scope: auditScope,
            totalSystemQty: activeSessionStats.totalSystemQty,
            totalActualQty: activeSessionStats.totalActualQty,
            totalVarianceQty: activeSessionStats.totalActualQty - activeSessionStats.totalSystemQty,
            totalVarianceValue: activeSessionStats.totalNetValueAdjustment,
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
        alert('تم ترحيل الجرد وحفظ التسوية بنجاح، وتعديل كميات المخزن بالكامل!');
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
                        <div>إجمالي أصناف الجرد</div>
                        <div class="stat-val">${session.discrepancies.length} أصناف بها فروقات</div>
                    </div>
                    <div class="stat-card">
                        <div>صافي كمية التعديل</div>
                        <div class="stat-val" style="color: ${session.totalVarianceQty >= 0 ? '#16a34a' : '#dc2626'}">${session.totalVarianceQty > 0 ? '+' : ''}${session.totalVarianceQty} وحدة</div>
                    </div>
                    <div class="stat-card">
                        <div>صافي المالي للتسوية</div>
                        <div class="stat-val" style="color: ${session.totalVarianceValue >= 0 ? '#16a34a' : '#dc2626'}">${session.totalVarianceValue.toLocaleString()} ج.م</div>
                    </div>
                    <div class="stat-card">
                        <div>حالة الجلسة</div>
                        <div class="stat-val" style="color: #16a34a">تم الترحيل والمطابقة</div>
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
                        ${session.discrepancies.map(item => `
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

    return (
        <div className="space-y-6">
            {/* Tabs for Sub Audit Page */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button 
                    onClick={() => { setSubTab('history'); setActiveSessionStarted(false); }}
                    className={`pb-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${subTab === 'history' && !activeSessionStarted ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <ClipboardList size={18}/> سجل جلسات الجرد والتسوية
                </button>
                <button 
                    onClick={() => setSubTab('active')}
                    className={`pb-4 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${subTab === 'active' || activeSessionStarted ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Plus size={18}/> {activeSessionStarted ? 'جلسة جرد نشطة حالياً' : 'بدء عملية جرد جديدة'}
                </button>
            </div>

            {/* Sub Tab: HISTORY (سجل تسويات الجرد) */}
            {subTab === 'history' && !activeSessionStarted && (
                <div className="space-y-6">
                    {/* Header stats overview cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
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

                            <div className="flex items-center">
                                <label className="flex items-center gap-2.5 cursor-pointer mt-5">
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
                                if (window.confirm('هل أنت متأكد من إلغاء جلسة الجرد الحالية؟ لن يتم حفظ أي تغيرات بالكميات.')) {
                                    setActiveSessionStarted(false);
                                }
                            }}
                            className="bg-white hover:bg-red-50 dark:bg-slate-900 border border-amber-300 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 transition-all shadow-sm flex items-center gap-1"
                        >
                            إلغاء جلسة الجرد
                        </button>
                    </div>

                    {/* Quick Analytics Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold">تم فحصها</span>
                            <span className="text-lg font-black text-slate-800 dark:text-white">{activeSessionStats.totalChecked} أصناف</span>
                        </div>
                        
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold">أصناف بها فروقات</span>
                            <span className={`text-lg font-black ${activeSessionStats.totalWithDiscrepancies > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                                {activeSessionStats.totalWithDiscrepancies} أصناف
                            </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold">عجز عهود المخزن (-)</span>
                            <span className="text-lg font-black text-rose-500">{activeSessionStats.shortageCount} أصناف</span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold">زيادة بضائع (+)</span>
                            <span className="text-lg font-black text-emerald-500">{activeSessionStats.surplusCount} أصناف</span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 col-span-2 md:col-span-1">
                            <span className="text-[10px] text-slate-400 block font-bold font-bold">صافي الأثر المالي للجرد</span>
                            <span className={`text-lg font-black block ${activeSessionStats.totalNetValueAdjustment >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {activeSessionStats.totalNetValueAdjustment > 0 ? '+' : ''}
                                {activeSessionStats.totalNetValueAdjustment.toLocaleString()} ج.م
                            </span>
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
                                        <th className="px-4 py-3 text-center">الرصيد بالنظام</th>
                                        <th className="px-4 py-3 text-center">الرصيد الفعلي</th>
                                        <th className="px-4 py-3 text-center">فارق الكمية</th>
                                        <th className="px-4 py-3 text-center">سعر التكلفة</th>
                                        <th className="px-4 py-3 text-center">الأثر المالي</th>
                                        <th className="px-4 py-3">مكان ومبرر التسوية / ملاحظات</th>
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
                                            const data = worksheet[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '' };
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
                                                                <span className="font-bold text-slate-800 dark:text-white">{row.name}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-355 font-mono">{row.sku}</td>
                                                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 font-bold">{row.systemQty}</td>
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
                                                        {diff === 0 ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                                                <Check size={11}/> مطابق
                                                            </span>
                                                        ) : (
                                                            <span className={`px-2 py-1 rounded font-black font-mono inline-block ${diff > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600'}`}>
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-500 font-bold font-mono">{row.costPrice.toLocaleString()} ج.م</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {valueOfDiff === 0 ? (
                                                            <span className="text-slate-400 font-mono">0 ج.م</span>
                                                        ) : (
                                                            <span className={`font-black font-mono ${valueOfDiff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {valueOfDiff > 0 ? '+' : ''}
                                                                {valueOfDiff.toLocaleString()} ج.م
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col sm:flex-row gap-2">
                                                            {diff !== 0 && (
                                                                <select
                                                                    value={data.method}
                                                                    onChange={e => handleMethodChange(row.key, e.target.value as any)}
                                                                    className="p-1 px-1.5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold outline-none text-slate-650 dark:text-slate-300 shrink-0"
                                                                >
                                                                    {diff < 0 ? (
                                                                        <>
                                                                            <option value="correction">تصحيح عهدة مباشر</option>
                                                                            <option value="scrap">شطب كـ تالف/هالك (خسارة)</option>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <option value="correction">تصحيح عهدة مباشر</option>
                                                                            <option value="surplus">زيادة بضائع بالمخزن (ربح)</option>
                                                                        </>
                                                                    )}
                                                                </select>
                                                            )}
                                                            <input 
                                                                type="text"
                                                                value={data.notes}
                                                                onChange={e => handleNotesChange(row.key, e.target.value)}
                                                                placeholder="ملاحظة أو تتبع الرف..."
                                                                className="w-full min-w-[100px] p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-400"
                                                            />
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
                            onClick={handleFinalizeAudit}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2 text-sm"
                        >
                            <CheckCircle size={18}/> ترحيل وحفظ تسوية الجرد
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: POPUP DETAILS VIEW (عرض تفاصيل جرد سابق) */}
            {selectedPastSession && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-t-3xl shadow-sm z-10">
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
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-705">
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">تاريخ الجرد</span>
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                                        {new Date(selectedPastSession.date).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">بواسطة</span>
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">{selectedPastSession.performedBy}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">صافي التعديل بالوحدات</span>
                                    <span className={`text-xs font-black font-mono ${selectedPastSession.totalVarianceQty >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {selectedPastSession.totalVarianceQty > 0 ? '+' : ''}{selectedPastSession.totalVarianceQty} وحدة
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block font-bold">صافي التسوية المالي</span>
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
                                            {selectedPastSession.discrepancies
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
                                                                {item.method === 'scrap' ? 'شطب تالف/هالك' : item.method === 'surplus' ? 'إثبات بضاعة زائدة' : 'تصحيح مباشر'}
                                                            </div>
                                                            {item.notes && <div className="text-[9px] text-slate-400 font-medium">{item.notes}</div>}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-b-3xl">
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
        </div>
    );
};
