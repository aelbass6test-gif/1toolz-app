import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Quotation, QuotationStatus, Order, OrderItem, Product, Settings, Store, User, CustomerProfile } from '../types';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  Truck, 
  XCircle, 
  AlertCircle, 
  Printer, 
  Share2, 
  ArrowRight, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  ExternalLink, 
  MessageCircle, 
  Phone, 
  MapPin, 
  Calendar, 
  Coins, 
  Sparkles, 
  Package, 
  ChevronDown, 
  X,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  Database,
  ShieldCheck,
  RefreshCw,
  Info,
  HelpCircle,
  Building
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { EGYPT_GOVERNORATES } from '../constants';
import { 
  isBosta, 
  getCompanySpecificFees, 
  getStandardShippingFee, 
  calculateInsuranceFee, 
  calculateBostaVat, 
  calculateCodFee, 
  getOrderProductCost 
} from '../utils/financials';

interface QuotationsPageProps {
  quotations: Quotation[];
  setQuotations: (updater: (prev: Quotation[]) => Quotation[]) => void;
  orders: Order[];
  setOrders: (updater: (prev: Order[]) => Order[]) => void;
  settings: Settings;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  products?: Product[];
  activeStore?: Store | null;
  currentUser?: User | null;
  treasury?: any;
  setTreasury?: any;
  customers?: CustomerProfile[];
  setCustomers?: any;
  forceSync?: (customStoreData?: any, customUsers?: any) => Promise<void>;
}

