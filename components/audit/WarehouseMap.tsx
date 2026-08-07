import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';

interface WarehouseMapProps {
    items: any[];
    counts: Record<string, number>;
    onZoneSelect: (zone: string) => void;
    activeZone: string;
}

export default function WarehouseMap({ items, counts, onZoneSelect, activeZone }: WarehouseMapProps) {
    // Generate a simple heatmap based on counts
    const zoneStats = useMemo(() => {
        const stats: Record<string, { total: number, counted: number, id: string }> = {
            'A': { total: 0, counted: 0, id: 'زون أ' },
            'B': { total: 0, counted: 0, id: 'زون ب' },
            'C': { total: 0, counted: 0, id: 'زون ج' },
            'D': { total: 0, counted: 0, id: 'زون د' },
        };

        items.forEach((item, index) => {
            const key = item.variantId ? `${item.productId}_${item.variantId}` : item.productId;
            const alphabet = ['A', 'B', 'C', 'D'];
            const zoneCode = alphabet[index % 4];
            stats[zoneCode].total++;
            if (counts[key] !== undefined) {
                stats[zoneCode].counted++;
            }
        });

        return stats;
    }, [items, counts]);

    return (
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <MapPin size={16} />
                خريطة المستودع التفاعلية (Heatmap)
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
                {Object.entries(zoneStats).map(([code, data]) => {
                    const progress = data.total > 0 ? (data.counted / data.total) * 100 : 0;
                    const isSelected = activeZone.includes(data.id);
                    
                    return (
                        <button
                            key={code}
                            onClick={() => onZoneSelect(data.id)}
                            className={`relative overflow-hidden p-4 rounded-xl border text-right transition-all cursor-pointer ${
                                isSelected 
                                    ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' 
                                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                            }`}
                        >
                            <div 
                                className={`absolute inset-0 opacity-10 transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${progress}%` }} 
                            />
                            
                            <div className="relative z-10 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-black text-sm text-slate-800 dark:text-white">{data.id}</span>
                                    <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-800">
                                        {Math.round(progress)}%
                                    </span>
                                </div>
                                <div className="text-[10px] font-bold text-slate-400">
                                    مكتمل {data.counted} من {data.total}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="text-[9px] text-slate-400 font-bold text-center">
                مؤشر حراري: الألوان تتقدم مع الجرد، اضغط على الزون للتصفية السريعة
            </div>
        </div>
    );
}
