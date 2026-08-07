import React, { useState, useMemo } from 'react';
import { 
    Link, Copy, Share2, Shield, Calendar, RefreshCw, AlertTriangle, 
    CheckCircle, XCircle, Clock, Trash2, ShieldCheck, HelpCircle, Eye, Scan, Lock,
    Users, Activity, MapPin, ClipboardList, User
} from 'lucide-react';
import { Settings } from '../../types';

interface SharedAuditsTabProps {
    settings: Settings;
    sharedSessions: any[];
    onCreateSharedSession: (title: string, warehouseId: string, protocol: string, passcode: string) => void;
    onApproveSharedSession: (sessionId: string) => void;
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
    const [reviewTab, setReviewTab] = useState<'details' | 'presence' | 'conflicts' | 'health' | 'assignments'>('details');

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
                                {(settings.warehouses || []).map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
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

            {/* List of generated links with approval status */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-black text-slate-850 dark:text-white">جدول وحالات روابط الجرد الخارجية</h3>
                        <p className="text-[10px] text-slate-400 font-bold">إليك كل الروابط المصدرة، يمكنك مراجعة الكميات المرفوعة واعتماد تسويتها بالكامل بضغطة زر.</p>
                    </div>

                    {loadingShared && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                            <RefreshCw className="animate-spin text-indigo-600" size={12} />
                            جاري المزامنة...
                        </span>
                    )}
                </div>

                {sharedSessions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <Link className="mx-auto text-slate-300 opacity-20 mb-2" size={44} />
                        <p className="text-xs font-black">لا توجد روابط جرد مشتركة حالياً</p>
                    </div>
                ) : (
                    <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3">عنوان الجرد والمستودع</th>
                                    <th className="px-4 py-3 text-center">رمز الحماية</th>
                                    <th className="px-4 py-3 text-center">النوع</th>
                                    <th className="px-4 py-3 text-center">أرصدة مرفوعة</th>
                                    <th className="px-4 py-3 text-center">حالة الرابط</th>
                                    <th className="px-4 py-3 text-left">التحكم والروابط</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {sharedSessions.map(session => {
                                    const itemsSubmitted = session.itemsSubmitted || 0;
                                    const shareUrl = `${window.location.origin}/shared-audit/${session.id}`;
                                    
                                    return (
                                        <tr key={session.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <div className="space-y-0.5">
                                                    <h4 className="font-black text-slate-800 dark:text-slate-200">{session.title}</h4>
                                                    <span className="text-[9px] text-slate-400 font-bold">📦 مستودع: {session.warehouseName}</span>
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
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                                    session.status === 'submitted' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400' :
                                                    session.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                    session.status === 'rejected' ? 'bg-red-100 text-red-750 dark:bg-red-950/20 dark:text-red-400' :
                                                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {session.status === 'submitted' ? '📝 جاهز للمراجعة' :
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
                                                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black shadow-sm"
                                                        >
                                                            مراجعة واعتماد
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setSelectedReviewSession(session)}
                                                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700 rounded-lg text-[10px] font-bold"
                                                        >
                                                            معاينة
                                                        </button>
                                                    )}

                                                    {/* Delete session option */}
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

                        {/* Review Tabs */}
                        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 overflow-x-auto">
                            {[
                                { id: 'details', label: 'تفاصيل الجرد 📋' },
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
                            <div className="space-y-2">
                                <h5 className="text-xs font-black text-slate-800 dark:text-white">جدول الأرصدة المدخلة فعلياً للأصناف</h5>
                                
                                {(() => {
                                    const reviewItems = Array.isArray(selectedReviewSession?.items) ? selectedReviewSession.items : (selectedReviewSession?.items && typeof selectedReviewSession.items === 'object' ? Object.values(selectedReviewSession.items) : []);
                                    if (reviewItems.length === 0) {
                                        return (
                                            <div className="py-8 text-center text-slate-400 text-xs">
                                                لم يتم حصر أي منتجات في هذا الملف المشترك
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden">
                                            <table className="w-full text-right text-[11px]">
                                                <thead className="bg-slate-50 dark:bg-slate-800/60 font-black border-b border-slate-100 dark:border-slate-855">
                                                    <tr>
                                                        <th className="px-4 py-2.5">اسم السلعة و SKU</th>
                                                        <th className="px-4 py-2.5 text-center">رصيد الدفاتر</th>
                                                        <th className="px-4 py-2.5 text-center">العد الفعلي</th>
                                                        <th className="px-4 py-2.5 text-center">الفارق المتوقع</th>
                                                        <th className="px-4 py-2.5 text-left">ملاحظات وصور</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-850 bg-white dark:bg-slate-900">
                                                    {reviewItems.map((item: any, i: number) => {
                                                        const actual = item.actualQty ?? 0;
                                                        const system = item.systemQty ?? 0;
                                                        const diff = actual - system;

                                                        return (
                                                            <tr key={i} className="hover:bg-slate-50/50">
                                                                <td className="px-4 py-2.5 font-bold">
                                                                    <div>{item.name}</div>
                                                                    <span className="text-[9px] text-slate-400 font-mono">{item.sku}</span>
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{system}</td>
                                                                <td className="px-4 py-2.5 text-center font-mono font-black text-indigo-600">{actual}</td>
                                                                <td className="px-4 py-2.5 text-center font-mono font-black">
                                                                    {diff === 0 ? (
                                                                        <span className="text-emerald-500">مطابق</span>
                                                                    ) : (
                                                                        <span className={diff > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                                            {diff > 0 ? `+${diff}` : diff}
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
                                                    const emp = settings.employees?.find(emp => emp.id === e.target.value);
                                                    setNewAssignment(prev => ({ ...prev, userId: e.target.value, userName: emp?.name || '' }));
                                                }}
                                                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                                            >
                                                <option value="">اختر الموظف</option>
                                                {settings.employees?.map(emp => (
                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
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
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 flex justify-between shrink-0">
                            <button 
                                onClick={() => {
                                    setSelectedReviewSession(null);
                                    setRejectReason('');
                                }}
                                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black rounded-xl transition-all"
                            >
                                إغلاق ومعاينة لاحقاً
                            </button>

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
                                                'بمجرد الضغط على اعتماد، سيتم ترحيل هذه الكميات كأرصدة جديدة للمستودع وتسجيل التسويات المالية الكلية بنجاح على المنظومة.',
                                                () => {
                                                    onApproveSharedSession(selectedReviewSession.id);
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
