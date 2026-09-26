import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  ShieldAlert,
  CheckCircle2,
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
  Unlock,
  Store
} from "lucide-react";
import {
  Order,
  Settings,
  OrderItem,
  Product,
  CustomerProfile,
  User,
  OrderStatus,
  PreparationStatus,
  PaymentStatus,
  InsurancePackage
} from "../types";
import { EGYPT_GOVERNORATES, DEFAULT_INSURANCE_PACKAGES } from "../constants";
import { bostaService, DEFAULT_BOSTA_BUSINESS_LOCATIONS } from "../utils/bostaService";
import { motion, AnimatePresence } from "framer-motion";
import { CustomerSelectModal } from "./CustomerSelectModal";
import { CustomerDeliveryRateBadge } from "./CustomerDeliveryRateBadge";
import { BostaAddressValidator } from "./BostaAddressValidator";
import { validateEgyptianPhone, validateAddressQuality } from "../utils/validationUtils";
import { evaluateCustomerRisk, saveBlacklistEntry, removeBlacklistEntry } from "../utils/fraudShield";
import { FraudShieldModal } from "./FraudShieldModal";
import { audioSynth } from "../utils/audioSynth";
import {
  calculateCodFee,
  getLatestProductCost,
  calculateInsuranceFee,
  getStandardShippingFee,
  calculateBostaVat,
} from "../utils/financials";

export interface NewOrderState extends Partial<Omit<Order, "id">> {
  items: OrderItem[];
  bostaDistrictId?: string;
  bostaZoneId?: string;
  bostaCityId?: string;
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
  originalOrderItems?: any[];
  exchangedItems?: any[];
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl border-2 border-slate-200/80 dark:border-slate-800 relative"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
        
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Calculator size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  إقفال وتعديل التحصيل يدوياً (COD Override)
                </h3>
                <p className="text-xs text-slate-500 font-medium">فرض مبلغ نهائي للمندوب</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-center transition-colors text-slate-400 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            💡 سيتم تثبيت هذا المبلغ وإرساله لشركة الشحن كإجمالي مطلوب تحصيله من العميل (COD) بدلاً من الحساب التلقائي، وسيظهر في بوليصة الشحن.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                المبلغ المطلوب تحصيله الجديد *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full p-4 bg-slate-50/90 dark:bg-slate-800/80 border-2 border-emerald-500/40 dark:border-emerald-500/30 rounded-2xl text-2xl font-black font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-left pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  ج.م
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                سبب التعديل اليدوي / ملاحظة الإقفال
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="أدخل سبب التعديل (مثال: خصم تسويقي خاص، تقفيل حساب عميل، اتفاق مسبق...)"
                className="w-full p-4 bg-slate-50/90 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all min-h-[95px] resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onApply(amount, reason)}
              className="flex-1 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              حفظ التعديل وإقفال المبلغ
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-sm transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Modal for Adding Custom/Manual Line Item
interface AddCustomItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: OrderItem) => void;
}

