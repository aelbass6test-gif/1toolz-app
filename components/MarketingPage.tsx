
import React, { useState } from 'react';
import { Settings, Product } from '../types';
import { Megaphone, Wand2, Package, Users, RefreshCw, Copy } from 'lucide-react';
import { generateAdCopy } from '../services/geminiService';

interface MarketingPageProps {
  settings: Settings;
}

const MarketingPage: React.FC<MarketingPageProps> = ({ settings }) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(settings.products[0]?.id || '');
  const [targetAudience, setTargetAudience] = useState<string>('الشباب, مهتمين بالموضة, سكان القاهرة');
  const [adCopy, setAdCopy] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    const product = settings.products.find(p => p.id === selectedProductId);
    if (!product) return;
    
    setIsLoading(true);
    setAdCopy('');
    const result = await generateAdCopy(product.name, targetAudience);
    setAdCopy(result);
    setIsLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('تم نسخ النص!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl"><Megaphone size={28} /></div>
        <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white">مساعد التسويق الذكي</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">أنشئ نصوص إعلانية لمنصات التواصل الاجتماعي في ثوانٍ.</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2"><Package size={16}/> اختر المنتج</label>
            <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-rose-500">
                {settings.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2"><Users size={16}/> صف الجمهور المستهدف</label>
            <input type="text" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
        </div>
        <button onClick={handleGenerate} disabled={isLoading || !selectedProductId} className="w-full mt-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:bg-slate-400">
          {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Wand2 size={18}/>}
          {isLoading ? 'جاري الكتابة...' : 'اكتب نصوص إعلانية'}
        </button>
      </div>
      
      {adCopy && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative group animate-in fade-in-5 duration-300">
            <button onClick={() => copyToClipboard(adCopy)} className="absolute top-4 left-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100">
                <Copy size={16}/>
            </button>
            <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">النماذج الإعلانية المقترحة:</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                {adCopy}
            </div>
        </div>
      )}
    </div>
  );
};

export default MarketingPage;
