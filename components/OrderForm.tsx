import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  ChevronDown,
  Package,
  Coins,
  User as UserIcon,
  Building,
  Truck,
  CheckCircle,
  RefreshCcw,
  ArrowRightLeft,
  MapPin,
  Image as ImageIcon,
  X,
  ExternalLink,
  Link as LinkIcon,
  ShoppingBag,
  Info,
  Calculator,
  ArrowLeft,
  Percent,
  Save,
  FileText,
  LayoutList,
  Banknote,
  TrendingUp,
  Settings as SettingsIcon,
  Wand2,
  Shield,
  CreditCard,
  Star,
  AlertCircle,
  Loader2,
  Users,
  Wallet,
  Clock,
  Upload,
  HelpCircle,
  Check,
  Search,
  Sparkles,
  ChevronUp,
  Sliders,
  DollarSign,
  Layers,
  ArrowRight,
  Store as StoreIcon,
  UserCheck,
  Share2,
  Eye,
  ShieldCheck,
  Tag,
  PhoneCall,
  Paperclip,
  Calendar,
  Flag,
  AlertTriangle,
  Zap,
  Compass,
  ArrowRightCircle,
  ArrowLeftCircle,
  Edit3,
  Lock,
  Unlock
} from "lucide-react";
import {
  Order,
  Settings,
  OrderItem,
  Product,
  CustomerProfile,
  Store,
  User,
  OrderStatus,
  PreparationStatus,
  PaymentStatus
} from "../types";
import { EGYPT_GOVERNORATES } from "../constants";
import { motion, AnimatePresence } from "framer-motion";
import { CustomerSelectModal } from "./CustomerSelectModal";
import {
  calculateCodFee,
  getLatestProductCost,
  calculateInsuranceFee,
  getStandardShippingFee,
  calculateBostaVat,
} from "../utils/financials";

export interface NewOrderState extends Partial<Omit<Order, "id">> {
  items: OrderItem[];
  customerPhone2?: string;
  country?: string;
  buildingDetails?: string;
  creditAmount?: number;
  totalAmountOverrideReason?: string;
  advancePayment?: number;
  maintenanceItemValue?: number;
  advancePaymentPartnerId?: string;
  advancePaymentTreasuryId?: string;
  advancePaymentEmployeeId?: string;
  advancePaymentRecipientPhone?: string;
  advancePaymentSenderDetails?: string;
  recordedAsDebt?: boolean;
}

const OrderFormEditTotalModal: React.FC<{
  currentTotal: number;
  currentReason?: string;
  onClose: () => void;
  onApply: (amount: number, reason: string) => void;
}> = ({ currentTotal, currentReason, onClose, onApply }) => {
  const [amount, setAmount] = useState(currentTotal);
  const [reason, setReason] = useState(currentReason || "");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">
              تعديل وإقفال إجمالي المطلوب تحصيله (COD) يدوياً
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            سيتم فرض هذا المبلغ كإجمالي مطلوب تحصيله من العميل أو تسليمه للمندوب بدلاً من الحساب التلقائي.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                المبلغ المطلوب تحصيله الجديد
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl text-2xl font-black text-slate-800 dark:text-white outline-none focus:border-emerald-500 transition-all text-left pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                  ج.م
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                سبب التعديل اليدوي / ملاحظة الإقفال
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="أدخل سبب التعديل (مثال: اتفاق خاص، خصم إضافي، تقفيل مبلغ خاص...)"
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px] resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onApply(amount, reason)}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              حفظ التعديل وإقفال المبلغ
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};


