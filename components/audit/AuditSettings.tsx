import React, { useState } from 'react';
import { 
    Sliders, Clock, Volume2, Info, Check, ShieldCheck, 
    Sparkles, RefreshCw, HelpCircle, Save
} from 'lucide-react';
import { Settings } from '../../types';

interface AuditSettingsProps {
    settings: Settings;
    setSettings: (updater: React.SetStateAction<Settings>) => void;
    onSaveSuccess: (title: string, msg: string, type: 'success') => void;
}

export default function AuditSettings({
    settings,
    setSettings,
    onSaveSuccess
}: AuditSettingsProps) {
    // Local configs state
    const [alertThreshold, setAlertThreshold] = useState((settings as any).auditConfig?.alertThreshold ?? 30);
    const [autoClosingTolerance, setAutoClosingTolerance] = useState((settings as any).auditConfig?.autoClosingTolerance ?? 0);
    const [voiceSpeed, setVoiceSpeed] = useState((settings as any).auditConfig?.voiceSpeed ?? 1.0);
    const [defaultCountingMode, setDefaultCountingMode] = useState((settings as any).auditConfig?.defaultCountingMode ?? 'standard');
    const [enableDiscrepancyLimits, setEnableDiscrepancyLimits] = useState((settings as any).auditConfig?.enableDiscrepancyLimits ?? true);
    const [saving, setSaving] = useState(false);

    const handleSaveConfigs = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Update settings object
            setSettings(prev => ({
                ...prev,
                auditConfig: {
                    alertThreshold: Number(alertThreshold),
                    autoClosingTolerance: Number(autoClosingTolerance),
                    voiceSpeed: Number(voiceSpeed),
                    defaultCountingMode,
                    enableDiscrepancyLimits
                }
            }));
            
            // Wait brief moment to simulate saving
            await new Promise(resolve => setTimeout(resolve, 800));
            onSaveSuccess('تم حفظ الإعدادات', 'تم تحديث مواصفات وإعدادات الجرد الذكي بنجاح وتعميمها على جميع الأجهزة المتصلة.', 'success');
        } catch (err) {
            console.error('Error saving audit configs:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSaveConfigs} className="space-y-6 dir-rtl text-right animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Right side - Form options */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Block 1: Scheduling and alerts */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                        <div className="pb-3 border-b border-slate-50 dark:border-slate-800 flex items-center gap-2">
                            <Clock className="text-indigo-600" size={18} />
                            <h3 className="text-xs font-black text-slate-850 dark:text-white">جدولة وتنبيهات الجرد الدوري للأصناف</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] text-slate-500 font-black block mb-1.5">الحد الأقصى لركود الصنف بدون جرد (يوم) *</label>
                                <input 
                                    type="number" 
                                    min={5}
                                    max={365}
                                    required
                                    value={alertThreshold}
                                    onChange={e => setAlertThreshold(Number(e.target.value))}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                                    placeholder="أدخل المدة"
                                />
                                <span className="text-[9px] text-slate-400 mt-1 block">سيظهر مؤشر تنبيه بجانب الأصناف التي لم يتم حصرها منذ هذه المدة.</span>
                            </div>

                            <div>
                                <label className="text-[11px] text-slate-500 font-black block mb-1.5">تسامح التسوية التلقائية للفوارق (وحدة) *</label>
                                <input 
                                    type="number" 
                                    min={0}
                                    max={100}
                                    required
                                    value={autoClosingTolerance}
                                    onChange={e => setAutoClosingTolerance(Number(e.target.value))}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                                    placeholder="أدخل النسبة المئوية"
                                />
                                <span className="text-[9px] text-slate-400 mt-1 block">سيتم إغلاق الفوارق الأقل من هذه القيمة تلقائياً دون الحاجة لاعتماد التاجر.</span>
                            </div>
                        </div>
                    </div>

                    {/* Block 2: Voice assist properties */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                        <div className="pb-3 border-b border-slate-50 dark:border-slate-800 flex items-center gap-2">
                            <Volume2 className="text-indigo-600" size={18} />
                            <h3 className="text-xs font-black text-slate-850 dark:text-white">إعدادات المساعد الصوتي والذكاء الصوتي (المصري)</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] text-slate-500 font-black block mb-1.5">سرعة القراءة والتوجيه الصوتي للـ Counter</label>
                                <select 
                                    value={voiceSpeed}
                                    onChange={e => setVoiceSpeed(Number(e.target.value))}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                                >
                                    <option value={0.8}>بطيئة (0.8x)</option>
                                    <option value={1.0}>عادية ومريحة (1.0x)</option>
                                    <option value={1.2}>سريعة (1.2x)</option>
                                    <option value={1.5}>عالية السرعة للمحترفين (1.5x)</option>
                                </select>
                                <span className="text-[9px] text-slate-400 mt-1 block">تتحكم في سرعة تفاعل المساعد الصوتي المصري عند مطابقة الأصناف أو التحذير.</span>
                            </div>

                            <div>
                                <label className="text-[11px] text-slate-500 font-black block mb-1.5">وضع الجرد الافتراضي عند توليد الروابط</label>
                                <select 
                                    value={defaultCountingMode}
                                    onChange={e => setDefaultCountingMode(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                                >
                                    <option value="standard">عد اعتيادي (يظهر رصيد النظام للـ Counter)</option>
                                    <option value="blind">جرد أعمى (🔒 رصيد النظام مخفي لضمان الأمانة الكاملة)</option>
                                    <option value="strict">جرد صارم (يلزم تصوير الأرفف لكل صنف)</option>
                                </select>
                                <span className="text-[9px] text-slate-400 mt-1 block">النمط التلقائي الذي يطبق فوراً عند إنشاء رابط جرد خارجي جديد.</span>
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2.5 cursor-pointer pt-2">
                                <input 
                                    type="checkbox"
                                    checked={enableDiscrepancyLimits}
                                    onChange={e => setEnableDiscrepancyLimits(e.target.checked)}
                                    className="w-4.5 h-4.5 text-indigo-600 border-slate-200 rounded outline-none focus:ring-indigo-500/15"
                                />
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">منع الموظف من إرسال كمية جردية تتعدى 3x رصيد النظام بدون مبرر قوي</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Left side - Helpful info boxes */}
                <div className="space-y-4">
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-5 rounded-3xl space-y-3">
                        <Sparkles className="text-indigo-600 dark:text-indigo-400" size={24} />
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">مزايا الجرد الذكي المحدث</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                            تساعدك هذه المواصفات على ضبط معايير الدقة والإنذار المبكر بمخازنك. الجرد الأعمى (Blind Count) ينصح به دائماً لمنع التواطؤ أو الكسل عند العد الفعلي. التنبيه الصوتي المصري يضمن عدم تشتيت الـ Counter وبقاء عينه على السلعة والرف بدلاً من الهاتف.
                        </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 p-5 rounded-3xl space-y-3">
                        <ShieldCheck className="text-emerald-500" size={24} />
                        <h4 className="text-xs font-black text-slate-800 dark:text-white">الأمان والمزامنة الموحدة</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                            جميع التغييرات المبرمجة هنا ترفع لحظياً لقاعدة البيانات السحابية Firestore ويتم تحديث هواتف الموظفين في الميدان دون الحاجة لطلب تحديث الصفحة أو الخوف من ضياع الأرصدة.
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold">يرجى الضغط على حفظ لتطبيق التعديلات السحابية.</span>
                <button 
                    type="submit"
                    disabled={saving}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/15 transition-all flex items-center justify-center gap-1.5"
                >
                    {saving ? <RefreshCw className="animate-spin" size={15} /> : <Save size={15} />}
                    حفظ وتحديث الإعدادات الكلية
                </button>
            </div>
        </form>
    );
}
