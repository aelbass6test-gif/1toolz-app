import React, { useState, useEffect, useRef } from 'react';
import { StoreData, Product } from '../types';
import { audioSynth } from '../utils/audioSynth';
import { 
  CheckCircle2, ChevronLeft, Cable, HardDriveDownload, Search, Shapes, X, 
  RefreshCw, ListChecks, CheckCircle, Package, ImageIcon, Save, XCircle, 
  Sparkles, FileSpreadsheet, Eye, Printer, Sliders, Check, Download, 
  Upload, Copy, Info, AlertTriangle, Play, HelpCircle, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';

interface AppsPageProps {
  storeId: string;
  storeData: StoreData | null;
  onUpdateSettings: (settings: any) => void;
  onUpdateOrders?: (orders: any) => void;
  onRefresh?: () => Promise<void>;
  hostUrl: string;
}

interface PlatformConfig {
  appId: string;
  apiKey?: string;
  apiSecret?: string;
  shopUrl?: string;
  shopId?: string;
  lastSync?: string;
  lastProductSync?: string;
  isActive: boolean;
}

const AVAILABLE_APPS = [
  {
    id: 'wuilt',
    name: 'ويلت (Wuilt)',
    description: 'ربط مباشر عبر API لاستيراد الطلبات وتحديث حالتها تلقائياً، مع دعم مزامنة المنتجات بشكل كامل.',
    logo: 'https://cdn.prod.website-files.com/614319338322d2f96eb4dd96/62124643bd803240ec14b13a_Wuilt%20logo.svg',
    type: 'store',
    tags: ['E-commerce', 'Full Sync', 'API'],
    needsApi: true,
    supportedFeatures: ['orders', 'products']
  },
  {
    id: 'shopify',
    name: 'شوبيفاي (Shopify)',
    description: 'استيراد كامل للطلبات والمخزون عبر Shopify Admin API.',
    logo: 'https://cdn.shopify.com/assets/images/logos/shopify-bag.png',
    type: 'store',
    tags: ['E-commerce', 'API'],
    needsApi: true,
    supportedFeatures: ['orders']
  },
  {
    id: 'salla',
    name: 'سلة (Salla)',
    description: 'ربط كامل مع أوامر سلة، المبيعات وحالة الشحن عبر API.',
    logo: 'https://cdn.salla.network/images/logo/logo-square.png',
    type: 'store',
    tags: ['E-commerce', 'Saudi Arabia', 'API'],
    needsApi: true,
    supportedFeatures: ['orders']
  },
  {
    id: 'zid',
    name: 'زد (Zid)',
    description: 'إدارة طلبات زد وتحديث محفظة المتجر عبر API.',
    logo: 'https://zid.sa/wp-content/uploads/2021/04/Zid-Logo-01.png',
    type: 'store',
    tags: ['E-commerce', 'Saudi Arabia', 'API'],
    needsApi: true,
    supportedFeatures: ['orders']
  },
  {
    id: 'taager',
    name: 'تاجر (Taager)',
    description: 'لربط نظام الدروبشيبينج بالمنصة وإرسال الطلبات تلقائياً عبر API.',
    logo: 'https://taager.com/assets/images/taager-logo-colored.svg',
    type: 'supplier',
    tags: ['Dropshipping', 'API'],
    needsApi: true,
    supportedFeatures: ['orders']
  }
];

export default function AppsPage({ storeId, storeData, onUpdateSettings, onUpdateOrders, onRefresh, hostUrl }: AppsPageProps) {
  const [activeTab, setActiveTab] = useState<'platforms' | 'libraries'>('platforms');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<Partial<PlatformConfig>>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingProducts, setSyncingProducts] = useState<string | null>(null);

  // Selective Sync State
  const [showSelectiveModal, setShowSelectiveModal] = useState(false);
  const [selectableProducts, setSelectableProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isFetchingSelectable, setIsFetchingSelectable] = useState(false);

  // --- Excel Bulk Import/Export States ---
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);
  
  // --- Gemini AI states ---
  const [geminiSelectedProdId, setGeminiSelectedProdId] = useState('');
  const [geminiTone, setGeminiTone] = useState('مبدع ومقنع');
  const [geminiOutput, setGeminiOutput] = useState('');
  const [geminiGenerating, setGeminiGenerating] = useState(false);
  const [geminiApplied, setGeminiApplied] = useState(false);

  // --- Confetti States ---
  const [particleCount, setParticleCount] = useState(150);
  const [confettiGravity, setConfettiGravity] = useState(1.0);
  const [confettiSpread, setConfettiSpread] = useState(80);
  const [confettiTheme, setConfettiTheme] = useState<'rainbow' | 'gold' | 'fireworks'>('rainbow');
  const [enabledEvents, setEnabledEvents] = useState<string[]>([
    'create_order', 'pos_sale', 'add_product', 'save_settings'
  ]);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [enableSound, setEnableSound] = useState(true);
  const [soundType, setSoundType] = useState<'standard' | 'cash' | 'success' | 'trumpet' | 'fireworks'>('standard');
  const [enableWelcomeSound, setEnableWelcomeSound] = useState(true);
  const [welcomeSoundType, setWelcomeSoundType] = useState<'standard' | 'cash' | 'success' | 'trumpet' | 'fireworks' | 'magic'>('standard');
  const [enableLoadingSound, setEnableLoadingSound] = useState(true);

  // مزامنة إعدادات الاحتفال والمفرقعات تلقائياً من الخادم
  useEffect(() => {
    if (storeData?.settings?.confettiSettings) {
      const saved = storeData.settings.confettiSettings;
      if (saved.particleCount !== undefined) setParticleCount(saved.particleCount);
      if (saved.gravity !== undefined) setConfettiGravity(saved.gravity);
      if (saved.spread !== undefined) setConfettiSpread(saved.spread);
      if (saved.theme !== undefined) setConfettiTheme(saved.theme as any);
      if (saved.enabledEvents !== undefined) setEnabledEvents(saved.enabledEvents);
      if (saved.soundVolume !== undefined) setSoundVolume(saved.soundVolume);
      if (saved.enableSound !== undefined) setEnableSound(saved.enableSound);
      if (saved.soundType !== undefined) setSoundType(saved.soundType as any);
      if (saved.enableWelcomeSound !== undefined) setEnableWelcomeSound(saved.enableWelcomeSound);
      if (saved.welcomeSoundType !== undefined) setWelcomeSoundType(saved.welcomeSoundType as any);
      if (saved.enableLoadingSound !== undefined) setEnableLoadingSound(saved.enableLoadingSound);
    }
  }, [storeData?.settings?.confettiSettings]);

  // --- Barcode / Printing States ---
  const [barcodeSelectedProdId, setBarcodeSelectedProdId] = useState('');
  const [barcodeIncludePrice, setBarcodeIncludePrice] = useState(true);
  const [barcodeHeight, setBarcodeHeight] = useState(60);
  const [barcodeWidth, setBarcodeWidth] = useState(2);
  const [barcodeWarning, setBarcodeWarning] = useState<string | null>(null);
  const [barcodeTextUsed, setBarcodeTextUsed] = useState('');

  const connectedPlatforms = storeData?.settings?.connectedPlatforms || [];
  const platformConfigs: Record<string, PlatformConfig> = (storeData?.settings as any)?.platformConfigs || {};

  const [appToUninstall, setAppToUninstall] = useState<string | null>(null);

  // 1. Excel File Import Processor
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelImportLoading(true);
    setExcelImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (rows.length === 0) {
          throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات.');
        }

        let successCount = 0;
        let skippedCount = 0;
        const errorLogs: string[] = [];
        const existingProducts = storeData?.settings?.products || [];

        const newImportedProducts: Product[] = [];

        rows.forEach((row, index) => {
          // Flexible mapping supporting different languages
          const name = row['الاسم'] || row['اسم المنتج'] || row['name'] || row['Name'] || row['title'] || row['Title'];
          let price = row['السعر'] || row['سعر البيع'] || row['price'] || row['Price'];
          const sku = row['كود المنتج'] || row['الكود'] || row['sku'] || row['SKU'] || `EX-${Date.now()}-${index}`;
          let costPrice = row['التكلفة'] || row['التكلفه'] || row['سعر التكلفة'] || row['cost'] || row['CostPrice'] || 0;
          let stock = row['الكمية'] || row['المخزون'] || row['الكميه'] || row['stock'] || row['Stock'] || 100;
          let weight = row['الوزن'] || row['weight'] || row['Weight'] || 1;

          if (!name) {
            errorLogs.push(`الصف ${index + 2}: تخطي لعدم وجود اسم للمنتج.`);
            skippedCount++;
            return;
          }

          // Force correct types
          price = Number(price) || 0;
          costPrice = Number(costPrice) || 0;
          stock = Number(stock) || 0;
          weight = Number(weight) || 1;

          // Check for duplicate SKUs in current sheet combined with existing products
          const isDup = existingProducts.some((p: any) => p.sku === sku) || newImportedProducts.some(p => p.sku === sku);

          if (isDup) {
            errorLogs.push(`الصف ${index + 2}: الكود (${sku}) مكرر بالفعل في المتجر.`);
            skippedCount++;
            return;
          }

          const productToSave: Product = {
            id: `Prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sku,
            name: String(name),
            price,
            weight,
            costPrice,
            stock,
            stockQuantity: stock,
            hasVariants: false,
            options: [],
            variants: [],
            inStock: stock > 0
          };

          newImportedProducts.push(productToSave);
          successCount++;
        });

        if (newImportedProducts.length > 0) {
          onUpdateSettings({
            ...storeData?.settings,
            products: [...existingProducts, ...newImportedProducts]
          });

          // Trigger gorgeous confetti storm!
          confetti({
            particleCount,
            gravity: confettiGravity,
            spread: confettiSpread,
            origin: { y: 0.6 }
          });
        }

        setExcelImportResult({
          success: successCount,
          skipped: skippedCount,
          errors: errorLogs
        });
      } catch (err: any) {
        alert(`حدث خطأ أثناء قراءة ملف الإكسل: ${err.message}`);
      } finally {
        setExcelImportLoading(false);
      }
    };

    reader.onerror = () => {
      alert('فشل قراءة الملف.');
      setExcelImportLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  // 2. Excel Data Exporting
  const downloadExcelTemplate = () => {
    // Generate beautiful template
    const templateData = [
      { 'الاسم': 'تيشيرت قطن بريميوم', 'كود المنتج': 'TSH-COT-BLK-L', 'السعر': '450', 'التكلفة': '180', 'الكمية': '150', 'الوزن': '0.3' },
      { 'الاسم': 'ساعة ذكية مقاومة للماء', 'كود المنتج': 'SMW-U8-SLV', 'السعر': '1250', 'التكلفة': '600', 'الكمية': '50', 'الوزن': '0.1' },
      { 'الاسم': 'سماعة بلوتوث لاسلكية', 'كود المنتج': 'TWS-PRO-WHITE', 'السعر': '599', 'التكلفة': '220', 'الكمية': '200', 'الوزن': '0.15' }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب المنتجات');
    XLSX.writeFile(wb, 'قالب_توريد_المنتجات_مدير_الأوردرات.xlsx');

    // Trigger mini confetti
    confetti({ particleCount: 30, spread: 40 });
  };

  const exportProductsToExcel = () => {
    const products = storeData?.settings?.products || [];
    if (products.length === 0) {
      alert('لا توجد منتجات لتصديرها حالياً.');
      return;
    }

    const exportData = products.map((p: any) => ({
      'المعرف الفريد (ID)': p.id,
      'كود المنتج (SKU)': p.sku,
      'الاسم': p.name,
      'سعر البيع': p.price,
      'سعر التكلفة': p.costPrice,
      'المخزون المتوفر': p.stockQuantity ?? p.stock ?? 0,
      'الوزن (كيلوجرام)': p.weight,
      'يحتوي مواصفات متعددة؟': p.hasVariants ? 'نعم' : 'لا'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المنتجات الحالية');
    XLSX.writeFile(wb, `منتجات_متجر_${storeId}_تصدير.xlsx`);

    // Gold rush money rain visual celebration
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#fbbf24', '#f59e0b', '#fb7185', '#34d399']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#fbbf24', '#f59e0b', '#fb7185', '#34d399']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  // 3. Gemini AI Product Desc generator Helper
  const handleGeminiGenerateDesc = async () => {
    const p = (storeData?.settings?.products || []).find((prod: any) => prod.id === geminiSelectedProdId);
    if (!p) {
      alert('يرجى اختيار أحد منتجات متجرك أولاً لتوليد ميزاته.');
      return;
    }

    setGeminiGenerating(true);
    setGeminiApplied(false);
    setGeminiOutput('');

    try {
      const response = await fetch('/api/gemini/generate-desc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productName: p.name,
          productSku: p.sku,
          category: p.collectionId || 'عام',
          tone: geminiTone
        })
      });

      const res = await response.json();
      if (res.success && res.text) {
        setGeminiOutput(res.text);
      } else {
        alert(`فشل التوليد: ${res.error || 'خطأ غير معروف في خوادم Gemini API'}`);
      }
    } catch (error) {
      console.error(error);
      alert('حدث خطأ في الاتصال بالخادم الذكي لـ Gemini API.');
    } finally {
      setGeminiGenerating(false);
    }
  };

  const applyGeminiDescToProduct = () => {
    if (!geminiSelectedProdId || !geminiOutput) return;
    const products = storeData?.settings?.products || [];
    
    const updatedProducts = products.map((p: any) => {
      if (p.id === geminiSelectedProdId) {
        return {
          ...p,
          description: geminiOutput
        };
      }
      return p;
    });

    onUpdateSettings({
      ...storeData?.settings,
      products: updatedProducts
    });

    setGeminiApplied(true);
    confetti({ particleCount: 50, spread: 60 });
    alert('تم تطبيق الوصف الذكي على هذا المنتج بنجاح وحُفظ في الخادم!');
  };

  // 4. Confetti Test Play Helper
  const playConfettiTest = (type: string) => {
    setConfettiTheme(type as any);

    // تشغيل الصوت إذا كان مفعلاً
    if (enableSound) {
      const soundMap = {
        standard: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
        cash: 'https://assets.mixkit.co/active_storage/sfx/133/133-preview.mp3',
        success: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
        trumpet: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3',
        fireworks: 'https://assets.mixkit.co/active_storage/sfx/619/619-preview.mp3'
      };

      let soundUrl = soundMap[soundType] || soundMap.standard;
      // تخصيص للذهب والألعاب النارية في الاختبار إذا كان الصوت افتراضي
      if (soundType === 'standard') {
        if (type === 'gold') soundUrl = soundMap.cash;
        if (type === 'fireworks') soundUrl = soundMap.fireworks;
      }

      try {
        const audio = new Audio(soundUrl);
        audio.volume = soundVolume;
        audio.play().catch(e => console.log('Audio test failed:', e));
      } catch (e) {}
    }

    if (type === 'rainbow') {
      confetti({
        particleCount,
        gravity: confettiGravity,
        spread: confettiSpread,
        origin: { y: 0.6 }
      });
    } else if (type === 'gold') {
      confetti({
        particleCount: Math.min(particleCount * 1.5, 300),
        gravity: confettiGravity * 0.9,
        spread: confettiSpread + 10,
        colors: ['#fbbf24', '#f59e0b', '#d97706', '#fef08a'],
        origin: { y: 0.5 }
      });
    } else if (type === 'fireworks') {
      const end = Date.now() + 2 * 1000;
      const interval = setInterval(() => {
        if (Date.now() > end) return clearInterval(interval);
        confetti({
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          origin: { x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.5 + 0.1 }
        });
      }, 250);
    }
  };

  const saveConfettiTunerSettings = () => {
    onUpdateSettings({
      ...storeData?.settings,
      confettiSettings: {
        particleCount,
        gravity: confettiGravity,
        spread: confettiSpread,
        theme: confettiTheme,
        enabledEvents,
        soundVolume,
        enableSound,
        soundType,
        enableWelcomeSound,
        welcomeSoundType,
        enableLoadingSound
      }
    });
    audioSynth.playTone('success');
    alert('تم حفظ وترقية إعدادات وحدة التحكم في الاحتفالات بنجاح في السحاب!');
  };

  // 5. JsBarcode drawer logic
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (activeTab === 'libraries') {
      const products = storeData?.settings?.products || [];
      const p = products.find((prod: any) => prod.id === barcodeSelectedProdId);
      if (p && svgRef.current) {
        try {
          const originalText = p.sku || p.id;
          
          // CODE128 only supports ASCII standard printable characters (codes 32 to 126). 
          // Let's filter characters to keep only standard printable ASCII range to avoid library drawing errors with Arabic or special text.
          const getSafeBarcodeText = (text: string, fallbackId: string) => {
            if (!text) return fallbackId || "TEMP";
            let safe = text.replace(/[^\x20-\x7E]/g, '').trim();
            // If the safe string becomes empty or too short, let's hash the original text to generate a clean safe ASCII identifier
            if (safe.length < 2) {
              let hash = 0;
              for (let i = 0; i < text.length; i++) {
                hash = text.charCodeAt(i) + ((hash << 5) - hash);
              }
              const hex = Math.abs(hash).toString(16).toUpperCase();
              return `PRD-${hex}`;
            }
            return safe;
          };

          const safeBarcodeText = getSafeBarcodeText(originalText, p.id);
          setBarcodeTextUsed(safeBarcodeText);

          if (safeBarcodeText !== originalText) {
            setBarcodeWarning(`تنبيه: كود المنتج (SKU) "${originalText}" يحتوي على حروف عربية أو رموز غير مدعومة دولياً في الباركود CODE128. تم تنظيف الكود ليكون "${safeBarcodeText}" تلقائياً لضمان قراءة صحيحة بسكانر المخازن.`);
          } else {
            setBarcodeWarning(null);
          }

          if (typeof (window as any).JsBarcode === 'function') {
            (window as any).JsBarcode(svgRef.current, safeBarcodeText, {
              format: "CODE128",
              width: barcodeWidth,
              height: barcodeHeight,
              displayValue: true,
              fontSize: 14,
              font: "monospace",
              textPosition: "bottom",
              background: "#ffffff",
              lineColor: "#0f172a"
            });
          }
        } catch (err) {
          console.error("Barcode drawing error:", err);
          setBarcodeWarning("فشل رسم الباركود: كود المنتج يحتوي على ترميز غير صالح للمكتبة.");
        }
      } else {
        setBarcodeWarning(null);
        setBarcodeTextUsed('');
      }
    }
  }, [barcodeSelectedProdId, barcodeHeight, barcodeWidth, storeData?.settings?.products, activeTab]);

  const handleInstallApp = () => {
    if (!storeData || !selectedApp) return;
    
    let currentPlatforms = storeData.settings.connectedPlatforms || [];
    const currentConfigs = (storeData.settings as any).platformConfigs || {};

    const updatedSettings = {
        ...storeData.settings,
        connectedPlatforms: currentPlatforms.includes(selectedApp.id) 
            ? currentPlatforms 
            : [...currentPlatforms, selectedApp.id],
        platformConfigs: {
            ...currentConfigs,
            [selectedApp.id]: {
               appId: selectedApp.id,
               ...config,
               isActive: true
            }
        }
    };
    onUpdateSettings(updatedSettings);
    setIsModalOpen(false);
    setConfig({});
  };

  const confirmUninstallApp = () => {
      if (!storeData || !appToUninstall) return;

      const currentPlatforms = storeData.settings.connectedPlatforms || [];
      const currentConfigs = (storeData.settings as any).platformConfigs || {};
      
      const newConfigs = { ...currentConfigs };
      delete newConfigs[appToUninstall];

      const updatedSettings = {
          ...storeData.settings,
          connectedPlatforms: currentPlatforms.filter(id => id !== appToUninstall),
          platformConfigs: newConfigs
      };
      onUpdateSettings(updatedSettings);
      setAppToUninstall(null);
  };

  const updateSyncTime = (appId: string, syncType: 'orders' | 'products', additionalData?: any) => {
    onUpdateSettings((prev: any) => {
        const currentConfigs = prev.platformConfigs || {};
        const fieldName = syncType === 'orders' ? 'lastSync' : 'lastProductSync';
        
        let newProducts = prev.products || [];
        if (additionalData?.items && additionalData.items.length > 0) {
            const existingMap = new Map(newProducts.map((p: any) => [p.id, p]));
            additionalData.items.forEach((item: any) => existingMap.set(item.id, item));
            newProducts = Array.from(existingMap.values());
        }

        return {
            ...prev,
            products: newProducts,
            platformConfigs: {
                ...currentConfigs,
                [appId]: {
                    ...currentConfigs[appId],
                    [fieldName]: new Date().toLocaleString('ar-EG')
                }
            }
        };
    });
  };

  const handleSyncOrders = async (appId: string) => {
    setSyncing(appId);
    try {
        const response = await fetch(`/api/sync/platform/${appId}/${storeId}?type=orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (response.ok) {
            if (data.items && data.items.length > 0 && onUpdateOrders) {
                onUpdateOrders((prev: any) => {
                    const newOrders = prev || [];
                    const existingMap = new Map(newOrders.map((o: any) => [o.id, o]));
                    data.items.forEach((item: any) => existingMap.set(item.id, item));
                    return Array.from(existingMap.values());
                });
            }
            updateSyncTime(appId, 'orders');
            // Background refresh to true up any other fields if needed, 
            // the state is already optimistic so auto-save won't wipe it locally.
            if (onRefresh) onRefresh();
            alert(`نجحت المزامنة! تم إضافة/تحديث ${data.updated + data.inserted} طلب.`);
        } else {
            alert(`خطأ في المزامنة: ${data.error}`);
        }
    } catch (error) {
        console.error('Sync error:', error);
        alert('حدث خطأ أثناء محاولة الاتصال بالسيرفر للمزامنة.');
    } finally {
        setSyncing(null);
    }
  };

  const handleSyncProducts = async (appId: string, selectedIds?: string[]) => {
    const isSelective = !!selectedIds;
    if (isSelective) setSyncingProducts(appId); // Use local state for modal button
    else setSyncing(appId + '-products');

    try {
        const response = await fetch(`/api/sync/platform/${appId}/${storeId}?type=products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: selectedIds ? JSON.stringify({ selectedIds }) : undefined
        });

        const data = await response.json();

        if (response.ok) {
            updateSyncTime(appId, 'products', { items: data.items });
            alert(isSelective ? `تم استيراد ${data.updated + data.inserted} منتج بنجاح!` : `نجحت المزامنة! تم تحديث/إضافة ${data.updated + data.inserted} منتج.`);
            if (isSelective) setShowSelectiveModal(false);
        } else {
            alert(`خطأ في مزامنة المنتجات: ${data.error}`);
        }
    } catch (error) {
        console.error('Product sync error:', error);
        alert('حدث خطأ أثناء محاولة التزامن للمنتجات.');
    } finally {
        setSyncingProducts(null);
        setSyncing(null);
    }
  };

  const handleFetchSelectable = async (appId: string) => {
     setIsFetchingSelectable(true);
     console.log(`[DEBUG] Fetching selectable products for ${appId}, storeId: ${storeId}`);
     try {
         const response = await fetch(`/api/sync/platform/${appId}/${storeId}/preview?type=products`);
         const text = await response.text();
         console.log(`[DEBUG] Preview response status: ${response.status}, length: ${text.length}`);
         
         let data;
         try {
             data = JSON.parse(text);
         } catch (e) {
             console.error(`[DEBUG] JSON parse error. First 200 chars of response: ${text.substring(0, 200)}`);
             throw new Error('فشل في قراءة بيانات السيرفر (تنسيق غير مدعوم). قد تكون هناك مشكلة في الاتصال.');
         }

         if (response.ok) {
             setSelectableProducts(data.items || []);
             setShowSelectiveModal(true);
         } else {
             alert(`فشل جلب المنتجات: ${data.error}`);
         }
     } catch (error) {
         console.error('[DEBUG] Fetch error:', error);
         alert('حدث خطأ أثناء محاولة الاتصال بالسيرفر.');
     } finally {
         setIsFetchingSelectable(false);
     }
  };

  const openSettings = (app: any) => {
      setSelectedApp(app);
      setConfig(platformConfigs[app.id] || {});
      setIsModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredApps = AVAILABLE_APPS.filter(app => app.name.includes(searchTerm) || app.description.includes(searchTerm));

  const getWebhookUrl = (appId: string) => {
     return `${hostUrl}/api/webhook/platform/${appId}/${storeId}`;
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
         <button 
           onClick={() => setActiveTab('platforms')}
           className={`py-3 px-6 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${activeTab === 'platforms' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
         >
           <Cable className="w-4 h-4" />
           منصات التجارة والربط (Platforms)
         </button>
         <button 
           onClick={() => setActiveTab('libraries')}
           className={`py-3 px-6 font-bold text-sm border-b-2 flex items-center gap-2 transition-all ${activeTab === 'libraries' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
         >
           <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
           الحزم البرمجية والحلول فائقة التطور (Premium Tech Engines)
         </button>
      </div>

      {activeTab === 'platforms' ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">مركز التحكم والربط (Integrations)</h2>
              <p className="text-slate-500 dark:text-slate-400 mr-1 mt-1">تحكم في جميع أتمتة متجرك وعمليات المزامنة من مكان واحد.</p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-full hidden sm:block dark:bg-indigo-900/30">
               <Shapes className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>

          <div className="flex gap-4 items-center">
             <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                   type="text"
                   placeholder="ابحث عن تطبيق أو منصة..." 
                   className="w-full pr-9 pl-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredApps.map((app) => {
                const isConnected = connectedPlatforms.includes(app.id);
                const appConfig = platformConfigs[app.id];
                
                return (
                  <div key={app.id} className={`flex flex-col bg-white dark:bg-slate-800 rounded-xl overflow-hidden transition-all duration-200 shadow-sm border ${isConnected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`}>
                    <div className="p-5 pb-4">
                       <div className="flex items-start justify-between">
                           <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center p-2 shadow-sm border border-slate-100">
                               {app.logo.endsWith('svg') || app.logo.endsWith('png') ? (
                                  <img src={app.logo} alt={app.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                               ) : (
                                  <div className="font-bold text-xl text-indigo-600">{app.name[0]}</div>
                               )}
                           </div>
                           {isConnected && (
                               <div className="flex flex-col items-end gap-1">
                                   <span className="flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2.5 py-1 rounded-full font-medium">
                                      مُثبت <CheckCircle2 className="w-3 h-3 block" />
                                   </span>
                                   {appConfig?.lastSync && (
                                      <span className="text-[10px] text-slate-400">آخر مزامنة: {appConfig.lastSync}</span>
                                   )}
                               </div>
                           )}
                       </div>
                       <h3 className="text-lg font-semibold mt-4 text-slate-900 dark:text-white">{app.name}</h3>
                       <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 min-h-[40px]">{app.description}</p>
                    </div>
                    <div className="px-5 flex-1 mt-auto">
                        <div className="flex gap-2 flex-wrap pb-4">
                           {app.tags.map(tag => (
                               <span key={tag} className="text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                                   {tag}
                               </span>
                           ))}
                        </div>
                    </div>
                    <div className="pt-0 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                       {isConnected ? (
                           <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => handleSyncOrders(app.id)}
                                    disabled={syncing === app.id}
                                    className={`py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${syncing === app.id ? 'bg-indigo-100 text-indigo-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                 >
                                    <Cable className={`w-3.5 h-3.5 ${syncing === app.id ? 'animate-spin' : ''}`} />
                                    {syncing === app.id ? 'جاري...' : 'مزامنة الطلبات'}
                                </button>
                                <button 
                                    onClick={() => handleFetchSelectable(app.id)}
                                    disabled={syncing === app.id + '-products' || isFetchingSelectable}
                                    className={`py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${syncing === app.id + '-products' ? 'bg-indigo-100 text-indigo-400' : 'bg-slate-900 text-white dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600'}`}
                                 >
                                    {syncing === app.id + '-products' || isFetchingSelectable ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDriveDownload className="w-3.5 h-3.5" />}
                                    {isFetchingSelectable ? 'جاري...' : 'مزامنة المنتجات'}
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                 <button 
                                    onClick={() => openSettings(app)}
                                    className="py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                  >
                                     الإعدادات
                                 </button>
                                 <button 
                                    onClick={() => setAppToUninstall(app.id)}
                                    className="py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-100 dark:border-red-900/20 rounded-lg transition-colors"
                                  >
                                     إيقاف الربط
                                 </button>
                              </div>
                           </div>
                       ) : (
                           <button 
                              onClick={() => openSettings(app)}
                              className="w-full py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                              بدء الربط (API) <ChevronLeft className="w-4 h-4" />
                           </button>
                       )}
                    </div>
                  </div>
                );
             })}
          </div>
        </>
      ) : (
        /* --- HIGH PERFORMANCE TECH LIBRARIES PANEL --- */
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300" dir="rtl">
           
           {/* Section Premium Intro Banner */}
           <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl text-white shadow-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                 <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    محركات الأتمتة والذكاء الخارقة
                 </div>
                 <h3 className="text-xl font-bold">حزم التقنيات الفائقة (Advanced Core Engines)</h3>
                 <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                    استخدم أحدث مكاتب البرمجيات المتكاملة والذكاء الاصطناعي التوليدي لتسريع عمليات متجرك، من استيراد وتصدير ملفات الإكسل بلمسة واحدة وصولاً للتوليد الذكي التام وتجهيز باركودات الملصقات للطباعة الفورية.
                 </p>
              </div>
              <div className="flex gap-3 self-stretch md:self-auto flex-wrap">
                 <button 
                    onClick={() => downloadExcelTemplate()} 
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-4 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                 >
                    <Download className="w-4 h-4 text-emerald-400" />
                    تحميل نموذج الإكسل
                 </button>
                 <button 
                    onClick={() => exportProductsToExcel()} 
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors shadow-md"
                 >
                    <FileSpreadsheet className="w-4 h-4" />
                    تصدير المنتجات لـ Excel
                 </button>
              </div>
           </div>

           {/* Grid Layout of the advanced operations */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Box A: Spreadsheet Parser Engine (SheetJS) */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                          <FileSpreadsheet className="w-6 h-6" />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-base">مستورد الإكسل الذكي بضغطة زر (SheetJS Parser)</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">حل أتمتة متقن لتوريد المنتجات بالآلاف دفعة واحدة وبسرعة فائقة.</p>
                       </div>
                    </div>
                 </div>

                 <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl p-6 text-center transition-colors relative bg-slate-50/50 dark:bg-slate-900/10">
                    <input 
                       type="file" 
                       accept=".xlsx, .xls, .csv" 
                       id="excel-file-uploader" 
                       onChange={handleExcelUpload}
                       className="hidden" 
                    />
                    <label htmlFor="excel-file-uploader" className="cursor-pointer space-y-4 block">
                       <div className="mx-auto w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center border border-indigo-100 dark:border-indigo-900/30">
                          <Upload className="w-6 h-6" />
                       </div>
                       <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">اختر ملف Excel أو CSV الخاص بمنتجاتك</p>
                          <p className="text-xs text-slate-400">يدعم الأعمدة باللغة العربية (الاسم، السعر، كود المنتج SKU، التكلفة، الكمية)</p>
                       </div>
                    </label>
                 </div>

                 {excelImportLoading && (
                    <div className="flex items-center justify-center gap-3 text-indigo-600 dark:text-indigo-400 text-xs font-semibold bg-indigo-50/50 dark:bg-indigo-950/10 p-3 rounded-lg">
                       <RefreshCw className="w-4 h-4 animate-spin" />
                       <span>جاري تحليل ملف البيانات والتحقق من التكرار والأسعار...</span>
                    </div>
                 )}

                 {excelImportResult && (
                    <div className="p-4 rounded-xl border space-y-2 text-sm bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-700/80">
                       <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle className="w-5 h-5" />
                          <span>اكتملت المعالجة بنجاح مذهل!</span>
                       </div>
                       <div className="grid grid-cols-2 gap-4 text-xs mt-2 text-slate-600 dark:text-slate-300">
                          <div className="p-2.5 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg font-semibold text-center">
                             {excelImportResult.success} منتجات تم استيرادها
                          </div>
                          <div className="p-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg font-semibold text-center">
                             {excelImportResult.skipped} عناصر تم تخطيها
                          </div>
                       </div>
                       {excelImportResult.errors.length > 0 && (
                          <div className="space-y-1 pt-2">
                             <p className="text-xs font-bold text-rose-500">سجل التخطي والتحذيرات:</p>
                             <div className="max-h-24 overflow-y-auto text-[11px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2 rounded-lg text-slate-400 font-mono space-y-1">
                                {excelImportResult.errors.map((err, idx) => (
                                   <div key={idx} className="flex items-center gap-1">
                                      <span className="text-rose-400">●</span> {err}
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}
                    </div>
                 )}
              </div>

              {/* Box B: Gemini AI Copywriting assistant */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                       <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
                    </div>
                    <div>
                       <h4 className="font-bold text-slate-900 dark:text-white text-base">كاتب الإعلانات الذكي بـ Gemini 3.5 AI</h4>
                       <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">اكتب أوصاف تسويقية فتاكة تزيد المبيعات في ثواني بذكاء اصطناعي فائق.</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 flex flex-col">
                       <label className="text-xs font-bold text-slate-700 dark:text-slate-300">أولاً: اختر منتجاً من متجرك</label>
                       <select 
                          value={geminiSelectedProdId} 
                          onChange={(e) => {
                             setGeminiSelectedProdId(e.target.value);
                             setGeminiOutput('');
                          }}
                          className="w-full px-3 py-2.5 text-xs border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none"
                       >
                          <option value="">-- اختر المنتج المستهدف --</option>
                          {(storeData?.settings?.products || []).map((p: any) => (
                             <option key={p.id} value={p.id}>{p.name} ({p.sku || 'بدون كود'})</option>
                          ))}
                       </select>
                    </div>

                    <div className="space-y-1.5 flex flex-col">
                       <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ثانياً: نبرة الأسلوب التسويقي</label>
                       <select 
                          value={geminiTone} 
                          onChange={(e) => setGeminiTone(e.target.value)}
                          className="w-full px-3 py-2.5 text-xs border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none"
                       >
                          <option value="مبدع ومقنع">خبير ومحفز للشراء (موصى به)</option>
                          <option value="حماسي وموجه للشباب">شبابي سريع وحيوي وعصري</option>
                          <option value="رسمي وفاخر">لوكشري وفخم (للمجوهرات والصفوة)</option>
                          <option value="إعلانات وخصومات سريعة">قصير وموجه للبيع والخصومات الفورية</option>
                       </select>
                    </div>
                 </div>

                 <button 
                    onClick={handleGeminiGenerateDesc}
                    disabled={!geminiSelectedProdId || geminiGenerating}
                    className="w-full py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    {geminiGenerating ? (
                       <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          جاري استشارة عقل Gemini 3.5 لابتكار الصيغة التسويقية الملائمة...
                       </>
                    ) : (
                       <>
                          <Sparkles className="w-4 h-4" />
                          توليد الوصف الإعلاني الاحترافي بالذكاء الاصطناعي
                       </>
                    )}
                 </button>

                 {geminiOutput && (
                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700/80">
                       <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                             <FileText className="w-3.5 h-3.5" />
                             الوصف الإعلاني المقترح:
                          </span>
                          <button 
                             onClick={() => {
                                navigator.clipboard.writeText(geminiOutput);
                                alert('تم نسخ النص للحافظة بنجاح!');
                             }}
                             className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer text-xs"
                          >
                             <Copy className="w-3.5 h-3.5" />
                             نسخ كـ نص
                          </button>
                       </div>
                       <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/80 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans max-h-56 overflow-y-auto" dir="rtl">
                          {geminiOutput}
                       </div>
                       
                       <button 
                          onClick={applyGeminiDescToProduct}
                          disabled={geminiApplied}
                          className={`w-full py-2.5 text-xs font-semibold rounded-xl text-white shadow transition-all cursor-pointer ${geminiApplied ? 'bg-green-600' : 'bg-slate-900 hover:bg-black dark:bg-slate-700 border-0'}`}
                       >
                          {geminiApplied ? '✓ تم تطبيق الوصف وحفظه في بيانات منتجك بنجاح!' : 'تطبيق فوري كـ وصف أساسي للمنتج المستهدف'}
                       </button>
                    </div>
                 )}
              </div>

              {/* Box C: printable Barcode & QR code generator sticker printing */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                       <Printer className="w-6 h-6" />
                    </div>
                    <div>
                       <h4 className="font-bold text-slate-900 dark:text-white text-base">منشئ ومطبوع الباركود الاحترافي (JsBarcode Print Core)</h4>
                       <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">اصنع ملصقات باركود CODE128 لمنتجاتك لطباعتها ولصقها في المخزن فوراً.</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-1.5 flex flex-col">
                       <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اختر منتجاً لعرض الـ Barcode الخاص به</label>
                       <select 
                          value={barcodeSelectedProdId} 
                          onChange={(e) => setBarcodeSelectedProdId(e.target.value)}
                          className="w-full px-3 py-2.5 text-xs border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none"
                       >
                          <option value="">-- اختر منتجاً من المخزون --</option>
                          {(storeData?.settings?.products || []).map((p: any) => (
                             <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || 'لا يوجد'})</option>
                          ))}
                       </select>
                    </div>

                    {barcodeSelectedProdId ? (
                       <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center space-y-4">
                          <div className="bg-white p-4 rounded-lg border border-slate-200/80">
                             <svg id="barcode-canvas" ref={svgRef} className="mx-auto max-w-full h-auto"></svg>
                          </div>

                           {barcodeWarning && (
                              <div className="w-full p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-500 dark:text-amber-400 leading-relaxed text-right" dir="rtl">
                                 {barcodeWarning}
                              </div>
                           )}

                          <div className="w-full grid grid-cols-2 gap-3 text-[11px]" dir="rtl">
                             <label className="flex flex-col gap-1 text-slate-500">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">عرض الخط (Width)</span>
                                <input 
                                   type="range" 
                                   min="1" 
                                   max="4" 
                                   step="1" 
                                   value={barcodeWidth} 
                                   onChange={(e) => setBarcodeWidth(Number(e.target.value))}
                                   className="w-full accent-indigo-600"
                                />
                             </label>
                             <label className="flex flex-col gap-1 text-slate-500">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">طول الخط (Height)</span>
                                <input 
                                   type="range" 
                                   min="30" 
                                   max="120" 
                                   step="10" 
                                   value={barcodeHeight} 
                                   onChange={(e) => setBarcodeHeight(Number(e.target.value))}
                                   className="w-full accent-indigo-600"
                                />
                             </label>
                          </div>

                          <button 
                             onClick={() => {
                                const printContent = document.getElementById('barcode-canvas')?.outerHTML;
                                if (!printContent) return;
                                const win = window.open('', '_blank');
                                if (win) {
                                   win.document.write(`
                                      <html>
                                         <head><title>طباعة ملصق الباركود</title></head>
                                         <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:0;">
                                            <div style="text-align:center;">
                                               ${printContent}
                                               <h4 style="font-family:sans-serif;margin-top:10px;font-size:12px;color:#333;">المخزن الرئيسي لـ ${(storeData?.settings as any)?.storeName || 'متجرنا'}</h4>
                                            </div>
                                            <script>window.print(); window.onafterprint = function(){ window.close(); }</script>
                                         </body>
                                      </html>
                                   `);
                                   win.document.close();
                                }
                             }}
                             className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 border-0 cursor-pointer"
                          >
                             <Printer className="w-4 h-4" />
                             طباعة ملصق الباركود المخصص
                          </button>
                       </div>
                    ) : (
                       <div className="p-6 text-center border rounded-xl border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
                          اختر منتجاً لتوليد الباركود وتعديله وطباعته فوراً.
                       </div>
                    )}
                 </div>
              </div>

              {/* Box D: Confetti & celebrations play options with sliders */}
               <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                     <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                        <Sliders className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">وحدة التحكم في احتفالات المنصة (Canvas Confetti Tuner)</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">خصص قفل الجاذبية ونصف قطر انبعاث المطر الملون لاحتفالات نجاح الأوردرات.</p>
                     </div>
                  </div>

                  <div className="space-y-4 text-xs" dir="rtl">
                     <div className="space-y-1">
                        <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                           <span>عدد الجسيمات الملونة (Particles Count):</span>
                           <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{particleCount} حبة</span>
                        </div>
                        <input 
                           type="range" 
                           min="30" 
                           max="250" 
                           value={particleCount} 
                           onChange={(e) => setParticleCount(Number(e.target.value))} 
                           className="w-full accent-indigo-600 cursor-pointer"
                        />
                     </div>

                     <div className="space-y-1">
                        <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                           <span>زاوية تشتت الانفجار الفني (Spread):</span>
                           <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{confettiSpread}° درجات</span>
                        </div>
                        <input 
                           type="range" 
                           min="30" 
                           max="180" 
                           value={confettiSpread} 
                           onChange={(e) => setConfettiSpread(Number(e.target.value))} 
                           className="w-full accent-indigo-600 cursor-pointer"
                        />
                     </div>

                     <div className="space-y-1">
                        <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                           <span>سرعة السقوط قفل الجاذبية (Gravity):</span>
                           <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{confettiGravity.toFixed(1)}x سرعة</span>
                        </div>
                        <input 
                           type="range" 
                           min="0.3" 
                           max="2.5" 
                           step="0.1" 
                           value={confettiGravity} 
                           onChange={(e) => setConfettiGravity(Number(e.target.value))} 
                           className="w-full accent-indigo-600 cursor-pointer"
                        />
                     </div>

                     <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between">
                           <span className="font-bold text-slate-700 dark:text-slate-300">صوت ترحيبي عند الدخول (Welcome Sound):</span>
                           <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                 type="checkbox" 
                                 className="sr-only peer"
                                 checked={enableWelcomeSound}
                                 onChange={(e) => setEnableWelcomeSound(e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                           </label>
                        </div>

                        <div className="flex items-center justify-between">
                           <span className="font-bold text-slate-700 dark:text-slate-300">صوت "تحميل البيانات" في البدء:</span>
                           <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                 type="checkbox" 
                                 className="sr-only peer"
                                 checked={enableLoadingSound}
                                 onChange={(e) => setEnableLoadingSound(e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                           </label>
                        </div>

                        {enableWelcomeSound && (
                           <div className="space-y-1 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                              <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">نغمة الترحيب المفضلة (حديثة):</p>
                              <div className="flex flex-wrap gap-2">
                                 {[
                                    { id: 'modern_shine', label: 'لمعان حديث' },
                                    { id: 'pro_chime', label: 'رنين احترافي' },
                                    { id: 'future_ui', label: 'واجهة مستقبلية' },
                                    { id: 'soft_welcome', label: 'ترحيب هادئ' },
                                    { id: 'tech_rise', label: 'انطلاق تقني' },
                                    { id: 'magic', label: 'سحري' },
                                    { id: 'standard', label: 'كلاسيك' }
                                 ].map((item) => (
                                    <button 
                                       key={item.id}
                                       onClick={() => {
                                          setWelcomeSoundType(item.id as any);
                                          // Test play
                                          const soundMap: any = {
                                             standard: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
                                             cash: 'https://assets.mixkit.co/active_storage/sfx/133/133-preview.mp3',
                                             success: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
                                             trumpet: 'https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3',
                                             fireworks: 'https://assets.mixkit.co/active_storage/sfx/619/619-preview.mp3',
                                             magic: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
                                             modern_shine: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3',
                                             pro_chime: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
                                             future_ui: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3',
                                             soft_welcome: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
                                             tech_rise: 'https://assets.mixkit.co/active_storage/sfx/611/611-preview.mp3'
                                          };
                                          try {
                                             const audio = new Audio(soundMap[item.id]);
                                             audio.volume = soundVolume;
                                             audio.play().catch(() => {});
                                          } catch (e) {}
                                       }}
                                       className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition-all border ${welcomeSoundType === item.id ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}
                                    >
                                       {item.label}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        )}

                        <div className="flex items-center justify-between">
                           <span className="font-bold text-slate-700 dark:text-slate-300">المؤثرات الصوتية (Celebration Sounds):</span>
                           <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                 type="checkbox" 
                                 className="sr-only peer"
                                 checked={enableSound}
                                 onChange={(e) => setEnableSound(e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                           </label>
                        </div>

                        {enableSound && (
                           <>
                              <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                 <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                                    <span>مستوى صوت الاحتفال:</span>
                                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{Math.round(soundVolume * 100)}%</span>
                                 </div>
                                 <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01" 
                                    value={soundVolume} 
                                    onChange={(e) => setSoundVolume(Number(e.target.value))} 
                                    className="w-full accent-indigo-600 cursor-pointer"
                                 />
                              </div>

                              <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                 <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">اختر نوع الصوت المفضل للاحتفال:</p>
                                 <div className="grid grid-cols-2 gap-2">
                                    <button 
                                       onClick={() => setSoundType('standard')}
                                       className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${soundType === 'standard' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}
                                    >
                                       احتفال كلاسيكي (Standard)
                                    </button>
                                    <button 
                                       onClick={() => setSoundType('cash')}
                                       className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${soundType === 'cash' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}
                                    >
                                       تحصيل كاش (Cash)
                                    </button>
                                    <button 
                                       onClick={() => setSoundType('success')}
                                       className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${soundType === 'success' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}
                                    >
                                       إنجاز سريع (Success)
                                    </button>
                                    <button 
                                       onClick={() => setSoundType('trumpet')}
                                       className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${soundType === 'trumpet' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}
                                    >
                                       موسيقى الفوز (Fanfare)
                                    </button>
                                    <button 
                                       onClick={() => setSoundType('fireworks')}
                                       className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${soundType === 'fireworks' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}
                                    >
                                       فرقعة ألعاب نارية (Pop)
                                    </button>
                                 </div>
                              </div>
                           </>
                        )}
                     </div>

                     <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-2 font-sans">اختر واختبر مظهر الانفجار الفني الافتراضي (محدد حالياً: {confettiTheme === 'rainbow' ? 'المطر القوسي' : confettiTheme === 'gold' ? 'مطر الذهب' : 'ألعاب نارية'}):</p>
                        <div className="grid grid-cols-3 gap-2">
                           <button 
                              onClick={() => { playConfettiTest('rainbow'); }} 
                              className={`py-2.5 font-bold rounded-xl text-[10px] transition-all shadow-sm flex items-center justify-center gap-1 border cursor-pointer ${confettiTheme === 'rainbow' ? 'bg-indigo-600 text-white border-transparent scale-105 shadow-indigo-500/20' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border-transparent'}`}
                           >
                              <Play className={`w-3 h-3 ${confettiTheme === 'rainbow' ? 'text-white' : 'text-indigo-500'}`} />
                              المطر القوسي
                           </button>
                           <button 
                              onClick={() => { playConfettiTest('gold'); }} 
                              className={`py-2.5 font-bold rounded-xl text-[10px] transition-all shadow-sm flex items-center justify-center gap-1 border cursor-pointer ${confettiTheme === 'gold' ? 'bg-amber-500 text-white border-transparent scale-105 shadow-amber-500/20' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border-transparent'}`}
                           >
                              <Play className={`w-3 h-3 ${confettiTheme === 'gold' ? 'text-white' : 'text-amber-500 animate-bounce'}`} />
                              مطر زينة الذهب
                           </button>
                           <button 
                              onClick={() => { playConfettiTest('fireworks'); }} 
                              className={`py-2.5 font-bold rounded-xl text-[10px] transition-all shadow-sm flex items-center justify-center gap-1 border cursor-pointer ${confettiTheme === 'fireworks' ? 'bg-rose-600 text-white border-transparent scale-105 shadow-rose-500/20' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border-transparent'}`}
                           >
                              <Play className={`w-3 h-3 ${confettiTheme === 'fireworks' ? 'text-white' : 'text-red-500'}`} />
                              شلال ألعاب نارية
                           </button>
                        </div>
                     </div>

                     {/* قائمة الأحداث لتشغيل الاحتفالات تلقائياً */}
                     <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                        <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">اختر العمليات التي تطلق الاحتفال تلقائياً عند إتمامها بنجاح:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                           {[
                              { id: 'create_order', label: 'تسجيل طلب جديد 🛍️' },
                              { id: 'edit_order', label: 'تعديل أو تحديث طلب 📝' },
                              { id: 'pos_sale', label: 'عملية بيع كاشير (POS) 🧮' },
                              { id: 'add_product', label: 'إضافة منتج جديد للمتجر 📦' },
                              { id: 'delete_product', label: 'حذف منتج من المتجر 🗑️' },
                              { id: 'wallet_withdraw', label: 'طلب سحب رصيد مالي 💰' },
                              { id: 'save_settings', label: 'تحديث وحفظ الإعدادات العامة ⚙️' },
                           ].map((evt) => (
                              <label key={evt.id} className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                                 <input 
                                    type="checkbox"
                                    checked={enabledEvents.includes(evt.id)}
                                    onChange={(e) => {
                                       if (e.target.checked) {
                                          setEnabledEvents([...enabledEvents, evt.id]);
                                       } else {
                                          setEnabledEvents(enabledEvents.filter(x => x !== evt.id));
                                       }
                                    }}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
                                 />
                                 <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{evt.label}</span>
                              </label>
                           ))}
                        </div>
                     </div>

                     <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button
                           onClick={saveConfettiTunerSettings}
                           className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 border-none cursor-pointer"
                        >
                           <Save className="w-4 h-4" />
                           تثبيت وحفظ إعدادات الاحتفالات السحابية
                        </button>
                     </div>
                  </div>
               </div>

            </div>
         </div>
       )}

      {isModalOpen && selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  
                  <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
                     <div className="flex items-center gap-3">
                        <img src={selectedApp.logo} alt={selectedApp.name} className="w-10 h-10 object-contain bg-white rounded-lg p-1.5 border" referrerPolicy="no-referrer" />
                        <div>
                           <h3 className="font-bold text-lg">إعدادات ربط {selectedApp.name}</h3>
                           <p className="text-[10px] text-slate-400">تحكم كامل في الاتصال والمزامنة اللحظية.</p>
                        </div>
                     </div>
                     <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-full p-2 transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6">
                     {/* Integration Status Toggle */}
                     <div className="flex items-center justify-between p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                              <RefreshCw size={20} className={config.isActive !== false ? "animate-spin" : ""} />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">التحديث التلقائي (Auto-Sync)</p>
                              <p className="text-xs text-indigo-600 dark:text-indigo-400">جلب الطلبات الجديدة كل دقيقتين تلقائياً.</p>
                           </div>
                        </div>
                        <ToggleButton active={config.isActive !== false} onToggle={() => setConfig({...config, isActive: !config.isActive})} variant="blue" />
                     </div>

                     {/* API Configuration Section */}
                     <div className={`space-y-4 transition-all duration-300 ${config.isActive === false ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 ">
                           <Key className="w-4 h-4" />
                           <h4 className="font-bold text-sm uppercase tracking-wider">إعدادات الـ API</h4>
                        </div>
                        
                        <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl">
                           <div className="space-y-1.5">
                              <label className="text-xs font-black text-slate-600 dark:text-slate-400 block mr-1">معرف المتجر (Store ID)</label>
                              <input 
                                type="text"
                                placeholder="Store_cm84j35..."
                                value={config.shopId || ''}
                                onChange={(e) => setConfig({...config, shopId: e.target.value})}
                                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                dir="ltr"
                              />
                              <p className="text-[10px] text-slate-400 mt-1 mr-1">تجد الـ Store ID في رابط لوحة تحكم ويلت الخاص بك.</p>
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-xs font-black text-slate-600 dark:text-slate-400 block mr-1">مفتاح الـ API (Access Token / API Key)</label>
                              <input 
                                type="password"
                                placeholder="أدخل مفتاح الربط هنا"
                                value={config.apiKey || ''}
                                onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                dir="ltr"
                              />
                           </div>
                        </div>
                     </div>

                     {/* Webhook Configuration Section */}
                     <div className={`space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700 ${config.isActive === false ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 ">
                           <Webhook className="w-4 h-4" />
                           <h4 className="font-bold text-sm uppercase tracking-wider">إعدادات الـ Webhook (للاستقبال اللحظي)</h4>
                        </div>
                        
                        <div className="space-y-3">
                           <p className="text-[11px] text-slate-500 mr-1 leading-relaxed">انسخ الرابط التالي وضعه في إعدادات الـ Webhook في لوحة تحكم {selectedApp.name} لاستقبال الطلبات والسلات بمجرد حدوثها.</p>
                           <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 group">
                             <input 
                               type="text"
                               readOnly 
                               value={getWebhookUrl(selectedApp.id)} 
                               className="w-full px-4 py-3 text-xs font-mono bg-transparent text-left focus:outline-none"
                               dir="ltr"
                             />
                             <button 
                               onClick={() => copyToClipboard(getWebhookUrl(selectedApp.id))} 
                               className={`px-6 flex items-center justify-center transition-all border-r dark:border-slate-700 min-w-[80px] font-bold text-xs ${copied ? 'bg-green-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                             >
                               {copied ? 'تم النسخ!' : 'نسخ الرابط'}
                             </button>
                           </div>
                        </div>
                     </div>

                     <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 p-4 rounded-xl text-xs leading-relaxed border border-amber-100 dark:border-amber-900/20">
                         <strong>توصية:</strong> الربط عبر الـ API يضمن جلب البيانات السابقة، بينما الـ Webhook يضمن استمرارية العمل اللحظي دون تدخل منك.
                     </div>
                  </div>

                  <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 items-center">
                     <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 transition-all">
                        إلغاء
                     </button>
                     <button onClick={handleInstallApp} className="px-8 py-2.5 text-sm font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-95">
                       {connectedPlatforms.includes(selectedApp.id) ? 'حفظ التفييرات' : 'تفعيل الربط الآن'}
                     </button>
                  </div>

              </div>
          </div>
      )}

      {showSelectiveModal && selectedApp && (
          <SelectiveSyncModal 
            isOpen={showSelectiveModal}
            onClose={() => setShowSelectiveModal(false)}
            products={selectableProducts}
            selectedIds={selectedProductIds}
            setSelectedIds={setSelectedProductIds}
            onConfirm={() => handleSyncProducts(selectedApp.id, Array.from(selectedProductIds))}
            isSyncing={syncingProducts === selectedApp.id}
          />
      )}

      {/* Custom Unlink Confirmation Modal */}
      {appToUninstall && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
                  <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                      <XCircle size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">تأكيد إيقاف الربط</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                      هل أنت متأكد من رغبتك في إيقاف الربط مع <strong>{AVAILABLE_APPS.find(a => a.id === appToUninstall)?.name}</strong>؟ 
                      <br />سيتم تعطيل المزامنة اللحظية والتحكم في الطلبات والمنتجات.
                  </p>
                  <div className="flex gap-3">
                      <button 
                          onClick={confirmUninstallApp}
                          className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
                      >
                          نعم، إيقاف الربط
                      </button>
                      <button 
                          onClick={() => setAppToUninstall(null)}
                          className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl font-black text-sm transition-all"
                      >
                          تراجع
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

// --- Selective Sync Modal Component ---
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

interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "blue", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-10 h-5 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-22px]' : 'translate-x-[-2px]'}`} /> </button> );
};
const Key = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.2 8.4-4.4 4.4a5.5 5.5 0 0 1-7.7-7.7l4.4-4.4a5.5 5.5 0 0 1 7.7 7.7Z"/><path d="m18 11 4 4"/><path d="m14 7 8 8"/><path d="m21 15 3 3"/><path d="m22 22-2-2"/></svg>
);

const Webhook = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M7 10v4"/><path d="M11 10v4"/></svg>
);