interface OrderFormProps {
  orderData: NewOrderState | Order;
  setOrderData: React.Dispatch<React.SetStateAction<any>>;
  settings: Settings;
  isEditing: boolean;
  customers: CustomerProfile[];
  orders: Order[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  treasury?: any;
  allStoresData?: Record<string, any>;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  orderData,
  setOrderData,
  settings,
  isEditing,
  customers,
  orders,
  onSubmit,
  onCancel,
  treasury,
  allStoresData,
}) => {
  const navigate = useNavigate();

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400" dir="rtl">
        <Loader2 size={36} className="animate-spin mb-4 text-indigo-600" />
        <p className="text-sm font-bold">جاري تحميل الإعدادات والبيانات...</p>
      </div>
    );
  }

  const getArray = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object") return Object.values(val);
    return [];
  };

  const isExchange =
    (orderData as NewOrderState).orderType === "exchange" ||
    (orderData as NewOrderState).shipmentType === "exchange";
  const isReturn = (orderData as NewOrderState).shipmentType === "return";
  const isCashCollection =
    (orderData as NewOrderState).shipmentType === "cash_collection";
  const isMaintenance =
    (orderData as NewOrderState).orderType === "maintenance" ||
    (orderData as NewOrderState).shipmentType === "maintenance_pickup" ||
    (orderData as NewOrderState).shipmentType === "maintenance_return";
  const creditAmount = (orderData as NewOrderState).creditAmount || 0;

  // UI Modes & Wizard State
  const [uiMode, setUiMode] = useState<"wizard" | "single">("wizard");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
  const [showEditTotalModal, setShowEditTotalModal] = useState(false);
  const [isManualShippingOverride, setIsManualShippingOverride] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Product Adder Bar State
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState<string>("");
  const [selectedVariantIdToAdd, setSelectedVariantIdToAdd] = useState<string>("");
  
  // Visual Product Catalog State
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productFilterTab, setProductFilterTab] = useState<"all" | "in_stock" | "variants" | "low_stock">("all");
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const getShipmentTypeGuide = (type: string) => {
    switch (type) {
      case "delivery":
        return {
          title: "🚚 توصيل شحنة مبيعات (الأكثر استخداماً)",
          desc: "توصيل بضاعة جديدة للعميل وتحصيل قيمة الطلب ومصاريف الشحن نقداً عند الاستلام (COD).",
          badge: "أساسي",
          colorClass: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200",
        };
      case "partial_delivery":
        return {
          title: "📦 توصيل جزئي (معاينة واستلام أجزاء محددة)",
          desc: "يحق للعميل فتح الشحنة ومعاينة المنتجات واستلام جزء منها وإرجاع المتبقي مع المندوب.",
          badge: "مرن",
          colorClass: "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200",
        };
      case "exchange":
        return {
          title: "🔄 تبديل شحنة (استلام وتسليم في نفس الوقت)",
          desc: "تسليم منتج جديد للعميل واستلام منتج قديم أو مرتجع في نفس الوقت مع تحصيل أو دفع فرق السعر.",
          badge: "استبدال",
          colorClass: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200",
        };
      case "return":
        return {
          title: "↩️ إرجاع شحنة (استلام مرتجع فقط)",
          desc: "توجه المندوب لعنوان العميل لاستلام منتج مرتجع فقط ورده للمستودع دون تسليمه بضاعة جديدة.",
          badge: "مرتجع",
          colorClass: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200",
        };
      case "cash_collection":
        return {
          title: "💰 تحصيل نقدي فقط (بدون منتجات)",
          desc: "توجه المندوب للعميل لتحصيل مبلغ مالي، قسط، عربون، أو مديونية سابقة نقداً فقط دون منتجات.",
          badge: "تحصيل",
          colorClass: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200",
        };
      case "maintenance_pickup":
        return {
          title: "🛠️ سحب جهاز أو منتج للصيانة",
          desc: "توجه المندوب لاستلام منتج يحتاج صيانة من عنوان العميل وتوريده لمركز الصيانة.",
          badge: "صيانة",
          colorClass: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200",
        };
      case "maintenance_return":
        return {
          title: "✨ توصيل منتج بعد الصيانة للعميل",
          desc: "إعادة المنتج للعميل بعد إتمام الصيانة وتحصيل تكلفة الصيانة ومصاريف التوصيل.",
          badge: "صيانة",
          colorClass: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200",
        };
      default:
        return {
          title: "🚚 شحنة قياسية",
          desc: "توصيل بضاعة للعميل وتحصيل القيمة عند الاستلام.",
          badge: "عام",
          colorClass: "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-700 dark:text-slate-300",
        };
    }
  };

  const activeCompanies = useMemo(() => {
    const carrierKeys = Object.keys(settings.shippingOptions || {});
    return carrierKeys.filter(
      (company) => settings.activeCompanies?.[company] !== false
    );
  }, [settings.shippingOptions, settings.activeCompanies]);

  const shippingOptions = useMemo(() => {
    const company = orderData.shippingCompany;
    const userOptions = (company && settings.shippingOptions?.[company]) || [];
    const baseOptions = Array.isArray(userOptions) ? userOptions : Object.values(userOptions || {});
    const result = [...baseOptions];

    EGYPT_GOVERNORATES.forEach((gov, index) => {
      const exists = result.some((o: any) => o.label === gov.name);
      if (!exists) {
        result.push({
          id: `gov_fallback_${index}`,
          label: gov.name,
          details: "شحن قياسي",
          deliveryPrice: 55,
          baseWeight: 1,
          extraKgPrice: 5,
          returnPrice: 30,
          exchangePrice: 35,
          cashCollectionPrice: 0,
          returnToSenderPrice: 0,
          active: true,
          cities: (Array.isArray(gov.cities) ? gov.cities : []).map((city, cIndex) => ({
            id: `city_fallback_${index}_${cIndex}`,
            name: city,
            deliveryPrice: 55,
            extraKgPrice: 5,
            returnPrice: 30,
            exchangePrice: 35,
            cashCollectionPrice: 0,
            returnToSenderPrice: 0,
            useParentFees: true,
            active: true,
          })),
        });
      }
    });
    return Array.isArray(result) ? result as any[] : [];
  }, [settings.shippingOptions, orderData.shippingCompany]);

  const handleFieldChange = (field: keyof NewOrderState | string, value: any) => {
    setOrderData((prev: any) => ({ ...prev, [field]: value }));
    if (validationError) setValidationError(null);
  };

  const isFirstEditLoad = useRef(isEditing);

  // Auto Shipping Calculation
  useEffect(() => {
    const selectedOption = shippingOptions.find(
      (opt) => opt.label === (orderData.governorate || orderData.shippingArea)
    );
    if (selectedOption && !isManualShippingOverride) {
      const getPriceKey = (type?: string) => {
        if (type === "exchange") return "exchangePrice";
        if (type === "return") return "returnPrice";
        if (type === "maintenance_pickup") return "returnPrice";
        if (type === "maintenance_return") return "maintenanceReturnPrice";
        if (type === "cash_collection") return "cashCollectionPrice";
        return "deliveryPrice";
      };
      const priceKey = getPriceKey(orderData.shipmentType);
      let fee =
        (selectedOption[priceKey] as number) ||
        selectedOption.deliveryPrice ||
        0;
      let extraKgPrice = selectedOption.extraKgPrice || 0;
      if (orderData.city) {
        const cityOpt = selectedOption.cities?.find(
          (c) => c.name === orderData.city
        );
        if (cityOpt) {
          if (cityOpt.useParentFees) {
            fee =
              (selectedOption[priceKey] as number) ||
              selectedOption.deliveryPrice ||
              0;
            extraKgPrice = selectedOption.extraKgPrice || 0;
          } else {
            const cityFee =
              cityOpt[priceKey] !== undefined && cityOpt[priceKey] !== null
                ? cityOpt[priceKey]
                : cityOpt.deliveryPrice;
            if (cityFee !== undefined && cityFee !== null) {
              fee = cityFee;
              extraKgPrice = cityOpt.extraKgPrice || 0;
            }
          }
        }
      }

      const compFees =
        settings.companySpecificFees?.[orderData.shippingCompany!];
      const baseWeight =
        compFees?.useCustomFees && compFees.baseWeight !== undefined
          ? compFees.baseWeight
          : settings.baseWeight !== undefined
            ? settings.baseWeight
            : 5;

      const currentTotalWeight =
        getArray(orderData.items).reduce((sum: number, item: any) => {
          const itemWeight = parseFloat(item.weight?.toString() || "0");
          const itemQuantity = parseInt(item.quantity?.toString() || "1");
          return sum + itemWeight * itemQuantity;
        }, 0) || 0;
      const extraWeight = Math.max(0, currentTotalWeight - baseWeight);
      const totalFee = fee + Math.ceil(extraWeight) * extraKgPrice;

      if (totalFee !== orderData.shippingFee) {
        handleFieldChange("shippingFee", totalFee);
      }
    }
  }, [
    orderData.governorate,
    orderData.shippingArea,
    orderData.city,
    shippingOptions,
    orderData.items,
    orderData.shipmentType,
    isManualShippingOverride,
  ]);

  const handleCustomerSelect = (customer: CustomerProfile) => {
    setOrderData((prev: any) => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      governorate: customer.governorate || prev.governorate || "",
      shippingArea: customer.governorate || prev.shippingArea || "",
      city: customer.city || prev.city || "",
      shippingFee:
        typeof customer.shippingFee === "number"
          ? customer.shippingFee
          : prev.shippingFee || 0,
    }));
    setIsCustomerListOpen(false);
    if (validationError) setValidationError(null);
  };

  // Smart phone autocomplete suggestion
  const matchedCustomer = useMemo(() => {
    const phone = (orderData.customerPhone || "").trim();
    if (phone.length < 4 || isEditing) return null;
    return customers.find(c => c.phone.replace(/\D/g, '').includes(phone.replace(/\D/g, '')));
  }, [orderData.customerPhone, customers, isEditing]);

  const handleItemChange = (
    index: number,
    field: keyof OrderItem,
    value: any
  ) => {
    let newItems = [...getArray(orderData.items)];
    if (field === "productId") {
      const productsList = getArray(settings.products);
      const product = productsList.find((p) => p.id === value);
      if (!product) {
        handleFieldChange("items", newItems);
        return;
      }
      const existingItemIndex = newItems.findIndex(
        (item, i) => item.productId === value && !item.variantId && i !== index
      );
      if (existingItemIndex !== -1) {
        const existingItem = newItems[existingItemIndex];
        const currentItem = newItems[index];
        newItems[existingItemIndex] = {
          ...existingItem,
          quantity: (existingItem.quantity || 0) + (currentItem.quantity || 1),
        };
        newItems = newItems.filter((_, i) => i !== index);
      } else {
        newItems[index] = {
          ...newItems[index],
          productId: value,
          name: product.name,
          price: product.price,
          cost: getLatestProductCost(value, settings),
          weight: product.weight || 0,
          thumbnail: product.thumbnail || "",
          variantId: undefined,
          variantDescription: undefined,
        };
      }
    } else if (field === "variantId") {
      const productsList = getArray(settings.products);
      const product = productsList.find(
        (p) => p.id === newItems[index].productId
      );
      const variant = product?.variants?.find((v) => v.id === value);
      if (variant) {
        newItems[index] = {
          ...newItems[index],
          variantId: value,
          variantDescription: Object.entries(variant.options || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(", "),
          price: variant.price,
          cost: variant.costPrice || 0,
          weight: variant.weight || 0,
        };
      } else {
        newItems[index] = {
          ...newItems[index],
          variantId: undefined,
          variantDescription: undefined,
          price: product?.price || 0,
          cost: product?.costPrice || 0,
          weight: product?.weight || 0,
        };
      }
    } else {
      const updatedItem = { ...newItems[index], [field]: value };
      newItems[index] = updatedItem;
    }
    handleFieldChange("items", newItems);
  };

  // Smart Add Item from Selector Bar
  const handleAddSelectedProduct = () => {
    const productsList = getArray(settings.products);
    const targetId = selectedProductIdToAdd || (productsList[0]?.id || "");
    if (!targetId) return;

    const product = productsList.find(p => p.id === targetId);
    if (!product) return;

    const variant = product.variants?.find(v => v.id === selectedVariantIdToAdd);
    const currentItems = getArray(orderData.items);

    // Check if item already exists
    const existingIdx = currentItems.findIndex(
      it => it.productId === targetId && (it.variantId || "") === (selectedVariantIdToAdd || "")
    );

    if (existingIdx !== -1) {
      const updated = [...currentItems];
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: (updated[existingIdx].quantity || 1) + 1
      };
      handleFieldChange("items", updated);
    } else {
      const newItem: OrderItem = {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: variant ? variant.price : product.price,
        cost: variant ? (variant.costPrice || 0) : getLatestProductCost(product.id, settings),
        weight: variant ? (variant.weight || 0) : (product.weight || 0),
        thumbnail: product.thumbnail || "",
        discountValue: 0,
        discountType: "amount",
        variantId: variant ? variant.id : undefined,
        variantDescription: variant ? Object.entries(variant.options || {}).map(([k, v]) => `${k}: ${v}`).join(", ") : undefined
      };
      handleFieldChange("items", [...currentItems, newItem]);
    }
    if (validationError) setValidationError(null);
  };

  const handleQuickAddProduct = (product: Product, variant?: any) => {
    const currentItems = getArray(orderData.items);
    const targetVariantId = variant ? variant.id : "";
    const existingIdx = currentItems.findIndex(
      (it) => it.productId === product.id && (it.variantId || "") === targetVariantId
    );

    if (existingIdx !== -1) {
      const updated = [...currentItems];
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: (updated[existingIdx].quantity || 1) + 1,
      };
      handleFieldChange("items", updated);
    } else {
      const newItem: OrderItem = {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: variant ? variant.price : product.price,
        cost: variant ? (variant.costPrice || 0) : getLatestProductCost(product.id, settings),
        weight: variant ? (variant.weight || 0) : (product.weight || 0),
        thumbnail: product.thumbnail || product.images?.[0] || "",
        discountValue: 0,
        discountType: "amount",
        variantId: variant ? variant.id : undefined,
        variantDescription: variant
          ? Object.entries(variant.options || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")
          : undefined,
      };
      handleFieldChange("items", [...currentItems, newItem]);
    }
    if (validationError) setValidationError(null);
    const badgeId = variant ? `${product.id}-${variant.id}` : product.id;
    setRecentlyAddedId(badgeId);
    setTimeout(() => {
      setRecentlyAddedId((prev) => (prev === badgeId ? null : prev));
    }, 1500);
  };

  const removeItem = (index: number) => {
    handleFieldChange(
      "items",
      getArray(orderData.items).filter((_, i) => i !== index)
    );
  };

  const itemDiscounts = useMemo(
    () =>
      getArray(orderData.items).reduce((sum, item) => {
        let discount = 0;
        if (item.discountValue) {
          if (item.discountType === "percentage") {
            discount =
              (item.price || 0) *
              (item.quantity || 1) *
              (item.discountValue / 100);
          } else {
            discount = item.discountValue * (item.quantity || 1);
          }
        }
        return sum + discount;
      }, 0),
    [orderData.items]
  );

  const subtotal = useMemo(() => {
    return getArray(orderData.items).reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
      0
    );
  }, [orderData.items]);

  const totalWeight = useMemo(() => {
    return getArray(orderData.items).reduce(
      (sum, item) => sum + (item.weight || 0) * (item.quantity || 1),
      0
    );
  }, [orderData.items]);

  const isFlexShipSupported = useMemo(() => {
    if (!orderData.shippingCompany) return false;
    const compFees = settings.companySpecificFees?.[orderData.shippingCompany];
    if (compFees && compFees.enableFlexShip !== undefined) {
      return !!compFees.enableFlexShip;
    }
    return !!settings.enableFlexShip;
  }, [orderData.shippingCompany, settings.companySpecificFees, settings.enableFlexShip]);

  useEffect(() => {
    if (!orderData.warehouseId && settings?.warehouses && getArray(settings.warehouses).length > 0) {
      const defaultWh = getArray(settings.warehouses).find((w: any) => w.isDefault)?.id || getArray(settings.warehouses)[0]?.id;
      if (defaultWh && defaultWh !== orderData.warehouseId) {
        handleFieldChange("warehouseId", defaultWh);
      }
    }
  }, [settings?.warehouses, orderData.warehouseId]);

  const inspectionFee = useMemo(() => {
    if (orderData.includeInspectionFee === false || orderData.allowOpenShipment === false) return 0;
    const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
    const useCustom = compFees?.useCustomFees ?? false;
    return useCustom
      ? compFees?.inspectionFee || 0
      : settings.enableInspection
        ? settings.inspectionFee
        : 0;
  }, [orderData.includeInspectionFee, orderData.shippingCompany, settings]);

  const insuranceFee = useMemo(() => {
    if (orderData.isInsured === false) return 0;
    const company = orderData.shippingCompany;
    const compFees = settings.companySpecificFees?.[company!];
    const useCustom = compFees?.useCustomFees ?? false;
    const insuranceRate = useCustom
      ? (compFees?.insuranceFeePercent ?? 0)
      : settings.enableInsurance
        ? settings.insuranceFeePercent
        : 0;
    const valueForInsurance = Number(
      orderData.maintenanceItemValue || orderData.returnProductValue || 0
    );
    return calculateInsuranceFee(
      {
        ...(orderData as any),
        productPrice:
          valueForInsurance > 0
            ? valueForInsurance
            : isMaintenance
              ? Number(orderData.maintenanceCost) || 0
              : isReturn
                ? Number(
                    orderData.returnProductValue ||
                      orderData.maintenanceItemValue ||
                      0
                  )
                : subtotal - itemDiscounts,
      },
      insuranceRate,
      settings
    );
  }, [
    orderData.isInsured,
    orderData.maintenanceItemValue,
    orderData.returnProductValue,
    isMaintenance,
    orderData.shippingCompany,
    settings,
    subtotal,
    itemDiscounts,
    orderData.shippingFee,
    orderData.discount,
    orderData.discountAffectsInsurance,
    orderData.governorate,
    orderData.city,
    orderData.shippingArea,
    orderData.vatOnStandardShipping,
    orderData.items,
  ]);

  const activeVatAmount = useMemo(() => {
    return calculateBostaVat(orderData as Order, insuranceFee, settings);
  }, [
    orderData.shippingCompany,
    settings,
    orderData.governorate,
    orderData.shippingArea,
    orderData.city,
    orderData.items,
    orderData.shipmentType,
    orderData.includeInspectionFee,
    inspectionFee,
    isMaintenance,
    orderData.maintenanceCost,
    insuranceFee,
    orderData.shippingFee,
    orderData.vatOnStandardShipping,
  ]);

  const finalAmount = useMemo(() => {
    if (orderData.totalAmountOverride !== undefined && orderData.totalAmountOverride !== null && !isNaN(Number(orderData.totalAmountOverride)) && String(orderData.totalAmountOverride).trim() !== "") {
      return Number(orderData.totalAmountOverride);
    }
    if (
      orderData.shipmentType === "maintenance_pickup" &&
      orderData.deferPaymentToReturn
    ) {
      return 0;
    }
    const basePrice = isMaintenance
      ? Number(orderData.maintenanceCost) || 0
      : subtotal - itemDiscounts;
    const shipping = Number(orderData.shippingFee) || 0;
    const inspection =
      orderData.includeInspectionFee !== false &&
      orderData.allowOpenShipment !== false &&
      orderData.inspectionFeePaidByCustomer !== false
        ? inspectionFee
        : 0;
    const insurance = insuranceFee;
    const vat = activeVatAmount;
    const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
    const useCustom = compFees?.useCustomFees ?? false;
    const defaultFlexFee = useCustom
      ? (compFees?.flexShipFee ?? 150)
      : (settings.flexShipFee ?? 150);
    const flexShip = isFlexShipSupported && orderData.enableFlexShip && orderData.flexShipFeePaidByCustomer
      ? orderData.flexShipFee !== undefined
        ? Number(orderData.flexShipFee)
        : defaultFlexFee
      : 0;
    const discount = Number(orderData.discount) || 0;
    const advance = Number(orderData.advancePayment) || 0;
    const credit = Number(creditAmount) || 0;

    let total =
      basePrice +
      shipping +
      inspection +
      vat +
      flexShip -
      discount -
      advance -
      credit;

    if (orderData.returnCashToCustomer && orderData.cashToReturnAmount) {
      total -= Number(orderData.cashToReturnAmount);
    }
    return Math.max(0, Math.round(total));
  }, [
    orderData.totalAmountOverride,
    orderData.shipmentType,
    orderData.deferPaymentToReturn,
    orderData.maintenanceCost,
    isMaintenance,
    subtotal,
    itemDiscounts,
    orderData.shippingFee,
    orderData.includeInspectionFee,
    inspectionFee,
    insuranceFee,
    activeVatAmount,
    isFlexShipSupported,
    orderData.enableFlexShip,
    orderData.flexShipFee,
    orderData.discount,
    orderData.advancePayment,
    creditAmount,
    orderData.returnCashToCustomer,
    orderData.cashToReturnAmount,
  ]);

  const shipmentGuide = getShipmentTypeGuide(orderData.shipmentType || "delivery");
  const availableStaff = useMemo(() => {
    const list = (settings as any).staff || (settings as any).team || (settings as any).employees || [];
    if (Array.isArray(list)) return list;
    if (typeof list === "object" && list !== null) return Object.values(list);
    return [];
  }, [settings]);

  const treasuryAccountsList = useMemo(() => {
    if (treasury) {
      if (Array.isArray(treasury)) return treasury;
      if (Array.isArray(treasury.accounts)) return treasury.accounts;
      if (typeof treasury === "object" && treasury !== null) return Object.values(treasury);
    }
    const settingsAccounts = (settings as any).treasuryAccounts || (settings as any).treasury?.accounts || [];
    if (Array.isArray(settingsAccounts)) return settingsAccounts;
    if (typeof settingsAccounts === "object" && settingsAccounts !== null) return Object.values(settingsAccounts);
    return [];
  }, [treasury, settings]);

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!orderData.customerPhone || orderData.customerPhone.trim().length < 6) {
        setValidationError("برجاء إدخال رقم هاتف العميل (6 أرقام على الأقل) للمتابعة");
        return false;
      }
    }
    if (step === 2) {
      const requiresItems = ["delivery", "partial_delivery", "exchange"].includes(orderData.shipmentType || "delivery");
      if (requiresItems && getArray(orderData.items).length === 0) {
        setValidationError("برجاء إضافة منتج واحد على الأقل في سلة الطلب لهذا النوع من الشحن");
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep(wizardStep)) return;
    if (wizardStep < 4) {
      setWizardStep((prev) => (prev + 1) as any);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    if (wizardStep > 1) {
      setWizardStep((prev) => (prev - 1) as any);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleValidatedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2)) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    onSubmit(e);
  };

  // Render Step 1: Customer & Shipment Type
  const renderStep1_CustomerAndShipment = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Shipment Type Selector */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              1
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">نوع العملية وأسلوب الشحن</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">اختر نوع الشحنة وتأثيرها على المخزون والمندوب</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 sm:gap-3 gap-2">
          {[
            { id: "delivery", label: "توصيل مبيعات", icon: <Truck size={18} /> },
            { id: "partial_delivery", label: "توصيل جزئي", icon: <Package size={18} /> },
            { id: "exchange", label: "تبديل شحنة", icon: <ArrowRightLeft size={18} /> },
            { id: "return", label: "إرجاع شحنة", icon: <RefreshCcw size={18} /> },
            { id: "cash_collection", label: "تحصيل نقدي", icon: <Coins size={18} /> },
            { id: "maintenance_pickup", label: "سحب للصيانة", icon: <SettingsIcon size={18} /> },
            { id: "maintenance_return", label: "توصيل صيانة", icon: <Wand2 size={18} /> },
          ].map((type) => {
            const isSelected = orderData.shipmentType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  handleFieldChange("shipmentType", type.id);
                  if (type.id === "exchange") handleFieldChange("orderType", "exchange");
                  else if (type.id.startsWith("maintenance")) handleFieldChange("orderType", "maintenance");
                  else handleFieldChange("orderType", "regular");
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 font-black text-xs transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500"
                }`}
              >
                <div className={isSelected ? "text-white" : "text-indigo-600 dark:text-indigo-400"}>
                  {type.icon}
                </div>
                <span className="text-center line-clamp-1">{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Shipment Guide Box */}
        <div className={`p-4 sm:p-5 rounded-2xl border ${shipmentGuide.colorClass} flex items-start gap-3.5 transition-all`}>
          <Info className="shrink-0 mt-0.5 text-current" size={20} />
          <div className="space-y-1 text-xs">
            <h4 className="font-black sm:text-sm">{shipmentGuide.title}</h4>
            <p className="leading-relaxed opacity-90 font-medium">{shipmentGuide.desc}</p>
          </div>
        </div>

        {/* Specialized Fields based on shipment type */}
        {isExchange && (
          <div className="p-5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-2xl space-y-4">
            <h4 className="font-extrabold text-xs text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
              <ArrowRightLeft size={16} /> بيانات الشحنة المستبدلة
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">رقم الطلب الأصلي المراد استبداله</label>
                <input
                  type="text"
                  placeholder="مثال: ORD-1020"
                  value={orderData.originalOrderId || ""}
                  onChange={(e) => handleFieldChange("originalOrderId", e.target.value)}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">فرق السعر (إن وجد)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={orderData.exchangeDifference || ""}
                  onChange={(e) => handleFieldChange("exchangeDifference", parseFloat(e.target.value) || 0)}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {isReturn && (
          <div className="p-5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-2xl space-y-4">
            <h4 className="font-extrabold text-xs text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
              <RefreshCcw size={16} /> إعدادات الإرجاع المالي والمخزني
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">قيمة المرتجع التقديرية</label>
                <input
                  type="number"
                  placeholder="0"
                  value={orderData.returnProductValue || ""}
                  onChange={(e) => handleFieldChange("returnProductValue", parseFloat(e.target.value) || 0)}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white font-mono"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="returnCashCheck"
                  checked={!!orderData.returnCashToCustomer}
                  onChange={(e) => handleFieldChange("returnCashToCustomer", e.target.checked)}
                  className="w-5 h-5 accent-rose-600 rounded cursor-pointer"
                />
                <label htmlFor="returnCashCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  تسليم نقدية للعميل مع المندوب
                </label>
              </div>
              {orderData.returnCashToCustomer && (
                <div>
                  <label className="text-xs font-bold text-rose-600 dark:text-rose-400 block mb-1">المبلغ المطلوب رده للعميل (ج.م)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={orderData.cashToReturnAmount || ""}
                    onChange={(e) => handleFieldChange("cashToReturnAmount", parseFloat(e.target.value) || 0)}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400 font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {isMaintenance && (
          <div className="p-5 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/60 rounded-2xl space-y-4">
            <h4 className="font-extrabold text-xs text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
              <Wand2 size={16} /> بيانات الصيانة وتكاليف الإصلاح
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">تكلفة الصيانة وقطع الغيار (ج.م)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={orderData.maintenanceCost || ""}
                  onChange={(e) => handleFieldChange("maintenanceCost", parseFloat(e.target.value) || 0)}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">قيمة الجهاز التقديرية (للتأمين)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={orderData.maintenanceItemValue || ""}
                  onChange={(e) => handleFieldChange("maintenanceItemValue", parseFloat(e.target.value) || 0)}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white font-mono"
                />
              </div>
              {orderData.shipmentType === "maintenance_pickup" && (
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="deferCheck"
                    checked={!!orderData.deferPaymentToReturn}
                    onChange={(e) => handleFieldChange("deferPaymentToReturn", e.target.checked)}
                    className="w-5 h-5 accent-sky-600 rounded cursor-pointer"
                  />
                  <label htmlFor="deferCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    تأجيل التحصيل لمرحلة التسليم بعد الصيانة
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Customer Details Box */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              2
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">بيانات العميل وعنوان التوصيل</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">ادخل رقم الهاتف وسيقوم النظام بالتعرف التلقائي على العملاء المسجلين</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCustomerListOpen(true)}
            className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-bold rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-indigo-200/60 dark:border-indigo-800"
          >
            <Users size={16} />
            <span>اختيار من قائمة العملاء المسجلين</span>
          </button>
        </div>

        {/* Smart Autocomplete Recommendation */}
        {matchedCustomer && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <UserCheck size={18} />
              </div>
              <div className="text-xs">
                <span className="font-black text-emerald-900 dark:text-emerald-200 block sm:inline">
                  ✨ تم التعرف على العميل مسجل مسبقاً:{" "}
                </span>
                <span className="font-bold text-slate-800 dark:text-white sm:mr-1">
                  {matchedCustomer.name} ({matchedCustomer.governorate || "بدون محافظة"})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCustomerSelect(matchedCustomer)}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            >
              <Check size={14} />
              <span>تعبئة البيانات تلقائياً</span>
            </button>
          </div>
        )}

        {/* Customer Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><PhoneCall size={14} className="text-indigo-500" /> رقم الهاتف الأساسي *</span>
              <span className="text-[10px] text-slate-400">مطلوب</span>
            </label>
            <input
              type="tel"
              required
              placeholder="01xxxxxxxxx"
              value={orderData.customerPhone || ""}
              onChange={(e) => handleFieldChange("customerPhone", e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <PhoneCall size={14} className="text-slate-400" /> رقم هاتف إضافي (اختياري)
            </label>
            <input
              type="tel"
              placeholder="رقم بديل للمتابعة..."
              value={orderData.customerPhone2 || ""}
              onChange={(e) => handleFieldChange("customerPhone2", e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <UserIcon size={14} className="text-indigo-500" /> اسم العميل بالكامل *
            </label>
            <input
              type="text"
              placeholder="مثال: أحمد محمد..."
              value={orderData.customerName || ""}
              onChange={(e) => handleFieldChange("customerName", e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <MapPin size={14} className="text-indigo-500" /> المحافظة *
            </label>
            <select
              value={orderData.governorate || orderData.shippingArea || ""}
              onChange={(e) => {
                const val = e.target.value;
                handleFieldChange("governorate", val);
                handleFieldChange("shippingArea", val);
                handleFieldChange("city", "");
              }}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="">-- اختر المحافظة --</option>
              {shippingOptions.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label} ({opt.deliveryPrice || 0} ج.م)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building size={14} className="text-indigo-500" /> المدينة / المنطقة *
            </label>
            {(() => {
              const selectedGov = shippingOptions.find(
                (opt) => opt.label === (orderData.governorate || orderData.shippingArea)
              );
              const citiesList = selectedGov && Array.isArray(selectedGov.cities) ? selectedGov.cities : [];
              if (citiesList.length > 0) {
                return (
                  <select
                    value={orderData.city || ""}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- اختر المدينة / المنطقة --</option>
                    {citiesList.map((city: any, cIdx: number) => (
                      <option key={city.id || cIdx} value={city.name}>
                        {city.name} {!city.useParentFees && city.deliveryPrice ? `(${city.deliveryPrice} ج.م)` : ""}
                      </option>
                    ))}
                  </select>
                );
              }
              return (
                <input
                  type="text"
                  placeholder="اسم المدينة، الحي، أو المركز..."
                  value={orderData.city || ""}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              );
            })()}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <StoreIcon size={14} className="text-indigo-500" /> فرع المتجر المسؤول
            </label>
            <select
              value={orderData.storeBranchId || ""}
              onChange={(e) => handleFieldChange("storeBranchId", e.target.value || undefined)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="">-- الفرع الرئيسي --</option>
              {getArray(settings.storeBranches).map((branch: any) => (
                <option key={branch.id} value={branch.id}>
                  🏢 {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2 md:col-span-3">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <MapPin size={14} className="text-indigo-500" /> العنوان بالتفصيل (الشارع والمبنى والدور) *
            </label>
            <input
              type="text"
              placeholder="مثال: شارع النهضة، عمارة 15، الدور الثالث، شقة 8، بجوار صيدلية..."
              value={orderData.customerAddress || ""}
              onChange={(e) => handleFieldChange("customerAddress", e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Render Step 2: Products & Warehouses
  const renderStep2_ProductsAndFulfillment = () => {
    const productsList = getArray(settings.products);
    const selectedProductForBar = productsList.find(p => p.id === selectedProductIdToAdd) || productsList[0];
    const availableVariants = selectedProductForBar?.variants || [];

    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Warehouse & Fulfillment Banner */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                3
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white">المستودع وحالة التجهيز</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">اختر المخزن المسؤول عن صرف البضاعة وحالة تجهيز الشحنة</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <StoreIcon size={14} className="text-indigo-500" /> المخزن / المستودع المسؤول *
              </label>
              <select
                value={orderData.warehouseId || ""}
                onChange={(e) => handleFieldChange("warehouseId", e.target.value || undefined)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
              >
                <option value="">-- اختر المخزن / المستودع --</option>
                {getArray(settings.warehouses).map((w: any) => (
                  <option key={w.id} value={w.id}>
                    🏪 {w.name} {w.isDefault ? "(الافتراضي)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-500" /> حالة تجهيز الطلب في المخزن
              </label>
              <select
                value={orderData.preparationStatus || "none"}
                onChange={(e) => handleFieldChange("preparationStatus", e.target.value as PreparationStatus)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
              >
                <option value="none">⏳ قيد الانتظار (لم يبدأ التجهيز)</option>
                <option value="in_progress">🔄 جاري التجهيز والتغليف</option>
                <option value="ready">✅ جاهز للتسليم لشركة الشحن</option>
              </select>
            </div>
          </div>
        </div>

        {/* Modern Visual Product Catalog & Picker */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                <Sparkles size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  كتالوج المنتجات والمخزون (اختيار مع الصور والكميات)
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  ابحث أو تصفح المنتجات واضغط على زر الإضافة لإدراجها في سلة الفاتورة فوراً
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="🔍 بحث بالاسم، الكود SKU، أو الوصف..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              />
              {productSearchQuery && (
                <button
                  type="button"
                  onClick={() => setProductSearchQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setProductFilterTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                productFilterTab === "all"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <Package size={14} />
              <span>الكل ({productsList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setProductFilterTab("in_stock")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                productFilterTab === "in_stock"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <CheckCircle size={14} />
              <span>متوفر بالمخزون</span>
            </button>
            <button
              type="button"
              onClick={() => setProductFilterTab("variants")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                productFilterTab === "variants"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <Layers size={14} />
              <span>منتجات بمتغيرات</span>
            </button>
            <button
              type="button"
              onClick={() => setProductFilterTab("low_stock")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                productFilterTab === "low_stock"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <AlertTriangle size={14} />
              <span>مخزون منخفض/نفد</span>
            </button>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[520px] overflow-y-auto pr-1">
            {(() => {
              const filtered = productsList.filter((p) => {
                const q = productSearchQuery.trim().toLowerCase();
                const matchQuery =
                  !q ||
                  p.name.toLowerCase().includes(q) ||
                  (p.sku && p.sku.toLowerCase().includes(q)) ||
                  (p.description && p.description.toLowerCase().includes(q)) ||
                  (p.variants && p.variants.some((v) => Object.values(v.options || {}).join(" ").toLowerCase().includes(q) || (v.sku && v.sku.toLowerCase().includes(q))));

                if (!matchQuery) return false;

                const whId = orderData.warehouseId;
                const stockVal = whId && p.warehouseStock && p.warehouseStock[whId] !== undefined 
                  ? p.warehouseStock[whId] 
                  : (p.stock !== undefined ? p.stock : (p.stockQuantity ?? 0));
                if (productFilterTab === "in_stock") return stockVal > 0;
                if (productFilterTab === "variants") return (p.variants && p.variants.length > 0) || p.hasVariants;
                if (productFilterTab === "low_stock") return stockVal <= 5;
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                    <Package size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-black text-slate-600 dark:text-slate-400">لا توجد منتجات مطابقة للبحث أو الفلتر المختار</p>
                    <button
                      type="button"
                      onClick={() => { setProductSearchQuery(""); setProductFilterTab("all"); }}
                      className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      عرض جميع المنتجات
                    </button>
                  </div>
                );
              }

              return filtered.map((p) => {
                const whId = orderData.warehouseId;
                const stockVal = whId && p.warehouseStock && p.warehouseStock[whId] !== undefined 
                  ? p.warehouseStock[whId] 
                  : (p.stock !== undefined ? p.stock : (p.stockQuantity ?? 0));
                const isOutOfStock = stockVal <= 0;
                const isLowStock = stockVal > 0 && stockVal <= 5;
                const thumbImg = p.thumbnail || p.images?.[0] || "";
                const hasVars = p.variants && p.variants.length > 0;

                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all shadow-xs group"
                  >
                    <div>
                      {/* Top Header: Image + Title + Price */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-16 h-16 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
                          {thumbImg ? (
                            <img src={thumbImg} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-400">
                              <Package size={26} />
                            </div>
                          )}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-rose-950/60 backdrop-blur-[1px] flex items-center justify-center text-[10px] font-black text-white text-center p-1">
                              نفد
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-white truncate" title={p.name}>
                            {p.name}
                          </h4>
                          {p.sku && (
                            <span className="text-[10px] text-slate-400 font-mono block truncate">
                              #{p.sku}
                            </span>
                          )}
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                              {p.price.toLocaleString("ar-EG")} ج.م
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stock Badge */}
                      <div className="mb-3 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-bold">المخزون المتاح:</span>
                        {isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-black text-[10px] flex items-center gap-1 border border-rose-200 dark:border-rose-800">
                            <AlertTriangle size={11} /> 0 (نفد المخزون)
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-black text-[10px] flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                            <AlertCircle size={11} /> متاح {stockVal} فقط
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-black text-[10px] flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle size={11} /> متاح: {stockVal}
                          </span>
                        )}
                      </div>

                      {/* Variants Section if available */}
                      {hasVars && (
                        <div className="mb-3 space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-[10px] font-extrabold text-slate-500 block">اختر من المتغيرات المتاحة:</span>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                            {p.variants.map((v) => {
                              const whId = orderData.warehouseId;
                              const varStock = whId && v.warehouseStock && v.warehouseStock[whId] !== undefined 
                                ? v.warehouseStock[whId] 
                                : (v.stock !== undefined ? v.stock : (v.stockQuantity ?? 0));
                              const varTitle = Object.values(v.options || {}).join("/") || v.sku || "متغير";
                              const badgeId = `${p.id}-${v.id}`;
                              const isAdded = recentlyAddedId === badgeId;

                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => handleQuickAddProduct(p, v)}
                                  className={`px-2 py-1 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 border cursor-pointer ${
                                    isAdded
                                      ? "bg-emerald-600 text-white border-emerald-600 scale-95"
                                      : varStock <= 0
                                      ? "bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100"
                                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                                  }`}
                                  title={`إضافة ${varTitle} - السعر: ${v.price || p.price} ج.م [متاح: ${varStock}]`}
                                >
                                  <span>{isAdded ? "✓ تم الإضافة" : varTitle}</span>
                                  <span className="opacity-70">({v.price || p.price}ج)</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Direct Add Button for Simple Product */}
                    {!hasVars && (
                      <button
                        type="button"
                        onClick={() => handleQuickAddProduct(p)}
                        className={`w-full py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
                          recentlyAddedId === p.id
                            ? "bg-emerald-600 text-white"
                            : isOutOfStock
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
                        }`}
                      >
                        {recentlyAddedId === p.id ? (
                          <>
                            <CheckCircle size={14} />
                            <span>تم الإضافة بنجاح ✓</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>{isOutOfStock ? "إضافة للأوردر (مخزون 0)" : "إضافة للأوردر"}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Basket Items List */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <ShoppingBag size={22} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">سلة الطلب والمخزون المدرج ({getArray(orderData.items).length} أصناف)</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">تعديل الكميات، أسعار البيع، أو الخصومات الخاصة على كل صنف</p>
              </div>
            </div>
          </div>

          {getArray(orderData.items).length === 0 ? (
            <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center">
                <ShoppingBag size={32} />
              </div>
              <p className="text-sm font-extrabold text-slate-700 dark:text-slate-300">سلة المنتجات فارغة حالياً</p>
              <p className="text-xs text-slate-400 max-w-sm">استخدم شريط الإضافة السريع باللون الكحلي أعلاه لاختيار المنتجات وإدراجها في الطلب</p>
            </div>
          ) : (
            <div className="space-y-4">
              {getArray(orderData.items).map((item, index) => {
                const itemPrice = Number(item.price || 0);
                const itemQty = Number(item.quantity || 1);
                const itemDiscountVal = Number(item.discountValue || 0);
                const itemDiscount = item.discountType === "percentage"
                  ? itemPrice * itemQty * (itemDiscountVal / 100)
                  : itemDiscountVal * itemQty;
                const itemTotal = (itemPrice * itemQty) - itemDiscount;

                return (
                  <div
                    key={index}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:border-indigo-400/50"
                  >
                    {/* Item title & Variant */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={22} className="text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-sm text-slate-800 dark:text-white truncate">{item.name}</h4>
                        {item.variantDescription && (
                          <span className="inline-block px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-extrabold mt-1">
                            {item.variantDescription}
                          </span>
                        )}
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">
                          الوزن: {item.weight || 0} كجم | التكلفة: {item.cost || 0} ج.م
                        </div>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block text-center">الكمية</label>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, "quantity", Math.max(1, itemQty - 1))}
                            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg font-black text-xs flex items-center justify-center hover:bg-slate-200"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={itemQty}
                            onChange={(e) => handleItemChange(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-10 text-center text-xs font-black bg-transparent outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, "quantity", itemQty + 1)}
                            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg font-black text-xs flex items-center justify-center hover:bg-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 w-24">
                        <label className="text-[10px] font-bold text-slate-400 block text-center">سعر الوحدة (ج.م)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={itemPrice}
                          onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value) || 0)}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center font-mono outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1 w-28">
                        <label className="text-[10px] font-bold text-slate-400 block text-center">خصم الصنف</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="0"
                            value={item.discountValue || ""}
                            onChange={(e) => handleItemChange(index, "discountValue", parseFloat(e.target.value) || 0)}
                            className="w-16 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center font-mono outline-none"
                          />
                          <select
                            value={item.discountType || "amount"}
                            onChange={(e) => handleItemChange(index, "discountType", e.target.value)}
                            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold outline-none"
                          >
                            <option value="amount">ج.م</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1 text-center min-w-[80px]">
                        <label className="text-[10px] font-bold text-slate-400 block">الإجمالي</label>
                        <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 block pt-1.5">
                          {Math.round(itemTotal).toLocaleString("ar-EG")} ج.م
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        title="حذف الصنف"
                        className="w-9 h-9 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center transition-all cursor-pointer self-center mt-4 sm:mt-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Step 3: Shipping & Services
  const renderStep3_ShippingAndServices = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              5
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">شركة الشحن والتوصيل</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">اختر شركة التوصيل ومصاريف الشحن والخدمات الإضافية</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Truck size={14} className="text-indigo-500" /> شركة الشحن / التوصيل *
            </label>
            <select
              value={orderData.shippingCompany || ""}
              onChange={(e) => {
                const comp = e.target.value;
                handleFieldChange("shippingCompany", comp);
                const opts = settings.shippingOptions?.[comp];
                if (opts && Array.isArray(opts) && opts.length > 0) {
                  handleFieldChange("shippingOptionId", opts[0].id);
                }
              }}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="">-- اختر شركة الشحن --</option>
              {activeCompanies.map((comp) => (
                <option key={comp} value={comp}>
                  🚚 {settings.companyNames?.[comp] || comp}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <DollarSign size={14} className="text-amber-500" /> مصاريف الشحن والوزن (ج.م) *
              </label>
              <button
                type="button"
                onClick={() => setIsManualShippingOverride(!isManualShippingOverride)}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {isManualShippingOverride ? "🔄 العودة للحساب التلقائي" : "✏️ تعديل يدوي"}
              </button>
            </div>
            <input
              type="number"
              disabled={!isManualShippingOverride}
              value={orderData.shippingFee !== undefined ? orderData.shippingFee : 0}
              onChange={(e) => handleFieldChange("shippingFee", parseFloat(e.target.value) || 0)}
              className={`w-full p-3.5 border rounded-2xl text-sm font-black font-mono transition-all ${
                isManualShippingOverride
                  ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 text-amber-900 dark:text-amber-300 focus:ring-2 focus:ring-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 opacity-80 cursor-not-allowed"
              }`}
            />
          </div>
        </div>

        {/* Extra Shipping Services Grid */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-extrabold text-xs text-slate-800 dark:text-white block">سماحية فتح الشحنة ومعاينتها</span>
              <span className="text-[11px] text-slate-400 block">يسمح للمندوب بفتح الغلاف للعميل قبل السداد</span>
            </div>
            <input
              type="checkbox"
              checked={orderData.includeInspectionFee !== false && orderData.allowOpenShipment !== false}
              onChange={(e) => {
                const checked = e.target.checked;
                handleFieldChange("allowOpenShipment", checked);
                handleFieldChange("includeInspectionFee", checked);
              }}
              className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-extrabold text-xs text-slate-800 dark:text-white block">التأمين على الشحنة ضد التلف</span>
              <span className="text-[11px] text-slate-400 block">حساب نسبة تأمين لحماية قيمة الطلب</span>
            </div>
            <input
              type="checkbox"
              checked={orderData.isInsured !== false}
              onChange={(e) => handleFieldChange("isInsured", e.target.checked)}
              className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {isFlexShipSupported && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 flex flex-col gap-3 sm:col-span-2 transition-all">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs text-indigo-900 dark:text-indigo-200 block">تفعيل خدمة الشحن المرن (FlexShip) 📦</span>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block">إرسال مقاسات متعددة واختيار العميل للأنسب وإرجاع الباقي عند التسليم</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!orderData.enableFlexShip}
                  onChange={(e) => handleFieldChange("enableFlexShip", e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
              {orderData.enableFlexShip && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-800/60 animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-indigo-900 dark:text-indigo-200 block">
                      رسوم الفليكس على العميل (عند الرفض/الإرجاع ج.م)
                    </label>
                    <input
                      type="number"
                      value={orderData.flexShipFee !== undefined ? orderData.flexShipFee : (settings.companySpecificFees?.[orderData.shippingCompany!]?.flexShipFee ?? settings.flexShipFee ?? 150)}
                      onChange={(e) => handleFieldChange("flexShipFee", parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-xl font-mono text-xs font-bold text-indigo-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-extrabold text-rose-900 dark:text-rose-200 block">
                      استقطاع شركة الشحن من الفليكس (ج.م)
                    </label>
                    <input
                      type="number"
                      value={orderData.flexShipCompanyFee !== undefined ? orderData.flexShipCompanyFee : (settings.companySpecificFees?.[orderData.shippingCompany!]?.flexShipCompanyFee ?? settings.flexShipCompanyFee ?? 10)}
                      onChange={(e) => handleFieldChange("flexShipCompanyFee", parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-xl font-mono text-xs font-bold text-rose-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="sm:col-span-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer bg-indigo-100/60 dark:bg-indigo-900/30 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                      <input
                        type="checkbox"
                        checked={!!orderData.flexShipFeePaidByCustomer}
                        onChange={(e) => handleFieldChange("flexShipFeePaidByCustomer", e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                      <span>تم تحصيل رسوم الفليكس شيب من العميل بالفعل (تُضاف لإجمالي الفاتورة الآن)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render Step 4: Financials & Notes
  const renderStep4_FinancialsAndNotes = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Financials & Advance Payment Card */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              6
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">الخصومات والعربون المسبق</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">خصم إضافي على الفاتورة وتوثيق العربون المدفوع مسبقاً</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Percent size={14} className="text-emerald-500" /> خصم إضافي على إجمالي الفاتورة (ج.م)
              </label>
              <button
                type="button"
                onClick={() => handleFieldChange("discountAffectsInsurance", orderData.discountAffectsInsurance === false ? true : false)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer select-none border ${
                  orderData.discountAffectsInsurance !== false
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30 hover:bg-emerald-100/70"
                    : "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30 hover:bg-rose-100/70"
                }`}
              >
                {orderData.discountAffectsInsurance !== false ? (
                  <>
                    <Unlock size={11} className="text-emerald-500" />
                    <span>تأثير الخصم على التأمين: نشط 🔓</span>
                  </>
                ) : (
                  <>
                    <Lock size={11} className="text-rose-500" />
                    <span>تأثير الخصم على التأمين: مغلق 🔒</span>
                  </>
                )}
              </button>
            </div>
            <input
              type="number"
              placeholder="0"
              value={orderData.discount || ""}
              onChange={(e) => handleFieldChange("discount", parseFloat(e.target.value) || 0)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Coins size={14} className="text-amber-500" /> عربون مدفوع مقدماً (Advance Payment)
            </label>
            <input
              type="number"
              placeholder="0"
              value={orderData.advancePayment || ""}
              onChange={(e) => handleFieldChange("advancePayment", parseFloat(e.target.value) || 0)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-amber-600 dark:text-amber-400 font-mono focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
            />
          </div>
        </div>

        {Number(orderData.advancePayment || 0) > 0 && (
          <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-4">
            <h4 className="font-extrabold text-xs text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Wallet size={16} /> جهة استلام العربون وتفاصيل التحويل
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">جهة / حساب استلام العربون</label>
                <select
                  value={
                    orderData.advancePaymentTreasuryId
                      ? `treasury_${orderData.advancePaymentTreasuryId}`
                      : orderData.advancePaymentPartnerId
                        ? `partner_${orderData.advancePaymentPartnerId}`
                        : orderData.advancePaymentEmployeeId
                          ? `employee_${orderData.advancePaymentEmployeeId}`
                          : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith("treasury_")) {
                      handleFieldChange(
                        "advancePaymentTreasuryId",
                        val.replace("treasury_", "")
                      );
                      handleFieldChange("advancePaymentPartnerId", "");
                      handleFieldChange("advancePaymentEmployeeId", "");
                    } else if (val.startsWith("partner_")) {
                      handleFieldChange(
                        "advancePaymentPartnerId",
                        val.replace("partner_", "")
                      );
                      handleFieldChange("advancePaymentTreasuryId", "");
                      handleFieldChange("advancePaymentEmployeeId", "");
                    } else if (val.startsWith("employee_")) {
                      handleFieldChange(
                        "advancePaymentEmployeeId",
                        val.replace("employee_", "")
                      );
                      handleFieldChange("advancePaymentPartnerId", "");
                      handleFieldChange("advancePaymentTreasuryId", "");
                    } else {
                      handleFieldChange("advancePaymentPartnerId", "");
                      handleFieldChange("advancePaymentTreasuryId", "");
                      handleFieldChange("advancePaymentEmployeeId", "");
                    }
                  }}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white cursor-pointer outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- اختر جهة الاستلام --</option>
                  {treasuryAccountsList.length > 0 && (
                    <optgroup label="🏦 الحسابات البنكية والخزائن">
                      {treasuryAccountsList.map((acc: any) => (
                        <option key={`treasury_${acc.id}`} value={`treasury_${acc.id}`}>
                          🏦 {acc.name} ({acc.type || "خزينة"})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {(getArray(settings.employees).length > 0 || getArray(settings.partners).length > 0) && (
                    <optgroup label="👤 العهدة النقدية (المدير والموظفين)">
                      <option value="employee_admin">👤 عهدة المدير (أنت)</option>
                      {getArray(settings.partners).map((p: any) => (
                        <option key={`employee_${p.id}`} value={`employee_${p.id}`}>
                          🤝 {p.name} (عهدة شريك)
                        </option>
                      ))}
                      {getArray(settings.employees).map((emp: any) => (
                        <option key={`employee_${emp.id}`} value={`employee_${emp.id}`}>
                          👤 {emp.name} (عهدة موظف)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">رقم المحفظة / المرجع للتحويل</label>
                <input
                  type="text"
                  placeholder="رقم المحفظة أو مرجع انستاباي..."
                  value={orderData.advancePaymentSenderDetails || ""}
                  onChange={(e) => handleFieldChange("advancePaymentSenderDetails", e.target.value)}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Staff & Notes Card */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              7
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">الموظف المسؤول والملاحظات</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">توثيق مندوب المبيعات وملاحظات التوصيل لشركة الشحن</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <UserIcon size={14} className="text-indigo-500" /> الموظف / مندوب المبيعات المسؤول
            </label>
            <select
              value={orderData.assignedEmployeeId || orderData.createdBy || ""}
              onChange={(e) => {
                handleFieldChange("assignedEmployeeId", e.target.value);
                handleFieldChange("createdBy", e.target.value);
              }}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="">-- الموظف الحالي --</option>
              {availableStaff.map((staff: any) => (
                <option key={staff.id || staff.phone} value={staff.name || staff.id}>
                  👤 {staff.name} ({staff.role || "موظف"})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Compass size={14} className="text-indigo-500" /> مصدر الطلب / القناة التسويقية
            </label>
            <select
              value={orderData.source || "facebook"}
              onChange={(e) => handleFieldChange("source", e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="facebook">📘 فيسبوك (Facebook)</option>
              <option value="instagram">📸 انستجرام (Instagram)</option>
              <option value="whatsapp">💬 واتساب (WhatsApp)</option>
              <option value="storefront">🛍️ المتجر الإلكتروني (Storefront)</option>
              <option value="phone">📞 مكالمة هاتفية المبيعات</option>
              <option value="branch">🏢 زيارة فرع المتجر</option>
              <option value="other">📌 مصدر آخر</option>
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText size={14} className="text-amber-500" /> ملاحظات التوصيل (تطبع على بوليصة الشحن للمندوب)
            </label>
            <textarea
              rows={2}
              placeholder="مثال: الاتصال قبل الوصول بساعة، تسليم للبواب، يحق للعميل المعاينة..."
              value={orderData.deliveryNotes || ""}
              onChange={(e) => handleFieldChange("deliveryNotes", e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" /> ملاحظات داخلية (للإدارة فقط - لا تظهر للعميل)
            </label>
            <textarea
              rows={2}
              placeholder="ملاحظات المبيعات الداخلية حول العميل أو الطلب..."
              value={orderData.notes || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 p-3 sm:p-6 md:p-8 transition-colors duration-500" dir="rtl">
      <form onSubmit={handleValidatedSubmit} className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Smart Switchers */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-inner border border-slate-200/60 dark:border-slate-700 cursor-pointer"
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isEditing ? `✏️ تعديل الطلب رقم #${orderData.orderNumber}` : "✨ إنشاء طلب مبيعات جديد"}
                </h1>
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                  <Zap size={12} /> الإصدار الاحترافي السريع
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                واجهة إدخال مبيعات احترافية وخالية من الأخطاء، تدعم الإدخال الإرشادي المتسلسل أو شاشة العمل السريع.
              </p>
            </div>
          </div>

          {/* UI Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setUiMode("wizard")}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                uiMode === "wizard"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Compass size={16} />
              <span>الوضع الإرشادي (خطوات)</span>
            </button>
            <button
              type="button"
              onClick={() => setUiMode("single")}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                uiMode === "single"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Zap size={16} />
              <span>الوضع السريع (شاشة واحدة)</span>
            </button>
          </div>
        </div>

        {/* Validation Error Alert Banner */}
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-600 text-white rounded-2xl shadow-xl flex items-center justify-between gap-4 font-bold text-sm"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="shrink-0 animate-bounce" />
              <span>⚠️ تنبيه هام: {validationError}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="p-1 hover:bg-rose-700 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}

        {/* Wizard Progress Header (Only when uiMode === 'wizard') */}
        {uiMode === "wizard" && (
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {[
                { step: 1, label: "1. العميل والعملية", icon: <UserIcon size={18} /> },
                { step: 2, label: "2. المنتجات والمخزون", icon: <Package size={18} />, badge: `${getArray(orderData.items).length} صنف` },
                { step: 3, label: "3. الشحن والتوصيل", icon: <Truck size={18} />, badge: `${orderData.shippingFee || 0} ج.م` },
                { step: 4, label: "4. الحسابات والتأكيد", icon: <Coins size={18} /> },
              ].map((item) => {
                const isActive = wizardStep === item.step;
                const isCompleted = wizardStep > item.step;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => {
                      if (item.step < wizardStep || validateStep(wizardStep)) {
                        setWizardStep(item.step as any);
                      }
                    }}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/25 scale-[1.02]"
                        : isCompleted
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-75"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                        isActive ? "bg-white/20 text-white" : isCompleted ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700"
                      }`}>
                        {isCompleted ? <Check size={14} /> : item.step}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 ${
                        isActive ? "bg-white text-indigo-700 font-bold" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Workspace Layout (2 Columns: Form Content + Live Summary) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left/Center Form Column (8 of 12 cols) */}
          <div className="xl:col-span-8 space-y-6">
            {uiMode === "wizard" ? (
              // Wizard Mode Display (One step at a time)
              <div className="space-y-6">
                {wizardStep === 1 && renderStep1_CustomerAndShipment()}
                {wizardStep === 2 && renderStep2_ProductsAndFulfillment()}
                {wizardStep === 3 && renderStep3_ShippingAndServices()}
                {wizardStep === 4 && renderStep4_FinancialsAndNotes()}

                {/* Wizard Navigation Footer */}
                <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={wizardStep === 1}
                    className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowRightCircle size={18} />
                    <span>الخطوة السابقة</span>
                  </button>

                  {wizardStep < 4 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <span>الخطوة التالية</span>
                      <ArrowLeftCircle size={18} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Save size={18} />
                      <span>{isEditing ? "حفظ التعديلات الآن" : "🎉 إتمام وحفظ الطلب الآن"}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              // Single-Screen Pro Mode Display (All cards stacked)
              <div className="space-y-6">
                {renderStep1_CustomerAndShipment()}
                {renderStep2_ProductsAndFulfillment()}
                {renderStep3_ShippingAndServices()}
                {renderStep4_FinancialsAndNotes()}
              </div>
            )}
          </div>

          {/* Right/Sticky Column: Live Invoice Summary (4 of 12 cols) */}
          <div className="xl:col-span-4 sticky top-6 space-y-6">
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 text-white shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <Calculator size={22} className="text-emerald-400" />
                  <h3 className="font-black text-lg text-white">ملخص الفاتورة التفاعلي</h3>
                </div>
                <span className="text-[11px] font-mono font-bold bg-white/10 px-2.5 py-1 rounded-full text-indigo-300">
                  تحديث لحظي
                </span>
              </div>

              {/* Financial Breakdown List */}
              <div className="space-y-3 text-xs sm:text-sm font-bold divide-y divide-white/5">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-300">إجمالي المنتجات ({getArray(orderData.items).length} أصناف):</span>
                  <span className="font-mono font-black text-white text-base">
                    {subtotal.toLocaleString("ar-EG")} ج.م
                  </span>
                </div>

                {itemDiscounts > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-emerald-400">
                    <span>خصومات مباشرة على الأصناف:</span>
                    <span className="font-mono font-black">
                      -{Math.round(itemDiscounts).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {isMaintenance && (
                  <div className="flex justify-between items-center pt-2.5 text-sky-400">
                    <span>تكلفة الصيانة وقطع الغيار:</span>
                    <span className="font-mono font-black">
                      {Number(orderData.maintenanceCost || 0).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2.5">
                  <span className="text-slate-300">مصاريف الشحن والتوصيل:</span>
                  <span className="font-mono text-amber-400 font-black text-base">
                    +{Number(orderData.shippingFee || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>

                {(orderData.includeInspectionFee !== false && orderData.allowOpenShipment !== false) && inspectionFee > 0 && (
                  <div className="flex justify-between items-center pt-2.5">
                    <span className="text-slate-300">رسوم المعاينة وفتح الشحنة:</span>
                    <span className="font-mono text-teal-400">
                      +{inspectionFee.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {orderData.isInsured !== false && insuranceFee > 0 && (
                  <div className="flex justify-between items-center pt-2.5">
                    <span className="text-slate-300">رسوم التأمين على الشحنة:</span>
                    <span className="font-mono text-purple-400">
                      +{insuranceFee.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {isFlexShipSupported && orderData.enableFlexShip && (
                  <div className="flex justify-between items-center pt-2.5">
                    <span className="text-slate-300">رسوم الشحن المرن (FlexShip):</span>
                    <span className="font-mono text-indigo-400">
                      +{Number(orderData.flexShipFee || 150).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {activeVatAmount > 0 && (
                  <div className="flex justify-between items-center pt-2.5">
                    <span className="text-slate-300">ضريبة القيمة المضافة (VAT 14%):</span>
                    <span className="font-mono text-sky-400">
                      +{activeVatAmount.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {Number(orderData.discount || 0) > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-emerald-400">
                    <span>خصم إضافي على الفاتورة:</span>
                    <span className="font-mono font-black text-base">
                      -{Number(orderData.discount).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {Number(orderData.advancePayment || 0) > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-emerald-400">
                    <span>عربون مدفوع مقدماً (Advance):</span>
                    <span className="font-mono font-black text-base">
                      -{Number(orderData.advancePayment).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {Number(creditAmount) > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-emerald-400">
                    <span>رصيد دائن مخصوم للعميل:</span>
                    <span className="font-mono font-black">
                      -{Number(creditAmount).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {orderData.returnCashToCustomer && Number(orderData.cashToReturnAmount || 0) > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-rose-400">
                    <span>نقدية مستردة للعميل مع المندوب:</span>
                    <span className="font-mono font-black">
                      -{Number(orderData.cashToReturnAmount).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}
              </div>

              {/* Grand Total COD Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 space-y-1.5 mt-4">
                <div className="flex justify-between items-center">
                  <span className="font-black text-xs uppercase tracking-wider opacity-90">
                    المبلغ المطلوب تحصيله (COD):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-2xl tracking-tight">
                      {finalAmount.toLocaleString("ar-EG")} <span className="text-sm font-bold">ج.م</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEditTotalModal(true)}
                      className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer active:scale-95"
                      title="تعديل وتقفيل المبلغ المطلوب تحصيله يدوياً"
                    >
                      <Edit3 size={15} />
                      <span>تعديل يدوي</span>
                    </button>
                  </div>
                </div>
                {orderData.totalAmountOverride !== undefined && orderData.totalAmountOverride !== null && String(orderData.totalAmountOverride).trim() !== "" && (
                  <div className="flex items-center justify-between bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-400/30 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-100">
                        ⚠️ تم فرض المبلغ يدوياً: {Number(orderData.totalAmountOverride).toLocaleString("ar-EG")} ج.م ({orderData.totalAmountOverrideReason || "بدون سبب"})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleFieldChange("totalAmountOverride", undefined);
                        handleFieldChange("totalAmountOverrideReason", undefined);
                      }}
                      className="text-[10px] bg-rose-500/80 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      إلغاء التعديل والعودة للتلقائي
                    </button>
                  </div>
                )}
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-3 text-base active:scale-[0.99] cursor-pointer"
                >
                  <Save size={20} />
                  <span>{isEditing ? "حفظ التعديلات على الطلب" : "🚀 إتمام وحفظ الطلب الآن"}</span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-bold rounded-2xl transition-all text-xs text-center block cursor-pointer"
                >
                  إلغاء والعودة للقائمة الرئيسية
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <CustomerSelectModal
        isOpen={isCustomerListOpen}
        onClose={() => setIsCustomerListOpen(false)}
        customers={customers}
        onSelect={handleCustomerSelect}
      />

      {showEditTotalModal && (
        <OrderFormEditTotalModal
          currentTotal={orderData.totalAmountOverride !== undefined && orderData.totalAmountOverride !== null && String(orderData.totalAmountOverride).trim() !== "" ? Number(orderData.totalAmountOverride) : finalAmount}
          currentReason={orderData.totalAmountOverrideReason}
          onClose={() => setShowEditTotalModal(false)}
          onApply={(amount, reason) => {
            handleFieldChange("totalAmountOverride", amount);
            handleFieldChange("totalAmountOverrideReason", reason);
            setShowEditTotalModal(false);
          }}
        />
      )}
    </div>
  );
};
