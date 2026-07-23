import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Package, Plus, Trash2, Edit3, Save, XCircle, Search, AlertCircle, Barcode, DollarSign, Scale, Wallet, RefreshCw, ServerOff, Image as ImageIcon, CheckCircle, Clock, Download, Layers, Grid3x3, Wand2, FileText, Copy, ChevronsUpDown, Percent, Upload, FileUp, ListChecks, FileWarning, HandCoins, Info, Calendar, ChevronLeft, ChevronRight, Eye, EyeOff, Sparkles, TrendingUp, Box, Sliders, Tag, Zap, Check, Share2, Globe, ShieldCheck, LayoutGrid, Calculator, HelpCircle, Lightbulb, ArrowRight, ArrowLeft } from 'lucide-react';
import { Settings, Product, ProductVariant, Order } from '../types';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { audioSynth } from '../utils/audioSynth';
import { generateProductDescription, generateSocialMediaPost } from '../services/geminiService';
import { getLatestProductCost } from '../utils/financials';
import { triggerCelebration } from '../utils/celebration';
import { useInventoryVisibility } from '../utils/useInventoryVisibility';
import { SmartInventoryHubNav, SmartInventoryHubContent, InventoryHubTab } from './inventory/SmartInventoryHub';

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
  orders: Order[];
  activeStoreId: string | null;
  onRefresh?: () => void;
}