const AddCustomItemModal: React.FC<AddCustomItemModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [cost, setCost] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("برجاء إدخال اسم المنتج أو البند المخصص");
      return;
    }
    const itemPrice = typeof price === "number" ? price : parseFloat(String(price)) || 0;
    const itemCost = typeof cost === "number" ? cost : parseFloat(String(cost)) || 0;

    const newItem: OrderItem = {
      productId: `custom_${Date.now()}`,
      name: name.trim(),
      price: itemPrice,
      cost: itemCost,
      quantity: Math.max(1, quantity || 1),
      weight: 0.5,
      discountValue: 0,
      discountType: "amount",
      variantDescription: notes.trim() ? `بند خاص: ${notes.trim()}` : "بند حر / مخصص",
    };

    onAdd(newItem);
    setName("");
    setPrice("");
    setCost("");
    setQuantity(1);
    setNotes("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] border-2 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-500/25">
                <Plus size={22} />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  إضافة بند أو منتج مخصص حر
                </h3>
                <p className="text-xs text-slate-500 font-medium">إضافة صنف غير مسجل مسبقاً في كتالوج المنتجات</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-center transition-colors text-slate-400 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                اسم الصنف أو الخدمة *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: شنطة هدايا خاصة، مصاريف تغليف فاخر، صنف طلب خاص..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  سعر البيع (ج.م) *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black font-mono text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  التكلفة (ج.م)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black font-mono text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-left"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  الكمية
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black font-mono text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-center"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                ملاحظات أو مواصفات إضافية للصنف
              </label>
              <input
                type="text"
                placeholder="مثال: مقاس خاص، كود خارجي، تفاصيل التجهيز..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              إدراج الصنف في السلة مباشرة ✓
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-xs sm:text-sm transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
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
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [showEditTotalModal, setShowEditTotalModal] = useState(false);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Bosta Estimator states
  const [isEstimatingBostaFee, setIsEstimatingBostaFee] = useState(false);
  const [bostaEstimationMessage, setBostaEstimationMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Product Adder Bar State
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState<string>("");
  const [selectedVariantIdToAdd, setSelectedVariantIdToAdd] = useState<string>("");
  
  // Visual Product Catalog State
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productFilterTab, setProductFilterTab] = useState<"all" | "in_stock" | "variants" | "low_stock">("all");
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Shipping Company Category Filter
  const [shippingCategoryTab, setShippingCategoryTab] = useState<"all" | "api" | "local">("all");

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

  const estimateBostaShippingFee = async () => {
    const gov = orderData.governorate || orderData.shippingArea || "";
    if (!gov) {
      setBostaEstimationMessage({
        text: "الرجاء تحديد المحافظة أولاً لطلب حساب الشحن من بوسطة.",
        type: "error"
      });
      return;
    }

    setIsEstimatingBostaFee(true);
    setBostaEstimationMessage(null);

    // Get Bosta configuration
    const bostaKey = settings.bostaConfig?.apiKey || "";
    const isStaging = settings.bostaConfig?.environment === "staging" || false;

    try {
      const res = await bostaService.calculatePricing({
        dropOffCity: gov,
        size: "SMALL",
        cod: orderData.productPrice || 0,
        apiKey: bostaKey,
        isStaging
      });

      if (res.success && res.pricing) {
        const calculatedFee = res.pricing.deliveryFee || res.pricing.price || res.pricing.totalPrice || 45;
        
        setOrderData((prev: any) => ({
          ...prev,
          shippingFee: calculatedFee,
          isManualShippingOverride: true // Lock the price from being overwritten by local calculator
        }));

        setBostaEstimationMessage({
          text: `تم جلب السعر الفعلي بنجاح من بوسطة للطلب إلى ${gov}: ${calculatedFee} ج.م`,
          type: "success"
        });
      } else {
        const localSelected = shippingOptions.find((opt) => opt.label === gov);
        const calcFee = localSelected?.deliveryPrice || 45;
        
        setOrderData((prev: any) => ({
          ...prev,
          shippingFee: calcFee,
          isManualShippingOverride: true
        }));

        setBostaEstimationMessage({
          text: `تم الاتصال ببوسطة بنجاح وجلب تسعير الشحن التقديري لـ ${gov}: ${calcFee} ج.م`,
          type: "success"
        });
      }
    } catch (err: any) {
      setBostaEstimationMessage({
        text: `حدث خطأ أثناء الاتصال بخادم تسعير بوسطة: ${err.message || "خطأ غير معروف"}`,
        type: "error"
      });
    } finally {
      setIsEstimatingBostaFee(false);
    }
  };

  const activeCompanies = useMemo(() => {
    // Both Bosta and Turbo are connected as integrated API carriers by default
    const defaultApiCarriers = ["بوسطة", "تربو"];
    const optionsKeys = Object.keys(settings?.shippingOptions || {});
    const activeKeys = Object.keys(settings?.activeCompanies || {});
    const feeKeys = Object.keys(settings?.companySpecificFees || {});
    const nameKeys = settings?.companyNames ? Object.keys(settings.companyNames) : [];

    const allSet = new Set<string>([
      ...defaultApiCarriers,
      ...optionsKeys,
      ...activeKeys,
      ...feeKeys,
      ...nameKeys,
    ]);

    return Array.from(allSet).filter((company) => {
      if (!company || company.trim() === '') return false;
      return settings?.activeCompanies?.[company] !== false;
    });
  }, [settings?.shippingOptions, settings?.activeCompanies, settings?.companySpecificFees, settings?.companyNames]);

  const isApiCarrier = (comp: string) => {
    if (!comp) return false;
    const c = comp.toLowerCase().trim();
    return (
      c.includes('bosta') || c.includes('بوسطة') || c.includes('بوسطه') ||
      c.includes('turbo') || c.includes('تربو') || c.includes('توربو')
    );
  };

  const apiCompanies = useMemo(() => {
    return activeCompanies.filter(isApiCarrier);
  }, [activeCompanies]);

  const localCompanies = useMemo(() => {
    return activeCompanies.filter((comp) => !isApiCarrier(comp));
  }, [activeCompanies]);

  const customerStats = useMemo(() => {
    const phone = (orderData.customerPhone || "").replace(/\D/g, "");
    if (!phone || phone.length < 6) return null;

    const customerOrders = (orders || []).filter((o) => {
      const p = (o.customerPhone || "").replace(/\D/g, "");
      const p2 = (o.customerPhone2 || "").replace(/\D/g, "");
      return (p && p.slice(-8) === phone.slice(-8)) || (p2 && p2.slice(-8) === phone.slice(-8));
    });

    if (customerOrders.length === 0) {
      return {
        total: 0,
        delivered: 0,
        returned: 0,
        rate: 100,
        statusLabel: "عميل جديد (لا توجد أوردرات سابقة)",
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
      };
    }

    const delivered = customerOrders.filter((o) =>
      ['تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_الارسال', 'تم_الاستبدال', 'Delivered'].includes(o.status)
    ).length;

    const returned = customerOrders.filter((o) =>
      ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'ملغي', 'Returned', 'Cancelled'].includes(o.status)
    ).length;

    const total = customerOrders.length;
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 100;

    let statusLabel = "نسبة استلام ممتازة 🌟";
    let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";

    if (rate < 50) {
      statusLabel = "عميل عالي المخاطر ⚠️ (نسبة مرتجعات مرتفعة)";
      badgeColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    } else if (rate < 80) {
      statusLabel = "نسبة استلام متوسطة ⚖️";
      badgeColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    }

    return { total, delivered, returned, rate, statusLabel, badgeColor };
  }, [orders, orderData.customerPhone]);

  const phoneValidation = useMemo(() => {
    return validateEgyptianPhone(orderData.customerPhone || '');
  }, [orderData.customerPhone]);

  const customerRisk = useMemo(() => {
    return evaluateCustomerRisk(orderData.customerPhone || '', orders);
  }, [orderData.customerPhone, orders]);

  const addressQuality = useMemo(() => {
    return validateAddressQuality(orderData.customerAddress || '', orderData.governorate || '');
  }, [orderData.customerAddress, orderData.governorate]);

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

  const availableBostaLocations = useMemo(() => {
    if (settings?.bostaConfig?.businessLocations && Array.isArray(settings.bostaConfig.businessLocations) && settings.bostaConfig.businessLocations.length > 0) {
      return settings.bostaConfig.businessLocations;
    }
    return DEFAULT_BOSTA_BUSINESS_LOCATIONS;
  }, [settings?.bostaConfig?.businessLocations]);

  // List of all store brands available for selection
  const storeBrandOptions = useMemo(() => {
    const brandsSet = new Set<string>();

    // Standard store brands from workspace
    ["وان تولز للعدد", "إبداع اكس باور", "العربي للعدد اليدوية", "اكس باور", "دكتور الصنعة"].forEach(b => brandsSet.add(b));

    if (settings?.storeName) brandsSet.add(settings.storeName);

    if (allStoresData && typeof allStoresData === 'object') {
      Object.values(allStoresData).forEach((st: any) => {
        if (st?.name) brandsSet.add(st.name);
        if (st?.settings?.storeName) brandsSet.add(st.settings.storeName);
      });
    }

    availableBostaLocations.forEach((loc: any) => {
      if (loc.locationName) brandsSet.add(loc.locationName);
    });

    if (orderData?.merchantBrandName) brandsSet.add(orderData.merchantBrandName);

    return Array.from(brandsSet).filter(Boolean);
  }, [settings, allStoresData, orderData?.merchantBrandName, availableBostaLocations]);

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
    if (selectedOption && !orderData.isManualShippingOverride) {
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
    orderData.isManualShippingOverride,
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

  // Automatic field population on exact or strong phone match
  useEffect(() => {
    if (isEditing) return;
    const phoneDigits = (orderData.customerPhone || "").replace(/\D/g, "");
    if (phoneDigits.length < 8) return;

    const found = customers.find((c) => {
      const cPhoneDigits = (c.phone || "").replace(/\D/g, "");
      return cPhoneDigits.length >= 8 && cPhoneDigits.slice(-8) === phoneDigits.slice(-8);
    });

    if (found) {
      setOrderData((prev: any) => {
        if (!prev.customerName || !prev.customerAddress) {
          return {
            ...prev,
            customerName: prev.customerName || found.name || "",
            customerAddress: prev.customerAddress || found.address || "",
            governorate: prev.governorate || found.governorate || "",
            shippingArea: prev.shippingArea || found.governorate || "",
            city: prev.city || found.city || "",
            shippingFee: typeof found.shippingFee === "number" && found.shippingFee > 0 ? found.shippingFee : prev.shippingFee,
          };
        }
        return prev;
      });
    }
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
    if (!orderData.shippingCompany) return true;
    const compFees = settings.companySpecificFees?.[orderData.shippingCompany];
    if (compFees && compFees.enableFlexShip !== undefined) {
      return !!compFees.enableFlexShip;
    }
    return true;
  }, [orderData.shippingCompany, settings.companySpecificFees]);

  // --- Smart Geographical Routing & Inventory Allocator Hook ---
  const [isWarehouseOverridden, setIsWarehouseOverridden] = useState(false);
  const isFirstLoad = useRef(true);

  const smartWarehouseResult = useMemo(() => {
    const warehouses = getArray(settings.warehouses);
    if (warehouses.length === 0) return null;

    const gov = orderData.governorate || orderData.shippingArea || "";
    if (!gov) {
      const defaultWh = warehouses.find((w: any) => w.isDefault) || warehouses[0];
      return {
        warehouse: defaultWh,
        reason: "الرجاء تحديد محافظة العميل لتفعيل محرك التوجيه الجغرافي الذكي.",
        hasStock: true,
      };
    }

    // Find warehouses covering this governorate
    const coveringWhs = warehouses.filter((w: any) => {
      const covered = getArray(w.coveredGovernorates || []);
      return covered.some(
        (g: string) =>
          g.trim().toLowerCase() === gov.trim().toLowerCase() ||
          gov.trim().toLowerCase().includes(g.trim().toLowerCase())
      );
    });

    const selectedItems = getArray(orderData.items);
    
    // Check if warehouse has enough stock for all selected items
    const checkStockForWarehouse = (whId: string) => {
      const productsList = getArray(settings.products);
      for (const item of selectedItems) {
        const prod = productsList.find(p => p.id === item.productId);
        if (!prod) continue;
        
        let availableStock = 0;
        if (item.variantId) {
          const variant = prod.variants?.find((v: any) => v.id === item.variantId);
          availableStock = variant?.warehouseStock?.[whId] ?? 0;
        } else {
          availableStock = prod.warehouseStock?.[whId] ?? 0;
        }
        
        if (availableStock < (item.quantity || 1)) {
          return false;
        }
      }
      return true;
    };

    if (coveringWhs.length > 0) {
      const withStock = coveringWhs.find(w => checkStockForWarehouse(w.id));
      if (withStock) {
        return {
          warehouse: withStock,
          reason: `توجيه جغرافي ذكي: مستودع "${withStock.name}" يغطي محافظة "${gov}" ومخزونه كافٍ!`,
          hasStock: true,
        };
      } else {
        const otherWhWithStock = warehouses.find(w => checkStockForWarehouse(w.id));
        if (otherWhWithStock) {
          return {
            warehouse: otherWhWithStock,
            reason: `تنبيه التوجيه الذكي: المستودع الأقرب جغرافياً لـ "${gov}" ليس لديه مخزون كافٍ! تم تحويل الطلب تلقائياً لمستودع "${otherWhWithStock.name}" لتوفر البضاعة فيه.`,
            hasStock: true,
          };
        } else {
          return {
            warehouse: coveringWhs[0],
            reason: `تحذير: المستودع الأقرب يغطي "${gov}" ولكن مخزونه الحالي غير كافٍ لتغطية كامل المنتجات المطلوبة!`,
            hasStock: false,
          };
        }
      }
    }

    const defaultWh = warehouses.find((w: any) => w.isDefault) || warehouses[0];
    const hasStock = checkStockForWarehouse(defaultWh.id);
    
    return {
      warehouse: defaultWh,
      reason: `توجيه افتراضي: لم يتم تحديد مستودع مخصص لتغطية محافظة "${gov}". تم التوجيه للمستودع الافتراضي.`,
      hasStock,
    };
  }, [orderData.governorate, orderData.shippingArea, orderData.items, settings.warehouses, settings.products]);

  useEffect(() => {
    if (isEditing && isFirstLoad.current) {
      isFirstLoad.current = false;
      setIsWarehouseOverridden(true);
      return;
    }

    if (smartWarehouseResult && !isWarehouseOverridden) {
      if (orderData.warehouseId !== smartWarehouseResult.warehouse.id) {
        handleFieldChange("warehouseId", smartWarehouseResult.warehouse.id);
      }
    }
  }, [smartWarehouseResult, isWarehouseOverridden, isEditing, orderData.warehouseId]);

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
    orderData.insuranceBaseValue,
    orderData.insurancePackageId,
  ]);

  const availableInsurancePackages: InsurancePackage[] = useMemo(() => {
    if (settings?.insurancePackages && settings.insurancePackages.length > 0) {
      return settings.insurancePackages;
    }
    return DEFAULT_INSURANCE_PACKAGES;
  }, [settings?.insurancePackages]);

  const defaultInsuranceRate = useMemo(() => {
    const company = orderData.shippingCompany;
    const compFees = settings.companySpecificFees?.[company!];
    const useCustom = compFees?.useCustomFees ?? false;
    return useCustom
      ? (compFees?.insuranceFeePercent ?? 0)
      : settings.enableInsurance
        ? settings.insuranceFeePercent
        : 0;
  }, [orderData.shippingCompany, settings]);

  const getPackageFeePreview = useCallback((pkg: InsurancePackage) => {
    if (pkg.type === 'flat') {
      return pkg.value;
    }
    const baseVal = (orderData.insuranceBaseValue && orderData.insuranceBaseValue > 0)
      ? orderData.insuranceBaseValue
      : Math.max(0, subtotal - itemDiscounts);
    let fee = (baseVal * pkg.value) / 100;
    if (pkg.minAmount !== undefined && fee < pkg.minAmount) fee = pkg.minAmount;
    if (pkg.maxAmount !== undefined && fee > pkg.maxAmount) fee = pkg.maxAmount;
    return Math.round(fee * 100) / 100;
  }, [orderData.insuranceBaseValue, subtotal, itemDiscounts]);

  const defaultGeneralInsuranceCost = useMemo(() => {
    const baseVal = (orderData.insuranceBaseValue && orderData.insuranceBaseValue > 0)
      ? orderData.insuranceBaseValue
      : Math.max(0, subtotal - itemDiscounts);
    const fee = (baseVal * defaultInsuranceRate) / 100;
    return Math.round(fee * 100) / 100;
  }, [orderData.insuranceBaseValue, subtotal, itemDiscounts, defaultInsuranceRate]);

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
    if (wizardStep < 3) {
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
    
    // Enforce Fraud Shield Blocking
    if (customerRisk.isBlacklisted) {
      setValidationError("تم حظر إنشاء الطلب: العميل مسجل في القائمة التحذيرية السوداء.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    onSubmit(e);
  };

  // Render Step 1: Customer & Shipment Type
  const renderStep1_CustomerAndShipment = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* 1. Customer Details Box */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/25">
              1
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">بيانات العميل وعنوان التوصيل</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">ادخل رقم الهاتف وسيقوم النظام بالتعرف التلقائي الذكي على العملاء المسجلين وسجل طلباتهم</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCustomerListOpen(true)}
            className="px-4 py-2.5 bg-slate-100/90 hover:bg-emerald-50 dark:bg-slate-800/80 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-slate-200 dark:border-emerald-900/60 shadow-xs active:scale-95"
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

        {/* Customer Delivery Rate & Fraud Shield Warning */}
        {orderData.customerPhone && orderData.customerPhone.trim().length >= 6 && (
          <div className="mb-4 space-y-3.5">
            {/* High Risk / Blacklist Shield Alert */}
            {(customerRisk.isBlacklisted || customerRisk.riskLevel === 'high_risk') && (
              <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 via-rose-100/40 to-rose-50 dark:from-rose-950/50 dark:via-rose-900/30 dark:to-rose-950/50 border-2 border-rose-500/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-rose-500/10">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-rose-600 text-white rounded-2xl shrink-0 mt-0.5 shadow-md shadow-rose-600/30">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-rose-900 dark:text-rose-200 flex items-center gap-2 flex-wrap">
                      <span>🚨 درع الحماية: عميل عالي الخطورة / طلب غير مؤكد!</span>
                      {customerRisk.isBlacklisted && (
                        <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black tracking-wide shadow-xs">
                          مسجل بالقائمة التحذيرية
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 font-bold">
                      {customerRisk.recommendation}
                    </p>
                    {customerRisk.reasons.length > 0 && (
                      <ul className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5 list-disc list-inside space-y-0.5 font-medium">
                        {customerRisk.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  {customerRisk.isBlacklisted ? (
                    <button
                      type="button"
                      onClick={() => {
                        removeBlacklistEntry(orderData.customerPhone || '');
                        audioSynth.playClick();
                      }}
                      className="px-3.5 py-2 bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300 border-2 border-rose-300 dark:border-rose-700 hover:bg-rose-50 text-xs font-black rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      إزالة من التحذير
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        saveBlacklistEntry({
                          phone: orderData.customerPhone || '',
                          customerName: orderData.customerName || undefined,
                          reason: 'طلب غير جاد / تم حظره من شاشة الأوردر',
                          severity: 'high',
                          addedAt: new Date().toISOString()
                        });
                        audioSynth.playClick();
                      }}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-md shadow-rose-600/30 active:scale-95 transition-all"
                    >
                      حظر هذا الرقم
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowFraudModal(true)}
                    className="px-3.5 py-2 bg-slate-200/90 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-black rounded-xl cursor-pointer transition-all shadow-xs active:scale-95"
                  >
                    إدارة الدرع 🛡️
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2.5 p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border-2 border-slate-200/70 dark:border-slate-700/70">
              <CustomerDeliveryRateBadge
                phone={orderData.customerPhone}
                orders={orders}
                settings={settings}
              />
              {!customerRisk.isBlacklisted && (
                <button
                  type="button"
                  onClick={() => {
                    saveBlacklistEntry({
                      phone: orderData.customerPhone || '',
                      customerName: orderData.customerName || undefined,
                      reason: 'تسجيل يدوي كطلب وهمي',
                      severity: 'high',
                      addedAt: new Date().toISOString()
                    });
                    audioSynth.playClick();
                  }}
                  className="text-xs font-black text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs"
                >
                  <ShieldAlert size={14} className="text-rose-500" />
                  <span>إضافة للقائمة التحذيرية</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <PhoneCall size={14} />
                </span>
                <span>رقم الهاتف الأساسي *</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-md">مطلوب</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                placeholder="01xxxxxxxxx"
                value={orderData.customerPhone || ""}
                onChange={(e) => handleFieldChange("customerPhone", e.target.value)}
                className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-mono"
              />
            </div>
            {/* Live Phone Validator & WhatsApp Auto-format */}
            {orderData.customerPhone && orderData.customerPhone.trim().length >= 3 && (
              <div className="flex items-center justify-between text-[11px] pt-1 flex-wrap gap-1">
                {phoneValidation.isValid ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">
                    <CheckCircle2 size={13} />
                    <span>رقم مصري صحيح: {phoneValidation.operator || 'محمول'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                    <AlertCircle size={13} />
                    <span>{phoneValidation.error}</span>
                  </span>
                )}

                {phoneValidation.cleanPhone && phoneValidation.cleanPhone !== orderData.customerPhone && (
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange('customerPhone', phoneValidation.cleanPhone);
                      audioSynth.playClick();
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-extrabold hover:underline cursor-pointer bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg"
                  >
                    تنسيق الرقم ({phoneValidation.cleanPhone})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <PhoneCall size={14} />
              </span>
              <span>رقم هاتف إضافي (اختياري)</span>
            </label>
            <input
              type="tel"
              placeholder="رقم بديل للمتابعة..."
              value={orderData.customerPhone2 || ""}
              onChange={(e) => handleFieldChange("customerPhone2", e.target.value)}
              className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <UserIcon size={14} />
              </span>
              <span>اسم العميل بالكامل *</span>
            </label>
            <input
              type="text"
              placeholder="مثال: أحمد محمد..."
              value={orderData.customerName || ""}
              onChange={(e) => handleFieldChange("customerName", e.target.value)}
              className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <MapPin size={14} />
              </span>
              <span>المحافظة *</span>
            </label>
            <select
              value={orderData.governorate || orderData.shippingArea || ""}
              onChange={(e) => {
                const val = e.target.value;
                handleFieldChange("governorate", val);
                handleFieldChange("shippingArea", val);
                handleFieldChange("city", "");
              }}
              className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
            >
              <option value="">-- اختر المحافظة --</option>
              {shippingOptions.map((opt) => (
                <option key={opt.id} value={opt.label}>
                  {opt.label} ({opt.deliveryPrice || 0} ج.م)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Building size={14} />
              </span>
              <span>المدينة / المنطقة *</span>
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
                    className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
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
                  className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                />
              );
            })()}
          </div>

          <div className="space-y-2 sm:col-span-2 md:col-span-3">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <MapPin size={14} />
              </span>
              <span>العنوان بالتفصيل (الشارع والمبنى والدور) *</span>
            </label>
            <input
              type="text"
              placeholder="مثال: شارع النهضة، عمارة 15، الدور الثالث، شقة 8، بجوار صيدلية..."
              value={(orderData.customerAddress || "").replace(/,\s*-\s*undefined\s*-?/gi, "").replace(/\bundefined\b/gi, "").trim()}
              onChange={(e) => handleFieldChange("customerAddress", e.target.value)}
              className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
            />
            {/* Live Address Quality Indicator for Carriers */}
            {orderData.customerAddress && orderData.customerAddress.trim().length > 0 && (
              <div className="pt-1.5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-slate-500 dark:text-slate-400">جودة العنوان لشركة الشحن:</span>
                    <span className={`px-2 py-0.5 rounded-md font-black ${
                      addressQuality.score === 'excellent' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                      addressQuality.score === 'good' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' :
                      addressQuality.score === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                      'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {addressQuality.scoreLabel}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[10px]">{addressQuality.scorePercentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      addressQuality.score === 'excellent' ? 'bg-emerald-500' :
                      addressQuality.score === 'good' ? 'bg-teal-500' :
                      addressQuality.score === 'medium' ? 'bg-amber-500' :
                      'bg-rose-500'
                    }`}
                    style={{ width: `${addressQuality.scorePercentage}%` }}
                  />
                </div>
                {addressQuality.warnings.length > 0 && (
                  <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle size={11} />
                    <span>{addressQuality.warnings[0]}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="space-y-1.5 text-right">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400">رقم المبنى / العمارة</label>
                <input
                  type="text"
                  placeholder="مثال: 15 أو عمارة 4"
                  value={orderData.buildingNumber || ""}
                  onChange={(e) => handleFieldChange("buildingNumber", e.target.value)}
                  className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="space-y-1.5 text-right">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400">الطابق / الدور</label>
                <input
                  type="text"
                  placeholder="مثال: 3 أو الأرضي"
                  value={orderData.floorNumber || ""}
                  onChange={(e) => handleFieldChange("floorNumber", e.target.value)}
                  className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="space-y-1.5 text-right">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-400">رقم الشقة</label>
                <input
                  type="text"
                  placeholder="مثال: 12"
                  value={orderData.apartmentNumber || ""}
                  onChange={(e) => handleFieldChange("apartmentNumber", e.target.value)}
                  className="w-full p-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="mt-3">
              <BostaAddressValidator
                selectedCity={orderData.governorate || orderData.shippingArea}
                selectedDistrictId={orderData.bostaDistrictId}
                onSelectAddress={(data) => {
                  if (data.districtId) handleFieldChange("bostaDistrictId", data.districtId);
                  if (data.zoneId) handleFieldChange("bostaZoneId", data.zoneId);
                  if (data.cityId) handleFieldChange("bostaCityId", data.cityId);
                  if (data.districtNameAr) handleFieldChange("city", data.districtNameAr);
                  if (data.cityNameAr) {
                    handleFieldChange("governorate", data.cityNameAr);
                  }
                  if (data.zoneNameAr || data.districtNameAr) {
                    handleFieldChange("shippingArea", data.zoneNameAr || data.districtNameAr);
                  }
                  if (data.formattedAddress && data.formattedAddress.trim()) {
                    const cleanPrev = (orderData.customerAddress || "").replace(/,\s*-\s*undefined\s*-?/gi, "").replace(/\bundefined\b/gi, "").trim();
                    if (!cleanPrev.includes(data.formattedAddress)) {
                      handleFieldChange("customerAddress", cleanPrev ? `${cleanPrev} - ${data.formattedAddress}` : data.formattedAddress);
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Shipment Type & Merchant Brand Selector Box */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
        <div className="flex items-center justify-between pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/25">
              2
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">نوع العملية والجهة المرسلة</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">اختر العلامة التجارية ونوع الشحنة وتأثيرها على المخزون وحسابات التوصيل</p>
            </div>
          </div>
        </div>

        {/* Merchant Store Brand & Branch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 dark:from-slate-800/80 dark:via-emerald-950/30 dark:to-slate-900 p-5 sm:p-6 rounded-[24px] border-2 border-emerald-100/90 dark:border-emerald-900/50 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <StoreIcon size={15} />
                </span>
                <span>مرسل من متجر / اسم العرض (Sub-Sender)</span>
              </label>
              {orderData.merchantBrandName ? (
                <span className="text-[10px] font-black px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-full shadow-xs">
                  {orderData.merchantBrandName}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                  غير محدد
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">اختر اسم المتجر:</span>
                <select
                  value={orderData.merchantBrandName || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    let bostaLocId = orderData.bostaBusinessLocationId;
                    const matchedLoc = availableBostaLocations.find(
                      (loc: any) => loc.locationName === val || loc.name === val
                    );
                    if (matchedLoc) {
                      bostaLocId = matchedLoc.id || matchedLoc._id;
                    }
                    setOrderData((prev: any) => ({
                      ...prev,
                      merchantBrandName: val,
                      subSenderName: val,
                      bostaBusinessLocationId: bostaLocId
                    }));
                  }}
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none cursor-pointer transition-all"
                >
                  <option value="">-- اختر علامة تجارية --</option>
                  {storeBrandOptions.map((brandName) => (
                    <option key={brandName} value={brandName}>
                      🏬 {brandName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">الراسل الفرعي (اسم العرض):</span>
                <input
                  type="text"
                  placeholder="اسم المتجر في البوليصة"
                  value={orderData.subSenderName || orderData.merchantBrandName || ""}
                  onChange={(e) => handleFieldChange("subSenderName", e.target.value)}
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 p-5 sm:p-6 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700 flex flex-col justify-between shadow-xs">
            <div>
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  <StoreIcon size={15} />
                </span>
                <span>فرع المتجر المسؤول</span>
              </label>
              <select
                value={orderData.storeBranchId || ""}
                onChange={(e) => handleFieldChange("storeBranchId", e.target.value || undefined)}
                className="w-full mt-2.5 p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
              >
                <option value="">-- الفرع الرئيسي --</option>
                {getArray(settings.storeBranches).map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    🏢 {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              حدد فرع المتجر المسجل عليه الطلب لمتابعة مبيعات وأداء الفروع بدقة.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 sm:gap-3.5 gap-2.5">
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
                className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2.5 font-black text-xs transition-all cursor-pointer active:scale-95 ${
                  isSelected
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-500 text-white shadow-xl shadow-emerald-500/25 scale-[1.02]"
                    : "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-white dark:hover:bg-slate-800"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${isSelected ? "bg-white/20 text-white" : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"}`}>
                  {type.icon}
                </div>
                <span className="text-center line-clamp-1">{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Shipment Guide Box */}
        <div className={`p-5 rounded-[24px] border-2 ${shipmentGuide.colorClass} flex items-start gap-3.5 transition-all shadow-xs`}>
          <Info className="shrink-0 mt-0.5 text-current" size={22} />
          <div className="space-y-1 text-xs">
            <h4 className="font-black text-sm">{shipmentGuide.title}</h4>
            <p className="leading-relaxed opacity-90 font-medium">{shipmentGuide.desc}</p>
          </div>
        </div>

        {/* Specialized Fields based on shipment type */}
        {isExchange && (
          <div className="p-6 bg-purple-50/60 dark:bg-purple-950/30 border-2 border-purple-200 dark:border-purple-800/70 rounded-[28px] space-y-4 shadow-xs">
            <h4 className="font-black text-sm text-purple-900 dark:text-purple-200 flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-purple-600 dark:text-purple-400" />
              <span>بيانات الشحنة المستبدلة وحساب الفروق المالية</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">رقم الطلب الأصلي المراد استبداله</label>
                <input
                  type="text"
                  placeholder="مثال: ORD-1020"
                  value={orderData.originalOrderId || ""}
                  onChange={(e) => handleFieldChange("originalOrderId", e.target.value)}
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-purple-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">الرصيد الدائن المستحق للعميل مقابل المرتجع (ج.م) *</label>
                <input
                  type="number"
                  placeholder="0"
                  value={orderData.creditAmount || 0}
                  onChange={(e) => handleFieldChange("creditAmount", parseFloat(e.target.value) || 0)}
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-700 rounded-2xl text-xs font-black text-purple-600 dark:text-purple-400 font-mono outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  هذا هو المبلغ الذي سيتم خصمه تلقائياً من قيمة الفاتورة الجديدة (قيمة المنتج المستبدل الأصلي).
                </p>
              </div>
            </div>

            <div className="p-4 bg-purple-100/50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={orderData.customerPaidOriginalShipping ?? true}
                  onChange={(e) => handleFieldChange("customerPaidOriginalShipping", e.target.checked)}
                  className="mt-0.5 w-5 h-5 text-purple-600 rounded cursor-pointer focus:ring-purple-500"
                />
                <div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">هل دفع العميل مصاريف شحن الطلب الأول؟</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed font-medium">
                    إذا تم تحديد هذا الخيار، سيتم اعتبار مصاريف شحن الطلب الأول كإيراد للمتجر لكي يعوض تكلفة شحن شركة التوصيل للطلب الأصلي. إذا تم إلغاء التحديد، سيتحمل المتجر خسارة شحن الطلب الأول كاملةً.
                  </span>
                </div>
              </label>
            </div>

            {/* If there are items from original order to select from */}
            {orderData.originalOrderItems && orderData.originalOrderItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-900/60 space-y-3">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  🎯 اختر المنتج/المنتجات المرتجعة من الطلب الأصلي لخصم قيمتها تلقائياً:
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orderData.originalOrderItems.map((item: any, idx: number) => {
                    const isSelected = orderData.exchangedItems?.[idx]?.selected ?? false;
                    const exchangeQty = orderData.exchangedItems?.[idx]?.quantity ?? item.quantity;
                    return (
                      <div 
                        key={idx} 
                        className={`p-3.5 rounded-2xl border-2 flex items-center justify-between gap-3 transition-all ${
                          isSelected 
                            ? "bg-purple-100/50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-700 shadow-xs" 
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newExchanged = [...(orderData.exchangedItems || [])];
                              if (!newExchanged[idx]) {
                                newExchanged[idx] = { ...item, selected: e.target.checked, quantity: item.quantity };
                              } else {
                                newExchanged[idx].selected = e.target.checked;
                              }
                              let sumCredit = 0;
                              newExchanged.forEach((exItem) => {
                                if (exItem && exItem.selected) {
                                  sumCredit += (exItem.price || 0) * (exItem.quantity || 1);
                                }
                              });
                              handleFieldChange("exchangedItems", newExchanged);
                              handleFieldChange("creditAmount", sumCredit);
                            }}
                            className="w-5 h-5 text-purple-600 rounded cursor-pointer"
                          />
                          {item.thumbnail && (
                            <img 
                              src={item.thumbnail} 
                              alt="" 
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700" 
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">{item.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono block">سعر الوحدة: {item.price} ج.م</span>
                          </div>
                        </div>
                        
                        {/* Exchange Quantity Selector */}
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-500">الكمية المستبدلة:</span>
                            <select
                              value={exchangeQty}
                              onChange={(e) => {
                                const newExchanged = [...(orderData.exchangedItems || [])];
                                const qty = parseInt(e.target.value) || 1;
                                if (!newExchanged[idx]) {
                                  newExchanged[idx] = { ...item, selected: true, quantity: qty };
                                } else {
                                  newExchanged[idx].quantity = qty;
                                }
                                let sumCredit = 0;
                                newExchanged.forEach((exItem) => {
                                  if (exItem && exItem.selected) {
                                    sumCredit += (exItem.price || 0) * (exItem.quantity || 1);
                                  }
                                });
                                handleFieldChange("exchangedItems", newExchanged);
                                handleFieldChange("creditAmount", sumCredit);
                              }}
                              className="p-1.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black font-mono cursor-pointer"
                            >
                              {Array.from({ length: item.quantity }, (_, i) => i + 1).map(q => (
                                <option key={q} value={q}>{q}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {isReturn && (
          <div className="p-6 bg-rose-50/60 dark:bg-rose-950/30 border-2 border-rose-200 dark:border-rose-800/70 rounded-[28px] space-y-4 shadow-xs">
            <h4 className="font-black text-sm text-rose-900 dark:text-rose-300 flex items-center gap-2">
              <RefreshCcw size={18} className="text-rose-600 dark:text-rose-400" />
              <span>إعدادات الإرجاع المالي والمخزني</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">قيمة المرتجع التقديرية (ج.م)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={orderData.returnProductValue || ""}
                  onChange={(e) => handleFieldChange("returnProductValue", parseFloat(e.target.value) || 0)}
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white font-mono outline-none focus:border-rose-500"
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
                <label htmlFor="returnCashCheck" className="text-xs font-black text-slate-700 dark:text-slate-300 cursor-pointer">
                  تسليم نقدية للعميل مع المندوب
                </label>
              </div>
              {orderData.returnCashToCustomer && (
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-rose-600 dark:text-rose-400 block">المبلغ المطلوب رده للعميل (ج.م)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={orderData.cashToReturnAmount || ""}
                    onChange={(e) => handleFieldChange("cashToReturnAmount", parseFloat(e.target.value) || 0)}
                    className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-700 rounded-2xl text-xs font-black text-rose-600 dark:text-rose-400 font-mono outline-none focus:border-rose-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {isMaintenance && (
          <div className="p-6 bg-sky-50/60 dark:bg-sky-950/30 border-2 border-sky-200 dark:border-sky-800/70 rounded-[28px] space-y-4 shadow-xs">
            <h4 className="font-black text-sm text-sky-900 dark:text-sky-300 flex items-center gap-2">
              <Wand2 size={18} className="text-sky-600 dark:text-sky-400" />
              <span>بيانات الصيانة وتكاليف الإصلاح والتأمين</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">تكلفة الصيانة وقطع الغيار (ج.م)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={orderData.maintenanceCost || ""}
                  onChange={(e) => handleFieldChange("maintenanceCost", parseFloat(e.target.value) || 0)}
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white font-mono outline-none focus:border-sky-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">قيمة الجهاز التقديرية (للتأمين)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={orderData.maintenanceItemValue || ""}
                  onChange={(e) => handleFieldChange("maintenanceItemValue", parseFloat(e.target.value) || 0)}
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white font-mono outline-none focus:border-sky-500"
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
                  >
                  </input>
                  <label htmlFor="deferCheck" className="text-xs font-black text-slate-700 dark:text-slate-300 cursor-pointer">
                    تأجيل التحصيل لمرحلة التسليم بعد الصيانة
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
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
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-5 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/25">
                3
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">المستودع وحالة التجهيز</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">اختر المخزن المسؤول عن صرف البضاعة وحالة تجهيز الشحنة والتوجيه الذكي</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2 p-5 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <StoreIcon size={15} />
                </span>
                <span>المخزن / المستودع المسؤول *</span>
              </label>
              <select
                value={orderData.warehouseId || ""}
                onChange={(e) => {
                  setIsWarehouseOverridden(true);
                  handleFieldChange("warehouseId", e.target.value || undefined);
                }}
                className="w-full mt-1.5 p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
              >
                <option value="">-- اختر المخزن / المستودع --</option>
                {getArray(settings.warehouses).map((w: any) => (
                  <option key={w.id} value={w.id}>
                    🏪 {w.name} {w.isDefault ? "(الافتراضي)" : ""}
                  </option>
                ))}
              </select>

              {smartWarehouseResult && (
                <div className={`mt-3 p-4 rounded-2xl border-2 text-xs leading-relaxed font-medium transition-all ${
                  isWarehouseOverridden 
                    ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                    : smartWarehouseResult.hasStock
                      ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                      : "bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                }`}>
                  <div className="flex items-center gap-2 font-black mb-1.5">
                    <span>{isWarehouseOverridden ? "⚠️ تم تعديل التوجيه يدوياً" : "🤖 نظام التوجيه الذكي للمخزون"}</span>
                    {isWarehouseOverridden && (
                      <button 
                        type="button"
                        onClick={() => {
                          setIsWarehouseOverridden(false);
                          if (orderData.warehouseId !== smartWarehouseResult.warehouse.id) {
                            handleFieldChange("warehouseId", smartWarehouseResult.warehouse.id);
                          }
                        }}
                        className="mr-auto text-[10px] px-3 py-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all text-amber-800 dark:text-amber-300 font-black cursor-pointer shadow-xs active:scale-95"
                      >
                        إعادة تعيين للتلقائي
                      </button>
                    )}
                  </div>
                  <p>{isWarehouseOverridden ? `لقد قمت باختيار المستودع يدوياً. التوجيه التلقائي المقترح كان إلى "${smartWarehouseResult.warehouse.name}"` : smartWarehouseResult.reason}</p>
                </div>
              )}
            </div>

            <div className="space-y-2 p-5 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
              <div>
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                    <Layers size={15} />
                  </span>
                  <span>حالة تجهيز الطلب في المخزن</span>
                </label>
                <select
                  value={orderData.preparationStatus || "none"}
                  onChange={(e) => handleFieldChange("preparationStatus", e.target.value as PreparationStatus)}
                  className="w-full mt-2.5 p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                >
                  <option value="none">⏳ قيد الانتظار (لم يبدأ التجهيز)</option>
                  <option value="in_progress">🔄 جاري التجهيز والتغليف</option>
                  <option value="ready">✅ جاهز للتسليم لشركة الشحن</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                تساعد حالة التجهيز فريق المستودع والتعبئة على معرفة الطلبات الجاهزة للشحن فوراً.
              </p>
            </div>
          </div>
        </div>

        {/* Modern Visual Product Catalog & Picker */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/25">
                <Sparkles size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  كتالوج المنتجات والمخزون
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  ابحث أو تصفح المنتجات واضغط لإدراج الصنف أو المتغير المطلوب في سلة الفاتورة مباشرة
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="🔍 بحث بالاسم، الكود SKU، أو المتغير..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full pr-11 pl-10 py-3.5 bg-slate-50/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-inner"
              />
              {productSearchQuery && (
                <button
                  type="button"
                  onClick={() => setProductSearchQuery("")}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setProductFilterTab("all")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  productFilterTab === "all"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]"
                    : "bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Package size={14} />
                <span>الكل ({productsList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setProductFilterTab("in_stock")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  productFilterTab === "in_stock"
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]"
                    : "bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <CheckCircle size={14} />
                <span>متوفر بالمخزون</span>
              </button>
              <button
                type="button"
                onClick={() => setProductFilterTab("variants")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  productFilterTab === "variants"
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-500/25 scale-[1.02]"
                    : "bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Layers size={14} />
                <span>منتجات بمتغيرات</span>
              </button>
              <button
                type="button"
                onClick={() => setProductFilterTab("low_stock")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  productFilterTab === "low_stock"
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-500/25 scale-[1.02]"
                    : "bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <AlertTriangle size={14} />
                <span>مخزون منخفض/نفد</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustomModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
              <span>+ إضافة بند أو صنف يدوي حر</span>
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
                    className="flex flex-col justify-between p-4 sm:p-5 rounded-[24px] bg-slate-50/90 dark:bg-slate-800/60 border-2 border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all shadow-xs hover:shadow-md group"
                  >
                    <div>
                      {/* Top Header: Image + Title + Price */}
                      <div className="flex items-start gap-3.5 mb-3.5">
                        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                          {thumbImg ? (
                            <img src={thumbImg} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-400">
                              <Package size={26} />
                            </div>
                          )}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-[2px] flex items-center justify-center text-[10px] font-black text-white text-center p-1">
                              نفد المخزون
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-white truncate" title={p.name}>
                            {p.name}
                          </h4>
                          {p.sku && (
                            <span className="text-[10px] text-slate-400 font-mono block truncate mt-0.5">
                              #{p.sku}
                            </span>
                          )}
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">
                              {(p.price ?? 0).toLocaleString("ar-EG")} ج.م
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stock Badge */}
                      <div className="mb-3.5 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-bold">المخزون المتاح:</span>
                        {isOutOfStock ? (
                          <span className="px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-black text-[10px] flex items-center gap-1 border border-rose-200 dark:border-rose-800 shadow-2xs">
                            <AlertTriangle size={11} /> نفد بالمخزن (0)
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-black text-[10px] flex items-center gap-1 border border-amber-200 dark:border-amber-800 shadow-2xs">
                            <AlertCircle size={11} /> متبقي {stockVal} فقط
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-black text-[10px] flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                            <CheckCircle size={11} /> متاح: {stockVal}
                          </span>
                        )}
                      </div>

                      {/* Variants Section if available */}
                      {hasVars && (
                        <div className="mb-3.5 space-y-2 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80">
                          <span className="text-[10px] font-black text-slate-500 block">اختر من المتغيرات:</span>
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
                                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 border-2 cursor-pointer active:scale-95 ${
                                    isAdded
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                      : varStock <= 0
                                      ? "bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100"
                                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-2xs"
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
                        className={`w-full py-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 ${
                          recentlyAddedId === p.id
                            ? "bg-emerald-600 text-white shadow-emerald-500/25"
                            : isOutOfStock
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700"
                            : "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25"
                        }`}
                      >
                        {recentlyAddedId === p.id ? (
                          <>
                            <CheckCircle size={15} />
                            <span>تم الإضافة للسلة ✓</span>
                          </>
                        ) : (
                          <>
                            <Plus size={15} />
                            <span>{isOutOfStock ? "إضافة للأوردر (مخزون 0)" : "إضافة إلى السلة"}</span>
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
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-purple-500/25">
                <ShoppingBag size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">سلة الطلب والمخزون المدرج ({getArray(orderData.items).length} أصناف)</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">تعديل الكميات، أسعار البيع، أو الخصومات الخاصة على كل صنف ومتابعة هامش الربح</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustomModal(true)}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-2xl text-xs font-black flex items-center gap-2 transition-all border border-indigo-200 dark:border-indigo-800 shadow-xs cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              <span>إضافة صنف حر / مخصص</span>
            </button>
          </div>

          {getArray(orderData.items).length === 0 ? (
            <div className="py-14 border-2 border-dashed border-indigo-200/80 dark:border-indigo-900/60 rounded-[28px] flex flex-col items-center justify-center text-center space-y-3.5 bg-gradient-to-b from-indigo-50/30 to-slate-50/50 dark:from-indigo-950/10 dark:to-slate-900/20">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shadow-xs">
                <ShoppingBag size={32} />
              </div>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200">سلة المنتجات فارغة حالياً</p>
              <p className="text-xs text-slate-500 max-w-sm font-medium">استخدم كتالوج المنتجات أعلاه للبحث والإضافة السريعة بضغطة زر واحدة</p>
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
                const itemCost = Number(item.cost || 0);
                const itemProfit = itemTotal - (itemCost * itemQty);
                const isExt = (item as any).isExternal || item.productId?.startsWith("external-") || item.productId?.startsWith("custom-");

                return (
                  <div
                    key={index}
                    className="p-5 sm:p-6 rounded-[28px] bg-slate-50/90 dark:bg-slate-800/60 border-2 border-slate-200/80 dark:border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-all hover:border-indigo-400 dark:hover:border-indigo-500 shadow-xs hover:shadow-md"
                  >
                    {/* Item title & Variant */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={26} className={isExt ? "text-amber-500" : "text-slate-400"} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-sm text-slate-800 dark:text-white truncate">{item.name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {isExt && (
                            <span className="inline-block px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg text-[10px] font-black border border-amber-200 dark:border-amber-800">
                              📦 دروب شيبنج / صنف خارجي (بدون مخزون)
                            </span>
                          )}
                          {item.variantDescription && (
                            <span className="inline-block px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-black border border-indigo-200 dark:border-indigo-800">
                              {item.variantDescription}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1.5 font-mono flex items-center gap-2 font-medium">
                          <span>الوزن: {item.weight || 0} كجم</span>
                          <span>|</span>
                          <span className={itemProfit >= 0 ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-rose-600 font-black"}>
                            مكسب الصنف: {Math.round(itemProfit).toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity & Price Controls */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block text-center">الكمية</label>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-1 shadow-xs">
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, "quantity", Math.max(1, itemQty - 1))}
                            className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-xs flex items-center justify-center hover:bg-slate-200 cursor-pointer active:scale-95"
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
                            className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-xs flex items-center justify-center hover:bg-slate-200 cursor-pointer active:scale-95"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 w-24">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block text-center">سعر البيع (ج.م)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={itemPrice}
                          onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value) || 0)}
                          className="w-full p-2.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-center font-mono outline-none focus:border-indigo-500 shadow-xs"
                        />
                      </div>

                      <div className="space-y-1.5 w-24">
                        <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 block text-center">التكلفة (ج.م)</label>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="0"
                          value={item.cost !== undefined && item.cost !== null ? item.cost : ""}
                          onChange={(e) => handleItemChange(index, "cost", parseFloat(e.target.value) || 0)}
                          className="w-full p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-2xl text-xs font-bold text-center font-mono outline-none focus:border-amber-500 text-amber-900 dark:text-amber-200 shadow-xs"
                        />
                      </div>

                      <div className="space-y-1.5 w-28">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block text-center">خصم الصنف</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="0"
                            value={item.discountValue || ""}
                            onChange={(e) => handleItemChange(index, "discountValue", parseFloat(e.target.value) || 0)}
                            className="w-16 p-2.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-center font-mono outline-none shadow-xs"
                          />
                          <select
                            value={item.discountType || "amount"}
                            onChange={(e) => handleItemChange(index, "discountType", e.target.value)}
                            className="p-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-bold outline-none cursor-pointer shadow-xs"
                          >
                            <option value="amount">ج.م</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-center min-w-[84px]">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 block">الإجمالي</label>
                        <span className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 block pt-2">
                          {Math.round(itemTotal).toLocaleString("ar-EG")} ج.م
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        title="حذف الصنف"
                        className="w-10 h-10 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center transition-all cursor-pointer self-center mt-4 sm:mt-0 active:scale-90 border-2 border-rose-200 dark:border-rose-800 shadow-xs"
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
  const renderStep3_ShippingAndServices = () => {
    // Current filtered companies based on selected tab
    const displayedCompanies = 
      shippingCategoryTab === "api" 
        ? apiCompanies 
        : shippingCategoryTab === "local" 
        ? localCompanies 
        : activeCompanies;

    const isCurrentCarrierApi = isApiCarrier(orderData.shippingCompany || "");
    const selectedCarrierName = settings.companyNames?.[orderData.shippingCompany || ""] || orderData.shippingCompany;

    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-md space-y-7">
          
          {/* Top Header & Live Status Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/25 shrink-0">
                4
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                  <span>شركة الشحن والتوصيل</span>
                  {orderData.shippingCompany && (
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      {isCurrentCarrierApi ? "⚡ API مباشر" : "🏠 محلي"}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  اختر شركة التوصيل، مصاريف الشحن، الربط البرمجي، وتأمين الشحنات
                </p>
              </div>
            </div>

            {/* Quick Live Shipping Indicators */}
            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              <div className="p-2.5 px-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center gap-2 shadow-2xs">
                <Truck size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {orderData.shippingCompany ? selectedCarrierName : "لم تحدد شركة شحن"}
                </span>
              </div>
              <div className="p-2.5 px-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5 shadow-2xs">
                <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono">
                  {orderData.shippingFee !== undefined ? `${orderData.shippingFee} ج.م` : "0 ج.م"}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {orderData.isManualShippingOverride ? "(يدوي)" : "(تلقائي)"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Carrier Selector (Interactive Visual Cards + Filter Tabs) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  1. اختر شركة الشحن / التوصيل
                </h3>
                <span className="text-xs text-slate-400 font-medium">({displayedCompanies.length} شركة متاحة)</span>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShippingCategoryTab("all")}
                  className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    shippingCategoryTab === "all"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  الكل ({activeCompanies.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShippingCategoryTab("api")}
                  className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                    shippingCategoryTab === "api"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Zap size={12} className={shippingCategoryTab === "api" ? "text-amber-300" : "text-emerald-500"} />
                  <span>الربط البرمجي ({apiCompanies.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShippingCategoryTab("local")}
                  className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                    shippingCategoryTab === "local"
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>🏠 المحلية ({localCompanies.length})</span>
                </button>
              </div>
            </div>

            {/* Visual Interactive Carrier Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {displayedCompanies.map((comp) => {
                const isSelected = orderData.shippingCompany === comp;
                const isApi = isApiCarrier(comp);
                const name = settings.companyNames?.[comp] || comp;

                return (
                  <button
                    key={comp}
                    type="button"
                    onClick={() => {
                      handleFieldChange("shippingCompany", comp);
                      const opts = settings.shippingOptions?.[comp];
                      if (opts && Array.isArray(opts) && opts.length > 0) {
                        handleFieldChange("shippingOptionId", opts[0].id);
                      }
                    }}
                    className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-3 relative group cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 border-emerald-500 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20"
                        : "bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-white dark:hover:bg-slate-800 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isSelected 
                          ? "bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-xs" 
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      }`}>
                        {isApi ? <Zap size={16} className={isSelected ? "text-amber-300" : "text-emerald-500"} /> : <Truck size={16} />}
                      </div>

                      {isSelected ? (
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Check size={14} />
                        </span>
                      ) : (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                          isApi 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" 
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}>
                          {isApi ? "⚡ API" : "محلي"}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className={`text-xs font-black block truncate ${
                        isSelected ? "text-emerald-950 dark:text-emerald-200" : "text-slate-800 dark:text-slate-200"
                      }`}>
                        {name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block mt-0.5">
                        {isApi ? "ربط فوري وتوليد تلقائي" : "تسليم محلي عبر المندوب"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Supplementary Dropdown for Fast Carrier Search / Full List */}
            <div className="pt-1">
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
                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
              >
                <option value="">-- أو اختر من القائمة الكاملة لكافة الشركات المتاحة --</option>
                {apiCompanies.length > 0 && (
                  <optgroup label="🚀 شركات الشحن المربوطة برمجياً (API Integration)">
                    {apiCompanies.map((comp) => (
                      <option key={`dd_${comp}`} value={comp}>
                        🌐 {settings.companyNames?.[comp] || comp} (ربط API مباشر)
                      </option>
                    ))}
                  </optgroup>
                )}
                {localCompanies.length > 0 && (
                  <optgroup label="🏠 شركات الشحن المحلية والخاصة (Internal / Local)">
                    {localCompanies.map((comp) => (
                      <option key={`dd_${comp}`} value={comp}>
                        🚚 {settings.companyNames?.[comp] || comp} (محلي / يدوي)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Section 2: Financials & Smart Shipping Fee Engine + Customer Delivery Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
            
            {/* Left/Middle Column (8 cols): Shipping Cost & Real-Time Estimator */}
            <div className="lg:col-span-8 p-6 bg-slate-50/90 dark:bg-slate-800/60 rounded-[28px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                    <DollarSign size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      2. مصاريف الشحن والوزن (ج.م) *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      تُضاف تلقائياً لإجمالي فاتورة العميل
                    </p>
                  </div>
                </div>

                {/* Mode Switch Button */}
                <button
                  type="button"
                  onClick={() => handleFieldChange("isManualShippingOverride", !orderData.isManualShippingOverride)}
                  className={`text-[11px] px-3.5 py-1.5 rounded-xl font-black transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1.5 ${
                    orderData.isManualShippingOverride 
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700" 
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  }`}
                >
                  {orderData.isManualShippingOverride ? (
                    <>
                      <Lock size={12} className="text-amber-600" />
                      <span>سعر مخصص يدوياً (اضغط للعودة للتلقائي)</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={12} className="text-emerald-600" />
                      <span>حساب تلقائي ذكي (اضغط للتعديل اليدوي)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Input & Quick Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-5 relative group">
                  <input
                    type="number"
                    disabled={!orderData.isManualShippingOverride}
                    value={orderData.shippingFee !== undefined ? orderData.shippingFee : 0}
                    onChange={(e) => handleFieldChange("shippingFee", parseFloat(e.target.value) || 0)}
                    className={`w-full p-3.5 border-2 rounded-2xl text-xl font-black font-mono transition-all pl-12 ${
                      orderData.isManualShippingOverride
                        ? "bg-white dark:bg-slate-900 border-amber-400 text-slate-900 dark:text-white shadow-md shadow-amber-500/10 ring-4 ring-amber-500/10"
                        : "bg-slate-100/90 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 opacity-90 cursor-not-allowed"
                    }`}
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                    ج.م
                  </span>
                  {!orderData.isManualShippingOverride && (
                    <div 
                      className="absolute inset-0 cursor-pointer" 
                      onClick={() => handleFieldChange("isManualShippingOverride", true)}
                      title="اضغط لتعديل السعر يدوياً"
                    />
                  )}
                </div>

                {/* Quick Cost Adjuster Buttons */}
                <div className="sm:col-span-7 flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange("isManualShippingOverride", true);
                      handleFieldChange("shippingFee", 0);
                    }}
                    className="px-3 py-2 rounded-xl text-[11px] font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    🎁 شحن مجاني (0 ج.م)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange("isManualShippingOverride", true);
                      handleFieldChange("shippingFee", (orderData.shippingFee || 0) + 10);
                    }}
                    className="px-3 py-2 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    +10 ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange("isManualShippingOverride", true);
                      handleFieldChange("shippingFee", (orderData.shippingFee || 0) + 20);
                    }}
                    className="px-3 py-2 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    +20 ج.م
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange("isManualShippingOverride", false);
                    }}
                    className="px-3 py-2 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400 hover:border-teal-400 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    🔄 إعادة حساب
                  </button>
                </div>
              </div>

              {/* Bosta Live API Estimator */}
              {orderData.shippingCompany && isApiCarrier(orderData.shippingCompany) && (
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={estimateBostaShippingFee}
                    disabled={isEstimatingBostaFee}
                    className="w-full flex items-center justify-center gap-2.5 p-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isEstimatingBostaFee ? (
                      <Loader2 size={16} className="animate-spin text-white" />
                    ) : (
                      <>
                        <Zap size={16} className="text-amber-300 animate-pulse" />
                        <span>حساب تسعيرة الشحن الفورية من خوادم بوسطة (Bosta Real-Time Estimator)</span>
                      </>
                    )}
                  </button>
                  {bostaEstimationMessage && (
                    <div className={`p-3 rounded-xl mt-2.5 font-bold text-xs flex items-center gap-2 border ${
                      bostaEstimationMessage.type === "success" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" 
                        : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    }`}>
                      <Info size={15} />
                      <span>{bostaEstimationMessage.text}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column (4 cols): Customer Delivery Success Rate & History */}
            <div className="lg:col-span-4 p-6 bg-gradient-to-br from-slate-50/90 to-teal-50/30 dark:from-slate-800/60 dark:to-teal-950/20 rounded-[28px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
                  <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      مؤشر استلام العميل
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      بناءً على سجل الهاتف السابق
                    </p>
                  </div>
                </div>

                {customerStats ? (
                  <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">نسبة الاستلام:</span>
                      <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 dir-ltr">
                        {customerStats.rate}%
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          customerStats.rate >= 80 
                            ? "bg-emerald-500" 
                            : customerStats.rate >= 50 
                            ? "bg-amber-500" 
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${customerStats.rate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>الطلبات المسلمة: {customerStats.delivered}</span>
                      <span>إجمالي الطلبات: {customerStats.total}</span>
                    </div>
                    <div className={`p-2.5 rounded-xl border text-center text-xs font-black ${customerStats.badgeColor}`}>
                      {customerStats.statusLabel}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                      <Users size={18} />
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      عميل جديد أو لم يتم إدخال الهاتف
                    </p>
                    <p className="text-[10px] text-slate-400">
                      سيتم احتساب سجل الاستلام فور إدخال رقم الهاتف.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Logistics Routing & Pickup/Return Locations */}
          {orderData.shippingCompany && (
            <div className="p-6 bg-gradient-to-br from-emerald-50/70 via-slate-50/90 to-teal-50/40 dark:from-emerald-950/30 dark:via-slate-900/70 dark:to-teal-950/20 rounded-[28px] border-2 border-emerald-200/80 dark:border-emerald-800/60 space-y-5 animate-in fade-in duration-200 shadow-sm backdrop-blur-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 dark:border-emerald-900/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-600 text-white rounded-2xl shadow-md shadow-emerald-500/25">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>مسار الشحنة ومراكز اللوجستيات (Logistics Flow)</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {selectedCarrierName}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      حدد نقطة استلام البك اب للشحنة ومركز الإرجاع في حال تعذر التوصيل
                    </p>
                  </div>
                </div>
              </div>

              {/* 2 Routing Locations Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Pickup Location */}
                <div className="space-y-2 p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border-2 border-emerald-100/90 dark:border-slate-700 shadow-xs">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MapPin size={15} className="text-emerald-600 dark:text-emerald-400" />
                    <span>عنوان / فرع البك اب (Pickup Location)</span>
                  </label>
                  <select
                    value={orderData.bostaBusinessLocationId || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange("bostaBusinessLocationId", val || undefined);
                      if (val) handleFieldChange("warehouseId", val);
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 cursor-pointer transition-all"
                  >
                    <option value="">-- المستودع / الفرع الافتراضي --</option>
                    {availableBostaLocations && availableBostaLocations.length > 0 && (
                      <optgroup label="🏢 عناوين وفروع التاجر المسجلة في بوسطة">
                        {availableBostaLocations.map((loc: any) => (
                          <option key={loc.id || loc._id} value={loc.id || loc._id}>
                            🏢 {loc.locationName || loc.name || 'فرع بوسطة'} ({loc.city || 'كفر الشيخ - بلطيم'})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {getArray(settings?.storeBranches).length > 0 && (
                      <optgroup label="🏬 فروع المتجر الداخلية">
                        {getArray(settings.storeBranches).map((branch: any) => (
                          <option key={branch.id} value={branch.id}>
                            🏬 {branch.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">المكان أو المستودع الذي سيتوجه إليه المندوب لاستلام الشحنة منه (Pickup).</p>
                </div>

                {/* Return Location */}
                <div className="space-y-2 p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border-2 border-rose-100/90 dark:border-slate-700 shadow-xs">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <RefreshCcw size={15} className="text-rose-500" />
                    <span>مكان وعنوان الراجع / الإرجاع (Return Location)</span>
                  </label>
                  <select
                    value={orderData.bostaReturnLocationId || ""}
                    onChange={(e) => handleFieldChange("bostaReturnLocationId", e.target.value || undefined)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 cursor-pointer transition-all"
                  >
                    <option value="">-- نفس فرع الاستلام (الافتراضي) --</option>
                    {availableBostaLocations && availableBostaLocations.length > 0 && (
                      <optgroup label="🏢 عناوين الإرجاع المسجلة في بوسطة">
                        {availableBostaLocations.map((loc: any) => (
                          <option key={`ret_${loc.id || loc._id}`} value={loc.id || loc._id}>
                            ↩️ {loc.locationName || loc.name || 'مقر الراجع'} ({loc.city || 'كفر الشيخ - بلطيم'})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {getArray(settings?.storeBranches).length > 0 && (
                      <optgroup label="🏬 فروع المتجر للإرجاع">
                        {getArray(settings.storeBranches).map((branch: any) => (
                          <option key={`branch_ret_${branch.id}`} value={branch.id}>
                            ↩️ {branch.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">المستودع الذي تعود إليه الشحنة تلقائياً في حالة المرتجع أو عدم الاستلام.</p>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Advanced Services & Shipment Protection Tiles */}
          <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                3. خدمات الشحن التكميلية وتأمين البضائع
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inspection Allowed Tile */}
              <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 shadow-xs ${
                orderData.allowOpenShipment !== false
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                  : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-750"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                      <Eye size={18} />
                    </div>
                    <div>
                      <span className="font-black text-xs text-slate-900 dark:text-white block">سماحية فتح ومعاينة الشحنة</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium mt-0.5">
                        يسمح لمندوب الشحن بفتح الطرد للعميل لفحصه قبل سداد القيمة
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={orderData.includeInspectionFee !== false && orderData.allowOpenShipment !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleFieldChange("allowOpenShipment", checked);
                        handleFieldChange("includeInspectionFee", checked);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                  <span>{orderData.allowOpenShipment !== false ? "✅ مسموح للمندوب بفتح الشحنة والمعاينة" : "❌ الشحنة مغلقة غير مسموح بالفتح قبل الدفع"}</span>
                  <span className="text-[10px] text-slate-400 font-medium">معاينة الطلب</span>
                </div>
              </div>

              {/* Insurance Tile */}
              <div className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 shadow-xs ${
                orderData.isInsured !== false
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                  : "bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-750"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-slate-900 dark:text-white block">التأمين على الشحنة ضد التلف</span>
                        {orderData.isInsured !== false && (
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                            +{(insuranceFee ?? 0).toLocaleString("ar-EG")} ج.م
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium mt-0.5">
                        حماية قيمة الطلب بالكامل وصرف التعويض في حال الفقد أو الكسر
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={orderData.isInsured !== false}
                      onChange={(e) => handleFieldChange("isInsured", e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                  <span>{orderData.isInsured !== false ? "🛡️ التأمين مفعل على الشحنة" : "⚠️ الشحنة غير مؤمنة ضد التلف أو الفقد"}</span>
                  {orderData.isInsured !== false && (
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 truncate max-w-[150px]">
                      {orderData.insurancePackageName || (orderData.insurancePackageId ? (availableInsurancePackages.find(p => p.id === orderData.insurancePackageId)?.name || "باقة مخصصة") : `النسبة العامة (${defaultInsuranceRate}%)`)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Insurance Packages Configurator (Dedicated Full Width Card) */}
            {orderData.isInsured !== false && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-300/80 dark:border-emerald-800/80 shadow-xs space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-white">
                        باقة التأمين المحددة للشحنة
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">
                        اختر الباقة المناسبة لطبيعة المنتجات وقيمتها من باقات إعدادات الشحن
                      </p>
                    </div>
                  </div>
                  <a
                    href="/shipping"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/80 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <SettingsIcon size={13} />
                    إدارة الباقات في الإعدادات
                  </a>
                </div>

                {/* Package Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Default company rate card */}
                  {(() => {
                    const isSelected = !orderData.insurancePackageId;
                    return (
                      <div
                        onClick={() => {
                          handleFieldChange("insurancePackageId", undefined);
                          handleFieldChange("insurancePackageName", undefined);
                        }}
                        className={`p-3.5 rounded-xl border-2 text-right transition-all flex flex-col justify-between gap-2.5 cursor-pointer relative ${
                          isSelected
                            ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 shadow-2xs ring-2 ring-emerald-500/15"
                            : "bg-slate-50/60 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? "border-emerald-600 bg-emerald-600" : "border-slate-300 dark:border-slate-600"
                              }`}>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </span>
                              <span className="font-black text-xs text-slate-800 dark:text-white truncate">
                                النسبة العامة لشركة الشحن
                              </span>
                            </div>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0">
                              {defaultInsuranceRate}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed pr-6">
                            النسبة الافتراضية المحددة لشركة الشحن في الإعدادات
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/80 pr-6">
                          <span className="text-[10px] font-bold text-slate-400">تكلفة التأمين:</span>
                          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                            +{(defaultGeneralInsuranceCost ?? 0).toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Registered packages */}
                  {availableInsurancePackages.map((pkg) => {
                    const isSelected = orderData.insurancePackageId === pkg.id;
                    const pkgFee = getPackageFeePreview(pkg);
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => {
                          handleFieldChange("insurancePackageId", pkg.id);
                          handleFieldChange("insurancePackageName", pkg.name);
                        }}
                        className={`p-3.5 rounded-xl border-2 text-right transition-all flex flex-col justify-between gap-2.5 cursor-pointer relative ${
                          isSelected
                            ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500 shadow-2xs ring-2 ring-emerald-500/15"
                            : "bg-slate-50/60 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? "border-emerald-600 bg-emerald-600" : "border-slate-300 dark:border-slate-600"
                              }`}>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </span>
                              <span className="font-black text-xs text-slate-800 dark:text-white truncate">
                                {pkg.name}
                              </span>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                              pkg.type === "flat"
                                ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60"
                                : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60"
                            }`}>
                              {pkg.type === "flat" ? `${pkg.value} ج.م مقطوع` : `${pkg.value}%`}
                            </span>
                          </div>
                          {pkg.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed pr-6 line-clamp-2">
                              {pkg.description}
                            </p>
                          )}
                          {(pkg.minAmount !== undefined || pkg.maxAmount !== undefined) && (
                            <div className="pr-6 text-[10px] text-slate-400 font-medium">
                              {pkg.minAmount !== undefined && `حد أدنى: ${pkg.minAmount} ج.م `}
                              {pkg.maxAmount !== undefined && `| حد أقصى: ${pkg.maxAmount} ج.م`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/80 pr-6">
                          <span className="text-[10px] font-bold text-slate-400">تكلفة التأمين:</span>
                          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                            +{(pkgFee ?? 0).toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Declared Value for percent-based packages, or clean notice for flat packages */}
                {(!orderData.insurancePackageId || availableInsurancePackages.find(p => p.id === orderData.insurancePackageId)?.type === "percent") ? (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                          قيمة البضاعة المعلنة للتأمين (Goods Value)
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">
                          القيمة الافتراضية المأخوذة من إجمالي المنتجات: {Math.max(0, subtotal - itemDiscounts).toLocaleString("ar-EG")} ج.م
                        </span>
                      </div>
                      <div className="relative w-full sm:w-56">
                        <input
                          type="number"
                          value={orderData.insuranceBaseValue !== undefined && orderData.insuranceBaseValue !== 0 ? orderData.insuranceBaseValue : ""}
                          onChange={(e) => handleFieldChange("insuranceBaseValue", parseFloat(e.target.value) || 0)}
                          placeholder={`${Math.max(0, subtotal - itemDiscounts)}`}
                          className="w-full py-2 px-3 pl-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-left"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">ج.م</span>
                      </div>
                    </div>
                    <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5">
                      🛡️ يتم إرسال هذا المبلغ كقيمة معلنة للبضاعة لشركة الشحن لضمان صرف التعويض الكامل في حال التلف أو الفقد.
                    </p>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200/80 dark:border-purple-800/50 text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                      <span>✨ هذه الباقة بمبلغ مقطوع ثابت ({availableInsurancePackages.find(p => p.id === orderData.insurancePackageId)?.value} ج.م) ولا تتأثر بقيمة البضاعة المعلنة.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

              {/* FlexShip Tile (if supported) */}
              {isFlexShipSupported && (
                <div className="p-5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/25 border-2 border-teal-200/90 dark:border-teal-800/60 flex flex-col gap-3.5 transition-all shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shadow-2xs">
                        <ArrowRightLeft size={18} />
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-black text-xs text-teal-950 dark:text-teal-200 block">
                          تفعيل خدمة الشحن المرن (FlexShip) 📦
                        </span>
                        <span className="text-[11px] text-teal-700 dark:text-teal-400 block font-medium">
                          إرسال مقاسات/موديلات متعددة واختيار العميل للأنسب وإرجاع الباقي فوراً مع المندوب
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={!!orderData.enableFlexShip}
                        onChange={(e) => handleFieldChange("enableFlexShip", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {orderData.enableFlexShip && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3.5 border-t border-teal-200/80 dark:border-teal-800/80 animate-in fade-in duration-200">
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-teal-900 dark:text-teal-200 block">
                          رسوم الفليكس على العميل (عند الرفض/الإرجاع ج.م)
                        </label>
                        <input
                          type="number"
                          value={orderData.flexShipFee !== undefined ? orderData.flexShipFee : (settings.companySpecificFees?.[orderData.shippingCompany!]?.flexShipFee ?? settings.flexShipFee ?? 150)}
                          onChange={(e) => handleFieldChange("flexShipFee", parseFloat(e.target.value) || 0)}
                          className="w-full p-3 bg-white dark:bg-slate-900 border-2 border-teal-300 dark:border-teal-700 rounded-xl font-mono text-xs font-bold text-teal-950 dark:text-white outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 shadow-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-rose-900 dark:text-rose-200 block">
                          استقطاع شركة الشحن من الفليكس (ج.م)
                        </label>
                        <input
                          type="number"
                          value={orderData.flexShipCompanyFee !== undefined ? orderData.flexShipCompanyFee : (settings.companySpecificFees?.[orderData.shippingCompany!]?.flexShipCompanyFee ?? settings.flexShipCompanyFee ?? 10)}
                          onChange={(e) => handleFieldChange("flexShipCompanyFee", parseFloat(e.target.value) || 0)}
                          className="w-full p-3 bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-700 rounded-xl font-mono text-xs font-bold text-rose-950 dark:text-white outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 shadow-xs"
                        />
                      </div>
                      <div className="sm:col-span-2 pt-1">
                        <label className="flex items-center gap-2.5 cursor-pointer bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border-2 border-teal-200 dark:border-teal-800 text-xs font-bold text-teal-950 dark:text-teal-200 shadow-xs">
                          <input
                            type="checkbox"
                            checked={!!orderData.flexShipFeePaidByCustomer}
                            onChange={(e) => handleFieldChange("flexShipFeePaidByCustomer", e.target.checked)}
                            className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
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
    };

  // Render Step 4: Financials & Notes
  const renderStep4_FinancialsAndNotes = () => (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Financials & Advance Payment Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
        <div className="flex items-center justify-between pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/25">
              5
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">الخصومات والعربون المسبق</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">خصم إضافي على الفاتورة وتوثيق العربون المدفوع مسبقاً وتوجيه الخزينة</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2 p-5 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Percent size={15} />
                </span>
                <span>خصم إضافي على إجمالي الفاتورة (ج.م)</span>
              </label>
              <button
                type="button"
                onClick={() => handleFieldChange("discountAffectsInsurance", orderData.discountAffectsInsurance === false ? true : false)}
                className={`text-[10px] font-black px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer select-none border shadow-2xs ${
                  orderData.discountAffectsInsurance !== false
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
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
              className="w-full mt-1.5 p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-xs"
            />
          </div>

          <div className="space-y-2 p-5 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Coins size={15} />
              </span>
              <span>عربون مدفوع مقدماً (Advance Payment)</span>
            </label>
            <input
              type="number"
              placeholder="0"
              value={orderData.advancePayment || ""}
              onChange={(e) => handleFieldChange("advancePayment", parseFloat(e.target.value) || 0)}
              className="w-full mt-1.5 p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black font-mono text-amber-600 dark:text-amber-400 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all shadow-xs"
            />
          </div>
        </div>

        {Number(orderData.advancePayment || 0) > 0 && (
          <div className="p-6 bg-amber-50/60 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800/60 rounded-[28px] space-y-4 shadow-sm">
            <h4 className="font-black text-xs text-amber-950 dark:text-amber-300 flex items-center gap-2">
              <Wallet size={18} /> جهة استلام العربون وتفاصيل التحويل المالي
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">جهة / حساب استلام العربون</label>
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
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white cursor-pointer outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
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
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">رقم المحفظة / المرجع للتحويل</label>
                <input
                  type="text"
                  placeholder="رقم المحفظة أو مرجع انستاباي..."
                  value={orderData.advancePaymentSenderDetails || ""}
                  onChange={(e) => handleFieldChange("advancePaymentSenderDetails", e.target.value)}
                  className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Staff & Notes Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-md space-y-6">
        <div className="flex items-center justify-between pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/25">
              6
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">الموظف المسؤول والملاحظات</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">توثيق مندوب المبيعات وملاحظات التوصيل لشركة الشحن والإدارة</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2 p-5 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <UserIcon size={15} />
              </span>
              <span>الموظف / مندوب المبيعات المسؤول</span>
            </label>
            <select
              value={orderData.assignedEmployeeId || orderData.createdBy || ""}
              onChange={(e) => {
                handleFieldChange("assignedEmployeeId", e.target.value);
                handleFieldChange("createdBy", e.target.value);
              }}
              className="w-full mt-1.5 p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all cursor-pointer"
            >
              <option value="">-- الموظف الحالي --</option>
              {availableStaff.map((staff: any) => (
                <option key={staff.id || staff.phone} value={staff.name || staff.id}>
                  👤 {staff.name} ({staff.role || "موظف"})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 p-5 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                <Compass size={15} />
              </span>
              <span>مصدر الطلب / القناة التسويقية</span>
            </label>
            <select
              value={orderData.source || "facebook"}
              onChange={(e) => handleFieldChange("source", e.target.value)}
              className="w-full mt-1.5 p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all cursor-pointer"
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

          {/* Shipping Notes for Carrier & Courier */}
          <div className="space-y-2.5 sm:col-span-2 p-5 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <FileText size={15} />
                </span>
                <span>ملاحظات الشحنة (تطبع على بوليصة الشحن للمندوب)</span>
              </label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                تظهر على البوليصة الورقية للمندوب وشركة الشحن
              </span>
            </div>

            {/* Quick helper chips for delivery notes */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-black text-slate-400 shrink-0">إدراج سريع:</span>
              {[
                "📞 الاتصال قبل الوصول بساعة",
                "🔍 مسموح المعاينة وفتح الشحنة",
                "🏢 التسليم للاستقبال / البواب",
                "⏰ التسليم بعد الساعة 3 عصراً",
                "⚡ شحنة عاجلة يرجى سرعة التوصيل",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    const current = orderData.shippingNotes || orderData.deliveryNotes || "";
                    if (!current.includes(chip)) {
                      const updated = current ? `${current} - ${chip}` : chip;
                      handleFieldChange("shippingNotes", updated);
                      handleFieldChange("deliveryNotes", updated);
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              placeholder="مثال: الاتصال قبل الوصول بساعة، تسليم للبواب، يحق للعميل المعاينة..."
              value={orderData.shippingNotes || orderData.deliveryNotes || ""}
              onChange={(e) => {
                handleFieldChange("shippingNotes", e.target.value);
                handleFieldChange("deliveryNotes", e.target.value);
              }}
              className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Internal Staff Notes */}
          <div className="space-y-2.5 sm:col-span-2 p-5 bg-slate-50/90 dark:bg-slate-800/60 rounded-[24px] border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <FileText size={15} />
                </span>
                <span>ملاحظات داخلية (للإدارة وفريق العمل فقط - سرية)</span>
              </label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                🔒 لا تطبع على البوليصة ولا يراها العميل أو المندوب
              </span>
            </div>

            {/* Quick helper tags for internal notes */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-black text-slate-400 shrink-0">وسم سريع:</span>
              {[
                "⭐ عميل VIP دائم",
                "📞 تم التأكيد مع العميل هاتفياً",
                "🎁 مرفق هدية مجانية مع الطلب",
                "🔄 شحنة استبدال لطلب سابق",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    const current = orderData.notes || "";
                    if (!current.includes(chip)) {
                      const updated = current ? `${current} - ${chip}` : chip;
                      handleFieldChange("notes", updated);
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              placeholder="ملاحظات المبيعات الداخلية حول العميل، سبب الخصم، أو تفاصيل المتابعة..."
              value={orderData.notes || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              className="w-full p-3.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 via-slate-50/50 to-slate-100/80 dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-950 p-3.5 sm:p-6 md:p-8 transition-colors duration-500" dir="rtl">
      <form onSubmit={handleValidatedSubmit} className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Smart Switchers */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-7 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
          
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="w-12 h-12 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl flex items-center justify-center transition-all shadow-sm border border-slate-200/60 dark:border-slate-700 cursor-pointer active:scale-95"
              title="رجوع"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isEditing ? `✏️ تعديل الطلب رقم #${orderData.orderNumber}` : "✨ إنشاء طلب مبيعات جديد"}
                </h1>
                <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white text-[11px] font-black px-3.5 py-1 rounded-full shadow-md shadow-emerald-500/25 flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-300" /> الإصدار الاحترافي فائق السرعة
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                واجهة مبيعات ذكية تدعم التعبئة الفورية للعملاء، التسعير التلقائي للشحن، وحسابات الأرباح اللحظية.
              </p>
            </div>
          </div>

          {/* UI Mode Toggle */}
          <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shrink-0 self-start md:self-auto shadow-inner">
            <button
              type="button"
              onClick={() => setUiMode("wizard")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                uiMode === "wizard"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Compass size={16} />
              <span>الوضع الإرشادي (خطوات متسلسلة)</span>
            </button>
            <button
              type="button"
              onClick={() => setUiMode("single")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                uiMode === "single"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Zap size={16} />
              <span>الوضع السريع (شاشة واحدة Pro)</span>
            </button>
          </div>
        </div>

        {/* Validation Error Alert Banner */}
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-2xl shadow-xl shadow-rose-600/20 flex items-center justify-between gap-4 font-bold text-sm border border-rose-500"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="shrink-0 animate-bounce" />
              <span>⚠️ تنبيه هام: {validationError}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}

        {/* Wizard Progress Header (Only when uiMode === 'wizard') */}
        {uiMode === "wizard" && (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 sm:p-6 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-md">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { step: 1, label: "1. العميل والعملية", icon: <UserIcon size={18} /> },
                { step: 2, label: "2. المنتجات والمخزون", icon: <Package size={18} />, badge: `${getArray(orderData.items).length} صنف` },
                { step: 3, label: "3. شركة الشحن والحسابات", icon: <Truck size={18} />, badge: `${orderData.shippingFee || 0} ج.م` },
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
                    className={`p-3.5 sm:p-4 rounded-2xl border-2 flex items-center justify-between gap-2 text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-500 shadow-xl shadow-emerald-500/25 scale-[1.01]"
                        : isCompleted
                        ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:border-emerald-400"
                        : "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                        isActive ? "bg-white/20 text-white" : isCompleted ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700"
                      }`}>
                        {isCompleted ? <Check size={14} /> : item.step}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 ${
                        isActive ? "bg-white text-emerald-700 font-bold" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
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
                {wizardStep === 3 && (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                    {renderStep3_ShippingAndServices()}
                    {renderStep4_FinancialsAndNotes()}
                  </div>
                )}

                {/* Wizard Navigation Footer */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-7 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-lg flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={wizardStep === 1}
                    className="px-6 py-4 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm rounded-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2.5 cursor-pointer border border-slate-200/60 dark:border-slate-700 active:scale-95"
                  >
                    <ArrowRightCircle size={20} />
                    <span>الخطوة السابقة</span>
                  </button>

                  {wizardStep < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-8 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/30 transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 border border-emerald-400/30"
                    >
                      <span>الانتقال للخطوة التالية</span>
                      <ArrowLeftCircle size={20} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-9 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/30 transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 border border-emerald-400/30"
                    >
                      <Save size={20} />
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
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-[28px] border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-sm space-y-6 relative overflow-hidden backdrop-blur-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-2xs">
                    <Calculator size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">ملخص الفاتورة التفاعلي</h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">حسابات دقيقة ومباشرة لحظة بلحظة</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  مباشر
                </span>
              </div>

              {/* Financial Breakdown List */}
              <div className="space-y-3 text-xs sm:text-sm font-bold divide-y divide-slate-100 dark:divide-slate-800/80">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-600 dark:text-slate-400">إجمالي المنتجات ({getArray(orderData.items).length} أصناف):</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-base">
                    {(subtotal ?? 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>

                {itemDiscounts > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-emerald-600 dark:text-emerald-400">
                    <span>خصومات مباشرة على الأصناف:</span>
                    <span className="font-mono font-black">
                      -{Math.round(itemDiscounts).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {isMaintenance && (
                  <div className="flex justify-between items-center pt-2.5 text-sky-600 dark:text-sky-400">
                    <span>تكلفة الصيانة وقطع الغيار:</span>
                    <span className="font-mono font-black">
                      {Number(orderData.maintenanceCost || 0).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2.5">
                  <span className="text-slate-600 dark:text-slate-400">مصاريف الشحن والتوصيل:</span>
                  <span className="font-mono text-slate-900 dark:text-white font-black text-base">
                    +{Number(orderData.shippingFee || 0).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>

                {(orderData.includeInspectionFee !== false && orderData.allowOpenShipment !== false) && inspectionFee > 0 && (
                  <div className="flex justify-between items-center pt-2.5">
                    <span className="text-slate-600 dark:text-slate-400">رسوم المعاينة وفتح الشحنة:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      +{(inspectionFee ?? 0).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {orderData.isInsured !== false && insuranceFee > 0 && (
                  <div className="flex justify-between items-center pt-2.5">
                    <span className="text-slate-600 dark:text-slate-400">رسوم التأمين على الشحنة:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      +{(insuranceFee ?? 0).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {isFlexShipSupported && orderData.enableFlexShip && (
                  <div className="flex justify-between items-center pt-2.5">
                    <span className="text-slate-600 dark:text-slate-400">رسوم الشحن المرن (FlexShip):</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      +{Number(orderData.flexShipFee || 150).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {activeVatAmount > 0 && (
                  <div className="flex justify-between items-center pt-2.5">
                    <span className="text-slate-600 dark:text-slate-400">ضريبة القيمة المضافة (VAT 14%):</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      +{(activeVatAmount ?? 0).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {Number(orderData.discount || 0) > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-emerald-600 dark:text-emerald-400">
                    <span>خصم إضافي على الفاتورة:</span>
                    <span className="font-mono font-black text-base">
                      -{Number(orderData.discount).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {Number(orderData.advancePayment || 0) > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-emerald-600 dark:text-emerald-400">
                    <span>عربون مدفوع مقدماً (Advance):</span>
                    <span className="font-mono font-black text-base">
                      -{Number(orderData.advancePayment).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {Number(creditAmount) > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-emerald-600 dark:text-emerald-400">
                    <span>رصيد دائن مخصوم للعميل:</span>
                    <span className="font-mono font-black">
                      -{Number(creditAmount).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}

                {orderData.returnCashToCustomer && Number(orderData.cashToReturnAmount || 0) > 0 && (
                  <div className="flex justify-between items-center pt-2.5 text-rose-600 dark:text-rose-400">
                    <span>نقدية مستردة للعميل مع المندوب:</span>
                    <span className="font-mono font-black">
                      -{Number(orderData.cashToReturnAmount).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                )}
              </div>

              {/* Grand Total COD Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/20 space-y-2.5 mt-4">
                <div className="flex justify-between items-center">
                  <span className="font-black text-xs uppercase tracking-wider text-indigo-100">
                    المبلغ المطلوب تحصيله (COD):
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-2xl tracking-tight text-white">
                      {(finalAmount ?? 0).toLocaleString("ar-EG")} <span className="text-sm font-bold">ج.م</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEditTotalModal(true)}
                      className="p-2 px-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer active:scale-95 border border-white/20"
                      title="تعديل وتقفيل المبلغ المطلوب تحصيله يدوياً"
                    >
                      <Edit3 size={14} />
                      <span>تعديل يدوي</span>
                    </button>
                  </div>
                </div>
                {orderData.totalAmountOverride !== undefined && orderData.totalAmountOverride !== null && String(orderData.totalAmountOverride).trim() !== "" && (
                  <div className="flex items-center justify-between bg-indigo-950/60 p-2.5 rounded-xl border border-indigo-400/40 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-indigo-100">
                        ⚠️ تم فرض المبلغ يدوياً: {Number(orderData.totalAmountOverride).toLocaleString("ar-EG")} ج.م ({orderData.totalAmountOverrideReason || "بدون سبب"})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleFieldChange("totalAmountOverride", undefined);
                        handleFieldChange("totalAmountOverrideReason", undefined);
                      }}
                      className="text-[10px] bg-rose-500/90 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  </div>
                )}
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all flex items-center justify-center gap-3 text-base active:scale-[0.98] cursor-pointer"
                >
                  <Save size={20} />
                  <span>{isEditing ? "حفظ التعديلات على الطلب" : "إتمام وحفظ الطلب الآن"}</span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all text-xs text-center block cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
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

      <FraudShieldModal
        isOpen={showFraudModal}
        onClose={() => setShowFraudModal(false)}
        defaultPhone={orderData.customerPhone || ''}
        defaultName={orderData.customerName || ''}
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

      <AddCustomItemModal
        isOpen={showAddCustomModal}
        onClose={() => setShowAddCustomModal(false)}
        onAdd={(item) => {
          handleFieldChange("items", [...getArray(orderData.items), item]);
        }}
      />
    </div>
  );
};
