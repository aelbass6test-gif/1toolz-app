import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, AlertCircle, MapPin, Users, Trophy, Activity
} from 'lucide-react';
import { motion } from 'motion/react';
// collaboration hook moved to parent WarehouseSubmitPage
import WarehouseMap from './WarehouseMap';
import { offlineDb } from '../../src/utils/offlineEngine';
import { SharedAudit, SharedAuditPresence } from '../../types';
import AuditItemCard from './AuditItemCard';
import CounterWorkspace from './CounterWorkspace';

interface SharedCountingExperienceProps {
    audit: SharedAudit;
    counts: Record<string, number>;
    setCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    itemNotes: Record<string, string>;
    setItemNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    itemPhotos: Record<string, string>;
    setItemPhotos: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    onPhotoCapture: (key: string, file: File | null) => void;
    onStartScanner: () => void;
    speak: (text: string) => void;
    activeZone?: string;
    setActiveZone?: React.Dispatch<React.SetStateAction<string>>;
    triggerHaptic?: () => void;
    isListening?: boolean;
    activeVoiceField?: string | null;
    handleVoiceInput?: (key: string, field: 'count' | 'notes') => void;
    showSystemQty?: boolean;
    collaboration: any; // Added prop for shared state
}

type CountMode = 'standard' | 'blind' | 'express' | 'cycle' | 'location' | 'double' | 'supervisor';

