import React, { useState, useEffect } from 'react';
import { 
    Users, ShieldCheck, Database, RefreshCw, CheckCircle2, 
    Clock, AlertTriangle, ArrowRight, Check, X, ShieldAlert,
    Lock, Sparkles, HardDrive, FileCheck, Layers, Play
} from 'lucide-react';
import { 
    fetchMigrationOverview, 
    safeMigrateSingleUser, 
    safeBatchMigrateUsers, 
    UserMigrationItem, 
    MigrationSummary 
} from '../services/userMigrationService';

export const UserMigrationCenter: React.FC<{ onUserMigrated?: () => void }> = ({ onUserMigrated }) => {
    const [loading, setLoading] = useState(true);
    const [batchLoading, setBatchLoading] = useState(false);
    const [migratingPhone, setMigratingPhone] = useState<string | null>(null);
    const [summary, setSummary] = useState<MigrationSummary | null>(null);
    const [users, setUsers] = useState<UserMigrationItem[]>([]);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'migrated'>('all');

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchMigrationOverview();
            setSummary(data.summary);
            setUsers(data.users);
        } catch (e: any) {
            setMessage({ text: 'فشل تحميل بيانات الترحيل: ' + e.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSingleMigrate = async (phone: string) => {
        setMigratingPhone(phone);
        setMessage(null);
        try {
            const res = await safeMigrateSingleUser(phone);
            if (res.success) {
                setMessage({ text: res.message, type: 'success' });
                await loadData();
                if (onUserMigrated) onUserMigrated();
            } else {
                setMessage({ text: res.message, type: 'error' });
            }
        } catch (e: any) {
            setMessage({ text: 'حدث خطأ: ' + e.message, type: 'error' });
        } finally {
            setMigratingPhone(null);
        }
    };

    const handleBatchMigrate = async () => {
        if (!window.confirm('هل تريد بدء الترحيل الآمن لجميع المستخدمين المتبقين؟ لن يتم حذف أي سجل من قاعدة البيانات القديمة.')) {
            return;
        }
        setBatchLoading(true);
        setMessage({ text: 'جاري الترحيل الآمن للمستخدمين المتبقين بدون أي حذف...', type: 'info' });
        try {
            const res = await safeBatchMigrateUsers();
            if (res.success) {
                setMessage({ 
                    text: `اكتمل الترحيل الآمن بنجاح! تم ترحيل ${res.migratedCount} مستخدم إلى المنظومة الجديدة، والبيانات القديمة محفوظة بالكامل.`, 
                    type: 'success' 
                });
            } else {
                setMessage({ 
                    text: `تم ترحيل ${res.migratedCount} مستخدم، وحدثت أخطاء في ${res.failedCount}. التفاصيل: ${res.errors.join(' | ')}`, 
                    type: 'error' 
                });
            }
            await loadData();
            if (onUserMigrated) onUserMigrated();
        } catch (e: any) {
            setMessage({ text: 'فشل الترحيل الجماعي: ' + e.message, type: 'error' });
        } finally {
            setBatchLoading(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              u.phone.includes(searchTerm) || 
                              u.email.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (filterStatus === 'pending') return u.migrationStatus === 'legacy_only';
        if (filterStatus === 'migrated') return u.migrationStatus !== 'legacy_only';
        return true;
    });

    const completionRate = summary && summary.totalUsersCount > 0 
        ? Math.round(((summary.totalUsersCount - summary.pendingCount) / summary.totalUsersCount) * 100) 
        : 100;

    return (
        <div className="space-y-6">
            {/* Header & Safe Migration Policy Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black">
                            <ShieldCheck size={14} className="text-emerald-300" />
                            خطة الترحيل الآمنة والمستمرة (Zero Data Loss)
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black">مركز ترحيل المستخدمين الآمن</h2>
                        <p className="text-white/80 text-sm max-w-2xl font-medium leading-relaxed">
                            يتم نسخ وترحيل حسابات المستخدمين أولاً إلى المنظومة السحابية الجديدة (Firebase) مع إبقاء تسجيل الدخول القديم متاحاً ومفعلاً كمسار مؤقت، مع ضمان عدم حذف أي بيانات قديمة لحين التحقق النهائي.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={loadData}
                            disabled={loading || batchLoading}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-2xl font-black text-sm transition-all border border-white/20 active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            فحص وتحديث الحالة
                        </button>

                        <button
                            onClick={handleBatchMigrate}
                            disabled={loading || batchLoading || (summary?.pendingCount === 0)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-emerald-800 hover:bg-emerald-50 rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Play size={16} className={batchLoading ? 'animate-spin' : 'fill-current'} />
                            ترحيل المتبقين دفعة واحدة
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6 pt-6 border-t border-white/15">
                    <div className="flex justify-between items-center text-xs font-black mb-2">
                        <span>نسبة اكتمال ترحيل المستخدمين</span>
                        <span>{completionRate}%</span>
                    </div>
                    <div className="h-3 bg-black/20 rounded-full overflow-hidden p-0.5">
                        <div 
                            className="h-full bg-emerald-400 rounded-full transition-all duration-700 shadow-sm"
                            style={{ width: `${completionRate}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Notification message */}
            {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-black border transition-all ${
                    message.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                        : message.type === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : message.type === 'error' ? <AlertTriangle size={18} /> : <Sparkles size={18} />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Safe 4-Stage Migration Workflow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xs mb-1">
                        <CheckCircle2 size={16} /> المرحلة 1: حصر البيانات القديمة
                    </div>
                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">مطابقة الحسابات</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                        فحص سجلات Supabase وربط الهواتف والمتاجر دون لمس أي بيانات أصلية.
                    </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs mb-1">
                        <ShieldCheck size={16} /> المرحلة 2: مسار تسجيل دخول مزدوج
                    </div>
                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">مسار احتياطي مؤقت نشط</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                        تسجيل الدخول القديم شغال 100% ويقوم بالترقية الذكية التلقائية عند أول دخول للمستخدم.
                    </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-xs mb-1">
                        <HardDrive size={16} /> المرحلة 3: الترحيل التدريجي
                    </div>
                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">ترحيل بدون حذف (Zero-Loss)</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                        نسخ بيانات المستخدمين إلى Firestore مع الاحتفاظ بـ Supabase كمرجع احتياطي دائم.
                    </p>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs relative">
                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-black text-xs mb-1">
                        <FileCheck size={16} /> المرحلة 4: التحقق والمطابقة
                    </div>
                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">مراجعة كاملة قبل الإغلاق</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                        التأكد من دخول جميع المستخدمين بنجاح وصحة المتاجر والطلبات قبل إيقاف أي مسار قديم.
                    </p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-slate-500 dark:text-slate-400 text-xs font-black">إجمالي المستخدمين</div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                        {summary?.totalUsersCount ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold mt-1">في جميع المنظومات</div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-emerald-600 dark:text-emerald-400 text-xs font-black">تم الترحيل لفايربيس</div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {summary?.migratedUsersCount ?? 0}
                    </div>
                    <div className="text-[10px] text-emerald-600/70 font-bold mt-1">جاهزون في المنظومة الجديدة</div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-amber-600 dark:text-amber-400 text-xs font-black">في المسار القديم المؤقت</div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
                        {summary?.pendingCount ?? 0}
                    </div>
                    <div className="text-[10px] text-amber-600/70 font-bold mt-1">يعملون عبر المسار الاحتياطي</div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="text-indigo-600 dark:text-indigo-400 text-xs font-black">متطابقون بالكامل</div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                        {summary?.verifiedInSyncCount ?? 0}
                    </div>
                    <div className="text-[10px] text-indigo-600/70 font-bold mt-1">تحقق وتطابق تام 100%</div>
                </div>
            </div>

            {/* Users Table Controls */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Users size={20} className="text-emerald-600" />
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">سجل المستخدمين ومطابقة الترحيل</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black">
                            {filteredUsers.length}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-black">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                    filterStatus === 'all' 
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                الكل
                            </button>
                            <button
                                onClick={() => setFilterStatus('pending')}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                    filterStatus === 'pending' 
                                        ? 'bg-amber-500 text-white shadow-xs' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                بانتظار الترحيل ({summary?.pendingCount ?? 0})
                            </button>
                            <button
                                onClick={() => setFilterStatus('migrated')}
                                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                    filterStatus === 'migrated' 
                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                تم الترحيل ({summary?.migratedUsersCount ?? 0})
                            </button>
                        </div>

                        <input
                            type="text"
                            placeholder="بحث بالاسم أو الهاتف..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500 w-full sm:w-56"
                        />
                    </div>
                </div>

                {/* Users List */}
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-black">
                                <th className="py-3 px-4">المستخدم</th>
                                <th className="py-3 px-4">الهاتف</th>
                                <th className="py-3 px-4">الصلاحية</th>
                                <th className="py-3 px-4">المسار القديم (Supabase)</th>
                                <th className="py-3 px-4">المنظومة الجديدة (Firebase)</th>
                                <th className="py-3 px-4">حالة المطابقة</th>
                                <th className="py-3 px-4 text-center">الإجراء الآمن</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                                        لا يوجد مستخدمون مطابقون لمعايير البحث.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.phone} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="py-3.5 px-4 font-black text-slate-800 dark:text-slate-100">
                                            <div>{u.fullName}</div>
                                            {u.email && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.email}</div>}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300" dir="ltr">
                                            {u.phone}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {u.isAdmin ? (
                                                <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-black text-[10px]">
                                                    مدير نظام
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px]">
                                                    {u.storesCount} متجر
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {u.inSupabase ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                                    <Check size={14} /> محفوظ كنسخة قديمة
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {u.inFirestore ? (
                                                <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-black">
                                                    <CheckCircle2 size={14} /> نشط في السحابة
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-amber-600 font-black">
                                                    <Clock size={14} /> بالمسار المؤقت
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {u.migrationStatus === 'verified_in_sync' ? (
                                                <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black inline-flex items-center gap-1">
                                                    <Check size={12} /> متطابق ومتحقق
                                                </span>
                                            ) : u.migrationStatus === 'migrated' ? (
                                                <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black inline-flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> مرحّل
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-black inline-flex items-center gap-1">
                                                    <Clock size={12} /> بانتظار النسخ
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            {!u.inFirestore ? (
                                                <button
                                                    onClick={() => handleSingleMigrate(u.phone)}
                                                    disabled={migratingPhone === u.phone || batchLoading}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs inline-flex items-center gap-1"
                                                >
                                                    {migratingPhone === u.phone ? (
                                                        <RefreshCw size={12} className="animate-spin" />
                                                    ) : (
                                                        <Play size={12} className="fill-current" />
                                                    )}
                                                    نسخ آمن
                                                </button>
                                            ) : (
                                                <span className="text-[11px] text-slate-400 font-bold">محمي وموثق</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Assurance Notice */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                        <Lock size={14} className="text-emerald-500" />
                        <span>الضمان الأمني: لا يتم حذف أي سجل من قاعدة البيانات القديمة تحت أي ظرف.</span>
                    </div>
                    <div>
                        آخر فحص: {summary?.lastCheckedAt ? new Date(summary.lastCheckedAt).toLocaleTimeString('ar-EG') : 'الآن'}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default UserMigrationCenter;
