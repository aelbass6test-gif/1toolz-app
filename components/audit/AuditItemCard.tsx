import React from 'react';
import { Users } from 'lucide-react';
import { SharedAuditItem, SharedAuditPresence } from '../../types';

interface AuditItemCardProps {
    item: SharedAuditItem;
    itemKey: string;
    isSelected: boolean;
    isCounted: boolean;
    countValue: number | undefined;
    diff: number;
    zone: string;
    showSystemExpected: boolean;
    lockerInfo: SharedAuditPresence | null;
    isLockedByOther: boolean;
    onSelect: (key: string) => void;
}

const AuditItemCard: React.FC<AuditItemCardProps> = ({
    item,
    itemKey,
    isSelected,
    isCounted,
    countValue,
    diff,
    zone,
    showSystemExpected,
    lockerInfo,
    isLockedByOther,
    onSelect
}) => {
    return (
        <button
            onClick={() => onSelect(itemKey)}
            className={`relative w-full text-right p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                isSelected 
                    ? 'bg-indigo-50/70 border-indigo-300 dark:bg-indigo-950/20 dark:border-indigo-800' 
                    : isLockedByOther
                    ? 'bg-amber-50/30 border-amber-200 dark:bg-amber-950/10'
                    : 'bg-white border-transparent hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850'
            }`}
        >
            {/* Lock Indicator */}
            {isLockedByOther && (
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-1.5 py-0.5 rounded text-[8px] font-black">
                    <Users size={10} />
                    <span>{lockerInfo?.userName}</span>
                </div>
            )}

            <div className="space-y-1 min-w-0 flex-1 mt-1">
                <h4 className={`font-black text-xs truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-300 font-extrabold' : 'text-slate-700 dark:text-slate-300'}`}>
                    {item.name}
                </h4>
                <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-400 font-mono">SKU: {item.sku}</span>
                    <span className="text-[9px] text-slate-400 font-bold bg-slate-50 dark:bg-slate-800 px-1 py-0.5 rounded">
                        {zone.split(' - ')[0]}
                    </span>
                </div>
            </div>

            {/* Counting status / values badges */}
            <div className="shrink-0 flex items-center gap-2">
                {isCounted ? (
                    <div className="flex items-center gap-1">
                        {showSystemExpected && diff !== 0 && (
                            <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md ${
                                diff > 0 
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' 
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}>
                                {diff > 0 ? `+${diff}` : diff}
                            </span>
                        )}
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs font-black rounded-lg">
                            {countValue} قطعة
                        </span>
                    </div>
                ) : (
                    <span className="px-2 py-1 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-500 text-[10px] font-black rounded-lg">
                        متبقي ⏳
                    </span>
                )}
            </div>
        </button>
    );
};

export default React.memo(AuditItemCard);