export default function SharedCountingExperience({
    audit,
    counts,
    setCounts,
    itemNotes,
    setItemNotes,
    itemPhotos,
    setItemPhotos,
    onPhotoCapture,
    onStartScanner,
    speak,
    activeZone,
    setActiveZone,
    triggerHaptic: propTriggerHaptic,
    showSystemQty,
    collaboration
}: SharedCountingExperienceProps) {
    const items: any[] = useMemo(() => {
        return Array.isArray(audit?.items) ? audit.items : (audit?.items && typeof audit.items === 'object' ? Object.values(audit.items) : []);
    }, [audit?.items]);

    const [selectedItemKey, setSelectedItemKey] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [localFilter, setLocalFilter] = useState<'all' | 'uncounted' | 'discrepancy' | 'matched'>('all');
    const [countMode, setCountMode] = useState<CountMode>((audit.protocol as CountMode) || (audit.isBlindCount ? 'blind' : 'standard'));
    const isProtocolLocked = audit.isProtocolLocked ?? !!audit.protocol;
    
    const [selectedLocationZone, setSelectedLocationZone] = useState<string>('all');
    const [history, setHistory] = useState<Record<string, number>[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    const [isListening, setIsListening] = useState(false);
    const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
    const [displayLimit, setDisplayLimit] = useState(30);

    const { 
        collaborators, 
        broadcastPresence, 
        lockItem, 
        unlockItem, 
        isLockedByOther, 
        getLockerInfo, 
        auditData 
    } = collaboration;

    const [accuracyScore, setAccuracyScore] = useState(100);
    const [comboMultiplier, setComboMultiplier] = useState(1);

    const triggerHaptic = () => {
        if (propTriggerHaptic) {
            propTriggerHaptic();
            return;
        }
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    };

    const userAssignments = useMemo(() => {
        return (auditData?.assignments || []).filter(a => a.userId === (audit.managerId || 'anonymous'));
    }, [auditData, audit.managerId]);

    const itemZoneMap = useMemo(() => {
        const zones: Record<string, string> = {};
        items.forEach((item, index) => {
            const key = (item as any).variantId ? `${(item as any).productId}_${(item as any).variantId}` : (item as any).productId;
            const alphabet = ['أ', 'ب', 'ج', 'د'];
            const shelf = (index % 4) + 1;
            const rack = (index % 3) + 1;
            zones[key] = `زون ${alphabet[index % 4]} - رف ${shelf} / رصيف ${rack}`;
        });
        return zones;
    }, [items]);

    const isAssignedToUser = (item: any) => {
        if (userAssignments.length === 0) return true;
        return userAssignments.some(a => {
            const key = (item as any).variantId ? `${(item as any).productId}_${(item as any).variantId}` : (item as any).productId;
            if (a.scopeType === 'zone') return item.zone === a.scopeValue || itemZoneMap[key]?.includes(a.scopeValue);
            if (a.scopeType === 'category') return item.category === a.scopeValue;
            if (a.scopeType === 'warehouse') return true;
            return false;
        });
    };

    useEffect(() => {
        const lastKey = localStorage.getItem(`audit_last_item_${audit.id}`);
        if (lastKey) {
            setSelectedItemKey(lastKey);
        } else if (items.length > 0 && !selectedItemKey) {
            const first = items[0];
            const key = first.variantId ? `${first.productId}_${first.variantId}` : first.productId;
            setSelectedItemKey(key);
        }
    }, [audit.id, items]);

    useEffect(() => {
        if (selectedItemKey) {
            localStorage.setItem(`audit_last_item_${audit.id}`, selectedItemKey);
            broadcastPresence(selectedItemKey);
            const productId = selectedItemKey.split('_')[0];
            if (!isLockedByOther(productId)) {
                lockItem(productId);
            }
        }
    }, [selectedItemKey, audit.id, broadcastPresence, lockItem, isLockedByOther]);

    const pushHistory = (newCounts: Record<string, number>) => {
        const nextHistory = history.slice(0, historyIndex + 1);
        nextHistory.push({ ...newCounts });
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            setHistoryIndex(prevIndex);
            setCounts(history[prevIndex]);
            triggerHaptic();
            speak('تم التراجع عن آخر حركة');
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            setCounts(history[nextIndex]);
            triggerHaptic();
            speak('تمت الإعادة');
        }
    };

    const handleVoiceInput = (itemKey: string) => {
        if (isListening) {
            setIsListening(false);
            setActiveVoiceField(null);
            return;
        }

        triggerHaptic();
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            speak('تفضل بالإملاء الصوتي الآن');
            setIsListening(true);
            setActiveVoiceField(itemKey);
            const recognition = new SpeechRecognition();
            recognition.lang = 'ar-SA';
            recognition.interimResults = false;
            
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setItemNotes(prev => ({
                    ...prev,
                    [itemKey]: (prev[itemKey] ? prev[itemKey] + ' ' : '') + transcript
                }));
                speak('تم حفظ الإملاء الصوتي بنجاح');
                setIsListening(false);
                setActiveVoiceField(null);
            };

            recognition.onerror = () => {
                speak('لم أتمكن من سماعك بوضوح');
                setIsListening(false);
                setActiveVoiceField(null);
            };

            recognition.start();
        } else {
            alert('متصفحك الحالي لا يدعم الإملاء الصوتي.');
        }
    };

    const activeItem = useMemo(() => {
        return items.find((item: any) => {
            const key = (item as any).variantId ? `${(item as any).productId}_${(item as any).variantId}` : (item as any).productId;
            return key === selectedItemKey;
        });
    }, [items, selectedItemKey]);

    const filteredItems = useMemo(() => {
        return items.filter((item: any) => {
            const key = (item as any).variantId ? `${(item as any).productId}_${(item as any).variantId}` : (item as any).productId;
            const name = (item as any).name || '';
            const sku = (item as any).sku || '';
            
            const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  sku.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;
            if (!isAssignedToUser(item)) return false;
            if (countMode === 'location' && selectedLocationZone !== 'all') {
                if (itemZoneMap[key] !== selectedLocationZone) return false;
            }

            const isCounted = counts[key] !== undefined;
            if (localFilter === 'uncounted') return !isCounted;
            if (localFilter === 'discrepancy') return isCounted && counts[key] !== (item as any).systemQty;
            if (localFilter === 'matched') return isCounted && counts[key] === (item as any).systemQty;
            
            return true;
        });
    }, [audit, counts, searchQuery, localFilter, countMode, selectedLocationZone, itemZoneMap]);

    const displayedItems = useMemo(() => {
        return filteredItems.slice(0, displayLimit);
    }, [filteredItems, displayLimit]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const currentIndex = filteredItems.findIndex((item: any) => {
                    const key = (item as any).variantId ? `${(item as any).productId}_${(item as any).variantId}` : (item as any).productId;
                    return key === selectedItemKey;
                });
                if (currentIndex === -1) return;

                let nextIndex = currentIndex;
                if (e.key === 'ArrowUp' && currentIndex > 0) nextIndex = currentIndex - 1;
                if (e.key === 'ArrowDown' && currentIndex < filteredItems.length - 1) nextIndex = currentIndex + 1;

                if (nextIndex !== currentIndex) {
                    e.preventDefault();
                    const nextItem = filteredItems[nextIndex];
                    const nextKey = nextItem.variantId ? `${nextItem.productId}_${nextItem.variantId}` : nextItem.productId;
                    setSelectedItemKey(nextKey);
                    triggerHaptic();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredItems, selectedItemKey]);

    const adjustCount = async (amount: number) => {
        if (!selectedItemKey) return;
        triggerHaptic();
        
        const currentVal = counts[selectedItemKey] ?? 0;
        const nextVal = Math.max(0, currentVal + amount);
        
        const nextCounts = { ...counts, [selectedItemKey]: nextVal };
        setCounts(nextCounts);
        pushHistory(nextCounts);

        if (activeItem) {
            speak(`العدد الحالي لـ ${activeItem.name} أصبح ${nextVal}`);
            if (nextVal === activeItem.systemQty) {
                setComboMultiplier(prev => prev + 1);
            } else {
                setComboMultiplier(1);
            }
        }

        try {
            await offlineDb.actions.add({
                auditId: audit.id,
                itemKey: selectedItemKey,
                action: 'count',
                value: nextVal,
                timestamp: Date.now(),
                synced: false,
                userId: audit.managerName || 'current_user'
            });
        } catch (error) {
            console.error('Failed to save to offline engine', error);
        }
    };

    return (
        <div id="shared-counting-experience" className="space-y-6 dir-rtl text-right">
            <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2 overflow-hidden rtl:space-x-reverse">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black text-white z-10">
                            {audit.managerName?.slice(0, 1) || 'U'}
                        </div>
                        {collaborators.map(c => (
                            <motion.div 
                                initial={{ scale: 0, x: 10 }}
                                animate={{ scale: 1, x: 0 }}
                                key={c.userId} 
                                className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black text-white"
                                style={{ backgroundColor: `hsl(${c.userId.charCodeAt(0) % 360}, 70%, 50%)` }}
                                title={c.userName}
                            >
                                {c.userName.slice(0, 1)}
                            </motion.div>
                        ))}
                    </div>
                    <div className="text-[10px] font-black text-slate-500 flex items-center gap-2">
                        <Users size={12} className="text-indigo-500" />
                        {collaborators.length + 1} نشطين
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-[10px] font-black text-indigo-600 dark:text-indigo-400 shadow-sm flex items-center gap-1.5">
                        <Activity size={12} />
                        Progress: {Math.round((Object.keys(counts).length / Math.max(1, items.length)) * 100)}%
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl overflow-x-auto">
                <div className="flex gap-1.5 min-w-max">
                    {[
                        { id: 'standard', label: 'العد القياسي 📝' },
                        { id: 'blind', label: 'جرد أعمى 🔒' },
                        { id: 'express', label: 'عد سريع ⚡' },
                        { id: 'cycle', label: 'دوري مبرمج 🔄' },
                        { id: 'location', label: 'عد بالموقع 📍' },
                        { id: 'double', label: 'عد مزدوج 👥' },
                        { id: 'supervisor', label: 'تدقيق المشرف 👤' }
                    ].map(mode => (
                        <button
                            key={mode.id}
                            disabled={isProtocolLocked && countMode !== mode.id}
                            onClick={() => {
                                if (isProtocolLocked) return;
                                triggerHaptic();
                                setCountMode(mode.id as CountMode);
                                speak(`تم التبديل إلى ${mode.label}`);
                            }}
                            className={`p-2 px-4 rounded-xl text-right transition-all border ${
                                countMode === mode.id
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                                    : isProtocolLocked 
                                        ? 'bg-slate-100 dark:bg-slate-800/40 border-transparent text-slate-400 grayscale'
                                        : 'bg-white hover:bg-slate-100 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            <span className="text-[10px] font-black whitespace-nowrap">{mode.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-4 flex flex-col h-[750px]">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3 shrink-0">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="ابحث باسم المنتج أو الـ SKU..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-150 dark:border-slate-700 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                            />
                            <Search className="absolute right-3.5 top-3 text-slate-400" size={16} />
                        </div>

                        {countMode === 'location' && (
                            <WarehouseMap 
                                items={items}
                                counts={counts}
                                activeZone={selectedLocationZone}
                                onZoneSelect={setSelectedLocationZone}
                            />
                        )}

                        <div className="flex flex-wrap gap-1">
                            <button onClick={() => setLocalFilter('all')} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${localFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500'}`}>
                                الكل ({items.length})
                            </button>
                            <button onClick={() => setLocalFilter('uncounted')} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${localFilter === 'uncounted' ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-500'}`}>
                                متبقي
                            </button>
                            <button onClick={() => setLocalFilter('discrepancy')} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${localFilter === 'discrepancy' ? 'bg-rose-500 text-white' : 'bg-slate-50 text-slate-500'}`}>
                                فروقات
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-2 space-y-1">
                        {displayedItems.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 text-xs font-bold">
                                <AlertCircle className="mx-auto mb-2" size={32} />
                                <p>لا يوجد منتجات تطابق الفلتر</p>
                            </div>
                        ) : (
                            <>
                                {displayedItems.map((item: any) => {
                                    const key = (item as any).variantId ? `${(item as any).productId}_${(item as any).variantId}` : (item as any).productId;
                                    return (
                                        <AuditItemCard
                                            key={key}
                                            item={item}
                                            itemKey={key}
                                            isSelected={key === selectedItemKey}
                                            isCounted={counts[key] !== undefined}
                                            countValue={counts[key]}
                                            diff={counts[key] !== undefined ? counts[key] - (item as any).systemQty : 0}
                                            zone={itemZoneMap[key] || 'رف عام'}
                                            showSystemExpected={countMode !== 'blind'}
                                            lockerInfo={getLockerInfo(key)}
                                            isLockedByOther={isLockedByOther(key)}
                                            onSelect={(k) => setSelectedItemKey(k)}
                                        />
                                    );
                                })}
                                {filteredItems.length > displayLimit && (
                                    <button 
                                        onClick={() => setDisplayLimit(prev => prev + 50)}
                                        className="w-full py-4 text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl border border-dashed border-slate-200 dark:border-slate-800 mt-2"
                                    >
                                        تحميل المزيد من الأصناف ({filteredItems.length - displayLimit} متبقي)
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-7 flex flex-col gap-6">
                    <div className="bg-indigo-600 rounded-2xl p-4 text-white flex justify-between items-center shadow-lg">
                        <div className="flex items-center gap-3">
                            <Trophy size={20} className="text-yellow-300" />
                            <div>
                                <h4 className="font-black text-sm">بطل الجرد الميداني</h4>
                                <p className="text-[10px] text-indigo-100">دقة متناهية وسرعة في التسجيل</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-indigo-200 block">Combo</span>
                                <span className="font-mono font-black text-lg text-yellow-300">x{comboMultiplier}</span>
                            </div>
                        </div>
                    </div>

                    <CounterWorkspace
                        activeItem={activeItem}
                        selectedItemKey={selectedItemKey}
                        counts={counts}
                        itemNotes={itemNotes}
                        itemPhotos={itemPhotos}
                        isLockedByOther={isLockedByOther(selectedItemKey)}
                        lockerInfo={getLockerInfo(selectedItemKey)}
                        countMode={countMode}
                        showSystemQty={showSystemQty || false}
                        accuracyScore={accuracyScore}
                        comboMultiplier={comboMultiplier}
                        historyIndex={historyIndex}
                        historyLength={history.length}
                        isListening={isListening}
                        activeVoiceField={activeVoiceField}
                        onAdjustCount={adjustCount}
                        onSetCount={(val) => {
                            const nextCounts = { ...counts, [selectedItemKey]: val };
                            setCounts(nextCounts);
                            pushHistory(nextCounts);
                        }}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        onPhotoCapture={(file) => onPhotoCapture(selectedItemKey, file)}
                        onVoiceInput={() => handleVoiceInput(selectedItemKey)}
                        onNoteChange={(text) => setItemNotes(prev => ({ ...prev, [selectedItemKey]: text }))}
                        onSkipLocked={() => {
                            const currentIndex = filteredItems.findIndex(i => {
                                const k = i.variantId ? `${i.productId}_${i.variantId}` : i.productId;
                                return k === selectedItemKey;
                            });
                            if (currentIndex !== -1 && currentIndex < filteredItems.length - 1) {
                                const nextItem = filteredItems[currentIndex + 1];
                                setSelectedItemKey(nextItem.variantId ? `${nextItem.productId}_${nextItem.variantId}` : nextItem.productId);
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