export const QuotationsPage: React.FC<QuotationsPageProps> = ({
  quotations = [],
  setQuotations,
  orders = [],
  setOrders,
  settings,
  activeStore,
  currentUser,
  customers = [],
  setCustomers,
  forceSync,
  treasury,
  setTreasury
}) => {
  const navigate = useNavigate();

  // Tab & Search filters
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'converted' | 'expiring_soon' | 'expired' | 'trash'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);
  const [convertModalQuotation, setConvertModalQuotation] = useState<Quotation | null>(null);
  const [posModalQuotation, setPosModalQuotation] = useState<Quotation | null>(null);
  const [posPaymentMethod, setPosPaymentMethod] = useState<'pos_cash' | 'pos_digital'>('pos_cash');
  const [posAccountId, setPosAccountId] = useState<string>('1');
  const [conversionShippingCompany, setConversionShippingCompany] = useState('');
  const [conversionOrderStatus, setConversionOrderStatus] = useState<'في_انتظار_المكالمة' | 'قيد_التنفيذ'>('قيد_التنفيذ');
  const [conversionCodMode, setConversionCodMode] = useState<'zero' | 'full' | 'remaining' | 'custom'>('zero');
  const [conversionCustomCodAmount, setConversionCustomCodAmount] = useState<number>(0);
  const [conversionIsInsured, setConversionIsInsured] = useState<boolean>(true);
  const [conversionIncludeInspection, setConversionIncludeInspection] = useState<boolean>(true);
  const [convertedSuccessOrderNumber, setConvertedSuccessOrderNumber] = useState<string | null>(null);
  const [showDbInfoModal, setShowDbInfoModal] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Available Shipping Companies List (mirrors OrderForm exactly)
  const availableShippingCompanies = useMemo(() => {
    const defaultApiCarriers = ["بوسطة", "تربو"];
    const optionsKeys = Object.keys(settings?.shippingOptions || {});
    const activeKeys = Object.keys(settings?.activeCompanies || {});
    const feeKeys = Object.keys(settings?.companySpecificFees || {});
    const nameKeys = settings?.companyNames 
      ? (Array.isArray(settings.companyNames) ? settings.companyNames : Object.keys(settings.companyNames)) 
      : [];

    const allSet = new Set<string>([
      ...defaultApiCarriers,
      ...optionsKeys,
      ...activeKeys,
      ...feeKeys,
      ...nameKeys,
    ]);

    const list = Array.from(allSet).filter((company) => {
      if (!company || company.trim() === '') return false;
      return settings?.activeCompanies?.[company] !== false;
    });

    return list.length > 0 ? list : ["بوسطة", "شحن المتجر الداخلي"];
  }, [settings?.shippingOptions, settings?.activeCompanies, settings?.companySpecificFees, settings?.companyNames]);

  // Copy toast feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const triggerCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Form State for Create / Edit
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formShippingCompany, setFormShippingCompany] = useState<string>('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCustomerPhone2, setFormCustomerPhone2] = useState('');
  const [formGovernorate, setFormGovernorate] = useState('القاهرة');
  const [formCity, setFormCity] = useState('مدينة نصر');
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [customCityName, setCustomCityName] = useState('');
  const [formCustomerAddress, setFormCustomerAddress] = useState('');
  const [formBuildingNumber, setFormBuildingNumber] = useState('');
  const [formFloorNumber, setFormFloorNumber] = useState('');
  const [formApartmentNumber, setFormApartmentNumber] = useState('');
  const [formValidDays, setFormValidDays] = useState(7);
  const [formShippingFee, setFormShippingFee] = useState(50);
  const [formDiscount, setFormDiscount] = useState(0);
  const [formRoundingAdjustment, setFormRoundingAdjustment] = useState<number>(0);
  const [formTargetTotal, setFormTargetTotal] = useState<number | null>(null);
  const [formCombineShippingFees, setFormCombineShippingFees] = useState<boolean>(true);
  const [formAdvancePayment, setFormAdvancePayment] = useState(0);
  const [formNotes, setFormNotes] = useState('');
  const [formTerms, setFormTerms] = useState('الأسعار سارية حتى تاريخ انتهاء صلاحية العرض الموضح أعلاه. يتم شحن الطلب بعد التأكيد النهائي.');
  const [formItems, setFormItems] = useState<OrderItem[]>([]);
  const [formIncludeInspectionFee, setFormIncludeInspectionFee] = useState<boolean>(true);
  const [formAllowOpenShipment, setFormAllowOpenShipment] = useState<boolean>(true);
  const [formIsInsured, setFormIsInsured] = useState<boolean>(true);

  // Derived effective city & location
  const effectiveCity = isCustomCity ? customCityName.trim() : formCity.trim();
  const formCustomerCity = effectiveCity ? `${formGovernorate} - ${effectiveCity}` : formGovernorate;

  // Available cities for the selected governorate
  const currentGovernorateCities = useMemo(() => {
    const companyOpts = settings?.shippingOptions?.[formShippingCompany];
    if (companyOpts && Array.isArray(companyOpts)) {
      const matchGov = companyOpts.find(o => o.label === formGovernorate);
      if (matchGov && matchGov.cities && matchGov.cities.length > 0) {
        return matchGov.cities.map((c: any) => typeof c === 'string' ? c : c.name);
      }
    }
    const foundGov = EGYPT_GOVERNORATES.find(g => g.name === formGovernorate);
    return foundGov?.cities || [];
  }, [formGovernorate, formShippingCompany, settings?.shippingOptions]);

  // Calculate default shipping based on company, governorate, and city from settings
  const getCityShippingFee = (companyName: string, governorateName: string, cityName?: string): number => {
    const opts = settings?.shippingOptions?.[companyName];
    if (opts && Array.isArray(opts)) {
      const matchedGov = opts.find(o => o.label === governorateName);
      if (matchedGov) {
        if (cityName && matchedGov.cities) {
          const cityOpt = matchedGov.cities.find((c: any) => (typeof c === 'string' ? c : c.name) === cityName);
          if (cityOpt && typeof cityOpt !== 'string') {
            if (!cityOpt.useParentFees && cityOpt.deliveryPrice !== undefined && cityOpt.deliveryPrice !== null) {
              return Number(cityOpt.deliveryPrice) || 0;
            }
          }
        }
        if (matchedGov.deliveryPrice !== undefined && matchedGov.deliveryPrice !== null) {
          return Number(matchedGov.deliveryPrice) || 0;
        }
      }
    }
    const isCairoGiza = ['القاهرة', 'الجيزة'].includes(governorateName);
    const isAlexDelta = ['الإسكندرية', 'الدقهلية', 'الشرقية', 'المنوفية', 'القليوبية', 'الغربية', 'البحيرة', 'دمياط', 'كفر الشيخ'].includes(governorateName);
    const isCanal = ['بورسعيد', 'الإسماعيلية', 'السويس'].includes(governorateName);
    const isUpperEgypt = ['بني سويف', 'الفيوم', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان'].includes(governorateName);
    return isCairoGiza ? 45 : isAlexDelta ? 55 : isCanal ? 55 : isUpperEgypt ? 70 : 85;
  };

  const handleGovernorateChange = (newGov: string) => {
    setFormGovernorate(newGov);
    setIsCustomCity(false);
    setCustomCityName('');
    const found = EGYPT_GOVERNORATES.find(g => g.name === newGov);
    const firstCity = found?.cities && found.cities.length > 0 ? found.cities[0] : '';
    setFormCity(firstCity);
    setFormShippingFee(getCityShippingFee(formShippingCompany, newGov, firstCity));
  };

  const handleCityChange = (newCity: string) => {
    if (newCity === '__custom__') {
      setIsCustomCity(true);
      setCustomCityName('');
    } else {
      setIsCustomCity(false);
      setFormCity(newCity);
      setFormShippingFee(getCityShippingFee(formShippingCompany, formGovernorate, newCity));
    }
  };

  const handleCustomCityInput = (val: string) => {
    setCustomCityName(val);
    setFormCity(val);
  };

  // Item Picker in Modal
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState<number | ''>('');
  const [customItemQty, setCustomItemQty] = useState(1);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const defaultCompany = availableShippingCompanies[0] || 'بوسطة';
    setEditingQuotation(null);
    setFormCustomerName('');
    setFormShippingCompany(defaultCompany);
    setFormCustomerPhone('');
    setFormCustomerPhone2('');
    setFormGovernorate('القاهرة');
    setFormCity('مدينة نصر');
    setIsCustomCity(false);
    setCustomCityName('');
    setFormCustomerAddress('');
    setFormBuildingNumber('');
    setFormFloorNumber('');
    setFormApartmentNumber('');
    setFormValidDays(7);
    setFormShippingFee(getCityShippingFee(defaultCompany, 'القاهرة', 'مدينة نصر'));
    setFormDiscount(0);
    setFormRoundingAdjustment(0);
    setFormTargetTotal(null);
    setFormCombineShippingFees(true);
    setFormAdvancePayment(0);
    setFormNotes('');
    setFormTerms('الأسعار سارية حتى تاريخ انتهاء صلاحية العرض الموضح أعلاه. يتم شحن الطلب بعد التأكيد النهائي من العميل.');
    setFormItems([]);
    setFormIncludeInspectionFee(settings?.enableInspection !== false);
    setFormAllowOpenShipment(true);
    setFormIsInsured(settings?.enableInsurance !== false);
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (q: Quotation) => {
    const company = q.shippingCompany || availableShippingCompanies[0] || 'بوسطة';
    setEditingQuotation(q);
    setFormCustomerName(q.customerName);
    setFormShippingCompany(company);
    setFormCustomerPhone(q.customerPhone);
    setFormCustomerPhone2(q.customerPhone2 || '');
    
    // Resolve governorate and city accurately
    let gov = q.governorate || '';
    let cty = q.city || '';
    if (!gov && q.customerCity) {
      if (q.customerCity.includes(' - ')) {
        const parts = q.customerCity.split(' - ');
        gov = parts[0].trim();
        cty = parts[1]?.trim() || '';
      } else {
        const matched = EGYPT_GOVERNORATES.find(g => g.name === q.customerCity);
        if (matched) {
          gov = matched.name;
          cty = matched.cities[0] || '';
        } else {
          gov = 'القاهرة';
          cty = q.customerCity;
        }
      }
    }
    gov = gov || 'القاهرة';
    cty = cty || 'مدينة نصر';

    setFormGovernorate(gov);
    setFormCity(cty);

    const govCities = EGYPT_GOVERNORATES.find(g => g.name === gov)?.cities || [];
    if (cty && !govCities.includes(cty)) {
      setIsCustomCity(true);
      setCustomCityName(cty);
    } else {
      setIsCustomCity(false);
      setCustomCityName('');
    }

    setFormCustomerAddress(q.customerAddress || '');
    setFormBuildingNumber(q.buildingNumber || '');
    setFormFloorNumber(q.floorNumber || '');
    setFormApartmentNumber(q.apartmentNumber || '');
    
    // calculate remaining days
    const diffDays = Math.max(1, Math.ceil((new Date(q.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    setFormValidDays(diffDays);
    setFormShippingFee(q.shippingFee);
    setFormDiscount(q.discount);
    setFormRoundingAdjustment(q.roundingAdjustment || 0);
    setFormTargetTotal(q.total || null);
    setFormCombineShippingFees(q.combineShippingFeesInPrint !== false);
    setFormAdvancePayment(q.advancePayment || 0);
    setFormNotes(q.notes || '');
    setFormTerms(q.terms || '');
    setFormItems(q.items || []);
    setFormIncludeInspectionFee(q.includeInspectionFee !== false);
    setFormAllowOpenShipment(q.allowOpenShipment !== false);
    setFormIsInsured(q.isInsured !== false);
    setShowCreateModal(true);
  };

  // Add Product from Catalog to Items
  const handleAddProductFromCatalog = () => {
    if (!selectedProductId) return;
    const prod = (settings?.products || []).find(p => p.id === selectedProductId);
    if (!prod) return;

    const existingIndex = formItems.findIndex(i => i.productId === prod.id);
    if (existingIndex > -1) {
      setFormItems(prev => prev.map((item, idx) => idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setFormItems(prev => [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          quantity: 1,
          price: prod.price || 0,
          cost: prod.costPrice || 0,
          weight: prod.weight || 1,
          thumbnail: prod.thumbnail || (prod.images && prod.images[0]) || ''
        }
      ]);
    }
    setSelectedProductId('');
  };

  // Add Custom Ad-hoc Item
  const handleAddCustomItem = () => {
    if (!customItemName.trim() || customItemPrice === '' || Number(customItemPrice) < 0) return;
    setFormItems(prev => [
      ...prev,
      {
        productId: `custom-${Date.now()}`,
        name: customItemName.trim(),
        quantity: Math.max(1, Number(customItemQty)),
        price: Number(customItemPrice),
        cost: 0,
        weight: 1,
        thumbnail: ''
      }
    ]);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty(1);
  };

  // Form Totals Calculation
  const formSubtotal = useMemo(() => {
    return formItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [formItems]);

  // Company-Specific Fees Calculation for Quotation (Mirrors CreateOrderPage)
  const companyFeesBreakdown = useMemo(() => {
    const company = formShippingCompany || availableShippingCompanies[0] || 'بوسطة';
    const compFees = getCompanySpecificFees(settings, company);
    const useCustom = compFees?.useCustomFees ?? false;

    // 1. Inspection Fee (رسوم الفحص والمعاينة عند الاستلام)
    const inspectionFee = formIncludeInspectionFee && formAllowOpenShipment
      ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? (settings?.inspectionFee || 0) : 0))
      : 0;

    // 2. Insurance Fee (رسوم التأمين على الشحنة)
    const insuranceRate = formIsInsured
      ? (useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings?.enableInsurance ? (settings?.insuranceFeePercent || 0) : 0))
      : 0;

    const dummyOrder = {
      id: 'dummy',
      orderNumber: '0',
      date: new Date().toISOString(),
      customerName: formCustomerName,
      customerPhone: formCustomerPhone,
      customerAddress: formCustomerAddress,
      customerCity: formCustomerCity,
      city: formCustomerCity,
      shippingCompany: company,
      shippingFee: Number(formShippingFee) || 0,
      productPrice: formSubtotal,
      discount: Number(formDiscount) || 0,
      items: formItems,
      isInsured: formIsInsured,
      includeInspectionFee: formIncludeInspectionFee,
      allowOpenShipment: formAllowOpenShipment,
      status: 'قيد_التنفيذ'
    } as unknown as Order;

    const insuranceFee = formIsInsured ? calculateInsuranceFee(dummyOrder, insuranceRate, settings) : 0;

    // 3. VAT on Shipping & Insurance
    const vatValue = calculateBostaVat(dummyOrder, insuranceFee, settings);

    // 4. COD Fee if enabled
    const codFee = calculateCodFee(dummyOrder, settings);

    // Total Company Extra Expenses
    const totalExtraFees = inspectionFee + insuranceFee + vatValue;

    return {
      company,
      useCustom,
      inspectionFee,
      insuranceRate,
      insuranceFee,
      vatValue,
      codFee,
      totalExtraFees
    };
  }, [
    formShippingCompany,
    availableShippingCompanies,
    settings,
    formIncludeInspectionFee,
    formAllowOpenShipment,
    formIsInsured,
    formCustomerName,
    formCustomerPhone,
    formCustomerAddress,
    formCustomerCity,
    formShippingFee,
    formSubtotal,
    formDiscount,
    formItems
  ]);

  const rawTotalBeforeRounding = useMemo(() => {
    return formSubtotal + Number(formShippingFee) - Number(formDiscount) + companyFeesBreakdown.totalExtraFees;
  }, [formSubtotal, formShippingFee, formDiscount, companyFeesBreakdown.totalExtraFees]);

  const formTotal = useMemo(() => {
    if (formTargetTotal !== null && !isNaN(formTargetTotal) && formTargetTotal >= 0) {
      return Math.max(0, formTargetTotal);
    }
    return Math.max(0, rawTotalBeforeRounding - Number(formRoundingAdjustment));
  }, [rawTotalBeforeRounding, formTargetTotal, formRoundingAdjustment]);

  const formRemaining = useMemo(() => {
    return Math.max(0, formTotal - Number(formAdvancePayment));
  }, [formTotal, formAdvancePayment]);

  // Generate Quotation Number
  const generateNextQuotationNumber = () => {
    const existingNumbers = quotations.map(q => {
      const match = q.quotationNumber?.match(/\d+/);
      return match ? parseInt(match[0], 10) : null;
    }).filter((n): n is number => n !== null);
    const nextSeq = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1001;
    return `QT-${nextSeq}`;
  };

  // Save Quotation
  const handleSaveQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim() || !formCustomerPhone.trim()) {
      alert('يرجى إدخال اسم العميل ورقم الهاتف');
      return;
    }
    if (formItems.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل في عرض السعر');
      return;
    }

    const now = new Date();
    const expiryDate = new Date(now.getTime() + formValidDays * 24 * 60 * 60 * 1000);
    const company = formShippingCompany || availableShippingCompanies[0] || 'بوسطة';

    const effectiveCity = (isCustomCity ? customCityName.trim() : formCity.trim()) || formGovernorate;
    const fullLocationDisplay = `${formGovernorate} - ${effectiveCity}`;

    // Detailed address line assembly if building/floor/apt are specified
    const addressDetailsArray = [
      formCustomerAddress.trim(),
      formBuildingNumber.trim() ? `عمارة ${formBuildingNumber.trim()}` : '',
      formFloorNumber.trim() ? `دور ${formFloorNumber.trim()}` : '',
      formApartmentNumber.trim() ? `شقة ${formApartmentNumber.trim()}` : ''
    ].filter(Boolean);
    const finalAddressStr = addressDetailsArray.length > 0 ? addressDetailsArray.join('، ') : (formCustomerAddress.trim() || 'عنوان محدد بعرض السعر');

    if (editingQuotation) {
      // Update existing
      const updated: Quotation = {
        ...editingQuotation,
        customerName: formCustomerName.trim(),
        customerPhone: formCustomerPhone.trim(),
        customerPhone2: formCustomerPhone2.trim() || undefined,
        customerCity: fullLocationDisplay,
        governorate: formGovernorate,
        city: effectiveCity,
        shippingArea: formGovernorate,
        customerAddress: finalAddressStr,
        buildingNumber: formBuildingNumber.trim() || undefined,
        floorNumber: formFloorNumber.trim() || undefined,
        apartmentNumber: formApartmentNumber.trim() || undefined,
        shippingCompany: company,
        validUntil: expiryDate.toISOString(),
        items: formItems,
        subtotal: formSubtotal,
        shippingFee: Number(formShippingFee),
        discount: Number(formDiscount),
        includeInspectionFee: formIncludeInspectionFee,
        allowOpenShipment: formAllowOpenShipment,
        inspectionFee: companyFeesBreakdown.inspectionFee,
        isInsured: formIsInsured,
        insuranceFee: companyFeesBreakdown.insuranceFee,
        vatValue: companyFeesBreakdown.vatValue,
        codFee: companyFeesBreakdown.codFee,
        companyFeesTotal: companyFeesBreakdown.totalExtraFees,
        roundingAdjustment: Number(formRoundingAdjustment) || 0,
        combineShippingFeesInPrint: formCombineShippingFees,
        total: formTotal,
        advancePayment: Number(formAdvancePayment),
        remainingAmount: formRemaining,
        notes: formNotes.trim(),
        terms: formTerms.trim(),
      };
      setQuotations(prev => prev.map(q => q.id === editingQuotation.id ? updated : q));
    } else {
      // Create new
      const newQuotation: Quotation = {
        id: `qt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        quotationNumber: generateNextQuotationNumber(),
        createdAt: now.toISOString(),
        validUntil: expiryDate.toISOString(),
        status: 'قيد_الانتظار',
        customerName: formCustomerName.trim(),
        customerPhone: formCustomerPhone.trim(),
        customerPhone2: formCustomerPhone2.trim() || undefined,
        customerCity: fullLocationDisplay,
        governorate: formGovernorate,
        city: effectiveCity,
        shippingArea: formGovernorate,
        customerAddress: finalAddressStr,
        buildingNumber: formBuildingNumber.trim() || undefined,
        floorNumber: formFloorNumber.trim() || undefined,
        apartmentNumber: formApartmentNumber.trim() || undefined,
        shippingCompany: company,
        items: formItems,
        subtotal: formSubtotal,
        shippingFee: Number(formShippingFee),
        discount: Number(formDiscount),
        includeInspectionFee: formIncludeInspectionFee,
        allowOpenShipment: formAllowOpenShipment,
        inspectionFee: companyFeesBreakdown.inspectionFee,
        isInsured: formIsInsured,
        insuranceFee: companyFeesBreakdown.insuranceFee,
        vatValue: companyFeesBreakdown.vatValue,
        codFee: companyFeesBreakdown.codFee,
        companyFeesTotal: companyFeesBreakdown.totalExtraFees,
        roundingAdjustment: Number(formRoundingAdjustment) || 0,
        combineShippingFeesInPrint: formCombineShippingFees,
        total: formTotal,
        advancePayment: Number(formAdvancePayment),
        remainingAmount: formRemaining,
        notes: formNotes.trim(),
        terms: formTerms.trim(),
        createdBy: currentUser?.fullName || 'المبيعات'
      };
      setQuotations(prev => [newQuotation, ...prev]);
    }

    setShowCreateModal(false);
  };

  // Soft Delete Quotation (Send to Trash)
  const handleSoftDelete = (id: string) => {
    setQuotations(prev => prev.map(q => q.id === id ? {
      ...q,
      isDeleted: true,
      deletedAt: new Date().toISOString()
    } : q));
    setScanMessage('تم نقل عرض السعر إلى سلة المحذوفات 🗑️ (يمكنك استرجاعه في أي وقت بدون فقدان).');
    setTimeout(() => setScanMessage(null), 5000);
  };

  // Restore from Trash
  const handleRestoreFromTrash = (id: string) => {
    setQuotations(prev => prev.map(q => q.id === id ? {
      ...q,
      isDeleted: false,
      deletedAt: undefined
    } : q));
    setScanMessage('تمت استعادة عرض السعر بنجاح إلى قائمة عروض الأسعار النشطة! ✅');
    setTimeout(() => setScanMessage(null), 5000);
  };

  // Permanent Delete
  const handlePermanentDelete = (id: string) => {
    if (!window.confirm('تحذير: هل أنت متأكد من الحذف النهائي لعرض السعر؟ لن يمكن استعادته بعد ذلك.')) return;
    setQuotations(prev => prev.filter(q => q.id !== id));
    setScanMessage('تم الحذف النهائي لعرض السعر.');
    setTimeout(() => setScanMessage(null), 3000);
  };

  // Empty Trash
  const handleEmptyTrash = () => {
    if (!window.confirm('هل تريد بالتأكيد تفريغ سلة المحذوفات وحذف كافة العروض الموجودة بها نهائياً؟')) return;
    setQuotations(prev => prev.filter(q => !q.isDeleted));
    setScanMessage('تم تفريغ سلة المحذوفات بالكامل.');
    setTimeout(() => setScanMessage(null), 4000);
  };

  // Quick Renew Validity
  const handleRenewValidity = (id: string, additionalDays: number) => {
    const newValidUntil = new Date(Date.now() + additionalDays * 24 * 60 * 60 * 1000).toISOString();
    setQuotations(prev => prev.map(q => {
      if (q.id === id) {
        return {
          ...q,
          validUntil: newValidUntil,
          status: q.status === 'منتهي_الصلاحية' ? 'قيد_الانتظار' : q.status
        };
      }
      return q;
    }));
    setScanMessage(`تم تمديد صلاحية عرض السعر بنجاح لمدة ${additionalDays} يوم! 📅`);
    setTimeout(() => setScanMessage(null), 4000);
  };

  // Export to CSV / Excel
  const handleExportCSV = () => {
    const listToExport = filteredQuotations;
    if (listToExport.length === 0) {
      alert('لا توجد عروض أسعار لتصديرها في القائمة الحالية.');
      return;
    }
    const headers = ['رقم عرض السعر', 'اسم العميل', 'رقم الهاتف', 'المدينة', 'الحالة', 'الإجمالي', 'الدفعة المقدمة', 'المتبقي', 'تاريخ الإنشاء', 'صالح حتى', 'طلب الشحن المحول'];
    const rows = listToExport.map(q => [
      q.quotationNumber,
      `"${(q.customerName || '').replace(/"/g, '""')}"`,
      q.customerPhone,
      `"${(q.customerCity || '').replace(/"/g, '""')}"`,
      q.status,
      q.total,
      q.advancePayment || 0,
      q.remainingAmount || 0,
      new Date(q.createdAt).toLocaleDateString('ar-EG'),
      new Date(q.validUntil).toLocaleDateString('ar-EG'),
      q.convertedOrderNumber || ''
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quotations_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setScanMessage('تم تصدير ملف إكسل / CSV بنجاح! 📊');
    setTimeout(() => setScanMessage(null), 4000);
  };

  // Change Status
  const handleUpdateStatus = (id: string, newStatus: QuotationStatus) => {
    setQuotations(prev => prev.map(q => q.id === id ? { 
      ...q, 
      status: newStatus,
      ...(newStatus !== 'محول_لطلب_شحن' ? { convertedOrderId: undefined, convertedOrderNumber: undefined, convertedAt: undefined } : {})
    } : q));
  };

  // Convert Quotation to Shipping Order (Applies Company-Specific Expenses)
  const handleExecuteConversion = () => {
    if (!convertModalQuotation) return;

    // Calculate next order number
    const orderNumbers = orders.map(o => {
      const parsed = parseInt(o.orderNumber, 10);
      return isNaN(parsed) ? null : parsed;
    }).filter((n): n is number => n !== null);
    const nextOrderNum = orderNumbers.length > 0 ? Math.max(...orderNumbers) + 1 : 1001;
    const orderNumberStr = String(nextOrderNum);

    const now = new Date().toISOString();
    const productNamesStr = convertModalQuotation.items.map(i => `${i.name} (×${i.quantity})`).join(' + ');
    const totalProductCost = convertModalQuotation.items.reduce((sum, i) => sum + ((i.cost || 0) * i.quantity), 0);
    const totalWeight = convertModalQuotation.items.reduce((sum, i) => sum + ((i.weight || 1) * i.quantity), 0);

    // Shipping Company & Exact Company Expenses
    const targetCompany = conversionShippingCompany || convertModalQuotation.shippingCompany || (settings?.companyNames && settings.companyNames[0]) || Object.keys(settings?.shippingOptions || {})[0] || 'شركة الشحن المعتمدة';
    const compFees = settings?.companySpecificFees?.[targetCompany];
    const useCustom = compFees?.useCustomFees ?? false;

    const includeInspection = convertModalQuotation.includeInspectionFee !== false;
    const allowOpen = convertModalQuotation.allowOpenShipment !== false;
    const inspectionFee = convertModalQuotation.inspectionFee !== undefined
      ? convertModalQuotation.inspectionFee
      : ((includeInspection && allowOpen) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.inspectionFee || 0)) : 0);

    const isInsured = convertModalQuotation.isInsured !== false;
    const insuranceRate = isInsured ? (useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings?.insuranceFeePercent || 0)) : 0;
    const insuranceFee = convertModalQuotation.insuranceFee !== undefined
      ? convertModalQuotation.insuranceFee
      : (isInsured ? calculateInsuranceFee(convertModalQuotation as any, insuranceRate, settings) : 0);

    const isCompanyBosta = isBosta(targetCompany);
    const defaultVatRate = isCompanyBosta ? 0.14 : 0;
    const vatRate = useCustom ? (compFees?.shippingVatRate ?? defaultVatRate) : (settings?.shippingVatRate ?? defaultVatRate);
    const vatValue = convertModalQuotation.vatValue !== undefined
      ? convertModalQuotation.vatValue
      : calculateBostaVat(convertModalQuotation as any, insuranceFee, settings);

    // Target collection amount (COD)
    const targetCod = 
      conversionCodMode === 'zero' ? 0 :
      conversionCodMode === 'full' ? convertModalQuotation.total :
      conversionCodMode === 'remaining' ? (convertModalQuotation.remainingAmount || 0) :
      Math.max(0, conversionCustomCodAmount);

    const isZeroCod = targetCod === 0;

    // Advance payment: when collection is zeroed, advance payment is full amount (fully paid)
    const effectiveAdvance = isZeroCod
      ? convertModalQuotation.total
      : (convertModalQuotation.advancePayment || Math.max(0, convertModalQuotation.total - targetCod));

    const finalGov = convertModalQuotation.governorate || (convertModalQuotation.customerCity?.includes(' - ') ? convertModalQuotation.customerCity.split(' - ')[0].trim() : convertModalQuotation.customerCity) || 'القاهرة';
    const finalCity = convertModalQuotation.city || (convertModalQuotation.customerCity?.includes(' - ') ? convertModalQuotation.customerCity.split(' - ')[1]?.trim() : convertModalQuotation.customerCity) || finalGov;

    const newShippingOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderNumber: orderNumberStr,
      date: now,
      createdAt: now,
      customerName: convertModalQuotation.customerName,
      customerPhone: convertModalQuotation.customerPhone,
      customerPhone2: convertModalQuotation.customerPhone2,
      governorate: finalGov,
      city: finalCity,
      customerCity: finalCity,
      shippingArea: finalGov,
      customerAddress: convertModalQuotation.customerAddress || 'عنوان محدد بعرض السعر',
      buildingNumber: convertModalQuotation.buildingNumber,
      floorNumber: convertModalQuotation.floorNumber,
      apartmentNumber: convertModalQuotation.apartmentNumber,
      shippingCompany: targetCompany,
      shippingFee: convertModalQuotation.shippingFee,
      includeInspectionFee: includeInspection,
      allowOpenShipment: allowOpen,
      inspectionFee: inspectionFee,
      isInsured: isInsured,
      insuranceFee: insuranceFee,
      vatValue: vatValue,
      shippingVatRate: vatRate,
      items: convertModalQuotation.items,
      productName: productNamesStr,
      productPrice: convertModalQuotation.subtotal,
      productCost: totalProductCost,
      totalPrice: convertModalQuotation.total,
      totalAmountOverride: targetCod,
      totalAmountOverrideReason: isZeroCod 
        ? `تحويل من عرض أسعار #${convertModalQuotation.quotationNumber} - صفر تحصيل عند الاستلام (مدفوع مسبقاً بالكامل)`
        : `تحويل من عرض أسعار #${convertModalQuotation.quotationNumber}`,
      advancePayment: effectiveAdvance,
      weight: totalWeight,
      discount: convertModalQuotation.discount,
      status: conversionOrderStatus,
      paymentStatus: isZeroCod ? 'مدفوع' : (effectiveAdvance > 0 ? 'مدفوع جزئياً' : 'بانتظار الدفع'),
      paymentMethod: isZeroCod 
        ? 'مدفوع مقدماً بالكامل (مبلغ التحصيل 0 ج.م)' 
        : (effectiveAdvance > 0 ? `عربون ${effectiveAdvance} ج.م + الباقي تحصيل (${targetCod} ج.م)` : 'الدفع عند الاستلام (COD)'),
      preparationStatus: 'بانتظار التجهيز',
      notes: `تم التحويل تلقائياً من عرض السعر #${convertModalQuotation.quotationNumber} مع تطبيق كافة مصروفات شركة الشحن (${targetCompany}). ${isZeroCod ? 'مبلغ التحصيل عند التسليم: 0 ج.م (مدفوع بالكامل مقدماً).' : `مبلغ التحصيل المطلوب: ${targetCod} ج.م.`} ${convertModalQuotation.notes || ''}`.trim(),
      quotationNumber: convertModalQuotation.quotationNumber,
      quotationId: convertModalQuotation.id,
      confirmationLogs: [
        {
          userId: currentUser?.phone || 'admin',
          userName: currentUser?.fullName || 'المبيعات',
          timestamp: now,
          action: 'تم التحويل من عرض أسعار مع تطبيق مصروفات الشركة',
          notes: `تحويل العرض رقم ${convertModalQuotation.quotationNumber} إلى طلب شحن مباشر لشركة ${targetCompany} بمبلغ تحصيل ${targetCod} ج.م مع مصاريف الشحن والمعاينة والتأمين والضريبة.`
        }
      ]
    };

    // 1. Add order to store orders
    setOrders(prev => [newShippingOrder, ...prev]);

    // 2. Mark quotation as converted
    setQuotations(prev => prev.map(q => q.id === convertModalQuotation.id ? {
      ...q,
      status: 'محول_لطلب_شحن',
      convertedOrderId: newShippingOrder.id,
      convertedOrderNumber: newShippingOrder.orderNumber,
      convertedAt: now
    } : q));

    // 3. Fire Celebration Confetti
    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}

    setConvertedSuccessOrderNumber(orderNumberStr);
    setConvertModalQuotation(null);
  };

  // Public approval link
  const getApprovalLink = (q: Quotation) => {
    const sId = q.storeId || activeStore?.id || localStorage.getItem('lastActiveStoreId') || '';
    const queryStr = sId ? `?storeId=${sId}` : '';
    return `${window.location.origin}/quote-approval/${q.id}${queryStr}`;
  };

  // WhatsApp Proposal Message Formatter (Includes Company & Detailed Expenses & Online Approval Link)
  const getWhatsAppMessage = (q: Quotation) => {
    const storeTitle = activeStore?.name || settings.storeName || 'متجرنا';
    const itemsLines = q.items.map((item, idx) => `${idx + 1}. ${item.name} | الكمية: ${item.quantity} | السعر: ${item.price} ج.م`).join('\n');
    const validUntilDate = new Date(q.validUntil).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    const companyName = q.shippingCompany || (settings?.companyNames && settings.companyNames[0]) || 'شركة الشحن المعتمدة';
    const inspectionFee = q.inspectionFee || 0;
    const insuranceFee = q.insuranceFee || 0;
    const vatValue = q.vatValue || 0;
    const companyFeesTotal = q.companyFeesTotal || (inspectionFee + insuranceFee + vatValue);
    const roundingAdj = q.roundingAdjustment || 0;
    const roundingAddition = roundingAdj < 0 ? Math.abs(roundingAdj) : 0;
    const combinedShipping = q.shippingFee + companyFeesTotal + roundingAddition;

    const shippingLines = q.combineShippingFeesInPrint !== false
      ? `🚚 مصاريف الشحن والتسليم الإجمالية (${companyName}): ${combinedShipping} ج.م\n`
      : `🚚 شركة الشحن المعتمدة: ${companyName} (${q.customerCity || 'المحافظة'})\n📦 مصاريف الشحن الأساسية: ${q.shippingFee + roundingAddition} ج.م\n${inspectionFee > 0 ? `🔍 مصاريف فحص والمعاينة: ${inspectionFee} ج.م\n` : ''}${insuranceFee > 0 ? `🛡️ رسوم التأمين: ${insuranceFee} ج.م\n` : ''}${vatValue > 0 ? `📋 ضريبة القيمة المضافة: ${vatValue} ج.م\n` : ''}`;

    const discountLine = q.discount > 0 ? `🎁 الخصم الممنوح: -${q.discount} ج.م\n` : '';
    const roundingDiscountLine = roundingAdj > 0 ? `✨ خصم تقفيل الكسر: -${roundingAdj} ج.م\n` : '';

    return `*📄 عرض أسعار رسمي من: ${storeTitle}*
رقم العرض: *${q.quotationNumber}*
عناية الأستاذ/ة: *${q.customerName}*

*📦 قائمة المنتجات والأسعار:*
${itemsLines}

-----------------------------
💰 إجمالي البضاعة: ${q.subtotal} ج.م
${shippingLines}${discountLine}${roundingDiscountLine}-----------------------------
*💵 الإجمالي النهائي الشامل لكافة المصروفات: ${q.total} ج.م*
${q.advancePayment && q.advancePayment > 0 ? `🔹 العربون المسدد: ${q.advancePayment} ج.م\n🔹 المتبقي للتحصيل عند الاستلام (COD): ${q.remainingAmount} ج.م\n` : ''}-----------------------------
🌐 *رابط التأكيد والموافقة أونلاين بضغطة زر:*
${getApprovalLink(q)}

⏳ *العرض سارٍ حتى:* ${validUntilDate}
📌 *ملاحظات وشروط العرض:*
${q.terms || 'الأسعار سارية حتى تاريخ الصلاحية. يتم تجهيز الشحن فور تأكيدكم.'}`;
  };

  // WhatsApp Follow-up Reminder Message
  const getWhatsAppReminderMessage = (q: Quotation) => {
    const storeTitle = activeStore?.name || settings.storeName || 'متجرنا';
    const validUntilDate = new Date(q.validUntil).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const approvalLink = getApprovalLink(q);

    return `*مرحباً أ/ ${q.customerName} 👋*

نود تذكيركم بخصوص *عرض السعر رقم #${q.quotationNumber}* المقدم من *${storeTitle}* بقيمة *${q.total.toLocaleString()} ج.م*.

⏰ *تنبيه:* ينتهي العرض قريباً بتاريخ (*${validUntilDate}*).

يمكنكم الاطلاع على التفاصيل والموافقة على العرض مباشرة بضغطة زر عبر الرابط التالي:
🌐 ${approvalLink}

نتشرف بخدمتكم دائماً! ❤️`;
  };

  // Duplicate / Clone Quotation
  const handleDuplicateQuotation = (q: Quotation) => {
    const newQuoteId = `quo-${Date.now()}`;
    const newQuoteNum = `${Math.floor(100000 + Math.random() * 900000)}`;
    const nowStr = new Date().toISOString();
    const validDays = 7;
    const validUntil = new Date(Date.now() + validDays * 86400000).toISOString();

    const duplicated: Quotation = {
      ...q,
      id: newQuoteId,
      quotationNumber: newQuoteNum,
      createdAt: nowStr,
      validUntil: validUntil,
      status: 'قيد_الانتظار',
      customerName: `${q.customerName} (نسخة)`,
      notes: `تم تكرار العرض من العرض الاصلي #${q.quotationNumber}. ${q.notes || ''}`.trim(),
      convertedOrderId: undefined,
      convertedOrderNumber: undefined,
      convertedAt: undefined,
      approvedAt: undefined,
      approvedByCustomer: undefined,
    };

    setQuotations(prev => [duplicated, ...prev]);
    triggerCopy('', `dup-${duplicated.id}`);
    alert(`تم نسخ عرض السعر بنجاح! تم إنشاء عرض جديد برقم #${newQuoteNum} للعميل "${duplicated.customerName}".`);
  };

  // Confirm POS / Cashier Direct Sale Conversion
  const handleConfirmPosConversion = () => {
    if (!posModalQuotation) return;
    const q = posModalQuotation;
    const orderId = `pos-ord-${Date.now()}`;
    const orderNumberStr = `POS-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    // 1. Create order
    const newOrder: Order = {
      id: orderId,
      orderNumber: orderNumberStr,
      date: new Date().toISOString().split('T')[0],
      customerName: q.customerName,
      customerPhone: q.customerPhone,
      customerAddress: q.customerAddress || 'استلام مباشر من الفرع (كاشير/POS)',
      governorate: q.governorate || 'الفرع الرئيسي',
      city: q.city || 'كاشير',
      shippingCompany: 'استلام مباشر (POS)',
      shippingArea: 'المتجر الرئيسي',
      productName: q.items.map(i => i.name).join(' + ') || 'منتجات كاشير',
      productPrice: q.subtotal,
      productCost: q.items.reduce((sum, i) => sum + ((i.cost || 0) * i.quantity), 0),
      weight: q.items.reduce((sum, i) => sum + ((i.weight || 0) * i.quantity), 0) || 1,
      items: q.items,
      shippingFee: 0,
      discount: q.discount,
      status: 'تم_التوصيل',
      preparationStatus: 'جاهز',
      paymentStatus: 'مدفوع',
      paymentMethod: posPaymentMethod === 'pos_cash' ? 'كاشير - نقدي' : 'كاشير - دفع إلكتروني/شبكة',
      createdAt: nowIso,
      notes: `تم تحويله مباشرة من عرض السعر #${q.quotationNumber} إلى مبيعة POS وتوريد قيمتها بالكامل للخزينة.`,
      channel: 'pos'
    };

    setOrders(prev => [newOrder, ...prev]);

    // 2. Supply to Treasury
    if (setTreasury) {
      setTreasury((prevTreasury: any) => {
        const currentAccounts = prevTreasury?.accounts || [
          { id: '1', name: 'الخزينة الرئيسية', type: 'safe', balance: 0, currency: 'EGP' },
          { id: '2', name: 'فودافون كاش', type: 'wallet', balance: 0, currency: 'EGP' },
          { id: '3', name: 'الحساب البنكي', type: 'bank', balance: 0, currency: 'EGP' }
        ];
        const currentTxs = prevTreasury?.transactions || [];

        const targetAccId = posAccountId || '1';
        const updatedAccounts = currentAccounts.map((acc: any) => 
          acc.id === targetAccId ? { ...acc, balance: (acc.balance || 0) + q.total } : acc
        );

        const newTx = {
          id: `tx-pos-${Date.now()}`,
          accountId: targetAccId,
          type: 'in',
          amount: q.total,
          category: posPaymentMethod,
          description: `مبيعة كاشير/POS مباشرة من عرض سعر #${q.quotationNumber} (العميل: ${q.customerName})`,
          date: nowIso,
          createdByName: currentUser?.name || 'الكاشير'
        };

        return {
          ...prevTreasury,
          accounts: updatedAccounts,
          transactions: [newTx, ...currentTxs]
        };
      });
    }

    // 3. Update Quotation status
    setQuotations(prev => prev.map(item => item.id === q.id ? {
      ...item,
      status: 'محول_لطلب_شحن',
      convertedOrderId: orderId,
      convertedOrderNumber: orderNumberStr,
      convertedAt: nowIso,
      notes: `${item.notes ? item.notes + ' | ' : ''}تم تحويله لمبيعة POS وتوريد ${q.total} ج.م للخزينة (طلب #${orderNumberStr}).`
    } : item));

    setConvertedSuccessOrderNumber(orderNumberStr);
    setPosModalQuotation(null);
    try {
      confetti({
        particleCount: 110,
        spread: 75,
        origin: { y: 0.6 }
      });
    } catch {}
  };

  // Auto-scan & restore any converted quotations found in orders that might be missing from quotations state
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    const existingQNumbers = new Set(quotations.map(q => q.quotationNumber));
    const missing: Quotation[] = [];

    orders.forEach(ord => {
      if (ord.quotationNumber && !existingQNumbers.has(ord.quotationNumber)) {
        existingQNumbers.add(ord.quotationNumber);
        missing.push({
          id: `qt_restored_${ord.id}`,
          quotationNumber: ord.quotationNumber,
          createdAt: ord.createdAt || ord.date || new Date().toISOString(),
          validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'محول_لطلب_شحن',
          customerName: ord.customerName || '',
          customerPhone: ord.customerPhone || '',
          customerPhone2: ord.customerPhone2 || '',
          customerEmail: ord.customerEmail || '',
          customerAddress: ord.customerAddress || '',
          customerCity: ord.customerCity || '',
          items: ord.items || [],
          subtotal: ord.productPrice || ord.totalPrice || 0,
          discount: 0,
          shippingFee: ord.shippingFee || 0,
          total: ord.totalPrice || 0,
          advancePayment: (ord.paymentMethod?.includes('مدفوع') || ord.totalAmountOverride === 0) ? (ord.totalPrice || 0) : 0,
          remainingAmount: ord.totalAmountOverride !== undefined ? ord.totalAmountOverride : (ord.totalPrice || 0),
          shippingCompany: ord.shippingCompany || '',
          convertedOrderId: ord.id,
          convertedOrderNumber: ord.orderNumber,
          convertedAt: ord.date || ord.createdAt,
          notes: ord.notes || 'عرض سعر مرتبط بطلب شحن محول',
          terms: '',
          createdBy: (ord as any).salesEmployee || ord.assignedEmployeeId || 'المبيعات'
        });
      }
    });

    if (missing.length > 0) {
      console.log(`[QUOTATIONS-RESTORE] Auto-recovered ${missing.length} quotations from orders.`);
      setQuotations(prev => [...missing, ...prev]);
    }
  }, [orders]);

  // Manual Scan and Restore Button Handler
  const handleManualScanRestore = () => {
    const existingQNumbers = new Set(quotations.map(q => q.quotationNumber));
    const toAdd: Quotation[] = [];

    // 1. Scan orders
    orders.forEach(ord => {
      if (ord.quotationNumber && !existingQNumbers.has(ord.quotationNumber)) {
        existingQNumbers.add(ord.quotationNumber);
        toAdd.push({
          id: `qt_restored_${ord.id}`,
          quotationNumber: ord.quotationNumber,
          createdAt: ord.createdAt || ord.date || new Date().toISOString(),
          validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'محول_لطلب_شحن',
          customerName: ord.customerName || '',
          customerPhone: ord.customerPhone || '',
          customerPhone2: ord.customerPhone2 || '',
          customerEmail: ord.customerEmail || '',
          customerAddress: ord.customerAddress || '',
          customerCity: ord.customerCity || '',
          items: ord.items || [],
          subtotal: ord.productPrice || ord.totalPrice || 0,
          discount: 0,
          shippingFee: ord.shippingFee || 0,
          total: ord.totalPrice || 0,
          advancePayment: (ord.paymentMethod?.includes('مدفوع') || ord.totalAmountOverride === 0) ? (ord.totalPrice || 0) : 0,
          remainingAmount: ord.totalAmountOverride !== undefined ? ord.totalAmountOverride : (ord.totalPrice || 0),
          shippingCompany: ord.shippingCompany || '',
          convertedOrderId: ord.id,
          convertedOrderNumber: ord.orderNumber,
          convertedAt: ord.date || ord.createdAt,
          notes: ord.notes || 'عرض سعر مرتبط بطلب شحن محول',
          terms: '',
          createdBy: (ord as any).salesEmployee || ord.assignedEmployeeId || 'المبيعات'
        });
      }
    });

    // 2. Scan localStorage backup
    if (activeStore?.id) {
      try {
        const directBackup = localStorage.getItem(`quotations_backup_${activeStore.id}`);
        if (directBackup) {
          const parsed = JSON.parse(directBackup);
          if (Array.isArray(parsed)) {
            parsed.forEach((q: Quotation) => {
              if (q.quotationNumber && !existingQNumbers.has(q.quotationNumber)) {
                existingQNumbers.add(q.quotationNumber);
                toAdd.push(q);
              }
            });
          }
        }
        const storeBackup = localStorage.getItem(`emergency_store_backup_${activeStore.id}`);
        if (storeBackup) {
          const parsed = JSON.parse(storeBackup);
          if (Array.isArray(parsed.quotations)) {
            parsed.quotations.forEach((q: Quotation) => {
              if (q.quotationNumber && !existingQNumbers.has(q.quotationNumber)) {
                existingQNumbers.add(q.quotationNumber);
                toAdd.push(q);
              }
            });
          }
        }
      } catch (e) {
        console.warn('Backup check error:', e);
      }
    }

    if (toAdd.length > 0) {
      setQuotations(prev => [...toAdd, ...prev]);
      setActiveTab('all');
      setScanMessage(`تم استعادة ${toAdd.length} من عروض الأسعار بنجاح! تم حفظها في جدول قاعدة البيانات.`);
    } else {
      setScanMessage('تم فحص قاعدة البيانات والنسخ الاحتياطية بنجاح: جميع عروض الأسعار مسجلة ومحفوظة بالكامل.');
    }
    setTimeout(() => setScanMessage(null), 6000);
  };

  // Clean phone number for WhatsApp
  const cleanPhoneForWa = (phone: string) => {
    let p = phone.replace(/[^0-9]/g, '');
    if (p.startsWith('01')) p = '2' + p;
    return p;
  };

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    const now = Date.now();
    return quotations.filter(q => {
      // Trash tab condition
      if (activeTab === 'trash') {
        if (!q.isDeleted) return false;
        if (!searchQuery.trim()) return true;
        const term = searchQuery.toLowerCase();
        return (
          q.quotationNumber.toLowerCase().includes(term) ||
          q.customerName.toLowerCase().includes(term) ||
          q.customerPhone.includes(term)
        );
      }

      // Ignore deleted quotations for active tabs
      if (q.isDeleted) return false;

      // Expiry check
      const isExpired = new Date(q.validUntil).getTime() < now && q.status !== 'محول_لطلب_شحن';

      if (activeTab === 'pending' && (q.status !== 'قيد_الانتظار' && q.status !== 'مسودة')) return false;
      if (activeTab === 'approved' && q.status !== 'تمت_الموافقة') return false;
      if (activeTab === 'converted' && q.status !== 'محول_لطلب_شحن') return false;
      if (activeTab === 'expiring_soon') {
        if (q.status !== 'قيد_الانتظار' && q.status !== 'مسودة') return false;
        const msDiff = new Date(q.validUntil).getTime() - now;
        if (msDiff <= 0 || msDiff > 48 * 3600 * 1000) return false;
      }
      if (activeTab === 'expired' && (!isExpired && q.status !== 'منتهي_الصلاحية' && q.status !== 'ملغي')) return false;

      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return (
        q.quotationNumber.toLowerCase().includes(term) ||
        q.customerName.toLowerCase().includes(term) ||
        q.customerPhone.includes(term) ||
        (q.customerCity && q.customerCity.toLowerCase().includes(term))
      );
    });
  }, [quotations, activeTab, searchQuery]);

  // Statistics KPI
  const stats = useMemo(() => {
    const now = Date.now();
    const active = quotations.filter(q => !q.isDeleted);
    const total = active.length;
    const pending = active.filter(q => (q.status === 'قيد_الانتظار' || q.status === 'مسودة') && new Date(q.validUntil).getTime() >= now).length;
    const approved = active.filter(q => q.status === 'تمت_الموافقة').length;
    const converted = active.filter(q => q.status === 'محول_لطلب_شحن').length;
    const expiringSoonCount = active.filter(q => {
      if (q.status !== 'قيد_الانتظار' && q.status !== 'مسودة') return false;
      const msDiff = new Date(q.validUntil).getTime() - now;
      return msDiff > 0 && msDiff <= 48 * 3600 * 1000;
    }).length;
    const trashCount = quotations.filter(q => q.isDeleted).length;
    const totalPipelineValue = active
      .filter(q => q.status !== 'ملغي' && q.status !== 'منتهي_الصلاحية')
      .reduce((sum, q) => sum + (q.total || 0), 0);

    return { total, pending, approved, converted, expiringSoonCount, trashCount, totalPipelineValue };
  }, [quotations]);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
      
      {/* Success Banner after conversion */}
      {convertedSuccessOrderNumber && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xl flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Truck size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">تم تحويل عرض السعر بنجاح إلى طلب شحن #{convertedSuccessOrderNumber}! 🚀</h3>
              <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                الطلب الآن مدرج في قسم المبيعات والشحن ويمكنك متابعته وتجهيز البوليصة له مباشرة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/orders"
              className="px-4 py-2 rounded-xl bg-white text-emerald-900 font-black text-xs shadow-md hover:bg-emerald-50 transition"
            >
              عرض في قسم الطلبات
            </Link>
            <button
              onClick={() => setConvertedSuccessOrderNumber(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25">
            <FileSpreadsheet size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">عروض الأسعار والفواتير الأولية</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-black text-[11px]">
                Proforma Invoices
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              إصدار عروض أسعار رسمية للعملاء ومشاركتها عبر واتساب، ثم تحويلها بنقرة واحدة لطلبات شحن حقيقية.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Database info button */}
          <button
            onClick={() => setShowDbInfoModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer border border-slate-200 dark:border-slate-700"
            title="معلومات حفظ البيانات وجداول عروض الأسعار"
          >
            <Database size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span>حفظ البيانات والجداول</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="متصل ومحفوظ"></span>
          </button>

          {/* Scan & Restore missing quotations button */}
          <button
            onClick={handleManualScanRestore}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/40 text-teal-700 dark:text-teal-300 font-bold text-xs transition cursor-pointer border border-teal-200 dark:border-teal-800/40"
            title="فحص قاعدة البيانات والطلبات المحولة لاسترجاع أي عروض أسعار مفقودة"
          >
            <RefreshCw size={15} />
            <span>فحص واسترجاع عروض الأسعار</span>
          </button>

          {/* Create new quotation */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-indigo-600/25 transition-all hover:scale-102 cursor-pointer"
          >
            <Plus size={18} />
            <span>إنشاء عرض سعر جديد</span>
          </button>
        </div>
      </div>

      {/* Scan feedback alert */}
      {scanMessage && (
        <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-teal-600 shrink-0" />
            <span>{scanMessage}</span>
          </div>
          <button onClick={() => setScanMessage(null)} className="text-teal-600 hover:text-teal-800 p-1">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Helpful workflow banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-3 text-xs text-indigo-900 dark:text-indigo-200">
        <Info size={18} className="text-indigo-600 shrink-0" />
        <div className="flex-1">
          <span className="font-black">أين يذهب عرض السعر عند تحويله لطلب شحن؟</span>
          <span className="mr-1 text-slate-600 dark:text-slate-300">
            عرض السعر <strong>لا يُحذف نهائياً</strong>! بل تتغير حالته إلى «محول لطلب شحن» وينتقل إلى تبويب <strong>«محول للشحن»</strong> بالأعلى، وتُنشأ له بوليصة رسمية في <strong>«قسم الطلبات»</strong> بنفس البيانات ورقم الإشارة.
          </span>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500">إجمالي عروض الأسعار</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {stats.total}
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">عرض صادر</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500">بانتظار رد العميل</span>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats.pending}
          </div>
          <span className="text-[11px] text-amber-600/80 font-bold">عروض سارية</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500">تمت الموافقة والتعميد</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.approved}
          </div>
          <span className="text-[11px] text-emerald-600/80 font-bold">جاهزة للشحن</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500">محولة لطلبات شحن</span>
          <div className="text-2xl sm:text-3xl font-black text-teal-600 dark:text-teal-400 mt-1">
            {stats.converted}
          </div>
          <span className="text-[11px] text-teal-600/80 font-bold">في قسم الشحن 🚀</span>
        </div>

        <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500">قيمة الصفقات والعروض</span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1 truncate">
            {stats.totalPipelineValue.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">إجمالي المبيعات المحتملة</span>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث برقم العرض أو اسم العميل أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${activeTab === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
            >
              الكل ({quotations.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${activeTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
            >
              بانتظار الرد ({stats.pending})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${activeTab === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
            >
              معمد ومقبول ({stats.approved})
            </button>
            <button
              onClick={() => setActiveTab('converted')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${activeTab === 'converted' ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
            >
              محول للشحن ({stats.converted})
            </button>
            <button
              onClick={() => setActiveTab('expiring_soon')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${activeTab === 'expiring_soon' ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
            >
              ⏰ ينتهي قريباً ({stats.expiringSoonCount})
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${activeTab === 'expired' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
            >
              منتهي أو ملغي
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 flex items-center gap-1 ${activeTab === 'trash' ? 'bg-rose-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
              title="سلة مهملات عروض الأسعار المحذوفة مؤقتاً"
            >
              <Trash2 size={12} />
              <span>سلة المحذوفات ({stats.trashCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="تصدير عروض الأسعار إلى ملف Excel / CSV"
            >
              <FileSpreadsheet size={13} className="text-emerald-600" />
              <span>تصدير إكسل</span>
            </button>
            {activeTab === 'trash' && stats.trashCount > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-rose-200 dark:border-rose-900"
                title="تفريغ سلة المحذوفات نهائياً"
              >
                <Trash2 size={13} />
                <span>تفريغ السلة</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quotations List Grid */}
      {filteredQuotations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotations.map(q => {
            const now = Date.now();
            const expiryTs = new Date(q.validUntil).getTime();
            const isExpired = expiryTs < now && q.status !== 'محول_لطلب_شحن';
            const remainingDays = Math.ceil((expiryTs - now) / (1000 * 60 * 60 * 24));
            const waCleanPhone = cleanPhoneForWa(q.customerPhone);
            const linkedOrder = orders.find(
              o => o.id === q.convertedOrderId || o.orderNumber === q.convertedOrderNumber || (o.quotationNumber && o.quotationNumber === q.quotationNumber)
            );
            const isOrderDeleted = q.status === 'محول_لطلب_شحن' && !linkedOrder;

            return (
              <div 
                key={q.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between hover:border-indigo-500/50 transition-all space-y-4"
              >
                <div>
                  {/* Card Header: Code & Status */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-xl">
                        #{q.quotationNumber}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(q.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      q.isDeleted ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800' :
                      isOrderDeleted ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800' :
                      q.status === 'محول_لطلب_شحن' ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300' :
                      q.status === 'تمت_الموافقة' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                      isExpired ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300' :
                      'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    }`}>
                      {q.isDeleted ? '🗑️ في سلة المحذوفات' :
                       isOrderDeleted ? '⚠️ حُذف أوردر الشحن' :
                       q.status === 'محول_لطلب_شحن' ? '🚀 تم التحويل للشحن' :
                       q.status === 'تمت_الموافقة' ? '✅ معمد من العميل' :
                       isExpired ? '⌛ منتهي الصلاحية' : '⏳ بانتظار الرد'}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="mt-3 space-y-1">
                    <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                      {q.customerName}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono dir-ltr select-all">{q.customerPhone}</span>
                      {q.customerCity && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <MapPin size={11} className="text-indigo-500" />
                          <span>{q.customerCity}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="text-slate-500 font-semibold text-[11px] flex justify-between">
                      <span>المنتجات ({q.items.length}):</span>
                      <span>سعر الوحدة</span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {q.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-slate-700 dark:text-slate-200">
                          <span className="truncate max-w-[170px]">
                            {item.quantity}× {item.name}
                          </span>
                          <span className="font-mono font-bold text-slate-500">
                            {item.price * item.quantity} ج.م
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <Truck size={12} className="text-indigo-500" />
                        <span>شركة الشحن:</span>
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {q.shippingCompany || 'شركة معتمدة'}
                      </span>
                    </div>
                    {((q.companyFeesTotal || 0) > 0 || (q.inspectionFee || 0) > 0 || (q.insuranceFee || 0) > 0 || (q.vatValue || 0) > 0) && (
                      <div className="flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                        <span>مصروفات الشركة (معاينة / تأمين / ضريبة):</span>
                        <span className="font-mono font-bold">
                          +{q.companyFeesTotal || ((q.inspectionFee || 0) + (q.insuranceFee || 0) + (q.vatValue || 0))} ج.م
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center font-bold">
                      <span className="text-slate-500 text-[11px]">الإجمالي النهائي الشامل:</span>
                      <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                        {q.total} ج.م
                      </span>
                    </div>

                    {q.advancePayment && q.advancePayment > 0 && (
                      <div className="flex justify-between items-center text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>العربون: {q.advancePayment} ج.م</span>
                        <span>المتبقي (COD): {q.remainingAmount} ج.م</span>
                      </div>
                    )}
                  </div>

                  {/* Expiry Pill */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock size={12} />
                      <span>الصلاحية: {new Date(q.validUntil).toLocaleDateString('ar-EG')}</span>
                    </span>
                    {!isExpired && q.status !== 'محول_لطلب_شحن' && !q.isDeleted && (
                      <span className="font-bold text-amber-600">
                        متبقي {remainingDays} {remainingDays === 1 ? 'يوم' : 'أيام'}
                      </span>
                    )}
                    {q.convertedOrderNumber && (
                      <span className="font-mono font-bold text-teal-600">
                        أوردر شحن #{q.convertedOrderNumber}
                      </span>
                    )}
                    {(isExpired || q.status === 'منتهي_الصلاحية') && !q.isDeleted && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-rose-500 font-bold">منتهي</span>
                        <button
                          onClick={() => handleRenewValidity(q.id, 7)}
                          className="px-1.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] hover:bg-indigo-100 cursor-pointer"
                          title="تمديد 7 أيام إضافية"
                        >
                          +7 أيام
                        </button>
                        <button
                          onClick={() => handleRenewValidity(q.id, 30)}
                          className="px-1.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] hover:bg-indigo-100 cursor-pointer"
                          title="تمديد 30 يوم"
                        >
                          +30 يوم
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {q.isDeleted ? (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1">
                          <Trash2 size={13} className="text-rose-600" />
                          <span>عرض السعر في سلة المحذوفات</span>
                        </span>
                        <span className="text-[10px] font-mono opacity-80">{q.deletedAt ? new Date(q.deletedAt).toLocaleDateString('ar-EG') : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreFromTrash(q.id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition"
                        >
                          <RefreshCw size={13} />
                          <span>استعادة العرض ✅</span>
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(q.id)}
                          className="py-2 px-3 rounded-xl bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                          title="حذف نهائي لا رجعة فيه"
                        >
                          <Trash2 size={13} />
                          <span>حذف نهائي</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* CONVERSION & PRIMARY ACTIONS */}
                      {q.status !== 'محول_لطلب_شحن' ? (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => {
                                setConvertModalQuotation(q);
                                setConversionShippingCompany((settings?.companyNames && settings.companyNames[0]) || Object.keys(settings?.shippingOptions || {})[0] || '');
                                setConversionOrderStatus('قيد_التنفيذ');
                                setConversionCodMode('zero');
                                setConversionCustomCodAmount(0);
                              }}
                              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-xs transition cursor-pointer"
                            >
                              <Truck size={14} />
                              <span>تحويل للشحن 🚀</span>
                            </button>
                            <button
                              onClick={() => {
                                setPosModalQuotation(q);
                                setPosPaymentMethod('pos_cash');
                              }}
                              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-xs transition cursor-pointer"
                            >
                              <Building size={14} />
                              <span>بيع مباشر POS 🏪</span>
                            </button>
                          </div>

                          {/* Online Approval Link Sharing & Duplication Row */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => triggerCopy(getApprovalLink(q), `appr-${q.id}`)}
                              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 font-bold text-[11px] border border-sky-200 dark:border-sky-800/60 transition cursor-pointer"
                              title="نسخ رابط موافقة وتأكيد العرض أونلاين للعميل"
                            >
                              <Share2 size={13} />
                              <span>{copiedKey === `appr-${q.id}` ? 'تم نسخ الرابط! ✅' : 'رابط موافقة أونلاين 🌐'}</span>
                            </button>
                            <button
                              onClick={() => handleDuplicateQuotation(q)}
                              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold text-[11px] border border-amber-200 dark:border-amber-800/60 transition cursor-pointer"
                              title="نسخ العرض لإنشاء عرض جديد بنفس البنود"
                            >
                              <Copy size={13} />
                              <span>نسخ العرض 📋</span>
                            </button>
                          </div>
                        </div>
                      ) : isOrderDeleted ? (
                        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 space-y-2 text-right animate-in fade-in">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                            <AlertCircle size={15} className="shrink-0 text-amber-600" />
                            <span>طلب الشحن السابق #{q.convertedOrderNumber || ''} حُذف من قسم الطلبات</span>
                          </div>
                          <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-tight">
                            عرض السعر محفوظ، يمكنك إعادة تحويله كطلب شحن جديد أو استعادته لحالة معمد ومقبول.
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              onClick={() => {
                                setConvertModalQuotation(q);
                                setConversionShippingCompany((settings?.companyNames && settings.companyNames[0]) || Object.keys(settings?.shippingOptions || {})[0] || '');
                                setConversionOrderStatus('قيد_التنفيذ');
                                setConversionCodMode('zero');
                                setConversionCustomCodAmount(0);
                              }}
                              className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Truck size={13} />
                              <span>إعادة التحويل للشحن 🚀</span>
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(q.id, 'تمت_الموافقة')}
                              className="py-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              title="إعادة حالة العرض إلى معمد ومقبول"
                            >
                              إلغاء التحويل
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Link
                            to="/orders"
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold text-xs border border-teal-200 dark:border-teal-800 transition"
                          >
                            <ExternalLink size={14} />
                            <span>عرض في المبيعات (#{linkedOrder?.orderNumber || q.convertedOrderNumber})</span>
                          </Link>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => triggerCopy(getApprovalLink(q), `appr-${q.id}`)}
                              className="flex items-center justify-center gap-1 py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-[11px] transition cursor-pointer"
                            >
                              <Share2 size={12} />
                              <span>{copiedKey === `appr-${q.id}` ? 'تم النسخ!' : 'رابط الموافقة'}</span>
                            </button>
                            <button
                              onClick={() => handleDuplicateQuotation(q)}
                              className="flex items-center justify-center gap-1 py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-[11px] transition cursor-pointer"
                            >
                              <Copy size={12} />
                              <span>نسخ العرض</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Secondary Action Icons */}
                      <div className="flex items-center gap-1.5">
                        {/* WhatsApp Main */}
                        {waCleanPhone && (
                          <a
                            href={`https://wa.me/${waCleanPhone}?text=${encodeURIComponent(getWhatsAppMessage(q))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                            title="مشاركة العرض والرابط بالواتساب"
                          >
                            <MessageCircle size={14} />
                            <span>واتساب</span>
                          </a>
                        )}

                        {/* WhatsApp Follow-up Reminder */}
                        {waCleanPhone && (q.status === 'قيد_الانتظار' || q.status === 'مسودة') && (
                          <a
                            href={`https://wa.me/${waCleanPhone}?text=${encodeURIComponent(getWhatsAppReminderMessage(q))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 text-orange-800 dark:text-orange-300 font-bold text-xs border border-orange-200 dark:border-orange-800 transition cursor-pointer"
                            title="إرسال رسالة تذكير لطيفة بالانتهاء والموافقة"
                          >
                            <Clock size={13} />
                            <span>تذكير ⏰</span>
                          </a>
                        )}

                        {/* Print Proforma Invoice */}
                        <button
                          onClick={() => setPreviewQuotation(q)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                          title="طباعة فاتورة عرض السعر A4"
                        >
                          <Printer size={14} />
                          <span>A4</span>
                        </button>

                        {/* Edit */}
                        {q.status !== 'محول_لطلب_شحن' && (
                          <button
                            onClick={() => handleOpenEditModal(q)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            title="تعديل عرض السعر"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}

                        {/* Delete (Soft Delete to Trash) */}
                        <button
                          onClick={() => handleSoftDelete(q.id)}
                          className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="نقل إلى سلة المحذوفات (آمن)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <FileSpreadsheet size={32} />
          </div>
          <h3 className="font-black text-lg text-slate-800 dark:text-white">لا توجد عروض أسعار تطابق الاختيار</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            أنشئ أول فاتورة عرض أسعار لعميلك وحدد المنتجات والشحن، ثم شاركها عبر واتساب وحوّلها لطلب شحن فوري بضغطة زر واحدة.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition"
          >
            <Plus size={16} />
            <span>إنشاء أول عرض سعر الآن</span>
          </button>
        </div>
      )}

      {/* CREATE / EDIT QUOTATION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 my-8 max-h-[90vh] overflow-y-auto text-right" dir="rtl">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    {editingQuotation ? `تعديل عرض السعر #${editingQuotation.quotationNumber}` : 'إنشاء فاتورة عرض أسعار جديدة'}
                  </h3>
                  <p className="text-xs text-slate-500">أدخل تفاصيل العميل والمنتجات وشروط العرض</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveQuotation} className="space-y-5">
              
              {/* Customer Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="font-black text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  1. بيانات العميل
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أستاذ أحمد محمد"
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم الهاتف الأساسي *</label>
                    <input
                      type="tel"
                      required
                      placeholder="010XXXXXXXX"
                      value={formCustomerPhone}
                      onChange={(e) => setFormCustomerPhone(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-right"
                    />
                  </div>

                  {/* Approved Shipping Company */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">شركة الشحن المعتمدة *</label>
                    <select
                      value={formShippingCompany}
                      onChange={(e) => {
                        const newCompany = e.target.value;
                        setFormShippingCompany(newCompany);
                        setFormShippingFee(getCityShippingFee(newCompany, formGovernorate, effectiveCity));
                      }}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {availableShippingCompanies.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Governorate Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المحافظة (Governorate) *</label>
                    <select
                      value={formGovernorate}
                      onChange={(e) => handleGovernorateChange(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {EGYPT_GOVERNORATES.map(gov => (
                        <option key={gov.name} value={gov.name}>
                          {gov.name} ({getCityShippingFee(formShippingCompany, gov.name)} ج.م)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* City / District Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المدينة / المركز / الحي *</label>
                    {isCustomCity ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          required
                          placeholder="اكتب اسم المدينة أو القرية..."
                          value={customCityName}
                          onChange={(e) => handleCustomCityInput(e.target.value)}
                          className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCity(false);
                            const defaultCty = currentGovernorateCities[0] || '';
                            setFormCity(defaultCty);
                            setFormShippingFee(getCityShippingFee(formShippingCompany, formGovernorate, defaultCty));
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold shrink-0 hover:bg-slate-300 transition"
                        >
                          القائمة
                        </button>
                      </div>
                    ) : (
                      <select
                        value={formCity}
                        onChange={(e) => handleCityChange(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- اختر المدينة / الحي --</option>
                        {currentGovernorateCities.map((cityStr) => {
                          const fee = getCityShippingFee(formShippingCompany, formGovernorate, cityStr);
                          return (
                            <option key={cityStr} value={cityStr}>
                              {cityStr} {fee > 0 ? `(${fee} ج.م)` : ''}
                            </option>
                          );
                        })}
                        <option value="__custom__">➕ كتابة اسم المدينة / المركز يدوياً...</option>
                      </select>
                    )}
                  </div>

                  {/* Secondary Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم هاتف بديل (اختياري)</label>
                    <input
                      type="tel"
                      placeholder="هاتف إضافي أو واتساب"
                      value={formCustomerPhone2}
                      onChange={(e) => setFormCustomerPhone2(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-right"
                    />
                  </div>

                  {/* Detailed Street Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم الشارع والمنطقة / علامة مميزة *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: شارع الجيش، تقاطع شارع النصر، بجوار صيدلية الطرشوبي..."
                      value={formCustomerAddress}
                      onChange={(e) => setFormCustomerAddress(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Building / Floor / Apartment Micro Inputs */}
                  <div className="sm:col-span-2 grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">رقم المبنى/العمارة</label>
                      <input
                        type="text"
                        placeholder="مثال: 15"
                        value={formBuildingNumber}
                        onChange={(e) => setFormBuildingNumber(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">الطابق / الدور</label>
                      <input
                        type="text"
                        placeholder="مثال: 3"
                        value={formFloorNumber}
                        onChange={(e) => setFormFloorNumber(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">رقم الشقة</label>
                      <input
                        type="text"
                        placeholder="مثال: 7"
                        value={formApartmentNumber}
                        onChange={(e) => setFormApartmentNumber(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none text-center"
                      />
                    </div>
                  </div>

                  {/* Address Live Preview Banner */}
                  <div className="sm:col-span-2 p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs space-y-1">
                    <div className="flex items-center justify-between text-indigo-900 dark:text-indigo-200 font-black">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span>معاينة العنوان المجمع لأوردر الشحن:</span>
                      </span>
                      <span className="text-[10px] font-bold bg-indigo-200/70 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                        متوافق مع شركات الشحن 100%
                      </span>
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900/50 dir-rtl truncate">
                      {formGovernorate} - {effectiveCity || 'المدينة'} | {[
                        formCustomerAddress.trim(),
                        formBuildingNumber.trim() ? `عمارة ${formBuildingNumber.trim()}` : '',
                        formFloorNumber.trim() ? `دور ${formFloorNumber.trim()}` : '',
                        formApartmentNumber.trim() ? `شقة ${formApartmentNumber.trim()}` : ''
                      ].filter(Boolean).join('، ') || 'عنوان الشارع'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Products Selection */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="font-black text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  2. بنود ومنتجات عرض السعر
                </h4>

                {/* Add from Catalog */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold outline-none"
                  >
                    <option value="">-- اختر منتج من الكتالوج الحالي لإضافته --</option>
                    {(settings?.products || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name} - ({p.price} ج.م)</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddProductFromCatalog}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    إضافة المنتج
                  </button>
                </div>

                {/* Or add custom item */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 block">أو إضافة بند / منتج مخصص غير مسجل:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="اسم البند أو الخدمة"
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-none"
                    />
                    <input
                      type="number"
                      placeholder="السعر (ج.م)"
                      value={customItemPrice}
                      onChange={(e) => setCustomItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                    >
                      إضافة البند
                    </button>
                  </div>
                </div>

                {/* Selected Items Table */}
                {formItems.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 font-bold text-slate-800 dark:text-white truncate">
                          {item.name}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                            >
                              -
                            </button>
                            <span className="px-2 font-mono font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
                            >
                              +
                            </button>
                          </div>

                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => {
                              const newP = Number(e.target.value);
                              setFormItems(prev => prev.map((it, i) => i === idx ? { ...it, price: newP } : it));
                            }}
                            className="w-20 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-center"
                            title="سعر الوحدة"
                          />
                          <span className="font-mono font-black text-indigo-600 w-16 text-left">
                            {item.price * item.quantity} ج.م
                          </span>

                          <button
                            type="button"
                            onClick={() => setFormItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-500 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    لم تقم بإضافة أي بنود بعد. أضف منتجات من الكتالوج أعلاه.
                  </div>
                )}
              </div>

              {/* 3. Company-Specific Expenses & Financials */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck size={14} />
                    <span>3. مصاريف شركة الشحن ({formShippingCompany || 'الشركة المعتمدة'}) والماليات</span>
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    مطبقة طبقاً لشروط وأسعار الشركة ⚖️
                  </span>
                </div>

                {/* Company Extra Expenses Controls Box */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Basic Shipping Fee with auto reset */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400">سعر الشحن الأساسي (ج.م)</label>
                        <button
                          type="button"
                          onClick={() => setFormShippingFee(getCityShippingFee(formShippingCompany, formCustomerCity))}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          title="استرجاع التسعيرة التلقائية للشركة"
                        >
                          تلقائي ({getCityShippingFee(formShippingCompany, formCustomerCity)} ج.م)
                        </button>
                      </div>
                      <input
                        type="number"
                        value={formShippingFee}
                        onChange={(e) => setFormShippingFee(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono outline-none"
                      />
                    </div>

                    {/* Inspection Fee Checkbox / Status */}
                    <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formIncludeInspectionFee}
                          onChange={(e) => setFormIncludeInspectionFee(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          فحص ومعاينة الشحنة عند الاستلام
                        </span>
                      </label>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                        <span>رسوم المعاينة للشركة:</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          +{companyFeesBreakdown.inspectionFee} ج.م
                        </span>
                      </div>
                    </div>

                    {/* Insurance Fee Checkbox / Status */}
                    <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formIsInsured}
                          onChange={(e) => setFormIsInsured(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          التأمين على بضائع الشحنة
                        </span>
                      </label>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                        <span>نسبة {companyFeesBreakdown.insuranceRate}% =</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          +{companyFeesBreakdown.insuranceFee} ج.م
                        </span>
                      </div>
                    </div>

                    {/* VAT & Taxes Status */}
                    <div className="flex flex-col justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          ضريبة القيمة المضافة (الشحن)
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-mono">
                          {isBosta(formShippingCompany) ? 'بوسطة 14%' : 'حسب الشركة'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                        <span>قيمة الضريبة المطبقة:</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          +{companyFeesBreakdown.vatValue} ج.م
                        </span>
                      </div>
                    </div>
                  </div>

                  {companyFeesBreakdown.totalExtraFees > 0 && (
                    <div className="p-2 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex justify-between items-center text-xs">
                      <span className="text-indigo-800 dark:text-indigo-300 font-bold">
                        ⚙️ إجمالي باقي مصروفات شركة الشحن المطبقة:
                      </span>
                      <span className="font-mono font-black text-indigo-700 dark:text-indigo-400">
                        +{companyFeesBreakdown.totalExtraFees} ج.م
                      </span>
                    </div>
                  )}
                </div>

                {/* Rounding Adjustment & Fraction Settlement Section */}
                <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-800 dark:text-amber-300 font-black text-xs">✨ تقفيل الكسر وتسوية المبلغ النهائي (Rounding & Net Target):</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <span>المبلغ قبل التقفيل:</span>
                      <span className="font-mono text-slate-900 dark:text-white font-black bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-700">
                        {rawTotalBeforeRounding.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    {/* Option 1: Direct Net Target Amount Input */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        🎯 الصافي المطلوب المستهدف (المبلغ النهائي المطلوب من العميل):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          placeholder={`مثال: ${Math.floor(rawTotalBeforeRounding / 10) * 10}`}
                          value={formTargetTotal !== null ? formTargetTotal : (formRoundingAdjustment !== 0 ? formTotal : '')}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            if (valStr === '') {
                              setFormTargetTotal(null);
                              setFormRoundingAdjustment(0);
                              return;
                            }
                            const targetVal = Number(valStr);
                            setFormTargetTotal(targetVal);
                            const diff = rawTotalBeforeRounding - targetVal;
                            setFormRoundingAdjustment(diff);
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-600 text-sm font-mono font-black text-slate-900 dark:text-amber-100 outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                        />
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-amber-700 dark:text-amber-400">ج.م</span>
                      </div>
                    </div>

                    {/* Quick Settlement Action Buttons */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        ⚡ أزرار تقفيل سريعة:
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const target = Math.floor(rawTotalBeforeRounding / 10) * 10;
                            setFormTargetTotal(target);
                            setFormRoundingAdjustment(rawTotalBeforeRounding - target);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer"
                        >
                          أقرب 10 ج.م أسفل
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const target = Math.round(rawTotalBeforeRounding / 5) * 5;
                            setFormTargetTotal(target);
                            setFormRoundingAdjustment(rawTotalBeforeRounding - target);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer"
                        >
                          أقرب 5 ج.م
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const target = Math.floor(rawTotalBeforeRounding);
                            setFormTargetTotal(target);
                            setFormRoundingAdjustment(rawTotalBeforeRounding - target);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer"
                        >
                          خصم الفكة
                        </button>

                        {formRoundingAdjustment !== 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormTargetTotal(null);
                              setFormRoundingAdjustment(0);
                            }}
                            className="px-2 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-[11px] font-bold hover:bg-rose-200 transition cursor-pointer"
                          >
                            تصفير
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Helper Banner */}
                  {formRoundingAdjustment !== 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 border border-amber-300/80 dark:border-amber-700 text-xs font-semibold text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {formRoundingAdjustment > 0 ? (
                          <>🎁 تم تطبيق خصم تقفيل كسر: <strong className="font-mono">{formRoundingAdjustment.toLocaleString()} ج.م</strong> (يظهر كخصم ممنوح على الفاتورة)</>
                        ) : (
                          <>✨ تم إضافة وتجميع مبلغ التقفيل (<strong className="font-mono">{Math.abs(formRoundingAdjustment).toLocaleString()} ج.م</strong>) تلقائياً داخل بند الشحن والتسليم لعدم إظهار بنود إضافية للعميل!</>
                        )}
                      </span>
                      <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700">
                        الصافي المطلوب النهائي: {formTotal.toLocaleString()} ج.م
                      </span>
                    </div>
                  )}

                  {/* Option to Combine Shipping & Fees in Printout */}
                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formCombineShippingFees}
                        onChange={(e) => setFormCombineShippingFees(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        تجميع وإجمال الشحن والمصاريف والتقفيل في بند واحد بالطباعة (يجمل الشحن بالمصاريف)
                      </span>
                    </label>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-md shrink-0">
                      مستحسن 🚚
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">خصم خاص على العرض (ج.م)</label>
                      <input
                        type="number"
                        value={formDiscount}
                        onChange={(e) => setFormDiscount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">عربون مسدد مسبقاً إن وجد (ج.م)</label>
                      <input
                        type="number"
                        value={formAdvancePayment}
                        onChange={(e) => setFormAdvancePayment(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">مدة سريان العرض</label>
                      <div className="flex gap-1.5">
                        {[3, 7, 14, 30].map(days => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setFormValidDays(days)}
                            className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${formValidDays === days ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
                          >
                            {days} أيام
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Totals Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-850 border border-indigo-200/60 dark:border-slate-700 flex flex-col justify-between space-y-2">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>إجمالي المنتجات:</span>
                        <span className="font-mono font-bold">{formSubtotal} ج.م</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>مصاريف الشحن ({formShippingCompany}):</span>
                        <span className="font-mono font-bold">+{formShippingFee} ج.م</span>
                      </div>
                      {companyFeesBreakdown.inspectionFee > 0 && (
                        <div className="flex justify-between text-indigo-600 dark:text-indigo-400 text-[11px]">
                          <span>رسوم فحص ومعاينة:</span>
                          <span className="font-mono font-bold">+{companyFeesBreakdown.inspectionFee} ج.م</span>
                        </div>
                      )}
                      {companyFeesBreakdown.insuranceFee > 0 && (
                        <div className="flex justify-between text-indigo-600 dark:text-indigo-400 text-[11px]">
                          <span>رسوم تأمين الشحنة:</span>
                          <span className="font-mono font-bold">+{companyFeesBreakdown.insuranceFee} ج.م</span>
                        </div>
                      )}
                      {companyFeesBreakdown.vatValue > 0 && (
                        <div className="flex justify-between text-indigo-600 dark:text-indigo-400 text-[11px]">
                          <span>ضريبة القيمة المضافة:</span>
                          <span className="font-mono font-bold">+{companyFeesBreakdown.vatValue} ج.م</span>
                        </div>
                      )}
                      {formDiscount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>الخصم الخاص:</span>
                          <span className="font-mono font-bold">-{formDiscount} ج.م</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-indigo-200 dark:border-slate-700 flex justify-between text-base font-black text-indigo-700 dark:text-indigo-400">
                        <span>الإجمالي النهائي:</span>
                        <span className="font-mono">{formTotal} ج.م</span>
                      </div>
                      {formAdvancePayment > 0 && (
                        <div className="flex justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 pt-1">
                          <span>المتبقي للتحصيل (COD):</span>
                          <span className="font-mono">{formRemaining} ج.م</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 border-t border-indigo-200/50 dark:border-slate-700 pt-2">
                      💡 ينتهي العرض في: {new Date(Date.now() + formValidDays * 24 * 60 * 60 * 1000).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms and Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">شروط وملاحظات العرض للعميل</label>
                <textarea
                  rows={2}
                  value={formTerms}
                  onChange={(e) => setFormTerms(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none"
                  placeholder="الشروط المطبوعة أسفل الفاتورة..."
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  {editingQuotation ? 'حفظ التعديلات' : 'إنشاء وحفظ عرض السعر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERT TO SHIPPING ORDER CONFIRMATION MODAL */}
      {convertModalQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 text-right animate-in zoom-in-95" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Truck size={24} />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">تحويل إلى طلب شحن مباشر</h3>
                <p className="text-xs text-slate-500">العرض: #{convertModalQuotation.quotationNumber} - {convertModalQuotation.customerName}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">العميل:</span>
                <span className="font-bold text-slate-800 dark:text-white">{convertModalQuotation.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الهاتف:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{convertModalQuotation.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">المحافظة والمدينة:</span>
                <span className="font-bold text-slate-800 dark:text-white">
                  {convertModalQuotation.governorate || convertModalQuotation.shippingArea || 'القاهرة'}
                  {convertModalQuotation.city ? ` - ${convertModalQuotation.city}` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">العنوان التفصيلي:</span>
                <span className="font-medium text-slate-800 dark:text-white truncate max-w-[200px]" title={convertModalQuotation.customerAddress}>
                  {convertModalQuotation.customerAddress || 'عنوان محدد بعرض السعر'}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-bold">قيمة الفاتورة الإجمالية:</span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">{convertModalQuotation.total} ج.م</span>
              </div>
            </div>

            {/* Collection Amount Selection (مبلغ التحصيل COD المطلوب من العميل) */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Coins size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>مبلغ التحصيل من العميل (COD):</span>
                </label>
                <span className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-lg border ${
                  conversionCodMode === 'zero'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                }`}>
                  {conversionCodMode === 'zero' ? '0 ج.م (تصفير التحصيل)' : 
                   conversionCodMode === 'full' ? `${convertModalQuotation.total} ج.م` :
                   conversionCodMode === 'remaining' ? `${convertModalQuotation.remainingAmount} ج.م` :
                   `${conversionCustomCodAmount} ج.م`}
                </span>
              </div>

              {/* Modes Selector */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* 1. Zero Collection (Default & Recommended) */}
                <button
                  type="button"
                  onClick={() => setConversionCodMode('zero')}
                  className={`py-2 px-2.5 rounded-xl font-black flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    conversionCodMode === 'zero'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                  }`}
                >
                  <CheckCircle size={14} className={conversionCodMode === 'zero' ? 'text-white' : 'text-emerald-500'} />
                  <span>تصفير التحصيل (0 ج.م) ⭐</span>
                </button>

                {/* 2. Full Amount */}
                <button
                  type="button"
                  onClick={() => setConversionCodMode('full')}
                  className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    conversionCodMode === 'full'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  <span>كامل القيمة ({convertModalQuotation.total} ج.م)</span>
                </button>

                {/* 3. Remaining (if advance payment > 0) or Custom */}
                {convertModalQuotation.advancePayment && convertModalQuotation.advancePayment > 0 ? (
                  <button
                    type="button"
                    onClick={() => setConversionCodMode('remaining')}
                    className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border col-span-2 sm:col-span-1 ${
                      conversionCodMode === 'remaining'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    <span>تحصيل المتبقي ({convertModalQuotation.remainingAmount} ج.م)</span>
                  </button>
                ) : null}

                {/* 4. Custom */}
                <button
                  type="button"
                  onClick={() => setConversionCodMode('custom')}
                  className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    (convertModalQuotation.advancePayment && convertModalQuotation.advancePayment > 0) ? '' : 'col-span-2'
                  } ${
                    conversionCodMode === 'custom'
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-600/30'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-cyan-400'
                  }`}
                >
                  <span>مبلغ يدوي مخصص</span>
                </button>
              </div>

              {/* Custom amount input */}
              {conversionCodMode === 'custom' && (
                <div className="pt-1.5 flex items-center gap-2 animate-in fade-in">
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-bold shrink-0">المبلغ المطلوب تحصيله:</span>
                  <input
                    type="number"
                    min="0"
                    value={conversionCustomCodAmount}
                    onChange={(e) => setConversionCustomCodAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold outline-none text-slate-900 dark:text-white"
                    placeholder="0"
                  />
                  <span className="text-xs text-slate-400 shrink-0">ج.م</span>
                </div>
              )}

              {/* Clarity note */}
              <div className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300/90 bg-emerald-100/60 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40">
                {conversionCodMode === 'zero' ? (
                  <span>
                    ✅ <strong>تصفير التحصيل نشط (0 ج.م):</strong> سيتم إنشاء طلب الشحن كـ <u>مدفوع بالكامل مسبقاً</u>، ولن يطالب مندوب الشحن العميل بأي مبالغ عند الاستلام.
                  </span>
                ) : (
                  <span>
                    ℹ️ سيتم مطالبة العميل بسداد <strong>{conversionCodMode === 'full' ? convertModalQuotation.total : conversionCodMode === 'remaining' ? convertModalQuotation.remainingAmount : conversionCustomCodAmount} ج.م</strong> عند استلام الشحنة (الدفع عند الاستلام).
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">شركة الشحن المسند إليها</label>
                <select
                  value={conversionShippingCompany}
                  onChange={(e) => setConversionShippingCompany(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                >
                  {(settings?.companyNames || Object.keys(settings?.shippingOptions || {})).map((name, idx) => (
                    <option key={idx} value={name}>{name}</option>
                  ))}
                  <option value="شحن المتجر الداخلي">شحن المتجر الداخلي</option>
                  <option value="مندوب خاص">مندوب خاص</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الحالة الابتدائية للأوردر</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConversionOrderStatus('قيد_التنفيذ')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${conversionOrderStatus === 'قيد_التنفيذ' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                  >
                    قيد التنفيذ (معمد وجاهز)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConversionOrderStatus('في_انتظار_المكالمة')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${conversionOrderStatus === 'في_انتظار_المكالمة' ? 'bg-cyan-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}
                  >
                    في انتظار المكالمة للتأكيد
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConvertModalQuotation(null)}
                className="px-4 py-2 rounded-xl text-slate-500 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteConversion}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                تأكيد التحويل وإنشاء الأوردر 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT TO DIRECT POS SALE / CASHIER MODAL */}
      {posModalQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 text-right animate-in zoom-in-95 dir-rtl" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Building size={24} />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">تحويل لبيع مباشر (POS / كاشير) 🏪</h3>
                <p className="text-xs text-slate-500">العرض: #{posModalQuotation.quotationNumber} - {posModalQuotation.customerName}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">اسم العميل:</span>
                <span className="font-bold text-slate-900 dark:text-white">{posModalQuotation.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">رقم الهاتف:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{posModalQuotation.customerPhone}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-indigo-200/50 dark:border-indigo-800/50">
                <span className="text-slate-700 dark:text-slate-300 font-bold">المبلغ الصافي المورد للخزينة:</span>
                <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 text-base">{posModalQuotation.total.toLocaleString()} ج.م</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">طريقة وسيلة التحصيل</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPosPaymentMethod('pos_cash')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${posPaymentMethod === 'pos_cash' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    <span>💵 كاشير / نقدي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosPaymentMethod('pos_digital')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${posPaymentMethod === 'pos_digital' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    <span>💳 إلكتروني / شبكة</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الخزينة أو الحساب المالي المستلم</label>
                <select
                  value={posAccountId}
                  onChange={(e) => setPosAccountId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none text-slate-900 dark:text-white"
                >
                  {(treasury?.accounts || [
                    { id: '1', name: 'الخزينة الرئيسية' },
                    { id: '2', name: 'فودافون كاش' },
                    { id: '3', name: 'الحساب البنكي' }
                  ]).map((acc: any) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance ?? 0} ج.م)</option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500 font-medium">
                عند الضغط على تأكيد، سيتم تحويل عرض السعر إلى مبيعة POS مكتملة، وتوريد مبلغ <strong>{posModalQuotation.total.toLocaleString()} ج.م</strong> مباشرة للخزينة المختارة.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPosModalQuotation(null)}
                className="px-4 py-2 rounded-xl text-slate-500 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmPosConversion}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                تأكيد وتوريد المبلغ للخزينة 🏪
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE A4 PROFORMA INVOICE MODAL */}
      {previewQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-10 max-w-4xl w-full shadow-2xl my-6 max-h-[92vh] overflow-y-auto text-right font-sans" dir="rtl">
            
            {/* Top Toolbar (Hidden on Print) */}
            <div className="print:hidden flex items-center justify-between pb-5 border-b border-slate-200 mb-6">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                  معاينة فاتورة عرض السعر A4
                </span>
                <button
                  onClick={() => triggerCopy(getWhatsAppMessage(previewQuotation), 'wa-preview')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-emerald-200"
                >
                  <Share2 size={13} />
                  <span>{copiedKey === 'wa-preview' ? 'تم نسخ رسالة الواتساب!' : 'نسخ رسالة الواتساب'}</span>
                </button>
                <button
                  onClick={() => {
                    setPreviewQuotation(prev => prev ? {
                      ...prev,
                      combineShippingFeesInPrint: prev.combineShippingFeesInPrint === false ? true : false
                    } : null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-amber-200"
                  title="تغير بين إجمال الشحن بالمصاريف أو تفصيل كل رسم منفصل"
                >
                  <Truck size={13} />
                  <span>{previewQuotation.combineShippingFeesInPrint !== false ? 'عرض تفاصيل المصاريف' : 'إجمال الشحن بالمصاريف'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(previewQuotation.status !== 'محول_لطلب_شحن' || !orders.some(o => o.id === previewQuotation.convertedOrderId || o.orderNumber === previewQuotation.convertedOrderNumber || (o.quotationNumber && o.quotationNumber === previewQuotation.quotationNumber))) && (
                  <button
                    onClick={() => {
                      const q = previewQuotation;
                      setPreviewQuotation(null);
                      setConvertModalQuotation(q);
                      setConversionShippingCompany((settings?.companyNames && settings.companyNames[0]) || Object.keys(settings?.shippingOptions || {})[0] || '');
                      setConversionOrderStatus('قيد_التنفيذ');
                      setConversionCodMode('zero');
                      setConversionCustomCodAmount(0);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <Truck size={14} />
                    <span>تحويل للشحن (تصفير التحصيل) 🚀</span>
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Printer size={15} />
                  <span>طباعة أو حفظ PDF</span>
                </button>
                <button
                  onClick={() => setPreviewQuotation(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* PRINTABLE A4 CONTENT */}
            <div className="space-y-6 printable-quotation-document">
              
              {/* Store & Header */}
              <div className="flex justify-between items-start pb-6 border-b-2 border-slate-900">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {activeStore?.name || settings.storeName || 'المتجر الإلكتروني'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {(settings as any)?.storeAddress || 'مصر'} • هاتف: {(settings as any)?.storePhone || currentUser?.phone || '01000000000'}
                  </p>
                  {(settings as any)?.taxNumber && (
                    <p className="text-[11px] text-slate-400">الرقم الضريبي / السجل: {(settings as any).taxNumber}</p>
                  )}
                </div>

                <div className="text-left" dir="ltr">
                  <div className="inline-block bg-slate-900 text-white font-black text-sm px-4 py-1.5 rounded-lg uppercase tracking-wider mb-2">
                    PROFORMA INVOICE
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-900">
                    No: #{previewQuotation.quotationNumber}
                  </div>
                  <div className="text-xs text-slate-500">
                    Date: {new Date(previewQuotation.createdAt).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>

              {/* Bill To & Quotation Info */}
              <div className="grid grid-cols-2 gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="font-black text-slate-400 block text-[10px] uppercase mb-1">موجّه إلى السادة (Bill To):</span>
                  <div className="font-black text-sm text-slate-900">{previewQuotation.customerName}</div>
                  <div className="text-slate-600 font-mono mt-0.5">{previewQuotation.customerPhone}</div>
                  {previewQuotation.customerCity && (
                    <div className="text-slate-500 mt-0.5">{previewQuotation.customerCity} - {previewQuotation.customerAddress}</div>
                  )}
                </div>

                <div className="text-left space-y-1" dir="rtl">
                  <div>
                    <span className="text-slate-400 text-[10px] block font-bold">تاريخ الإصدار:</span>
                    <span className="font-mono font-bold">{new Date(previewQuotation.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-bold">سارٍ حتى (Valid Until):</span>
                    <span className="font-mono font-bold text-indigo-700">{new Date(previewQuotation.validUntil).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block font-bold">مسؤول المبيعات:</span>
                    <span className="font-bold text-slate-700">{previewQuotation.createdBy || 'المبيعات'}</span>
                  </div>
                </div>
              </div>

              {/* Table of Items */}
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-black">
                    <th className="p-3 rounded-r-lg w-10 text-center">#</th>
                    <th className="p-3">بيان البند / المنتجات والمواصفات</th>
                    <th className="p-3 text-center w-20">الكمية</th>
                    <th className="p-3 text-center w-28">سعر الوحدة</th>
                    <th className="p-3 rounded-l-lg text-left w-28">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewQuotation.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800">{item.name}</td>
                      <td className="p-3 text-center font-mono font-bold">{item.quantity}</td>
                      <td className="p-3 text-center font-mono">{item.price.toLocaleString()} ج.م</td>
                      <td className="p-3 text-left font-mono font-black text-slate-900">
                        {(item.price * item.quantity).toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div className="flex justify-between items-start pt-4 border-t border-slate-200">
                <div className="max-w-md space-y-2 text-xs">
                  <span className="font-black text-slate-800 block">شروط وأحكام العرض:</span>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {previewQuotation.terms || 'الأسعار سارية حتى تاريخ الصلاحية. هذا المستند هو فاتورة عرض أسعار مبدئية ولا يعتبر نهائياً حتى يتم اعتماده وتحويله لطلب شحن رسمي.'}
                  </p>
                </div>

                <div className="w-80 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>إجمالي البضاعة:</span>
                    <span className="font-mono font-bold">{previewQuotation.subtotal.toLocaleString()} ج.م</span>
                  </div>
                  {previewQuotation.combineShippingFeesInPrint !== false ? (
                    <div className="flex justify-between text-slate-800 font-bold">
                      <span>مصاريف الشحن والتسليم الإجمالية ({previewQuotation.shippingCompany || 'شركة الشحن'}):</span>
                      <span className="font-mono font-black">
                        +{(
                          (previewQuotation.shippingFee || 0) +
                          (previewQuotation.companyFeesTotal || ((previewQuotation.inspectionFee || 0) + (previewQuotation.insuranceFee || 0) + (previewQuotation.vatValue || 0) + (previewQuotation.codFee || 0))) +
                          (previewQuotation.roundingAdjustment && previewQuotation.roundingAdjustment < 0 ? Math.abs(previewQuotation.roundingAdjustment) : 0)
                        ).toLocaleString()} ج.م
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>مصاريف الشحن ({previewQuotation.shippingCompany || 'شركة الشحن'}):</span>
                        <span className="font-mono font-bold">
                          +{((previewQuotation.shippingFee || 0) + (previewQuotation.roundingAdjustment && previewQuotation.roundingAdjustment < 0 ? Math.abs(previewQuotation.roundingAdjustment) : 0)).toLocaleString()} ج.م
                        </span>
                      </div>
                      {previewQuotation.inspectionFee && previewQuotation.inspectionFee > 0 ? (
                        <div className="flex justify-between text-indigo-700 font-semibold">
                          <span>رسوم فحص ومعاينة الشحنة:</span>
                          <span className="font-mono font-bold">+{previewQuotation.inspectionFee.toLocaleString()} ج.م</span>
                        </div>
                      ) : null}
                      {previewQuotation.insuranceFee && previewQuotation.insuranceFee > 0 ? (
                        <div className="flex justify-between text-indigo-700 font-semibold">
                          <span>رسوم التأمين على الشحنة:</span>
                          <span className="font-mono font-bold">+{previewQuotation.insuranceFee.toLocaleString()} ج.م</span>
                        </div>
                      ) : null}
                      {previewQuotation.vatValue && previewQuotation.vatValue > 0 ? (
                        <div className="flex justify-between text-indigo-700 font-semibold">
                          <span>ضريبة القيمة المضافة (الشحن):</span>
                          <span className="font-mono font-bold">+{previewQuotation.vatValue.toLocaleString()} ج.م</span>
                        </div>
                      ) : null}
                    </>
                  )}
                  {previewQuotation.discount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>الخصم الممنوح:</span>
                      <span className="font-mono font-bold">-{previewQuotation.discount.toLocaleString()} ج.م</span>
                    </div>
                  )}
                  {previewQuotation.roundingAdjustment && previewQuotation.roundingAdjustment > 0 ? (
                    <div className="flex justify-between text-amber-800 font-bold bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                      <span>خصم تقفيل الكسر:</span>
                      <span className="font-mono font-black">
                        -{previewQuotation.roundingAdjustment.toLocaleString()} ج.م
                      </span>
                    </div>
                  ) : null}
                  <div className="pt-2 border-t-2 border-slate-900 flex justify-between text-base font-black text-slate-900">
                    <span>الصافي المطلوب:</span>
                    <span className="font-mono">{previewQuotation.total.toLocaleString()} ج.م</span>
                  </div>
                  {previewQuotation.advancePayment && previewQuotation.advancePayment > 0 && (
                    <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1 border-t border-slate-200">
                      <span>الدفعة المقدمة / العربون:</span>
                      <span className="font-mono">{previewQuotation.advancePayment.toLocaleString()} ج.م</span>
                    </div>
                  )}
                  {previewQuotation.remainingAmount !== undefined && (
                    <div className="flex justify-between text-xs font-bold text-indigo-900 pt-0.5">
                      <span>المتبقي للتحصيل عند التسليم (COD):</span>
                      <span className="font-mono font-black">{previewQuotation.remainingAmount.toLocaleString()} ج.م</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Signatures & Stamp */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
                <div className="text-center p-4 border border-dashed border-slate-300 rounded-xl">
                  <span className="text-slate-400 block mb-6">ختم وتوقيع المتجر / المبيعات</span>
                  <span className="font-bold text-slate-800">{activeStore?.name || settings.storeName || 'إدارة المبيعات'}</span>
                </div>
                <div className="text-center p-4 border border-dashed border-slate-300 rounded-xl">
                  <span className="text-slate-400 block mb-6">موافقة وتعميد العميل</span>
                  <span className="font-bold text-slate-800">{previewQuotation.customerName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Database & Tables Architecture Modal */}
      {showDbInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">أين تُحفظ البيانات وجداول عروض الأسعار؟</h3>
                  <p className="text-xs text-slate-500">معلومات التخزين وقواعد البيانات المعتمدة في النظام</p>
                </div>
              </div>
              <button
                onClick={() => setShowDbInfoModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Storage Layers */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">طبقات التخزين وقواعد البيانات:</h4>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>1. جدول <code className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">quotations</code> في IndexedDB</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    محلي دائم
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pr-4">
                  تخزين محلي سريع وعالي السعة داخل متصفحك مباشرة عبر محرك Dexie، مفهرس برقم العرض <code>quotationNumber</code> ومعرف المتجر <code>store_id</code>، مما يضمن عمل النظام فورياً ودون انقطاع.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span>2. السحابة السحابية Firebase Firestore</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    مزامنة سحابية
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pr-4">
                  تتم مزامنة كل عرض سعر تلقائياً مع خوادم جوجل السحابية داخل وثيقة المتجر <code>stores_data/{'{storeId}'}</code> لضمان توفر البيانات على جميع أجهزتك وأجهزة موظفيك.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                    <span>3. قاعدة بيانات Supabase (PostgreSQL السحابية)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                    علائقية متطورة
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pr-4">
                  تتم مزامنة عروض الأسعار مع جدول <code className="font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950 px-1 py-0.5 rounded">quotations</code> في Supabase بالإضافة لتخزين نسخة مضغوطة في إعدادات المتجر <code>stores_data</code>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>4. النسخ الاحتياطي الطارئ (Emergency LocalStorage)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    طبقة أمان فورية
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pr-4">
                  نسخة احتياطية مشفرة وخفيفة يتم تحديثها فورياً مع كل حركة لضمان عدم ضياع أي سجل حتى في حالة مسح بيانات الـ Cache أو انقطاع الاتصال.
                </p>
              </div>
            </div>

            {/* Why Quotation May Seem Missing */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 space-y-2">
              <div className="flex items-center gap-2 font-black text-sm text-amber-900 dark:text-amber-300">
                <HelpCircle size={17} className="text-amber-600 shrink-0" />
                <span>لماذا بدا أن عرض السعر اتمسح أو اختفى؟</span>
              </div>
              <ul className="text-xs text-amber-800/90 dark:text-amber-200/90 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>
                  <strong>الانتقال للتبويب المناسب:</strong> بمجرد تحويل عرض السعر لطلب شحن، تتغير حالته فوراً إلى «محول لطلب شحن»، وبالتالي يختفي من تبويب <em>«بانتظار الرد»</em> وينتقل إلى تبويب <strong>«محول للشحن»</strong> أو تبويب <strong>«الكل»</strong>.
                </li>
                <li>
                  <strong>وجوده كطلب شحن رسمي:</strong> يمكنك العثور عليه فوراً داخل <strong>«قسم الطلبات»</strong> بنفس تفاصيل العميل والمنتجات والمبلغ المخصص للتحصيل ورقم الإشارة.
                </li>
                <li>
                  <strong>الاسترجاع التلقائي:</strong> النظام الآن يفحص جدول الطلبات والنسخ الاحتياطية تلقائياً ويسترجع أي عرض سعر محول إذا فُقد من الواجهة.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  setShowDbInfoModal(false);
                  handleManualScanRestore();
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-md transition cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>فحص واسترجاع عروض الأسعار الآن</span>
              </button>

              <button
                onClick={() => setShowDbInfoModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationsPage;
