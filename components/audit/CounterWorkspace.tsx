import React from 'react';
import { 
    AlertCircle, Camera, Mic, Undo, Redo, Plus, Minus, CheckCircle, 
    Zap, RefreshCw, Star, Info, Users, Smartphone, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SharedAuditItem, SharedAuditPresence } from '../../types';

interface CounterWorkspaceProps {
    activeItem: SharedAuditItem | undefined;
    selectedItemKey: string;
    counts: Record<string, number>;
    itemNotes: Record<string, string>;
    itemPhotos: Record<string, string>;
    isLockedByOther: boolean;
    lockerInfo: SharedAuditPresence | null;
    countMode: string;
    showSystemQty: boolean;
    accuracyScore: number;
    comboMultiplier: number;
    historyIndex: number;
    historyLength: number;
    isListening: boolean;
    activeVoiceField: string | null;
    onAdjustCount: (amount: number) => void;
    onSetCount: (val: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onPhotoCapture: (file: File | null) => void;
    onVoiceInput: () => void;
    onNoteChange: (text: string) => void;
    onSkipLocked: () => void;
}

const CounterWorkspace: React.FC<CounterWorkspaceProps> = ({
    activeItem,
    selectedItemKey,
    counts,
    itemNotes,
    itemPhotos,
    isLockedByOther,
    lockerInfo,
    countMode,
    showSystemQty,
    accuracyScore,
    comboMultiplier,
    historyIndex,
    historyLength,
    isListening,
    activeVoiceField,
    onAdjustCount,
    onSetCount,
    onUndo,
    onRedo,
    onPhotoCapture,
    onVoiceInput,
    onNoteChange,
    onSkipLocked
}) => {
    if (!activeItem) return null;

    const count = counts[selectedItemKey] ?? 0;

    return (
        <motion.div 
            key={selectedItemKey}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 flex-1 flex flex-col justify-between min-h-[750px]"
        >
            {/* Live Collaboration Overlay */}
            {isLockedByOther && (
                <div className="absolute inset-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center animate-bounce">
                        <Users size={32} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white">الصنف قيد الجرد حالياً</h3>
                        <p className="text-xs font-bold text-slate-500 mt-1">الزميل <span className="text-amber-600">{lockerInfo?.userName}</span> يقوم بجرد هذا الصنف في الوقت الفعلي.</p>
                    </div>
                    <button 
                        onClick={onSkipLocked}
                        className="px-6 py-3 bg-slate-800 text-white rounded-2xl text-xs font-black hover:bg-slate-700 transition-all shadow-lg"
                    >
                        تجاوز الصنف والذهاب للتالي
                    </button>
                </div>
            )}

            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-2 max-w-[70%]">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-black rounded-lg">
                                {activeItem.sku}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-850 dark:text-white leading-tight">
                            {activeItem.name}
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={onUndo}
                            disabled={historyIndex <= 0}
                            className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl transition-all disabled:opacity-30"
                        >
                            <Undo size={20} />
                        </button>
                        <button 
                            onClick={onRedo}
                            disabled={historyIndex >= historyLength - 1}
                            className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl transition-all disabled:opacity-30"
                        >
                            <Redo size={20} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Visual Photo Slot */}
                    <div className="relative aspect-video rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center">
                        {itemPhotos[selectedItemKey] ? (
                            <>
                                <img 
                                    src={itemPhotos[selectedItemKey]} 
                                    alt="Product" 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                                <button 
                                    onClick={() => onPhotoCapture(null)}
                                    className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        ) : (
                            <label className="cursor-pointer flex flex-col items-center gap-2 text-slate-400">
                                <Camera size={32} />
                                <span className="text-[10px] font-black">اضغط لتصوير الصنف أو الرف</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment"
                                    className="hidden" 
                                    onChange={(e) => onPhotoCapture(e.target.files?.[0] || null)}
                                />
                            </label>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-black text-slate-400 block mb-3">ملاحظات الجرد</span>
                            <div className="relative">
                                <textarea 
                                    value={itemNotes[selectedItemKey] || ''}
                                    onChange={(e) => onNoteChange(e.target.value)}
                                    placeholder="أضف ملاحظات عن حالة المنتج أو الرف..."
                                    className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-600 dark:text-slate-300 min-h-[80px] resize-none"
                                />
                                <button 
                                    onClick={onVoiceInput}
                                    className={`absolute bottom-0 left-0 p-2 rounded-xl transition-all ${
                                        isListening && activeVoiceField === selectedItemKey 
                                            ? 'bg-rose-500 text-white animate-pulse' 
                                            : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                    }`}
                                >
                                    <Mic size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Big Counter Interface */}
                <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-10">
                    <div className="flex flex-col items-center text-center space-y-2">
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">الكمية الفعلية المكتشفة</span>
                        <div className="relative group">
                            <input 
                                type="number" 
                                value={count}
                                onChange={(e) => onSetCount(parseInt(e.target.value) || 0)}
                                className="text-8xl font-black text-slate-850 dark:text-white bg-transparent border-none text-center focus:ring-0 font-mono w-[300px]"
                            />
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-indigo-600 rounded-full opacity-50 group-hover:opacity-100 transition-all"></div>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <button 
                            onClick={() => onAdjustCount(-1)}
                            className="w-20 h-20 bg-white dark:bg-slate-850 border-4 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-200 rounded-3xl flex items-center justify-center transition-all active:scale-90 shadow-sm"
                        >
                            <Minus size={32} strokeWidth={3} />
                        </button>

                        <div className="flex flex-col items-center gap-3">
                            <button 
                                onClick={() => onAdjustCount(1)}
                                className="w-32 h-32 bg-indigo-600 text-white rounded-[40px] flex items-center justify-center transition-all active:scale-95 shadow-xl shadow-indigo-600/30 hover:bg-indigo-700"
                            >
                                <Plus size={48} strokeWidth={4} />
                            </button>
                        </div>

                        <button 
                            onClick={() => onAdjustCount(5)}
                            className="w-20 h-20 bg-white dark:bg-slate-850 border-4 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-indigo-500 hover:border-indigo-200 rounded-3xl flex items-center justify-center transition-all active:scale-90 shadow-sm"
                        >
                            <div className="flex flex-col items-center">
                                <Plus size={24} strokeWidth={3} />
                                <span className="text-xs font-black">5</span>
                            </div>
                        </button>
                    </div>

                    <div className="flex gap-4">
                         {[10, 20, 50].map(val => (
                            <button 
                                key={val}
                                onClick={() => onAdjustCount(val)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 text-slate-600 rounded-2xl text-xs font-black transition-all active:scale-95"
                            >
                                +{val}
                            </button>
                         ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center justify-center gap-2 bg-slate-850 text-white p-5 rounded-3xl text-sm font-black hover:bg-black transition-all shadow-xl active:scale-95">
                    <CheckCircle size={20} />
                    حفظ والانتقال للصنف التالي
                </button>
                <div className="grid grid-cols-2 gap-2">
                    <button className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 p-4 rounded-3xl text-[10px] font-black hover:bg-emerald-100 transition-all flex flex-col items-center justify-center gap-1">
                        <Smartphone size={16} />
                        جرد سريع (Express)
                    </button>
                    <button className="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 p-4 rounded-3xl text-[10px] font-black hover:bg-rose-100 transition-all flex flex-col items-center justify-center gap-1">
                        <AlertCircle size={16} />
                        إبلاغ عن عجز
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default React.memo(CounterWorkspace);
