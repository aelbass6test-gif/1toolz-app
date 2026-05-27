import React from 'react';
import { Edit3, Check, X } from 'lucide-react';

interface EditableFieldProps {
  icon?: React.ReactNode;
  label: string;
  isEditing: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  editComponent: React.ReactNode;
  displayComponent: React.ReactNode;
  className?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({
  icon,
  label,
  isEditing,
  disabled = false,
  onEdit,
  onSave,
  onCancel,
  editComponent,
  displayComponent,
  className = ''
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between items-center">
        <label className="text-xs text-slate-500 flex items-center gap-1">
          {icon} {label}
        </label>
        {!disabled && !isEditing && (
          <button onClick={onEdit} className="text-xs font-bold text-blue-600 hover:underline">
            تعديل
          </button>
        )}
      </div>
      
      {isEditing ? (
        <div className="space-y-2">
          {editComponent}
          <div className="flex gap-2">
            <button 
              onClick={onSave}
              className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold flex items-center gap-1 hover:bg-emerald-200"
            >
              <Check size={14}/> حفظ
            </button>
            <button 
              onClick={onCancel}
              className="px-3 py-1 bg-slate-100 text-slate-500 rounded text-xs font-bold flex items-center gap-1 hover:bg-slate-200"
            >
              <X size={14}/> إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
           {displayComponent}
        </div>
      )}
    </div>
  );
};

export default EditableField;
