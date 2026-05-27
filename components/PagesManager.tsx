
import React, { useState } from 'react';
import { Settings, CustomPage } from '../types';
import { FileText, Plus, Edit3, Trash2, Globe, Save } from 'lucide-react';

interface PagesManagerProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const PagesManager: React.FC<PagesManagerProps> = ({ settings, setSettings }) => {
  const [editingPage, setEditingPage] = useState<Partial<CustomPage> | null>(null);

  const handleSave = () => {
      if (!editingPage?.title || !editingPage?.content) return;
      
      const newPage: CustomPage = {
          id: editingPage.id || Date.now().toString(),
          title: editingPage.title,
          slug: editingPage.title.toLowerCase().replace(/ /g, '-'),
          content: editingPage.content,
          isActive: true
      };

      if (editingPage.id) {
          setSettings(prev => ({
              ...prev,
              customPages: prev.customPages.map(p => p.id === editingPage.id ? newPage : p)
          }));
      } else {
          setSettings(prev => ({
              ...prev,
              customPages: [...prev.customPages, newPage]
          }));
      }
      setEditingPage(null);
  };

  const deletePage = (id: string) => {
      if(!window.confirm("حذف هذه الصفحة؟")) return;
      setSettings(prev => ({
          ...prev,
          customPages: prev.customPages.filter(p => p.id !== id)
      }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl"><FileText size={28} /></div>
            <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">إدارة الصفحات</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">أنشئ صفحات تعريفية لمتجرك (من نحن، سياسة الاستبدال...).</p>
            </div>
        </div>
        {!editingPage && (
            <button onClick={() => setEditingPage({})} className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition-all">
                <Plus size={20}/> صفحة جديدة
            </button>
        )}
      </div>

      {editingPage ? (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in zoom-in-95">
              <h3 className="font-bold text-lg mb-4 dark:text-white">{editingPage.id ? 'تعديل الصفحة' : 'صفحة جديدة'}</h3>
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">عنوان الصفحة</label>
                      <input type="text" value={editingPage.title || ''} onChange={e => setEditingPage({...editingPage, title: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" placeholder="مثلاً: سياسة الاسترجاع" />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">المحتوى</label>
                      <textarea value={editingPage.content || ''} onChange={e => setEditingPage({...editingPage, content: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl h-64" placeholder="اكتب محتوى الصفحة هنا..." />
                  </div>
                  <div className="flex gap-3">
                      <button onClick={handleSave} className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 flex items-center justify-center gap-2"><Save size={18}/> حفظ الصفحة</button>
                      <button onClick={() => setEditingPage(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold">إلغاء</button>
                  </div>
              </div>
          </div>
      ) : (
          <div className="grid gap-4">
              {settings.customPages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">لا توجد صفحات مضافة.</div>
              ) : (
                  settings.customPages.map(page => (
                      <div key={page.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"><Globe size={20}/></div>
                              <div>
                                  <h4 className="font-bold text-slate-800 dark:text-white">{page.title}</h4>
                                  <p className="text-xs text-slate-400 mt-0.5">/{page.slug}</p>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => setEditingPage(page)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit3 size={18}/></button>
                              <button onClick={() => deletePage(page.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={18}/></button>
                          </div>
                      </div>
                  ))
              )}
          </div>
      )}
    </div>
  );
};

export default PagesManager;
