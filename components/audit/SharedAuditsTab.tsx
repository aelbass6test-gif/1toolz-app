import React, { useState, useMemo } from 'react';
import { 
    Link, Copy, Share2, Shield, Calendar, RefreshCw, AlertTriangle, 
    CheckCircle, XCircle, Clock, Trash2, ShieldCheck, HelpCircle, Eye, Scan, Lock,
    Users, Activity, MapPin, ClipboardList, User, Printer, Download, Search, Filter, FileSpreadsheet,
    ArrowRightLeft, Calculator, FileText, Sparkles, Plus, DollarSign, Building2, UserCheck, Check, ShoppingBag, Target
} from 'lucide-react';
import { Settings } from '../../types';

interface SharedAuditsTabProps {
    settings: Settings;
    sharedSessions: any[];
    onCreateSharedSession: (title: string, warehouseId: string, protocol: string, passcode: string) => void;
    onApproveSharedSession: (sessionId: string, settlementDetails?: any) => void;
    onRejectSharedSession: (sessionId: string, reason: string) => void;
    onDeleteSharedSession: (sessionId: string) => void;
    onUnlockProtocol: (sessionId: string, reason: string) => void;
    onUpdateAssignments: (sessionId: string, assignments: any[]) => void;
    onResolveConflict: (sessionId: string, conflictProductId: string, resolvedQty: number, userName: string) => void;
    onAlert: (title: string, msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
    onConfirm: (title: string, msg: string, onConfirm: () => void, type?: string) => void;
    loadingShared: boolean;
}

export default function SharedAuditsTab({
    settings,
    sharedSessions = [],
    onCreateSharedSession,
    onApproveSharedSession,
    onRejectSharedSession,
    onDeleteSharedSession,
    onUnlockProtocol,
    onUpdateAssignments,
    onResolveConflict,
    onAlert,
    onConfirm,
    loadingShared
}: SharedAuditsTabProps) {
    // 1. Creation Form States
    const [title, setTitle] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [protocol, setProtocol] = useState('standard');
    const [passcode, setPasscode] = useState('');

    // 2. Review Modal state
    const [selectedReviewSession, setSelectedReviewSession] = useState<any | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [reviewTab, setReviewTab] = useState<'details' | 'presence' | 'conflicts' | 'health' | 'assignments' | 'swaps'>('details');

    // Sessions List Filter & Search States
    const [sessionSearch, setSessionSearch] = useState('');
    const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected' | 'in_progress'>('all');
    const [sessionWarehouseFilter, setSessionWarehouseFilter] = useState<string>('all');

    // Helper Functions for Item Pricing
    const getItemCost = (item: any) => {
        if (item.costPrice && item.costPrice > 0) return item.costPrice;
        const prod = (settings.products || []).find((p: any) => p.sku === item.sku || p.name === item.name);
        if (prod?.costPrice !== undefined && prod?.costPrice > 0) return prod.costPrice;
        if (prod?.price !== undefined && prod?.price > 0) return prod.price;
        return 0;
    };

    const getItemSellingPrice = (item: any) => {
        if (item.sellingPrice && item.sellingPrice > 0) return item.sellingPrice;
        if (item.price && item.price > 0) return item.price;
        const prod = (settings.products || []).find((p: any) => p.sku === item.sku || p.name === item.name);
        if ((prod as any)?.sellingPrice !== undefined && (prod as any)?.sellingPrice > 0) return (prod as any).sellingPrice;
        if (prod?.price !== undefined && prod?.price > 0) return prod.price;
        return getItemCost(item);
    };

    // Shared Sessions KPI Stats Calculation
    const sessionStats = useMemo(() => {
        const total = sharedSessions.length;
        const submitted = sharedSessions.filter(s => s.status === 'submitted').length;
        const approved = sharedSessions.filter(s => s.status === 'approved').length;
        const rejected = sharedSessions.filter(s => s.status === 'rejected').length;
        const inProgress = sharedSessions.filter(s => !s.status || s.status === 'in_progress').length;

        let totalItemsAudited = 0;
        sharedSessions.forEach(s => {
            const items = Array.isArray(s.items) ? s.items : (s.items && typeof s.items === 'object' ? Object.values(s.items) : []);
            totalItemsAudited += items.length || s.itemsSubmitted || 0;
        });

        return { total, submitted, approved, rejected, inProgress, totalItemsAudited };
    }, [sharedSessions]);

    // Filtered Shared Sessions
    const filteredSharedSessions = useMemo(() => {
        return sharedSessions.filter(s => {
            if (sessionStatusFilter === 'submitted' && s.status !== 'submitted') return false;
            if (sessionStatusFilter === 'approved' && s.status !== 'approved') return false;
            if (sessionStatusFilter === 'rejected' && s.status !== 'rejected') return false;
            if (sessionStatusFilter === 'in_progress' && (s.status && s.status !== 'in_progress')) return false;

            if (sessionWarehouseFilter !== 'all' && s.warehouseId !== sessionWarehouseFilter) return false;

            if (sessionSearch.trim()) {
                const q = sessionSearch.trim().toLowerCase();
                const titleMatch = (s.title || '').toLowerCase().includes(q);
                const whMatch = (s.warehouseName || '').toLowerCase().includes(q);
                const mgrMatch = (s.managerName || '').toLowerCase().includes(q);
                const passMatch = (s.passcode || '').toLowerCase().includes(q);
                return titleMatch || whMatch || mgrMatch || passMatch;
            }

            return true;
        });
    }, [sharedSessions, sessionStatusFilter, sessionWarehouseFilter, sessionSearch]);

    // Swap & Loss Settlement State
    const [lossAllocationAccount, setLossAllocationAccount] = useState<'expense' | 'employee' | 'wastage' | 'partner' | 'mixed'>('expense');
    const [residualAllocationTarget, setResidualAllocationTarget] = useState<'expense' | 'employee' | 'partner'>('employee');
    const [employeeResponsibleName, setEmployeeResponsibleName] = useState('');
    const [selectedPartnerName, setSelectedPartnerName] = useState('');
    const [partnerPricingPolicy, setPartnerPricingPolicy] = useState<'cost' | 'price'>('cost');
    const [partnerSelectedSkus, setPartnerSelectedSkus] = useState<Record<string, number>>({});
    const [employeeSelectedSkus, setEmployeeSelectedSkus] = useState<Record<string, number>>({});
    const [manualSurplusSku, setManualSurplusSku] = useState('');
    const [manualDeficitSku, setManualDeficitSku] = useState('');
    const [manualSwapQty, setManualSwapQty] = useState(1);
    const [customSwaps, setCustomSwaps] = useState<Array<{
        id: string;
        surplusSku: string;
        surplusName: string;
        deficitSku: string;
        deficitName: string;
        qty: number;
        surplusCost: number;
        deficitCost: number;
        costDifference: number;
    }>>([]);

    // 3. Assignment Form State
    const [newAssignment, setNewAssignment] = useState({
        userId: '',
        userName: '',
        scopeType: 'zone' as 'warehouse' | 'zone' | 'rack' | 'shelf' | 'category',
        scopeValue: ''
    });

    // 4. Real-time Health Calculations
    const healthStats = useMemo(() => {
        if (!selectedReviewSession) return null;
        
        const items = Array.isArray(selectedReviewSession?.items) ? selectedReviewSession.items : (selectedReviewSession?.items && typeof selectedReviewSession.items === 'object' ? Object.values(selectedReviewSession.items) : []);
        const totalItems = items.length;
        if (totalItems === 0) return { accuracy: 100, variance: 0, health: 100, quality: 'N/A' };

        let matched = 0;
        let totalSystemValue = 0;
        let totalActualValue = 0;
        
        items.forEach((item: any) => {
            const system = item.systemQty || 0;
            const actual = item.actualQty !== undefined ? item.actualQty : system;
            const cost = item.costPrice || 0;
            
            if (system === actual) matched++;
            totalSystemValue += system * cost;
            totalActualValue += actual * cost;
        });

        const accuracy = (matched / totalItems) * 100;
        const variance = totalSystemValue > 0 
            ? Math.abs((totalSystemValue - totalActualValue) / totalSystemValue) * 100 
            : 0;
        
        const conflictsCount = (selectedReviewSession.conflicts || []).length;
        const health = Math.max(0, 100 - (variance * 5) - (conflictsCount * 2));
        
        let quality = 'ممتاز ★';
        if (health < 70) quality = 'ضعيف ⚠';
        else if (health < 85) quality = 'مقبول ⚖️';
        else if (health < 95) quality = 'جيد 👍';

        return {
            accuracy: accuracy.toFixed(1),
            variance: variance.toFixed(2),
            health: Math.round(health),
            quality
        };
    }, [selectedReviewSession]);

    // Print Audit Handler
    const handlePrintAudit = (sessionToPrint?: any) => {
        const session = sessionToPrint || selectedReviewSession;
        if (!session) return;

        const reviewItems = Array.isArray(session?.items) 
            ? session.items 
            : (session?.items && typeof session.items === 'object' ? Object.values(session.items) : []);

        const totalItems = reviewItems.length;
        let matchingCount = 0;
        let varianceCount = 0;

        reviewItems.forEach((item: any) => {
            const actual = item.actualQty ?? 0;
            const system = item.systemQty ?? 0;
            if (actual === system) {
                matchingCount++;
            } else {
                varianceCount++;
            }
        });

        const accuracyRate = totalItems > 0 ? Math.round((matchingCount / totalItems) * 100) : 100;

        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>تقرير مراجعة الجرد - ${session.title || session.warehouseName || 'مستودع'}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                    * { box-sizing: border-box; font-family: 'Cairo', sans-serif; }
                    body { margin: 0; padding: 25px; color: #1e293b; background: #fff; line-height: 1.5; font-size: 12px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
                    .logo-title h1 { margin: 0; font-size: 20px; font-weight: 900; color: #4f46e5; }
                    .logo-title p { margin: 3px 0 0; color: #64748b; font-weight: 700; font-size: 11px; }
                    .audit-meta { text-align: left; }
                    .audit-meta div { font-weight: 800; font-size: 12px; color: #0f172a; }
                    .audit-meta span { color: #64748b; font-size: 10px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
                    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center; }
                    .stat-card .val { font-size: 18px; font-weight: 900; color: #4f46e5; }
                    .stat-card .lbl { font-size: 10px; color: #64748b; font-weight: 700; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; }
                    th { background: #f1f5f9; color: #334155; font-weight: 800; padding: 8px 12px; text-align: right; border: 1px solid #cbd5e1; }
                    td { padding: 8px 12px; border: 1px solid #e2e8f0; vertical-align: middle; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .text-center { text-align: center; }
                    .text-emerald { color: #059669; font-weight: 800; }
                    .text-rose { color: #e11d48; font-weight: 800; }
                    .badge-match { background: #d1fae5; color: #047857; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 10px; }
                    .badge-diff { background: #ffe4e6; color: #be123c; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 10px; }
                    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; page-break-inside: avoid; }
                    .sig-box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #fafafa; }
                    .sig-box h4 { margin: 0 0 8px; font-size: 11px; font-weight: 800; color: #334155; }
                    .sig-img { max-height: 45px; object-fit: contain; }
                    .btn-print { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; margin-bottom: 20px; }
                    @media print {
                        .no-print { display: none !important; }
                        body { padding: 0; }
                        @page { margin: 1.5cm; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="text-align: left;">
                    <button onclick="window.print()" class="btn-print">🖨️ طباعة التقرير الآن</button>
                </div>

                <div class="header">
                    <div class="logo-title">
                        <h1>{(settings as any).storeName || (settings as any).appName || 'مدير الأوردرات الذكي'}</h1>
                        <p>تقرير مراجعة وفحص كميات جرد الموظفين</p>
                    </div>
                    <div class="audit-meta">
                        <div>المستودع: ${session.warehouseName || 'المستودع الرئيسي'}</div>
                        <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}</span><br/>
                        <span>مسؤول الجرد: ${session.managerName || 'غير محدد'}</span>
                        ${session.passcode ? `<br/><span>Passcode: ${session.passcode}</span>` : ''}
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="val">${totalItems}</div>
                        <div class="lbl">إجمالي الأصناف</div>
                    </div>
                    <div class="stat-card">
                        <div class="val" style="color: #059669;">${matchingCount}</div>
                        <div class="lbl">أصناف مطابقة</div>
                    </div>
                    <div class="stat-card">
                        <div class="val" style="color: #e11d48;">${varianceCount}</div>
                        <div class="lbl">أصناف بها فروقات</div>
                    </div>
                    <div class="stat-card">
                        <div class="val" style="color: #2563eb;">${accuracyRate}%</div>
                        <div class="lbl">نسبة الدقة</div>
                    </div>
                </div>

                ${session.notes ? `
                    <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 11px;">
                        <strong>ملاحظات مرفقة:</strong> ${session.notes}
                    </div>
                ` : ''}

                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">#</th>
                            <th style="width: 40%;">اسم السلعة / SKU</th>
                            <th style="width: 15%; text-align: center;">رصيد الدفاتر</th>
                            <th style="width: 15%; text-align: center;">العد الفعلي</th>
                            <th style="width: 15%; text-align: center;">الفارق</th>
                            <th style="width: 10%; text-align: center;">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reviewItems.map((item: any, idx: number) => {
                            const actual = item.actualQty ?? 0;
                            const system = item.systemQty ?? 0;
                            const diff = actual - system;
                            return `
                                <tr>
                                    <td class="text-center">${idx + 1}</td>
                                    <td>
                                        <strong>${item.name || 'منتج غير معنون'}</strong>
                                        ${item.sku ? `<br/><span style="font-size: 9px; color: #64748b;">SKU: ${item.sku}</span>` : ''}
                                    </td>
                                    <td class="text-center">${system}</td>
                                    <td class="text-center" style="font-weight: 800;">${actual}</td>
                                    <td class="text-center" style="font-weight: 800;">
                                        ${diff === 0 ? '0' : (diff > 0 ? `<span class="text-emerald">+${diff}</span>` : `<span class="text-rose">${diff}</span>`)}
                                    </td>
                                    <td class="text-center">
                                        ${diff === 0 ? '<span class="badge-match">مطابق</span>' : '<span class="badge-diff">تفاوت</span>'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div class="signatures">
                    <div class="sig-box">
                        <h4>توقيع المسؤول الميداني:</h4>
                        <p style="margin: 0 0 5px; font-weight: bold;">${session.managerName || 'مسؤول الجرد'}</p>
                        ${session.signatureData ? `<img src="${session.signatureData}" class="sig-img" />` : '<p style="color: #94a3b8; font-size: 10px;">لا يوجد توقيع إلكتروني</p>'}
                    </div>
                    <div class="sig-box">
                        <h4>توقيع الاعتماد / الإدارة:</h4>
                        <p style="margin: 0 0 5px; font-weight: bold;">توقيع الاعتماد</p>
                        <div style="height: 45px; border-bottom: 1px dashed #cbd5e1; margin-top: 10px;"></div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const prt = window.open('', '_blank');
        if (prt) {
            prt.document.write(html);
            prt.document.close();
            setTimeout(() => prt.print(), 300);
        }
    };

    // CSV Export Handler
    const handleExportCSV = (sessionToExport?: any) => {
        const session = sessionToExport || selectedReviewSession;
        if (!session) return;

        const reviewItems = Array.isArray(session?.items) 
            ? session.items 
            : (session?.items && typeof session.items === 'object' ? Object.values(session.items) : []);

        if (reviewItems.length === 0) {
            onAlert('تنبيه', 'لا توجد عناصر في كشف الجرد لتصديرها.', 'warning');
            return;
        }

        let csvContent = "\uFEFF"; // UTF-8 BOM for Arabic support in Excel
        csvContent += "اسم السلعة,SKU,رصيد الدفاتر,العد الفعلي,الفارق المتوقع,حالة المطابقة,الملاحظات\n";

        reviewItems.forEach((item: any) => {
            const actual = item.actualQty ?? 0;
            const system = item.systemQty ?? 0;
            const diff = actual - system;
            const status = diff === 0 ? 'مطابق' : (diff > 0 ? 'زيادة' : 'عجز');
            const nameEscaped = `"${(item.name || '').replace(/"/g, '""')}"`;
            const skuEscaped = `"${(item.sku || '').replace(/"/g, '""')}"`;
            const notesEscaped = `"${(item.notes || '').replace(/"/g, '""')}"`;

            csvContent += `${nameEscaped},${skuEscaped},${system},${actual},${diff},${status},${notesEscaped}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `جرد_${session.warehouseName || 'مستودع'}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter & Search states for review table
    const [itemsFilter, setItemsFilter] = useState<'all' | 'diff' | 'matched'>('all');
    const [itemsSearch, setItemsSearch] = useState('');

    // 3. QR Code / View Links modal state
    const [activeShareSession, setActiveShareSession] = useState<any | null>(null);

    // Form submit
    const handleGenerateLink = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !warehouseId) {
            onAlert('تنبيه', 'يرجى إدخال عنوان للرابط واختيار المستودع لتوليد الرابط.', 'warning');
            return;
        }

        const actualPasscode = passcode.trim() || Math.floor(1000 + Math.random() * 9000).toString();
        onCreateSharedSession(title.trim(), warehouseId, protocol, actualPasscode);
        
        // Reset local form
        setTitle('');
        setWarehouseId('');
        setProtocol('standard');
        setPasscode('');
    };

    // Copy to clipboard helper
    const handleCopyToClipboard = (linkText: string) => {
        navigator.clipboard.writeText(linkText);
        onAlert('تم النسخ', 'تم نسخ رابط الجرد الخارجي الحصري لحافظة جهازك بنجاح!', 'success');
    };

    return (
        <div className="space-y-6 dir-rtl text-right animate-in fade-in duration-300">
            
            {/* Generate Shared Link Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Generate form */}
                <form onSubmit={handleGenerateLink} className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                    <div className="pb-2 border-b border-slate-50 dark:border-slate-800">
                        <h3 className="text-sm font-black text-slate-850 dark:text-white flex items-center gap-1.5">
                            <Share2 className="text-indigo-600" size={16} />
                            توليد رابط جرد ومطابقة خارجية مخصصة للموظفين
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">يرسل هذا الرابط لموظفي الأرفف ومسؤولي المستودع لإتمام عمليات الحصر والتأكيد لحظة بلحظة دون الصلاحيات الكاملة للوحة التحكم.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] text-slate-500 font-black block mb-1">اسم الرابط / المسمى التعريفي *</label>
                            <input 
                                type="text"
                                required
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="أدخل اسم الجلسة"
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] text-slate-500 font-black block mb-1">المستودع المجرود *</label>
                            <select 
                                required
                                value={warehouseId}
                                onChange={e => setWarehouseId(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                            >
                                <option value="">اختر المستودع...</option>
                                {(settings.warehouses || []).map((w, idx) => (
                                    <option key={w.id || `wh-${idx}`} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] text-slate-500 font-black block mb-1">رمز الحماية للدخول (Passcode)</label>
                            <input 
                                type="text"
                                maxLength={6}
                                value={passcode}
                                onChange={e => setPasscode(e.target.value)}
                                placeholder="أدخل رمز مرور الجلسة (أو اتركه فارغاً)"
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] text-slate-500 font-black block mb-1">بروتوكول الجرد والتحكم (Audit Protocol) *</label>
                            <select 
                                required
                                value={protocol}
                                onChange={e => setProtocol(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                            >
                                <option value="standard">العد القياسي (الكميات ظاهرة)</option>
                                <option value="blind">جرد أعمى 🔒 (الكميات مخفية تماماً)</option>
                                <option value="fast">عد سريع (مسح الباركود المتتالي)</option>
                                <option value="periodic">دوري مبرمج (عينة عشوائية)</option>
                                <option value="location">عد بالموقع (رفوف محددة)</option>
                                <option value="double">عد مزدوج (تأكيد بواسطة موظف ثانٍ)</option>
                                <option value="audit">تدقيق المشرف (فحص عينات عشوائية)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button 
                            type="submit"
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-all shadow-md"
                        >
                            توليد وحفظ رابط الجرد
                        </button>
                    </div>
                </form>

                {/* Helpful guides */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-5 rounded-3xl space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                        <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                            <ShieldCheck size={16} />
                            حماية العمليات الميدانية
                        </h4>
                        <p className="text-[10px] text-indigo-950/70 dark:text-indigo-400/80 leading-relaxed font-bold">
                            تضمن ميزة "الجرد الأعمى" عدم تطابق الكميات بالتواطؤ أو الكسل، بل تفرض على موظف العد فحص كل حبة على الرف وإدخال الرقم الحقيقي بدقة. الرمز السري يمنع وصول الزوار للرابط.
                        </p>
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold border-t border-indigo-200/40 pt-3">
                        يمكن لعدة موظفين استخدام نفس الرابط متصلين للعد المتزامن للرفوف وتجميع المدخلات تلقائياً.
                    </div>
                </div>
            </div>

            {/* KPI Summary Banner for Employee Shared Audits */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">إجمالي الروابط الخارجية</span>
                        <h4 className="text-lg font-black text-slate-800 dark:text-white">{sessionStats.total} <span className="text-[10px] font-normal text-slate-400">رابط</span></h4>
                    </div>
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
                        <Share2 size={18} />
                    </div>
                </div>

                <button 
                    onClick={() => setSessionStatusFilter(sessionStatusFilter === 'submitted' ? 'all' : 'submitted')}
                    className={`bg-white dark:bg-slate-900 border p-4 rounded-2xl shadow-sm flex items-center justify-between text-right transition-all cursor-pointer ${
                        sessionStatusFilter === 'submitted' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-100 dark:border-slate-800 hover:border-amber-200'
                    }`}
                >
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">بانتظار المراجعة والاعتماد</span>
                        <h4 className="text-lg font-black text-amber-600 flex items-center gap-1">
                            {sessionStats.submitted}
                            {sessionStats.submitted > 0 && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                            )}
                        </h4>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-xl">
                        <AlertTriangle size={18} />
                    </div>
                </button>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">تم اعتمادها وترحيلها</span>
                        <h4 className="text-lg font-black text-emerald-600">{sessionStats.approved}</h4>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
                        <CheckCircle size={18} />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">جاري العد الميداني</span>
                        <h4 className="text-lg font-black text-slate-600 dark:text-slate-300">{sessionStats.inProgress}</h4>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-xl">
                        <Clock size={18} />
                    </div>
                </div>
            </div>

            {/* List of generated links with search & filter controls */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h3 className="text-sm font-black text-slate-850 dark:text-white">جدول وحالات روابط الجرد الخارجية للموظفين</h3>
                        <p className="text-[10px] text-slate-400 font-bold">إليك كل الروابط المصدرة، يمكنك مراجعة الكميات المرفوعة واعتماد تسويتها بالكامل بضغطة زر.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search Bar */}
                        <div className="relative min-w-[180px]">
                            <Search className="absolute right-2.5 top-2.5 text-slate-400" size={13} />
                            <input 
                                type="text"
                                value={sessionSearch}
                                onChange={(e) => setSessionSearch(e.target.value)}
                                placeholder="بحث بعنوان الجرد أو المسؤول..."
                                className="w-full pr-8 pl-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Warehouse Filter */}
                        <select
                            value={sessionWarehouseFilter}
                            onChange={(e) => setSessionWarehouseFilter(e.target.value)}
                            className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                        >
                            <option value="all">جميع المستودعات</option>
                            {(settings.warehouses || []).map((w, idx) => (
                                <option key={w.id || `wh-fltr-${idx}`} value={w.id}>{w.name}</option>
                            ))}
                        </select>

                        {loadingShared && (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                <RefreshCw className="animate-spin text-indigo-600" size={12} />
                            </span>
                        )}
                    </div>
                </div>

                {/* Status Filter Pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
                    <button
                        onClick={() => setSessionStatusFilter('all')}
                        className={`px-3 py-1 rounded-xl transition-all ${
                            sessionStatusFilter === 'all' 
                                ? 'bg-indigo-600 text-white font-black shadow-sm' 
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        الكل ({sessionStats.total})
                    </button>
                    <button
                        onClick={() => setSessionStatusFilter('submitted')}
                        className={`px-3 py-1 rounded-xl transition-all flex items-center gap-1 ${
                            sessionStatusFilter === 'submitted' 
                                ? 'bg-amber-500 text-white font-black shadow-sm' 
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 hover:bg-amber-100'
                        }`}
                    >
                        <span>بانتظار المراجعة</span>
                        <span className="px-1.5 py-0.2 bg-white/20 rounded-md text-[9px] font-mono">{sessionStats.submitted}</span>
                    </button>
                    <button
                        onClick={() => setSessionStatusFilter('approved')}
                        className={`px-3 py-1 rounded-xl transition-all ${
                            sessionStatusFilter === 'approved' 
                                ? 'bg-emerald-600 text-white font-black shadow-sm' 
                                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100'
                        }`}
                    >
                        تم الاعتماد ({sessionStats.approved})
                    </button>
                    <button
                        onClick={() => setSessionStatusFilter('rejected')}
                        className={`px-3 py-1 rounded-xl transition-all ${
                            sessionStatusFilter === 'rejected' 
                                ? 'bg-rose-600 text-white font-black shadow-sm' 
                                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100'
                        }`}
                    >
                        مرفوض ({sessionStats.rejected})
                    </button>
                    <button
                        onClick={() => setSessionStatusFilter('in_progress')}
                        className={`px-3 py-1 rounded-xl transition-all ${
                            sessionStatusFilter === 'in_progress' 
                                ? 'bg-slate-700 text-white font-black shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        جاري العد ({sessionStats.inProgress})
                    </button>
                </div>

                {filteredSharedSessions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <Link className="mx-auto text-slate-300 opacity-20 mb-2" size={44} />
                        <p className="text-xs font-black">لا توجد روابط جرد مشتركة تطابق الفلترة المحددة</p>
                    </div>
                ) : (
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3">عنوان الجرد والمستودع</th>
                                    <th className="px-4 py-3 text-center">رمز الحماية</th>
                                    <th className="px-4 py-3 text-center">نوع البروتوكول</th>
                                    <th className="px-4 py-3 text-center">أرصدة مرفوعة</th>
                                    <th className="px-4 py-3 text-center">حالة الجلسة</th>
                                    <th className="px-4 py-3 text-left">التحكم والروابط</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {filteredSharedSessions.map(session => {
                                    const itemsSubmitted = session.itemsSubmitted || (Array.isArray(session.items) ? session.items.length : (session.items ? Object.keys(session.items).length : 0));
                                    const shareUrl = `${window.location.origin}/shared-audit/${session.id}`;
                                    
                                    return (
                                        <tr key={session.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <div className="space-y-0.5">
                                                    <h4 className="font-black text-slate-800 dark:text-slate-200">{session.title}</h4>
                                                    <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold">
                                                        <span>📦 {session.warehouseName || 'المستودع الرئيسي'}</span>
                                                        {session.managerName && <span>• 👤 {session.managerName}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-center font-mono font-black text-indigo-600">{session.passcode}</td>
                                            <td className="px-4 py-3.5 text-center font-bold text-slate-500">
                                                {session.protocol === 'blind' ? '🔒 جرد أعمى' : 
                                                 session.protocol === 'fast' ? '⚡ عد سريع' :
                                                 session.protocol === 'double' ? '👥 عد مزدوج' :
                                                 session.protocol === 'audit' ? '🧐 تدقيق مشرف' :
                                                 '💡 عد عادي'}
                                            </td>
                                            <td className="px-4 py-3.5 text-center font-bold font-sans">
                                                {itemsSubmitted > 0 ? `${itemsSubmitted} صنف` : '0 صنف'}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black inline-flex items-center gap-1 ${
                                                    session.status === 'submitted' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse' :
                                                    session.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                    session.status === 'rejected' ? 'bg-red-100 text-red-750 dark:bg-red-950/20 dark:text-red-400' :
                                                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {session.status === 'submitted' ? '📝 بانتظار المراجعة' :
                                                     session.status === 'approved' ? '✅ تم الاعتماد والتعديل' :
                                                     session.status === 'rejected' ? '❌ مرفوض للتعديل' :
                                                     '⏳ جاري العد ميدانياً'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-left">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    {/* Copy and QR icons */}
                                                    <button 
                                                        onClick={() => handleCopyToClipboard(shareUrl)}
                                                        className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-all border border-slate-200/50 dark:border-slate-700"
                                                        title="نسخ الرابط"
                                                    >
                                                        <Copy size={13} />
                                                    </button>

                                                    <button 
                                                        onClick={() => setActiveShareSession(session)}
                                                        className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-all border border-slate-200/50 dark:border-slate-700"
                                                        title="عرض تفاصيل المشاركة"
                                                    >
                                                        <Share2 size={13} />
                                                    </button>

                                                    {/* Protocol Lock/Unlock */}
                                                    {session.isProtocolLocked ? (
                                                        <button 
                                                            onClick={() => {
                                                                const reason = prompt('يرجى إدخال سبب فتح قفل البروتوكول:');
                                                                if (reason && reason.trim()) {
                                                                    onUnlockProtocol(session.id, reason.trim());
                                                                }
                                                            }}
                                                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg border border-amber-200/50 transition-all"
                                                            title="فتح قفل الإعدادات"
                                                        >
                                                            <Lock size={13} />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200/50 cursor-default"
                                                            title="الإعدادات مفتوحة للتعديل"
                                                        >
                                                            <ShieldCheck size={13} />
                                                        </button>
                                                    )}

                                                    {/* Review / Details Action */}
                                                    {session.status === 'submitted' ? (
                                                        <button 
                                                            onClick={() => setSelectedReviewSession(session)}
                                                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black shadow-sm flex items-center gap-1"
                                                        >
                                                            <Eye size={12} />
                                                            <span>مراجعة واعتماد</span>
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setSelectedReviewSession(session)}
                                                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                                        >
                                                            <Eye size={12} />
                                                            <span>معاينة</span>
                                                        </button>
                                                    )}

                                                    {/* Print & Delete session option */}
                                                    <button 
                                                        onClick={() => handlePrintAudit(session)}
                                                        className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg border border-slate-200/50 dark:border-slate-700 transition-all"
                                                        title="طباعة التقرير"
                                                    >
                                                        <Printer size={13} />
                                                    </button>

                                                    <button 
                                                        onClick={() => {
                                                            onConfirm(
                                                                'حذف الرابط المشترك نهائياً؟',
                                                                'سيتم إلغاء تفعيل هذا الرابط ومنع الموظفين من تقديم أي أرصدة أخرى من خلاله بشكل قطعي.',
                                                                () => onDeleteSharedSession(session.id)
                                                            );
                                                        }}
                                                        className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200/50 dark:border-slate-700 transition-all"
                                                        title="حذف"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* QR Code and Sharing Modal Info */}
            {activeShareSession && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/85 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200 p-6 space-y-6 text-center">
                        <div className="space-y-1">
                            <h4 className="font-black text-sm text-slate-850 dark:text-white">مشاركة رابط الجرد المشترك</h4>
                            <p className="text-[10px] text-slate-400 font-bold">يمكن للموظفين مسح رمز الاستجابة السريعة (QR) أو تسجيل الدخول بالرمز السري</p>
                        </div>

                        {/* Pseudo QR code */}
                        <div className="w-44 h-44 bg-indigo-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl mx-auto flex flex-col items-center justify-center p-4">
                            <Scan className="text-indigo-600 animate-pulse mb-2" size={32} />
                            <span className="text-[9px] text-slate-400 font-bold">امسح رمز الباركود بالجوال للتوجيه الفوري</span>
                        </div>

                        <div className="space-y-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-850">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-400">الرمز السري للدخول:</span>
                                <span className="font-mono text-indigo-600">{activeShareSession.passcode}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold pt-2 border-t border-slate-100 dark:border-slate-850">
                                <span className="text-slate-400">المستودع المستهدف:</span>
                                <span className="text-slate-700 dark:text-slate-300">{activeShareSession.warehouseName}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => handleCopyToClipboard(`${window.location.origin}/shared-audit/${activeShareSession.id}`)}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md"
                            >
                                نسخ الرابط الكلي
                            </button>
                            <button 
                                onClick={() => setActiveShareSession(null)}
                                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black rounded-xl transition-all"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification & Approval Drawer / Modal */}
            {selectedReviewSession && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/85 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        
                        {/* Drawer Header */}
                        <div className="p-5 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                            <div className="space-y-0.5">
                                <h4 className="font-black text-sm">مراجعة وفحص كميات جرد الموظفين</h4>
                                <p className="text-[10px] text-indigo-100 font-bold">المستودع: {selectedReviewSession.warehouseName} • معزول بواسطة Passcode: {selectedReviewSession.passcode}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handlePrintAudit(selectedReviewSession)}
                                    className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl transition-all text-xs font-black flex items-center gap-1.5 text-white shadow-sm cursor-pointer"
                                    title="طباعة كشف ومراجعة الجرد"
                                >
                                    <Printer size={14} />
                                    <span>طباعة التقرير</span>
                                </button>
                                <button 
                                    onClick={() => handleExportCSV(selectedReviewSession)}
                                    className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-xl transition-all text-xs font-black flex items-center gap-1.5 text-white shadow-sm cursor-pointer"
                                    title="تصدير ملف Excel / CSV"
                                >
                                    <Download size={14} />
                                    <span>تصدير Excel 📊</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedReviewSession(null);
                                        setRejectReason('');
                                        setReviewTab('details');
                                    }}
                                    className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all text-xs"
                                >
                                    إغلاق ✕
                                </button>
                            </div>
                        </div>

                        {/* Review Tabs */}
                        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 overflow-x-auto">
                            {[
                                { id: 'details', label: 'تفاصيل الجرد 📋' },
                                { id: 'swaps', label: 'حاسبة التبادل والتسوية 🔄' },
                                { id: 'presence', label: 'الموظفين النشطين 👥' },
                                { id: 'conflicts', label: 'حل النزاعات ⚖️', count: (selectedReviewSession.conflicts || []).length },
                                { id: 'assignments', label: 'التكليفات 📌', count: (selectedReviewSession.assignments || []).length },
                                { id: 'health', label: 'صحة المخزون 📈' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setReviewTab(tab.id as any)}
                                    className={`px-4 py-3 text-[10px] font-black transition-all border-b-2 whitespace-nowrap ${
                                        reviewTab === tab.id 
                                            ? 'border-indigo-600 text-indigo-600' 
                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                             {/* Drawer Body Scrollable */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            
                            {reviewTab === 'details' && (
                                <>
                                    {/* Audit History Logs Section */}
                            <div className="space-y-2">
                                <h5 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                                    <Clock size={14} className="text-indigo-600" />
                                    سجل حركات التدقيق والنشاط (Audit Log)
                                </h5>
                                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-2xl p-4 max-h-40 overflow-y-auto space-y-3">
                                    {(selectedReviewSession.logs || []).length === 0 ? (
                                        <p className="text-[10px] text-slate-400 text-center py-4">لا توجد حركات مسجلة في السجل لهذا الرابط بعد.</p>
                                    ) : (
                                        [...selectedReviewSession.logs].reverse().map((log: any) => (
                                            <div key={log.id} className="flex gap-3 text-[10px] pb-3 border-b border-slate-100 dark:border-slate-850 last:border-0 last:pb-0">
                                                <div className="shrink-0 text-slate-400 font-mono pt-0.5">
                                                    {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-black text-slate-700 dark:text-slate-200">{log.action}</span>
                                                        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[8px] font-bold">{log.userName}</span>
                                                    </div>
                                                    <p className="text-slate-500 font-medium">{log.details}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Manager & Signature Metadata info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-1">
                                    <span className="text-[9px] text-slate-400 font-black block">اسم المسؤول الميداني الرافع للجرد</span>
                                    <h5 className="text-xs font-black text-slate-800 dark:text-white">{selectedReviewSession.managerName || 'مسؤول الجرد الميداني'}</h5>
                                    {selectedReviewSession.submittedAt && (
                                        <span className="text-[9px] text-slate-400 font-bold font-sans block">تاريخ الإرسال: {new Date(selectedReviewSession.submittedAt).toLocaleString('ar-EG')}</span>
                                    )}
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
                                    <span className="text-[9px] text-slate-400 font-black block mb-1">توقيع المسؤول الإلكتروني</span>
                                    {selectedReviewSession.signatureData ? (
                                        <img 
                                            src={selectedReviewSession.signatureData} 
                                            alt="توقيع مسؤول المخزن" 
                                            className="h-10 object-contain self-start dark:invert opacity-80"
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <span className="text-xs text-amber-500 font-bold">لا يوجد توقيع إلكتروني مدرج</span>
                                    )}
                                </div>
                            </div>

                            {/* Discrepancies summary / status info */}
                            {selectedReviewSession.notes && (
                                <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/30 rounded-xl text-[10px] text-indigo-900 dark:text-indigo-300 font-bold">
                                    <strong>ملاحظات المرفق:</strong> {selectedReviewSession.notes}
                                </div>
                            )}

                            {/* Rejected Reason info if session was rejected before */}
                            {selectedReviewSession.status === 'rejected' && selectedReviewSession.rejectReason && (
                                <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-100/30 rounded-xl text-[10px] font-bold">
                                    <strong>سبب الرفض السابق:</strong> {selectedReviewSession.rejectReason}
                                </div>
                            )}

                            {/* Table of items submitted */}
                            <div className="space-y-3">
                                {(() => {
                                    const rawReviewItems = Array.isArray(selectedReviewSession?.items) ? selectedReviewSession.items : (selectedReviewSession?.items && typeof selectedReviewSession.items === 'object' ? Object.values(selectedReviewSession.items) : []);
                                    
                                    // Calculate metrics
                                    const totalCount = rawReviewItems.length;
                                    let diffCount = 0;
                                    let matchedCount = 0;
                                    let netDiffQty = 0;

                                    rawReviewItems.forEach((it: any) => {
                                        const actual = it.actualQty ?? 0;
                                        const system = it.systemQty ?? 0;
                                        const diff = actual - system;
                                        if (diff !== 0) {
                                            diffCount++;
                                            netDiffQty += diff;
                                        } else {
                                            matchedCount++;
                                        }
                                    });

                                    // Filter items
                                    const filteredItems = rawReviewItems.filter((it: any) => {
                                        const actual = it.actualQty ?? 0;
                                        const system = it.systemQty ?? 0;
                                        const diff = actual - system;

                                        // Filter by status
                                        if (itemsFilter === 'diff' && diff === 0) return false;
                                        if (itemsFilter === 'matched' && diff !== 0) return false;

                                        // Search query filter
                                        if (itemsSearch.trim()) {
                                            const q = itemsSearch.trim().toLowerCase();
                                            const nameMatch = (it.name || '').toLowerCase().includes(q);
                                            const skuMatch = (it.sku || '').toLowerCase().includes(q);
                                            return nameMatch || skuMatch;
                                        }

                                        return true;
                                    });

                                    return (
                                        <>
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-850">
                                                <div className="flex items-center gap-2">
                                                    <h5 className="text-xs font-black text-slate-800 dark:text-white">جدول الأرصدة والكميات</h5>
                                                    <div className="flex gap-1.5 text-[10px] font-bold">
                                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300">
                                                            الإجمالي: <strong>{totalCount}</strong>
                                                        </span>
                                                        <span className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-800/50 px-2 py-0.5 rounded-md text-rose-700 dark:text-rose-300">
                                                            فروقات: <strong>{diffCount}</strong> ({netDiffQty > 0 ? `+${netDiffQty}` : netDiffQty})
                                                        </span>
                                                        <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50 px-2 py-0.5 rounded-md text-emerald-700 dark:text-emerald-300">
                                                            مطابق: <strong>{matchedCount}</strong>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Filter pills & search input */}
                                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                                    <div className="relative flex-1 sm:w-48">
                                                        <Search className="absolute right-2.5 top-2 text-slate-400" size={13} />
                                                        <input 
                                                            type="text"
                                                            value={itemsSearch}
                                                            onChange={(e) => setItemsSearch(e.target.value)}
                                                            placeholder="بحث باسم السلعة أو SKU..."
                                                            className="w-full pr-8 pl-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold focus:outline-none focus:border-indigo-500"
                                                        />
                                                    </div>

                                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[10px] font-bold">
                                                        <button
                                                            onClick={() => setItemsFilter('all')}
                                                            className={`px-2.5 py-1 rounded-lg transition-all ${itemsFilter === 'all' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                                        >
                                                            الكل ({totalCount})
                                                        </button>
                                                        <button
                                                            onClick={() => setItemsFilter('diff')}
                                                            className={`px-2.5 py-1 rounded-lg transition-all ${itemsFilter === 'diff' ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                                        >
                                                            الفروقات ({diffCount})
                                                        </button>
                                                        <button
                                                            onClick={() => setItemsFilter('matched')}
                                                            className={`px-2.5 py-1 rounded-lg transition-all ${itemsFilter === 'matched' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                                        >
                                                            المطابق ({matchedCount})
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {filteredItems.length === 0 ? (
                                                <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                                    لا توجد أصناف تطابق فلاتر البحث المحددة
                                                </div>
                                            ) : (
                                                <div className="border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden">
                                                    <table className="w-full text-right text-[11px]">
                                                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-black border-b border-slate-100 dark:border-slate-855">
                                                            <tr>
                                                                <th className="px-4 py-2.5">اسم السلعة و SKU</th>
                                                                <th className="px-4 py-2.5 text-center">تكلفة الوحدة</th>
                                                                <th className="px-4 py-2.5 text-center">رصيد الدفاتر</th>
                                                                <th className="px-4 py-2.5 text-center">العد الفعلي</th>
                                                                <th className="px-4 py-2.5 text-center">فارق الوحدات</th>
                                                                <th className="px-4 py-2.5 text-center">فارق التكلفة (ج.م)</th>
                                                                <th className="px-4 py-2.5 text-left">ملاحظات وصور</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850 bg-white dark:bg-slate-900">
                                                            {filteredItems.map((item: any, i: number) => {
                                                                const actual = item.actualQty ?? 0;
                                                                const system = item.systemQty ?? 0;
                                                                const diff = actual - system;
                                                                const unitCost = getItemCost(item);
                                                                const diffVal = diff * unitCost;

                                                                return (
                                                                    <tr key={i} className="hover:bg-slate-50/50">
                                                                        <td className="px-4 py-2.5 font-bold">
                                                                            <div>{item.name}</div>
                                                                            <span className="text-[9px] text-slate-400 font-mono">{item.sku}</span>
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-500">
                                                                            {unitCost > 0 ? `${unitCost.toLocaleString('ar-EG')} ج.م` : '—'}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{system}</td>
                                                                        <td className="px-4 py-2.5 text-center font-mono font-black text-indigo-600">{actual}</td>
                                                                        <td className="px-4 py-2.5 text-center font-mono font-black">
                                                                            {diff === 0 ? (
                                                                                <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">مطابق</span>
                                                                            ) : (
                                                                                <span className={`px-2 py-0.5 rounded font-bold ${diff > 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-rose-600 bg-rose-50 dark:bg-rose-950/30'}`}>
                                                                                    {diff > 0 ? `+${diff}` : diff}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-center font-mono font-black">
                                                                            {diff === 0 ? (
                                                                                <span className="text-slate-400">0 ج.م</span>
                                                                            ) : (
                                                                                <span className={diffVal > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                                                    {diffVal > 0 ? `+${diffVal.toLocaleString('ar-EG')}` : diffVal.toLocaleString('ar-EG')} ج.م
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-left text-slate-400 font-bold">
                                                                            <div className="flex flex-col items-end gap-1">
                                                                                {item.notes && <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 line-clamp-1">{item.notes}</span>}
                                                                                {item.proofImage && (
                                                                                    <img 
                                                                                        src={item.proofImage} 
                                                                                        alt="إثبات الهالك" 
                                                                                        className="h-8 w-8 object-cover rounded-md cursor-pointer hover:scale-150 transition-all border border-slate-200"
                                                                                        referrerPolicy="no-referrer"
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Rejected Reason input if reviewing submitted session */}
                            {selectedReviewSession.status === 'submitted' && (
                                <div className="space-y-2 border-t border-slate-100 dark:border-slate-850 pt-4">
                                    <label className="text-[11px] text-slate-500 font-black block">اكتب سبب الرفض (في حالة الرفض وإعادة الجرد للموظف) *</label>
                                    <textarea 
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        placeholder="اكتب الأسباب والتعليمات هنا لمساعد المخزن..."
                                        rows={2}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none resize-none"
                                    />
                                </div>
                            )}
                        </>)}

                        {reviewTab === 'swaps' && (() => {
                            const rawReviewItems = Array.isArray(selectedReviewSession?.items) 
                                ? selectedReviewSession.items 
                                : (selectedReviewSession?.items && typeof selectedReviewSession.items === 'object' ? Object.values(selectedReviewSession.items) : []);

                            // Combine all employee sources (HR/Payroll staffMembers + CRM employees + staff + team)
                            const allEmployeeSources = [
                                ...(settings.staffMembers || []),
                                ...(settings.employees || []),
                                ...((settings as any).staff || []),
                                ...((settings as any).team || [])
                            ];
                            const unifiedEmployees = Array.from(
                                new Map(
                                    allEmployeeSources
                                        .filter((e: any) => e && (e.name || e.id))
                                        .map((e: any) => [((e.name || e.id) as string).trim(), e])
                                ).values()
                            );

                            const getItemCost = (item: any) => {
                                if (item.costPrice && item.costPrice > 0) return item.costPrice;
                                const prod = (settings.products || []).find((p: any) => p.sku === item.sku || p.name === item.name);
                                if (prod?.costPrice !== undefined && prod?.costPrice > 0) return prod.costPrice;
                                if (prod?.price !== undefined && prod?.price > 0) return prod.price;
                                return 0;
                            };

                            const getItemSellingPrice = (item: any) => {
                                if (item.sellingPrice && item.sellingPrice > 0) return item.sellingPrice;
                                if (item.price && item.price > 0) return item.price;
                                const prod = (settings.products || []).find((p: any) => p.sku === item.sku || p.name === item.name);
                                if ((prod as any)?.sellingPrice !== undefined && (prod as any)?.sellingPrice > 0) return (prod as any).sellingPrice;
                                if (prod?.price !== undefined && prod?.price > 0) return prod.price;
                                return getItemCost(item);
                            };

                            // Categorize items
                            const surplusItems = rawReviewItems.filter((it: any) => ((it.actualQty ?? 0) - (it.systemQty ?? 0)) > 0);
                            const deficitItems = rawReviewItems.filter((it: any) => ((it.actualQty ?? 0) - (it.systemQty ?? 0)) < 0);

                            // Calculations
                            let totalSurplusQty = 0;
                            let totalSurplusCost = 0;
                            surplusItems.forEach((it: any) => {
                                const diff = (it.actualQty ?? 0) - (it.systemQty ?? 0);
                                const cost = getItemCost(it);
                                totalSurplusQty += diff;
                                totalSurplusCost += diff * cost;
                            });

                            let totalDeficitQty = 0;
                            let totalDeficitCost = 0;
                            deficitItems.forEach((it: any) => {
                                const diff = Math.abs((it.actualQty ?? 0) - (it.systemQty ?? 0));
                                const cost = getItemCost(it);
                                totalDeficitQty += diff;
                                totalDeficitCost += diff * cost;
                            });

                            const netFinancialDifference = totalSurplusCost - totalDeficitCost;
                            const isNetLoss = netFinancialDifference < 0;
                            const isNetGain = netFinancialDifference > 0;
                            const absNetDifference = Math.abs(netFinancialDifference);

                            // Auto-generate matching swaps function
                            const handleAutoGenerateSwaps = () => {
                                const newSwaps: typeof customSwaps = [];
                                const surplusCopy = surplusItems.map((s: any) => ({ ...s, avail: (s.actualQty ?? 0) - (s.systemQty ?? 0) }));
                                const deficitCopy = deficitItems.map((d: any) => ({ ...d, need: Math.abs((d.actualQty ?? 0) - (d.systemQty ?? 0)) }));

                                surplusCopy.forEach((s: any) => {
                                    if (s.avail <= 0) return;
                                    deficitCopy.forEach((d: any) => {
                                        if (d.need <= 0 || s.avail <= 0) return;
                                        const swappedQty = Math.min(s.avail, d.need);
                                        const sCost = getItemCost(s);
                                        const dCost = getItemCost(d);
                                        const costDiff = (sCost - dCost) * swappedQty;

                                        newSwaps.push({
                                            id: `auto-${Date.now()}-${Math.random()}`,
                                            surplusSku: s.sku || s.name,
                                            surplusName: s.name,
                                            deficitSku: d.sku || d.name,
                                            deficitName: d.name,
                                            qty: swappedQty,
                                            surplusCost: sCost,
                                            deficitCost: dCost,
                                            costDifference: costDiff
                                        });

                                        s.avail -= swappedQty;
                                        d.need -= swappedQty;
                                    });
                                });

                                setCustomSwaps(newSwaps);
                                onAlert('تم التوليد التلقائي 🪄', `تم إجراء مقاصة لعدد ${newSwaps.length} ثنائيات تبادل بين المنتجات.`, 'success');
                            };

                            const handleAddManualSwap = () => {
                                if (!manualSurplusSku || !manualDeficitSku) {
                                    onAlert('تنبيه', 'يرجى اختيار المنتج الزائد والمنتج الناقص للتبادل.', 'warning');
                                    return;
                                }

                                const sItem = surplusItems.find((i: any) => (i.sku || i.name) === manualSurplusSku);
                                const dItem = deficitItems.find((i: any) => (i.sku || i.name) === manualDeficitSku);

                                if (!sItem || !dItem) {
                                    onAlert('تنبيه', 'لم يتم العثور على بيانات المنتجات المحددة.', 'danger');
                                    return;
                                }

                                const sCost = getItemCost(sItem);
                                const dCost = getItemCost(dItem);
                                const qty = Number(manualSwapQty) || 1;
                                const costDiff = (sCost - dCost) * qty;

                                const newSwap = {
                                    id: `manual-${Date.now()}`,
                                    surplusSku: sItem.sku || sItem.name,
                                    surplusName: sItem.name,
                                    deficitSku: dItem.sku || dItem.name,
                                    deficitName: dItem.name,
                                    qty,
                                    surplusCost: sCost,
                                    deficitCost: dCost,
                                    costDifference: costDiff
                                };

                                setCustomSwaps(prev => [...prev, newSwap]);
                                setManualSurplusSku('');
                                setManualDeficitSku('');
                                setManualSwapQty(1);
                            };

                            const managerName = employeeResponsibleName || selectedReviewSession?.managerName || 'أمين المستودع المسؤول';

                            // Calculate assigned breakdown for accounting entry & voucher text
                            let pPiecesCount = 0, pValTotal = 0, pCostTotal = 0;
                            Object.entries(partnerSelectedSkus).forEach(([key, qty]) => {
                                if (qty <= 0) return;
                                const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                if (item) {
                                    const price = partnerPricingPolicy === 'cost' ? getItemCost(item) : getItemSellingPrice(item);
                                    pPiecesCount += qty;
                                    pValTotal += qty * price;
                                    pCostTotal += qty * getItemCost(item);
                                }
                            });

                            let ePiecesCount = 0, eValTotal = 0;
                            Object.entries(employeeSelectedSkus).forEach(([key, qty]) => {
                                if (qty <= 0) return;
                                const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                if (item) {
                                    ePiecesCount += qty;
                                    eValTotal += qty * getItemCost(item);
                                }
                            });

                            const totalAssignedCost = pCostTotal + eValTotal;
                            const remainingDiffAmount = Math.max(0, absNetDifference - totalAssignedCost);

                            let calcEmployeeVal = eValTotal;
                            let calcPartnerVal = pValTotal;
                            let calcCompanyExpense = 0;

                            if (lossAllocationAccount === 'mixed') {
                                if (residualAllocationTarget === 'employee') {
                                    calcEmployeeVal += remainingDiffAmount;
                                } else if (residualAllocationTarget === 'partner') {
                                    calcPartnerVal += remainingDiffAmount;
                                } else {
                                    calcCompanyExpense = remainingDiffAmount;
                                }
                            } else if (lossAllocationAccount === 'employee') {
                                calcEmployeeVal = absNetDifference;
                            } else if (lossAllocationAccount === 'partner') {
                                calcPartnerVal = partnerPricingPolicy === 'cost' ? absNetDifference : absNetDifference;
                            } else if (lossAllocationAccount === 'wastage') {
                                calcCompanyExpense = absNetDifference;
                            } else {
                                calcCompanyExpense = absNetDifference;
                            }

                            // Generate Accounting Journal Voucher Text
                            const journalVoucherText = `
=== قيد تسوية الجرد المالي والمقاصة بين الأصناف ===
المستودع: ${selectedReviewSession?.warehouseName || 'المستودع الرئيسي'}
تاريخ التسوية: ${new Date().toLocaleDateString('ar-EG')}
------------------------------------------------
[من حـ/ المخزون] - زيادة كميات أخطاء التبادل: +${totalSurplusCost.toLocaleString()} ج.م (${totalSurplusQty} قطعة)
[إلى حـ/ المخزون] - عجز كميات أخطاء التبادل: -${totalDeficitCost.toLocaleString()} ج.م (${totalDeficitQty} قطعة)
${isNetLoss ? `${calcPartnerVal > 0 ? `[من حـ/ جاري الشريك (${selectedPartnerName || 'الشريك المعني'}) - مسحوبات شخصية]: +${calcPartnerVal.toLocaleString()} ج.م\n` : ''}${calcEmployeeVal > 0 ? `[من حـ/ عهد وأمانات الموظف (${managerName})]: +${calcEmployeeVal.toLocaleString()} ج.م\n` : ''}${calcCompanyExpense > 0 ? `[من حـ/ مصاريف تسويات جردية وتشغيلية]: +${calcCompanyExpense.toLocaleString()} ج.م\n` : ''}` : ''}${isNetGain ? `[إلى حـ/ أرباح وإيرادات التسوية الجردية] - تسوية فائض القيمة: -${absNetDifference.toLocaleString()} ج.م\n` : ''}------------------------------------------------
البيان: تسوية عجز وزيادة جرد المستودع وتخصيص فارق التكلفة والمقاصة.
                            `.trim();

                            return (
                                <div className="space-y-6">
                                    {/* Header Banner */}
                                    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-5 rounded-3xl text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300">
                                                    <ArrowRightLeft size={20} />
                                                </div>
                                                <h4 className="text-sm font-black">حاسبة تبادل الأصناف والتسوية الفورية (Item Swap & Loss Calculator)</h4>
                                            </div>
                                            <p className="text-[11px] text-indigo-200/80 font-bold max-w-2xl">
                                                تعالج هذه الحاسبة أخطاء صرف أو بيع "منتج بدلاً من منتج آخر". تقوم بعمل مقاصة بين الزيادات والعجز، وحساب فارق التكلفة الحقيقي، وتوليد القيد المحاسبي لتوزيع الخسارة أو الفائض.
                                            </p>
                                        </div>

                                        <button 
                                            onClick={handleAutoGenerateSwaps}
                                            className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs rounded-2xl transition-all shadow-lg flex items-center gap-2 shrink-0 border border-indigo-400/30 cursor-pointer"
                                        >
                                            <Sparkles size={16} />
                                            <span>توليد المقاصة والتبادل التلقائي 🪄</span>
                                        </button>
                                    </div>

                                    {/* Financial Overview Metrics */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/50 p-4 rounded-2xl">
                                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 block mb-1">إجمالي تكلفة الأصناف الزائدة (Surplus)</span>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xl font-black text-emerald-800 dark:text-emerald-300">+{totalSurplusCost.toLocaleString()} <span className="text-xs">ج.م</span></span>
                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">+{totalSurplusQty} قطعة</span>
                                            </div>
                                        </div>

                                        <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/50 p-4 rounded-2xl">
                                            <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 block mb-1">إجمالي تكلفة الأصناف الناقصة (Deficit)</span>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xl font-black text-rose-800 dark:text-rose-300">-{totalDeficitCost.toLocaleString()} <span className="text-xs">ج.م</span></span>
                                                <span className="text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-md">-{totalDeficitQty} قطعة</span>
                                            </div>
                                        </div>

                                        <div className={`border p-4 rounded-2xl ${isNetLoss ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60' : 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60'}`}>
                                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 block mb-1">صافي فارق تسوية التكلفة المقاصة</span>
                                            <div className="flex justify-between items-baseline">
                                                <span className={`text-xl font-black ${isNetLoss ? 'text-amber-700 dark:text-amber-400' : 'text-indigo-700 dark:text-indigo-400'}`}>
                                                    {isNetLoss ? `-${absNetDifference.toLocaleString()}` : `+${absNetDifference.toLocaleString()}`} <span className="text-xs">ج.م</span>
                                                </span>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${isNetLoss ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                                    {isNetLoss ? 'عجز تكلفة / خسارة' : isNetGain ? 'وفر تكلفة لصالح المخزن' : 'متوازن 100%'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                                            <span className="text-[10px] font-black text-slate-500 block mb-1">حالة المقاصة الحالية</span>
                                            <div className="flex items-center gap-1.5 font-black text-xs text-slate-700 dark:text-slate-200">
                                                <Calculator size={15} className="text-indigo-600" />
                                                <span>{customSwaps.length > 0 ? `${customSwaps.length} عمليات تبادل مسجلة` : 'لم يتم ربط تبادلات بعد'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Manual Pair Selector Form */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm">
                                        <h5 className="text-xs font-black text-slate-850 dark:text-white flex items-center gap-2">
                                            <Plus size={16} className="text-indigo-600" />
                                            ربط يدوّي بين صنف زائد وصنف ناقص (تبادل محدد)
                                        </h5>

                                        <div className="grid grid-cols-1 sm:grid-cols-8 gap-3 items-end">
                                            <div className="sm:col-span-3 space-y-1">
                                                <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 block">المنتج الزائد (الذي تم إرجاعه أو عدم صرفه بالخطأ)</label>
                                                <select 
                                                    value={manualSurplusSku}
                                                    onChange={e => {
                                                        const sku = e.target.value;
                                                        setManualSurplusSku(sku);
                                                        if (sku && manualDeficitSku) {
                                                            const sItem = surplusItems.find((i: any) => (i.sku || i.name) === sku);
                                                            const dItem = deficitItems.find((i: any) => (i.sku || i.name) === manualDeficitSku);
                                                            if (sItem && dItem) {
                                                                const sDiff = (sItem.actualQty ?? 0) - (sItem.systemQty ?? 0);
                                                                const dDiff = Math.abs((dItem.actualQty ?? 0) - (dItem.systemQty ?? 0));
                                                                const autoQty = Math.max(1, Math.min(sDiff, dDiff));
                                                                setManualSwapQty(autoQty);
                                                            }
                                                        }
                                                    }}
                                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white"
                                                >
                                                    <option value="">اختر صنف فيه زيادة...</option>
                                                    {surplusItems.map((s: any, idx: number) => {
                                                        const diff = (s.actualQty ?? 0) - (s.systemQty ?? 0);
                                                        const cost = getItemCost(s);
                                                        return (
                                                            <option key={`surplus-opt-${s.sku || s.name || idx}-${idx}`} value={s.sku || s.name}>
                                                                {s.name} (زيادة +{diff}) - تكلفة: {cost} ج.م
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>

                                            <div className="sm:col-span-3 space-y-1">
                                                <label className="text-[10px] font-black text-rose-700 dark:text-rose-400 block">المنتج الناقص (الذي صُرف بدلاً منه بالخطأ)</label>
                                                <select 
                                                    value={manualDeficitSku}
                                                    onChange={e => {
                                                        const sku = e.target.value;
                                                        setManualDeficitSku(sku);
                                                        if (sku && manualSurplusSku) {
                                                            const sItem = surplusItems.find((i: any) => (i.sku || i.name) === manualSurplusSku);
                                                            const dItem = deficitItems.find((i: any) => (i.sku || i.name) === sku);
                                                            if (sItem && dItem) {
                                                                const sDiff = (sItem.actualQty ?? 0) - (sItem.systemQty ?? 0);
                                                                const dDiff = Math.abs((dItem.actualQty ?? 0) - (dItem.systemQty ?? 0));
                                                                const autoQty = Math.max(1, Math.min(sDiff, dDiff));
                                                                setManualSwapQty(autoQty);
                                                            }
                                                        }
                                                    }}
                                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white"
                                                >
                                                    <option value="">اختر صنف فيه عجز...</option>
                                                    {deficitItems.map((d: any, idx: number) => {
                                                        const diff = Math.abs((d.actualQty ?? 0) - (d.systemQty ?? 0));
                                                        const cost = getItemCost(d);
                                                        return (
                                                            <option key={`deficit-opt-${d.sku || d.name || idx}-${idx}`} value={d.sku || d.name}>
                                                                {d.name} (عجز -{diff}) - تكلفة: {cost} ج.م
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>

                                            <div className="sm:col-span-1 space-y-1">
                                                <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 block text-center">الكمية</label>
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    value={manualSwapQty}
                                                    onChange={e => setManualSwapQty(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center dark:text-white"
                                                    title="كمية القطع المراد تبادلها"
                                                />
                                            </div>

                                            <div className="sm:col-span-1">
                                                <button 
                                                    onClick={handleAddManualSwap}
                                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                                                >
                                                    <Plus size={14} />
                                                    <span>ربط</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Custom Swaps Table */}
                                    {customSwaps.length > 0 && (
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm space-y-3 p-4">
                                            <div className="flex justify-between items-center px-1">
                                                <h5 className="text-xs font-black text-slate-850 dark:text-white flex items-center gap-2">
                                                    <ArrowRightLeft size={15} className="text-indigo-600" />
                                                    جدول التبادلات والمقاصات المحددة بين الأصناف
                                                </h5>
                                                <button 
                                                    onClick={() => setCustomSwaps([])}
                                                    className="text-[10px] font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg"
                                                >
                                                    إلغاء كافة التبادلات
                                                </button>
                                            </div>

                                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                                                <table className="w-full text-right text-[11px]">
                                                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-black border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                                                        <tr>
                                                            <th className="px-4 py-2.5">المنتج الزائد (المُعاد)</th>
                                                            <th className="px-4 py-2.5">المنتج الناقص (المستبدل)</th>
                                                            <th className="px-4 py-2.5 text-center">الكمية المتبادلة</th>
                                                            <th className="px-4 py-2.5 text-center">فارق التكلفة للوحدة</th>
                                                            <th className="px-4 py-2.5 text-center">إجمالي فارق التكلفة</th>
                                                            <th className="px-4 py-2.5 text-center">إجراء</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 font-bold">
                                                        {customSwaps.map((sw) => {
                                                            const diffPerUnit = sw.surplusCost - sw.deficitCost;
                                                            return (
                                                                <tr key={sw.id} className="hover:bg-slate-50/50">
                                                                    <td className="px-4 py-2.5 text-emerald-700 dark:text-emerald-400">
                                                                        <div>{sw.surplusName}</div>
                                                                        <span className="text-[9px] text-slate-400 font-mono">تكلفة: {sw.surplusCost} ج.م</span>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-rose-700 dark:text-rose-400">
                                                                        <div>{sw.deficitName}</div>
                                                                        <span className="text-[9px] text-slate-400 font-mono">تكلفة: {sw.deficitCost} ج.م</span>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-center font-black font-mono text-indigo-600">{sw.qty}</td>
                                                                    <td className="px-4 py-2.5 text-center font-mono">
                                                                        {diffPerUnit === 0 ? 'متطابق' : (diffPerUnit > 0 ? `+${diffPerUnit} ج.م` : `${diffPerUnit} ج.م`)}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-center font-mono font-black">
                                                                        <span className={`px-2 py-0.5 rounded-md ${sw.costDifference < 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
                                                                            {sw.costDifference > 0 ? `+${sw.costDifference}` : sw.costDifference} ج.م
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-center">
                                                                        <button 
                                                                            onClick={() => setCustomSwaps(prev => prev.filter(p => p.id !== sw.id))}
                                                                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                        >
                                                                            <Trash2 size={13} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Loss & Variance Allocation Settlement Selector */}
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm">
                                        <div>
                                            <h5 className="text-xs font-black text-slate-850 dark:text-white flex items-center gap-2">
                                                <Building2 size={16} className="text-indigo-600" />
                                                توجيه وتغطية فارق الخسارة المالية للتسوية الجردية (Loss Allocation)
                                            </h5>
                                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                حدد الحساب أو الجهة المسؤولة عن امتصاص صافي العجز أو الخسارة الناتجة عن أخطاء الجرد والتبادل:
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setLossAllocationAccount('expense')}
                                                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${lossAllocationAccount === 'expense' ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-black text-slate-800 dark:text-white">مصاريف تسوية جردية</span>
                                                    <Building2 size={15} className="text-indigo-600" />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold leading-tight">تُحمل الخسارة على مصاريف تشغيلية وتسويات جردية للشركة.</p>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setLossAllocationAccount('employee')}
                                                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${lossAllocationAccount === 'employee' ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-black text-slate-800 dark:text-white">عهد وأمانات الموظف</span>
                                                    <UserCheck size={15} className="text-amber-600" />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold leading-tight">تُحمل الخسارة على الموظف أو أمين المستودع المسؤول.</p>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setLossAllocationAccount('partner')}
                                                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${lossAllocationAccount === 'partner' ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-black text-slate-800 dark:text-white">مسحوبات شخصية لشريك</span>
                                                    <Users size={15} className="text-purple-600" />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold leading-tight">تُحمل الأصناف كمسحوبات شخصية على جاري الشريك.</p>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setLossAllocationAccount('wastage')}
                                                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${lossAllocationAccount === 'wastage' ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-black text-slate-800 dark:text-white">مسموحات هالك وعجز</span>
                                                    <AlertTriangle size={15} className="text-rose-600" />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold leading-tight">تُستبعد الخسارة كنسبة هالك مسموح بها بالشركة.</p>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setLossAllocationAccount('mixed')}
                                                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${lossAllocationAccount === 'mixed' ? 'bg-teal-50/80 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/20' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-black text-slate-800 dark:text-white">توزيع متعدد / مختلط</span>
                                                    <Sparkles size={15} className="text-teal-600" />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold leading-tight">توزيع العجز بين شريك + موظف + مصاريف الشركة.</p>
                                            </button>
                                        </div>

                                        {(lossAllocationAccount === 'employee' || lossAllocationAccount === 'mixed') && (
                                            <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200/60 dark:border-amber-800/50 space-y-3">
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                    <label className="text-[10px] font-black text-amber-800 dark:text-amber-300 shrink-0">اختر الموظف المسئول عن العهدة:</label>
                                                    <select 
                                                        value={unifiedEmployees.some((e: any) => e.name === (employeeResponsibleName || managerName)) ? (employeeResponsibleName || managerName) : 'custom'}
                                                        onChange={e => {
                                                            if (e.target.value !== 'custom' && e.target.value !== '') {
                                                                setEmployeeResponsibleName(e.target.value);
                                                            }
                                                        }}
                                                        className="flex-1 p-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                                                    >
                                                        <option value="">-- اختر الموظف المسئول --</option>
                                                        {unifiedEmployees.map((emp: any, idx: number) => (
                                                            <option key={emp.id || `emp-loss-${idx}`} value={emp.name}>
                                                                {emp.name} {emp.position || emp.role || emp.jobTitle ? `(${emp.position || emp.role || emp.jobTitle})` : ''}
                                                            </option>
                                                        ))}
                                                        <option value="custom">✍️ أدخل اسم موظف آخر يدوياً...</option>
                                                    </select>
                                                </div>

                                                <div className="flex items-center gap-2 pt-1 border-t border-amber-200/40 dark:border-amber-900/40">
                                                    <span className="text-[10px] font-bold text-slate-500 shrink-0">اسم الموظف المعين بالمحاسبة:</span>
                                                    <input 
                                                        type="text"
                                                        value={employeeResponsibleName || managerName}
                                                        onChange={e => setEmployeeResponsibleName(e.target.value)}
                                                        placeholder="أدخل اسم أمين المستودع أو الموظف..."
                                                        className="flex-1 p-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                                                    />
                                                </div>

                                                {/* Product Selection Area for Employee */}
                                                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 space-y-3 shadow-sm">
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                        <div>
                                                            <h6 className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                                                <UserCheck size={14} className="text-amber-600" />
                                                                <span>تحديد الأصناف والكميات المحملة على الموظف ({employeeResponsibleName || managerName}):</span>
                                                            </h6>
                                                            <p className="text-[10px] text-slate-500 font-medium">اختر الأصناف والكميات التي تم تحميلها كعهدة ناقصة على الموظف</p>
                                                        </div>

                                                        {deficitItems.length > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const allMap: Record<string, number> = {};
                                                                        deficitItems.forEach((d: any) => {
                                                                            const key = d.sku || d.name;
                                                                            allMap[key] = Math.abs((d.actualQty ?? 0) - (d.systemQty ?? 0));
                                                                        });
                                                                        setEmployeeSelectedSkus(allMap);
                                                                    }}
                                                                    className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 text-amber-700 dark:text-amber-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                                >
                                                                    ✓ تحديد كل العجز للموظف
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEmployeeSelectedSkus({})}
                                                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                                >
                                                                    إلغاء التحديد
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {deficitItems.length > 0 ? (
                                                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                                            {deficitItems.map((item: any, idx: number) => {
                                                                const itemKey = item.sku || item.name;
                                                                const maxDeficit = Math.abs((item.actualQty ?? 0) - (item.systemQty ?? 0));
                                                                const currentQty = employeeSelectedSkus[itemKey] || 0;
                                                                const unitCost = getItemCost(item);
                                                                const totalItemVal = currentQty * unitCost;

                                                                return (
                                                                    <div 
                                                                        key={`emp-item-${itemKey}-${idx}`}
                                                                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${currentQty > 0 ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-70'}`}
                                                                    >
                                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                            <input 
                                                                                type="checkbox"
                                                                                checked={currentQty > 0}
                                                                                onChange={e => {
                                                                                    if (e.target.checked) {
                                                                                        setEmployeeSelectedSkus(prev => ({ ...prev, [itemKey]: maxDeficit }));
                                                                                    } else {
                                                                                        setEmployeeSelectedSkus(prev => {
                                                                                            const copy = { ...prev };
                                                                                            delete copy[itemKey];
                                                                                            return copy;
                                                                                        });
                                                                                    }
                                                                                }}
                                                                                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                                                            />
                                                                            <div className="min-w-0">
                                                                                <div className="text-xs font-black text-slate-800 dark:text-white truncate">{item.name}</div>
                                                                                <div className="text-[10px] text-slate-500 font-bold flex items-center gap-2">
                                                                                    <span>كود: {item.sku || 'N/A'}</span>
                                                                                    <span>•</span>
                                                                                    <span className="text-rose-600 font-black">عجز بالجرد: {maxDeficit} قطعة</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                                                            <div className="text-right">
                                                                                <div className="text-[10px] text-slate-400 font-bold">التكلفة</div>
                                                                                <div className="text-xs font-black text-amber-700 dark:text-amber-300">
                                                                                    {unitCost.toLocaleString()} ج.م
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-1">
                                                                                <span className="text-[10px] text-slate-500 font-bold px-1">الكمية:</span>
                                                                                <input 
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max={maxDeficit}
                                                                                    value={currentQty}
                                                                                    onChange={e => {
                                                                                        const val = Math.max(0, Math.min(maxDeficit, parseInt(e.target.value) || 0));
                                                                                        setEmployeeSelectedSkus(prev => {
                                                                                            if (val === 0) {
                                                                                                const copy = { ...prev };
                                                                                                delete copy[itemKey];
                                                                                                return copy;
                                                                                            }
                                                                                            return { ...prev, [itemKey]: val };
                                                                                        });
                                                                                    }}
                                                                                    className="w-14 p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-center dark:text-white"
                                                                                />
                                                                            </div>

                                                                            <div className="text-right min-w-[70px]">
                                                                                <div className="text-[10px] text-slate-400 font-bold">الإجمالي</div>
                                                                                <div className="text-xs font-black text-amber-700 dark:text-amber-400">
                                                                                    {totalItemVal.toLocaleString()} ج.م
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center text-xs text-slate-500 font-bold">
                                                            لا توجد أصناف فيها عجز في هذا الجرد.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {(lossAllocationAccount === 'partner' || lossAllocationAccount === 'mixed') && (
                                            <div className="p-4 bg-purple-50/80 dark:bg-purple-950/30 rounded-2xl border border-purple-200/60 dark:border-purple-800/50 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-purple-800 dark:text-purple-300 block">اختر الشريك المستفيد من المسحوبات:</label>
                                                        <select 
                                                            value={(settings.partners || []).some((p: any) => p.name === selectedPartnerName) ? selectedPartnerName : 'custom'}
                                                            onChange={e => {
                                                                if (e.target.value !== 'custom' && e.target.value !== '') {
                                                                    setSelectedPartnerName(e.target.value);
                                                                }
                                                            }}
                                                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white shadow-sm"
                                                        >
                                                            <option value="">-- اختر الشريك من قائمة الشركاء --</option>
                                                            {(settings.partners || []).map((partner: any, idx: number) => (
                                                                <option key={partner.id || `partner-${idx}`} value={partner.name}>
                                                                    {partner.name} {partner.shareRatio ? `(نسبة الشراكة: ${partner.shareRatio}%)` : ''}
                                                                </option>
                                                            ))}
                                                            <option value="custom">✍️ أدخل اسم شريك آخر يدوياً...</option>
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-purple-800 dark:text-purple-300 block">سياسة احتساب قيمة المسحوبات المحاسبية:</label>
                                                        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-purple-300 dark:border-purple-800 shadow-sm">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPartnerPricingPolicy('cost')}
                                                                className={`flex-1 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-all ${partnerPricingPolicy === 'cost' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-purple-600'}`}
                                                            >
                                                                💰 بسعر التكلفة (الشراء)
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setPartnerPricingPolicy('price')}
                                                                className={`flex-1 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-all ${partnerPricingPolicy === 'price' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-purple-600'}`}
                                                            >
                                                                🏷️ بسعر البيع للجمهور
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 pt-2 border-t border-purple-200/40 dark:border-purple-900/40">
                                                    <span className="text-[10px] font-bold text-slate-500 shrink-0">اسم الشريك المعين:</span>
                                                    <input 
                                                        type="text"
                                                        value={selectedPartnerName}
                                                        onChange={e => setSelectedPartnerName(e.target.value)}
                                                        placeholder="أدخل اسم الشريك..."
                                                        className="flex-1 p-2 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-800 rounded-xl text-xs font-bold focus:outline-none dark:text-white"
                                                    />
                                                </div>

                                                {/* Product Selection Area */}
                                                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-purple-200 dark:border-purple-900/60 space-y-3 shadow-sm">
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                        <div>
                                                            <h6 className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                                                                <ShoppingBag size={14} className="text-purple-600" />
                                                                <span>تحديد الأصناف والمنتجات التي أخذها الشريك ({selectedPartnerName || 'الشريك'}):</span>
                                                            </h6>
                                                            <p className="text-[10px] text-slate-500 font-medium">اختر الأصناف والكميات التي أخذها الشريك من عجز الجرد لحساب المسحوبات بدقة</p>
                                                        </div>

                                                        {deficitItems.length > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const allMap: Record<string, number> = {};
                                                                        deficitItems.forEach((d: any) => {
                                                                            const key = d.sku || d.name;
                                                                            allMap[key] = Math.abs((d.actualQty ?? 0) - (d.systemQty ?? 0));
                                                                        });
                                                                        setPartnerSelectedSkus(allMap);
                                                                    }}
                                                                    className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 text-purple-700 dark:text-purple-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                                >
                                                                    ✓ تحديد كل العجز للشريك
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPartnerSelectedSkus({})}
                                                                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                                >
                                                                    إلغاء التحديد
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* List of deficit items to pick from */}
                                                    {deficitItems.length > 0 ? (
                                                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                                            {deficitItems.map((item: any, idx: number) => {
                                                                const itemKey = item.sku || item.name;
                                                                const maxDeficit = Math.abs((item.actualQty ?? 0) - (item.systemQty ?? 0));
                                                                const currentQty = partnerSelectedSkus[itemKey] || 0;
                                                                const unitCost = getItemCost(item);
                                                                const unitPrice = getItemSellingPrice(item);
                                                                const activePrice = partnerPricingPolicy === 'cost' ? unitCost : unitPrice;
                                                                const totalItemVal = currentQty * activePrice;

                                                                return (
                                                                    <div 
                                                                        key={itemKey + idx} 
                                                                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${currentQty > 0 ? 'bg-purple-50/60 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-70'}`}
                                                                    >
                                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                            <input 
                                                                                type="checkbox"
                                                                                checked={currentQty > 0}
                                                                                onChange={e => {
                                                                                    if (e.target.checked) {
                                                                                        setPartnerSelectedSkus(prev => ({ ...prev, [itemKey]: maxDeficit }));
                                                                                    } else {
                                                                                        setPartnerSelectedSkus(prev => {
                                                                                            const copy = { ...prev };
                                                                                            delete copy[itemKey];
                                                                                            return copy;
                                                                                        });
                                                                                    }
                                                                                }}
                                                                                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                                                                            />
                                                                            <div className="min-w-0">
                                                                                <div className="text-xs font-black text-slate-800 dark:text-white truncate">{item.name}</div>
                                                                                <div className="text-[10px] text-slate-500 font-bold flex items-center gap-2">
                                                                                    <span>كود: {item.sku || 'N/A'}</span>
                                                                                    <span>•</span>
                                                                                    <span className="text-rose-600 font-black">عجز بالجرد: {maxDeficit} قطعة</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                                                            <div className="text-right">
                                                                                <div className="text-[10px] text-slate-400 font-bold">السعر للقطعة</div>
                                                                                <div className="text-xs font-black text-purple-700 dark:text-purple-300">
                                                                                    {activePrice.toLocaleString()} ج.م
                                                                                    <span className="text-[9px] text-slate-400 font-normal mr-1">({partnerPricingPolicy === 'cost' ? 'تكلفة' : 'بيع'})</span>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-1">
                                                                                <span className="text-[10px] text-slate-500 font-bold px-1">الكمية المسحوبة:</span>
                                                                                <input 
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max={maxDeficit}
                                                                                    value={currentQty}
                                                                                    onChange={e => {
                                                                                        const val = Math.max(0, Math.min(maxDeficit, parseInt(e.target.value) || 0));
                                                                                        setPartnerSelectedSkus(prev => {
                                                                                            if (val === 0) {
                                                                                                const copy = { ...prev };
                                                                                                delete copy[itemKey];
                                                                                                return copy;
                                                                                            }
                                                                                            return { ...prev, [itemKey]: val };
                                                                                        });
                                                                                    }}
                                                                                    className="w-14 p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-center dark:text-white"
                                                                                />
                                                                            </div>

                                                                            <div className="text-right min-w-[70px]">
                                                                                <div className="text-[10px] text-slate-400 font-bold">الإجمالي</div>
                                                                                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                                                    {totalItemVal.toLocaleString()} ج.م
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center text-xs text-slate-500 font-bold">
                                                            لا توجد أصناف فيها عجز في هذا الجرد. جميع أصناف الجرد مطابقة أو بها زيادة.
                                                        </div>
                                                    )}

                                                    {/* Total Partner Summary Bar */}
                                                    {(() => {
                                                        let totalPartnerPieces = 0;
                                                        let totalPartnerVal = 0;

                                                        Object.entries(partnerSelectedSkus).forEach(([key, qty]) => {
                                                            if (qty <= 0) return;
                                                            const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                                            if (item) {
                                                                const price = partnerPricingPolicy === 'cost' ? getItemCost(item) : getItemSellingPrice(item);
                                                                totalPartnerPieces += qty;
                                                                totalPartnerVal += qty * price;
                                                            }
                                                        });

                                                        return (
                                                            <div className="p-3 bg-purple-100/70 dark:bg-purple-900/40 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-2 border border-purple-200 dark:border-purple-800">
                                                                <div className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-2">
                                                                    <span>ملخص المسحوبات المختارة للشريك ({selectedPartnerName || 'الشريك'}):</span>
                                                                    <span className="px-2 py-0.5 bg-purple-600 text-white rounded-md text-[10px] font-bold">{totalPartnerPieces} قطعة</span>
                                                                </div>
                                                                <div className="text-sm font-black text-purple-900 dark:text-purple-100 flex items-center gap-1">
                                                                    <span>إجمالي مسحوبات الشريك:</span>
                                                                    <span className="text-purple-700 dark:text-purple-300 underline font-extrabold">{totalPartnerVal.toLocaleString()} ج.م</span>
                                                                    <span className="text-[10px] text-slate-500 font-normal">({partnerPricingPolicy === 'cost' ? 'سعر التكلفة' : 'سعر البيع'})</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}

                                        {/* Target Selector for Residual Difference / Variance */}
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                <h6 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                                                    <Target size={15} className="text-indigo-600" />
                                                    <span>توجيه وتحميل فارق التكلفة المتبقي / فارق التسوية ({remainingDiffAmount > 0 ? `${remainingDiffAmount.toLocaleString()} ج.م` : '0 ج.م'}):</span>
                                                </h6>
                                                <span className="text-[10px] text-slate-500 font-bold">حدد الجهة التي ستتحمل الفارق المالي المتبقي في التسوية والجرد</span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setResidualAllocationTarget('employee')}
                                                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                                                        residualAllocationTarget === 'employee'
                                                            ? 'bg-amber-100/90 dark:bg-amber-950/70 border-amber-500 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400/30 font-black'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-80 hover:opacity-100'
                                                    }`}
                                                >
                                                    <UserCheck size={18} className="text-amber-600 shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black truncate">1. تحميل الفارق للموظف</div>
                                                        <div className="text-[10px] text-slate-500 font-bold truncate">حـ/ عهدة الموظف ({managerName})</div>
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setResidualAllocationTarget('partner')}
                                                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                                                        residualAllocationTarget === 'partner'
                                                            ? 'bg-purple-100/90 dark:bg-purple-950/70 border-purple-500 text-purple-950 dark:text-purple-100 ring-2 ring-purple-400/30 font-black'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-80 hover:opacity-100'
                                                    }`}
                                                >
                                                    <Users size={18} className="text-purple-600 shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black truncate">2. تحميل الفارق لشريك</div>
                                                        <div className="text-[10px] text-slate-500 font-bold truncate">حـ/ جاري الشريك ({selectedPartnerName || 'الشريك المعني'})</div>
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setResidualAllocationTarget('expense')}
                                                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                                                        residualAllocationTarget === 'expense'
                                                            ? 'bg-indigo-100/90 dark:bg-indigo-950/70 border-indigo-500 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-400/30 font-black'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-80 hover:opacity-100'
                                                    }`}
                                                >
                                                    <Building2 size={18} className="text-indigo-600 shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black truncate">3. مصاريف الشركة</div>
                                                        <div className="text-[10px] text-slate-500 font-bold truncate">حـ/ مصاريف تسويات جردية</div>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>

                                        {lossAllocationAccount === 'mixed' && (
                                            <div className="p-4 bg-teal-50/90 dark:bg-teal-950/40 rounded-2xl border border-teal-300 dark:border-teal-800 space-y-3">
                                                <h6 className="text-xs font-black text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                                                    <Sparkles size={15} className="text-teal-600" />
                                                    <span>ملخص التوزيع المتعدد لخسارة/عجز الجرد (Mixed Breakdown):</span>
                                                </h6>
                                                
                                                {(() => {
                                                    let pPieces = 0, pVal = 0, pCost = 0;
                                                    Object.entries(partnerSelectedSkus).forEach(([key, qty]) => {
                                                        if (qty <= 0) return;
                                                        const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                                        if (item) {
                                                            const price = partnerPricingPolicy === 'cost' ? getItemCost(item) : getItemSellingPrice(item);
                                                            pPieces += qty;
                                                            pVal += qty * price;
                                                            pCost += qty * getItemCost(item);
                                                        }
                                                    });

                                                    let ePieces = 0, eVal = 0;
                                                    Object.entries(employeeSelectedSkus).forEach(([key, qty]) => {
                                                        if (qty <= 0) return;
                                                        const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                                        if (item) {
                                                            const cost = getItemCost(item);
                                                            ePieces += qty;
                                                            eVal += qty * cost;
                                                        }
                                                    });

                                                    const totalAssignedCost = pCost + eVal;
                                                    const remainingExpense = Math.max(0, absNetDifference - totalAssignedCost);

                                                    return (
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800">
                                                                <span className="text-[10px] font-black text-purple-600 block">1. مسحوبات الشريك ({selectedPartnerName || 'الشريك'})</span>
                                                                <span className="text-xs font-black text-purple-900 dark:text-purple-200">{calcPartnerVal.toLocaleString()} ج.م</span>
                                                                <span className="text-[9px] text-slate-400 font-bold block">{pPieces} قطعة مخصصة لشريك {residualAllocationTarget === 'partner' && remainingDiffAmount > 0 ? `(+${remainingDiffAmount.toLocaleString()} ج.م فارق)` : ''}</span>
                                                            </div>

                                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800">
                                                                <span className="text-[10px] font-black text-amber-600 block">2. عهدة الموظف ({employeeResponsibleName || managerName})</span>
                                                                <span className="text-xs font-black text-amber-900 dark:text-amber-200">{calcEmployeeVal.toLocaleString()} ج.م</span>
                                                                <span className="text-[9px] text-slate-400 font-bold block">{ePieces} قطعة عهدة موظف {residualAllocationTarget === 'employee' && remainingDiffAmount > 0 ? `(+${remainingDiffAmount.toLocaleString()} ج.م فارق)` : ''}</span>
                                                            </div>

                                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                                                <span className="text-[10px] font-black text-indigo-600 block">3. مصاريف الشركة</span>
                                                                <span className="text-xs font-black text-indigo-900 dark:text-indigo-200">{calcCompanyExpense.toLocaleString()} ج.م</span>
                                                                <span className="text-[9px] text-slate-400 font-bold block">تسوية جردية على الشركة</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Generated Accounting Journal Entry Block */}
                                    <div className="bg-slate-900 text-slate-100 p-5 rounded-3xl space-y-3 font-mono shadow-xl border border-slate-800">
                                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-indigo-400" />
                                                <span className="text-xs font-black text-white">قيد التسوية والمقاصة المحاسبي التلقائي (Automated Journal Voucher)</span>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(journalVoucherText);
                                                    onAlert('تم النسخ 📋', 'تم نسخ سند وقيد التسوية المحاسبي إلى الحافظة بنجاح.', 'success');
                                                }}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Copy size={13} />
                                                <span>نسخ القيد المحاسبي</span>
                                            </button>
                                        </div>

                                        <div className="text-[11px] leading-relaxed space-y-1 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-emerald-400">
                                            <p><span className="text-slate-400"># بيان القيد:</span> تسوية جرد المستودع ({selectedReviewSession?.warehouseName}) وإجراء مقاصة التبادلات</p>
                                            <p className="text-slate-300">----------------------------------------------------</p>
                                            <p><span className="text-indigo-300">من حـ/ المخزون (تسوية الأصناف الزائدة):</span> +{totalSurplusCost.toLocaleString()} ج.م</p>
                                            <p><span className="text-indigo-300">إلى حـ/ المخزون (تسوية الأصناف الناقصة):</span> -{totalDeficitCost.toLocaleString()} ج.م</p>
                                            {isNetLoss && (
                                                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                                                    {lossAllocationAccount === 'mixed' ? (() => {
                                                        let pVal = 0, pCost = 0;
                                                        Object.entries(partnerSelectedSkus).forEach(([key, qty]) => {
                                                            if (qty <= 0) return;
                                                            const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                                            if (item) {
                                                                const price = partnerPricingPolicy === 'cost' ? getItemCost(item) : getItemSellingPrice(item);
                                                                pVal += qty * price;
                                                                pCost += qty * getItemCost(item);
                                                            }
                                                        });

                                                        let eVal = 0;
                                                        Object.entries(employeeSelectedSkus).forEach(([key, qty]) => {
                                                            if (qty <= 0) return;
                                                            const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                                            if (item) {
                                                                eVal += qty * getItemCost(item);
                                                            }
                                                        });

                                                        const remExpense = Math.max(0, absNetDifference - pCost - eVal);

                                                        return (
                                                            <>
                                                                {pVal > 0 && <p className="text-purple-400">[من حـ/ جاري الشريك ({selectedPartnerName || 'الشريك'}) - مسحوبات شخصية]: +{pVal.toLocaleString()} ج.م</p>}
                                                                {eVal > 0 && <p className="text-amber-400">[من حـ/ عهد وأمانات الموظف ({employeeResponsibleName || managerName})]: +{eVal.toLocaleString()} ج.م</p>}
                                                                {remExpense > 0 && <p className="text-indigo-400">[من حـ/ مصاريف تسويات جردية وتشغيلية]: +{remExpense.toLocaleString()} ج.م</p>}
                                                            </>
                                                        );
                                                    })() : (
                                                        <p className="text-amber-400">
                                                            <span>من حـ/ {lossAllocationAccount === 'employee' ? `أمانات وعهد الموظف (${employeeResponsibleName || managerName})` : lossAllocationAccount === 'wastage' ? 'مسموحات هالك وعجز طبيعي' : lossAllocationAccount === 'partner' ? `جاري الشريك (${selectedPartnerName || 'الشريك المعني'}) - مسحوبات شخصية (${partnerPricingPolicy === 'cost' ? 'بسعر التكلفة' : 'بسعر البيع'})` : 'مصاريف تسويات جردية وتشغيلية'}:</span> +{absNetDifference.toLocaleString()} ج.م
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {isNetGain && (
                                                <p className="text-emerald-400">
                                                    <span>إلى حـ/ أرباح وإيرادات التسوية الجردية:</span> -{absNetDifference.toLocaleString()} ج.م
                                                </p>
                                            )}
                                            {isNetGain && (
                                                <p className="text-emerald-400">
                                                    <span>إلى حـ/ أرباح وإيرادات التسوية الجردية:</span> -{absNetDifference.toLocaleString()} ج.م
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {reviewTab === 'presence' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100/30 text-center">
                                        <span className="text-[10px] font-black text-emerald-600 block mb-1">الموظفين المتصلين</span>
                                        <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                                            {Object.keys(selectedReviewSession.presence || {}).length}
                                        </span>
                                    </div>
                                    <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/30 text-center">
                                        <span className="text-[10px] font-black text-indigo-600 block mb-1">عمليات العد النشطة</span>
                                        <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
                                            {Object.values(selectedReviewSession.presence || {}).filter((p: any) => p.activeProductId).length}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 text-center">
                                        <span className="text-[10px] font-black text-slate-500 block mb-1">آخر حركة نشاط</span>
                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">الآن</span>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                                    <table className="w-full text-right text-[11px]">
                                        <thead className="bg-slate-50 dark:bg-slate-800/40 font-black border-b border-slate-100">
                                            <tr>
                                                <th className="px-4 py-2.5">الموظف</th>
                                                <th className="px-4 py-2.5 text-center">الحالة</th>
                                                <th className="px-4 py-2.5 text-center">يقوم بجرد الآن</th>
                                                <th className="px-4 py-2.5 text-left">آخر تواجد</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {Object.values(selectedReviewSession.presence || {}).length === 0 ? (
                                                <tr><td colSpan={4} className="py-8 text-center text-slate-400 font-bold">لا يوجد موظفين متصلين حالياً</td></tr>
                                            ) : (
                                                Object.values(selectedReviewSession.presence || {}).map((p: any) => (
                                                    <tr key={p.userId} className="hover:bg-slate-50/50">
                                                        <td className="px-4 py-3 font-black text-slate-700 dark:text-slate-200">{p.userName}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full">متصل</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-bold text-indigo-600">
                                                            {p.activeProductId ? `📦 ${p.activeProductId}` : '---'}
                                                        </td>
                                                        <td className="px-4 py-3 text-left text-slate-400 font-mono">
                                                            {new Date(p.lastActive).toLocaleTimeString('ar-EG')}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {reviewTab === 'conflicts' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <h4 className="text-xs font-black text-amber-800 dark:text-amber-400">مركز حل النزاعات والتضارب (Conflict Resolution)</h4>
                                        <p className="text-[10px] text-amber-700/80 dark:text-amber-500/80 font-bold mt-0.5">تظهر هنا الأصناف التي قام أكثر من موظف بجردها بقيم مختلفة. يرجى مراجعة المدخلات واعتماد القيمة الصحيحة.</p>
                                    </div>
                                </div>

                                {(selectedReviewSession.conflicts || []).length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <CheckCircle className="mx-auto text-emerald-400 mb-2" size={32} />
                                        <p className="text-xs">رائع! لا يوجد أي تضارب في مدخلات الموظفين حالياً.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedReviewSession.conflicts.map((conflict: any) => (
                                            <div key={conflict.productId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                                    <h5 className="text-xs font-black text-slate-850 dark:text-white">{conflict.itemName}</h5>
                                                    <span className="text-[9px] font-mono text-slate-400">ID: {conflict.productId}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800">
                                                    {conflict.counts.map((c: any, idx: number) => (
                                                        <div key={idx} className="bg-white dark:bg-slate-900 p-4 flex justify-between items-center">
                                                            <div className="space-y-1">
                                                                <span className="text-[9px] font-black text-slate-400 block">موظف رقم {idx + 1}</span>
                                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{c.userName}</span>
                                                            </div>
                                                            <div className="text-left">
                                                                <span className="text-lg font-black text-indigo-600">{c.qty}</span>
                                                                <span className="text-[10px] text-slate-400 block">قطعة</span>
                                                            </div>
                                                            <button 
                                                                onClick={() => onResolveConflict(selectedReviewSession.id, conflict.productId, c.qty, c.userName)}
                                                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black transition-all"
                                                            >
                                                                اعتماد هذه القيمة
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {reviewTab === 'assignments' && (
                            <div className="space-y-6">
                                {/* Create Assignment Form */}
                                <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-4">
                                    <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                                        <ClipboardList size={16} />
                                        تكليف موظف بنطاق جرد محدد
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                        <div className="sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-500 mb-1 block">الموظف</label>
                                            <select 
                                                value={newAssignment.userId}
                                                onChange={e => {
                                                    const allEmps = [
                                                        ...(settings.staffMembers || []),
                                                        ...(settings.employees || []),
                                                        ...((settings as any).staff || []),
                                                        ...((settings as any).team || [])
                                                    ];
                                                    const emp = allEmps.find((emp: any) => (emp.id || emp.name) === e.target.value || emp.name === e.target.value);
                                                    setNewAssignment(prev => ({ ...prev, userId: e.target.value, userName: emp?.name || e.target.value }));
                                                }}
                                                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                                            >
                                                <option value="">اختر الموظف</option>
                                                {Array.from(
                                                    new Map(
                                                        [
                                                            ...(settings.staffMembers || []),
                                                            ...(settings.employees || []),
                                                            ...((settings as any).staff || []),
                                                            ...((settings as any).team || [])
                                                        ]
                                                        .filter((e: any) => e && (e.name || e.id))
                                                        .map((e: any) => [e.id || e.name, e])
                                                    ).values()
                                                ).map((emp: any, idx: number) => (
                                                    <option key={emp.id || `emp-asgn-${idx}`} value={emp.id || emp.name}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-500 mb-1 block">نوع النطاق</label>
                                            <select 
                                                value={newAssignment.scopeType}
                                                onChange={e => setNewAssignment(prev => ({ ...prev, scopeType: e.target.value as any }))}
                                                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                                            >
                                                <option value="zone">زون / قطاع</option>
                                                <option value="rack">رف (Rack)</option>
                                                <option value="shelf">طابق (Shelf)</option>
                                                <option value="category">قسم / تصنيف</option>
                                            </select>
                                        </div>
                                        <div className="sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-500 mb-1 block">قيمة النطاق</label>
                                            <input 
                                                type="text"
                                                value={newAssignment.scopeValue}
                                                onChange={e => setNewAssignment(prev => ({ ...prev, scopeValue: e.target.value }))}
                                                placeholder="مثال: A-01"
                                                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                                            />
                                        </div>
                                        <div className="sm:col-span-1 flex items-end">
                                            <button 
                                                onClick={() => {
                                                    if (!newAssignment.userId || !newAssignment.scopeValue) {
                                                        onAlert('بيانات ناقصة', 'يرجى اختيار الموظف وتحديد نطاق العمل.', 'warning');
                                                        return;
                                                    }
                                                    const updatedAssignments = [...(selectedReviewSession.assignments || []), { ...newAssignment }];
                                                    onUpdateAssignments(selectedReviewSession.id, updatedAssignments);
                                                    setNewAssignment({ userId: '', userName: '', scopeType: 'zone', scopeValue: '' });
                                                }}
                                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black transition-all shadow-md"
                                            >
                                                إضافة تكليف
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Assignments List */}
                                <div className="space-y-3">
                                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">قائمة التكليفات النشطة</h5>
                                    {(selectedReviewSession.assignments || []).length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                            لم يتم تعيين أي نطاقات عمل محددة للموظفين بعد.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {selectedReviewSession.assignments.map((asgn: any, idx: number) => (
                                                <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-indigo-600">
                                                            <User size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-850 dark:text-white">{asgn.userName}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 rounded">
                                                                    {asgn.scopeType === 'zone' ? 'قطاع' : asgn.scopeType === 'rack' ? 'رف' : asgn.scopeType === 'shelf' ? 'طابق' : 'قسم'}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-500">{asgn.scopeValue}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            const updated = selectedReviewSession.assignments.filter((_: any, i: number) => i !== idx);
                                                            onUpdateAssignments(selectedReviewSession.id, updated);
                                                        }}
                                                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {reviewTab === 'health' && healthStats && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm text-center space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">دقة الجرد الإجمالية</span>
                                        <span className="text-2xl font-black text-indigo-600">{healthStats.accuracy}%</span>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-2">
                                            <div className="bg-indigo-600 h-1 rounded-full" style={{ width: `${healthStats.accuracy}%` }} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm text-center space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">Warehouse Health</span>
                                        <span className="text-2xl font-black text-emerald-600">{healthStats.health}/100</span>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-2">
                                            <div className="bg-emerald-600 h-1 rounded-full" style={{ width: `${healthStats.health}%` }} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm text-center space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">معدل التباين (Variance)</span>
                                        <span className="text-2xl font-black text-rose-600">{healthStats.variance}%</span>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm text-center space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">جودة التدقيق (Audit Quality)</span>
                                        <span className="text-2xl font-black text-amber-500">{healthStats.quality}</span>
                                    </div>
                                </div>

                                {/* Location Accuracy Heatmap (Simplified) */}
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <h5 className="text-xs font-black text-slate-850 dark:text-white mb-4 flex items-center gap-2">
                                        <MapPin size={16} className="text-indigo-600" />
                                        خريطة دقة المواقع (Location Accuracy Heatmap)
                                    </h5>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
                                        {Array.from({ length: 20 }).map((_, i) => (
                                            <div 
                                                key={i} 
                                                className={`aspect-square rounded-lg flex items-center justify-center text-[8px] font-bold ${
                                                    i % 5 === 0 ? 'bg-rose-100 text-rose-700' : 
                                                    i % 3 === 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                }`}
                                                title={`Zone ${i+1}: ${i % 5 === 0 ? 'دقة منخفضة' : 'دقة عالية'}`}
                                            >
                                                Z{i+1}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex items-center gap-4 text-[9px] font-black text-slate-400">
                                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /> دقة 95%+</span>
                                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> دقة 80-95%</span>
                                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-400" /> دقة أقل من 80%</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>

                        {/* Drawer Actions Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 flex justify-between shrink-0 items-center">
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        setSelectedReviewSession(null);
                                        setRejectReason('');
                                    }}
                                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black rounded-xl transition-all"
                                >
                                    إغلاق ومعاينة لاحقاً
                                </button>

                                <button 
                                    onClick={() => handlePrintAudit(selectedReviewSession)}
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                                >
                                    <Printer size={15} />
                                    <span>طباعة التقرير 🖨️</span>
                                </button>

                                <button 
                                    onClick={() => handleExportCSV(selectedReviewSession)}
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                                >
                                    <FileSpreadsheet size={15} />
                                    <span>تصدير Excel 📊</span>
                                </button>
                            </div>

                            {selectedReviewSession.status === 'submitted' && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            if (!rejectReason.trim()) {
                                                onAlert('يرجى تحديد الأسباب', 'يجب إدخال مبرر أو توجيه للموظف عند رفض طلب جرد وإرجاعه.', 'warning');
                                                return;
                                            }
                                            onConfirm(
                                                'رفض وإعادة طلب الجرد؟',
                                                'سيتم إرجاع الطلب فوراً ومطالبة موظف المخزن بالعد الدقيق وإعادة الرفع المكتمل.',
                                                () => {
                                                    onRejectSharedSession(selectedReviewSession.id, rejectReason);
                                                    setSelectedReviewSession(null);
                                                    setRejectReason('');
                                                }
                                            );
                                        }}
                                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl transition-all"
                                    >
                                        رفض الطلب وإعادته للعد
                                    </button>

                                    <button 
                                        onClick={() => {
                                            onConfirm(
                                                'اعتماد ومطابقة الجرد الخارجي؟ ✅',
                                                'بمجرد الضغط على اعتماد، سيتم ترحيل هذه الكميات كأرصدة جديدة للمستودع وتسجيل التسويات المالية الكلية بنجاح على المنظومة وتطبيق التسويات على حسابات الموظفين والشركاء.',
                                                () => {
                                                    let settlementDetails: any = null;
                                                    if (selectedReviewSession) {
                                                        const rawItems = selectedReviewSession.items || [];
                                                        const mgrName = selectedReviewSession.managerName || 'مسؤول الأرفف الميداني';
                                                        const getItemCostLocal = (item: any) => {
                                                            if (item.costPrice && item.costPrice > 0) return item.costPrice;
                                                            const prod = (settings.products || []).find((p: any) => p.sku === item.sku || p.name === item.name);
                                                            if (prod?.costPrice !== undefined && prod?.costPrice > 0) return prod.costPrice;
                                                            if (prod?.price !== undefined && prod?.price > 0) return prod.price;
                                                            return 0;
                                                        };
                                                        const getItemSellingPriceLocal = (item: any) => {
                                                            if (item.sellingPrice && item.sellingPrice > 0) return item.sellingPrice;
                                                            if (item.price && item.price > 0) return item.price;
                                                            const prod = (settings.products || []).find((p: any) => p.sku === item.sku || p.name === item.name);
                                                            if ((prod as any)?.sellingPrice !== undefined && (prod as any)?.sellingPrice > 0) return (prod as any).sellingPrice;
                                                            if (prod?.price !== undefined && prod?.price > 0) return prod.price;
                                                            return getItemCostLocal(item);
                                                        };

                                                        const surplusItems = rawItems.filter((it: any) => ((it.actualQty ?? 0) - (it.systemQty ?? 0)) > 0);
                                                        const deficitItems = rawItems.filter((it: any) => ((it.actualQty ?? 0) - (it.systemQty ?? 0)) < 0);

                                                        let totalSurplusCost = 0;
                                                        surplusItems.forEach((it: any) => {
                                                            const diff = (it.actualQty ?? 0) - (it.systemQty ?? 0);
                                                            totalSurplusCost += diff * getItemCostLocal(it);
                                                        });

                                                        let totalDeficitCost = 0;
                                                        deficitItems.forEach((it: any) => {
                                                            const diff = Math.abs((it.actualQty ?? 0) - (it.systemQty ?? 0));
                                                            totalDeficitCost += diff * getItemCostLocal(it);
                                                        });

                                                        const netFinancialDifference = totalSurplusCost - totalDeficitCost;
                                                        const absNetDifference = Math.abs(netFinancialDifference);

                                                        let pValTotal = 0, pCostTotal = 0;
                                                        Object.entries(partnerSelectedSkus).forEach(([key, qty]) => {
                                                            if (qty <= 0) return;
                                                            const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                                            if (item) {
                                                                const price = partnerPricingPolicy === 'cost' ? getItemCostLocal(item) : getItemSellingPriceLocal(item);
                                                                pValTotal += qty * price;
                                                                pCostTotal += qty * getItemCostLocal(item);
                                                            }
                                                        });

                                                        let eValTotal = 0;
                                                        Object.entries(employeeSelectedSkus).forEach(([key, qty]) => {
                                                            if (qty <= 0) return;
                                                            const item = deficitItems.find((i: any) => (i.sku || i.name) === key);
                                                            if (item) {
                                                                eValTotal += qty * getItemCostLocal(item);
                                                            }
                                                        });

                                                        const totalAssignedCost = pCostTotal + eValTotal;
                                                        const remainingDiffAmount = Math.max(0, absNetDifference - totalAssignedCost);

                                                        let calcEmployeeVal = eValTotal;
                                                        let calcPartnerVal = pValTotal;
                                                        let calcCompanyExpense = 0;

                                                        if (lossAllocationAccount === 'mixed') {
                                                            if (residualAllocationTarget === 'employee') {
                                                                calcEmployeeVal += remainingDiffAmount;
                                                            } else if (residualAllocationTarget === 'partner') {
                                                                calcPartnerVal += remainingDiffAmount;
                                                            } else {
                                                                calcCompanyExpense = remainingDiffAmount;
                                                            }
                                                        } else if (lossAllocationAccount === 'employee') {
                                                            calcEmployeeVal = absNetDifference;
                                                        } else if (lossAllocationAccount === 'partner') {
                                                            calcPartnerVal = absNetDifference;
                                                        } else {
                                                            calcCompanyExpense = absNetDifference;
                                                        }

                                                        settlementDetails = {
                                                            lossAllocationAccount,
                                                            residualAllocationTarget,
                                                            partnerPricingPolicy,
                                                            calcPartnerVal,
                                                            calcEmployeeVal,
                                                            calcCompanyExpense,
                                                            selectedPartnerName: selectedPartnerName || '',
                                                            employeeResponsibleName: employeeResponsibleName || mgrName || 'الموظف المسؤول',
                                                            partnerSelectedSkus,
                                                            employeeSelectedSkus,
                                                            totalSurplusCost,
                                                            totalDeficitCost,
                                                            netFinancialDifference
                                                        };
                                                    }

                                                    onApproveSharedSession(selectedReviewSession.id, settlementDetails);
                                                    setSelectedReviewSession(null);
                                                },
                                                'success'
                                            );
                                        }}
                                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-md"
                                    >
                                        اعتماد وترحيل الأرصدة
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
