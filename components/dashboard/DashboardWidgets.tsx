import React from 'react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  X, 
  Plus, 
  Settings2,
  TrendingUp,
  Package,
  AlertTriangle,
  Users2,
  Layers,
  Sparkles,
  PieChart as ChartIcon,
  Lightbulb,
  DollarSign
} from 'lucide-react';

export interface DashboardWidget {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  visible: boolean;
  type: 'full' | 'half';
}

interface WidgetWrapperProps {
  widget: DashboardWidget;
  isEditing: boolean;
  onToggleVisibility: (id: string) => void;
  children: React.ReactNode;
}

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ 
  widget, 
  isEditing, 
  onToggleVisibility,
  children 
}) => {
  const dragControls = useDragControls();

  if (!widget.visible && !isEditing) return null;

  return (
    <Reorder.Item
      value={widget}
      id={widget.id}
      dragListener={false}
      dragControls={dragControls}
      className={`relative ${widget.type === 'full' ? 'col-span-full' : 'col-span-1'} ${!widget.visible ? 'opacity-50 grayscale' : ''}`}
    >
      {isEditing && (
        <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
          <button
            onPointerDown={(e) => dragControls.start(e)}
            className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing text-slate-400 hover:text-primary transition-colors"
          >
            <GripVertical size={18} />
          </button>
          <button
            onClick={() => onToggleVisibility(widget.id)}
            className={`p-2 rounded-xl shadow-lg border transition-colors ${
              widget.visible 
                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary' 
                : 'bg-primary text-white border-primary'
            }`}
          >
            {widget.visible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>
      )}
      <div className="h-full">
        {children}
      </div>
    </Reorder.Item>
  );
};

export const DashboardManager: React.FC<{
  isEditing: boolean;
  onToggleEditing: () => void;
  widgets: DashboardWidget[];
  onAddWidget: (id: string) => void;
}> = ({ isEditing, onToggleEditing, widgets, onAddWidget }) => {
  return (
    <div className="flex items-center gap-3 mb-8">
      <button
        onClick={onToggleEditing}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm transition-all ${
          isEditing 
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
            : 'glass-card text-slate-600 dark:text-slate-300 hover:bg-white/50'
        }`}
      >
        <Settings2 size={18} />
        <span>{isEditing ? 'حفظ التنسيق' : 'تخصيص الواجهة'}</span>
      </button>

      {isEditing && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {widgets.filter(w => !w.visible).map(w => (
            <button
              key={w.id}
              onClick={() => onAddWidget(w.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary transition-all whitespace-nowrap"
            >
              <Plus size={14} />
              {w.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
