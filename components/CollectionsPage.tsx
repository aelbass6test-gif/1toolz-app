import React, { useState } from 'react';
import { Settings, Collection } from '../types';
import { Grid3x3, Plus, Trash2, Edit3, Image as ImageIcon, X } from 'lucide-react';

interface CollectionsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const CollectionsPage: React.FC<CollectionsPageProps> = ({ settings, setSettings }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [formData, setFormData] = useState<Partial<Collection>>({ name: '', description: '', image: '' });

  const handleModalSave = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name) return;

      const newCollection: Collection = {
          id: editingCollection ? editingCollection.id : Date.now().toString(),
          name: formData.name,
          description: formData.description,
          image: formData.image
      };

      if (editingCollection) {
          setSettings(prev => ({
              ...prev,
              collections: prev.collections.map(c => c.id === editingCollection.id ? newCollection : c)
          }));
      } else {
          setSettings(prev => ({
              ...prev,
              collections: [...prev.collections, newCollection]
          }));
      }
      
      handleClose();
  };

  const handleEdit = (collection: Collection) => {
      setEditingCollection(collection);
      setFormData(collection);
      setShowModal(true);
  };

  const handleDelete = (id: string) => {
      if(!window.confirm("هل أنت متأكد من حذف هذا القسم؟ لن يتم حذف المنتجات، ولكن سيتم فك ربطها.")) return;
      
      setSettings(prev => ({
          ...prev,
          collections: prev.collections.filter(c => c.id !== id),
          // Unlink products
          products: prev.products.map(p => p.collectionId === id ? { ...p, collectionId: undefined } : p)
      }));
  };

  const handleClose = () => {
      setShowModal(false);
      setEditingCollection(null);
      setFormData({ name: '', description: '', image: '' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl"><Grid3x3 size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">مجموعات المنتجات</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">نظم منتجاتك في أقسام (مثل: رجالي، إلكترونيات) لتسهيل التصفح.</p>
                </div>
            </div>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all"><Plus size={20}/> إضافة مجموعة</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(settings.collections || []).map(collection => (
                <div key={collection.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
                    <div className="h-32 bg-slate-100 dark:bg-slate-800 relative">
                        {collection.image ? (
                            <img src={collection.image} alt={collection.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><ImageIcon size={32}/></div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(collection)} className="p-2 bg-white/90 dark:bg-slate-900/90 text-blue-600 rounded-lg hover:text-blue-700"><Edit3 size={16}/></button>
                            <button onClick={() => handleDelete(collection.id)} className="p-2 bg-white/90 dark:bg-slate-900/90 text-red-500 rounded-lg hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    <div className="p-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{collection.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{collection.description || 'لا يوجد وصف'}</p>
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-bold">
                            {settings.products.filter(p => p.collectionId === collection.id).length} منتجات
                        </div>
                    </div>
                </div>
            ))}
            {settings.collections.length === 0 && (
                <div className="md:col-span-3 text-center py-12 text-slate-400">لا توجد مجموعات مضافة.</div>
            )}
        </div>

        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 animate-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold dark:text-white">{editingCollection ? 'تعديل المجموعة' : 'مجموعة جديدة'}</h3>
                        <button onClick={handleClose}><X className="text-slate-400"/></button>
                    </div>
                    <form onSubmit={handleModalSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">اسم المجموعة</label>
                            <input type="text" required placeholder="مثلاً: ملابس شتوية" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">رابط الصورة (اختياري)</label>
                            <input type="text" placeholder="https://..." className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl dir-ltr text-right" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">الوصف</label>
                            <textarea placeholder="وصف قصير للقسم..." className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-24" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                        </div>
                        <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">حفظ</button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default CollectionsPage;
