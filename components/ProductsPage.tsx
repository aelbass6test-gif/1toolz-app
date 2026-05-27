import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Package, Plus, Trash2, Edit3, Save, XCircle, Search, AlertCircle, Barcode, DollarSign, Scale, Wallet, RefreshCw, ServerOff, Image as ImageIcon, CheckCircle, Clock, Download, Layers, Grid3x3, Wand2, FileText, Copy, ChevronsUpDown, Percent, Upload, FileUp, ListChecks, FileWarning, HandCoins, Info } from 'lucide-react';
import { Settings, Product, ProductVariant } from '../types';
import { motion, Variants } from 'framer-motion';
import { generateProductDescription, generateSocialMediaPost } from '../services/geminiService';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

interface ProductsPageProps {
  settings: Settings;
  setSettings: (updater: React.SetStateAction<Settings>) => void;
  activeStoreId: string | null;
  onRefresh?: () => void;
}

const ProductsPage: React.FC<ProductsPageProps> = React.memo(({ settings, setSettings, activeStoreId, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ sku: '', name: '', price: 0, weight: 1, costPrice: 0, stockQuantity: 10, collectionId: '', description: '', images: [], thumbnail: '', hasVariants: false, options: [], variants: [], profitMode: 'manual', profitPercentage: 0, basePrice: 0, commissionPercentage: 0 });
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string | null }>({ type: 'idle', message: null });
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    const saved = localStorage.getItem('lastProductSync');
    return saved ? new Date(saved) : null;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [generatedPost, setGeneratedPost] = useState('');
  
  // States for selective sync
  const [showSelectiveSyncModal, setShowSelectiveSyncModal] = useState(false);
  const [selectableProducts, setSelectableProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isFetchingSelectable, setIsFetchingSelectable] = useState(false);

  // States for the new import modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ products: Product[], errors: string[] } | null>(null);
  const [isParsingCsv, setIsParsingCsv] = useState(false);

  const isPlatformConnected = settings.integration?.platform !== 'none' || Object.values(settings.platformConfigs || {}).some((c: any) => c.isActive);

  const filteredProducts = settings.products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inventoryFinancials = useMemo(() => {
    let totalStock = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;

    (settings.products || []).forEach(p => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const qty = v.stockQuantity ?? v.stock ?? 0;
          const cost = v.costPrice ?? p.costPrice ?? 0;
          const price = v.price ?? p.price ?? 0;
          
          totalStock += qty;
          totalCostValue += qty * cost;
          totalSaleValue += qty * price;
        });
      } else {
        const qty = p.stockQuantity ?? p.stock ?? 0;
        const cost = p.costPrice ?? 0;
        const price = p.price ?? 0;

        totalStock += qty;
        totalCostValue += qty * cost;
        totalSaleValue += qty * price;
      }
    });

    const potentialProfit = totalSaleValue - totalCostValue;
    const marginPercent = totalSaleValue > 0 ? Math.round((potentialProfit / totalSaleValue) * 100) : 0;

    return {
      totalStock,
      totalCostValue,
      totalSaleValue,
      potentialProfit,
      marginPercent
    };
  }, [settings.products]);

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const productData = editingProduct || newProduct;

    if (!productData.name || (!productData.hasVariants && !productData.price)) {
        alert("يرجى إدخال اسم المنتج وسعره على الأقل.");
        return;
    }

    let finalStock = productData.stockQuantity === undefined ? null : productData.stockQuantity;
    if (productData.hasVariants && productData.variants) {
        finalStock = productData.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
    }
    
    const productToSave: Product = {
        id: productData.id || `prod-${Date.now()}`,
        sku: productData.sku || `SKU-${Date.now()}`,
        name: productData.name!,
        price: productData.price || 0,
        weight: productData.weight || 1,
        costPrice: productData.costPrice || 0,
        stockQuantity: finalStock,
        inStock: finalStock === null || finalStock > 0,
        collectionId: productData.collectionId || undefined,
        description: productData.description || '',
        images: productData.images || [],
        thumbnail: productData.thumbnail || '',
        hasVariants: productData.hasVariants || false,
        options: productData.hasVariants ? (productData.options || []) : [],
        variants: productData.hasVariants ? (productData.variants || []) : [],
        
        profitMode: productData.profitMode || 'manual',
        profitPercentage: productData.profitPercentage || 0,
        basePrice: productData.basePrice || 0,
        commissionPercentage: productData.commissionPercentage || 0,
        // Legacy support
        useProfitPercentage: productData.profitMode === 'margin',
    };
    
    if (editingProduct) {
        setSettings({ ...settings, products: settings.products.map(p => p.id === editingProduct.id ? productToSave : p) });
        setEditingProduct(null);
    } else {
        setSettings({ ...settings, products: [...settings.products, productToSave] });
        setIsAdding(false);
    }
  };

  const confirmDelete = () => {
    if (productToDelete) {
        setSettings({
            ...settings,
            products: settings.products.filter(p => p.id !== productToDelete.id)
        });
        setProductToDelete(null);
    }
  };

  const handleGenerateDescription = async (isEdit: boolean) => {
      const targetProduct = isEdit ? editingProduct : newProduct;
      if (!targetProduct?.name || !targetProduct?.price) {
          alert("يرجى إدخال اسم المنتج وسعره أولاً.");
          return;
      }
      setIsGenerating(true);
      const desc = await generateProductDescription(targetProduct.name, targetProduct.price);
      if (isEdit) {
          setEditingProduct(p => p ? { ...p, description: desc } : null);
      } else {
          setNewProduct(p => ({ ...p, description: desc }));
      }
      setIsGenerating(false);
  };
  
  const handleGeneratePost = async (product: Product) => {
    if (!product.name || !product.price) return;
    setIsGenerating(true);
    const post = await generateSocialMediaPost(product.name, product.description || '', product.price);
    setGeneratedPost(post);
    setShowPostModal(true);
    setIsGenerating(false);
  };

  const handleSync = async () => {
    // Check either the new platformConfigs or the legacy integration settings
    const wuiltConfig = settings.platformConfigs?.['wuilt'] || (settings.integration?.platform === 'wuilt' ? { ...settings.integration, isActive: true } : null);
    
    if (!wuiltConfig || !wuiltConfig.apiKey || wuiltConfig.isActive === false) {
      setSyncStatus({ type: 'error', message: 'بيانات الربط مع Wuilt غير مكتملة أو غير مفعلة. يرجى التحقق من إعدادات الربط في صفحة التطبيقات.' });
      return;
    }

    setIsSyncing(true);
    setSyncStatus({ type: 'idle', message: null });
    try {
      if (!activeStoreId) throw new Error('المتجر النشط غير محدد');
      
      const response = await fetch(`/api/sync/platform/wuilt/${activeStoreId}?type=products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'فشلت المزامنة');
      }

      if (result.items && result.items.length > 0) {
          setSettings(prev => {
              const existingMap = new Map(prev.products.map(p => [p.id, p]));
              result.items.forEach((item: any) => existingMap.set(item.id, item as Product));
              return { ...prev, products: Array.from(existingMap.values()) };
          });
      }
      
      const now = new Date();
      setLastSync(now);
      localStorage.setItem('lastProductSync', now.toISOString());

      setSyncStatus({ 
        type: 'success', 
        message: `تمت المزامنة بنجاح! تم معالجة ${result.processed} منتج (تم إضافة ${result.inserted} وتحديث ${result.updated}).` 
      });

      setTimeout(() => {
        setSyncStatus(s => s.type === 'success' ? { ...s, type: 'idle' } : s);
      }, 5000);
    } catch (error: any) {
      setSyncStatus({ type: 'error', message: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFetchSelectableProducts = async () => {
    const wuiltConfig = settings.platformConfigs?.['wuilt'] || (settings.integration?.platform === 'wuilt' ? { ...settings.integration, isActive: true } : null);

    if (!wuiltConfig || !wuiltConfig.apiKey || wuiltConfig.isActive === false) {
      alert('يرجى ضبط وتفعيل إعدادات الربط مع Wuilt أولاً من صفحة التطبيقات.');
      return;
    }

    setIsFetchingSelectable(true);
    setShowSelectiveSyncModal(true);
    try {
      if (!activeStoreId) throw new Error('المتجر النشط غير محدد');
      const response = await fetch(`/api/sync/platform/wuilt/${activeStoreId}/preview?type=products`);
      const text = await response.text();
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error(`[DEBUG] JSON parse error in ProductsPage. First 200 chars: ${text.substring(0, 200)}`);
        throw new Error('فشل جلب المنتجات: استجابة غير صالحة من السيرفر');
      }

      if (!response.ok) throw new Error(result.error || 'فشل جلب المنتجات');
      setSelectableProducts(result.items || []);
    } catch (error: any) {
      alert(error.message);
      setShowSelectiveSyncModal(false);
    } finally {
      setIsFetchingSelectable(false);
    }
  };

  const handleImportSelected = async () => {
    if (selectedProductIds.size === 0) {
      alert('يرجى اختيار منتج واحد على الأقل.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus({ type: 'idle', message: null });
    setShowSelectiveSyncModal(false);

    try {
      if (!activeStoreId) throw new Error('المتجر النشط غير محدد');
      
      const response = await fetch(`/api/sync/platform/wuilt/${activeStoreId}?type=products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          selectedIds: Array.from(selectedProductIds).map(id => id.replace('wuilt-', '')) 
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'فشلت المزامنة');

      if (result.items && result.items.length > 0) {
          setSettings(prev => {
              const existingMap = new Map(prev.products.map(p => [p.id, p]));
              result.items.forEach((item: any) => existingMap.set(item.id, item as Product));
              return { ...prev, products: Array.from(existingMap.values()) };
          });
      }
      
      setSyncStatus({ 
        type: 'success', 
        message: `تم استيراد ${result.processed} منتج بنجاح!` 
      });

      setSelectedProductIds(new Set());
    } catch (error: any) {
      setSyncStatus({ type: 'error', message: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['name', 'sku', 'price', 'costPrice', 'stockQuantity', 'weight', 'description', 'image_url'];
    const rows = filteredProducts.map(p => [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.price,
        p.costPrice,
        p.stockQuantity,
        p.weight,
        `"${(p.description || '').replace(/"/g, '""').replace(/\n/g, '\\n')}"`,
        `"${(p.images && p.images.length > 0 ? p.images.join('\n') : p.thumbnail || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseCsv = (file: File) => {
    setIsParsingCsv(true);
    setImportPreview(null);
    const reader = new FileReader();

    reader.onload = (event) => {
        const errors: string[] = [];
        const importedProducts: Product[] = [];
        try {
            const text = event.target?.result as string;
            
            // Robust CSV parser to handle newlines in quoted fields
            const parseCSV = (csvText: string) => {
                const result: string[][] = [];
                let row: string[] = [];
                let col = "";
                let inQuotes = false;
                for (let i = 0; i < csvText.length; i++) {
                    const char = csvText[i];
                    if (char === '"') {
                        if (inQuotes && i + 1 < csvText.length && csvText[i + 1] === '"') {
                            col += '"';
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === ',' && !inQuotes) {
                        row.push(col);
                        col = "";
                    } else if ((char === '\n' || char === '\r') && !inQuotes) {
                        row.push(col);
                        if (row.length > 0 && row.some(s => s.trim() !== "")) result.push(row);
                        row = [];
                        col = "";
                        if (char === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') i++;
                    } else {
                        col += char;
                    }
                }
                if (col || row.length > 0) {
                    row.push(col);
                    if (row.some(s => s.trim() !== "")) result.push(row);
                }
                return result;
            };

            const rows = parseCSV(text);
            
            if (rows.length < 2) {
                setImportPreview({ products: [], errors: ['الملف فارغ أو لا يحتوي على بيانات.'] });
                setIsParsingCsv(false);
                return;
            }

            const headerRow = rows[0].map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/"/g, '').replace(/_/g, ''));
            
            const headerMap: { [key: string]: number } = {};
            const fieldMap: { [csvHeader: string]: string } = {
                'productname': 'name', 'name': 'name',
                'price': 'price',
                'description': 'description',
                'imageurl': 'image_url', 'images': 'image_url'
            };

            headerRow.forEach((h, index) => {
                if (fieldMap[h]) {
                    headerMap[fieldMap[h]] = index;
                }
            });

            if (headerMap.name === undefined || headerMap.price === undefined) {
                 errors.push(`الأعمدة المطلوبة (name, price) غير موجودة. الأعمدة المكتشفة: ${headerRow.join(', ')}`);
            } else {
                for (let i = 1; i < rows.length; i++) {
                    const cells = rows[i];
                    
                    const name = cells[headerMap.name]?.trim() || '';
                    const priceStr = cells[headerMap.price]?.trim() || '';

                    if (!name) { errors.push(`الصف ${i + 1}: اسم المنتج مفقود.`); continue; }
                    if (!priceStr) { errors.push(`الصف ${i + 1}: سعر المنتج مفقود.`); continue; }

                    const price = parseFloat(priceStr);
                    if (isNaN(price)) { errors.push(`الصف ${i + 1}: السعر غير صالح.`); continue; }

                    let thumbnail = '';
                    let images: string[] = [];
                    const imageUrlIndex = headerMap['image_url'];
                    if (imageUrlIndex !== undefined && cells[imageUrlIndex]) {
                        const urls = cells[imageUrlIndex].split(/\r?\n/).map(u => u.trim()).filter(Boolean);
                        if (urls.length > 0) {
                            thumbnail = urls[0];
                            images = urls;
                        }
                    }

                    importedProducts.push({
                        id: `imported-${Date.now()}-${i}`,
                        name,
                        price,
                        description: headerMap.description !== undefined ? cells[headerMap.description] || '' : '',
                        thumbnail,
                        images,
                        sku: `SKU-${Date.now()}-${i}`,
                        costPrice: 0,
                        stockQuantity: 100, // Default stock
                        weight: 1, // Default weight
                        hasVariants: false, options: [], variants: [], inStock: true,
                    });
                }
            }
        } catch (err) {
            console.error(err);
            errors.push('حدث خطأ غير متوقع أثناء تحليل الملف.');
        } finally {
            setImportPreview({ products: importedProducts, errors });
            setIsParsingCsv(false);
        }
    };

    reader.onerror = () => {
      setImportPreview({ products: [], errors: ['لا يمكن قراءة الملف.'] });
      setIsParsingCsv(false);
    };

    reader.readAsText(file, 'UTF-8');
  };
  
  const handleConfirmImport = () => {
    if (!importPreview || importPreview.products.length === 0) return;

    setSettings(prev => ({
        ...prev,
        products: [...prev.products, ...importPreview.products]
    }));

    setIsImportModalOpen(false);
    setImportPreview(null);
    
    setSyncStatus({ type: 'success', message: `تم استيراد ${importPreview.products.length} منتج بنجاح!` });
    setTimeout(() => setSyncStatus(s => s.type === 'success' ? { ...s, type: 'idle' } : s), 5000);
  };
  
  const handleDownloadTemplate = () => {
    const headers = ['product_name', 'price', 'description', 'image_url'];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "product_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openAddModal = () => {
    setNewProduct({ sku: '', name: '', price: 0, weight: 1, costPrice: 0, stockQuantity: 10, collectionId: '', description: '', images: [], thumbnail: '', hasVariants: false, options: [], variants: [], profitMode: 'manual', profitPercentage: 0, basePrice: 0, commissionPercentage: 0 });
    setIsAdding(true);
  };

  const openEditModal = (product: Product) => {
    const productToEdit = {
        ...product,
        collectionId: product.collectionId ?? '',
        description: product.description ?? '',
        thumbnail: product.thumbnail ?? '',
        images: product.images ?? [],
        profitMode: product.profitMode || (product.useProfitPercentage ? 'margin' : 'manual'),
        profitPercentage: product.profitPercentage ?? 0,
        basePrice: product.basePrice ?? 0,
        commissionPercentage: product.commissionPercentage ?? 0
    };
    setEditingProduct(productToEdit);
  };
  
  const closeModal = () => {
      setIsAdding(false);
      setEditingProduct(null);
  };


  return (
    <motion.div
      className="space-y-6 text-right pb-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Package size={24} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold dark:text-white">قائمة المنتجات</h2>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => setIsImportModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-[10px] sm:text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                <FileUp size={14} /> استيراد
            </button>
            <button onClick={handleExportCSV} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-[10px] sm:text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                <Download size={14} /> تصدير
            </button>
            {isPlatformConnected && (
              <button
                  onClick={handleFetchSelectableProducts}
                  disabled={isSyncing || isFetchingSelectable}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg hover:bg-indigo-600/20 transition-all font-bold border border-indigo-200 dark:border-indigo-800 disabled:opacity-50 text-xs"
              >
                  <ListChecks size={16} className={isFetchingSelectable ? 'animate-spin' : ''} />
                  {isFetchingSelectable ? 'جاري جلب القائمة...' : `اختيار منتجات للمزامنة`}
              </button>
            )}
            {isPlatformConnected ? (
            <button
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-100 dark:shadow-none active:scale-95 disabled:bg-slate-400 disabled:cursor-wait text-sm"
            >
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'جاري المزامنة...' : `مزامنة المنتجات`}
            </button>
            ) : (
            <button 
                onClick={openAddModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95 text-sm"
            >
                <Plus size={20} />
                إضافة منتج جديد
            </button>
            )}
        </div>
      </motion.div>

      {syncStatus.type !== 'idle' && (
        <motion.div variants={itemVariants} className={`p-4 rounded-lg flex items-center gap-3 ${syncStatus.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
          {syncStatus.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{syncStatus.message}</span>
        </motion.div>
      )}

      {/* Inventory Financial Health Indicators Bento Bar */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-5 gap-4 my-6">
        {/* Total Cost Value / Assets invested */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-1 text-right">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
            <Layers size={14} className="text-indigo-500" />
            رأس المال المستثمر (بالتكلفة)
          </p>
          <p className="text-base sm:text-lg font-black text-slate-800 dark:text-white tabular-nums">
            {inventoryFinancials.totalCostValue.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ج.م</span>
          </p>
          <span className="text-[9px] text-slate-400 block font-normal">إجمالي تكلفة شراء المخزون الحالي</span>
        </div>

        {/* Total Retail Value */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-1 text-right">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
            <DollarSign size={14} className="text-emerald-500" />
            القيمة البيعية المتوقعة
          </p>
          <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {inventoryFinancials.totalSaleValue.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ج.م</span>
          </p>
          <span className="text-[9px] text-slate-400 block font-normal">إجمالي سعر بيع كافة حبات المخزون</span>
        </div>

        {/* Projected Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-1 text-right">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
            <Wand2 size={14} className="text-amber-500" />
            الأرباح المتوقعة عند التصفية
          </p>
          <p className="text-base sm:text-lg font-black text-amber-550 dark:text-amber-400 tabular-nums">
            {inventoryFinancials.potentialProfit.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ج.م</span>
          </p>
          <span className="text-[9px] text-slate-400 block font-normal">صافي الربح الإجمالي المتوقع من المخزون</span>
        </div>

        {/* Profit Margin Ratio */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-1 text-right">
          <p className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
            <Percent size={14} className="text-blue-500" />
            متوسط هامش الربح
          </p>
          <p className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 tabular-nums">
            {inventoryFinancials.marginPercent}%
          </p>
          <span className="text-[9px] text-slate-400 block font-normal">نسبة الربح من سعر البيع التقديري</span>
        </div>

        {/* Total Stocked Pieces */}
        <button onClick={() => setSearchTerm('')} className="col-span-2 lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-1 text-right hover:border-indigo-400 transition-colors">
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 flex items-center gap-1">
            <Package size={14} className="text-cyan-500" />
            إجمالي عدد القطع
          </p>
          <p className="text-base sm:text-lg font-black text-slate-705 dark:text-slate-300 tabular-nums">
            {inventoryFinancials.totalStock.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">قطعة</span>
          </p>
          <span className="text-[9px] text-slate-400 block font-normal">عدد كل القطع والبدائل في المستودع</span>
        </button>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors relative">
         {isSyncing && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 z-20 flex flex-col items-center justify-center gap-4 backdrop-blur-sm animate-in fade-in duration-200">
                <RefreshCw size={40} className="animate-spin text-indigo-500" />
                <p className="font-bold text-lg text-indigo-600 dark:text-indigo-400">جاري تحديث قائمة المنتجات...</p>
                <p className="text-sm text-slate-500">قد يستغرق هذا بضع لحظات</p>
            </div>
        )}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="بحث بالاسم أو SKU..."
              className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table for desktop */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-semibold border-b border-slate-100 dark:border-slate-700">
                <th className="px-6 py-4"></th>
                <th className="px-6 py-4">المنتج</th>
                <th className="px-6 py-4">القسم</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">المخزون</th>
                <th className="px-6 py-4">سعر البيع</th>
                <th className="px-6 py-4 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={40} className="text-slate-200 dark:text-slate-700" />
                      <p>لا توجد منتجات. قم بإضافتها يدوياً أو قم بالمزامنة من منصة متصلة.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const collection = settings.collections.find(c => c.id === product.collectionId);
                  return (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-2">
                      {product.thumbnail ? (
                        <img src={product.thumbnail} alt={product.name} className="w-12 h-12 rounded-lg object-cover border-2 border-slate-100 dark:border-slate-700" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{product.name}</div>
                        {product.id.startsWith('wuilt-') && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-md font-bold flex items-center gap-1">
                            <img src="https://wuilt.com/favicon.ico" className="w-2.5 h-2.5" referrerPolicy="no-referrer" />
                            ويلت
                          </span>
                        )}
                      </div>
                      {product.hasVariants && <div className="text-xs text-slate-400">{product.variants.length} متغيرات</div>}
                    </td>
                    <td className="px-6 py-4">
                      {collection ? (
                          <span className="text-xs font-bold px-2 py-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg">{collection.name}</span>
                      ) : (
                          <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 w-fit px-2 py-1 rounded">
                        <Barcode size={14} />
                        {product.sku}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {product.stockQuantity === null || product.stockQuantity === undefined ? (
                         <span className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/50 rounded-full border border-emerald-200 dark:border-emerald-800">متاح دائماً</span>
                      ) : product.stockQuantity > 0 ? (
                         <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[32px] text-center">{product.stockQuantity}</span>
                             {product.stockQuantity < 5 && <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-bold">منخفض</span>}
                         </div>
                      ) : (
                         <span className="px-2 py-1 text-xs font-bold text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50 rounded-full border border-red-200 dark:border-red-800">نفذ</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-indigo-600 dark:text-indigo-400 font-bold">{product.price.toLocaleString()} ج.م</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <button onClick={() => handleGeneratePost(product)} disabled={isGenerating} className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all" title="إنشاء منشور تسويقي">
                          <Wand2 size={18} />
                        </button>
                        <button 
                          onClick={() => openEditModal(product)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => setProductToDelete(product)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
        
        {/* Cards for mobile */}
        <div className="md:hidden p-3 space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400 dark:text-slate-600">
              <div className="flex flex-col items-center gap-2">
                <Package size={40} className="text-slate-200 dark:text-slate-700" />
                <p>لا توجد منتجات.</p>
              </div>
            </div>
          ) : (
            filteredProducts.map(product => {
              const collection = settings.collections.find(c => c.id === product.collectionId);
              return (
                <div key={product.id} className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 shadow-sm">
                  <div className="flex gap-3">
                     <div className="relative flex-shrink-0">
                        {product.thumbnail ? (
                          <img src={product.thumbnail} alt={product.name} className="w-16 h-16 rounded-lg object-cover border border-slate-100 dark:border-slate-700" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                            <ImageIcon size={20} />
                          </div>
                        )}
                        {product.id.startsWith('wuilt-') && (
                          <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900 rounded-full p-0.5 shadow-sm">
                            <img src="https://wuilt.com/favicon.ico" className="w-3 h-3" referrerPolicy="no-referrer" />
                          </div>
                        )}
                     </div>
                    <div className="flex-1 min-w-0">
                       <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-2 leading-tight">{product.name}</h3>
                       <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {collection && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md truncate">{collection.name}</span>}
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate bg-slate-50 dark:bg-slate-800 px-1 rounded">#{product.sku}</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg">
                      <p className="text-[10px] font-bold text-slate-500 mb-0.5">سعر البيع</p>
                      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{product.price.toLocaleString()} ج.م</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg">
                      <p className="text-[10px] font-bold text-slate-500 mb-0.5">المخزون</p>
                      {product.stockQuantity === null || product.stockQuantity === undefined ? (
                         <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">متاح دائماً</p>
                      ) : (
                         <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-black ${product.stockQuantity > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>{product.stockQuantity}</p>
                            {product.stockQuantity < 5 && product.stockQuantity > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
                         </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1">
                       <button onClick={() => handleGeneratePost(product)} disabled={isGenerating} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all">
                        <Wand2 size={16} />
                       </button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setProductToDelete(product)} className="px-3 py-1.5 text-red-600 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all border border-red-100 dark:border-red-900/30">
                        حذف
                      </button>
                      <button onClick={() => openEditModal(product)} className="px-4 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm">
                        تعديل
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </motion.div>

      {(isAdding || editingProduct) && (
        <ProductFormModal 
            isOpen={isAdding || !!editingProduct}
            onClose={closeModal}
            onSave={handleSaveProduct}
            productData={editingProduct || newProduct}
            setProductData={editingProduct ? setEditingProduct : setNewProduct}
            settings={settings}
            isEditing={!!editingProduct}
            onGenerateDescription={handleGenerateDescription}
            isGenerating={isGenerating}
        />
      )}
      
      {isImportModalOpen && (
        <ProductImportModal 
            isOpen={isImportModalOpen}
            onClose={() => { setIsImportModalOpen(false); setImportPreview(null); }}
            onFileParse={handleParseCsv}
            isParsing={isParsingCsv}
            previewData={importPreview}
            onConfirmImport={handleConfirmImport}
            onDownloadTemplate={handleDownloadTemplate}
        />
      )}

      {productToDelete && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-xl p-6 text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32}/>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">حذف المنتج؟</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2">هل أنت متأكد من حذف "{productToDelete.name}"؟ لا يمكن التراجع عن هذا الإجراء.</p>
                <div className="flex gap-3 mt-6">
                    <button onClick={() => setProductToDelete(null)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold">إلغاء</button>
                    <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold">تأكيد الحذف</button>
                </div>
            </div>
        </div>
      )}

      {showPostModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl p-6 relative">
                 <button onClick={() => setShowPostModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500"><XCircle/></button>
                 <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">منشور تسويقي مقترح</h3>
                 <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    {generatedPost}
                 </div>
                 <button onClick={() => { navigator.clipboard.writeText(generatedPost); alert('تم النسخ!'); }} className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold"><Copy size={16}/> نسخ المنشور</button>
            </div>
        </div>
      )}

      {showSelectiveSyncModal && (
        <SelectiveSyncModal 
            isOpen={showSelectiveSyncModal}
            onClose={() => setShowSelectiveSyncModal(false)}
            products={selectableProducts}
            selectedIds={selectedProductIds}
            setSelectedIds={setSelectedProductIds}
            onConfirm={handleImportSelected}
            isSyncing={isSyncing}
        />
      )}
    </motion.div>
  );
});


// --- New Component: ProductImportModal ---
interface ProductImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFileParse: (file: File) => void;
    isParsing: boolean;
    previewData: { products: Product[], errors: string[] } | null;
    onConfirmImport: () => void;
    onDownloadTemplate: () => void;
}

const ProductImportModal: React.FC<ProductImportModalProps> = ({ isOpen, onClose, onFileParse, isParsing, previewData, onConfirmImport, onDownloadTemplate }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileParse(e.target.files[0]);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xl font-bold dark:text-white flex items-center gap-2"><FileUp size={20} className="text-indigo-500" /> استيراد المنتجات</h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XCircle size={24} className="text-slate-400 dark:text-slate-600" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
                {isParsing ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500"><RefreshCw size={32} className="animate-spin mb-4" /><p className="font-bold">جاري تحليل الملف...</p></div>
                ) : !previewData ? (
                    <div className="text-center">
                        <h4 className="font-bold text-lg text-slate-800 dark:text-white">الخطوة 1: تجهيز الملف</h4>
                        <p className="text-sm text-slate-500 mt-1 mb-6">قم بتنزيل القالب واملأه ببيانات منتجاتك ثم ارفعه هنا. يمكنك الحصول على الملف من Google Sheets عبر File &gt; Download &gt; CSV.</p>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <button onClick={onDownloadTemplate} className="w-full text-center py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2">
                                <Download size={16}/> تحميل القالب (CSV)
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="w-full mt-3 py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all font-bold">
                                اختر ملف CSV أو اسحبه هنا
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h4 className="font-bold text-lg text-slate-800 dark:text-white">الخطوة 2: مراجعة وتأكيد</h4>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                           <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-lg font-bold">
                               <div className="flex items-center gap-2"><ListChecks size={20}/><span>تم العثور على {previewData.products.length} منتج صالح للاستيراد.</span></div>
                           </div>
                           {previewData.errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-3 rounded-lg font-bold">
                                    <div className="flex items-center gap-2 mb-2"><FileWarning size={20}/><span>تم العثور على {previewData.errors.length} أخطاء:</span></div>
                                    <ul className="list-disc pr-5 text-sm space-y-1 max-h-24 overflow-y-auto">
                                        {previewData.errors.map((err, i) => <li key={i}>{err}</li>)}
                                    </ul>
                                </div>
                           )}
                        </div>
                        {previewData.products.length > 0 && (
                            <div>
                                <h5 className="font-bold text-slate-600 dark:text-slate-400 mb-2">معاينة أول 5 منتجات:</h5>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                    <table className="w-full text-xs text-right">
                                        <thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="p-2">الاسم</th><th className="p-2">السعر</th><th className="p-2">الكمية</th></tr></thead>
                                        <tbody>
                                            {previewData.products.slice(0, 5).map((p, i) => (
                                                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                                                    <td className="p-2 font-bold">{p.name}</td>
                                                    <td className="p-2">{p.price}</td>
                                                    <td className="p-2">{p.stockQuantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                <button type="button" onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-xl font-bold border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all">إغلاق</button>
                {previewData && (
                    <button type="button" onClick={onConfirmImport} disabled={previewData.products.length === 0} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:bg-slate-400">
                        <Save size={18} /> تأكيد واستيراد {previewData.products.length} منتج
                    </button>
                )}
            </div>
          </div>
        </div>
    );
};


export default ProductsPage;

// --- New/Updated Component: ProductFormModal ---

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (e: React.FormEvent) => void;
    productData: Partial<Product>;
    setProductData: React.Dispatch<React.SetStateAction<any>>;
    settings: Settings;
    isEditing: boolean;
    onGenerateDescription: (isEdit: boolean) => void;
    isGenerating: boolean;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, onSave, productData, setProductData, settings, isEditing, onGenerateDescription, isGenerating }) => {
    const [isSaving, setIsSaving] = useState(false);
    
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        // Simulate a small delay for better UX and to allow state updates to propagate
        await new Promise(resolve => setTimeout(resolve, 600));
        onSave(e);
        setIsSaving(false);
    };
    
    const thumbnailInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const { profitMode, price, profitPercentage, basePrice, commissionPercentage, costPrice } = productData;
        let newCost = costPrice || 0;

        if (profitMode === 'margin') {
            const margin = profitPercentage || 0;
            const currentPrice = price || 0;
            newCost = currentPrice * (1 - (margin / 100));
        } else if (profitMode === 'commission') {
            const commission = commissionPercentage || 0;
            const currentBasePrice = basePrice || 0;
            newCost = currentBasePrice * (1 - (commission / 100));
        }
        
        if (Math.abs(newCost - (costPrice || 0)) > 0.001) {
            setProductData((prev: any) => ({ ...prev, costPrice: newCost }));
        }
    }, [productData.profitMode, productData.price, productData.profitPercentage, productData.basePrice, productData.commissionPercentage, productData.costPrice, setProductData]);

    const updateField = (field: keyof Product, value: any) => {
        setProductData((prev: Product) => ({ ...prev, [field]: value }));
    };

    const handleImagesChange = (val: string) => {
      const urls = val.split(/[\n,]/).map(url => url.trim()).filter(url => url !== '');
      updateField('images', urls);
    };

    const handleVariantToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const hasVariants = e.target.checked;
        setProductData((prev: Product) => ({ 
            ...prev, 
            hasVariants,
            options: hasVariants ? prev.options : [],
            variants: hasVariants ? prev.variants : [],
        }));
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'thumbnail' | 'images') => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            if (target === 'thumbnail') {
                const file = files[0];
                const base64 = await convertToBase64(file);
                updateField('thumbnail', base64);
            } else {
                const newImages: string[] = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const base64 = await convertToBase64(file);
                    newImages.push(base64);
                }
                updateField('images', [...(productData.images || []), ...newImages]);
            }
        } catch (error) {
            console.error("File upload error:", error);
            alert("حدث خطأ أثناء رفع الصورة.");
        } finally {
            e.target.value = ''; // Reset input
        }
    };

    const profitMode = productData.profitMode || 'manual';

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xl font-bold dark:text-white">{isEditing ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <XCircle size={24} className="text-slate-400 dark:text-slate-600" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} id="product-form" className="flex-1 overflow-y-auto">
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Left Column: Basic Info */}
                  <div className="space-y-4">
                      <FormInput label="اسم المنتج" icon={<Package size={16}/>} value={productData.name || ''} onChange={e => updateField('name', e.target.value)} required />
                      <div className="grid grid-cols-2 gap-4">
                          <FormInput label="SKU" icon={<Barcode size={16}/>} value={productData.sku || ''} onChange={e => updateField('sku', e.target.value)} required />
                          <FormInput label="القسم" icon={<Grid3x3 size={16}/>} value={productData.collectionId || ''} onChange={e => updateField('collectionId', e.target.value)} as="select">
                              <option value="">بدون قسم</option>
                              {settings.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </FormInput>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="font-bold text-slate-700 dark:text-slate-300">هذا المنتج له متغيرات (مقاس، لون...)</span>
                            <input type="checkbox" checked={productData.hasVariants} onChange={handleVariantToggle} className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500" />
                        </label>
                      </div>
                  </div>

                  {/* Right Column: Images & Description */}
                  <div className="space-y-4">
                      <input 
                          type="file" 
                          ref={thumbnailInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => handleFileUpload(e, 'thumbnail')} 
                      />
                      <FormInput 
                          label="رابط الصورة الرئيسية" 
                          icon={<ImageIcon size={16}/>} 
                          value={productData.thumbnail || ''} 
                          onChange={e => updateField('thumbnail', e.target.value)} 
                          placeholder="https://..." 
                          actionButton={
                              <button type="button" onClick={() => thumbnailInputRef.current?.click()} className="text-xs flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-lg font-bold hover:bg-indigo-200 transition-colors">
                                  <Upload size={12}/> رفع صورة
                              </button>
                          }
                      />

                      <input 
                          type="file" 
                          ref={galleryInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          multiple
                          onChange={(e) => handleFileUpload(e, 'images')} 
                      />
                      <FormInput 
                          as="textarea" 
                          label="صور المعرض (رابط في كل سطر)" 
                          icon={<Layers size={16}/>} 
                          value={(productData.images || []).join('\n')} 
                          onChange={e => handleImagesChange(e.target.value)} 
                          placeholder="https://image1.com&#10;https://image2.com" 
                          className="h-24"
                          actionButton={
                              <button type="button" onClick={() => galleryInputRef.current?.click()} className="text-xs flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-lg font-bold hover:bg-indigo-200 transition-colors">
                                  <Upload size={12}/> رفع صور متعددة
                              </button>
                          }
                      />
                  </div>
                  
                  {/* Full Width Section: Pricing & Description */}
                   <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">التسعير والربح</h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput label="سعر البيع (ج.م)" icon={<DollarSign size={16}/>} type="number" value={productData.price || ''} onChange={e => updateField('price', Number(e.target.value))} disabled={productData.hasVariants} />
                                    <FormInput label="الوزن (كجم)" icon={<Scale size={16}/>} type="number" value={productData.weight || ''} onChange={e => updateField('weight', Number(e.target.value))} />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-400 mb-2 block">طريقة حساب التكلفة</label>
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
                                        <button type="button" onClick={() => updateField('profitMode', 'manual')} className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${profitMode === 'manual' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}><Wallet size={16}/> يدوي</button>
                                        <button type="button" onClick={() => updateField('profitMode', 'margin')} className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${profitMode === 'margin' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}><Percent size={16}/> هامش ربح</button>
                                        <button type="button" onClick={() => updateField('profitMode', 'commission')} className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${profitMode === 'commission' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}><HandCoins size={16}/> عمولة</button>
                                    </div>
                                </div>
                                
                                {profitMode === 'margin' && (
                                    <div className="animate-in fade-in duration-300">
                                        <FormInput label="نسبة هامش الربح %" icon={<Percent size={16}/>} type="number" value={productData.profitPercentage || ''} onChange={e => updateField('profitPercentage', Number(e.target.value))} />
                                    </div>
                                )}
                                {profitMode === 'commission' && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                                        <FormInput label="السعر الأساسي" icon={<DollarSign size={16}/>} type="number" value={productData.basePrice || ''} onChange={e => updateField('basePrice', Number(e.target.value))} />
                                        <FormInput label="نسبة العمولة %" icon={<Percent size={16}/>} type="number" value={productData.commissionPercentage || ''} onChange={e => updateField('commissionPercentage', Number(e.target.value))} />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormInput 
                                        label="التكلفة (ج.م)" 
                                        icon={<Wallet size={16}/>} 
                                        type="number" 
                                        value={productData.costPrice?.toFixed(2) || '0.00'} 
                                        onChange={e => updateField('costPrice', Number(e.target.value))} 
                                        disabled={profitMode !== 'manual'} 
                                        readOnly={profitMode !== 'manual'} 
                                    />
                                    <FormInput 
                                        label="الكمية" 
                                        icon={<Package size={16}/>} 
                                        tooltip="ترك خانة الكمية فارغة يعني أن المنتج متاح دائماً بدون تحديد كمية. بينما كتابة 0 تعني أن الكمية قد نفدت."
                                        type="number" 
                                        value={productData.hasVariants ? (productData.variants?.reduce((s,v)=>s+(v.stockQuantity || 0),0)) : (productData.stockQuantity === null || productData.stockQuantity === undefined ? '' : productData.stockQuantity)} 
                                        onChange={e => updateField('stockQuantity', e.target.value === '' ? null : Number(e.target.value))} 
                                        disabled={productData.hasVariants} 
                                        placeholder="اتركه فارغاً للمتاح دائماً"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                  <div className="lg:col-span-2">
                       <FormInput as="textarea" label="وصف المنتج" icon={<FileText size={16}/>} value={productData.description || ''} onChange={e => updateField('description', e.target.value)} className="h-32" actionButton={
                           <button type="button" onClick={() => onGenerateDescription(isEditing)} disabled={isGenerating} className="text-xs flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold">
                               {isGenerating ? <RefreshCw size={12} className="animate-spin"/> : <Wand2 size={12}/>}
                               توليد وصف
                           </button>
                       } />
                  </div>

                  {productData.hasVariants && (
                      <div className="lg:col-span-2">
                          <VariantManager productData={productData} setProductData={setProductData} settings={settings} />
                      </div>
                  )}

              </div>
            </form>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                <button type="button" onClick={onClose} disabled={isSaving} className="px-6 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-xl font-bold border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all disabled:opacity-50">إلغاء</button>
                <button type="submit" form="product-form" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none disabled:bg-indigo-400 disabled:cursor-wait">
                    {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} 
                    {isSaving ? 'جاري الحفظ...' : (isEditing ? 'تحديث المنتج' : 'حفظ المنتج')}
                </button>
            </div>
          </div>
        </div>
    );
};


const VariantManager = ({ productData, setProductData, settings }: any) => {
    
    const handleOptionToggle = (optionName: string, isChecked: boolean) => {
        const currentOptions = productData.options || [];
        const newOptions = isChecked ? [...currentOptions, optionName] : currentOptions.filter((o: string) => o !== optionName);
        setProductData((prev: Product) => ({ ...prev, options: newOptions }));
    };

    const generateVariants = () => {
        const selectedGlobalOptions = (settings.globalOptions || []).filter((go: any) => (productData.options || []).includes(go.name));
        if (selectedGlobalOptions.length === 0) return;

        const valueArrays = selectedGlobalOptions.map((go: any) => go.values);
        
        const cartesian = (...a: any[]) => a.reduce((a, b) => a.flatMap((d: any) => b.map((e: any) => [d, e].flat())));
        
        const combinations = cartesian(...valueArrays);
        
        const newVariants: ProductVariant[] = combinations.map((combo: string | string[], index: number) => {
            const comboArray = Array.isArray(combo) ? combo : [combo];
            const options: { [key: string]: string } = {};
            selectedGlobalOptions.forEach((opt: any, i: number) => {
                options[opt.name] = comboArray[i];
            });

            // Try to find an existing variant to preserve data
            const existingVariant = (productData.variants || []).find((v: any) => {
                return JSON.stringify(v.options) === JSON.stringify(options);
            });

            return {
                id: existingVariant?.id || `${Date.now()}-${index}`,
                options: options,
                sku: existingVariant?.sku || `${productData.sku || 'SKU'}-${comboArray.join('-')}`,
                price: existingVariant?.price || productData.price || 0,
                stockQuantity: existingVariant?.stockQuantity || 0,
            };
        });

        setProductData((prev: Product) => ({ ...prev, variants: newVariants }));
    };

    const updateVariant = (variantId: string, field: keyof ProductVariant, value: string | number) => {
        const updatedVariants = productData.variants.map((v: ProductVariant) => {
            if (v.id === variantId) {
                return { ...v, [field]: value };
            }
            return v;
        });
        setProductData((prev: Product) => ({ ...prev, variants: updatedVariants }));
    };

    return (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <h4 className="font-bold text-lg mb-4">إدارة المتغيرات</h4>
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">1. اختر الخيارات</label>
                    <div className="flex flex-wrap gap-3">
                        {(settings.globalOptions || []).map((opt: any) => (
                            <label key={opt.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                                <input type="checkbox" checked={(productData.options || []).includes(opt.name)} onChange={e => handleOptionToggle(opt.name, e.target.checked)} className="rounded text-indigo-500"/>
                                <span className="text-sm font-bold">{opt.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <button type="button" onClick={generateVariants} disabled={(productData.options || []).length === 0} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:bg-slate-400">
                    <ChevronsUpDown size={16}/> 2. توليد المتغيرات
                </button>
                {(productData.variants || []).length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                         <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block">3. أدخل بيانات المتغيرات</label>
                        {productData.variants.map((variant: ProductVariant) => (
                            <div key={variant.id} className="grid grid-cols-4 gap-2 items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="text-sm font-bold truncate">{Object.values(variant.options).join(' / ')}</div>
                                <input type="text" value={variant.sku} onChange={e => updateVariant(variant.id, 'sku', e.target.value)} placeholder="SKU" className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-700 rounded"/>
                                <input type="number" value={variant.price} onChange={e => updateVariant(variant.id, 'price', Number(e.target.value))} placeholder="السعر" className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-700 rounded"/>
                                <input type="number" value={variant.stockQuantity === null || variant.stockQuantity === undefined ? '' : variant.stockQuantity} onChange={e => updateVariant(variant.id, 'stockQuantity', e.target.value === '' ? null : Number(e.target.value))} placeholder="الكمية" className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-700 rounded"/>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const FormInput = ({ label, icon, as = 'input', actionButton, tooltip, ...props }: any) => {
    const Component = as;
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 flex items-center gap-2">
                    {icon} {label}
                    {tooltip && (
                        <div className="relative group">
                            <Info size={14} className="text-slate-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl z-50 text-center font-normal">
                                {tooltip}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                </label>
                {actionButton}
            </div>
            <Component {...props} className={`block w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white transition-all disabled:bg-slate-200 dark:disabled:bg-slate-700/50 ${props.className || ''}`} />
        </div>
    );
};

interface SelectiveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onConfirm: () => void;
  isSyncing: boolean;
}

const SelectiveSyncModal: React.FC<SelectiveSyncModalProps> = ({ 
  isOpen, onClose, products, selectedIds, setSelectedIds, onConfirm, isSyncing 
}) => {
  if (!isOpen) return null;

  const toggleProduct = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xl font-bold dark:text-white flex items-center gap-2"><ListChecks size={20} className="text-indigo-500" /> اختيار منتجات للمزامنة</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><XCircle size={24} className="text-slate-400 dark:text-slate-600" /></button>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 flex justify-between items-center px-6">
          <button onClick={toggleAll} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            {selectedIds.size === products.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
          </button>
          <span className="text-sm font-bold text-slate-500">{selectedIds.size} من {products.length} تم اختيارهم</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 text-right" dir="rtl">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
               <Package size={48} className="mb-4 opacity-20"/>
               <p className="font-bold">لا توجد منتجات متاحة للمزامنة</p>
            </div>
          ) : (
            products.map(product => (
              <div 
                key={product.id} 
                onClick={() => toggleProduct(product.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedIds.has(product.id) ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'}`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedIds.has(product.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                  {selectedIds.has(product.id) && <CheckCircle size={14} />}
                </div>
                {product.thumbnail ? (
                  <img src={product.thumbnail} alt={product.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><ImageIcon size={20}/></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm dark:text-white truncate">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.sku}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{product.price.toLocaleString()} ج.م</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-xl font-bold border border-slate-200 dark:border-slate-600">إلغاء</button>
          <button 
            onClick={onConfirm} 
            disabled={selectedIds.size === 0 || isSyncing}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-slate-400 flex items-center gap-2"
          >
            {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {isSyncing ? 'جاري الاستيراد...' : `استيراد المختار (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};