const ProductsPage: React.FC<ProductsPageProps> = React.memo(({ settings, setSettings, orders, activeStoreId, onRefresh }) => {
  const { showInventoryValue, toggleInventoryValue } = useInventoryVisibility();
  const [activeTab, setActiveTab] = useState<InventoryHubTab>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Pagination State for Products
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Custom states for warehouse tracking & modern enhancements
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>('');

  // Audio synthezier alarm / notify system
  const playAlarmSound = (type: 'success' | 'warning' | 'error' | 'info') => {
    try {
      audioSynth.playTone(type);
    } catch (e) {
      console.error("Audio beep failed:", e);
    }
  };

  // Custom Alarm Dialog Modal
  const [modal, setModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    buttonText: string;
    isConfirm: boolean;
    onConfirm: (() => void) | null;
  }>({
    show: false,
    title: '',
    message: '',
    type: 'info',
    buttonText: 'حسناً',
    isConfirm: false,
    onConfirm: null
  });

  const showAlert = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    playAlarmSound(type);
    setModal({
      show: true,
      title,
      message,
      type,
      buttonText: 'حسناً',
      isConfirm: false,
      onConfirm: null
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'error' = 'warning') => {
    playAlarmSound(type);
    setModal({
      show: true,
      title,
      message,
      type,
      buttonText: 'تأكيد الإجراء',
      isConfirm: true,
      onConfirm
    });
  };
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ sku: '', name: '', price: 0, weight: 1, costPrice: 0, stockQuantity: 10, collectionId: '', description: '', images: [], thumbnail: '', hasVariants: false, options: [], variants: [], profitMode: 'manual', profitPercentage: 0, basePrice: 0, commissionPercentage: 0 });
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string | null }>({ type: 'idle', message: null });
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    const saved = localStorage.getItem('lastProductSync');
    return saved ? new Date(saved) : null;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  
  const invoicesStockMap = useMemo(() => {
    const pMap: Record<string, number> = {};
    const vMap: Record<string, number> = {};
    
    // 1. Supply Orders (Purchases)
    (settings.supplyOrders || []).forEach(order => {
        if (order.status === 'cancelled') return;
        order.items.forEach(item => {
            const qty = (item.receivedQuantity ?? item.quantity ?? 0) + (item.bonusQuantity || 0);
            if (item.variantId) {
                vMap[item.variantId] = (vMap[item.variantId] || 0) + qty;
            } else {
                pMap[item.productId] = (pMap[item.productId] || 0) + qty;
            }
        });
    });

    // 2. Orders (Sales) - Exclude statuses where product is returned/stayed in warehouse
    const excludedStatuses = ['ملغي', 'مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'];
    orders.forEach(order => {
        if (excludedStatuses.includes(order.status)) return;
        order.items?.forEach(item => {
            const qty = item.quantity || 0;
            if (item.variantId) {
                vMap[item.variantId] = (vMap[item.variantId] || 0) - qty;
            } else {
                pMap[item.productId] = (pMap[item.productId] || 0) - qty;
            }
        });
    });

    // 3. Order Returns (Add back items that were previously subtracted)
    (settings.orderReturns || []).forEach(ret => {
        if (ret.status === 'cancelled' || !ret.restockItems) return;
        // Only add back if the original order was actually subtracted (not in excluded statuses)
        const originalOrder = orders.find(o => o.id === ret.orderId);
        if (originalOrder && !excludedStatuses.includes(originalOrder.status)) {
            ret.items.forEach(item => {
                const qty = item.quantity || 0;
                if (item.variantId) {
                    vMap[item.variantId] = (vMap[item.variantId] || 0) + qty;
                } else {
                    pMap[item.productId] = (pMap[item.productId] || 0) + qty;
                }
            });
        }
    });

    // 4. Purchase Returns (Subtract items returned to suppliers)
    (settings.purchaseReturns || []).forEach(ret => {
        if (ret.status === 'cancelled') return;
        ret.items.forEach(item => {
            const qty = item.quantity || 0;
            if (item.variantId) {
                vMap[item.variantId] = (vMap[item.variantId] || 0) - qty;
            } else {
                pMap[item.productId] = (pMap[item.productId] || 0) - qty;
            }
        });
    });

    return { products: pMap, variants: vMap };
  }, [settings.supplyOrders, settings.orderReturns, settings.purchaseReturns, orders]);

  const restoreAllStockFromInvoices = () => {
    showConfirm(
        "استعادة المخزون من الفواتير",
        "سيقوم هذا الإجراء بإعادة حساب الكميات بناءً على فواتير المشتريات المسجلة مطروحاً منها المبيعات. هل أنت متأكد؟",
        () => {
            const warehouseIds = (settings.warehouses || []).map(w => w.id);
            const defaultWhId = warehouseIds[0];

            const updatedProducts = (settings.products || []).map(product => {
                let updated = { ...product };
                if (updated.hasVariants && updated.variants) {
                    updated.variants = updated.variants.map(v => {
                        const invStock = invoicesStockMap.variants[v.id] ?? 0;
                        let vCopy = { ...v, stockQuantity: invStock, stock: invStock };
                        if (defaultWhId && (vCopy.warehouseStock?.[defaultWhId] ?? 0) === 0 && invStock > 0) {
                            vCopy.warehouseStock = { ...(vCopy.warehouseStock || {}), [defaultWhId]: invStock };
                        }
                        return vCopy;
                    });
                    updated.stockQuantity = updated.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
                } else {
                    const invStock = invoicesStockMap.products[product.id] ?? 0;
                    updated.stockQuantity = invStock;
                    updated.stock = invStock;
                    if (defaultWhId && (updated.warehouseStock?.[defaultWhId] ?? 0) === 0 && invStock > 0) {
                        updated.warehouseStock = { ...(updated.warehouseStock || {}), [defaultWhId]: invStock };
                    }
                }
                updated.inStock = (updated.stockQuantity || 0) > 0;
                return updated;
            });

            setSettings(prev => ({ ...prev, products: updatedProducts }));
            showAlert("تمت الاستعادة", "تمت إعادة بناء المخزون من واقع الفواتير بنجاح.", "success");
        }
    );
  };

  const recalculateAllStock = () => {
    showConfirm(
      "مزامنة المخزون الشاملة",
      "سيقوم هذا الإجراء بمطابقة إجمالي المخزون مع توزيع المستودعات. إذا كان هناك منتج غير موزع، سيتم نقله بالكامل للمستودع الأول. هل تريد الاستمرار؟",
      () => {
        const warehouseIds = (settings.warehouses || []).map(w => w.id);
        const defaultWhId = warehouseIds[0];
        
        const updatedProducts = (settings.products || []).map(product => {
          if (warehouseIds.length === 0) return product; // Don't recalculate if no warehouses exist to prevent zeroing stock
          let updatedProduct = { ...product };
          
          if (updatedProduct.hasVariants && updatedProduct.variants) {
            const updatedVariants = updatedProduct.variants.map(variant => {
              const cleanedWhStock: Record<string, number> = {};
              warehouseIds.forEach(id => {
                if (variant.warehouseStock?.[id] !== undefined) {
                  cleanedWhStock[id] = Number(variant.warehouseStock[id]);
                }
              });
              
              let totalFromWarehouses = Object.values(cleanedWhStock).reduce((sum, val) => sum + (Number(val) || 0), 0);
              
              if (totalFromWarehouses === 0 && (Number(variant.stockQuantity) || 0) > 0 && defaultWhId) {
                cleanedWhStock[defaultWhId] = Number(variant.stockQuantity);
                totalFromWarehouses = Number(variant.stockQuantity);
              }

              return {
                ...variant,
                warehouseStock: cleanedWhStock,
                stockQuantity: totalFromWarehouses,
                stock: totalFromWarehouses
              };
            });
            const totalFromVariants = updatedVariants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
            return {
              ...updatedProduct,
              variants: updatedVariants,
              stockQuantity: totalFromVariants,
              stock: totalFromVariants,
              inStock: totalFromVariants > 0
            };
          } else {
            const cleanedWhStock: Record<string, number> = {};
            warehouseIds.forEach(id => {
              if (updatedProduct.warehouseStock?.[id] !== undefined) {
                cleanedWhStock[id] = Number(updatedProduct.warehouseStock[id]);
              }
            });

            let totalFromWarehouses = Object.values(cleanedWhStock).reduce((sum, val) => sum + (Number(val) || 0), 0);
            
            if (totalFromWarehouses === 0 && (Number(updatedProduct.stockQuantity) || 0) > 0 && defaultWhId) {
                cleanedWhStock[defaultWhId] = Number(updatedProduct.stockQuantity);
                totalFromWarehouses = Number(updatedProduct.stockQuantity);
            }

            return {
              ...updatedProduct,
              warehouseStock: cleanedWhStock,
              stockQuantity: totalFromWarehouses,
              stock: totalFromWarehouses,
              inStock: totalFromWarehouses > 0
            };
          }
        });

        setSettings(prev => ({ ...prev, products: updatedProducts }));
        showAlert("تمت المزامنة", "تمت موازنة الأرصدة بنجاح وتصحيح التوزيع.", "success");
      }
    );
  };

  const fixProductStock = (productId: string) => {
    const warehouseIds = (settings.warehouses || []).map(w => w.id);
    const defaultWhId = warehouseIds[0];
    
    if (warehouseIds.length === 0) {
        showAlert("خطأ", "يجب إضافة مستودع واحد على الأقل أولاً.", "error");
        return;
    }

    const updatedProducts = settings.products.map(p => {
        if (p.id !== productId) return p;
        let updated = { ...p };
        if (updated.hasVariants && updated.variants) {
            updated.variants = updated.variants.map(v => {
                let vCopy = { ...v, warehouseStock: { ...(v.warehouseStock || {}) } };
                Object.keys(vCopy.warehouseStock).forEach(whId => {
                    if (!warehouseIds.includes(whId)) delete vCopy.warehouseStock![whId];
                });
                let dist = Object.values(vCopy.warehouseStock).reduce((sum, val) => sum + (Number(val) || 0), 0);
                if (dist === 0 && (Number(vCopy.stockQuantity) || 0) > 0) {
                    vCopy.warehouseStock[defaultWhId] = Number(vCopy.stockQuantity);
                    dist = Number(vCopy.stockQuantity);
                }
                vCopy.stockQuantity = dist;
                vCopy.stock = dist;
                return vCopy;
            });
            updated.stockQuantity = updated.variants.reduce((t, v) => t + (v.stockQuantity || 0), 0);
            updated.stock = updated.stockQuantity;
        } else {
            updated.warehouseStock = { ...(updated.warehouseStock || {}) };
            Object.keys(updated.warehouseStock).forEach(whId => {
                if (!warehouseIds.includes(whId)) delete updated.warehouseStock![whId];
            });
            let dist = Object.values(updated.warehouseStock).reduce((sum, val) => sum + (Number(val) || 0), 0);
            if (dist === 0 && (Number(updated.stockQuantity) || 0) > 0) {
                updated.warehouseStock[defaultWhId] = Number(updated.stockQuantity);
                dist = Number(updated.stockQuantity);
            }
            updated.stockQuantity = dist;
            updated.stock = dist;
        }
        updated.inStock = (updated.stockQuantity || 0) > 0;
        return updated;
    });
    setSettings(prev => ({ ...prev, products: updatedProducts }));
    audioSynth.playTone('success');
  };

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

  const filteredProducts = settings.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterWarehouseId) {
      if (p.hasVariants && p.variants) {
        return p.variants.some(v => (v.warehouseStock?.[filterWarehouseId] ?? 0) > 0);
      } else {
        return (p.warehouseStock?.[filterWarehouseId] ?? 0) > 0;
      }
    }
    return true;
  });

  // Paginated Products list
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Reset page to 1 when search or warehouse filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterWarehouseId]);

  const inventoryFinancials = useMemo(() => {
    let totalStock = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;

    (settings.products || []).forEach(p => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const qty = v.stockQuantity ?? v.stock ?? 0;
          const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
          const price = v.price ?? p.price ?? 0;
          
          totalStock += qty;
          totalCostValue += qty * cost;
          totalSaleValue += qty * price;
        });
      } else {
        const qty = p.stockQuantity ?? p.stock ?? 0;
        const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
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
  }, [settings.products, settings.supplyOrders]);

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const productData = editingProduct || newProduct;

    if (!productData.name || (!productData.hasVariants && !productData.price)) {
        showAlert("بيانات غير مكتملة", "يرجى إدخال اسم المنتج وسعره على الأقل.", "error");
        return;
    }

    // Duplicate Check
    const normalizedName = productData.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const isDuplicate = settings.products.some(p => 
      p.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedName && 
      (!editingProduct || p.id !== editingProduct.id)
    );

    if (isDuplicate) {
      showAlert("تكرار المنتج", "يوجد منتج بنفس الاسم بالفعل. يرجى تعديل الاسم أو استخدام المنتج الحالي.", "warning");
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
        minStockLevel: productData.minStockLevel || 0,
        collectionId: productData.collectionId || undefined,
        description: productData.description || '',
        images: productData.images || [],
        thumbnail: productData.thumbnail || '',
        hasVariants: productData.hasVariants || false,
        options: productData.hasVariants ? (productData.options || []) : [],
        variants: productData.hasVariants ? (productData.variants || []) : [],
        warehouseStock: productData.warehouseStock,
        lastAudited: productData.lastAudited,
        expiryDate: productData.expiryDate,
        
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
        showAlert("تم التحديث", "تم تحديث بيانات المنتج بنجاح!", "success");
    } else {
        setSettings({ ...settings, products: [...settings.products, productToSave] });
        setIsAdding(false);
        // تشغيل الاحتفالات والسمعيات لإضافة منتج جديد
        triggerCelebration('add_product', settings);
        showAlert("تمت الإضافية", "تم إضافة المنتج الجديد إلى القائمة بنجاح!", "success");
    }
  };

  const confirmDelete = () => {
    if (productToDelete) {
        // Prevent deletion if linked to orders or supply orders
        const isLinkedToOrders = orders.some(order => order.items?.some(item => item.productId === productToDelete.id));
        const isLinkedToSupplyOrders = settings.supplyOrders?.some(order => order.items?.some(item => item.productId === productToDelete.id));

        if (isLinkedToOrders || isLinkedToSupplyOrders) {
            showAlert(
                "خطأ في الحذف",
                `لا يمكن حذف هذا المنتج لأنه مرتبط بـ ${isLinkedToOrders ? "طلبات عملاء" : ""}${isLinkedToOrders && isLinkedToSupplyOrders ? " و " : ""}${isLinkedToSupplyOrders ? "فواتير توريد" : ""} مسجلة.`,
                "error"
            );
            setProductToDelete(null);
            return;
        }

        setSettings({
            ...settings,
            products: settings.products.filter(p => p.id !== productToDelete.id)
        });
        setProductToDelete(null);
        // تشغيل الاحتفالات والسمعيات لحذف منتج
        triggerCelebration('delete_product', settings);
        showAlert("تم الحذف", "تم إزالة المنتج من القائمة بنجاح.", "success");
    }
  };

  const handleGenerateDescription = async (isEdit: boolean) => {
      const targetProduct = isEdit ? editingProduct : newProduct;
      if (!targetProduct?.name || !targetProduct?.price) {
          showAlert("بيانات غير مكتملة", "يرجى إدخال اسم المنتج وسعره أولاً لتتمكن من توليد الوصف بالذكاء الاصطناعي.", "warning");
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
      showAlert('تعديل الربط مطلوب', 'يرجى ضبط وتفعيل إعدادات الربط مع Wuilt أولاً من صفحة التطبيقات.', 'warning');
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
      showAlert('فشل الاتصال', error.message, 'error');
      setShowSelectiveSyncModal(false);
    } finally {
      setIsFetchingSelectable(false);
    }
  };

  const handleImportSelected = async () => {
    if (selectedProductIds.size === 0) {
      showAlert('تنبيه التحديد', 'يرجى اختيار منتج واحد على الأقل للاستيراد.', 'warning');
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
                'productname': 'name', 'name': 'name', 'product_name': 'name',
                'price': 'price', 'productprice': 'price', 'product_price': 'price',
                'sku': 'sku', 'productsku': 'sku', 'product_sku': 'sku',
                'costprice': 'costPrice', 'cost_price': 'costPrice', 'cost': 'costPrice',
                'stockquantity': 'stockQuantity', 'stock_quantity': 'stockQuantity', 'quantity': 'stockQuantity', 'stock': 'stockQuantity',
                'weight': 'weight', 'product_weight': 'weight',
                'description': 'description',
                'imageurl': 'image_url', 'images': 'image_url', 'image_url': 'image_url'
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

                    let sku = `SKU-${Date.now()}-${i}`;
                    if (headerMap.sku !== undefined && cells[headerMap.sku]?.trim()) {
                        sku = cells[headerMap.sku].trim();
                    }

                    let costPrice = 0;
                    if (headerMap.costPrice !== undefined && cells[headerMap.costPrice]?.trim()) {
                        const parsedCost = parseFloat(cells[headerMap.costPrice]);
                        if (!isNaN(parsedCost)) costPrice = parsedCost;
                    }

                    let stockQuantity: number | null = 100;
                    if (headerMap.stockQuantity !== undefined && cells[headerMap.stockQuantity]?.trim()) {
                        const parsedStock = parseFloat(cells[headerMap.stockQuantity]);
                        if (!isNaN(parsedStock)) stockQuantity = parsedStock;
                    }

                    let weight = 1;
                    if (headerMap.weight !== undefined && cells[headerMap.weight]?.trim()) {
                        const parsedWeight = parseFloat(cells[headerMap.weight]);
                        if (!isNaN(parsedWeight)) weight = parsedWeight;
                    }

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
                        sku,
                        costPrice,
                        stockQuantity,
                        weight,
                        hasVariants: false, options: [], variants: [], inStock: (stockQuantity === null || stockQuantity > 0),
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
    const headers = ['name', 'sku', 'price', 'costPrice', 'stockQuantity', 'weight', 'description', 'image_url'];
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
            <button onClick={restoreAllStockFromInvoices} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 rounded-lg font-bold text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                <FileText size={14} /> استعادة من الفواتير
            </button>
            <button onClick={recalculateAllStock} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900 rounded-lg font-bold text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                <RefreshCw size={14} /> مزامنة المخازن
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

      <SmartInventoryHubNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        productsCount={(settings.products || []).length}
        criticalCount={(settings.products || []).filter(p => (p.stockQuantity ?? p.stock ?? 0) === 0 || (p.minStockLevel && (p.stockQuantity ?? 0) <= p.minStockLevel)).length}
      />

      {activeTab !== 'catalog' ? (
        <SmartInventoryHubContent
          activeTab={activeTab}
          settings={settings}
          setSettings={setSettings}
          orders={orders || []}
        />
      ) : (
        <>
      {/* Inventory Financial Health Indicators Bento Bar */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-5 gap-4 my-6">
        {/* Total Cost Value / Assets invested */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-1 text-right">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
              <Layers size={14} className="text-indigo-500" />
              رأس المال المستثمر (بالتكلفة)
            </p>
            <button onClick={toggleInventoryValue} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title={showInventoryValue ? "إخفاء" : "إظهار"}>
              {showInventoryValue ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {showInventoryValue ? (
            <p className="text-base sm:text-lg font-black text-slate-800 dark:text-white tabular-nums">
              {inventoryFinancials.totalCostValue.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ج.م</span>
            </p>
          ) : (
            <p className="text-base sm:text-lg font-black text-slate-400 dark:text-slate-500 tracking-widest">
              •••••• <span className="text-[10px] font-bold">ج.م</span>
            </p>
          )}
          <span className="text-[9px] text-slate-400 block font-normal">إجمالي تكلفة شراء المخزون الحالي</span>
        </div>

        {/* Total Retail Value */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-1 text-right">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
              <DollarSign size={14} className="text-emerald-500" />
              القيمة البيعية المتوقعة
            </p>
            <button onClick={toggleInventoryValue} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title={showInventoryValue ? "إخفاء" : "إظهار"}>
              {showInventoryValue ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {showInventoryValue ? (
            <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {inventoryFinancials.totalSaleValue.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ج.م</span>
            </p>
          ) : (
            <p className="text-base sm:text-lg font-black text-slate-400 dark:text-slate-500 tracking-widest">
              •••••• <span className="text-[10px] font-bold">ج.م</span>
            </p>
          )}
          <span className="text-[9px] text-slate-400 block font-normal">إجمالي سعر بيع كافة حبات المخزون</span>
        </div>

        {/* Projected Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-1 text-right">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-bold text-slate-500 flex items-center gap-1">
              <Wand2 size={14} className="text-amber-500" />
              الأرباح المتوقعة عند التصفية
            </p>
            <button onClick={toggleInventoryValue} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title={showInventoryValue ? "إخفاء" : "إظهار"}>
              {showInventoryValue ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {showInventoryValue ? (
            <p className="text-base sm:text-lg font-black text-amber-550 dark:text-amber-400 tabular-nums">
              {inventoryFinancials.potentialProfit.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ج.م</span>
            </p>
          ) : (
            <p className="text-base sm:text-lg font-black text-slate-400 dark:text-slate-500 tracking-widest">
              •••••• <span className="text-[10px] font-bold">ج.م</span>
            </p>
          )}
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
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="بحث بالاسم أو SKU..."
              className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all dark:text-white font-medium text-sm text-right"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {(settings.warehouses || []).length > 0 && (
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">تصفية حسب المخزن:</span>
              <select
                value={filterWarehouseId}
                onChange={(e) => setFilterWarehouseId(e.target.value)}
                className="w-full sm:w-48 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-bold text-xs text-slate-700 dark:text-slate-200 select-none cursor-pointer"
              >
                <option value="">عرض مخازن الكل 🏢</option>
                {(settings.warehouses || []).map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>
          )}
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
                <th className="px-6 py-4">المخزون (الإجمالي)</th>
                <th className="px-6 py-4">سعر البيع</th>
                <th className="px-6 py-4 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={40} className="text-slate-205 dark:text-slate-700" />
                      <p>لا توجد منتجات تطابق شروط التصفية الحالية.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map(product => {
                  const collection = settings.collections.find(c => c.id === product.collectionId);
                  const isExpanded = expandedProductId === product.id;
                  
                  const isDuplicateName = settings.products.some(p => 
                    p.id !== product.id && 
                    p.name.trim().toLowerCase() !== '' &&
                    p.name.trim().toLowerCase().replace(/\s+/g, ' ') === product.name.trim().toLowerCase().replace(/\s+/g, ' ')
                  );

                  const isDuplicateSKU = settings.products.some(p => 
                    p.id !== product.id && 
                    p.sku && product.sku &&
                    p.sku.trim().toLowerCase() === product.sku.trim().toLowerCase()
                  );

                  const isDuplicate = isDuplicateName || isDuplicateSKU;

                  // Calculate distributed stock vs total (counting only active warehouses)
                  const warehouseIds = (settings.warehouses || []).map(w => w.id);
                  let distributedStock = 0;
                  if (product.hasVariants && product.variants) {
                    distributedStock = product.variants.reduce((total, v) => {
                      return total + warehouseIds.reduce((sum, id) => sum + (v.warehouseStock?.[id] || 0), 0);
                    }, 0);
                  } else {
                    distributedStock = warehouseIds.reduce((sum, id) => sum + (product.warehouseStock?.[id] || 0), 0);
                  }

                  const hasStockInconsistency = Number(product.stockQuantity || 0) !== distributedStock;
                  
                  return (
                  <React.Fragment key={product.id}>
                    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''} ${isDuplicate ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
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
                          {(!product.lastAudited || Object.keys(product.lastAudited).length === 0) && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 rounded-md font-bold flex items-center gap-1" title="لم يتم جرد هذا المنتج من قبل">
                              <AlertCircle size={10} />
                              جرد مطلوب
                            </span>
                          )}
                          {isDuplicate && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 rounded-md font-bold flex items-center gap-1" title={isDuplicateSKU ? "مكرر بنفس الكود (SKU)" : "مكرر بنفس الاسم"}>
                              <AlertCircle size={10} />
                              مكرر
                            </span>
                          )}
                          {product.id.startsWith('wuilt-') && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-md font-bold flex items-center gap-1">
                              <img src="https://wuilt.com/favicon.ico" className="w-2.5 h-2.5" referrerPolicy="no-referrer" />
                              ويلت
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {product.hasVariants && <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded font-bold">{product.variants.length} متغيرات</span>}
                          <button 
                            type="button"
                            onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                            className={`text-[10px] flex items-center gap-1 px-2 py-0.5 rounded font-extrabold transition-all border ${isExpanded ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400 dark:border-indigo-900/50 dark:hover:bg-indigo-900'}`}
                          >
                            🏢 مخازن المنتج ({distributedStock})
                          </button>
                        </div>
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
                           <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[32px] text-center">{product.stockQuantity}</span>
                                  {product.stockQuantity < 5 && <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-bold">منخفض</span>}
                               </div>
                           </div>
                        ) : (
                           <div className="flex flex-col gap-1">
                              <span className="px-2 py-1 text-xs font-bold text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/50 rounded-full border border-red-200 dark:border-red-800 w-fit">نفذ</span>
                           </div>
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
                    
                    {/* Warehouse detail expansion */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-slate-50/70 dark:bg-slate-900/30 border-t border-b border-slate-100 dark:border-slate-800 text-right">
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-4"
                          >
                            <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-800">
                              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span className="bg-indigo-600 w-1.5 h-3 rounded"></span>
                                <span>توزيع مخزون المنتج: {product.name} ({product.sku})</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => openEditModal(product)}
                                className="text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 border border-indigo-100/50 dark:border-indigo-900/50"
                              >
                                ✏️ تعديل تفصيلي في المستودعات
                              </button>
                            </div>

                            {(!settings.warehouses || settings.warehouses.length === 0) ? (
                              <div className="text-center py-4 text-slate-400 dark:text-slate-500">
                                <p className="text-sm font-bold">⚠️ لم يتم إضافة مستودعات إضافية بعد.</p>
                                <p className="text-xs mt-1">يرجى تسجيل مستودعاتك في صفحة “الموردين والمستودعات” لتتمكن من تعيين مخزون مخصص لكل مستودع.</p>
                              </div>
                            ) : (
                              <div>
                                {!product.hasVariants ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {settings.warehouses.map(wh => {
                                      const stock = product.warehouseStock?.[wh.id] ?? 0;
                                      return (
                                        <div key={wh.id} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between gap-4">
                                          <div className="min-w-0">
                                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{wh.name}</p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{wh.location || 'بدون تفاصيل عنوان'}</p>
                                          </div>
                                          <div className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${stock > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'}`}>
                                            {stock} {stock > 0 ? 'قطعة' : 'فارغ'}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">تفاصيل المتغيرات والألوان والمقاسات حسب كل مستودع:</p>
                                    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850">
                                      <table className="w-full text-xs text-right">
                                        <thead className="bg-slate-100/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                          <tr>
                                            <th className="p-2.5 font-extrabold">المتغير</th>
                                            {settings.warehouses.map(wh => (
                                              <th key={wh.id} className="p-2.5 font-extrabold text-center">{wh.name}</th>
                                            ))}
                                            <th className="p-2.5 font-extrabold text-center bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">إجمالي كمية المتغير</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {(product.variants || []).map((v, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                                              <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">
                                                {Object.values(v.options || {}).join(' / ') || v.sku}
                                              </td>
                                              {settings.warehouses.map(wh => {
                                                const stock = v.warehouseStock?.[wh.id] ?? 0;
                                                return (
                                                  <td key={wh.id} className="p-2.5 text-center">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-md font-extrabold text-xs ${stock > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700'}`}>
                                                      {stock}
                                                    </span>
                                                  </td>
                                                );
                                              })}
                                              <td className="p-2.5 text-center font-black text-slate-800 dark:text-slate-200 bg-indigo-50/20 dark:bg-indigo-900/5">
                                                {v.stockQuantity}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
            paginatedProducts.map(product => {
              const collection = settings.collections.find(c => c.id === product.collectionId);
              const isExpanded = expandedProductId === product.id;
              
              const isDuplicateName = settings.products.some(p => 
                p.id !== product.id && 
                p.name.trim().toLowerCase() !== '' &&
                p.name.trim().toLowerCase().replace(/\s+/g, ' ') === product.name.trim().toLowerCase().replace(/\s+/g, ' ')
              );

              const isDuplicateSKU = settings.products.some(p => 
                p.id !== product.id && 
                p.sku && product.sku &&
                p.sku.trim().toLowerCase() === product.sku.trim().toLowerCase()
              );

              const isDuplicate = isDuplicateName || isDuplicateSKU;

              // Calculate distributed stock vs total (counting only active warehouses)
              const warehouseIdsForMobile = (settings.warehouses || []).map(w => w.id);
              let distributedStockForMobile = 0;
              if (product.hasVariants && product.variants) {
                distributedStockForMobile = product.variants.reduce((total, v) => {
                  return total + warehouseIdsForMobile.reduce((sum, id) => sum + (v.warehouseStock?.[id] || 0), 0);
                }, 0);
              } else {
                distributedStockForMobile = warehouseIdsForMobile.reduce((sum, id) => sum + (product.warehouseStock?.[id] || 0), 0);
              }
              const hasStockInconsistencyForMobile = Number(product.stockQuantity || 0) !== distributedStockForMobile;

              return (
                <div key={product.id} className={`bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 shadow-sm text-right ${isDuplicate ? 'border-amber-400 bg-amber-50/10 dark:border-amber-900/50 dark:bg-amber-900/10' : ''}`} dir="rtl">
                  <div className="flex gap-3">
                     <div className="relative flex-shrink-0">
                        {product.thumbnail ? (
                          <img src={product.thumbnail} alt={product.name} className="w-16 h-16 rounded-lg object-cover border border-slate-100 dark:border-slate-700" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                            <ImageIcon size={20} />
                          </div>
                        )}
                        {isDuplicate && (
                            <div className="absolute -top-2 -left-2 bg-amber-500 text-white rounded-full p-1 shadow-md z-1">
                                <AlertCircle size={12} />
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
                       <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {isDuplicateName && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400 rounded-md font-bold flex items-center gap-1" title="مكرر بنفس الاسم">
                              <AlertCircle size={10} />
                              مكرر
                            </span>
                          )}
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
                         <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1.5">
                               <p className={`text-sm font-black ${product.stockQuantity > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>{product.stockQuantity}</p>
                               {product.stockQuantity < 5 && product.stockQuantity > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>}
                            </div>
                         </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile warehouse stock overview */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-2 border-t border-slate-100 dark:border-slate-800/50 space-y-2 text-right overflow-hidden"
                      >
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">مخزون المستودعات ({distributedStockForMobile}):</div>
                        {(!settings.warehouses || settings.warehouses.length === 0) ? (
                          <p className="text-[10px] text-slate-400">⚠️ لم يتم إضافة مستودعات إضافية بعد.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {!product.hasVariants ? (
                              settings.warehouses.map(wh => {
                                const stock = product.warehouseStock?.[wh.id] ?? 0;
                                return (
                                  <div key={wh.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-lg text-xs border border-slate-100 dark:border-slate-700">
                                    <span className="font-semibold text-slate-600 dark:text-slate-400">{wh.name}</span>
                                    <span className={`font-black ${stock > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{stock} قطعة</span>
                                  </div>
                                );
                              })
                            ) : (
                              (product.variants || []).map((v, idx) => (
                                <div key={idx} className="bg-slate-50/70 dark:bg-slate-800/40 p-2 rounded-lg text-xs space-y-1 border border-slate-100 dark:border-slate-700">
                                  <div className="font-black text-slate-700 dark:text-slate-300 border-b border-dashed border-slate-200 dark:border-slate-700/50 pb-0.5 text-right">
                                    {Object.values(v.options || {}).join(' / ') || v.sku}
                                  </div>
                                  {settings.warehouses.map(wh => {
                                    const stock = v.warehouseStock?.[wh.id] ?? 0;
                                    return (
                                      <div key={wh.id} className="flex justify-between items-center text-[10px] pr-2">
                                        <span className="text-slate-500">{wh.name}</span>
                                        <span className={`font-bold ${stock > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{stock} قطعة</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1">
                       <button onClick={() => handleGeneratePost(product)} disabled={isGenerating} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all" title="منشور تسويقي">
                        <Wand2 size={16} />
                       </button>
                       <button 
                         type="button"
                         onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                         className={`p-2 rounded-lg transition-all flex items-center gap-1 text-xs font-bold ${isExpanded ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40'}`}
                         title="توزيع المستودعات"
                       >
                         🏢 المخازن
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

        {/* Pagination Modern */}
        {filteredProducts.length > 0 && (
          <div className="mx-3 mt-4 mb-6 px-6 py-4 bg-white/70 dark:bg-[#0b0f19]/70 backdrop-blur-xl rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4 transition-all">
            {/* Items Per Page Selector */}
            <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-1.5 rounded-[1.25rem] border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">عدد المنتجات بالصفحة:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
              <span className="text-[11px] font-bold text-slate-400 mr-2">
                (عرض {paginatedProducts.length} من {filteredProducts.length})
              </span>
            </div>

            {/* Pagination Flow */}
            <div className="flex items-center gap-1.5 bg-slate-50/50 dark:bg-slate-900/50 p-1.5 rounded-[1.25rem] border border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2.5 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm text-slate-700 dark:text-slate-300 disabled:shadow-none bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 disabled:border-transparent disabled:bg-transparent"
              >
                <ChevronRight size={18} />
              </button>
              <div className="px-4 py-1 flex items-center gap-1.5 text-xs font-black">
                <span className="text-slate-800 dark:text-slate-200">
                  صفحة {currentPage}
                </span>
                <span className="text-slate-400">من {totalPages || 1}</span>
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages <= 1}
                className="p-2.5 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm text-slate-700 dark:text-slate-300 disabled:shadow-none bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 disabled:border-transparent disabled:bg-transparent"
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>
        )}

      </motion.div>
        </>
      )}

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

      {/* Custom Alarm / Prompt Sound Alert Modal */}
      <AnimatePresence>
        {modal && modal.show && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!modal.isConfirm) setModal(prev => ({ ...prev, show: false }));
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            {/* Alarm Dialog Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden text-right font-sans"
            >
              {/* Sound Ring Pulse Decorator with Premium Adaptive Gradient */}
              <div className={`absolute top-0 right-0 left-0 h-2 bg-gradient-to-r ${
                modal.type === 'success' ? 'from-emerald-400 via-teal-500 to-indigo-500' :
                modal.type === 'error' ? 'from-rose-400 via-red-500 to-amber-500' :
                modal.type === 'warning' ? 'from-amber-400 via-orange-500 to-red-500' :
                'from-sky-400 via-blue-500 to-indigo-500'
              }`} />
              
              <div className="flex flex-col items-center text-center mt-3">
                {/* Visual Icon based on Alarm TYPE */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg ${
                  modal.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                  modal.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' :
                  modal.type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 font-bold' :
                  'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                }`}>
                  {modal.type === 'success' && <CheckCircle size={32} />}
                  {modal.type === 'error' && <AlertCircle size={32} />}
                  {modal.type === 'warning' && <AlertCircle size={32} />}
                  {modal.type === 'info' && <Info size={32} />}
                </div>

                {/* Alarm Ringing Animation Indicator with Custom Sprung Bell */}
                <div className="flex items-center gap-1.5 mb-2 px-3.5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/60 text-[10.5px] text-slate-500 dark:text-slate-400 font-black tracking-wider border border-slate-100 dark:border-slate-800 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                  <span>تنبيه داخلي نشط</span>
                  <motion.span
                    animate={{ rotate: [0, -18, 15, -12, 10, -5, 0] }}
                    transition={{
                      repeat: Infinity,
                      repeatDelay: 1.2,
                      duration: 0.85,
                      type: "tween",
                      ease: "easeInOut"
                    }}
                    className="inline-block origin-top"
                  >
                    🔔
                  </motion.span>
                </div>

                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1 leading-tight">
                  {modal.title}
                </h3>
                
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed whitespace-pre-line text-center px-2">
                  {modal.message}
                </p>
              </div>

              {/* Confirm / Cancel Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    const onConf = modal.onConfirm;
                    setModal(prev => ({ ...prev, show: false }));
                    if (onConf) onConf();
                  }}
                  className={`flex-1 px-5 py-3 rounded-2xl text-xs font-black text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md cursor-pointer ${
                    modal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' :
                    modal.type === 'error' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10' :
                    modal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10' :
                    'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10'
                  }`}
                >
                  {modal.buttonText}
                </button>
                
                {modal.isConfirm && (
                  <button
                    onClick={() => setModal(prev => ({ ...prev, show: false }))}
                    className="flex-1 px-5 py-3 rounded-2xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

// --- Upgraded Ultra-Modern Component: ProductFormModal ---

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
    
    // Track modes: 'simple' (منتج مباشر), 'variant' (متغيرات ومقاسات), 'digital' (خدمة / منتج رقمي بدون مخزون)
    const [activeTrack, setActiveTrack] = useState<'simple' | 'variant' | 'digital'>(() => {
        if (productData.hasVariants) return 'variant';
        if (productData.stockQuantity === null && isEditing) return 'digital';
        return 'simple';
    });

    // Step wizard state: 0: البيانات والمسار, 1: التسعير ومحاكي الربحية, 2: المخزون والخيارات, 3: المعرض والذكاء الاصطناعي
    const [activeStep, setActiveStep] = useState<number>(0);
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [newImageUrl, setNewImageUrl] = useState('');

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        onSave(e);
        setIsSaving(false);
    };
    
    const thumbnailInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // Auto-calculate cost based on profit mode
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

    const handleTrackChange = (track: 'simple' | 'variant' | 'digital') => {
        setActiveTrack(track);
        if (track === 'variant') {
            setProductData((prev: Product) => ({
                ...prev,
                hasVariants: true,
                options: prev.options || [],
                variants: prev.variants || [],
                stockQuantity: prev.variants?.reduce((s, v) => s + (v.stockQuantity || 0), 0) || 0
            }));
        } else if (track === 'digital') {
            setProductData((prev: Product) => ({
                ...prev,
                hasVariants: false,
                stockQuantity: null, // Mapped to unlimited / service
                weight: 0
            }));
        } else {
            setProductData((prev: Product) => ({
                ...prev,
                hasVariants: false,
                stockQuantity: prev.stockQuantity === null ? 10 : (prev.stockQuantity || 10)
            }));
        }
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
            e.target.value = '';
        }
    };

    const removeImage = (index: number) => {
        const currentImages = [...(productData.images || [])];
        currentImages.splice(index, 1);
        updateField('images', currentImages);
    };

    const addImageUrl = () => {
        if (!newImageUrl || !newImageUrl.trim().startsWith('http')) return alert('يرجى إدخال رابط صورة صحيح يبدأ بـ http');
        updateField('images', [...(productData.images || []), newImageUrl.trim()]);
        setNewImageUrl('');
        setShowUrlInput(false);
    };

    // Smart Profit Simulator calculations
    const currentPrice = Number(productData.price) || 0;
    const currentCost = Number(productData.costPrice) || 0;
    const netProfit = currentPrice - currentCost;
    const profitMarginPercent = currentPrice > 0 ? ((netProfit / currentPrice) * 100).toFixed(1) : '0.0';
    const roiPercent = currentCost > 0 ? ((netProfit / currentCost) * 100).toFixed(1) : '0.0';
    const isProfitHealthy = netProfit > 0 && Number(profitMarginPercent) >= 20;

    // Smart warehouse distribution
    const distributeStockEqually = () => {
        const warehouses = settings.warehouses || [];
        if (warehouses.length === 0) return;
        const total = Number(productData.stockQuantity) || 0;
        const each = Math.floor(total / warehouses.length);
        const remainder = total % warehouses.length;
        const newWhStock: { [key: string]: number } = {};
        warehouses.forEach((w, i) => {
            newWhStock[w.id] = each + (i === 0 ? remainder : 0);
        });
        updateField('warehouseStock', newWhStock);
    };

    const focusStockInDefault = () => {
        const warehouses = settings.warehouses || [];
        if (warehouses.length === 0) return;
        const total = Number(productData.stockQuantity) || 0;
        const defaultWhId = warehouses[0].id;
        const newWhStock: { [key: string]: number } = { [defaultWhId]: total };
        warehouses.slice(1).forEach(w => newWhStock[w.id] = 0);
        updateField('warehouseStock', newWhStock);
    };

    const steps = [
        { id: 0, title: 'المسار والبيانات', icon: <Box size={18} /> },
        { id: 1, title: 'التسعير والربحية', icon: <Calculator size={18} /> },
        { id: 2, title: activeTrack === 'variant' ? 'المتغيرات والمقاسات' : 'المخزون والمستودعات', icon: <Layers size={18} /> },
        { id: 3, title: 'المعرض ووصف AI', icon: <Sparkles size={18} /> },
    ];

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col">
                
                {/* Sleek Header */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between flex-shrink-0 border-b border-indigo-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
                            {isEditing ? <Edit3 size={22} /> : <Plus size={22} />}
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                                {isEditing ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200">
                                    {activeTrack === 'simple' ? 'مسار قياسي مباشر' : activeTrack === 'variant' ? 'مسار متعدد المتغيرات' : 'مسار باقات وخدمات رقمية'}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">قم بتكوين المنتج واختيار المسار الأمثل وإدارة الجدوى الاقتصادية</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                        <XCircle size={26} />
                    </button>
                </div>

                {/* Step Wizard Bar */}
                <div className="bg-slate-50 dark:bg-slate-950/80 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
                    {steps.map((step, idx) => (
                        <button
                            key={step.id}
                            type="button"
                            onClick={() => setActiveStep(step.id)}
                            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex-1 justify-center whitespace-nowrap ${
                                activeStep === step.id
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-[1.02]'
                                    : activeStep > step.id
                                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === step.id ? 'bg-white/20' : activeStep > step.id ? 'bg-emerald-500/20' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                {activeStep > step.id ? <Check size={12} /> : step.id + 1}
                            </span>
                            {step.title}
                        </button>
                    ))}
                </div>

                {/* Modal Form Content */}
                <form onSubmit={handleFormSubmit} id="product-form" className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
                    
                    {/* STEP 0: Track Selection & Basic Information */}
                    {activeStep === 0 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Track Selector Cards */}
                            <div>
                                <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-3 block flex items-center gap-2">
                                    <Sliders size={16} className="text-indigo-500" />
                                    1. اختر مسار تكوين المنتج (Product Track Workflow)
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                    <div 
                                        onClick={() => handleTrackChange('simple')}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                            activeTrack === 'simple'
                                                ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-600 shadow-md shadow-indigo-500/10'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                                <Box size={20} />
                                            </div>
                                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${activeTrack === 'simple' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                                                {activeTrack === 'simple' && <Check size={12} />}
                                            </span>
                                        </div>
                                        <div className="mt-3">
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">منتج قياسي مباشر</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">سلعة مادية بمخزون وسعر موحد وسريع الإدخال بدون متغيرات معقدة.</p>
                                        </div>
                                    </div>

                                    <div 
                                        onClick={() => handleTrackChange('variant')}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                            activeTrack === 'variant'
                                                ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-600 shadow-md shadow-indigo-500/10'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                                <LayoutGrid size={20} />
                                            </div>
                                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${activeTrack === 'variant' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                                                {activeTrack === 'variant' && <Check size={12} />}
                                            </span>
                                        </div>
                                        <div className="mt-3">
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">منتج بمتغيرات ومقاسات</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">ألوان، مقاسات، وخامات مختلفة لكل منها كود SKU ورصيد مخزن منفصل.</p>
                                        </div>
                                    </div>

                                    <div 
                                        onClick={() => handleTrackChange('digital')}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                            activeTrack === 'digital'
                                                ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-600 shadow-md shadow-indigo-500/10'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                                <Zap size={20} />
                                            </div>
                                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${activeTrack === 'digital' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                                                {activeTrack === 'digital' && <Check size={12} />}
                                            </span>
                                        </div>
                                        <div className="mt-3">
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">خدمة أو منتج رقمي / باقة</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">خدمات، استشارات، اشتراكات، أو منتجات رقمية (مخزون لا نهائي وبدون شحن).</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                                <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                    <Tag size={16} className="text-indigo-500" />
                                    2. البيانات التعريفية الأساسية
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <FormInput 
                                        label="اسم المنتج / الخدمة" 
                                        icon={<Package size={16}/>} 
                                        value={productData.name || ''} 
                                        onChange={e => updateField('name', e.target.value)} 
                                        placeholder="مثال: قميص قطني فاخر / باقة تسويق شاملة"
                                        required 
                                    />
                                    <FormInput 
                                        label="كود المنتج (SKU / Barcode)" 
                                        icon={<Barcode size={16}/>} 
                                        value={productData.sku || ''} 
                                        onChange={e => updateField('sku', e.target.value)} 
                                        placeholder="مثال: PRD-2026-X01"
                                        required 
                                    />
                                    <FormInput 
                                        label="تصنيف المنتج (القسم)" 
                                        icon={<Grid3x3 size={16}/>} 
                                        value={productData.collectionId || ''} 
                                        onChange={e => updateField('collectionId', e.target.value)} 
                                        as="select"
                                    >
                                        <option value="">بدون قسم (عام)</option>
                                        {settings.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </FormInput>
                                    {activeTrack !== 'digital' && (
                                        <FormInput 
                                            label="الوزن التقريبي للشحن (كجم)" 
                                            icon={<Scale size={16}/>} 
                                            type="number" 
                                            step="0.01"
                                            value={productData.weight || ''} 
                                            onChange={e => updateField('weight', Number(e.target.value))} 
                                            placeholder="0.5"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Pricing & Smart Profitability Simulator */}
                    {activeStep === 1 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Smart Profitability Simulator Card */}
                            <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white border border-indigo-500/30 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 relative z-10">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-400/30">
                                            محاكي الجدوى الاقتصادية والربحية المباشر
                                        </span>
                                        <h4 className="text-lg font-black mt-2">تحليل الربح الصافي للعنصر الواحد</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border ${
                                            isProfitHealthy 
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                                : netProfit > 0 
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                        }`}>
                                            <TrendingUp size={14} />
                                            {isProfitHealthy ? 'هامش ربح ممتاز (صحي)' : netProfit > 0 ? 'هامش ربح متوسط' : 'تحذير: لا يوجد ربح أو خسارة'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 relative z-10">
                                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                        <span className="text-xs text-slate-300 block">سعر البيع للجمهور</span>
                                        <span className="text-xl font-black text-white mt-1 block">{currentPrice.toLocaleString()} <span className="text-xs font-normal">ج.م</span></span>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                        <span className="text-xs text-slate-300 block">تكلفة العنصر (الشراء)</span>
                                        <span className="text-xl font-black text-rose-300 mt-1 block">{currentCost.toLocaleString()} <span className="text-xs font-normal">ج.م</span></span>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                        <span className="text-xs text-slate-300 block">الربح الصافي للقطعة</span>
                                        <span className={`text-xl font-black mt-1 block ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                                        </span>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                                        <span className="text-xs text-slate-300 block">نسبة هامش الربح %</span>
                                        <span className="text-xl font-black text-amber-300 mt-1 block">{profitMarginPercent}% <span className="text-[10px] text-slate-400 block sm:inline font-normal">(ROI: {roiPercent}%)</span></span>
                                    </div>
                                </div>

                                {/* Visual Ratio Bar */}
                                {currentPrice > 0 && (
                                    <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                                        <div className="flex justify-between text-[11px] text-slate-300 mb-1 font-bold">
                                            <span>نسبة التكلفة: {((currentCost / currentPrice) * 100).toFixed(0)}%</span>
                                            <span>نسبة الربح الصافي: {profitMarginPercent}%</span>
                                        </div>
                                        <div className="h-2.5 w-full bg-rose-500/30 rounded-full overflow-hidden flex">
                                            <div 
                                                style={{ width: `${Math.min(100, Math.max(0, (currentCost / currentPrice) * 100))}%` }} 
                                                className="bg-rose-500 h-full transition-all duration-300"
                                                title="التكلفة"
                                            ></div>
                                            <div 
                                                style={{ width: `${Math.min(100, Math.max(0, (netProfit / currentPrice) * 100))}%` }} 
                                                className="bg-emerald-500 h-full transition-all duration-300"
                                                title="الربح"
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pricing Strategy Selector */}
                            <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                                <div>
                                    <label className="text-sm font-black text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                                        <Sliders size={16} className="text-indigo-500" />
                                        استراتيجية احتساب التكلفة والربح
                                    </label>
                                    <div className="grid grid-cols-3 gap-2 bg-slate-200/60 dark:bg-slate-800 p-1.5 rounded-2xl">
                                        <button 
                                            type="button" 
                                            onClick={() => updateField('profitMode', 'manual')} 
                                            className={`flex justify-center items-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${productData.profitMode === 'manual' || !productData.profitMode ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                        >
                                            <Wallet size={14}/> يدوي (مباشر)
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => updateField('profitMode', 'margin')} 
                                            className={`flex justify-center items-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${productData.profitMode === 'margin' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                        >
                                            <Percent size={14}/> هامش ربح %
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => updateField('profitMode', 'commission')} 
                                            className={`flex justify-center items-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${productData.profitMode === 'commission' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                        >
                                            <HandCoins size={14}/> عمولة مسوقين
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                                    <FormInput 
                                        label="سعر البيع الأساسي (ج.م)" 
                                        icon={<DollarSign size={16} className="text-emerald-500"/>} 
                                        type="number" 
                                        value={productData.price || ''} 
                                        onChange={e => updateField('price', Number(e.target.value))} 
                                        disabled={activeTrack === 'variant'}
                                        tooltip={activeTrack === 'variant' ? "يتم احتساب السعر من خلال جدول المتغيرات والمقاسات بالخطوة التالية" : undefined}
                                        placeholder="0.00" 
                                    />

                                    <FormInput 
                                        label="تكلفة العنصر (ج.م)" 
                                        icon={<Wallet size={16} className="text-rose-500"/>} 
                                        type="number" 
                                        value={productData.costPrice?.toFixed(2) || '0.00'} 
                                        onChange={e => updateField('costPrice', Number(e.target.value))} 
                                        disabled={productData.profitMode !== 'manual' && !!productData.profitMode} 
                                        readOnly={productData.profitMode !== 'manual' && !!productData.profitMode}
                                        placeholder="0.00" 
                                    />
                                </div>

                                {productData.profitMode === 'margin' && (
                                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl animate-in fade-in duration-200">
                                        <FormInput 
                                            label="نسبة هامش الربح المستهدفة (%)" 
                                            icon={<Percent size={16} className="text-indigo-600"/>} 
                                            type="number" 
                                            value={productData.profitPercentage || ''} 
                                            onChange={e => updateField('profitPercentage', Number(e.target.value))} 
                                            placeholder="25" 
                                        />
                                        <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-1.5 font-medium">سيقوم النظام باحتساب التكلفة تلقائياً بخصم هذه النسبة من سعر البيع.</p>
                                    </div>
                                )}

                                {productData.profitMode === 'commission' && (
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl animate-in fade-in duration-200">
                                        <FormInput label="سعر البيع الأساسي (بدون عمولة)" icon={<DollarSign size={16}/>} type="number" value={productData.basePrice || ''} onChange={e => updateField('basePrice', Number(e.target.value))} />
                                        <FormInput label="نسبة عمولة المسوق / الشريك (%)" icon={<Percent size={16}/>} type="number" value={productData.commissionPercentage || ''} onChange={e => updateField('commissionPercentage', Number(e.target.value))} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Stock & Warehouse Distribution OR Variant Matrix */}
                    {activeStep === 2 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {activeTrack === 'variant' ? (
                                <VariantManager productData={productData} setProductData={setProductData} settings={settings} />
                            ) : activeTrack === 'digital' ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800">
                                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Zap size={28} />
                                    </div>
                                    <h4 className="font-extrabold text-base text-slate-800 dark:text-white">مسار الباقات والخدمات الرقمية</h4>
                                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">هذا المنتج لا يتطلب تتبع مخزون مادي أو شحن عبر شركات التوصيل. سيكون متاحاً دائماً للبيع (مخزون لا نهائي).</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* General Stock Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <FormInput 
                                            label="إجمالي المخزون المتاح (جميع المستودعات)" 
                                            icon={<Package size={16} className="text-indigo-500"/>} 
                                            type="number" 
                                            value={productData.stockQuantity === null || productData.stockQuantity === undefined ? '' : productData.stockQuantity} 
                                            onChange={e => updateField('stockQuantity', e.target.value === '' ? null : Number(e.target.value))} 
                                            placeholder="100" 
                                            tooltip="اترك الخانة فارغة في حال كان المخزون غير محدود"
                                        />
                                        <FormInput 
                                            label="حد التنبيه عند النقص (Minimum Stock Level)" 
                                            icon={<AlertCircle size={16} className="text-amber-500"/>} 
                                            type="number" 
                                            value={productData.minStockLevel || ''} 
                                            onChange={e => updateField('minStockLevel', Number(e.target.value))}
                                            placeholder="5" 
                                            tooltip="سيتم إرسال تنبيه آلي عندما يصل رصيد هذا المنتج إلى هذا الرقم أو أقل"
                                        />
                                    </div>

                                    {/* Smart Warehouse Distribution Box */}
                                    {(settings.warehouses || []).length > 0 && productData.stockQuantity !== null && (
                                        <div className="p-5 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 border border-amber-200/70 dark:border-amber-900/40 rounded-3xl space-y-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                <div>
                                                    <h5 className="text-sm font-black text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                                        <Layers size={16} className="text-amber-600"/>
                                                        توزيع المخزون على المستودعات والفروع
                                                    </h5>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">حدد رصيد كل مستودع بدقة أو استخدم التوزيع الآلي السريع</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        type="button" 
                                                        onClick={distributeStockEqually}
                                                        className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-300/40 transition-colors"
                                                    >
                                                        ⚡ توزيع بالتساوي
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={focusStockInDefault}
                                                        className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-300/40 transition-colors"
                                                    >
                                                        🏢 تركيز بالمخزن الرئيسي
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                {(settings.warehouses || []).map((wh, idx) => {
                                                    const currentWhStock = productData.warehouseStock?.[wh.id] ?? 0;
                                                    return (
                                                        <div key={wh.id} className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <span className="text-xs font-bold text-slate-800 dark:text-white block truncate flex items-center gap-1.5">
                                                                    <span className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-indigo-500' : 'bg-slate-400'}`}></span>
                                                                    {wh.name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 block truncate">{wh.isDefault ? 'المستودع الرئيسي' : 'فرع إضافي'}</span>
                                                            </div>
                                                            <input 
                                                                type="number" 
                                                                value={currentWhStock || ''} 
                                                                onChange={(e) => {
                                                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                                    const currentStock = productData.warehouseStock || {};
                                                                    const newWhStock = { ...currentStock, [wh.id]: val };
                                                                    const newTotal = Object.values(newWhStock).reduce((sum, v) => sum + (Number(v) || 0), 0);
                                                                    updateField('warehouseStock', newWhStock);
                                                                    updateField('stockQuantity', newTotal);
                                                                }}
                                                                className="w-20 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-center outline-none focus:ring-2 focus:ring-amber-500/30"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <FormInput 
                                        label="تاريخ انتهاء الصلاحية (إن وجد)" 
                                        icon={<Calendar size={16} className="text-rose-500"/>} 
                                        type="date" 
                                        value={productData.expiryDate || ''} 
                                        onChange={e => updateField('expiryDate', e.target.value)} 
                                        tooltip="يساعد النظام في إصدار تنبيهات قبل موعد انتهاء الصلاحية بـ 30 يوماً"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Gallery & AI Content Assistant */}
                    {activeStep === 3 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            
                            {/* AI Content Assistant Banner */}
                            <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white border border-purple-500/30 shadow-lg relative overflow-hidden">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                                            <Wand2 size={24} className={isGenerating ? "animate-spin" : ""} />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                                                المساعد الذكي لصياغة الوصف والـ SEO (Gemini AI)
                                                <span className="text-[9px] bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/30">AI Powered</span>
                                            </h4>
                                            <p className="text-xs text-purple-200/80 mt-0.5">اصنع وصفاً تسويقياً جذاباً ومحسناً لمحركات البحث بضغطة زر واحدة</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => onGenerateDescription(isEditing)} 
                                        disabled={isGenerating} 
                                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-purple-900/50 transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                                    >
                                        {isGenerating ? <RefreshCw size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                                        {isGenerating ? 'جاري الصياغة الذكية...' : 'توليد وصف تسويقي الآن'}
                                    </button>
                                </div>
                            </div>

                            {/* Description textarea */}
                            <div>
                                <FormInput 
                                    as="textarea" 
                                    label="الوصف التفصيلي والمميزات التسويقية" 
                                    icon={<FileText size={16} className="text-indigo-500"/>} 
                                    value={productData.description || ''} 
                                    onChange={e => updateField('description', e.target.value)} 
                                    placeholder="اكتب وصفاً جذاباً لمنتجك يوضح مميزاته، خاماته، وفوائده للعميل..." 
                                    className="h-36 leading-relaxed" 
                                />
                            </div>

                            {/* Modern Photo Gallery Uploader */}
                            <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        <ImageIcon size={18} className="text-indigo-500" />
                                        معرض صور المنتج (الرئيسية والإضافية)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowUrlInput(!showUrlInput)}
                                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                        >
                                            <Globe size={14} /> إضافة برابط URL
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => galleryInputRef.current?.click()}
                                            className="text-xs font-bold text-white bg-indigo-600 px-3.5 py-1.5 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-sm"
                                        >
                                            <Upload size={14} /> رفع من الجهاز
                                        </button>
                                    </div>
                                </div>

                                {showUrlInput && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex gap-2 animate-in slide-in-from-top-2 duration-200">
                                        <input 
                                            type="url" 
                                            value={newImageUrl} 
                                            onChange={e => setNewImageUrl(e.target.value)} 
                                            placeholder="https://example.com/image.jpg" 
                                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-xs font-bold outline-none"
                                        />
                                        <button type="button" onClick={addImageUrl} className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-colors">إضافة الصورة</button>
                                    </div>
                                )}

                                <input 
                                    type="file" 
                                    ref={galleryInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    multiple
                                    onChange={(e) => handleFileUpload(e, 'images')} 
                                />
                                <input 
                                    type="file" 
                                    ref={thumbnailInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => handleFileUpload(e, 'thumbnail')} 
                                />

                                {/* Visual Image Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                    {/* Thumbnail Cover Card */}
                                    <div 
                                        onClick={() => thumbnailInputRef.current?.click()}
                                        className="aspect-square rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/10 hover:bg-indigo-50/80 transition-all cursor-pointer relative overflow-hidden flex flex-col items-center justify-center p-3 group"
                                    >
                                        {productData.thumbnail ? (
                                            <>
                                                <img src={productData.thumbnail} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-black">
                                                    تغيير الصورة الرئيسية
                                                </div>
                                                <span className="absolute bottom-1.5 right-1.5 bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow">الرئيسية</span>
                                            </>
                                        ) : (
                                            <div className="text-center text-indigo-500">
                                                <FileUp size={24} className="mx-auto mb-1 group-hover:scale-110 transition-transform" />
                                                <span className="text-[11px] font-extrabold block">الصورة الرئيسية</span>
                                                <span className="text-[9px] text-slate-400 block mt-0.5">اضغط للرفع</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Gallery Images */}
                                    {(productData.images || []).map((imgUrl, index) => (
                                        <div key={index} className="aspect-square rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 relative overflow-hidden group shadow-sm">
                                            <img src={imgUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            <button 
                                                type="button" 
                                                onClick={() => removeImage(index)}
                                                className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg"
                                                title="حذف الصورة"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => updateField('thumbnail', imgUrl)}
                                                className="absolute bottom-1.5 inset-x-1.5 py-1 bg-black/70 text-white text-[9px] font-extrabold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-center hover:bg-indigo-600"
                                            >
                                                تعيين كرئيسية
                                            </button>
                                        </div>
                                    ))}

                                    {/* Add More Photo Box */}
                                    <div 
                                        onClick={() => galleryInputRef.current?.click()}
                                        className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-400 transition-all cursor-pointer flex flex-col items-center justify-center p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 group"
                                    >
                                        <Plus size={24} className="group-hover:scale-110 transition-transform mb-1" />
                                        <span className="text-[11px] font-bold">إضافة المزيد</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </form>

                {/* Footer Navigation & Save */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {activeStep > 0 && (
                            <button 
                                type="button" 
                                onClick={() => setActiveStep(prev => prev - 1)} 
                                className="px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-all flex items-center gap-1.5"
                            >
                                <ArrowRight size={16} /> السابق
                            </button>
                        )}
                        <button 
                            type="button" 
                            onClick={onClose} 
                            disabled={isSaving} 
                            className="px-4 py-2.5 bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 rounded-2xl font-bold text-xs sm:text-sm transition-all"
                        >
                            إلغاء
                        </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {activeStep < 3 ? (
                            <button 
                                type="button" 
                                onClick={() => setActiveStep(prev => prev + 1)} 
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95"
                            >
                                التالي <ArrowLeft size={16} />
                            </button>
                        ) : (
                            <button 
                                type="submit" 
                                form="product-form" 
                                disabled={isSaving} 
                                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/30 active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} 
                                {isSaving ? 'جاري الحفظ...' : (isEditing ? 'حفظ التعديلات' : 'اعتماد وحفظ المنتج')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Upgraded Component: VariantManager ---
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

            const existingVariant = (productData.variants || []).find((v: any) => {
                return JSON.stringify(v.options) === JSON.stringify(options);
            });

            return {
                id: existingVariant?.id || `${Date.now()}-${index}`,
                options: options,
                sku: existingVariant?.sku || `${productData.sku || 'SKU'}-${comboArray.join('-')}`,
                price: existingVariant?.price || productData.price || 0,
                stockQuantity: existingVariant?.stockQuantity || 0,
                warehouseStock: existingVariant?.warehouseStock || {}
            };
        });

        const totalStock = newVariants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
        setProductData((prev: Product) => ({ ...prev, variants: newVariants, stockQuantity: totalStock }));
    };

    const updateVariant = (variantId: string, field: keyof ProductVariant | 'warehouseStock', value: any) => {
        const updatedVariants = productData.variants.map((v: ProductVariant) => {
            if (v.id === variantId) {
                if (field === 'warehouseStock') {
                    return { ...v, warehouseStock: value };
                }
                return { ...v, [field]: value };
            }
            return v;
        });
        const totalStock = updatedVariants.reduce((sum: number, v: ProductVariant) => sum + (v.stockQuantity || 0), 0);
        setProductData((prev: Product) => ({ ...prev, variants: updatedVariants, stockQuantity: totalStock }));
    };

    const applyBulkPrice = (val: number) => {
        const updated = (productData.variants || []).map((v: ProductVariant) => ({ ...v, price: val }));
        setProductData((prev: Product) => ({ ...prev, variants: updated }));
    };

    const applyBulkStock = (val: number) => {
        const updated = (productData.variants || []).map((v: ProductVariant) => ({ ...v, stockQuantity: val }));
        const totalStock = updated.reduce((sum: number, v: ProductVariant) => sum + (v.stockQuantity || 0), 0);
        setProductData((prev: Product) => ({ ...prev, variants: updated, stockQuantity: totalStock }));
    };

    return (
        <div className="p-5 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <LayoutGrid size={18} className="text-purple-600" />
                        منشئ مصفوفة المتغيرات والمقاسات
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">قم باختيار الخصائص المتوفرة وتوليد الأصناف تلقائياً مع تخصيص الأرصدة</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2.5 block">1. اختر الخصائص المتوفرة لهذا المنتج:</label>
                    <div className="flex flex-wrap gap-2.5">
                        {(settings.globalOptions || []).map((opt: any) => {
                            const isSelected = (productData.options || []).includes(opt.name);
                            return (
                                <label key={opt.id} className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border-2 transition-all cursor-pointer select-none ${isSelected ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-600 text-purple-700 dark:text-purple-300 font-extrabold shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:border-purple-300'}`}>
                                    <input type="checkbox" checked={isSelected} onChange={e => handleOptionToggle(opt.name, e.target.checked)} className="rounded text-purple-600 h-4 w-4 focus:ring-purple-500" />
                                    <span>{opt.name}</span>
                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-md font-normal">{(opt.values || []).length} قيم</span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <button 
                    type="button" 
                    onClick={generateVariants} 
                    disabled={(productData.options || []).length === 0} 
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                    <ChevronsUpDown size={18} /> 2. توليد وتحديث مصفوفة المتغيرات
                </button>

                {(productData.variants || []).length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <label className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-emerald-500" /> 3. قائمة المتغيرات المولدة ({(productData.variants || []).length} صنف)
                            </label>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">تطبيق سريع للكل:</span>
                                <input 
                                    type="number" 
                                    placeholder="سعر موحد" 
                                    onBlur={(e) => { if(e.target.value) applyBulkPrice(Number(e.target.value)); e.target.value = ''; }} 
                                    className="w-24 p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-center" 
                                />
                                <input 
                                    type="number" 
                                    placeholder="رصيد موحد" 
                                    onBlur={(e) => { if(e.target.value) applyBulkStock(Number(e.target.value)); e.target.value = ''; }} 
                                    className="w-24 p-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-center" 
                                />
                            </div>
                        </div>

                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                            {productData.variants.map((variant: ProductVariant) => (
                                <div key={variant.id} className="p-3.5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-2.5 hover:border-purple-300 transition-all">
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center">
                                        <div className="font-extrabold text-sm text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800/60 text-center truncate">
                                            {Object.values(variant.options).join(' - ')}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">SKU</span>
                                            <input type="text" value={variant.sku} onChange={e => updateVariant(variant.id, 'sku', e.target.value)} placeholder="SKU" className="w-full text-xs font-bold pr-10 pl-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-purple-500" />
                                        </div>
                                        <div className="relative">
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">السعر</span>
                                            <input type="number" value={variant.price} onChange={e => updateVariant(variant.id, 'price', Number(e.target.value))} placeholder="السعر" className="w-full text-xs font-black pr-11 pl-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-purple-500" />
                                        </div>
                                        <div className="relative">
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">الكمية</span>
                                            <input type="number" value={variant.stockQuantity === null || variant.stockQuantity === undefined ? '' : variant.stockQuantity} onChange={e => updateVariant(variant.id, 'stockQuantity', e.target.value === '' ? null : Number(e.target.value))} placeholder="الكمية" className="w-full text-xs font-black pr-11 pl-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-purple-500" />
                                        </div>
                                    </div>

                                    {(settings.warehouses || []).length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                            <span className="text-[10px] font-extrabold text-slate-400">توزيع المستودعات:</span>
                                            {(settings.warehouses || []).map(wh => (
                                                <div key={wh.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[80px]">{wh.name}:</span>
                                                    <input 
                                                        type="number" 
                                                        value={variant.warehouseStock?.[wh.id] ?? ''} 
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                            const currentStock = variant.warehouseStock || {};
                                                            const newWhStock = { ...currentStock, [wh.id]: val };
                                                            updateVariant(variant.id, 'warehouseStock', newWhStock);
                                                            const totalVarStock = Object.values(newWhStock).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
                                                            updateVariant(variant.id, 'stockQuantity', totalVarStock);
                                                        }}
                                                        className="w-12 bg-transparent text-xs font-black border-none outline-none p-0 text-center text-indigo-600 dark:text-indigo-400"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
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
            <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    {icon} {label}
                    {tooltip && (
                        <div className="relative group inline-flex">
                            <Info size={14} className="text-slate-400 hover:text-indigo-500 cursor-help transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl z-50 text-center font-normal leading-relaxed border border-slate-700">
                                {tooltip}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                            </div>
                        </div>
                    )}
                </label>
                {actionButton}
            </div>
            <Component {...props} className={`block w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all font-bold text-xs sm:text-sm disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-400 ${props.className || ''}`} />
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