import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  ChevronDown,
  Package,
  MapPin,
  Coins,
  FileSearch,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Banknote,
  ShoppingBag,
  Save,
  XCircle,
  Info,
  UploadCloud,
  User as UserIcon,
  Building,
  Download,
  Filter,
  Truck,
  History,
  CheckCircle,
  RefreshCcw,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Percent,
  Lock,
  Unlock,
  Receipt,
  AlertTriangle,
  MessageCircle,
  Printer,
  Wand2,
  FileText,
  Phone,
  Archive,
  ArrowRightLeft,
  Image as ImageIcon,
  FileDown,
  LayoutList,
  LayoutGrid,
  Settings as SettingsIcon,
  X,
  PhoneForwarded,
  Users,
  ExternalLink,
  Link as LinkIcon,
  MessageSquare,
  Clock,
  Shield,
  Check,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calculator,
  ArrowLeft,
  Brain,
  CheckCircle2,
  PackageCheck,
  Hash,
  ShoppingCart,
  BookOpen,
  Wallet as WalletIcon,
} from "lucide-react";
import { db } from "../services/firebaseClient";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import {
  Order,
  Settings,
  OrderStatus,
  Wallet,
  Transaction,
  PaymentStatus,
  PreparationStatus,
  OrderItem,
  Product,
  CustomerProfile,
  Store,
  Employee,
  User,
  AuditLog,
} from "../types";
import {
  ORDER_STATUSES,
  EGYPT_GOVERNORATES,
  ORDER_STATUS_METADATA,
  generateEgyptShippingOptions,
} from "../constants";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { generateInvoiceHTML } from "../utils/invoiceGenerator";
import { generateShippingLabelHTML } from "../utils/shippingLabelGenerator";
import { generateShippingNote } from "../services/geminiService";
import {
  calculateCodFee,
  getLatestProductCost,
  isBosta,
  calculateInsuranceFee,
  calculateBostaVat,
  calculateOrderShippingAndFees,
  resolveCashHolderName,
  getStandardShippingFee,
  getOrderProductCost,
  calculateOrderProfitLoss,
  getAdvancePaymentCustodyName,
} from "../utils/financials";
import { generateOrdersReportHTML } from "../utils/reportGenerator";
import { triggerWebhooks } from "../utils/webhook";
import { printHTMLDirectly } from "../utils/printHelper";
import { exportHTMLToPDF } from "../utils/pdfHelper";
import { OrderDetailsModal } from "./OrderDetailsModal";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

const PREPARATION_STATUSES: PreparationStatus[] = ["بانتظار التجهيز", "جاهز"];
const PAYMENT_STATUSES: PaymentStatus[] = [
  "بانتظار الدفع",
  "مدفوع",
  "مدفوع جزئياً",
  "مرتجع",
];

interface OrdersListProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  settings: Settings;
  currentUser: User | null;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  addLoyaltyPointsForOrder: (order: Order) => void;
  activeStore?: Store;
  customers: CustomerProfile[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerProfile[]>>;
  treasury?: any;
  setTreasury?: (updater: any) => void;
  defaultShowAdd?: boolean;
}

interface NewOrderState extends Partial<Omit<Order, "id">> {
  items: OrderItem[];
  customerPhone2?: string;
  country?: string;
  buildingDetails?: string;
  creditAmount?: number;
  totalAmountOverrideReason?: string;
  advancePayment?: number;
  advancePaymentPartnerId?: string;
  advancePaymentTreasuryId?: string;
  advancePaymentRecipientPhone?: string;
  advancePaymentSenderDetails?: string;
}

const EditTotalModal: React.FC<{
  currentTotal: number;
  onClose: () => void;
  onApply: (amount: number, reason: string) => void;
}> = ({ currentTotal, onClose, onApply }) => {
  const [amount, setAmount] = useState(currentTotal);
  const [reason, setReason] = useState("");

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
              تعديل إجمالي الطلب
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            عميلك سيدفع هذا المبلغ لمندوب الشحن عند استلام الطلب
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                إجمالي الطلب
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
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="أدخل سببًا..."
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px] resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onApply(amount, reason)}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              تطبيق
            </button>
            <button
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

const WaybillModal: React.FC<{
  order: Order;
  onClose: () => void;
  onSave: (waybill: string) => void;
}> = ({ order, onClose, onSave }) => {
  const [waybill, setWaybill] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waybill.trim()) return;
    onSave(waybill);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-6">
          <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20">
            <FileSearch size={24} />
          </div>
          <h3 className="text-xl font-black dark:text-white">
            إدخال رقم بوليصة الشحن
          </h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          لتغيير حالة الطلب إلى "تم الارسال"، يجب إدخال رقم بوليصة الشحن أولاً.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={waybill}
            onChange={(e) => setWaybill(e.target.value)}
            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-center text-lg outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
            placeholder="رقم البوليصة"
            autoFocus
          />
          <div className="flex gap-3 mt-8">
            <button
              type="submit"
              disabled={!waybill.trim()}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 shadow-sm hover:shadow"
            >
              حفظ وتغيير الحالة
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const OrdersList: React.FC<OrdersListProps & { onRefresh?: () => void }> = ({
  orders,
  setOrders,
  products,
  settings,
  currentUser,
  setWallet,
  setSettings,
  addLoyaltyPointsForOrder,
  activeStore,
  customers,
  setCustomers,
  onRefresh,
  treasury,
  setTreasury,
  defaultShowAdd,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const storePrefix = activeStore ? `/store/${activeStore.id}` : "";
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    if (defaultShowAdd) {
      navigate(`${storePrefix}/orders/new`, { replace: true });
    }
  }, [defaultShowAdd, navigate]);

  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [pendingFlexShipConfirm, setPendingFlexShipConfirm] = useState<{
    orderId: string;
    newStatus: OrderStatus;
    fee: number;
    companyName: string;
    orderNumber: string;
  } | null>(null);
  const [pendingInspectionConfirm, setPendingInspectionConfirm] = useState<{
    order: Order;
    newPaymentStatus: PaymentStatus;
    inspectionFee: number;
  } | null>(null);
  const [autoWhatsappData, setAutoWhatsappData] = useState<{
    order: Order;
    newStatus: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showSummaryModal, setShowSummaryModal] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<Order | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      if (onRefresh && document.visibilityState === "visible") {
        onRefresh();
      }
    }, 10000); // UI poll every 10 seconds for smoothness
    return () => clearInterval(interval);
  }, [onRefresh]);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      if (activeStore?.id) {
        const connectedPlatforms = settings?.connectedPlatforms || [];
        const platformConfigs = settings?.platformConfigs || {};
        const activePlatforms = connectedPlatforms.filter(
          (p: string) => platformConfigs[p]?.isActive,
        );

        if (activePlatforms.length === 0) {
          await onRefresh();
          alert(
            "لا توجد منصات ربط نشطة (مثل سلة أو وويلت) لمزامنة الطلبات منها حالياً. تم تحديث سجل الطلبات من السحابة بنجاح.",
          );
          return;
        }

        let anySuccess = false;
        let totalSynced = 0;
        let totalUpdated = 0;
        let errors: string[] = [];

        for (const platformId of activePlatforms) {
          try {
            const res = await fetch(
              `/api/sync/platform/${platformId}/${activeStore.id}?type=orders`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              },
            );
            if (res.ok) {
              const data = await res.json();
              anySuccess = true;
              totalSynced += data.processed || 0;
              totalUpdated += data.actualWrites || 0;
            } else {
              const errData = await res.json().catch(() => ({}));
              errors.push(
                `فشلت المزامنة مع ${platformId}: ${errData.error || res.statusText}`,
              );
            }
          } catch (err: any) {
            errors.push(`خطأ اتصال مع ${platformId}: ${err.message || err}`);
          }
        }

        await onRefresh();

        if (errors.length > 0) {
          alert(
            `تنبيهات أثناء المزامنة مع بعض المنصات:\n${errors.join("\n")}\n\nتم تحديث وعرض الطلبات السحابية والمحلية المتوفرة.`,
          );
        } else if (anySuccess) {
          if (totalSynced > 0 || totalUpdated > 0) {
            alert(
              `تمت المزامنة بنجاح من كافة المنصات!\n- تم معالجة ${totalSynced} سجل.\n- تم تحديث ${totalUpdated} طلب في قاعدة البيانات.`,
            );
          } else {
            alert(
              "تمت المزامنة بنجاح: لا توجد طلبات جديدة أو تحديثات حالية في متاجرك المتصلة.",
            );
          }
        } else {
          alert(
            "لم نتمكن من المزامنة مع المنصات المتصلة. يرجى التحقق من إعدادات الربط ومفاتيح API في صفحة الإعدادات.",
          );
        }
      } else {
        await onRefresh();
      }
    } catch (e: any) {
      alert(`فشلت مزامنة التطبيق: ${e.message || e}`);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const [activeTab, setActiveTab] = useState("الجميع");
  const [mainSection, setMainSection] = useState<'orders' | 'analytics'>('orders');
  const [showStatusGuide, setShowStatusGuide] = useState(false);
  const [showAnalyticsHub, setShowAnalyticsHub] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<
    "summary" | "chart" | "govs" | "products" | "carriers"
  >("summary");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<Omit<
    Order,
    "id"
  > | null>(null);
  const [orderForWaybill, setOrderForWaybill] = useState<{
    orderId: string;
    newStatus: OrderStatus;
  } | null>(null);

  // Advanced Filters
  const [filterGov, setFilterGov] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState<Order | null>(null);
  const [showAssignment, setShowAssignment] = useState<Order | null>(null);
  const [reportPreviewHtml, setReportPreviewHtml] = useState<string | null>(
    null,
  );
  const [reportIsContinuous, setReportIsContinuous] = useState(false);
  const [reportOrientation, setReportOrientation] = useState<"portrait" | "landscape">("landscape");

  useEffect(() => {
    if (reportPreviewHtml !== null) {
      const storeName = activeStore?.name || "متجري";
      const html = generateOrdersReportHTML(
        filteredOrders,
        settings,
        storeName,
        undefined,
        reportIsContinuous,
        reportOrientation
      );
      setReportPreviewHtml(html);
    }
  }, [reportIsContinuous, reportOrientation]);

  const addAuditLog = (orderId: string, action: string, details: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const newLog: AuditLog = {
            id: Math.random().toString(36).substr(2, 9),
            action,
            details,
            timestamp: new Date().toISOString(),
            userEmail: currentUser?.email || "System",
          };
          return {
            ...o,
            auditLogs: [...(o.auditLogs || []), newLog],
          };
        }
        return o;
      }),
    );
  };

  const activeCompanies = useMemo(
    () =>
      Object.keys(settings.shippingOptions || {}).filter(
        (company) => settings.activeCompanies?.[company] !== false,
      ),
    [settings.shippingOptions, settings.activeCompanies],
  );

  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map<
      string,
      Pick<CustomerProfile, "name" | "phone" | "address">
    >();
    orders.forEach((order) => {
      const cleanPhone = (order.customerPhone || "")
        .replace(/\s/g, "")
        .replace("+2", "");
      if (cleanPhone && !customerMap.has(cleanPhone)) {
        customerMap.set(cleanPhone, {
          name: order.customerName,
          phone: order.customerPhone,
          address: order.customerAddress,
        });
      }
    });
    return Array.from(customerMap.values());
  }, [orders]);

  const handleEditOrder = (order: Order) => {
    navigate(`${storePrefix}/orders/edit/${order.id}`);
  };

  useEffect(() => {
    if (onRefresh && orders.length > 0) {
      // Logic for refresh if needed
    }
  }, [orders.length, onRefresh]);

  const filteredOrders = useMemo(() => {
    let baseFilter;
    if (activeTab === "مؤرشف") {
      baseFilter = orders.filter((o) => o.status === "مؤرشف");
    } else {
      baseFilter = orders.filter((o) => o.status !== "مؤرشف");
    }

    const searched = baseFilter.filter((o: Order) => {
      const matchesSearch =
        (o.customerName || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (o.orderNumber &&
          o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.waybillNumber &&
          o.waybillNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesGov =
        !filterGov || (o.governorate || o.shippingArea) === filterGov;
      const matchesCompany =
        !filterCompany || o.shippingCompany === filterCompany;
      const matchesEmployee =
        !filterEmployee || o.assignedTo === filterEmployee;

      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
        const orderDate = new Date(o.date).getTime();
        if (dateRange.start) {
          matchesDate =
            matchesDate && orderDate >= new Date(dateRange.start).getTime();
        }
        if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && orderDate <= endDate.getTime();
        }
      }

      return (
        matchesSearch &&
        matchesGov &&
        matchesCompany &&
        matchesEmployee &&
        matchesDate
      );
    });

    let tabFiltered = searched;
    if (activeTab === "processing_group") {
      tabFiltered = searched.filter((o) => ["في_انتظار_المكالمة", "جاري_المراجعة", "قيد_التنفيذ"].includes(o.status));
    } else if (activeTab === "transit_group") {
      tabFiltered = searched.filter((o) => o.status === "تم_الارسال");
    } else if (activeTab === "delivered_group") {
      tabFiltered = searched.filter((o) => o.status === "تم_التحصيل");
    } else if (activeTab === "failed_group") {
      tabFiltered = searched.filter((o) => ["مرتجع", "فشل_التوصيل"].includes(o.status));
    } else if (activeTab === "canceled_group") {
      tabFiltered = searched.filter((o) => ["ملغي", "مؤرشف"].includes(o.status));
    } else if (activeTab === "مؤرشف") {
      tabFiltered = searched.filter((o) => o.status === "مؤرشف");
    } else if (activeTab !== "الجميع") {
      tabFiltered = searched.filter((o) => o.status === activeTab);
    }

    return tabFiltered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [orders, searchTerm, activeTab, filterGov, filterCompany, filterEmployee, dateRange]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const anyFlexShipEnabled = useMemo(() => {
    if (!settings) return false;
    return filteredOrders.some((o) => {
      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      return o.enableFlexShip !== undefined
        ? o.enableFlexShip
        : useCustom
          ? (compFees?.enableFlexShip ?? false)
          : (settings.enableFlexShip ?? false);
    });
  }, [filteredOrders, settings]);

  const filteredMetrics = useMemo(() => {
    let salesTotal = 0;
    let expectedCollection = 0;
    let shippingExpenses = 0;
    let productCostTotal = 0;
    let flexFeesTotal = 0;
    let netProfitTotal = 0;
    let successCount = 0;
    let returnCount = 0;
    let pendingConfirmationCount = 0;
    let confirmedCount = 0;
    let inProgressCount = 0;
    let shippedCount = 0;
    let totalCount = filteredOrders.length;

    if (!settings)
      return {
        salesTotal,
        expectedCollection,
        shippingExpenses,
        productCostTotal,
        flexFeesTotal,
        netProfitTotal,
        returnRate: 0,
        pendingConfirmationCount: 0,
        confirmedCount: 0,
        inProgressCount: 0,
        shippedCount: 0,
        successCount: 0,
        totalCount: 0
      };

    filteredOrders.forEach((o) => {
      const safeProductPrice = Number(o.productPrice) || 0;
      const safeShippingFee = Number(o.shippingFee) || 0;
      const safeTax = Number(o.tax) || 0;
      const safeDiscount = Number(o.discount) || 0;
      const safeAdvance = Number(o.advancePayment) || 0;

      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const insuranceRate = useCustom
        ? (compFees?.insuranceFeePercent ?? 0)
        : settings.enableInsurance
          ? settings.insuranceFeePercent
          : 0;
      const isPosOrder =
        o.channel === "pos" || o.shippingCompany === "كاشير - بيع مباشر";

      const insuranceFee = isPosOrder
        ? 0
        : (o.isInsured ?? true)
          ? calculateInsuranceFee(o, insuranceRate, settings)
          : 0;
      const inspectionFee =
        !isPosOrder && (o.includeInspectionFee ?? true)
          ? useCustom
            ? (compFees?.inspectionFee ?? 0)
            : settings.enableInspection
              ? settings.inspectionFee
              : 0
          : 0;
      const bostaVatFee = isPosOrder
        ? 0
        : calculateBostaVat(o, insuranceFee, settings);

      const computedTotal =
        safeProductPrice +
        safeShippingFee +
        safeTax -
        safeDiscount -
        safeAdvance +
        inspectionFee;
      const orderTotal =
        o.totalAmountOverride != null
          ? Number(o.totalAmountOverride)
          : computedTotal;

      const totalCarrierExpenses = isPosOrder
        ? 0
        : safeShippingFee + insuranceFee + bostaVatFee;

      const isFlexShipEnabled =
        !isPosOrder &&
        (o.enableFlexShip !== undefined
          ? o.enableFlexShip
          : useCustom
            ? (compFees?.enableFlexShip ?? false)
            : (settings.enableFlexShip ?? false));
      const flexFeeValue = isFlexShipEnabled
        ? (o.flexShipFee !== undefined ? o.flexShipFee : (useCustom
          ? (compFees?.flexShipFee ?? 0)
          : (settings.flexShipFee ?? 0)))
        : 0;

      // Use central utility for accurate P&L
      const { net } = calculateOrderProfitLoss(o, settings);

      const isSuccessful = [
        "تم_التحصيل",
        "تم_توصيلها",
        "تم_التوصيل",
        "مدفوعة",
      ].includes(o.status);

      const isFailedOrCancelled = [
        "ملغي",
        "مرتجع",
        "فشل_التوصيل",
        "تمت_الاعادة_لشركة_الشحن",
      ].includes(o.status);

      const isUsingOverride = (o.totalAmountOverride !== undefined && o.totalAmountOverride !== null && String(o.totalAmountOverride).trim() !== '') || (o.source === 'synced');

      // Gross revenue from customer perspective
      const grossCollection = orderTotal;
      const orderRevenue = isUsingOverride ? (grossCollection + safeAdvance) : (safeProductPrice + safeShippingFee + safeTax - safeDiscount + inspectionFee);

      if (isSuccessful) {
        salesTotal += orderRevenue;
        productCostTotal += getOrderProductCost(o, settings);
      }

      if (!isFailedOrCancelled && !isSuccessful) {
        expectedCollection += grossCollection;
      }

      shippingExpenses += totalCarrierExpenses;
      flexFeesTotal += o.flexShipFee !== undefined ? o.flexShipFee : flexFeeValue;
      netProfitTotal += net;

      // Status Logic for Funnel
      if (["قيد_المراجعة", "بانتظار_التأكيد"].includes(o.status)) {
        pendingConfirmationCount++;
      }
      if (!["ملغي", "قيد_المراجعة", "بانتظار_التأكيد"].includes(o.status)) {
        confirmedCount++;
      }
      if (["قيد_التنفيذ", "محول_للمخزن"].includes(o.status)) {
        inProgressCount++;
      }
      if (["تم_الارسال", "قيد_الشحن", "تم_التوصيل", "تم_تحويلها"].includes(o.status)) {
        shippedCount++;
      }

      if (
        o.status === "تم_التحصيل" ||
        o.status === "تم_توصيلها" ||
        o.status === "تم_التوصيل" ||
        o.status === "مدفوعة"
      ) {
        successCount++;
      } else if (
        [
          "مرتجع",
          "فشل_التوصيل",
          "تمت_الاعادة_لشركة_الشحن",
          "مرتجع_جزئي",
          "مرتجع_بعد_الاستلام",
        ].includes(o.status)
      ) {
        returnCount++;
      }
    });

    const activeDeliveredOrReturned = successCount + returnCount;
    const returnRate =
      activeDeliveredOrReturned > 0
        ? (returnCount / activeDeliveredOrReturned) * 100
        : 0;

    return {
      salesTotal,
      expectedCollection,
      shippingExpenses,
      productCostTotal,
      flexFeesTotal,
      netProfitTotal,
      returnRate,
      pendingConfirmationCount,
      confirmedCount,
      inProgressCount,
      shippedCount,
      successCount,
      totalCount
    };
  }, [filteredOrders, settings]);

  // 1. Daily Trend Data
  const dailyTrendData = useMemo(() => {
    const dailyMap: Record<
      string,
      { dateStr: string; sales: number; profit: number; count: number }
    > = {};

    filteredOrders.forEach((o) => {
      if (!o.date) return;
      const d = new Date(o.date);
      if (isNaN(d.getTime())) return;

      const key = d.toISOString().split("T")[0];
      const salesVal = Number(o.productPrice) || 0;
      const { net } = calculateOrderProfitLoss(o, settings);

      if (!dailyMap[key]) {
        dailyMap[key] = {
          dateStr: key,
          sales: 0,
          profit: 0,
          count: 0,
        };
      }
      dailyMap[key].sales += salesVal;
      dailyMap[key].profit += net;
      dailyMap[key].count += 1;
    });

    return Object.values(dailyMap)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
      .slice(-15);
  }, [filteredOrders, settings]);

  // 2. Governorate Breakdown Data
  const govBreakdownData = useMemo(() => {
    const govMap: Record<
      string,
      { name: string; count: number; sales: number; successCount: number; returnCount: number }
    > = {};

    filteredOrders.forEach((o) => {
      const gKey = o.governorate || "unknown";
      const arabicName =
        EGYPT_GOVERNORATES[gKey as keyof typeof EGYPT_GOVERNORATES] || gKey;
      const salesVal = Number(o.productPrice) || 0;

      if (!govMap[gKey]) {
        govMap[gKey] = {
          name: arabicName,
          count: 0,
          sales: 0,
          successCount: 0,
          returnCount: 0,
        };
      }
      govMap[gKey].count += 1;
      govMap[gKey].sales += salesVal;
      
      if (["تم_التحصيل", "تم_توصيلها", "تم_التوصيل", "مدفوعة"].includes(o.status)) {
        govMap[gKey].successCount += 1;
      } else if (["مرتجع", "فشل_التوصيل", "تمت_الاعادة_لشركة_الشحن"].includes(o.status)) {
        govMap[gKey].returnCount += 1;
      }
    });

    return Object.values(govMap)
      .map(item => ({
        ...item,
        deliveryRate: item.successCount + item.returnCount > 0 
          ? (item.successCount / (item.successCount + item.returnCount)) * 100 
          : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredOrders]);

  // 3. Top Products Breakdown Data
  const topProductsData = useMemo(() => {
    const prodMap: Record<
      string,
      { id: string; name: string; count: number; revenue: number; estimatedProfit: number }
    > = {};

    filteredOrders.forEach((o) => {
      if (!o.items) return;
      o.items.forEach((item) => {
        const pId = item.productId || "unknown";
        const pName = item.productName || "منتج مجهول";
        const qty = Number(item.quantity) || 0;
        const totalRev = (Number(item.price) || 0) * qty;

        // Try to find product cost from settings
        const productFromSettings = settings?.products?.find(p => p.id === pId);
        const cost = Number(productFromSettings?.costPrice) || 0;
        const totalCost = cost * qty;

        if (!prodMap[pId]) {
          prodMap[pId] = {
            id: pId,
            name: pName,
            count: 0,
            revenue: 0,
            estimatedProfit: 0,
          };
        }
        prodMap[pId].count += qty;
        prodMap[pId].revenue += totalRev;
        prodMap[pId].estimatedProfit += (totalRev - totalCost);
      });
    });

    return Object.values(prodMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders, settings]);

  // 4. Shipping Carriers performance data
  const carrierPerformanceData = useMemo(() => {
    const carrierMap: Record<
      string,
      {
        name: string;
        total: number;
        delivered: number;
        returned: number;
        rate: number;
        fees: number;
      }
    > = {};

    filteredOrders.forEach((o) => {
      const c = o.shippingCompany || "غير محدد";
      const isDelivered =
        o.status === "تم_التحصيل" ||
        o.status === "تم_توصيلها" ||
        o.status === "تم_التوصيل" ||
        o.status === "مدفوعة";
      const isReturned = [
        "مرتجع",
        "فشل_التوصيل",
        "تمت_الاعادة_لشركة_الشحن",
        "مرتجع_جزئي",
        "مرتجع_بعد_الاستلام",
      ].includes(o.status);
      const fee = Number(o.shippingFee) || 0;

      if (!carrierMap[c]) {
        carrierMap[c] = {
          name: c,
          total: 0,
          delivered: 0,
          returned: 0,
          rate: 0,
          fees: 0,
        };
      }

      carrierMap[c].total += 1;
      if (isDelivered) carrierMap[c].delivered += 1;
      if (isReturned) carrierMap[c].returned += 1;
      carrierMap[c].fees += fee;
    });

    Object.values(carrierMap).forEach((item) => {
      const totalDecided = item.delivered + item.returned;
      item.rate = totalDecided > 0 ? (item.delivered / totalDecided) * 100 : 0;
    });

    return Object.values(carrierMap).sort((a, b) => b.total - a.total);
  }, [filteredOrders]);

  // 5. Excel Advanced Exporter
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredOrders.map((o, idx) => {
        const pNames =
          o.items
            ?.map((it) => `${it.productName} (x${it.quantity})`)
            .join(" + ") || "منتج غير معروف";
        const profit = calculateOrderProfitLoss(o, settings).net;
        return {
          م: idx + 1,
          "كود الطلب": o.id || "",
          "بوليصة الشحن": o.waybill || "غير محدد",
          العميل: o.customerName || "",
          "رقم الهاتف": o.customerPhone || "",
          "رقم هاتف إضافي": o.customerPhone2 || "",
          المحافظة:
            EGYPT_GOVERNORATES[
              o.governorate as keyof typeof EGYPT_GOVERNORATES
            ] ||
            o.governorate ||
            "",
          "العنوان التفصيلي": o.address || "",
          "المنتجات المطلوبية": pNames,
          "المصدر / القناة": o.channel || "ويب",
          "حالة الطلب":
            ORDER_STATUS_METADATA[
              o.status as keyof typeof ORDER_STATUS_METADATA
            ]?.label || o.status,
          "حالة الدفع": o.paymentStatus || "",
          "إجمالي بيع المنتجات": Number(o.productPrice) || 0,
          "مصاريف الشحن للمستلم": Number(o.shippingFee) || 0,
          الخصم: Number(o.discount) || 0,
          "المقدم المدفوع": Number(o.advancePayment) || 0,
          "إجمالي الحساب (COD)":
            o.totalAmountOverride != null
              ? Number(o.totalAmountOverride)
              : Number(o.productPrice) +
                Number(o.shippingFee) -
                Number(o.discount) -
                Number(o.advancePayment),
          "تكلفة البضاعة الأصلية (COGS)": getOrderProductCost(o, settings),
          "الصافي الربحي": profit,
          "شركة الشحن": o.shippingCompany || "",
          "حالة التجهيز": o.preparationStatus || "",
          "تاريخ الإنشاء": o.date
            ? new Date(o.date).toLocaleDateString("ar-EG")
            : "",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "طلبات متجري المفلترة");

      const max_cols = Object.keys(dataToExport[0] || {}).length;
      worksheet["!cols"] = Array(max_cols).fill({ wch: 20 });

      const fileName = `تقرير_طلبيات_${activeStore?.name || "متجري"}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    }
  };

  const handleDeleteOrder = (deleteRelated?: boolean) => {
    if (!orderToDelete) {
      console.error("handleDeleteOrder called with no order to delete.");
      return;
    }

    // Logic for deleting related maintenance request...
    if (deleteRelated && orderToDelete.orderType === "maintenance") {
      const maintenanceQuery = query(
        collection(db, "maintenance_requests"),
        where("orderNumber", "==", orderToDelete.orderNumber),
      );
      getDocs(maintenanceQuery)
        .then((snapshot) => {
          snapshot.forEach((doc) => {
            deleteDoc(doc.ref);
          });
        })
        .catch((err) =>
          console.error("Error deleting maintenance request:", err),
        );
    }

    const orderIdToDelete = orderToDelete.id;
    const orderNumberToDelete = orderToDelete.orderNumber;

    // Check if the deleted order indicates whether stock was deducted
    const isPos =
      orderToDelete.channel === "pos" ||
      orderToDelete.id.startsWith("POS-") ||
      orderToDelete.shippingCompany === "كاشير - بيع مباشر";
    const isStockDeducted = orderToDelete.stockDeducted || isPos;

    setSettings((prev) => {
      let updatedSettings = { ...prev };

      // 1. Return stock to inventory if needed
      if (isStockDeducted) {
        let updatedProducts = [...(updatedSettings.products || [])];
        (orderToDelete.items || []).forEach((orderItem) => {
          const pIdx = updatedProducts.findIndex(
            (p) => p.id === orderItem.productId,
          );
          if (pIdx > -1) {
            const prod = { ...updatedProducts[pIdx] };
            let newQty = (prod.stockQuantity || 0) + orderItem.quantity;

            // Return to warehouse stock
            let updatedWhStock = prod.warehouseStock
              ? { ...prod.warehouseStock }
              : {};
            const whId =
              orderToDelete.warehouseId ||
              updatedSettings.warehouses?.find((w) => w.isDefault)?.id;
            if (whId) {
              updatedWhStock[whId] =
                (updatedWhStock[whId] || 0) + orderItem.quantity;
            }

            // Return variant stock if variantId is matched
            if (orderItem.variantId && prod.variants) {
              prod.variants = prod.variants.map((v) => {
                if (v.id === orderItem.variantId) {
                  const vUpdated = { ...v };
                  vUpdated.stockQuantity =
                    (vUpdated.stockQuantity || 0) + orderItem.quantity;
                  vUpdated.warehouseStock = vUpdated.warehouseStock
                    ? { ...vUpdated.warehouseStock }
                    : {};
                  if (whId) {
                    vUpdated.warehouseStock[whId] =
                      (vUpdated.warehouseStock[whId] || 0) + orderItem.quantity;
                  }
                  return vUpdated;
                }
                return v;
              });
              newQty = prod.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
            } else {
              newQty = (prod.stockQuantity || 0) + orderItem.quantity;
            }

            updatedProducts[pIdx] = {
              ...prod,
              stockQuantity: newQty,
              warehouseStock: updatedWhStock,
            };
          }
        });
        updatedSettings.products = updatedProducts;
      }

      // 2. Remove from posSales
      if (isPos || isStockDeducted) {
        updatedSettings.posSales = (updatedSettings.posSales || []).filter(
          (sale) => sale.id !== orderIdToDelete,
        );
      } else {
        updatedSettings.posSales = (updatedSettings.posSales || []).filter(
          (sale) => sale.id !== orderIdToDelete,
        );
      }

      // 3. Remove from Partner Transactions and adjust Partner Balances
      let ptToRemove: any[] = [];
      updatedSettings.partnerTransactions = (updatedSettings.partnerTransactions || []).filter(
        (tx: any) => {
          const note = tx.note || "";
          const matchOrderNumber = orderNumberToDelete
            ? note.includes(`#${orderNumberToDelete}`) || note.includes(orderNumberToDelete)
            : false;
          const matchOrderId = orderIdToDelete
            ? note.includes(orderIdToDelete)
            : false;
          
          const isMatch = matchOrderNumber || matchOrderId;
          if (isMatch) ptToRemove.push(tx);
          return !isMatch;
        }
      );
      if (ptToRemove.length > 0) {
        updatedSettings.partners = [...(updatedSettings.partners || [])];
        ptToRemove.forEach((tx: any) => {
          // If transaction was a customer advance (the partner took money), we added debt (reduced balance)
          // To reverse, we add the amount back to balance.
          if (tx.partnerId && tx.type === 'customer_advance') {
            const pIdx = updatedSettings.partners.findIndex((p: any) => p.id === tx.partnerId);
            if (pIdx > -1) {
              updatedSettings.partners[pIdx] = { ...updatedSettings.partners[pIdx], balance: (updatedSettings.partners[pIdx].balance || 0) + tx.amount };
            }
          }
        });
      }

      // 4. Remove from Cash Handovers and adjust Cash Holders Balances
      const matchHolderId = (id1?: string, id2?: string) => {
        if (!id1 || !id2) return false;
        if (String(id1) === String(id2)) return true;
        const c1 = String(id1).replace(/^(emp_|part_|treas_)/, '');
        const c2 = String(id2).replace(/^(emp_|part_|treas_)/, '');
        return c1 === c2 && c1 !== '';
      };

      let handoversToRemove: any[] = [];
      updatedSettings.cashHandovers = (updatedSettings.cashHandovers || []).filter(
        (tx: any) => {
          const notes = tx.notes || "";
          const matchOrderNumber = orderNumberToDelete
            ? notes.includes(`#${orderNumberToDelete}`) || notes.includes(orderNumberToDelete)
            : false;
          const matchOrderId = orderIdToDelete
            ? notes.includes(orderIdToDelete) || tx.orderId === orderIdToDelete || tx.orderId === orderNumberToDelete
            : false;
          
          const isMatch = matchOrderNumber || matchOrderId;
          if (isMatch) handoversToRemove.push(tx);
          return !isMatch;
        }
      );
      
      updatedSettings.cashHolders = [...(updatedSettings.cashHolders || [])];
      if (handoversToRemove.length > 0) {
          handoversToRemove.forEach((tx: any) => {
              if (tx.toUserId) {
                  const toIdx = updatedSettings.cashHolders.findIndex((h: any) => matchHolderId(h.userId, tx.toUserId));
                  if (toIdx > -1) {
                      updatedSettings.cashHolders[toIdx] = { ...updatedSettings.cashHolders[toIdx], currentBalance: Math.max(0, (updatedSettings.cashHolders[toIdx].currentBalance || 0) - tx.amount), lastUpdated: new Date().toISOString() };
                  }
              }
              if (tx.fromUserId && tx.fromUserId !== 'system' && tx.fromUserId !== 'customer') {
                  const fromIdx = updatedSettings.cashHolders.findIndex((h: any) => matchHolderId(h.userId, tx.fromUserId));
                  if (fromIdx > -1) {
                      updatedSettings.cashHolders[fromIdx] = { ...updatedSettings.cashHolders[fromIdx], currentBalance: (updatedSettings.cashHolders[fromIdx].currentBalance || 0) + tx.amount, lastUpdated: new Date().toISOString() };
                  }
              }
          });
      } else if (orderToDelete.cashHolderId && orderToDelete.cashHolderId !== 'credit' && orderToDelete.cashHolderId !== 'wallet') {
          const deductAmount = Number(orderToDelete.totalPrice || (orderToDelete as any).totalAmount || orderToDelete.advancePayment || 0);
          if (deductAmount > 0) {
              const hIdx = updatedSettings.cashHolders.findIndex((h: any) => matchHolderId(h.userId, orderToDelete.cashHolderId));
              if (hIdx > -1) {
                  updatedSettings.cashHolders[hIdx] = { ...updatedSettings.cashHolders[hIdx], currentBalance: Math.max(0, (updatedSettings.cashHolders[hIdx].currentBalance || 0) - deductAmount), lastUpdated: new Date().toISOString() };
              }
          }
      }

      return updatedSettings;
    });

    // Cascade delete from Treasury if treasury set_treasury is available
    if (setTreasury && treasury) {
      setTreasury((prev: any) => {
        if (!prev) return prev;
        
        let txsToRemove: any[] = [];
        const updatedTransactions = (prev.transactions || []).filter(
          (tx: any) => {
            const desc = tx.description || "";
            const ref = tx.reference || "";
            const matchOrderNumber = orderNumberToDelete
              ? desc.includes(`#${orderNumberToDelete}`) ||
                ref.includes(orderNumberToDelete)
              : false;
            const matchOrderId = orderIdToDelete
              ? desc.includes(orderIdToDelete) || ref.includes(orderIdToDelete)
              : false;
            const isMatch = matchOrderNumber || matchOrderId;
            if (isMatch) {
                txsToRemove.push(tx);
            }
            return !isMatch;
          },
        );

        let updatedAccounts = [...(prev.accounts || [])];
        txsToRemove.forEach(tx => {
            if (tx.type === 'deposit' && tx.toAccountId) {
                const accIdx = updatedAccounts.findIndex(a => a.id === tx.toAccountId);
                if (accIdx > -1) {
                    updatedAccounts[accIdx] = { ...updatedAccounts[accIdx], balance: updatedAccounts[accIdx].balance - tx.amount };
                }
            } else if (tx.type === 'withdrawal' && tx.fromAccountId) {
                const accIdx = updatedAccounts.findIndex(a => a.id === tx.fromAccountId);
                if (accIdx > -1) {
                    updatedAccounts[accIdx] = { ...updatedAccounts[accIdx], balance: updatedAccounts[accIdx].balance + tx.amount };
                }
            }
        });

        return {
          ...prev,
          accounts: updatedAccounts,
          transactions: updatedTransactions,
        };
      });
    }

    // Preserve the customer's current stats before deleting the order so we don't lose the success rate!
    if (setCustomers && orderToDelete) {
      setCustomers((prev: CustomerProfile[]) => {
        const cleanPhone = (orderToDelete.customerPhone || "")
          .replace(/\s/g, "")
          .replace("+2", "");
        if (!cleanPhone) return prev;

        // First, calculate the current customer stats from ALL existing orders (BEFORE DELETION)
        let currentTotal = 0;
        let currentSuccess = 0;
        let currentReturn = 0;
        let currentSpent = 0;

        orders.forEach((o) => {
          const p = (o.customerPhone || "")
            .replace(/\s/g, "")
            .replace("+2", "");
          if (p === cleanPhone) {
            currentTotal++;
            if (
              ["تم_توصيلها", "تم_التوصيل", "تم_التحصيل", "مدفوعة"].includes(
                o.status,
              )
            ) {
              currentSuccess++;
              const tax = Number((o as any).tax) || 0;
              const insp = (o.includeInspectionFee && o.inspectionFeePaidByCustomer !== false) ? (settings.enableInspection ? settings.inspectionFee : 0) : 0;
              currentSpent +=
                o.productPrice + o.shippingFee + tax + insp - (o.discount || 0);
            } else if (
              ["مرتجع", "فشل_التوصيل", "تمت_الاعادة_لشركة_الشحن"].includes(
                o.status,
              )
            ) {
              currentReturn++;
            }
          }
        });

        const existingIdx = prev.findIndex(
          (c) =>
            c.phone &&
            c.phone.replace(/\s/g, "").replace("+2", "") === cleanPhone,
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            totalOrders: Math.max(
              updated[existingIdx].totalOrders || 0,
              currentTotal,
            ),
            successfulOrders: Math.max(
              updated[existingIdx].successfulOrders || 0,
              currentSuccess,
            ),
            returnedOrders: Math.max(
              updated[existingIdx].returnedOrders || 0,
              currentReturn,
            ),
            totalSpent: Math.max(
              updated[existingIdx].totalSpent || 0,
              currentSpent,
            ),
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              id: `cust-${Date.now()}`,
              name: orderToDelete.customerName || "",
              phone: orderToDelete.customerPhone || "",
              address: orderToDelete.customerAddress || "",
              totalOrders: currentTotal,
              successfulOrders: currentSuccess,
              returnedOrders: currentReturn,
              totalSpent: currentSpent,
              lastOrderDate: orderToDelete.date,
              firstOrderDate: orderToDelete.date,
              averageOrderValue:
                currentSuccess > 0 ? currentSpent / currentSuccess : 0,
              loyaltyPoints: 0,
            },
          ];
        }
      });
    }

    // 1. Remove Order from the main orders list
    setOrders((prevOrders) =>
      prevOrders.filter((o) => o.id !== orderIdToDelete),
    );

    // 2. Remove associated transactions from Wallet
    setWallet((prevWallet) => {
      // Ensure transactions is an array to prevent errors
      const currentTransactions = prevWallet.transactions || [];

      const updatedTransactions = currentTransactions.filter((t) => {
        const note = t.note || "";
        const id = t.id || "";

        // Check if transaction is related by order number in note
        const relatedByNote = orderNumberToDelete
          ? note.includes(`#${orderNumberToDelete}`)
          : false;

        const relatedByField = t.orderId === orderIdToDelete;

        // Check if transaction is related by a conventional ID
        const relatedById = id.endsWith(`_${orderIdToDelete}`);

        // If it's related, we want to remove it, so we return false from filter
        return !(relatedByNote || relatedById || relatedByField);
      });

      // If nothing changed, return original wallet to avoid re-render
      if (updatedTransactions.length === currentTransactions.length) {
        return prevWallet;
      }

      return {
        ...prevWallet,
        transactions: updatedTransactions,
      };
    });

    // 3. Close the confirmation modal
    setOrderToDelete(null);
  };

  const updateOrderField = (id: string, field: keyof Order, value: any) => {
    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    );
  };

  const processFinancialsForStatusChange = (
    orderToUpdate: Order,
    newStatus: OrderStatus,
  ): { updatedOrderData: Order; newTransactions: Transaction[] } => {
    let updatedOrderData = { ...orderToUpdate, status: newStatus };
    const newTransactions: Transaction[] = [];
    const compFees =
      settings.companySpecificFees?.[orderToUpdate.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const companyInspectionFee = useCustom
      ? (compFees?.inspectionFee ?? 0)
      : settings.enableInspection
        ? (settings.inspectionFee ?? 0)
        : 0;

    if (
      newStatus === "تم_الارسال" &&
      !updatedOrderData.shippingAndInsuranceDeducted
    ) {
      const manualShippingFee = (orderToUpdate.isManualShippingOverride && orderToUpdate.shippingFee !== undefined) ? orderToUpdate.shippingFee : null;
      const standardShippingFee = manualShippingFee !== null ? manualShippingFee : getStandardShippingFee(
        orderToUpdate,
        settings,
      );
      newTransactions.push({
        id: `ship_${orderToUpdate.id}`,
        type: "سحب",
        amount: standardShippingFee,
        date: new Date().toISOString(),
        note: `مصاريف شحن أوردر #${orderToUpdate.orderNumber}`,
        category: "shipping",
        status: "completed",
        orderId: orderToUpdate.id,
        orderNumber: orderToUpdate.orderNumber,
      });

      const insuranceRate = useCustom
        ? compFees!.insuranceFeePercent
        : settings.enableInsurance
          ? settings.insuranceFeePercent
          : 0;
      let insuranceFee = 0;
      if (orderToUpdate.isInsured && insuranceRate > 0) {
        insuranceFee = calculateInsuranceFee(
          orderToUpdate,
          insuranceRate,
          settings,
        );
        newTransactions.push({
          id: `insure_${orderToUpdate.id}`,
          type: "سحب",
          amount: insuranceFee,
          date: new Date().toISOString(),
          note: `خصم رسوم تأمين أوردر #${orderToUpdate.orderNumber}`,
          category: "insurance",
          status: "completed",
          orderId: orderToUpdate.id,
          orderNumber: orderToUpdate.orderNumber,
        });
      }

      const bostaVatAmount = calculateBostaVat(
        orderToUpdate,
        insuranceFee,
        settings,
      );
      if (bostaVatAmount > 0) {
        const companySpecificVat = useCustom
          ? (compFees?.shippingVatRate ??
            (isBosta(orderToUpdate.shippingCompany) ? 0.14 : 0))
          : (settings?.shippingVatRate ??
            (isBosta(orderToUpdate.shippingCompany) ? 0.14 : 0));
        const vatPercentageText = `${(companySpecificVat * 100).toFixed(0)}%`;
        newTransactions.push({
          id: `vat_${orderToUpdate.id}`,
          type: "سحب",
          amount: bostaVatAmount,
          date: new Date().toISOString(),
          note: `خصم ضريبة القيمة المضافة لطلب شحن (${vatPercentageText}) #${orderToUpdate.orderNumber}`,
          category: "vat",
          status: "completed",
          orderId: orderToUpdate.id,
          orderNumber: orderToUpdate.orderNumber,
        });
      }

      if (
        orderToUpdate.includeInspectionFee &&
        companyInspectionFee > 0 &&
        !updatedOrderData.inspectionFeeDeducted &&
        !newTransactions.some(
          (tx) => tx.category === "inspection" && tx.orderId === orderToUpdate.id
        )
      ) {
        newTransactions.push({
          id: `insp_expense_${orderToUpdate.id}`,
          type: "سحب",
          amount: companyInspectionFee,
          date: new Date().toISOString(),
          note: `خصم رسوم معاينة أوردر #${orderToUpdate.orderNumber}`,
          category: "inspection",
          status: "completed",
          orderId: orderToUpdate.id,
          orderNumber: orderToUpdate.orderNumber,
        });
        updatedOrderData.inspectionFeeDeducted = true;
      }

      updatedOrderData.shippingAndInsuranceDeducted = true;
    }

    if (newStatus === "ملغي") {
      updatedOrderData.shippingAndInsuranceDeducted = true;
    }

    if (
      (newStatus === "مرتجع" || newStatus === "فشل_التوصيل" || (newStatus === "ملغي" && updatedOrderData.shippingAndInsuranceDeducted)) &&
      !updatedOrderData.returnFeeDeducted
    ) {
      const applyReturnFee = useCustom
        ? (compFees?.enableFixedReturn ?? false)
        : settings.enableReturnShipping;
      if (applyReturnFee) {
        const returnFeeAmount = useCustom
          ? compFees!.returnShippingFee
          : settings.returnShippingFee;
        if (returnFeeAmount > 0) {
          newTransactions.push({
            id: `return_${orderToUpdate.id}`,
            type: "سحب",
            amount: returnFeeAmount,
            date: new Date().toISOString(),
            note: `خصم مصاريف مرتجع أوردر #${orderToUpdate.orderNumber}`,
            category: "return",
            status: "completed",
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber,
          });
          updatedOrderData.returnFeeDeducted = true;
        }
      }
    }

    if (
      (["مرتجع", "فشل_التوصيل"].includes(newStatus) || (newStatus === "ملغي" && updatedOrderData.shippingAndInsuranceDeducted)) &&
      updatedOrderData.flexShipFeePaidByCustomer
    ) {
      const flexShipFeeAmount =
        updatedOrderData.flexShipFee ??
        (useCustom
          ? (compFees?.flexShipFee ?? 0)
          : (settings.flexShipFee ?? 0));
      if (flexShipFeeAmount > 0 && updatedOrderData.flexShipFeePaidByCustomer && !updatedOrderData.flexShipTransactionAdded) {
        newTransactions.push({
          id: `flexship_${orderToUpdate.id}`,
          type: "إيداع",
          amount: flexShipFeeAmount,
          date: new Date().toISOString(),
          note: `تحصيل رسوم خدمة فليكس شيب أوردر #${orderToUpdate.orderNumber}`,
          category: "collection",
          status: "completed",
          orderId: orderToUpdate.id,
          orderNumber: orderToUpdate.orderNumber,
        });

        updatedOrderData.flexShipTransactionAdded = true;

        const flexShipCompanyFee =
          updatedOrderData.flexShipCompanyFee ??
          (useCustom
            ? (compFees?.flexShipCompanyFee ?? 0)
            : (settings.flexShipCompanyFee ?? 0));
        if (flexShipCompanyFee > 0) {
          newTransactions.push({
            id: `flexship_company_${orderToUpdate.id}`,
            type: "سحب",
            amount: flexShipCompanyFee,
            date: new Date().toISOString(),
            note: `خصم حصة شركة الشحن من خدمة فليكس شيب أوردر #${orderToUpdate.orderNumber}`,
            category: "expense_other",
            status: "completed",
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber,
          });
        }
      }
    }

    // Handling reversal of collection if it was already processed
    if (orderToUpdate.collectionProcessed && newStatus !== "تم_التحصيل") {
      const orderPrice = Number(orderToUpdate.productPrice) || 0;
      const orderShip = Number(orderToUpdate.shippingFee) || 0;
      const orderDisc = Number(orderToUpdate.discount) || 0;
      const orderTax = Number((orderToUpdate as any).tax) || 0;
      const orderAdvance = Number(orderToUpdate.advancePayment) || 0;
      const orderInsp = (orderToUpdate.includeInspectionFee && (orderToUpdate.inspectionFeePaidByCustomer !== false)) ? companyInspectionFee : 0;

      const baseAmountToCollect =
        orderToUpdate.totalAmountOverride ??
        (orderPrice + orderShip + orderTax + orderInsp - orderDisc - orderAdvance);

      newTransactions.push({
        id: `revert_collect_${orderToUpdate.id}`,
        type: "سحب",
        amount: baseAmountToCollect,
        date: new Date().toISOString(),
        note: `عكس عملية تحصيل أوردر #${orderToUpdate.orderNumber} (تغيير الحالة)`,
        category: "collection",
        status: "completed",
        orderId: orderToUpdate.id,
        orderNumber: orderToUpdate.orderNumber,
      });

      updatedOrderData.collectionProcessed = false;
      updatedOrderData.paymentStatus = "بانتظار الدفع";
    }

    // Handling reversal of shipping, vat, insurance, and inspection fees if transitioned back to pre-shipping status
    const preShippingStatuses = [
      "في_انتظار_المكالمة",
      "جاري_المراجعة",
      "قيد_التنفيذ",
      "مؤجل",
      "مجدول",
    ];
    if (
      orderToUpdate.shippingAndInsuranceDeducted &&
      preShippingStatuses.includes(newStatus)
    ) {
      // 1. Revert shipping fee
      newTransactions.push({
        id: `revert_ship_${orderToUpdate.id}`,
        type: "إيداع",
        amount: orderToUpdate.shippingFee,
        date: new Date().toISOString(),
        note: `إعادة مصاريف شحن أوردر #${orderToUpdate.orderNumber} (تغيير الحالة إلى ${newStatus})`,
        category: "shipping",
        status: "completed",
        orderId: orderToUpdate.id,
        orderNumber: orderToUpdate.orderNumber,
      });

      // 2. Revert insurance fee if any
      const insuranceRate = useCustom
        ? (compFees?.insuranceFeePercent ?? 0)
        : settings.enableInsurance
          ? settings.insuranceFeePercent
          : 0;
      let insuranceFee = 0;
      if (orderToUpdate.isInsured && insuranceRate > 0) {
        insuranceFee = calculateInsuranceFee(
          orderToUpdate,
          insuranceRate,
          settings,
        );
        newTransactions.push({
          id: `revert_insure_${orderToUpdate.id}`,
          type: "إيداع",
          amount: insuranceFee,
          date: new Date().toISOString(),
          note: `إعادة رسوم تأمين أوردر #${orderToUpdate.orderNumber} (تغيير الحالة)`,
          category: "insurance",
          status: "completed",
          orderId: orderToUpdate.id,
          orderNumber: orderToUpdate.orderNumber,
        });
      }

      // 3. Revert VAT fee if any
      const bostaVatAmount = calculateBostaVat(
        orderToUpdate,
        insuranceFee,
        settings,
      );
      if (bostaVatAmount > 0) {
        newTransactions.push({
          id: `revert_vat_${orderToUpdate.id}`,
          type: "إيداع",
          amount: bostaVatAmount,
          date: new Date().toISOString(),
          note: `إعادة ضريبة القيمة المضافة لطلب شحن أوردر #${orderToUpdate.orderNumber}`,
          category: "vat",
          status: "completed",
          orderId: orderToUpdate.id,
          orderNumber: orderToUpdate.orderNumber,
        });
      }

      // 4. Revert inspection fee if any
      if (
        orderToUpdate.includeInspectionFee &&
        orderToUpdate.inspectionFeeDeducted
      ) {
        const feeAmount = useCustom
          ? (compFees?.inspectionFee ?? 0)
          : settings.enableInspection
            ? settings.inspectionFee
            : 0;
        if (feeAmount > 0) {
          newTransactions.push({
            id: `revert_insp_${orderToUpdate.id}`,
            type: "إيداع",
            amount: feeAmount,
            date: new Date().toISOString(),
            note: `إعادة رسوم معاينة أوردر #${orderToUpdate.orderNumber} (تغيير الحالة)`,
            category: "inspection",
            status: "completed",
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber,
          });
        }
      }

      updatedOrderData.shippingAndInsuranceDeducted = false;
      updatedOrderData.inspectionFeeDeducted = false;
    }

    // Handling reversal of return shipping fee if moved out of return status
    if (
      orderToUpdate.returnFeeDeducted &&
      !["مرتجع", "فشل_التوصيل", "ملغي"].includes(newStatus)
    ) {
      const applyReturnFee = useCustom
        ? (compFees?.enableFixedReturn ?? false)
        : settings.enableReturnShipping;
      if (applyReturnFee) {
        const returnFeeAmount = useCustom
          ? (compFees?.returnShippingFee ?? 0)
          : settings.returnShippingFee;
        if (returnFeeAmount > 0) {
          newTransactions.push({
            id: `revert_return_${orderToUpdate.id}`,
            type: "إيداع",
            amount: returnFeeAmount,
            date: new Date().toISOString(),
            note: `إعادة مصاريف مرتجع أوردر #${orderToUpdate.orderNumber} (تغيير الحالة إلى ${newStatus})`,
            category: "return",
            status: "completed",
            orderId: orderToUpdate.id,
            orderNumber: orderToUpdate.orderNumber,
          });
          updatedOrderData.returnFeeDeducted = false;
        }
      }
    }

    if (newStatus === "تم_توصيلها" && !updatedOrderData.collectionProcessed) {
      // Order delivered, now pending collection
      updatedOrderData.status = "تم_توصيلها" as OrderStatus;
      updatedOrderData.paymentStatus = "بانتظار الدفع";
    } else if (
      newStatus === "تم_التحصيل" &&
      !updatedOrderData.collectionProcessed
    ) {
      // Order payment processed
      const advancePayment = Number(updatedOrderData.advancePayment) || 0;
      const orderPrice = Number(updatedOrderData.productPrice) || 0;
      const orderShip = Number(updatedOrderData.shippingFee) || 0;
      const orderDisc = Number(updatedOrderData.discount) || 0;
      const orderTax = Number((updatedOrderData as any).tax) || 0;
      const orderInsp = (updatedOrderData.includeInspectionFee && (updatedOrderData.inspectionFeePaidByCustomer !== false)) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;

      const baseAmountToCollect =
        updatedOrderData.totalAmountOverride ??
        (orderPrice + orderShip + orderTax + orderInsp - orderDisc - advancePayment);

      newTransactions.push({
        id: `collect_${orderToUpdate.id}`,
        type: "إيداع",
        amount: baseAmountToCollect,
        date: new Date().toISOString(),
        note: `رصيد من الدفع عند الاستلام أوردر #${orderToUpdate.orderNumber}${advancePayment > 0 ? ` (بعد خصم عربون ${advancePayment} ج.م)` : ""}`,
        category: "collection",
        status: "completed",
        orderId: orderToUpdate.id,
        orderNumber: orderToUpdate.orderNumber,
      });

      updatedOrderData.collectionProcessed = true;
      updatedOrderData.paymentStatus = "مدفوع";
      updatedOrderData.status = "تم_التحصيل" as OrderStatus;
    } else {
      updatedOrderData.status = newStatus;
    }

    return { updatedOrderData, newTransactions };
  };

  const updateInventoryForOrder = (
    order: Order,
    newStatus: OrderStatus,
    currentProducts: Product[],
  ): { updatedProducts: Product[]; stockDeducted: boolean } => {
    const deductStatuses: OrderStatus[] = [
      "قيد_التنفيذ",
      "تم_الارسال",
      "قيد_الشحن",
      "تم_توصيلها",
      "تم_التحصيل",
      "مدفوعة",
      "مؤرشف",
    ];
    // All other statuses are considered "returnable" to stock if they were deducted
    const shouldBeDeducted = deductStatuses.includes(newStatus);
    const isCurrentlyDeducted = order.stockDeducted || false;
    let updatedProducts = [...currentProducts];
    let newStockDeducted = isCurrentlyDeducted;

    if (shouldBeDeducted && !isCurrentlyDeducted) {
      (order.items || []).forEach((orderItem) => {
        const pIdx = updatedProducts.findIndex(
          (p) => p.id === orderItem.productId,
        );
        if (pIdx > -1) {
          const prod = { ...updatedProducts[pIdx] };
          let newQty = Math.max(
            0,
            (prod.stockQuantity || 0) - orderItem.quantity,
          );

          // Deduct from warehouse stock
          let updatedWhStock = prod.warehouseStock
            ? { ...prod.warehouseStock }
            : {};
          const whId =
            order.warehouseId ||
            settings.warehouses?.find((w) => w.isDefault)?.id;

          if (whId) {
            updatedWhStock[whId] = Math.max(
              0,
              (updatedWhStock[whId] || 0) - orderItem.quantity,
            );
          }

          // Deduct variant stock if variantId is matched
          if (orderItem.variantId && prod.variants) {
            prod.variants = prod.variants.map((v) => {
              if (v.id === orderItem.variantId) {
                const vUpdated = { ...v };
                vUpdated.stockQuantity = Math.max(
                  0,
                  (vUpdated.stockQuantity || 0) - orderItem.quantity,
                );
                vUpdated.warehouseStock = vUpdated.warehouseStock
                  ? { ...vUpdated.warehouseStock }
                  : {};
                if (whId) {
                  vUpdated.warehouseStock[whId] = Math.max(
                    0,
                    (vUpdated.warehouseStock[whId] || 0) - orderItem.quantity,
                  );
                }
                return vUpdated;
              }
              return v;
            });
            newQty = prod.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
          } else {
            newQty = Math.max(0, (prod.stockQuantity || 0) - orderItem.quantity);
          }

          updatedProducts[pIdx] = {
            ...prod,
            stockQuantity: newQty,
            warehouseStock: updatedWhStock,
          };
        }
      });
      newStockDeducted = true;
    } else if (!shouldBeDeducted && isCurrentlyDeducted) {
      (order.items || []).forEach((orderItem) => {
        const pIdx = updatedProducts.findIndex(
          (p) => p.id === orderItem.productId,
        );
        if (pIdx > -1) {
          const prod = { ...updatedProducts[pIdx] };
          let newQty = (prod.stockQuantity || 0) + orderItem.quantity;

          // Return to warehouse stock
          let updatedWhStock = prod.warehouseStock
            ? { ...prod.warehouseStock }
            : {};
          const whId =
            order.warehouseId ||
            settings.warehouses?.find((w) => w.isDefault)?.id;

          if (whId) {
            updatedWhStock[whId] =
              (updatedWhStock[whId] || 0) + orderItem.quantity;
          }

          // Return variant stock if variantId is matched
          if (orderItem.variantId && prod.variants) {
            prod.variants = prod.variants.map((v) => {
              if (v.id === orderItem.variantId) {
                const vUpdated = { ...v };
                vUpdated.stockQuantity =
                  (vUpdated.stockQuantity || 0) + orderItem.quantity;
                vUpdated.warehouseStock = vUpdated.warehouseStock
                  ? { ...vUpdated.warehouseStock }
                  : {};
                if (whId) {
                  vUpdated.warehouseStock[whId] =
                    (vUpdated.warehouseStock[whId] || 0) + orderItem.quantity;
                }
                return vUpdated;
              }
              return v;
            });
            newQty = prod.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
          } else {
            newQty = (prod.stockQuantity || 0) + orderItem.quantity;
          }

          updatedProducts[pIdx] = {
            ...prod,
            stockQuantity: newQty,
            warehouseStock: updatedWhStock,
          };
        }
      });
      newStockDeducted = false;
    }

    return { updatedProducts, stockDeducted: newStockDeducted };
  };

  const updateOrderStatus = async (
    id: string,
    incomingStatus: OrderStatus,
    forcePaidFlexShip?: boolean,
  ) => {
    const newStatus =
      incomingStatus === "تم_التوصيل"
        ? ("تم_توصيلها" as OrderStatus)
        : incomingStatus;
    const orderToUpdate = orders.find((o) => o.id === id);
    if (!orderToUpdate) return;

    if (newStatus === "تم_الارسال" && !orderToUpdate.waybillNumber) {
      setOrderForWaybill({ orderId: id, newStatus: newStatus });
      return;
    }

    const compSpecificFees =
      settings.companySpecificFees?.[orderToUpdate.shippingCompany];
    const useCustomFees = compSpecificFees?.useCustomFees ?? false;
    const isFlexShipEnabled =
      orderToUpdate.enableFlexShip !== undefined
        ? orderToUpdate.enableFlexShip
        : useCustomFees
          ? (compSpecificFees?.enableFlexShip ?? false)
          : (settings.enableFlexShip ?? false);
    const configuredFlexShipFee =
      orderToUpdate.flexShipFee !== undefined
        ? orderToUpdate.flexShipFee
        : useCustomFees
          ? (compSpecificFees?.flexShipFee ?? 0)
          : (settings.flexShipFee ?? 0);

    let isFlexShipPaid = false;
    if (
      ["مرتجع", "فشل_التوصيل"].includes(newStatus) &&
      isFlexShipEnabled &&
      configuredFlexShipFee > 0 &&
      !orderToUpdate.flexShipFeePaidByCustomer &&
      forcePaidFlexShip === undefined
    ) {
      setPendingFlexShipConfirm({
        orderId: id,
        newStatus,
        fee: configuredFlexShipFee,
        companyName: orderToUpdate.shippingCompany || "",
        orderNumber: orderToUpdate.orderNumber,
      });
      return;
    }

    if (forcePaidFlexShip !== undefined) {
      isFlexShipPaid = forcePaidFlexShip;
    }

    const orderWithFlexShip = {
      ...orderToUpdate,
      ...(isFlexShipPaid
        ? {
            flexShipFeePaidByCustomer: true,
            flexShipFee:
              orderToUpdate.flexShipFee !== undefined
                ? orderToUpdate.flexShipFee
                : configuredFlexShipFee,
            flexShipCompanyFee:
              orderToUpdate.flexShipCompanyFee !== undefined
                ? orderToUpdate.flexShipCompanyFee
                : useCustomFees
                  ? (compSpecificFees?.flexShipCompanyFee ?? 0)
                  : (settings.flexShipCompanyFee ?? 0),
          }
        : {}),
    };

    // 1. Sync Inventory
    const { updatedProducts, stockDeducted } = updateInventoryForOrder(
      orderWithFlexShip,
      newStatus,
      settings.products,
    );
    if (stockDeducted !== orderToUpdate.stockDeducted) {
      setSettings((prev) => ({ ...prev, products: updatedProducts }));
    }

    // 2. Update State
    const { updatedOrderData: financialUpdatedOrder, newTransactions } =
      processFinancialsForStatusChange(orderWithFlexShip, newStatus);
    const updatedOrderData = { ...financialUpdatedOrder, stockDeducted };

    if (newTransactions.length > 0) {
      setWallet((prev) => {
        let newBalance = prev.balance || 0;
        newTransactions.forEach((t) => {
          if (t.type === "إيداع") newBalance += t.amount;
          else if (t.type === "سحب") newBalance -= t.amount;
        });
        return {
          ...prev,
          balance: newBalance,
          transactions: [...newTransactions, ...prev.transactions],
        };
      });
    }

    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === id ? updatedOrderData : o)),
    );
    addAuditLog(
      id,
      "تغيير الحالة",
      `تغيير حالة الطلب من ${orderToUpdate.status} إلى ${newStatus}`,
    );

    // Trigger WhatsApp notification prompt
    if (orderToUpdate.customerPhone && orderToUpdate.status !== newStatus) {
      setAutoWhatsappData({ order: updatedOrderData, newStatus });
    }

    // 3. Push to External Platform if Synced (Two-Way Sync)
    if (
      orderToUpdate.platform === "wuilt" ||
      orderToUpdate.source === "synced"
    ) {
      try {
        const res = await fetch(
          `/api/sync/platform/wuilt/${orderToUpdate.store_id}/push-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: id,
              newStatus: newStatus,
            }),
          },
        );
        const result = await res.json();
        if (!res.ok) console.error("Failed to push status to Wuilt:", result);
        else console.log("Wuilt Sync Push Triggered:", result);
      } catch (e) {
        console.error("Two-way sync fetch error:", e);
      }
    }
  };

  const handleSaveWaybill = (waybill: string) => {
    if (!orderForWaybill || !waybill.trim()) return;
    const { orderId, newStatus } = orderForWaybill;

    const orderToUpdate = orders.find((o) => o.id === orderId);
    if (!orderToUpdate) return;

    const orderWithWaybill = { ...orderToUpdate, waybillNumber: waybill };

    // Inventory Sync for Waybill update too
    const { updatedProducts, stockDeducted } = updateInventoryForOrder(
      orderWithWaybill,
      newStatus,
      settings.products,
    );
    if (stockDeducted !== orderToUpdate.stockDeducted) {
      setSettings((prev) => ({ ...prev, products: updatedProducts }));
    }

    const { updatedOrderData: financialUpdatedOrder, newTransactions } =
      processFinancialsForStatusChange(orderWithWaybill, newStatus);
    const updatedOrderData = { ...financialUpdatedOrder, stockDeducted };

    if (newTransactions.length > 0) {
      setWallet((prev) => {
        let newBalance = prev.balance || 0;
        newTransactions.forEach((t) => {
          if (t.type === "إيداع") newBalance += t.amount;
          else if (t.type === "سحب") newBalance -= t.amount;
        });
        return {
          ...prev,
          balance: newBalance,
          transactions: [...newTransactions, ...prev.transactions],
        };
      });
    }

    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === orderId ? updatedOrderData : o)),
    );

    setOrderForWaybill(null);
    addAuditLog(
      orderId,
      "إضافة بوليصة",
      `تم إضافة بوليصة رقم ${waybill} وتغيير الحالة إلى ${newStatus}`,
    );
  };

  const handleToggleFlexShipPaid = (orderId: string) => {
    const orderToUpdate = orders.find((o) => o.id === orderId);
    if (!orderToUpdate) return;

    const compFees =
      settings.companySpecificFees?.[orderToUpdate.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const flexShipFeeAmount =
      orderToUpdate.flexShipFee ??
      (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0));

    if (flexShipFeeAmount <= 0) return;

    const isCurrentlyPaid = !!orderToUpdate.flexShipFeePaidByCustomer;
    const isNowPaid = !isCurrentlyPaid;

    const newTransactions: Transaction[] = [];
    
    const flexShipCompanyFee =
        orderToUpdate.flexShipCompanyFee ??
        (useCustom
          ? (compFees?.flexShipCompanyFee ?? 0)
          : (settings.flexShipCompanyFee ?? 0));

    if (isNowPaid) {
      newTransactions.push({
        id: `flexship_${orderToUpdate.id}_${Date.now()}`,
        type: "إيداع",
        amount: flexShipFeeAmount,
        date: new Date().toISOString(),
        note: `تحصيل رسوم خدمة فليكس شيب أوردر #${orderToUpdate.orderNumber}`,
        category: "collection",
        status: "completed",
        orderId: orderToUpdate.id,
        orderNumber: orderToUpdate.orderNumber,
      });

      if (flexShipCompanyFee > 0) {
        newTransactions.push({
          id: `flexship_company_${orderToUpdate.id}_${Date.now()}`,
          type: "سحب",
          amount: flexShipCompanyFee,
          date: new Date().toISOString(),
          note: `خصم حصة شركة الشحن من خدمة فليكس شيب أوردر #${orderToUpdate.orderNumber}`,
          category: "expense_other",
          status: "completed",
          orderId: orderToUpdate.id,
          orderNumber: orderToUpdate.orderNumber,
        });
      }
    } else {
      newTransactions.push({
        id: `revert_flexship_${orderToUpdate.id}_${Date.now()}`,
        type: "سحب",
        amount: flexShipFeeAmount,
        date: new Date().toISOString(),
        note: `عكس تحصيل رسوم فليكس شيب أوردر #${orderToUpdate.orderNumber} (رفض الدفع / إلغاء)`,
        category: "collection",
        status: "completed",
        orderId: orderToUpdate.id,
        orderNumber: orderToUpdate.orderNumber,
      });
    }

    setWallet((prev) => {
      let newBalance = prev.balance || 0;
      newTransactions.forEach((t) => {
        if (t.type === "إيداع") newBalance += t.amount;
        else if (t.type === "سحب") newBalance -= t.amount;
      });
      return {
        ...prev,
        balance: newBalance,
        transactions: [...newTransactions, ...prev.transactions],
      };
    });

    const updatedOrderData = {
      ...orderToUpdate,
      flexShipFeePaidByCustomer: isNowPaid,
      flexShipFee: flexShipFeeAmount,
      flexShipCompanyFee: flexShipCompanyFee,
    };

    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === orderId ? updatedOrderData : o)),
    );
    addAuditLog(
      orderId,
      "تعديل رسوم الشحن",
      isNowPaid
        ? "تم تسجيل سداد رسوم فليكس شيب من العميل"
        : "تم تفريغ/إلغاء رسوم فليكس شيب بسبب رفض العميل الدفع",
    );
  };

  const handleCollectAction = (
    order: Order,
    customerPaidInspection: boolean,
  ) => {
    const isMaintenance =
      order.orderType === "maintenance" ||
      (order.status as string) === "سحب_للصيانة";
    if (
      (order.status !== "تم_توصيلها" && !isMaintenance) ||
      order.collectionProcessed
    )
      return;

    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const inspectionFee = useCustom
      ? compFees!.inspectionFee
      : settings.enableInspection
        ? settings.inspectionFee
        : 0;

    const newTransactions: Transaction[] = [];
    const basePrice = isMaintenance
      ? Number((order as any).maintenanceCost) || order.productPrice || 0
      : (Number(order.productPrice) || 0);

    const safeTax = Number((order as any).tax) || 0;
    const safeAdvance = Number(order.advancePayment) || 0;

    // Always use actual order shipping/discount for base collect amount if not overridden
    const baseAmountToCollect =
      order.totalAmountOverride ??
      basePrice + order.shippingFee + safeTax + (((order.inspectionFeePaidByCustomer !== false) && order.includeInspectionFee !== false) ? inspectionFee : 0) - (order.discount || 0) - safeAdvance;

    const txnNote = isMaintenance
      ? `رصيد من سداد أوردر صيانة #${order.orderNumber}`
      : `رصيد من الدفع عند الاستلام أوردر #${order.orderNumber}${safeAdvance > 0 ? ` (بعد خصم عربون ${safeAdvance} ج.م)` : ""}`;

    newTransactions.push({
      id: `collect_${order.id}`,
      type: "إيداع",
      amount: baseAmountToCollect,
      date: new Date().toISOString(),
      note: txnNote,
      category: "collection",
      status: "completed",
      orderId: order.id,
      orderNumber: order.orderNumber,
    });

    const codFee = calculateCodFee(order, settings);
    if (codFee > 0) {
      newTransactions.push({
        id: `cod_${order.id}`,
        type: "سحب",
        amount: codFee,
        date: new Date().toISOString(),
        note: `خصم رسوم COD أوردر #${order.orderNumber}`,
        category: "cod",
        status: "completed",
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }

    const updatedOrderData = {
      ...order,
      status: isMaintenance ? order.status : ("تم_التحصيل" as OrderStatus),
      paymentStatus: "مدفوع" as PaymentStatus,
      inspectionFeePaidByCustomer: customerPaidInspection,
      collectionProcessed: true,
    };

    setWallet((prev) => {
      let newBalance = prev.balance || 0;
      newTransactions.forEach((t) => {
        if (t.type === "إيداع") newBalance += t.amount;
        else if (t.type === "سحب") newBalance -= t.amount;
      });
      return {
        ...prev,
        balance: newBalance,
        transactions: [...newTransactions, ...prev.transactions],
      };
    });
    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === order.id ? updatedOrderData : o)),
    );
    addLoyaltyPointsForOrder(updatedOrderData);
  };

  const handlePaymentStatusChange = (
    order: Order,
    newPaymentStatus: PaymentStatus,
  ) => {
    const updatedOrder = { ...order, paymentStatus: newPaymentStatus };
    const isMaintenance =
      order.orderType === "maintenance" ||
      (order.status as string) === "سحب_للصيانة";

    if (
      newPaymentStatus === "مدفوع" &&
      (order.status === "تم_توصيلها" ||
        order.status === "تم_التوصيل" ||
        isMaintenance)
    ) {
      const compFees = settings.companySpecificFees?.[order.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const inspectionFee = useCustom
        ? (compFees?.inspectionFee ?? settings.inspectionFee)
        : settings.inspectionFee;

      if (order.includeInspectionFee && inspectionFee && inspectionFee > 0) {
        setPendingInspectionConfirm({
          order,
          newPaymentStatus,
          inspectionFee,
        });
      } else {
        handleCollectAction(updatedOrder, false);
      }
    } else {
      updateOrderField(order.id, "paymentStatus", newPaymentStatus);
    }
    addAuditLog(
      order.id,
      "تغيير حالة الدفع",
      `تغيير حالة الدفع إلى ${newPaymentStatus}`,
    );
  };

  const handlePostCollectionReturn = (order: Order) => {
    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;

    const shouldRefundProduct = useCustom
      ? (compFees.postCollectionReturnRefundsProductPrice ?? true)
      : true;
    const returnShippingFee =
      useCustom && compFees.enableFixedReturn
        ? compFees.returnShippingFee
        : settings.enableReturnShipping
          ? settings.returnShippingFee
          : 0;
    const inspectionFee = useCustom
      ? compFees.inspectionFee
      : settings.enableInspection
        ? settings.inspectionFee
        : 0;

    let confirmationMessage = `هل أنت متأكد من إرجاع الطلب #${order.orderNumber}؟\n`;
    const transactions: Transaction[] = [];

    if (shouldRefundProduct) {
      const returnAmount =
        order.totalAmountOverride ??
        order.productPrice + order.shippingFee - (order.discount || 0);

      let inspectionFeeMessage = "";
      if (order.inspectionFeePaidByCustomer !== false) {
        inspectionFeeMessage = `\nلن يتم إرجاع رسوم المعاينة (${inspectionFee} ج.م) لأنها غير قابلة للاسترداد.`;
      }

      confirmationMessage += `سيتم إرجاع مبلغ (${returnAmount.toLocaleString()} ج.م) للعميل وخصمه من المحفظة.${inspectionFeeMessage}`;
      transactions.push({
        id: `post_return_refund_${order.id}`,
        type: "سحب",
        amount: returnAmount,
        date: new Date().toISOString(),
        note: `إرجاع مبلغ للعميل بعد استلام الطلب #${order.orderNumber}`,
        category: "return",
        status: "completed",
      });
    } else {
      confirmationMessage += `لن يتم خصم قيمة المنتج من المحفظة حسب سياسة الشركة.`;
    }

    if (returnShippingFee > 0) {
      confirmationMessage += `\nسيتم خصم مصاريف شحن المرتجع (${returnShippingFee} ج.م).`;
      transactions.push({
        id: `post_return_fee_${order.id}`,
        type: "سحب",
        amount: returnShippingFee,
        date: new Date().toISOString(),
        note: `مصاريف شحن مرتجع بعد الاستلام للطلب #${order.orderNumber}`,
        category: "return",
        status: "completed",
      });
    }

    const confirmCollectionReturn = () => {
      confirmAction({
        title: "إرجاع بعد الاستلام",
        message: confirmationMessage,
        type: "warning",
        confirmText: "تأكيد الإرجاع",
        onConfirm: () => {
          if (transactions.length > 0) {
            setWallet((prev) => {
              let newBalance = prev.balance || 0;
              transactions.forEach((t) => {
                if (t.type === "إيداع") newBalance += t.amount;
                else if (t.type === "سحب") newBalance -= t.amount;
              });
              return {
                ...prev,
                balance: newBalance,
                transactions: [...transactions, ...prev.transactions],
              };
            });
          }

          // Return Stock
          const { updatedProducts, stockDeducted } = updateInventoryForOrder(
            order,
            "مرتجع_بعد_الاستلام" as OrderStatus,
            settings.products,
          );
          if (stockDeducted !== order.stockDeducted) {
            setSettings((prev) => ({ ...prev, products: updatedProducts }));
          }

          setOrders((prev) =>
            prev.map((o) =>
              o.id === order.id
                ? { ...o, status: "مرتجع_بعد_الاستلام", stockDeducted }
                : o,
            ),
          );
          setConfirmation((prev) => ({ ...prev, isOpen: false }));
          addAuditLog(
            order.id,
            "إرجاع بعد الاستلام",
            "تم إرجاع الطلب وإعادة المخزون",
          );
        },
      });
    };

    confirmCollectionReturn();
  };

  const handleStartExchange = (originalOrder: Order) => {
    const creditAmount =
      originalOrder.totalAmountOverride ??
      originalOrder.productPrice +
        originalOrder.shippingFee -
        (originalOrder.discount || 0);
    navigate("/orders/new", {
      state: {
        exchangeData: {
          customerName: originalOrder.customerName,
          customerPhone: originalOrder.customerPhone,
          customerAddress: originalOrder.customerAddress,
          shippingCompany: originalOrder.shippingCompany,
          shippingArea: originalOrder.shippingArea,
          orderType: "exchange",
          originalOrderId: originalOrder.id,
          creditAmount: creditAmount,
        },
      },
    });
  };

  const handlePrintInvoice = (order: Order) => {
    const html = generateInvoiceHTML(
      order,
      settings,
      activeStore?.name || "متجري",
    );
    printHTMLDirectly(html);
  };

  const handlePrintShippingLabel = (order: Order) => {
    if (!activeStore) {
      alert("لا يمكن طباعة البوليصة: اسم المتجر غير معروف.");
      return;
    }
    const html = generateShippingLabelHTML(order, activeStore.name, settings);
    printHTMLDirectly(html);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrders(paginatedOrders.map((o) => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((oId) => oId !== id) : [...prev, id],
    );
  };

  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: "danger" | "warning" | "info";
    confirmText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "info",
  });

  const confirmAction = (config: Omit<typeof confirmation, "isOpen">) => {
    setConfirmation({ ...config, isOpen: true });
  };

  const handleBulkDelete = () => {
    if (selectedOrders.length === 0) return;
    confirmAction({
      title: "حذف حماعي",
      message: `هل أنت متأكد من حذف ${selectedOrders.length} طلبات نهائياً؟ هذا الإجراء سيقوم بإزالة بياناتهم تماماً من النظام.`,
      type: "danger",
      confirmText: "حذف نهائي",
      onConfirm: () => {
        let updatedProducts = [...(settings.products || [])];
        let listChanged = false;
        let updatedPosSales = [...(settings.posSales || [])];
        let posSalesChanged = false;

        const ordersBeingDeleted = orders.filter((o) =>
          selectedOrders.includes(o.id),
        );

        ordersBeingDeleted.forEach((orderToDelete) => {
          const isPos =
            orderToDelete.channel === "pos" ||
            orderToDelete.id.startsWith("POS-") ||
            orderToDelete.shippingCompany === "كاشير - بيع مباشر";
          const isStockDeducted = orderToDelete.stockDeducted || isPos;

          if (isStockDeducted) {
            listChanged = true;
            (orderToDelete.items || []).forEach((orderItem) => {
              const pIdx = updatedProducts.findIndex(
                (p) => p.id === orderItem.productId,
              );
              if (pIdx > -1) {
                const prod = { ...updatedProducts[pIdx] };
                const newQty = (prod.stockQuantity || 0) + orderItem.quantity;

                // Return to warehouse stock
                let updatedWhStock = prod.warehouseStock
                  ? { ...prod.warehouseStock }
                  : {};
                const whId =
                  orderToDelete.warehouseId ||
                  settings.warehouses?.find((w) => w.isDefault)?.id;
                if (whId) {
                  updatedWhStock[whId] =
                    (updatedWhStock[whId] || 0) + orderItem.quantity;
                }

                // Return variant stock if variantId is matched
                if (orderItem.variantId && prod.variants) {
                  prod.variants = prod.variants.map((v) => {
                    if (v.id === orderItem.variantId) {
                      const vUpdated = { ...v };
                      vUpdated.stockQuantity =
                        (vUpdated.stockQuantity || 0) + orderItem.quantity;
                      vUpdated.warehouseStock = vUpdated.warehouseStock
                        ? { ...vUpdated.warehouseStock }
                        : {};
                      if (whId) {
                        vUpdated.warehouseStock[whId] =
                          (vUpdated.warehouseStock[whId] || 0) +
                          orderItem.quantity;
                      }
                      return vUpdated;
                    }
                    return v;
                  });
                }

                updatedProducts[pIdx] = {
                  ...prod,
                  stockQuantity: newQty,
                  warehouseStock: updatedWhStock,
                };
              }
            });
          }

          if (isPos) {
            const originalLength = updatedPosSales.length;
            updatedPosSales = updatedPosSales.filter(
              (sale) => sale.id !== orderToDelete.id,
            );
            if (updatedPosSales.length !== originalLength) {
              posSalesChanged = true;
            }
          }
        });

        // Keep partner transactions intact as per user request
        let updatedPartnerTransactions = [
          ...(settings.partnerTransactions || []),
        ];

        const matchHolderId = (id1?: string, id2?: string) => {
          if (!id1 || !id2) return false;
          if (String(id1) === String(id2)) return true;
          const c1 = String(id1).replace(/^(emp_|part_|treas_)/, '');
          const c2 = String(id2).replace(/^(emp_|part_|treas_)/, '');
          return c1 === c2 && c1 !== '';
        };

        let updatedCashHolders = [...(settings.cashHolders || [])];
        let updatedCashHandovers = [...(settings.cashHandovers || [])];

        ordersBeingDeleted.forEach((orderToDelete) => {
          const orderIdToDelete = orderToDelete.id;
          const orderNumberToDelete = orderToDelete.orderNumber;
          let handoversToRemove: any[] = [];
          updatedCashHandovers = updatedCashHandovers.filter((tx: any) => {
            const notes = tx.notes || "";
            const matchOrderNumber = orderNumberToDelete ? notes.includes(`#${orderNumberToDelete}`) || notes.includes(orderNumberToDelete) : false;
            const matchOrderId = orderIdToDelete ? notes.includes(orderIdToDelete) || tx.orderId === orderIdToDelete || tx.orderId === orderNumberToDelete : false;
            const isMatch = matchOrderNumber || matchOrderId;
            if (isMatch) handoversToRemove.push(tx);
            return !isMatch;
          });

          if (handoversToRemove.length > 0) {
            handoversToRemove.forEach((tx: any) => {
              if (tx.toUserId) {
                const toIdx = updatedCashHolders.findIndex((h: any) => matchHolderId(h.userId, tx.toUserId));
                if (toIdx > -1) {
                  updatedCashHolders[toIdx] = { ...updatedCashHolders[toIdx], currentBalance: Math.max(0, (updatedCashHolders[toIdx].currentBalance || 0) - tx.amount), lastUpdated: new Date().toISOString() };
                }
              }
              if (tx.fromUserId && tx.fromUserId !== 'system' && tx.fromUserId !== 'customer') {
                const fromIdx = updatedCashHolders.findIndex((h: any) => matchHolderId(h.userId, tx.fromUserId));
                if (fromIdx > -1) {
                  updatedCashHolders[fromIdx] = { ...updatedCashHolders[fromIdx], currentBalance: (updatedCashHolders[fromIdx].currentBalance || 0) + tx.amount, lastUpdated: new Date().toISOString() };
                }
              }
            });
          } else if (orderToDelete.cashHolderId && orderToDelete.cashHolderId !== 'credit' && orderToDelete.cashHolderId !== 'wallet') {
            const deductAmount = Number(orderToDelete.totalPrice || (orderToDelete as any).totalAmount || orderToDelete.advancePayment || 0);
            if (deductAmount > 0) {
              const hIdx = updatedCashHolders.findIndex((h: any) => matchHolderId(h.userId, orderToDelete.cashHolderId));
              if (hIdx > -1) {
                updatedCashHolders[hIdx] = { ...updatedCashHolders[hIdx], currentBalance: Math.max(0, (updatedCashHolders[hIdx].currentBalance || 0) - deductAmount), lastUpdated: new Date().toISOString() };
              }
            }
          }
        });

        setSettings((prev) => ({
          ...prev,
          products: updatedProducts,
          posSales: updatedPosSales,
          partnerTransactions: updatedPartnerTransactions,
          cashHolders: updatedCashHolders,
          cashHandovers: updatedCashHandovers,
        }));

        // Cascade delete from Wallet
        setWallet((prevWallet) => {
          const currentTransactions = prevWallet.transactions || [];
          const updatedTransactions = currentTransactions.filter((t) => {
            const note = t.note || "";
            const id = t.id || "";

            const isRelated = ordersBeingDeleted.some((orderToDelete) => {
              const orderIdToDelete = orderToDelete.id;
              const orderNumberToDelete = orderToDelete.orderNumber;
              const relatedByNote = orderNumberToDelete
                ? note.includes(`#${orderNumberToDelete}`)
                : false;
              const relatedByField = t.orderId === orderIdToDelete;
              const relatedById = id.endsWith(`_${orderIdToDelete}`);
              return relatedByNote || relatedByField || relatedById;
            });

            return !isRelated;
          });
          return {
            ...prevWallet,
            transactions: updatedTransactions,
          };
        });

        // Cascade delete from Treasury
        if (setTreasury && treasury) {
          setTreasury((prev: any) => {
            if (!prev) return prev;
            let txs = [...(prev.transactions || [])];
            ordersBeingDeleted.forEach((orderToDelete) => {
              const orderIdToDelete = orderToDelete.id;
              const orderNumberToDelete = orderToDelete.orderNumber;
              txs = txs.filter((tx: any) => {
                const desc = tx.description || "";
                const ref = tx.reference || "";
                const matchOrderNumber = orderNumberToDelete
                  ? desc.includes(`#${orderNumberToDelete}`) ||
                    ref.includes(orderNumberToDelete)
                  : false;
                const matchOrderId = orderIdToDelete
                  ? desc.includes(orderIdToDelete) ||
                    ref.includes(orderIdToDelete)
                  : false;
                return !(matchOrderNumber || matchOrderId);
              });
            });
            return {
              ...prev,
              transactions: txs,
            };
          });
        }

        setOrders((prevOrders) =>
          prevOrders.filter((o) => !selectedOrders.includes(o.id)),
        );
        setSelectedOrders([]);
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleBulkStatusChange = (newStatus: string) => {
    const selectElement = document.getElementById(
      "bulk-status-select",
    ) as HTMLSelectElement;
    if (!newStatus || newStatus === "default") {
      if (selectElement) selectElement.value = "default";
      return;
    }

    confirmAction({
      title: "تغيير الحالة جماعياً",
      message: `هل أنت متأكد من تغيير حالة ${selectedOrders.length} طلبات إلى "${newStatus.replace(/_/g, " ")}"?`,
      type: "warning",
      confirmText: "تأكيد التغيير",
      onConfirm: () => {
        const allNewTransactions: Transaction[] = [];
        let currentProducts = [...settings.products];
        const updatedOrders = orders.map((o) => {
          if (selectedOrders.includes(o.id)) {
            // 1. Inventory Sync
            const { updatedProducts: nextProducts, stockDeducted } =
              updateInventoryForOrder(
                o,
                newStatus as OrderStatus,
                currentProducts,
              );
            currentProducts = nextProducts;

            // 2. Create a copy to avoid side effects during financial processing
            let orderToUpdate: Order = {
              ...o,
              status: newStatus as OrderStatus,
              stockDeducted,
            };

            // 3. Add Audit Log
            const newLog: AuditLog = {
              id: `log_bulk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              action: "تغيير الحالة (جماعي)",
              details: `تم تغيير حالة الطلب من ${o.status.replace(/_/g, " ")} إلى ${newStatus.replace(/_/g, " ")} خلال عملية تحديث جماعية`,
              timestamp: new Date().toISOString(),
              userEmail: currentUser?.email || "موظف",
            };
            orderToUpdate.auditLogs = [...(o.auditLogs || []), newLog];

            // Financial logic consolidated from processFinancialsForStatusChange
            const { updatedOrderData, newTransactions } =
              processFinancialsForStatusChange(
                orderToUpdate,
                newStatus as OrderStatus,
              );
            orderToUpdate = updatedOrderData;
            allNewTransactions.push(...newTransactions);

            return orderToUpdate;
          }
          return o;
        });

        // Update Both states once
        if (allNewTransactions.length > 0) {
          setWallet((prev) => {
            let newBalance = prev.balance || 0;
            allNewTransactions.forEach((t) => {
              if (t.type === "إيداع") newBalance += t.amount;
              else if (t.type === "سحب") newBalance -= t.amount;
            });
            return {
              ...prev,
              balance: newBalance,
              transactions: [...allNewTransactions, ...prev.transactions],
            };
          });
        }
        setSettings((prev) => ({ ...prev, products: currentProducts }));
        setOrders(updatedOrders);

        setSelectedOrders([]);
        if (selectElement) selectElement.value = "default";
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleBulkPrintLabels = () => {
    const selected = orders.filter((o) => selectedOrders.includes(o.id));
    if (selected.length === 0) return;

    const html = selected
      .map((o) => generateShippingLabelHTML(o, activeStore?.name || "متجري", settings))
      .join('<div style="page-break-after: always;"></div>');
    printHTMLDirectly(
      `<html><head><title>طباعة بوالص</title></head><body>${html}</body></html>`,
    );
  };

  const handleExportCSV = () => {
    const headers = [
      "رقم الطلب",
      "رقم البوليصة",
      "العميل",
      "الهاتف",
      "المحافظة",
      "المدينة",
      "المنتجات",
      "الإجمالي",
      "الحالة",
      "التاريخ",
    ];
    const rows = filteredOrders.map((o) => {
      const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'));
      const compFees = settings?.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const inspectionFeeParams = !isPosOrder && (o.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? settings.inspectionFee : 0)) : 0;
      const computedTotal = (Number(o.productPrice) || 0) + (Number(o.shippingFee) || 0) - (Number(o.discount) || 0) - (Number(o.advancePayment) || 0) + inspectionFeeParams;
      const amountToCollect = o.totalAmountOverride != null ? Math.max(0, Math.round(Number(o.totalAmountOverride))) : computedTotal;
      const displayTotal = o.source === 'synced' && o.totalPrice != null ? Number(o.totalPrice) + inspectionFeeParams : amountToCollect;

      return [
        o.orderNumber,
        o.waybillNumber || "-",
        o.customerName,
        o.customerPhone,
        o.governorate || o.shippingArea,
        o.city || "-",
        o.items.map((i) => `${i.name} (x${i.quantity})`).join(" | "),
        displayTotal,
        o.status,
        new Date(o.date).toLocaleDateString("ar-EG"),
      ];
    });
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      headers.join(",") +
      "\n" +
      rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `orders_export_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportOrders = () => {
    const storeName = activeStore?.name || "متجري";
    setReportIsContinuous(false);
    setReportOrientation("landscape");
    const html = generateOrdersReportHTML(filteredOrders, settings, storeName, undefined, false, "landscape");
    setReportPreviewHtml(html);
  };

  const handleExportPDF = () => {
    const storeName = activeStore?.name || "متجري";
    setReportIsContinuous(false);
    setReportOrientation("landscape");
    const html = generateOrdersReportHTML(filteredOrders, settings, storeName, undefined, false, "landscape");
    setReportPreviewHtml(html);
  };

  const handleAutoAssign = () => {
    const activeEmployees =
      settings.employees?.filter((e) => e.status === "active" || !e.status) ||
      [];
    if (activeEmployees.length === 0) {
      confirmAction({
        title: "تنبيه",
        message:
          "لا يوجد موظفين نشطين متاحين للتوزيع. يرجى تفعيل موظف واحد على الأقل في الإعدادات.",
        type: "warning",
        onConfirm: () => {},
      });
      return;
    }
    const unassignedOrders = orders.filter(
      (o) => !o.assignedTo && o.status === "في_انتظار_المكالمة",
    );
    if (unassignedOrders.length === 0) {
      confirmAction({
        title: "تنبيه",
        message: "لا توجد طلبات غير معينة في حالة انتظار المكالمة لتوزيعها.",
        type: "info",
        onConfirm: () => {},
      });
      return;
    }

    confirmAction({
      title: "توزيع الطلبات تلقائياً",
      message: `سيتم توزيع ${unassignedOrders.length} طلب على ${activeEmployees.length} موظف دليفري/اتصالات نشطين بالتساوي. هل تريد الاستمرار بالفعل؟`,
      type: "info",
      confirmText: "تأكيد وتوزيع الآن",
      onConfirm: () => {
        let empIndex = 0;
        setOrders((prev) =>
          prev.map((o) => {
            if (!o.assignedTo && o.status === "في_انتظار_المكالمة") {
              const emp = activeEmployees[empIndex];
              empIndex = (empIndex + 1) % activeEmployees.length;
              return {
                ...o,
                assignedTo: emp.phone || emp.id,
                assignedToName: emp.name,
              };
            }
            return o;
          }),
        );
      },
    });
  };

  const getWhatsAppLink = (order: Order) => {
    let msg = "";
    const name = (order.customerName || "").split(" ")[0];
    switch (order.status) {
      case "جاري_المراجعة":
        msg = `أهلاً بك يا ${name} 👋، بنأكد مع حضرتك طلبك (${order.productName}) من متجرنا. العنوان: ${order.customerAddress}. هل البيانات صحيحة؟`;
        break;
      case "قيد_التنفيذ":
        msg = `يا ${name}، طلبك قيد التجهيز حالياً وهيسلم لشركة الشحن قريباً.`;
        break;
      case "تم_الارسال":
        msg = `مرحباً ${name}، تم شحن طلبك ورقم البوليصة هو ${order.waybillNumber || order.orderNumber}.`;
        break;
      case "فشل_التوصيل":
        msg = `يا ${name}، المندوب حاول يوصلك النهاردة وماعرفش. ياريت ترد عليه أو تأكد معانا ميعاد تاني.`;
        break;
      default:
        msg = `أهلاً ${name}، بخصوص طلبك رقم ${order.orderNumber}...`;
    }
    let phone = (order.customerPhone || "").replace(/\D/g, "");
    if (phone.startsWith("0")) {
      phone = "20" + phone.substring(1);
    } else if (phone.length === 10 && !phone.startsWith("0")) {
      phone = "20" + phone;
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const quickStats = useMemo(() => {
    const nonArchivedOrders = orders.filter((o) => o.status !== "مؤرشف");
    return {
      allActive: nonArchivedOrders.length,
      processingGroup: nonArchivedOrders.filter((o) =>
        ["في_انتظار_المكالمة", "جاري_المراجعة", "قيد_التنفيذ"].includes(o.status)
      ).length,
      awaitingWaybill: nonArchivedOrders.filter(
        (o) => o.status === "جاري_المراجعة",
      ).length,
      onTheWay: nonArchivedOrders.filter((o) => o.status === "تم_الارسال")
        .length,
      delivered: nonArchivedOrders.filter((o) => o.status === "تم_التحصيل")
        .length,
      failed: nonArchivedOrders.filter((o) =>
        ["مرتجع", "فشل_التوصيل"].includes(o.status),
      ).length,
      canceled: orders.filter((o) => ["ملغي", "مؤرشف"].includes(o.status)).length,
    };
  }, [orders]);

  const orderForModal = useMemo(() => {
    if (!orderForWaybill) return null;
    return orders.find((o) => o.id === orderForWaybill.orderId);
  }, [orderForWaybill, orders]);

  return (
    <motion.div
      className="space-y-8 pb-20"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header & Main Actions */}
      <div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800"
        dir="rtl"
      >
        <div className="flex items-center justify-between w-full lg:w-auto shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                نظام الطلبات واللوجستيات المركزي
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                إدارة الطلبات وسجل المبيعات
              </h1>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleManualRefresh}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm cursor-pointer ${isRefreshing ? "animate-spin text-indigo-600 border-indigo-200" : ""}`}
                title="مزامنة الطلبات"
              >
                <RefreshCcw size={18} />
                <span className="text-xs font-black uppercase tracking-tight">
                  مزامنة سحابية
                </span>
              </motion.button>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
              نظام موحد ومبسط لمتابعة الشحنات، معالجة وتجهيز الأوردرات، وتحليل مبيعات وأرباح المتجر بكل سهولة
            </p>
            <div className="flex items-center gap-3 mt-2">
              <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black border border-indigo-100 dark:border-indigo-900/30">
                {filteredOrders.length} طلب مطابق للفلتر
              </div>
              <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black border border-emerald-100 dark:border-emerald-900/30">
                المتجر النشط: {activeStore?.id}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowStatusGuide(true)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 transition-all font-bold text-xs"
              title="شرح مبسط لحالات الطلبات"
            >
              <Info size={18} />
              <span>💡 دليل استخدام الحالات</span>
            </button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`${storePrefix}/orders/new`)}
              className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black shadow-xl shadow-indigo-500/25 transition-all flex items-center gap-2 text-sm shrink-0"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">طلب جديد</span>
            </motion.button>
          </div>
        </div>
      </div>

        {/* Main Section Switcher: Operational Orders vs Sales Analytics */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-xl p-2 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 w-full sm:w-auto">
            <button
              onClick={() => { setMainSection('orders'); setShowAnalyticsHub(false); }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-black text-sm transition-all whitespace-nowrap ${
                mainSection === 'orders'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <ShoppingCart size={18} />
              <span>📦 سجل الطلبات ومتابعة الشحنات</span>
            </button>
            <button
              onClick={() => { setMainSection('analytics'); setShowAnalyticsHub(true); }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-black text-sm transition-all whitespace-nowrap ${
                mainSection === 'analytics'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <TrendingUp size={18} />
              <span>📊 تحليلات ومؤشرات المبيعات والأرباح</span>
            </button>
          </div>

          {mainSection === 'orders' && (
            <div className="flex items-center justify-end gap-2 px-2">
              <span className="text-xs font-bold text-slate-400">طريقة العرض:</span>
              <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {[
                  { id: "list", icon: LayoutList, title: "عرض جدول" },
                  { id: "kanban", icon: LayoutGrid, title: "عرض كانبان" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as any)}
                    className={`p-2 rounded-lg transition-all ${viewMode === mode.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
                    title={mode.title}
                  >
                    <mode.icon size={18} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status Guide Modal */}
        <AnimatePresence>
          {showStatusGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowStatusGuide(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-y-auto text-right space-y-4"
                dir="rtl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                      <Info size={20} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">💡 دليل استخدام حالات الطلبات والمبيعات</h3>
                  </div>
                  <button onClick={() => setShowStatusGuide(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  هذا الدليل يساعدك على فهم دورة حياة الطلب داخل المتجر لتسهيل العمل والتعامل مع الشحنات:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl">
                    <div className="font-black text-amber-800 dark:text-amber-300 mb-1">📞 في انتظار المكالمة</div>
                    <div className="text-slate-600 dark:text-slate-400">العميل قام بتسجيل الطلب حديثاً ولم يتم التواصل معه بعد لتأكيد العنوان والبيانات.</div>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/30 rounded-2xl">
                    <div className="font-black text-indigo-800 dark:text-indigo-300 mb-1">🔍 جاري المراجعة</div>
                    <div className="text-slate-600 dark:text-slate-400">تم تأكيد البيانات مع العميل، والطلب جاهز لطباعة بوليصة الشحن وتجهيزه في المخزن.</div>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 rounded-2xl">
                    <div className="font-black text-purple-800 dark:text-purple-300 mb-1">📦 قيد التنفيذ (تغليف)</div>
                    <div className="text-slate-600 dark:text-slate-400">الشحنة يتم تغليفها حالياً وبانتظار تسليمها لمندوب شركة الشحن.</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 rounded-2xl">
                    <div className="font-black text-blue-800 dark:text-blue-300 mb-1">🚚 تم الارسال (قيد الشحن)</div>
                    <div className="text-slate-600 dark:text-slate-400">الشحنة خرجت مع المندوب وفي طريقها للتسليم النهائي للعميل.</div>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl">
                    <div className="font-black text-emerald-800 dark:text-emerald-300 mb-1">✅ تم التحصيل (ناجح)</div>
                    <div className="text-slate-600 dark:text-slate-400">تم تسليم الشحنة للعميل بنجاح واستلام المبلغ المحصل (إيراد مؤكد).</div>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl">
                    <div className="font-black text-rose-800 dark:text-rose-300 mb-1">↩️ مرتجع / فشل التوصيل</div>
                    <div className="text-slate-600 dark:text-slate-400">تعذر تسليم الشحنة (إلغاء، رفض، أو عدم رد) وتم إرجاعها إلى المخزون.</div>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <button onClick={() => setShowStatusGuide(false)} className="px-6 py-2 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-all">
                    فهمت، إغلاق الدليل
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* 6 Operational Category Cards (Rendered when mainSection === 'orders') */}
      {mainSection === 'orders' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {[
              { id: "الجميع", label: "كل الطلبات النشطة", subtitle: "جميع الأوردرات الحالية", count: quickStats.allActive, color: "indigo", icon: LayoutList },
              { id: "processing_group", label: "قيد المراجعة والتجهيز", subtitle: "بانتظار التأكيد أو التغليف", count: quickStats.processingGroup, color: "amber", icon: FileSearch },
              { id: "transit_group", label: "جاري الشحن والتوصيل", subtitle: "مع مندوب التوصيل بالطريق", count: quickStats.onTheWay, color: "blue", icon: Truck },
              { id: "delivered_group", label: "تم التوصيل والتحصيل", subtitle: "شحنات ناجحة ومحصلة", count: quickStats.delivered, color: "emerald", icon: CheckCircle },
              { id: "failed_group", label: "مرتجع وفشل التوصيل", subtitle: "تعذر التسليم أو مرتجع", count: quickStats.failed, color: "rose", icon: XCircle },
              { id: "canceled_group", label: "ملغي ومؤرشف", subtitle: "طلبات ملغاة أو مؤرشفة", count: quickStats.canceled, color: "slate", icon: Trash2 },
            ].map((cat) => {
              const isSelected = activeTab === cat.id || (
                cat.id === "processing_group" && ["في_انتظار_المكالمة", "جاري_المراجعة", "قيد_التنفيذ"].includes(activeTab)
              ) || (
                cat.id === "failed_group" && ["مرتجع", "فشل_التوصيل"].includes(activeTab)
              ) || (
                cat.id === "canceled_group" && ["ملغي", "مؤرشف"].includes(activeTab)
              ) || (
                cat.id === "transit_group" && activeTab === "تم_الارسال"
              ) || (
                cat.id === "delivered_group" && activeTab === "تم_التحصيل"
              );

              const borderBg = {
                indigo: "border-indigo-500/60 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20",
                amber: "border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20",
                blue: "border-blue-500/60 bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20",
                emerald: "border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20",
                rose: "border-rose-500/60 bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20",
                slate: "border-slate-500/60 bg-slate-50/80 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 ring-2 ring-slate-500/20",
              }[cat.color];

              const iconBg = {
                indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
                amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
              }[cat.color];

              return (
                <div
                  key={cat.id}
                  onClick={() => setActiveTab(isSelected && cat.id === activeTab ? "الجميع" : cat.id)}
                  className={`cursor-pointer select-none active:scale-95 p-4 rounded-3xl border transition-all duration-300 flex flex-col justify-between relative overflow-hidden ${
                    isSelected
                      ? `${borderBg} shadow-md`
                      : "bg-white/80 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2.5 rounded-2xl ${iconBg}`}>
                      <cat.icon size={18} />
                    </div>
                    <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                      {cat.count}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 mb-0.5">
                      {cat.label}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 line-clamp-1">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sub-filter drilldown bars */}
          {(activeTab === "processing_group" || ["في_انتظار_المكالمة", "جاري_المراجعة", "قيد_التنفيذ"].includes(activeTab)) && (
            <div className="flex items-center gap-2 p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl overflow-x-auto no-scrollbar text-xs">
              <span className="font-black text-amber-800 dark:text-amber-300 whitespace-nowrap px-2 flex items-center gap-1.5">
                <FileSearch size={14} /> تحديد فرعي داخل قسم التجهيز:
              </span>
              {[
                { id: "processing_group", label: "⭐ كل طلبات التجهيز" },
                { id: "في_انتظار_المكالمة", label: "📞 في انتظار المكالمة" },
                { id: "جاري_المراجعة", label: "🔍 جاري المراجعة (تأكيد)" },
                { id: "قيد_التنفيذ", label: "📦 قيد التنفيذ (تغليف)" },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveTab(sub.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                    activeTab === sub.id ? "bg-amber-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200/60 dark:border-amber-800/40"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {(activeTab === "failed_group" || ["مرتجع", "فشل_التوصيل"].includes(activeTab)) && (
            <div className="flex items-center gap-2 p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 rounded-2xl overflow-x-auto no-scrollbar text-xs">
              <span className="font-black text-rose-800 dark:text-rose-300 whitespace-nowrap px-2 flex items-center gap-1.5">
                <XCircle size={14} /> تحديد فرعي للرفض والفشل:
              </span>
              {[
                { id: "failed_group", label: "⭐ كل المرتجعات والفشل" },
                { id: "مرتجع", label: "↩️ مرتجع إلى المخزن" },
                { id: "فشل_التوصيل", label: "❌ فشل التوصيل مع المندوب" },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveTab(sub.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                    activeTab === sub.id ? "bg-rose-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/60 dark:border-rose-800/40"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {(activeTab === "canceled_group" || ["ملغي", "مؤرشف"].includes(activeTab)) && (
            <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-x-auto no-scrollbar text-xs">
              <span className="font-black text-slate-700 dark:text-slate-300 whitespace-nowrap px-2 flex items-center gap-1.5">
                <Trash2 size={14} /> تحديد فرعي للملغي والمؤرشف:
              </span>
              {[
                { id: "canceled_group", label: "⭐ الكل" },
                { id: "ملغي", label: "🗑️ طلبات ملغاة" },
                { id: "مؤرشف", label: "🗄️ طلبات مؤرشفة" },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveTab(sub.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                    activeTab === sub.id ? "bg-slate-700 text-white shadow-sm" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sales Analytics Dashboard (Rendered when mainSection === 'analytics') */}
      {mainSection === 'analytics' && (
        <div className="w-full mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/50 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none space-y-6 text-right relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-24 -mb-24"></div>

                <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800/60 pb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-full uppercase tracking-wider">
                      حي ومباشر
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 flex-row-reverse">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                      <Calculator
                        className="text-indigo-600 dark:text-indigo-400"
                        size={18}
                      />
                    </div>
                    لوحة التحليلات المتقدمة
                  </h4>
                </div>

                {/* Advanced Analytics Sub-Tabs Dashboard Selector */}
                <div className="flex flex-row-reverse items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-slate-200/40 dark:border-slate-800/40 pb-3 relative z-10 text-xs">
                  {[
                    { id: "summary", name: "الملخص المالي", icon: Calculator },
                    {
                      id: "chart",
                      name: "أداء المبيعات والربح",
                      icon: TrendingUp,
                    },
                    { id: "govs", name: "المحافظات الساخنة", icon: MapPin },
                    {
                      id: "products",
                      name: "المنتجات الرائجة",
                      icon: ShoppingBag,
                    },
                    { id: "carriers", name: "شركات الشحن", icon: Truck },
                  ].map((tab) => {
                    const IconComp = tab.icon;
                    const isActive = analyticsTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setAnalyticsTab(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl transition-all whitespace-nowrap font-bold flex-row-reverse border select-none ${
                          isActive
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25"
                            : "bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-350 border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <IconComp size={13} />
                        <span>{tab.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: SUMMARY TAB */}
                {analyticsTab === "summary" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Smart AI Insights Panel */}
                    <div className="bg-indigo-600/5 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 p-5 rounded-3xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                        <Sparkles size={40} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="relative z-10">
                        <h5 className="text-sm font-black text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-2 flex-row-reverse">
                          <Brain size={16} />
                          رؤى ذكية من النظام
                        </h5>
                        <div className="space-y-2 text-right">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                            {filteredMetrics.returnRate > 15 ? (
                              <span className="flex items-center gap-1.5 flex-row-reverse text-rose-600 dark:text-rose-400">
                                <AlertTriangle size={12} />
                                تنبيه: معدل المرتجعات ({filteredMetrics.returnRate.toFixed(1)}%) يتجاوز المتوسط الآمن. ننصح بتحسين وصف المنتجات أو التواصل مع العملاء قبل الشحن.
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 flex-row-reverse text-emerald-600 dark:text-emerald-400">
                                <CheckCircle size={12} />
                                أداء ممتاز: معدل المرتجعات مستقر وضمن الحدود الطبيعية.
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            استناداً إلى <span className="font-black text-slate-700 dark:text-white">{filteredMetrics.totalCount}</span> طلب مفلتر، 
                            تم شحن <span className="font-black text-indigo-600 dark:text-indigo-400">{filteredMetrics.shippedCount}</span> طلب، 
                            بينما <span className="font-black text-amber-600 dark:text-amber-400">{filteredMetrics.pendingConfirmationCount}</span> في انتظار التأكيد.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics Funnel */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                      {[
                        { label: "إجمالي الطلبات", value: filteredMetrics.totalCount, color: "slate", icon: Hash },
                        { label: "تم التأكيد", value: filteredMetrics.confirmedCount, color: "blue", icon: CheckCircle2 },
                        { label: "قيد الشحن", value: filteredMetrics.shippedCount, color: "indigo", icon: Truck },
                        { label: "تم التوصيل", value: filteredMetrics.successCount, color: "emerald", icon: PackageCheck }
                      ].map((step, idx) => (
                        <div key={idx} className="bg-white/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center group hover:scale-[1.02] transition-all">
                          <div className={`p-2 rounded-xl bg-${step.color}-50 dark:bg-${step.color}-500/10 text-${step.color}-600 dark:text-${step.color}-400 mb-2`}>
                            <step.icon size={18} />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">{step.label}</span>
                          <span className={`text-xl font-black text-${step.color}-600 dark:text-${step.color}-400 tabular-nums`}>
                            {step.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-right relative z-10">
                      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-5 rounded-3xl border border-slate-100/50 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-3 flex-row-reverse">
                          <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                            <ShoppingBag size={18} />
                          </div>
                          <p className="text-[11px] text-slate-400 font-bold tracking-wide">
                            إجمالي المبيعات المفلترة
                          </p>
                        </div>
                        <p className="text-2xl font-black text-slate-800 dark:text-white tabular-nums tracking-tight">
                          {filteredMetrics.salesTotal.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            },
                          )}{" "}
                          <span className="text-sm font-bold text-slate-400">
                            ج.م
                          </span>
                        </p>
                      </div>

                      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-5 rounded-3xl border border-slate-100/50 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-3 flex-row-reverse">
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <Receipt size={18} />
                          </div>
                          <p className="text-[11px] text-slate-400 font-bold tracking-wide">
                            المطلوب تحصيله
                          </p>
                        </div>
                        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums tracking-tight">
                          {filteredMetrics.expectedCollection.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            },
                          )}{" "}
                          <span className="text-sm font-bold text-indigo-400/50">
                            ج.م
                          </span>
                        </p>
                      </div>

                      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-5 rounded-3xl border border-slate-100/50 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-3 flex-row-reverse">
                          <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
                            <Truck size={18} />
                          </div>
                          <p className="text-[11px] text-slate-400 font-bold tracking-wide">
                            تكاليف الشحن المقدرة
                          </p>
                        </div>
                        <p className="text-2xl font-black text-slate-700 dark:text-slate-200 tabular-nums tracking-tight">
                          {filteredMetrics.shippingExpenses.toLocaleString(
                            undefined,
                            { maximumFractionDigits: 2 },
                          )}{" "}
                          <span className="text-sm font-bold text-slate-400">
                            ج.م
                          </span>
                        </p>
                      </div>

                      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-5 rounded-3xl border border-slate-100/50 dark:border-slate-800/50 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                        <div
                          className={`absolute inset-0 opacity-10 ${filteredMetrics.netProfitTotal >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                        ></div>
                        <div className="flex items-center justify-between mb-3 flex-row-reverse relative z-10">
                          <div
                            className={`p-2 rounded-xl ${filteredMetrics.netProfitTotal >= 0 ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-500/20 text-rose-650 dark:text-rose-400"}`}
                          >
                            {filteredMetrics.netProfitTotal >= 0 ? (
                              <TrendingUp size={18} />
                            ) : (
                              <TrendingDown size={18} />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-bold tracking-wide">
                            الصافي الربحي
                          </p>
                        </div>
                        <p
                          className={`text-2xl font-black tabular-nums tracking-tight relative z-10 ${filteredMetrics.netProfitTotal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}
                        >
                          {filteredMetrics.netProfitTotal.toLocaleString(
                            undefined,
                            { maximumFractionDigits: 2 },
                          )}{" "}
                          <span className="text-sm font-bold opacity-50">
                            ج.م
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 relative z-10">
                      <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-md p-4 rounded-2xl flex justify-between items-center flex-row-reverse">
                        <span className="font-bold flex items-center gap-1.5 flex-row-reverse">
                          <Percent size={14} className="text-rose-500" />
                          معدل مرتجعات المفلتر (الفعلية)
                        </span>
                        <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                          {filteredMetrics.returnRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900/80 p-3 px-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center flex-row-reverse text-slate-600 dark:text-slate-350">
                        <span className="font-bold flex items-center gap-1.5 flex-row-reverse">
                          <Briefcase size={14} className="text-slate-400" />
                          إجمالي تكلفة البضائع المعروضة
                        </span>
                        <span className="font-black text-slate-700 dark:text-slate-300 tabular-nums">
                          {filteredMetrics.productCostTotal.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            },
                          )}{" "}
                          ج.م
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: CHART TIMELINE TAB */}
                {analyticsTab === "chart" && (
                  <div className="space-y-4 relative z-10 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 text-right">
                    <div className="flex justify-between items-center flex-row-reverse">
                      <div>
                        <h5 className="text-sm font-black text-slate-800 dark:text-white">
                          منحنى المبيعات وصافي الأرباح اليومي
                        </h5>
                        <p className="text-[10px] text-slate-400">
                          آخر 15 يوماً من سجل المبيعات المفلترة
                        </p>
                      </div>
                    </div>
                    {dailyTrendData.length === 0 ? (
                      <div className="p-12 text-center bg-white/40 dark:bg-slate-800/25 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-450 font-bold">
                        لا توجد بيانات كافية لعرض المخطط البياني في النطاق
                        الحالي. يرجى تعديل تاريخ التصفية أو اختيار نطاق أوسع.
                      </div>
                    ) : (
                      <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm">
                        <div className="h-64 sm:h-80 w-full" dir="ltr">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={dailyTrendData}
                              margin={{
                                top: 10,
                                right: 10,
                                left: -20,
                                bottom: 0,
                              }}
                            >
                              <defs>
                                <linearGradient
                                  id="colorSales"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#6366f1"
                                    stopOpacity={0.35}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#6366f1"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                                <linearGradient
                                  id="colorProfit"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#10b981"
                                    stopOpacity={0.35}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#10b981"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f1f5f9"
                                className="dark:hidden"
                              />
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#334155"
                                className="hidden dark:block"
                                opacity={0.3}
                              />
                              <XAxis
                                dataKey="dateStr"
                                tick={{ fontSize: 10, fill: "#94a3b8" }}
                                stroke="#94a3b8"
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: "#94a3b8" }}
                                stroke="#94a3b8"
                                tickLine={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#1e293b",
                                  border: "none",
                                  borderRadius: "12px",
                                  color: "#fff",
                                  fontSize: "11px",
                                  textAlign: "right",
                                }}
                                labelStyle={{
                                  fontWeight: "bold",
                                  marginBottom: "4px",
                                  color: "#94a3b8",
                                }}
                              />
                              <Legend
                                wrapperStyle={{
                                  fontSize: "10px",
                                  paddingTop: "10px",
                                }}
                              />
                              <Area
                                type="monotone"
                                name="المبيعات (ج.م)"
                                dataKey="sales"
                                stroke="#6366f1"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorSales)"
                              />
                              <Area
                                type="monotone"
                                name="الربح الصافي (ج.م)"
                                dataKey="profit"
                                stroke="#10b981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorProfit)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: GOVERNORATES HOTSPOTS */}
                {analyticsTab === "govs" && (
                  <div className="space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300 text-right">
                    <div className="flex justify-between items-center flex-row-reverse">
                      <div>
                        <h5 className="text-sm font-black text-slate-800 dark:text-white">
                          توزيع الطلبيات حسب المحافظات
                        </h5>
                        <p className="text-[10px] text-slate-400">
                          تحليل جغرافي لأعلى 8 محافظات تحقيقاً للمبيعات والطلب
                        </p>
                      </div>
                    </div>
                    {govBreakdownData.length === 0 ? (
                      <div className="p-12 text-center bg-white/40 dark:bg-slate-800/25 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-450 font-bold">
                        لا توجد شحنات مسجلة جغرافياً لتحليل أداء المحافظات.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Delivery Rate per Gov Heatmap alternative */}
                        <div className="bg-emerald-600/5 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-500/20 p-5 rounded-3xl">
                          <h6 className="text-xs font-black text-emerald-700 dark:text-emerald-400 mb-4 flex items-center gap-2 flex-row-reverse">
                            <Percent size={14} />
                            تحليل كفاءة التوصيل حسب المنطقة
                          </h6>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {govBreakdownData.map((gov, idx) => (
                              <div key={idx} className="bg-white/40 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center flex-row-reverse mb-1.5">
                                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 truncate max-w-[80px]">{gov.name}</span>
                                  <span className={`text-[10px] font-black ${gov.deliveryRate > 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {Math.round(gov.deliveryRate)}%
                                  </span>
                                </div>
                                <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${gov.deliveryRate > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                    style={{ width: `${gov.deliveryRate}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm">
                            <h6 className="text-xs font-bold text-slate-500 mb-3 text-right">
                              حجم المبيعات لكل محافظة (ج.م)
                            </h6>
                            <div className="h-60 w-full" dir="ltr">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={govBreakdownData}
                                  margin={{
                                    top: 10,
                                    right: 10,
                                    left: -20,
                                    bottom: 0,
                                  }}
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#f1f5f9"
                                    className="dark:hidden"
                                  />
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#334155"
                                    className="hidden dark:block"
                                    opacity={0.3}
                                  />
                                  <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                                    tickLine={false}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: "#1e293b",
                                      border: "none",
                                      borderRadius: "12px",
                                      color: "#fff",
                                      fontSize: "11px",
                                    }}
                                  />
                                  <Bar
                                    name="المبيعات (ج.م)"
                                    dataKey="sales"
                                    fill="#06b6d4"
                                    radius={[6, 6, 0, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm">
                            <h6 className="text-xs font-bold text-slate-500 mb-3 text-right">
                              عدد الطلبات المحققة حسب المحافظة
                            </h6>
                            <div className="h-60 w-full" dir="ltr">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={govBreakdownData}
                                  margin={{
                                    top: 10,
                                    right: 10,
                                    left: -20,
                                    bottom: 0,
                                  }}
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#f1f5f9"
                                    className="dark:hidden"
                                  />
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#334155"
                                    className="hidden dark:block"
                                    opacity={0.3}
                                  />
                                  <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                                    tickLine={false}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: "#1e293b",
                                      border: "none",
                                      borderRadius: "12px",
                                      color: "#fff",
                                      fontSize: "11px",
                                    }}
                                  />
                                  <Bar
                                    name="عدد الطلبيات"
                                    dataKey="count"
                                    fill="#4f46e5"
                                    radius={[6, 6, 0, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: TRENDING PRODUCTS */}
                {analyticsTab === "products" && (
                  <div className="space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300 text-right">
                    <div className="flex justify-between items-center flex-row-reverse">
                      <div>
                        <h5 className="text-sm font-black text-slate-800 dark:text-white">
                          قائمة المنتجات الأكثر مبيعاً ورواجاً
                        </h5>
                        <p className="text-[10px] text-slate-400">
                          المنتجات الأعلى طلباً وكمية من قبل عملائك
                        </p>
                      </div>
                    </div>
                    {topProductsData.length === 0 ? (
                      <div className="p-12 text-center bg-white/40 dark:bg-slate-800/25 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-450 font-bold">
                        لا توجد مبيعات تفصيلية لمنتجات مسجلة في تصفية نتائج هذه
                        الطلبات.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-3">
                          <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            أعلى المنتجات مبيعاً بالكمية
                          </h6>
                          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                            {topProductsData.map((p, index) => (
                              <div
                                key={p.id}
                                className="flex justify-between items-center flex-row-reverse bg-slate-50/50 dark:bg-slate-800/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60"
                              >
                                <div className="flex items-center gap-3 flex-row-reverse">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-455 font-black text-xs">
                                    {index + 1}
                                  </span>
                                  <div className="text-right">
                                    <p className="text-xs font-black text-slate-700 dark:text-slate-200 line-clamp-1">
                                      {p.name}
                                    </p>
                                    <div className="flex items-center gap-2 flex-row-reverse">
                                      <p className="text-[9px] text-slate-400">
                                        الإيراد: {p.revenue.toLocaleString()} ج.م
                                      </p>
                                      <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                      <p className="text-[9px] text-emerald-500 font-bold">
                                        الربح التقريبي: {p.estimatedProfit.toLocaleString()} ج.م
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-left font-black text-slate-800 dark:text-white shrink-0 pl-1">
                                  <span className="text-indigo-600 dark:text-indigo-400 text-sm">
                                    {p.count}
                                  </span>{" "}
                                  <span className="text-[10px] text-slate-400">
                                    قطعة
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between">
                          <div>
                            <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                              المساهمة المالية للمنتجات في الإيرادات
                            </h6>
                          </div>
                          <div
                            className="flex-1 flex items-center justify-center min-h-[160px]"
                            dir="ltr"
                          >
                            <ResponsiveContainer width="100%" height={180}>
                              <PieChart>
                                <Pie
                                  data={topProductsData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={65}
                                  paddingAngle={5}
                                  dataKey="revenue"
                                >
                                  {topProductsData.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={
                                        [
                                          "#6366f1",
                                          "#10b981",
                                          "#f59e0b",
                                          "#ec4899",
                                          "#06b6d4",
                                        ][index % 5]
                                      }
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(v) => `${v} ج.م`}
                                  contentStyle={{ fontSize: "10px" }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                            {topProductsData.map((p, idx) => (
                              <span
                                key={p.id}
                                className="text-[9px] font-bold flex items-center gap-1 bg-slate-100 dark:bg-slate-800/55 py-1 px-2 rounded-lg border border-slate-200/40 dark:border-slate-700/40 text-slate-600 dark:text-slate-300"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{
                                    backgroundColor: [
                                      "#6366f1",
                                      "#10b981",
                                      "#f59e0b",
                                      "#ec4899",
                                      "#06b6d4",
                                    ][idx % 5],
                                  }}
                                ></span>
                                {p.name.substring(0, 10)}..
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5: CARRIERS PERFORMANCE COMPARISON */}
                {analyticsTab === "carriers" && (
                  <div className="space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center flex-row-reverse text-right">
                      <div>
                        <h5 className="text-sm font-black text-slate-800 dark:text-white">
                          أداء وكفاءة شركات الشحن والتوصيل
                        </h5>
                        <p className="text-[10px] text-slate-400">
                          مراقبة معدلات التوصيل الفعلي والرسوم والمصاريف لكل
                          شركة
                        </p>
                      </div>
                    </div>
                    {carrierPerformanceData.length === 0 ? (
                      <div className="p-12 text-center bg-white/40 dark:bg-slate-800/25 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-450 font-bold">
                        لم يتم شحن أي طلبيات عبر شركات اللوجستيات حتى الآن في
                        الفئة المحددة.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-1 pb-4">
                        {carrierPerformanceData.map((item, index) => {
                          const deliveryRate = item.rate;
                          const isHighPerformance = deliveryRate > 85;
                          const isLowPerformance = deliveryRate < 50;

                          return (
                            <div
                              key={index}
                              className="bg-white/80 dark:bg-slate-900/80 p-5 rounded-[2rem] border border-slate-150 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all"
                            >
                              <div className="absolute top-0 right-0 p-2 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                                <Truck size={80} />
                              </div>
                              
                              <div className="flex flex-col md:flex-row-reverse md:items-center justify-between gap-6 relative z-10">
                                <div className="flex items-center gap-4 flex-row-reverse text-right">
                                  <div className={`p-4 rounded-2xl ${isHighPerformance ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                                    <Truck size={24} />
                                  </div>
                                  <div>
                                    <h6 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 flex-row-reverse">
                                      {item.name || "غير محدد"}
                                      {isHighPerformance && (
                                        <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                          <ShieldCheck size={10} /> موثوقة
                                        </span>
                                      )}
                                    </h6>
                                    <p className="text-[10px] text-slate-400 font-bold">
                                      {item.total} شحنة بنطاق البحث
                                    </p>
                                  </div>
                                </div>

                                <div className="flex-1 md:px-8">
                                  <div className="flex justify-between items-center flex-row-reverse mb-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">معدل الانجاز</span>
                                    <span className={`text-xs font-black tabular-nums ${deliveryRate > 80 ? 'text-emerald-600' : deliveryRate > 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                                      {deliveryRate.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex flex-row-reverse">
                                    <div
                                      className={`h-full transition-all duration-1000 ${deliveryRate > 80 ? 'bg-emerald-500' : deliveryRate > 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                      style={{ width: `${deliveryRate}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between items-center flex-row-reverse mt-2">
                                    <span className="text-[9px] text-emerald-500 font-bold">{item.delivered} ناجحة</span>
                                    <span className="text-[9px] text-rose-400 font-bold">{item.returned} مرتجعات</span>
                                  </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl text-center md:text-left min-w-[120px] border border-slate-100 dark:border-slate-800/60">
                                  <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-tighter">متوسط التكلفة</p>
                                  <p className="text-sm font-black text-slate-800 dark:text-white tabular-nums">
                                    {(item.fees / (item.total || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="text-[10px] font-bold text-slate-400 mr-1">ج.م</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

      {/* Floating Smart Search & Actions Toolbar (Rendered when mainSection === 'orders') */}
      {mainSection === 'orders' && (
        <div className="sticky top-4 z-40 px-4 md:px-0 mt-4">
          <div className="bg-white/85 dark:bg-[#0b0f19]/85 backdrop-blur-2xl p-3.5 rounded-3xl shadow-xl shadow-slate-200/10 dark:shadow-none border border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:flex-1">
              <Search
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="🔍 بحث ذكي برقم الطلب، اسم العميل، الهاتف، أو رقم البوليصة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-11 pl-4 py-3 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none dark:text-white shadow-inner"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-4 py-2.5 rounded-2xl border transition-all shrink-0 active:scale-95 flex items-center gap-2 text-xs font-black ${
                  showAdvancedFilters || filterGov || filterCompany || filterEmployee || dateRange.start || dateRange.end
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/25"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm"
                }`}
              >
                <Filter size={16} />
                <span>تصفية وفلاتر</span>
                {(filterGov || filterCompany || filterEmployee || dateRange.start || dateRange.end) && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>

              <button
                onClick={handleAutoAssign}
                className="px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold shrink-0"
                title="توزيع الطلبات على الموظفين"
              >
                <Users size={16} />
                <span className="hidden md:inline">توزيع الطلبات</span>
              </button>

              <button
                onClick={handleExportPDF}
                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 transition-all shadow-sm shrink-0"
                title="تصدير قائمة الطلبات PDF"
              >
                <FileText size={16} />
              </button>

              <button
                onClick={handleExportExcel}
                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 transition-all shadow-sm shrink-0"
                title="تصدير Excel"
              >
                <FileDown size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  label: "المحافظة",
                  element: (
                    <select
                      value={filterGov}
                      onChange={(e) => setFilterGov(e.target.value)}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-right"
                    >
                      <option value="">كل المحافظات</option>
                      {EGYPT_GOVERNORATES.map((g) => (
                        <option key={g.name} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  ),
                },
                {
                  label: "شركة الشحن",
                  element: (
                    <select
                      value={filterCompany}
                      onChange={(e) => setFilterCompany(e.target.value)}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-right"
                    >
                      <option value="">كل الشركات</option>
                      {activeCompanies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ),
                },
                {
                  label: "تاريخ البداية",
                  element: (
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) =>
                        setDateRange((prev) => ({
                          ...prev,
                          start: e.target.value,
                        }))
                      }
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-right"
                    />
                  ),
                },
                {
                  label: "تاريخ النهاية",
                  element: (
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) =>
                        setDateRange((prev) => ({
                          ...prev,
                          end: e.target.value,
                        }))
                      }
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-right"
                    />
                  ),
                },
              ].map((field, i) => (
                <div key={i} className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    {field.label}
                  </p>
                  {field.element}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      {selectedOrders.length > 0 && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-2xl text-white px-6 py-4 rounded-full shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] border border-white/10 flex items-center gap-6 sm:gap-8 min-w-[max-content] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black tabular-nums border border-indigo-500/30">
              {selectedOrders.length}
            </div>
            <span className="text-sm font-bold whitespace-nowrap hidden sm:block">
              تم التحديد
            </span>
          </div>

          <div className="h-8 w-[1px] bg-white/10" />

          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar">
            <select
              id="bulk-status-select"
              onChange={(e) => handleBulkStatusChange(e.target.value)}
              className="bg-white/10 hover:bg-white/15 border border-white/5 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500/50 cursor-pointer outline-none transition-all appearance-none pr-8 relative"
              style={{
                paddingRight: "2rem",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.5rem center",
                backgroundSize: "1.2em",
              }}
            >
              <option value="default" className="text-slate-900">
                تغيير الحالة لـ...
              </option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s} className="text-slate-900">
                  {ORDER_STATUS_METADATA[s]?.label || s}
                </option>
              ))}
            </select>

            <button
              onClick={() => handleBulkStatusChange("مؤرشف")}
              className="p-2 sm:px-4 flex items-center gap-2 hover:bg-amber-500/20 hover:text-amber-400 border border-transparent hover:border-amber-500/30 transition-all bg-white/5 rounded-xl text-xs font-bold"
              title="أرشفة المحددة"
            >
              <Archive size={16} />{" "}
              <span className="hidden sm:block">أرشفة</span>
            </button>
            <button
              onClick={() => handleBulkStatusChange("ملغي")}
              className="p-2 sm:px-4 flex items-center gap-2 hover:bg-rose-500/20 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-all bg-white/5 rounded-xl text-xs font-bold"
              title="إلغاء المحددة"
            >
              <XCircle size={16} />{" "}
              <span className="hidden sm:block">إلغاء</span>
            </button>
            <button
              onClick={handleBulkPrintLabels}
              className="p-2 sm:px-4 flex items-center gap-2 hover:bg-indigo-500/20 hover:text-indigo-400 border border-transparent hover:border-indigo-500/30 transition-all bg-white/5 rounded-xl text-xs font-bold"
              title="طباعة بوالص الشحن"
            >
              <Printer size={18} />{" "}
              <span className="hidden sm:block">بوالص الشحن</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="p-2 sm:px-4 flex items-center gap-2 hover:bg-red-500/20 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all bg-white/5 rounded-xl text-xs font-bold text-red-400/80"
              title="حذف"
            >
              <Trash2 size={18} /> <span className="hidden sm:block">حذف</span>
            </button>
          </div>
          <button
            onClick={() => setSelectedOrders([])}
            className="p-2 hover:bg-white/10 rounded-full transition-all ml-1 bg-white/5"
          >
            <X size={18} />
          </button>
        </motion.div>
      )}

      {/* Orders View Section */}
      {mainSection === 'orders' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Orders View */}
          {viewMode === "list" ? (
        <div className="space-y-6">
          {/* Table for Desktop */}
          <div className="overflow-x-auto hidden lg:block bg-white/70 dark:bg-[#0b0f19]/70 backdrop-blur-2xl rounded-[2rem] border border-slate-200/40 dark:border-white/5 shadow-2xl shadow-indigo-500/[0.02] pb-4 transition-all duration-300">
            <table className="w-full text-right border-collapse whitespace-nowrap">
              <thead className="bg-slate-50/80 dark:bg-[#0b0f19]/80 backdrop-blur-md text-slate-500 dark:text-slate-400 text-[10px] tracking-widest font-black border-b border-slate-200/50 dark:border-white/5">
                <tr>
                  <th className="p-4 w-12 text-center rounded-tr-[2rem]">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded-md border-slate-300 dark:bg-slate-900 dark:border-slate-700 text-indigo-600 focus:ring-indigo-600/20 transition-all cursor-pointer"
                        onChange={handleSelectAll}
                        checked={
                          selectedOrders.length === paginatedOrders.length &&
                          paginatedOrders.length > 0
                        }
                      />
                    </div>
                  </th>
                  <th className="p-4 text-right">الطلب والعميل</th>
                  <th className="p-4 text-right">المنتجات</th>
                  <th className="p-4 text-right">مبلغ التحصيل</th>
                  {anyFlexShipEnabled && (
                    <th className="p-4 text-right">رسوم فليكس شيب</th>
                  )}
                  <th className="p-4 text-right">الحالة</th>
                  <th className="p-4 text-center">المحاولات</th>
                  <th className="p-4 text-center">الحالة المالية</th>
                  <th className="p-4 text-left rounded-tl-[2rem]">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                {paginatedOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    isSelected={selectedOrders.includes(order.id)}
                    anyFlexShipEnabled={anyFlexShipEnabled}
                    treasury={treasury}
                    onSelect={() => handleSelectRow(order.id)}
                    onStatusChange={(status) =>
                      updateOrderStatus(order.id, status)
                    }
                    onPaymentChange={(status) =>
                      handlePaymentStatusChange(order, status)
                    }
                    onEdit={() => handleEditOrder(order)}
                    onDelete={() => setOrderToDelete(order)}
                    onPrintInvoice={() => handlePrintInvoice(order)}
                    onPrintLabel={() => handlePrintShippingLabel(order)}
                    onCollect={(inspectionPaid) =>
                      handleCollectAction(order, inspectionPaid)
                    }
                    onStartExchange={() => handleStartExchange(order)}
                    onPostReturn={() => handlePostCollectionReturn(order)}
                    onShowSummary={() => setShowSummaryModal(order)}
                    onShowAudit={() => setShowAuditLog(order)}
                    onShowAssignment={() => setShowAssignment(order)}
                    onShowDetails={() => setShowDetailsModal(order)}
                    onToggleFlexShipPaid={() =>
                      handleToggleFlexShipPaid(order.id)
                    }
                    whatsappLink={getWhatsAppLink(order)}
                    settings={settings}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards for Mobile/Tablet */}
          <div className="lg:hidden flex items-center justify-between mx-2 px-4 py-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Package size={14} className="text-indigo-500" />
              قائمة الطلبات ({paginatedOrders.length})
            </span>
            <button
              onClick={() => {
                if (selectedOrders.length === paginatedOrders.length) {
                  setSelectedOrders([]);
                } else {
                  setSelectedOrders(paginatedOrders.map((o) => o.id));
                }
              }}
              className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all ${
                selectedOrders.length === paginatedOrders.length
                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100"
              }`}
            >
              {selectedOrders.length === paginatedOrders.length
                ? "إلغاء التحديد"
                : "تحديد الكل"}
            </button>
          </div>
          <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
            {paginatedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isSelected={selectedOrders.includes(order.id)}
                onSelect={() => handleSelectRow(order.id)}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
                onPaymentChange={(status) =>
                  handlePaymentStatusChange(order, status)
                }
                onEdit={() => handleEditOrder(order)}
                onDelete={() => setOrderToDelete(order)}
                onPrintInvoice={() => handlePrintInvoice(order)}
                onPrintLabel={() => handlePrintShippingLabel(order)}
                onCollect={(inspectionPaid) =>
                  handleCollectAction(order, inspectionPaid)
                }
                onStartExchange={() => handleStartExchange(order)}
                onPostReturn={() => handlePostCollectionReturn(order)}
                onShowSummary={() => setShowSummaryModal(order)}
                onShowAudit={() => setShowAuditLog(order)}
                onShowAssignment={() => setShowAssignment(order)}
                whatsappLink={getWhatsAppLink(order)}
                settings={settings}
              />
            ))}
          </div>
        </div>
      ) : (
        <KanbanView
          orders={filteredOrders}
          onStatusChange={updateOrderStatus}
          onEdit={handleEditOrder}
          settings={settings}
          treasury={treasury}
        />
      )}

      {/* Empty State */}
      {filteredOrders.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 text-slate-400 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[3rem] border border-slate-200/50 dark:border-slate-800/50 shadow-inner"
        >
          <div className="relative mb-8 group">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800/80 backdrop-blur-xl rounded-full flex items-center justify-center border border-white dark:border-slate-700 shadow-xl relative z-10">
              <Package
                size={56}
                className="text-indigo-400 dark:text-indigo-500/70"
              />
            </div>
            <div className="absolute top-0 right-0 w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center -mr-2 -mt-2 shadow-lg border border-white dark:border-slate-800 animate-bounce">
              <Search size={20} />
            </div>
          </div>
          <h3 className="text-3xl font-black mb-3 text-slate-800 dark:text-white tracking-tight">
            لا توجد طلبات مطابقة
          </h3>
          <p className="text-base text-slate-500 max-w-sm text-center font-bold font-sans leading-relaxed">
            لم نتمكن من العثور على أي طلبات تطابق معايير البحث أو الفلاتر
            الحالية. جرب تغييرها وتوسيع النطاق.
          </p>
        </motion.div>
      )}

      {/* Pagination */}
      {filteredOrders.length > 0 && (
        <div className="mx-4 my-6 px-6 py-4 bg-white/70 dark:bg-[#0b0f19]/70 backdrop-blur-xl rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-2xl shadow-indigo-500/[0.02] flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-slate-300/50 dark:hover:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Package size={18} />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">
                عرض {paginatedOrders.length} طلبات
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                من إجمالي {filteredOrders.length}
              </span>
            </div>
          </div>

          {/* Items Per Page Selector */}
          <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-1.5 rounded-[1.25rem] border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              عدد الطلبات بالصفحة:
            </span>
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
          </div>

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
        </div>
      )}

      {/* Report Preview Modal */}
      {reportPreviewHtml && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    معاينة التقرير
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    راجع البيانات قبل الطباعة أو التحميل
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Pages / Continuous Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700" dir="rtl">
                  <button
                    onClick={() => setReportIsContinuous(false)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!reportIsContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  >
                    صفحات
                  </button>
                  <button
                    onClick={() => setReportIsContinuous(true)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${reportIsContinuous ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  >
                    متصل
                  </button>
                </div>

                {/* Portrait / Landscape Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700" dir="rtl">
                  <button
                    onClick={() => setReportOrientation("portrait")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${reportOrientation === "portrait" ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  >
                    طولي
                  </button>
                  <button
                    onClick={() => setReportOrientation("landscape")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${reportOrientation === "landscape" ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  >
                    عرضي
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    const filename = `تقرير_الطلبات_${new Date().toISOString().split('T')[0]}.pdf`;
                    await exportHTMLToPDF(reportPreviewHtml, reportOrientation, filename, reportIsContinuous);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/10"
                >
                  <Download size={18} />
                  <span>تصدير PDF</span>
                </button>
                <button
                  onClick={() => {
                    printHTMLDirectly(reportPreviewHtml);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <Printer size={18} />
                  <span>طباعة / تحميل</span>
                </button>
                <button
                  onClick={() => setReportPreviewHtml(null)}
                  className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 overflow-hidden">
              <iframe
                srcDoc={reportPreviewHtml}
                className="w-full h-full border-none rounded-xl shadow-inner bg-white"
                title="Report Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}

      {showDetailsModal && (
        <OrderDetailsModal
          order={showDetailsModal}
          settings={settings}
          allOrders={orders}
          onClose={() => setShowDetailsModal(null)}
          onAddTransaction={(type, amount, note, category) => {
            const newTx: Transaction = {
              id: `adj-${Date.now()}`,
              type,
              amount,
              date: new Date().toISOString(),
              note,
              category,
              status: 'completed',
              orderId: showDetailsModal.id,
              orderNumber: showDetailsModal.orderNumber
            };
            setWallet(prev => ({
              ...prev,
              balance: type === 'إيداع' ? prev.balance + amount : prev.balance - amount,
              transactions: [newTx, ...prev.transactions]
            }));
          }}
        />
      )}
      {orderToDelete && (
        <ConfirmationModal
          title="حذف الطلب؟"
          description={`هل أنت متأكد من حذف طلب العميل "${orderToDelete.customerName}"؟`}
          onConfirm={handleDeleteOrder}
          onCancel={() => setOrderToDelete(null)}
          checkboxLabel={
            orderToDelete.orderType === "maintenance"
              ? "حذف طلب الصيانة المرتبط أيضاً"
              : undefined
          }
        />
      )}
      {orderForWaybill && orderForModal && (
        <WaybillModal
          order={orderForModal}
          onClose={() => setOrderForWaybill(null)}
          onSave={handleSaveWaybill}
        />
      )}

      {autoWhatsappData && (
        <AutoWhatsappModal
          order={autoWhatsappData.order}
          newStatus={autoWhatsappData.newStatus}
          onClose={() => setAutoWhatsappData(null)}
          settings={settings}
        />
      )}

      {pendingFlexShipConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800"
            style={{ direction: "rtl" }}
          >
            <div className="w-16 h-16 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-violet-100 dark:border-violet-500/20">
              <Truck size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">
              تأكيد رسوم الفليكس شيب (Flex Ship)
            </h3>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-6">
              الطلب رقم{" "}
              <span className="text-slate-800 dark:text-slate-200 font-extrabold">
                #{pendingFlexShipConfirm.orderNumber}
              </span>{" "}
              لشركة الشحن ({pendingFlexShipConfirm.companyName}).
              <br />
              هل قام المستلم بدفع الرسوم الإضافية بقيمة{" "}
              <span className="text-violet-600 dark:text-violet-400 font-black">
                {pendingFlexShipConfirm.fee} ج.م
              </span>{" "}
              لرفضه استلام الشحنة؟
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => {
                  updateOrderStatus(
                    pendingFlexShipConfirm.orderId,
                    pendingFlexShipConfirm.newStatus,
                    true,
                  );
                  setPendingFlexShipConfirm(null);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>نعم، تم الدفع والمستلم سدد الرسوم ✓</span>
              </button>
              <button
                onClick={() => {
                  updateOrderStatus(
                    pendingFlexShipConfirm.orderId,
                    pendingFlexShipConfirm.newStatus,
                    false,
                  );
                  setPendingFlexShipConfirm(null);
                }}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-extrabold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>لا، رفض الدفع (لم يتم التحصيل) ✗</span>
              </button>
              <button
                onClick={() => {
                  setPendingFlexShipConfirm(null);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <span>إلغاء التغيير والرجوع</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingInspectionConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800"
            style={{ direction: "rtl" }}
          >
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
              <Coins size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">
              تأكيد رسوم المعاينة
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 font-sans leading-relaxed">
              الطلب رقم{" "}
              <span className="text-slate-800 dark:text-slate-200 font-extrabold">
                #{pendingInspectionConfirm.order.orderNumber}
              </span>
              .
              <br />
              هل قام العميل بدفع رسوم المعاينة بقيمة{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-black">
                {pendingInspectionConfirm.inspectionFee} ج.م
              </span>
              ؟
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => {
                  const updatedOrder = {
                    ...pendingInspectionConfirm.order,
                    paymentStatus: pendingInspectionConfirm.newPaymentStatus,
                    inspectionFeePaidByCustomer: true,
                  };
                  handleCollectAction(updatedOrder, true);
                  setPendingInspectionConfirm(null);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <span>✓ نعم، العميل سدد كامل رسوم المعاينة</span>
              </button>
              <button
                onClick={() => {
                  const updatedOrder = {
                    ...pendingInspectionConfirm.order,
                    paymentStatus: pendingInspectionConfirm.newPaymentStatus,
                    inspectionFeePaidByCustomer: false,
                  };
                  handleCollectAction(updatedOrder, false);
                  setPendingInspectionConfirm(null);
                }}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-extrabold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <span>✗ لا، لم يسدد رسوم المعاينة بالزيادة</span>
              </button>
              <button
                onClick={() => {
                  setPendingInspectionConfirm(null);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <span>إلغاء الإجراء</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmation.isOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
            <div
              className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 ${
                confirmation.type === "danger"
                  ? "bg-red-50 dark:bg-red-500/10 text-red-500"
                  : confirmation.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-500/10 text-amber-500"
                    : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500"
              }`}
            >
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">
              {confirmation.title}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium">
              {confirmation.message}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmation.onConfirm}
                className={`w-full py-4 text-white rounded-2xl font-black text-lg shadow-lg transition-all active:scale-[0.98] ${
                  confirmation.type === "danger"
                    ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                    : confirmation.type === "warning"
                      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                }`}
              >
                {confirmation.confirmText || "تأكيد"}
              </button>
              <button
                onClick={() =>
                  setConfirmation((prev) => ({ ...prev, isOpen: false }))
                }
                className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuditLog && (
        <AuditLogModal
          order={showAuditLog}
          onClose={() => setShowAuditLog(null)}
        />
      )}

      {showAssignment && (
        <AssignmentModal
          order={showAssignment}
          employees={settings.employees || []}
          onClose={() => setShowAssignment(null)}
          onAssign={(empId, empName) => {
            updateOrderField(showAssignment.id, "assignedTo", empId);
            updateOrderField(showAssignment.id, "assignedToName", empName);
            setShowAssignment(null);
          }}
        />
      )}

      {/* Status Guide Modal for Employees */}
      {showStatusGuide && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-6 sm:p-8 text-right border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto no-scrollbar"
            style={{ direction: "rtl" }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white">
                    دليل حالات الطلبات وسير العمل
                  </h3>
                  <p className="text-xs text-slate-500">
                    شرح مبسط لدورة حياة الطلب من لحظة تسجيله حتى تحصيل المبلغ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStatusGuide(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              {[
                {
                  title: "1. قيد المراجعة والتجهيز 📦",
                  color: "amber",
                  desc: "المرحلة الأولى للطلب في المخزن. تشمل ثلاث حالات فرعية:",
                  points: [
                    "📞 في انتظار المكالمة: طلب جديد يحتاج اتصال هاتفي لتأكيد العنوان والجدية.",
                    "🔍 جاري المراجعة: تم التأكيد ومراجعة الأصناف والأسعار وبانتظار أمر التجهيز.",
                    "📦 قيد التنفيذ: يتم الآن جمع المنتجات وتغليفها وتجهيز البوليصة في المخزن.",
                  ],
                },
                {
                  title: "2. جاري الشحن والتوصيل 🚚",
                  color: "blue",
                  desc: "تم تسليم الشحنة لشركة الشحن أو مندوب التوصيل (تم الارسال). الشحنة الآن في الطريق للعميل وبانتظار التحديث النهائي.",
                  points: [],
                },
                {
                  title: "3. تم التوصيل والتحصيل ✅",
                  color: "emerald",
                  desc: "المرحلة الناجحة للطلب (تم التحصيل). استلم العميل الشحنة وتم توريد المبلغ النقدي للخزينة أو الكاشير.",
                  points: [],
                },
                {
                  title: "4. مرتجع وفشل التوصيل ↩️",
                  color: "rose",
                  desc: "الشحنات التي لم تكتمل بنجاح لأحد الأسباب التالية:",
                  points: [
                    "❌ فشل التوصيل: تعذر الوصول للعميل، الهاتف مغلق، أو تم تأجيل التسليم عدة مرات.",
                    "↩️ مرتجع: رفض العميل استلام الشحنة وعادت الفاتورة والأصناف إلى المخزن مرة أخرى.",
                  ],
                },
                {
                  title: "5. طلبات ملغاة ومؤرشفة 🗑️",
                  color: "slate",
                  desc: "طلبات تم إلغاؤها من قِبل العميل أو الإدارة قبل خروجها للشحن، أو طلبات قديمة تم نقلها للأرشيف لتخفيف زحام القائمة النشطة.",
                  points: [],
                },
              ].map((item, idx) => {
                const badgeBg = {
                  amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200",
                  blue: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200",
                  emerald: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200",
                  rose: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200",
                  slate: "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300",
                }[item.color];

                return (
                  <div key={idx} className={`p-4 rounded-2xl border ${badgeBg} space-y-2`}>
                    <h4 className="font-black text-sm">{item.title}</h4>
                    <p className="font-bold opacity-90">{item.desc}</p>
                    {item.points.length > 0 && (
                      <ul className="list-disc list-inside space-y-1 pt-1 opacity-85 font-semibold">
                        {item.points.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowStatusGuide(false)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                فهمت الدليل، إغلاق <CheckCircle size={16} className="inline ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const ShipmentTypeBadge: React.FC<{ type?: string }> = ({ type }) => {
  const t = type || "delivery";
  switch (t) {
    case "partial_delivery":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-sky-55/60 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-850 whitespace-nowrap">
          <Package size={12} />
          <span>توصيل جزئي</span>
          <span className="px-1 py-0.5 bg-cyan-400 dark:bg-cyan-500 text-white rounded-[4px] text-[8px] font-black leading-none animate-pulse">
            جديد
          </span>
        </span>
      );
    case "exchange":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-indigo-55/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-205 dark:border-indigo-850 whitespace-nowrap">
          <ArrowRightLeft size={12} />
          <span>تبديل شحنات</span>
        </span>
      );
    case "return":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-rose-55/60 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-205 dark:border-rose-850 whitespace-nowrap">
          <RefreshCcw size={12} />
          <span>إرجاع شحنة</span>
        </span>
      );
    case "cash_collection":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-emerald-55/60 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-205 dark:border-emerald-850 whitespace-nowrap">
          <Coins size={12} />
          <span>تحصيل نقدي</span>
        </span>
      );
    case "maintenance_pickup":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50 whitespace-nowrap">
          <SettingsIcon size={12} />
          <span>سحب للصيانة</span>
        </span>
      );
    case "maintenance_return":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/50 whitespace-nowrap">
          <Wand2 size={12} />
          <span>توصيل صيانة</span>
        </span>
      );
    case "delivery":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-750 whitespace-nowrap">
          <Truck size={12} />
          <span>توصيل شحنة</span>
        </span>
      );
  }
};

const PosSourceBadge: React.FC<{ order: Order }> = ({ order }) => {
  if (order.channel !== "pos" && !order.shippingCompany?.startsWith("كاشير -"))
    return null;
  const storeName =
    order.shippingCompany?.replace("كاشير - ", "") || "بيع مباشر";
  const posName = order.shippingArea && order.shippingArea !== 'نقطة البيع' ? order.shippingArea : storeName;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 whitespace-nowrap">
      <Building size={12} />
      <span>{posName}</span>
    </span>
  );
};

const OrderCard = ({
  order,
  isSelected,
  onSelect,
  onStatusChange,
  onPaymentChange,
  onEdit,
  onDelete,
  onPrintInvoice,
  onPrintLabel,
  onCollect,
  onStartExchange,
  onPostReturn,
  onShowSummary,
  onShowAudit,
  onShowAssignment,
  whatsappLink,
  settings,
}: {
  order: Order;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: OrderStatus) => void;
  onPaymentChange: (status: PaymentStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrintInvoice: () => void;
  onPrintLabel: () => void;
  onCollect: (inspectionPaid: boolean) => void;
  onStartExchange: () => void;
  onPostReturn: () => void;
  onShowSummary: () => void;
  onShowAudit: () => void;
  onShowAssignment: () => void;
  whatsappLink: string;
  settings: Settings;
  key?: any;
}) => {
  const navigate = useNavigate();
  const statusInfo = ORDER_STATUS_METADATA[order.status] || {
    label: order.status,
    color: "bg-slate-500",
    icon: "Package",
  };
  const StatusIcon =
    {
      PhoneForwarded,
      FileSearch,
      Package,
      Truck,
      CheckCircle,
      Coins,
      RefreshCcw,
      XCircle,
      Archive,
    }[statusInfo.icon as string] || Package;
  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeTax = Number(order.tax) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;

  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  const isPosOrder =
    order.channel === "pos" || order.shippingCompany === "كاشير - بيع مباشر";
  const insuranceRate = useCustom
    ? (compFees?.insuranceFeePercent ?? 0)
    : settings.enableInsurance
      ? settings.insuranceFeePercent
      : 0;
  const insuranceFee = isPosOrder
    ? 0
    : (order.isInsured ?? true)
      ? calculateInsuranceFee(order, insuranceRate, settings)
      : 0;
  const inspectionFeeAmount =
    !isPosOrder && (order.includeInspectionFee ?? true)
      ? useCustom
        ? (compFees?.inspectionFee ?? 0)
        : settings.enableInspection
          ? settings.inspectionFee
          : 0
      : 0;
  const inspectionFee = (order.inspectionFeePaidByCustomer !== false && order.includeInspectionFee !== false) ? inspectionFeeAmount : 0;
  const bostaVatFee = isPosOrder
    ? 0
    : calculateBostaVat(order, insuranceFee, settings);

  const safeCredit = Number(order.creditAmount) || 0;
  const safeReturnCash =
    order.returnCashToCustomer && order.cashToReturnAmount
      ? Number(order.cashToReturnAmount)
      : 0;
  const orderTotalValue = Math.max(0, Math.round(safeProductPrice + safeShippingFee + safeTax + inspectionFee - safeDiscount));
  const computedTotal = Math.max(
    0,
    Math.round(
      orderTotalValue -
        safeAdvance -
        safeCredit -
        safeReturnCash,
    ),
  );
  const totalAmount =
    order.totalAmountOverride !== undefined &&
    order.totalAmountOverride !== null
      ? Math.max(0, Math.round(Number(order.totalAmountOverride)))
      : computedTotal;
  const displayTotal =
    order.source === "synced" && order.totalPrice != null
      ? Number(order.totalPrice) + inspectionFee
      : totalAmount;

  const standardInspectionFee = (order.includeInspectionFee !== false) ? inspectionFeeAmount : 0;
  const standardRequiredTotal = Math.max(
    0,
    Math.round(
      safeProductPrice +
        safeShippingFee +
        safeTax +
        standardInspectionFee -
        safeDiscount -
        safeAdvance -
        safeCredit -
        safeReturnCash,
    ),
  );

  return (
    <motion.div
      variants={itemVariants}
      className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 rounded-[2.5rem] border-2 transition-all relative group shadow-lg hover:shadow-xl ${
        isSelected
          ? "border-indigo-600 ring-4 ring-indigo-500/10 shadow-indigo-500/20"
          : "border-slate-100/60 dark:border-slate-800/60 shadow-slate-200/20 dark:shadow-none hover:border-indigo-200 dark:hover:border-indigo-500/30"
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br from-transparent to-indigo-50/50 dark:to-indigo-500/5 rounded-[2.5rem] pointer-events-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      />

      {/* Selection Hub */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowAudit();
          }}
          className="p-2 sm:p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 border border-slate-100/50 dark:border-slate-700/50 shadow-sm transition-all opacity-100 sm:opacity-0 group-hover:opacity-100 active:scale-95"
          title="سجل النشاط"
        >
          <Shield size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`w-7 h-7 sm:w-6 sm:h-6 rounded-xl border-[2.5px] transition-all flex items-center justify-center ${
            isSelected
              ? "bg-indigo-600 border-indigo-600 shadow-md shadow-indigo-500/20"
              : "bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 group-hover:border-indigo-400 backdrop-blur-sm"
          }`}
        >
          {isSelected && <Check size={14} className="text-white" />}
        </button>
      </div>

      {/* Card Header & Status */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div
              className={`w-16 h-16 rounded-2xl ${statusInfo.color} flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform duration-500`}
            >
              <StatusIcon size={32} />
            </div>
            {order.platform && order.platform !== "system" && (
              <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-1 rounded-full shadow-md border border-slate-100 dark:border-slate-700">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white uppercase ${
                    order.platform === "wuilt"
                      ? "bg-black"
                      : order.platform === "salla"
                        ? "bg-[#004d5a]"
                        : order.platform === "shopify"
                          ? "bg-[#95bf47]"
                          : "bg-indigo-600"
                  }`}
                >
                  {order.platform.substring(0, 1)}
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1">
              #{order.orderNumber}
            </h3>
            <div className="flex items-center gap-2 flex-row-reverse">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {new Date(order.date).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                {order.shippingCompany}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status & Shipment Type Badges */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl ${statusInfo.color} text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-md`}
        >
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
          {statusInfo.label}
        </div>
        {order.channel !== "pos" &&
          !order.shippingCompany?.startsWith("كاشير -") && (
            <ShipmentTypeBadge type={order.shipmentType} />
          )}
        <PosSourceBadge order={order} />
      </div>

      {/* Profile Section */}
      <div className="space-y-6 mb-8">
        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
            <UserIcon size={20} />
          </div>
          <div className="text-right flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
              العميل
            </p>
            <h4 className="text-sm font-black text-slate-800 dark:text-white">
              {order.customerName}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <MapPin size={20} />
          </div>
          <div className="text-right flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
              العنوان
            </p>
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
              {order.governorate} - {order.shippingArea}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Phone size={20} />
          </div>
          <div className="text-right flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
              اتصال
            </p>
            <div className="flex items-center gap-2 justify-end">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:scale-110 transition-transform"
              >
                <MessageCircle size={16} />
              </a>
              <h4 className="text-sm font-black text-slate-800 dark:text-white tabular-nums">
                {order.customerPhone}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items Micro-view */}
      <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800/50 mb-8">
        <div className="flex items-center justify-between flex-row-reverse mb-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            محتويات الطلب
          </span>
          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black">
            {(order.items || []).length} قطع
          </span>
        </div>
        <div className="space-y-3">
          {(order.items || []).slice(0, 2).map((item, idx) => {
            const product = settings.products.find(
              (p) =>
                p.id === item.productId ||
                p.variants?.some((v) => v.id === item.productId),
            );
            return (
              <div
                key={idx}
                className="flex gap-3 items-center flex-row-reverse"
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 p-1 flex-shrink-0 shadow-sm">
                  {product?.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      className="w-full h-full object-cover rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Package size={16} className="m-auto text-slate-300" />
                  )}
                </div>
                <div className="text-right min-w-0 flex-1">
                  <p className="text-slate-800 dark:text-slate-200 font-black text-[11px] truncate leading-tight">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {item.variantDescription || "وحدة قياسية"}{" "}
                    <span className="text-slate-700 dark:text-slate-300">
                      × {item.quantity}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
          {(order.items || []).length > 2 && (
            <button
              onClick={onShowSummary}
              className="w-full text-center py-2 bg-white dark:bg-slate-800/50 rounded-xl text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 transition-all"
            >
              + {(order.items || []).length - 2} منتجات أخرى
            </button>
          )}
        </div>
      </div>

      {/* Financial Statement */}
      <div className="flex items-center justify-between flex-row-reverse mb-8 group/total">
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            المبلغ الإجمالي
          </p>
          <div className="flex flex-col items-end gap-1 text-right">
            <div className="flex items-baseline gap-1 justify-end">
              <span className="text-xs font-black text-indigo-600">ج.م</span>
              <h4 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums group-hover/total:scale-105 transition-transform origin-right">
                {displayTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </h4>
            </div>
            {displayTotal !== standardRequiredTotal && (
              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100/50 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[10px]">المطلوب تحصيله:</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400">
                    {standardRequiredTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })} ج.م
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[10px]">المحصل فعلياً:</span>
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    {displayTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })} ج.م
                  </span>
                </div>
              </div>
            )}
          </div>
          {(order.advancePayment || 0) > 0 && (
            <div className="text-[10px] font-bold mt-1 text-right space-y-1">
              <div className="flex items-center gap-1 justify-end">
                {isPosOrder && displayTotal === 0 ? (
                  <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-1.5">
                    <Coins size={12} />
                    مدفوع بالكامل (كاشير): {order.advancePayment} ج.م
                  </span>
                ) : (
                  <span className="text-teal-600 bg-teal-50 dark:bg-teal-950/30 px-2 py-1 rounded-lg border border-teal-100 dark:border-teal-900/30 flex items-center gap-1.5">
                    <WalletIcon size={12} />
                    عربون مقدم: {order.advancePayment} ج.م
                  </span>
                )}
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1">
                  👤 {isPosOrder && displayTotal === 0 ? (order.cashHolderId === 'wallet' ? "جهة الإيداع:" : "المحصل:") : "العهدة:"} {resolveCashHolderName(order, settings)}
                </span>
              </div>
              {order.advancePaymentRecipientPhone && (
                <p className="text-[9px] text-slate-500 pr-2">
                  المستلم: {order.advancePaymentRecipientPhone}
                </p>
              )}
              {order.advancePaymentSenderDetails && (
                <p className="text-[9px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800 inline-block">
                  المحول: {order.advancePaymentSenderDetails}
                </p>
              )}
            </div>
          )}
          {isPosOrder && (order.advancePayment || 0) === 0 && (
            <div className="flex items-center gap-1 justify-end mt-1">
              <span className="text-[10px] font-bold text-slate-500 italic">
                {order.paymentStatus === 'بانتظار الدفع' ? 'بانتظار التحصيل' : 'مدفوع'}
              </span>
              <div className="w-1 h-1 bg-slate-300 rounded-full" />
              <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md text-[9px] font-black">
                👤 {resolveCashHolderName(order, settings)}
              </span>
            </div>
          )}
          {!isPosOrder && displayTotal > 0 && (
            <div className="text-[9px] font-black text-amber-600 mt-1 text-right flex items-center justify-end gap-1">
              <span>المتبقي عند الاستلام: {displayTotal.toLocaleString()} ج.م</span>
              <Truck size={10} />
            </div>
          )}
        </div>
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
          <Receipt size={24} />
        </div>
      </div>

      {/* Card Actions Overlay */}
      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-black text-white rounded-2xl text-xs font-black hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          تعديل <Edit3 size={14} />
        </button>
        <button
          onClick={onPrintInvoice}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
        >
          فاتورة <Printer size={14} />
        </button>

        <div className="relative group/more-card">
          <button className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
            <MoreVertical size={18} />
          </button>
          <div className="absolute bottom-full left-0 mb-3 w-52 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-2 hidden group-hover/more-card:block z-20">
            <button
              onClick={() => {
                if (
                  order.source === "synced" &&
                  order.waybillNumber?.startsWith("http")
                ) {
                  window.open(order.waybillNumber, "_blank");
                } else {
                  onPrintLabel();
                }
              }}
              className="w-full text-right px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors"
            >
              بوليصة شحن <LayoutList size={16} />{" "}
              {order.source === "synced" &&
                order.waybillNumber?.startsWith("http") && (
                  <ExternalLink size={12} className="text-blue-500 mr-auto" />
                )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate("/orders/new", { state: { exchangeData: order } });
              }}
              className="w-full text-right px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors"
            >
              إنشاء بوليصة استبدال <RefreshCcw size={16} />
            </button>
            <button
              onClick={onShowAudit}
              className="w-full text-right px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors"
            >
              سجل التدقيق <FileSearch size={16} />
            </button>
            <button
              onClick={onShowAssignment}
              className="w-full text-right px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-end gap-3 transition-colors"
            >
              تعيين موظف <UserIcon size={16} />
            </button>
            <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1 mx-2" />
            <button
              onClick={onDelete}
              className="w-full text-right px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl flex items-center justify-end gap-3 transition-colors"
            >
              حذف نهائي <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ShippingDetailsCard: React.FC<{ order: Order }> = ({ order }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl space-y-4 min-w-[280px] whitespace-normal">
      <div className="flex flex-col items-center text-center space-y-2 pb-2 border-b border-slate-50 dark:border-slate-800">
        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
          {order.shippingCompany}
        </span>
        <span className="text-[10px] font-bold text-slate-400">
          {order.governorate}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center py-6 space-y-4">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300">
          <Truck size={32} />
        </div>
        <div className="text-center">
          <p className="text-sm font-black text-slate-800 dark:text-white">
            {order.shippingCompany}
          </p>
          <div className="mt-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-[10px] font-bold text-slate-400">
              لا توجد بوليصة حالياً
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfitBreakdown: React.FC<{
  order: Order;
  settings: Settings;
  treasury?: any;
  onToggleFlexShipPaid?: () => void;
}> = ({ order, settings, treasury, onToggleFlexShipPaid }) => {
  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeAdminFee = Number(order.adminFee) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeProductCost = Number(order.productCost) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  const safeCredit = Number((order as any).creditAmount) || 0;
  const safeReturnCash = order.returnCashToCustomer && (order as any).cashToReturnAmount ? Number((order as any).cashToReturnAmount) : 0;

  // Calculate Standard Shipping Fee for expense side
  const standardShippingFee = getStandardShippingFee(order, settings);

  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;

  const insuranceRate = useCustom
    ? (compFees?.insuranceFeePercent ?? 0)
    : settings.enableInsurance
      ? settings.insuranceFeePercent
      : 0;
  const insuranceFee =
    (order.isInsured ?? true)
      ? calculateInsuranceFee(order, insuranceRate, settings)
      : 0;
  const isPosOrder =
    order.channel === "pos" || order.shippingCompany === "كاشير - بيع مباشر";
  const inspectionFee =
    !isPosOrder && (order.includeInspectionFee ?? true)
      ? useCustom
        ? (compFees?.inspectionFee ?? 0)
        : settings.enableInspection
          ? settings.inspectionFee
          : 0
      : 0;
  const codFee = calculateCodFee(order, settings);
  const bostaVatFee = calculateBostaVat(order, insuranceFee, settings);
  const currentVatRate = useCustom
    ? (compFees?.shippingVatRate ?? (isBosta(order.shippingCompany) ? 0.14 : 0))
    : (settings?.shippingVatRate ??
      (isBosta(order.shippingCompany) ? 0.14 : 0));
  const dynamicVatLabel = `ضريبة القيمة المضافة (${(currentVatRate * 100).toFixed(0)}%)`;

  const safeTax = Number(order.tax) || 0;
  const inspectionAdjustment = isPosOrder ? 0 : inspectionFee;

  const inspectionRevenue =
    (order.includeInspectionFee !== false && !isPosOrder && order.inspectionFeePaidByCustomer !== false) ? inspectionFee : 0;

  const baseRevenue =
    safeProductPrice + safeShippingFee + safeTax + inspectionRevenue + safeAdminFee;

  const expectedCollectionAmount = baseRevenue - safeDiscount - safeAdvance - safeCredit - safeReturnCash;

  const amountCollectedFromCustomer =
    order.totalAmountOverride !== undefined &&
    order.totalAmountOverride !== null &&
    String(order.totalAmountOverride).trim() !== ""
      ? Number(order.totalAmountOverride)
      : expectedCollectionAmount;

  const manualDifference = amountCollectedFromCustomer - expectedCollectionAmount;

  const extraAdjustment = manualDifference;

  const totalExpenses =
    safeProductCost +
    standardShippingFee +
    insuranceFee +
    inspectionAdjustment +
    codFee +
    bostaVatFee;

  // Dynamic Profit/Loss calculations based on status
  const isReturnedOrFailed = ["مرتجع", "فشل_التوصيل"].includes(order.status);
  const applyReturnFee = isPosOrder
    ? false
    : useCustom
      ? (compFees?.enableFixedReturn ?? false)
      : settings.enableReturnShipping;
  const returnFeeAmount = applyReturnFee
    ? useCustom
      ? (compFees?.returnShippingFee ?? 0)
      : settings.returnShippingFee
    : 0;

  const carrierCost =
    standardShippingFee +
    insuranceFee +
    bostaVatFee +
    (isReturnedOrFailed ? inspectionAdjustment + returnFeeAmount : 0);
  const isFlexShipEnabled =
    order.enableFlexShip !== undefined
      ? order.enableFlexShip
      : useCustom
        ? (compFees?.enableFlexShip ?? false)
        : (settings.enableFlexShip ?? false);
  const flexFeeValue = isFlexShipEnabled
    ? (order.flexShipFee !== undefined ? order.flexShipFee : (useCustom
      ? (compFees?.flexShipFee ?? 0)
      : (settings.flexShipFee ?? 0)))
    : 0;
  const flexPaidAmount =
    isFlexShipEnabled && order.flexShipFeePaidByCustomer
      ? order.flexShipFee || flexFeeValue
      : 0;
  const flexCompanyFeeValue = isFlexShipEnabled
    ? useCustom
      ? (compFees?.flexShipCompanyFee ?? 0)
      : (settings.flexShipCompanyFee ?? 0)
    : 0;
  const flexCompanyFeePaid =
    isFlexShipEnabled && order.flexShipFeePaidByCustomer
      ? (order.flexShipCompanyFee ?? flexCompanyFeeValue)
      : 0;

  const netProfit = isReturnedOrFailed
    ? flexPaidAmount - carrierCost - flexCompanyFeePaid
    : baseRevenue - safeDiscount + (extraAdjustment < 0 ? extraAdjustment : 0) - totalExpenses;

  const profitLabel = isReturnedOrFailed
    ? netProfit >= 0
      ? "صافي ربح تسوية الشحن"
      : "الخسارة الفعلية الموقعة"
    : order.status === "تم_التحصيل"
      ? "الربح الصافي المحقق"
      : "الربح المتوقع من الأوردر";

  return (
    <div
      id="profit-breakdown shadow-lg"
      className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-xl space-y-6 min-w-[320px] max-w-[420px] whitespace-normal text-right"
    >
      <h4 className="text-lg font-black text-slate-800 dark:text-white pb-4 border-b border-slate-50 dark:border-slate-800">
        تفاصيل معادلة الربح والخسارة
      </h4>

      <div className="space-y-4">
        {!isReturnedOrFailed ? (
          <>
            {/* الإيرادات */}
            <div className="py-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                الإيرادات (ما يدفعه العميل):
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                  <span className="text-slate-500 font-bold">سعر المنتجات</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +
                    {safeProductPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                  <span className="text-slate-500 font-bold">
                    رسوم الشحن على العميل
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +
                    {safeShippingFee.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
                {safeAdminFee > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">
                      زيادات (رسوم إضافية)
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +
                      {safeAdminFee.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                {Math.abs(manualDifference) > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">
                      فرق التقفيل اليدوي
                    </span>
                    <span className={`font-black tabular-nums ${manualDifference > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                      {manualDifference > 0 ? "+" : ""}
                      {manualDifference.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                {inspectionRevenue > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">المعاينة</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +
                      {inspectionRevenue.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                {safeTax > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">
                      الضريبة المضافة للعميل
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +
                      {safeTax.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                {safeDiscount > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">
                      خصومات ومسماحات للعميل
                    </span>
                    <span className="font-black text-rose-500 tabular-nums">
                      -
                      {safeDiscount.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                {safeAdvance > 0 && (
                  <div className="flex flex-col gap-1 p-2 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl mb-2 border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex justify-between items-center flex-row-reverse text-sm">
                      <span className="text-slate-500 font-bold">عربون / دفعة مقدمة</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +
                        {safeAdvance.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ج.م
                      </span>
                    </div>
                    <div className="flex justify-between items-center flex-row-reverse text-xs pt-1 border-t border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                      <span className="font-bold">العهدة / جهة الاستلام:</span>
                      <span className="font-black">{getAdvancePaymentCustodyName(order, settings, treasury)}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center flex-row-reverse text-sm bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg mt-2 border border-slate-100 dark:border-slate-700/50">
                  <span className="text-slate-700 dark:text-slate-300 font-black">
                    إجمالي الإيرادات المحسوبة للربح =
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +
                    {(
                      baseRevenue - safeDiscount + extraAdjustment
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
              </div>
            </div>

            {/* التكاليف */}
            <div className="py-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 mt-1">
                المصروفات والتكاليف:
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                  <span className="text-slate-500 font-bold">
                    تكلفة شراء المنتجات
                  </span>
                  <span className="font-black text-rose-500 tabular-nums">
                    -
                    {safeProductCost.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                  <span className="text-slate-500 font-bold">
                    تكلفة بوليصة الشحن (للشركة)
                  </span>
                  <span className="font-black text-rose-500 tabular-nums">
                    -
                    {standardShippingFee.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
                {insuranceFee > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">
                      التأمين على الشحنة
                    </span>
                    <span className="font-black text-rose-500 tabular-nums">
                      -
                      {insuranceFee.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                {bostaVatFee > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">
                      {dynamicVatLabel}
                    </span>
                    <span className="font-black text-rose-500 tabular-nums">
                      -
                      {bostaVatFee.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                {inspectionAdjustment > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">المعاينة</span>
                    <span className="font-black text-rose-500 tabular-nums">
                      -
                      {inspectionAdjustment.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                {codFee > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-sm mb-2">
                    <span className="text-slate-500 font-bold">
                      رسوم التحصيل (COD)
                    </span>
                    <span className="font-black text-rose-500 tabular-nums">
                      -
                      {codFee.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center flex-row-reverse text-sm bg-rose-50 dark:bg-rose-900/10 p-2 rounded-lg mt-2 border border-rose-100 dark:border-rose-900/30">
                  <span className="text-rose-700 dark:text-rose-300 font-black">
                    إجمالي المصروفات =
                  </span>
                  <span className="font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    -
                    {totalExpenses.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Returned/Failed loss presentation breakdown */
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-400 font-bold mb-2">
              ⚠️ تم إلغاء بيع الشحنة بسبب المرتجع. تم إرجاع المنتجات ذات تكلفة (
              {safeProductCost.toLocaleString()} ج.م) للمخزون دون أي خسارة في
              قيمة السلعة نفسها.
            </div>

            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              حساب مصروفات الشحن الضائعة:
            </p>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center flex-row-reverse text-sm">
                <span className="text-slate-500 font-semibold">
                  بوليصة الشحن (الذهاب):
                </span>
                <span className="font-black text-rose-500">
                  -
                  {standardShippingFee.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ج.م
                </span>
              </div>
              {insuranceFee > 0 && (
                <div className="flex justify-between items-center flex-row-reverse text-sm">
                  <span className="text-slate-500 font-semibold">
                    التأمين المقتطع:
                  </span>
                  <span className="font-black text-rose-500">
                    -
                    {insuranceFee.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
              )}
              {bostaVatFee > 0 && (
                <div className="flex justify-between items-center flex-row-reverse text-sm">
                  <span className="text-slate-500 font-semibold">
                    ضريبة القيمة المضافة للبوليصة:
                  </span>
                  <span className="font-black text-rose-500">
                    -
                    {bostaVatFee.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
              )}
              {isReturnedOrFailed && inspectionAdjustment > 0 && (
                <div className="flex justify-between items-center flex-row-reverse text-sm">
                  <span className="text-slate-500 font-semibold">
                    رسوم المعاينة:
                  </span>
                  <span className="font-black text-rose-500">
                    -
                    {inspectionAdjustment.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
              )}
              {isReturnedOrFailed && returnFeeAmount > 0 && (
                <div className="flex justify-between items-center flex-row-reverse text-sm">
                  <span className="text-slate-500 font-semibold">
                    رسوم المرتجع لشركة الشحن:
                  </span>
                  <span className="font-black text-rose-500">
                    -
                    {returnFeeAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
              )}
              <div className="h-[1px] bg-slate-200/50 dark:bg-slate-700/50" />
              <div className="flex justify-between items-center flex-row-reverse text-sm font-bold text-rose-700 dark:text-rose-400">
                <span>إجمالي خسائر الشحن لشركة النقل:</span>
                <span>
                  -
                  {carrierCost.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ج.م
                </span>
              </div>
            </div>

            {/* Interactive Explanation card */}
            <div className="p-4 bg-violet-500/5 border border-violet-550/20 dark:border-violet-500/20 rounded-2xl text-xs space-y-2 mt-4">
              <h5 className="font-black text-violet-800 dark:text-violet-405 flex items-center justify-end gap-1.5">
                💡 كيف يتم تفادي هذه الخسائر بالفليكس شيب المعجل؟
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                عندما يرفض المستلم الاستلام، يتم استدعاء خدمة فليكس شيب للمطالبة
                بـ{" "}
                <strong className="text-violet-750 font-black">
                  {flexFeeValue} ج.م
                </strong>
                .
              </p>
              <div className="space-y-1.5 mt-2 pt-2 border-t border-violet-200/50 dark:border-violet-850/50 text-[11px]">
                <div className="flex justify-between items-center flex-row-reverse text-slate-700 dark:text-slate-300">
                  <span>خسارة بوليصة الذهاب:</span>
                  <span>
                    -
                    {carrierCost.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
                {flexCompanyFeePaid > 0 && (
                  <div className="flex justify-between items-center flex-row-reverse text-rose-500">
                    <span>استقطاع شركة الشحن من فليكس شيب:</span>
                    <span>
                      -
                      {flexCompanyFeePaid.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ج.م
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center flex-row-reverse text-emerald-600 dark:text-emerald-400">
                  <span>الفليكس شيب المسترد من العميل:</span>
                  <span>
                    +
                    {flexPaidAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
                <div className="h-[1.5px] bg-violet-200/50 dark:bg-violet-850/50" />
                <div className="flex justify-between items-center flex-row-reverse font-black text-indigo-700 dark:text-indigo-400 text-xs">
                  <span>صافي الخسارة الفعلية المترتبة:</span>
                  <span
                    className={
                      netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                    }
                  >
                    {netProfit.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-normal text-right mt-1 bg-white/50 dark:bg-slate-900/40 p-2 rounded-xl">
                {flexPaidAmount > 0 ? (
                  <span className="text-emerald-600 font-black">
                    ✓ فليكس الكابتن نشط! لقد وفرت{" "}
                    {Math.round(
                      ((flexPaidAmount - flexCompanyFeePaid) / carrierCost) *
                        100,
                    )}
                    % من تكلفة البوليصة بفضل تحصيل الرسوم من العميل (بعد عمولة
                    شركة الشحن).
                  </span>
                ) : (
                  <span className="text-rose-600 font-black">
                    ℹ️ العميل لم يدفع فليكس شيب (رفض السداد)، لذا تتحمل الشركة
                    خسارة الشحن كاملة بقيمة{" "}
                    {carrierCost.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cash Collection & Advance Payment Breakdown */}
        {!isReturnedOrFailed && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2 mt-4 text-xs font-bold font-sans">
            <div className="flex justify-between items-center flex-row-reverse">
              <span className="text-slate-500">إجمالي فاتورة العميل:</span>
              <span className="text-slate-700 dark:text-slate-300">
                {(amountCollectedFromCustomer + safeAdvance + safeCredit + safeReturnCash).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}{" "}
                ج.م
              </span>
            </div>
            {safeAdvance > 0 && (
              <div className="space-y-1.5 py-1.5 border-y border-slate-100/50 dark:border-slate-800/50 my-1">
                <div className="flex justify-between items-center flex-row-reverse text-teal-600 dark:text-teal-400 font-bold">
                  <span>العربون المستلم مقدماً:</span>
                  <span>
                    -
                    {safeAdvance.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center flex-row-reverse text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                  <span className="flex items-center gap-1.5"><WalletIcon size={14} /> في عهدة (مكان حفظ العربون):</span>
                  <span className="font-black text-slate-900 dark:text-white">{getAdvancePaymentCustodyName(order, settings, treasury)}</span>
                </div>
                {(order.advancePaymentRecipientPhone ||
                  order.advancePaymentSenderDetails) && (
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-xl mt-1">
                    {order.advancePaymentRecipientPhone && (
                      <div className="flex justify-between items-center flex-row-reverse">
                        <span>رقم المستلم:</span>{" "}
                        <span className="font-black text-slate-700 dark:text-slate-300">
                          {order.advancePaymentRecipientPhone}
                        </span>
                      </div>
                    )}
                    {order.advancePaymentSenderDetails && (
                      <div className="flex justify-between items-center flex-row-reverse mt-1">
                        <span>المحول (من):</span>{" "}
                        <span className="font-black text-slate-700 dark:text-slate-300">
                          {order.advancePaymentSenderDetails}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Advance Payment History Log - Mini View */}
            {order.advancePaymentHistory && order.advancePaymentHistory.length > 0 && (
              <div className="mt-3 p-3 bg-white/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-end gap-1.5">
                   سجل العربون <History size={10} />
                </h5>
                <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar">
                  {order.advancePaymentHistory.slice().reverse().map((log: any) => (
                    <div key={log.id} className="text-right p-2 bg-slate-100/50 dark:bg-slate-800/40 rounded-xl border border-slate-50 dark:border-slate-800/50">
                      <div className="flex justify-between items-center mb-1 flex-row-reverse">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                          log.action === 'created' ? 'bg-emerald-50 text-emerald-600' : 
                          log.action === 'deleted' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {log.action === 'created' ? 'إضافة' : log.action === 'deleted' ? 'مسح' : 'تعديل'}
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold">
                          {new Date(log.timestamp).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline flex-row-reverse">
                         <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                           {log.amount.toLocaleString()} ج.م
                         </span>
                         <span className="text-[8px] text-slate-400 font-medium">
                           {log.userName}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center flex-row-reverse text-indigo-600 dark:text-indigo-400 border-t border-slate-200/50 dark:border-slate-800/50 pt-1.5 font-black text-sm">
              <span>المتبقي للتحصيل عند الاستلام:</span>
              <span>
                {Math.max(
                  0,
                  amountCollectedFromCustomer,
                ).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                ج.م
              </span>
            </div>
          </div>
        )}

        {/* Flex Ship Service Display */}
        {(() => {
          const isFlexEnabled = order.enableFlexShip !== undefined
            ? order.enableFlexShip
            : (useCustom
              ? (compFees?.enableFlexShip ?? false)
              : (settings.enableFlexShip ?? false));
          const flexFee = order.flexShipFee !== undefined 
            ? order.flexShipFee 
            : (useCustom
              ? (compFees?.flexShipFee ?? 0)
              : (settings.flexShipFee ?? 0));
          const flexCompanyFee = order.flexShipCompanyFee !== undefined
            ? order.flexShipCompanyFee
            : (useCustom
              ? (compFees?.flexShipCompanyFee ?? 0)
              : (settings.flexShipCompanyFee ?? 0));
          if (isFlexEnabled && flexFee > 0 && !isReturnedOrFailed) {
            return (
              <div className="p-4 bg-violet-50 dark:bg-violet-950/20 rounded-2xl border border-violet-100 dark:border-violet-900/40 text-xs text-right mt-4 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center flex-row-reverse text-violet-800 dark:text-violet-400 font-bold">
                  <span className="flex items-center gap-1 font-black">
                    <Truck size={14} className="inline" /> خدمة فليكس شيب (Flex
                    Ship)
                  </span>
                  <span className="bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full text-[10px]">
                    نشط
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                  يُطالب المستلم بدفع رسوم إضافية بقيمة{" "}
                  <strong className="text-violet-700 dark:text-violet-400 font-black">
                    {flexFee} ج.م
                  </strong>{" "}
                  إذا رفض استلام الشحنة، ويستقطع منها لشركة الشحن{" "}
                  <strong className="text-rose-700 dark:text-rose-400 font-black">
                    {flexCompanyFee} ج.م
                  </strong>
                  .
                </p>
              </div>
            );
          }
          return null;
        })()}
      </div>

      <div
        className={`mt-6 p-5 rounded-3xl flex justify-between items-center flex-row-reverse ${netProfit >= 0 ? "bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/50" : "bg-rose-50 border border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/50"}`}
      >
        <span
          className={`text-sm font-black ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}
        >
          {profitLabel}
        </span>
        <div className="flex items-baseline gap-1 flex-row-reverse">
          <span
            className={`text-2xl font-black ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
          >
            {netProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs font-bold opacity-60">ج.م</span>
        </div>
      </div>
    </div>
  );
};

const ProductDetailsList: React.FC<{ order: Order }> = ({ order }) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem] p-6 border border-slate-100 dark:border-slate-800 shadow-inner w-full max-w-xl mx-auto my-4 space-y-6 whitespace-normal">
      <h5 className="text-sm font-black text-slate-400 flex items-center justify-end gap-2 px-4 italic uppercase tracking-wider">
        تفاصيل المنتجات ({(order.items || []).length}) <Info size={14} />
      </h5>

      <div className="space-y-4">
        {(order.items || []).map((item, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 p-4 rounded-3xl flex items-center gap-4 flex-row-reverse border border-slate-50 dark:border-slate-800 shadow-sm group hover:border-indigo-200 transition-colors"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-100 dark:border-slate-700">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Package size={24} className="m-auto text-slate-300" />
              )}
            </div>
            <div className="flex-1 text-right">
              <p className="text-sm font-black text-slate-800 dark:text-white leading-tight mb-1">
                {item.name}
              </p>
              <p className="text-[10px] font-bold text-slate-400 line-clamp-1">
                {item.description || "لم يتم إضافة وصف"}
              </p>
              <div className="flex items-center gap-3 justify-end mt-2">
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {item.price} ج.م
                </span>
                <span className="text-[10px] font-bold text-slate-300">×</span>
                <span className="text-xs font-black text-slate-600 dark:text-slate-400">
                  {item.quantity}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const OrderRow = ({
  order,
  isSelected,
  onSelect,
  onStatusChange,
  onPaymentChange,
  onEdit,
  onDelete,
  onPrintInvoice,
  onPrintLabel,
  onCollect,
  onStartExchange,
  onPostReturn,
  onShowSummary,
  onShowAudit,
  onShowAssignment,
  onShowDetails,
  onToggleFlexShipPaid,
  whatsappLink,
  settings,
  anyFlexShipEnabled,
  treasury,
}: {
  order: Order;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: OrderStatus) => void;
  onPaymentChange: (status: PaymentStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPrintInvoice: () => void;
  onPrintLabel: () => void;
  onCollect: (inspectionPaid: boolean) => void;
  onStartExchange: () => void;
  onPostReturn: () => void;
  onShowSummary: () => void;
  onShowAudit: () => void;
  onShowAssignment: () => void;
  onShowDetails: () => void;
  onToggleFlexShipPaid?: () => void;
  whatsappLink: string;
  settings: Settings;
  anyFlexShipEnabled?: boolean;
  treasury?: any;
  key?: any;
}) => {
  const navigate = useNavigate();
  const statusInfo = ORDER_STATUS_METADATA[order.status] || {
    label: order.status,
    color: "bg-slate-500",
    icon: "Package",
  };
  const StatusIcon =
    {
      PhoneForwarded,
      FileSearch,
      Package,
      Truck,
      CheckCircle,
      Coins,
      RefreshCcw,
      XCircle,
      Archive,
    }[statusInfo.icon as string] || Package;
  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeTax = Number(order.tax) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeProductCost = Number(order.productCost) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;

  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  const isPosOrder =
    order.channel === "pos" || order.shippingCompany === "كاشير - بيع مباشر";
  const insuranceRate = useCustom
    ? (compFees?.insuranceFeePercent ?? 0)
    : settings.enableInsurance
      ? settings.insuranceFeePercent
      : 0;
  const insuranceFee = isPosOrder
    ? 0
    : (order.isInsured ?? true)
      ? calculateInsuranceFee(order, insuranceRate, settings)
      : 0;
  const inspectionFeeAmount =
    !isPosOrder && (order.includeInspectionFee ?? true)
      ? useCustom
        ? (compFees?.inspectionFee ?? 0)
        : settings.enableInspection
          ? settings.inspectionFee
          : 0
      : 0;
  const inspectionFee = (order.inspectionFeePaidByCustomer !== false && order.includeInspectionFee !== false) ? inspectionFeeAmount : 0;
  const bostaVatFee = isPosOrder
    ? 0
    : calculateBostaVat(order, insuranceFee, settings);

  const safeCredit = Number(order.creditAmount) || 0;
  const safeReturnCash =
    order.returnCashToCustomer && order.cashToReturnAmount
      ? Number(order.cashToReturnAmount)
      : 0;
  const orderTotalValue = Math.max(0, Math.round(safeProductPrice + safeShippingFee + safeTax + inspectionFee - safeDiscount));
  const computedTotal = Math.max(
    0,
    Math.round(
      orderTotalValue -
        safeAdvance -
        safeCredit -
        safeReturnCash,
    ),
  );
  const totalAmount =
    order.totalAmountOverride !== undefined &&
    order.totalAmountOverride !== null
      ? Math.max(0, Math.round(Number(order.totalAmountOverride)))
      : computedTotal;
  const displayTotal =
    order.source === "synced" && order.totalPrice != null
      ? Number(order.totalPrice) + inspectionFee
      : totalAmount;

  const standardInspectionFee = (order.includeInspectionFee !== false) ? inspectionFeeAmount : 0;
  const standardRequiredTotal = Math.max(
    0,
    Math.round(
      safeProductPrice +
        safeShippingFee +
        safeTax +
        standardInspectionFee -
        safeDiscount -
        safeAdvance -
        safeCredit -
        safeReturnCash,
    ),
  );

  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case "تم_التحصيل":
      case "تم_توصيلها":
      case "تم_التوصيل":
      case "مدفوعة":
        return "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
      case "مرتجع":
      case "فشل_التوصيل":
      case "مرتجع_جزئي":
      case "مرتجع_بعد_الاستلام":
        return "bg-rose-50 text-rose-605 border-rose-100 dark:bg-rose-500/10 dark:text-rose-405 dark:border-rose-500/20";
      case "في_انتظار_المكالمة":
      case "جاري_المراجعة":
        return "bg-indigo-50 text-indigo-650 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
      default:
        return "bg-slate-50 text-slate-650 border-slate-100 dark:bg-slate-500/10 dark:text-slate-405 dark:border-slate-500/20";
    }
  };
  const attemptsCount = (order.callAttempts || []).length;

  const isFlexShipEnabled =
    order.enableFlexShip !== undefined
      ? order.enableFlexShip
      : useCustom
        ? (compFees?.enableFlexShip ?? false)
        : (settings.enableFlexShip ?? false);
  const flexFeeValue = isFlexShipEnabled
    ? (order.flexShipFee !== undefined ? order.flexShipFee : (useCustom
      ? (compFees?.flexShipFee ?? 0)
      : (settings.flexShipFee ?? 0)))
    : 0;

  const { net } = calculateOrderProfitLoss(order, settings);
  const currentNetProfit = net;
  const isDelivered =
    order.status === "تم_التحصيل" ||
    order.status === "تم_توصيلها" ||
    order.status === "تم_التوصيل" ||
    order.status === "مدفوعة";
  const profitLabel = isDelivered ? "الربح الصافي" : "الربح المتوقع";
  const isProfitable = currentNetProfit >= 0;

  const [isExpanded, setIsExpanded] = useState(false);
  const [showOps, setShowOps] = useState(false);
  const opsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (opsRef.current && !opsRef.current.contains(e.target as Node)) {
        setShowOps(false);
      }
    };
    if (showOps) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showOps]);
  const [showProfitPopover, setShowProfitPopover] = useState(false);
  const [showShippingPopover, setShowShippingPopover] = useState(false);

  return (
    <>
      <tr
        className={`group transition-all duration-300 ${isSelected ? "bg-indigo-50/50 dark:bg-indigo-500/[0.05]" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"} border-b border-slate-100/50 dark:border-white/5 last:border-0 relative`}
      >
        <td className="p-6 text-center w-12">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="w-5 h-5 rounded-lg border-slate-300 dark:bg-slate-900 dark:border-slate-700 text-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all cursor-pointer"
            />
          </div>
        </td>
        <td className="p-6 cursor-pointer" onClick={onShowDetails}>
          <div className="flex items-center gap-4 flex-row-reverse">
            <div
              className="relative group/status"
              onClick={(e) => {
                e.stopPropagation();
                onShowAudit();
              }}
            >
              <div
                className={`w-12 h-12 rounded-[1.25rem] ${statusInfo.color} flex items-center justify-center text-white shadow-lg shadow-black/5 group-hover/status:scale-110 transition-transform duration-300 cursor-pointer`}
              >
                <StatusIcon size={20} />
              </div>
              {order.platform && order.platform !== "system" && (
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#0b0f19] p-0.5 rounded-full shadow-sm border border-slate-200/50 dark:border-white/10">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white uppercase ${
                      order.platform === "wuilt"
                        ? "bg-black"
                        : order.platform === "salla"
                          ? "bg-[#004d5a]"
                          : order.platform === "shopify"
                            ? "bg-[#95bf47]"
                            : "bg-indigo-600"
                    }`}
                  >
                    {order.platform.substring(0, 1)}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1 justify-end">
                {order.channel !== "pos" &&
                  !order.shippingCompany?.startsWith("كاشير -") && (
                    <ShipmentTypeBadge type={order.shipmentType} />
                  )}
                <PosSourceBadge order={order} />
                <h4
                  className="text-[13px] font-black text-slate-900 dark:text-white tracking-tighter cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDetails();
                  }}
                >
                  #{order.orderNumber}
                </h4>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-500 hover:scale-110 transition-transform p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg"
                >
                  <MessageCircle size={14} />
                </a>
              </div>
              <div className="group/customer relative inline-block text-right">
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  {order.recordedAsDebt && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-[9px] font-black border border-rose-100 dark:border-rose-500/20">
                      <Banknote size={10} />
                      <span>دين</span>
                    </div>
                  )}
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-help transition-colors group-hover/customer:text-indigo-600">
                    {order.customerName}
                  </div>
                </div>
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 flex items-center gap-2 justify-end mt-1 fade-in opacity-80 group-hover/customer:opacity-100 transition-opacity">
                  <span className="tabular-nums tracking-wide">
                    {order.customerPhone}
                  </span>
                  <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full"></span>
                  <span>
                    {new Date(order.date).toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </td>
        <td className="p-6">
          <div className="max-w-[200px] text-right flex flex-col items-end">
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center justify-end gap-2 p-1.5 px-3 rounded-full transition-all duration-300 cursor-pointer border ${isExpanded ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20" : "bg-slate-50 dark:bg-slate-900 border-slate-200/50 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"}`}
            >
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180 text-indigo-500" : ""}`}
              />
              <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                <span>{(order.items || []).length}</span>
                <Package size={10} className="ml-1" />
              </div>
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px] border-r border-slate-200 dark:border-slate-700/50 pr-2">
                {(order.items || []).length > 0
                  ? ((order.items || [])[0].name || "").substring(0, 15) + "..."
                  : "---"}
              </div>
            </div>
          </div>
        </td>
        {/* 4. مبلغ التحصيل */}
        <td className="p-6">
          <div className="text-right space-y-1 relative">
            <div className="flex flex-col items-end gap-1 justify-end group/collection">
              <div className="flex items-baseline gap-1 justify-end flex-row-reverse">
                <span className={`text-lg font-black tabular-nums drop-shadow-sm ${isPosOrder && displayTotal === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {(isPosOrder && displayTotal === 0 ? orderTotalValue : displayTotal).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 relative top-[-2px]">
                  ج.م
                </span>
              </div>
              {isPosOrder && displayTotal === 0 && (
                <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/30">
                  مدفوع بالكامل (كاشير)
                </div>
              )}
              {safeTax > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 mt-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-md">
                  <Receipt size={10} />
                  <span className="text-[9px] font-black">ضريبة: {safeTax.toLocaleString()} ج.م</span>
                </div>
              )}
              {safeAdvance > 0 && !(isPosOrder && displayTotal === 0) && (
                <div className="flex flex-col items-end gap-0.5 px-2 py-1 mt-1 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg border border-teal-200/50 dark:border-teal-800/40 w-max ml-auto text-[9px]">
                  <div className="flex items-center gap-1 font-black">
                    <Coins size={10} />
                    <span>عربون مقدم: -{safeAdvance.toLocaleString()} ج.م</span>
                  </div>
                  <div className="font-bold text-[8px] opacity-90">
                    في عهدة: {getAdvancePaymentCustodyName(order, settings, treasury)}
                  </div>
                </div>
              )}
              {isPosOrder && displayTotal === 0 && (
                <div className="flex flex-col items-end gap-0.5 px-2 py-1 mt-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200/50 dark:border-indigo-800/40 w-max ml-auto text-[9px]">
                   <div className="flex items-center gap-1 font-black">
                    <Coins size={10} />
                    <span>تم التحصيل نقداً: {orderTotalValue.toLocaleString()} ج.م</span>
                  </div>
                  <div className="font-bold text-[8px] opacity-90">
                    {isPosOrder && displayTotal === 0 ? (order.cashHolderId === 'wallet' ? "جهة الإيداع:" : "جهة التحصيل:") : "في عهدة:"} {resolveCashHolderName(order, settings)}
                  </div>
                </div>
              )}
              {displayTotal !== standardRequiredTotal && (
                <div className="flex flex-col items-end gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-xl border border-slate-100/50 dark:border-slate-800/50">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-[9px]">المطلوب:</span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">
                      {standardRequiredTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })} ج.م
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-[9px]">الفعلي:</span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">
                      {displayTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })} ج.م
                    </span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 flex items-center gap-1.5 justify-end mix-blend-multiply dark:mix-blend-normal mt-1">
              <span className="text-indigo-600 dark:text-indigo-400">
                {order.shippingCompany}
              </span>
              <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
              <span className="truncate max-w-[80px]">{order.governorate}</span>
            </p>
          </div>
        </td>

        {/* 5. رسوم فليكس شيب */}
        {anyFlexShipEnabled && (
          <td className="p-6 text-right">
            {isFlexShipEnabled ? (
              <div className="inline-flex flex-col items-end gap-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
                <div className="flex items-center gap-1 justify-end">
                  <span
                    className="cursor-help text-slate-300 hover:text-indigo-500 transition-colors"
                    title={isDelivered ? "تم تسليم الشحنة بنجاح، ولا ينطبق عليها رسوم فليكس شيب" : "رسوم فليكس شيب المستحقة"}
                  >
                    <Info size={10} className="inline-block" />
                  </span>
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 tabular-nums">
                    {flexFeeValue} ج.م
                  </span>
                </div>
                <span
                  className={`text-[8px] font-bold block ${["مرتجع", "فشل_التوصيل", "مرتجع_بعد_الاستلام", "مرتجع_جزئي", "ملغي"].includes(order.status) ? "text-amber-500" : "text-slate-400"}`}
                >
                  {[
                    "مرتجع",
                    "فشل_التوصيل",
                    "مرتجع_بعد_الاستلام",
                    "مرتجع_جزئي",
                    "ملغي",
                  ].includes(order.status)
                    ? (order.flexShipFeePaidByCustomer ? "مدفوعة" : "مستحق للفصل")
                    : "غير مستحق"}
                </span>
              </div>
            ) : (
              <div className="font-medium text-slate-400 dark:text-slate-500 text-center text-xs">
                غير مُطبَّق
              </div>
            )}
          </td>
        )}

        {/* 6. الحالة */}
        <td className="p-6">
          <div className="relative group/status-select inline-block text-right">
            <div
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border transition-all duration-300 ${getStatusBadgeStyle(order.status)}`}
            >
              <span>{statusInfo.label}</span>
              {order.status === "تم_التحصيل" ? (
                <span>✓</span>
              ) : (
                <StatusIcon size={12} className="opacity-80" />
              )}
              <ChevronDown
                size={10}
                className="opacity-40 group-hover/status-select:opacity-100 transition-opacity"
              />

              <select
                value={
                  ["تم_توصيلها", "تم_التوصيل", "تم_التحصيل", "مدفوعة"].includes(
                    order.status,
                  )
                    ? "تم_التوصيل"
                    : order.status
                }
                onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              >
                {ORDER_STATUSES.map((s) => (
                  <option
                    key={s}
                    value={s}
                    className="text-slate-900 bg-white font-bold"
                  >
                    {ORDER_STATUS_METADATA[s]?.label || s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </td>

        {/* 7. المحاولات */}
        <td className="p-6">
          <div className="flex items-center gap-2 justify-center text-xs font-bold text-slate-600 dark:text-slate-400 font-sans">
            <div className="relative w-4 h-[22px] border border-slate-200/80 dark:border-slate-700/80 rounded-[4px] p-[2px] flex flex-col justify-end gap-[1.5px] bg-slate-50/50 dark:bg-slate-800/20 shadow-xs">
              <div className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-1.5 h-[2px] bg-slate-200 dark:bg-slate-700 rounded-t-[1px]" />
              <div
                className={`h-1.5 rounded-[1px] transition-colors duration-500 ${attemptsCount >= 3 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-100 dark:bg-slate-800"}`}
              />
              <div
                className={`h-1.5 rounded-[1px] transition-colors duration-500 ${attemptsCount >= 2 ? (attemptsCount >= 3 ? "bg-emerald-500" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]") : "bg-slate-100 dark:bg-slate-800"}`}
              />
              <div
                className={`h-1.5 rounded-[1px] transition-colors duration-500 ${attemptsCount >= 1 ? (attemptsCount >= 2 ? (attemptsCount >= 3 ? "bg-emerald-500" : "bg-amber-500") : "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]") : "bg-indigo-500/30"}`}
              />
            </div>
            <span className="tabular-nums font-extrabold text-[10px] relative top-[1px] opacity-70">
              {attemptsCount === 0 ? "1" : attemptsCount}/3
            </span>
          </div>
        </td>

        {/* 8. حالة المبلغ المحصل */}
        <td className="p-6 text-center">
          <span
            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider text-center inline-block cursor-default transition-all duration-300 shadow-xs border ${
              order.paymentStatus === "مدفوع"
                ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                : "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
            }`}
          >
            {order.paymentStatus === "مدفوع" ? "مدفوع" : "غير مدفوع"}
          </span>
        </td>
        <td className="p-6">
          <div className="flex items-center gap-2 justify-end">
            <div className="relative" ref={opsRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOps(!showOps);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[11px] transition-all duration-300 shadow-xs active:scale-95 border ${isSelected ? "bg-indigo-600 border-indigo-600 text-white shadow-indigo-600/20" : "bg-white dark:bg-[#0b0f19] border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-indigo-200 dark:hover:border-indigo-500/30"}`}
              >
                <span>العمليات</span>
                <ChevronDown
                  size={14}
                  className={`${showOps ? "rotate-180 text-indigo-400" : "text-slate-400"} transition-transform duration-300`}
                />
              </button>

              <AnimatePresence>
                {showOps && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute top-full left-0 mt-2 w-64 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-2xl rounded-[1.75rem] shadow-2xl border border-slate-200/80 dark:border-white/10 p-2 z-[60] origin-top-left divide-y divide-slate-100 dark:divide-white/5"
                  >
                    {/* SECTION 1: DAILY ACTIONS */}
                    <div className="pb-2 space-y-0.5">
                      <div className="px-3 py-1.5">
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block text-right">
                          ⚡ إجراءات المتابعة والتعديل
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOps(false);
                          onEdit();
                        }}
                        className="w-full text-right p-2.5 hover:bg-indigo-50/80 dark:hover:bg-indigo-500/10 rounded-xl flex items-center justify-end gap-3 transition-all group"
                      >
                        <div className="text-right flex-1">
                          <span className="text-xs font-black text-slate-800 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            تعديل بيانات الطلب
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            تغيير العميل، العنوان أو المنتجات
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Edit3 size={15} />
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOps(false);
                          onShowAssignment();
                        }}
                        className="w-full text-right p-2.5 hover:bg-indigo-50/80 dark:hover:bg-indigo-500/10 rounded-xl flex items-center justify-end gap-3 transition-all group"
                      >
                        <div className="text-right flex-1">
                          <span className="text-xs font-black text-slate-800 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            تعيين موظف مسؤول
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            تخصيص الطلب لمتابعة موظف
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <UserIcon size={15} />
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOps(false);
                          onPaymentChange(
                            order.paymentStatus === "مدفوع"
                              ? "بانتظار الدفع"
                              : "مدفوع",
                          );
                        }}
                        className="w-full text-right p-2.5 hover:bg-emerald-50/80 dark:hover:bg-emerald-500/10 rounded-xl flex items-center justify-end gap-3 transition-all group"
                      >
                        <div className="text-right flex-1">
                          <span className="text-xs font-black text-slate-800 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {order.paymentStatus === "مدفوع"
                              ? "تحديد كـ معلق (غير مدفوع)"
                              : "تحديد كـ مدفوع ومسوى"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            تحديث حالة التحصيل والمحفظة
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Coins size={15} />
                        </div>
                      </button>
                    </div>

                    {/* SECTION 2: DOCUMENTS & SHIPPING */}
                    <div className="py-2 space-y-0.5">
                      <div className="px-3 py-1.5">
                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block text-right">
                          📦 المستندات والشحن
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOps(false);
                          onPrintInvoice();
                        }}
                        className="w-full text-right p-2.5 hover:bg-purple-50/80 dark:hover:bg-purple-500/10 rounded-xl flex items-center justify-end gap-3 transition-all group"
                      >
                        <div className="text-right flex-1">
                          <span className="text-xs font-black text-slate-800 dark:text-white block group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            طباعة الفاتورة للعميل
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            إصدار فاتورة ضريبية منسقة
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Printer size={15} />
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOps(false);
                          onPrintLabel();
                        }}
                        className="w-full text-right p-2.5 hover:bg-purple-50/80 dark:hover:bg-purple-500/10 rounded-xl flex items-center justify-end gap-3 transition-all group"
                      >
                        <div className="text-right flex-1">
                          <span className="text-xs font-black text-slate-800 dark:text-white block group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            بوليصة الشحن والتجهيز
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            طباعة بوليصة ولصقة الطرد
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <LayoutList size={15} />
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOps(false);
                          navigate("/orders/new", {
                            state: { exchangeData: order },
                          });
                        }}
                        className="w-full text-right p-2.5 hover:bg-purple-50/80 dark:hover:bg-purple-500/10 rounded-xl flex items-center justify-end gap-3 transition-all group"
                      >
                        <div className="text-right flex-1">
                          <span className="text-xs font-black text-slate-800 dark:text-white block group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            إنشاء استبدال أو مرتجع
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            فتح طلب بديل أو تسوية مرتجع
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <RefreshCcw size={15} />
                        </div>
                      </button>
                    </div>

                    {/* SECTION 3: MANAGEMENT & DELETION */}
                    <div className="pt-2 space-y-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowOps(false);
                          if (
                            confirm(
                              "هل أنت متأكد من حذف هذا الطلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء وسيتم إزالته من قاعدة البيانات.",
                            )
                          ) {
                            onDelete();
                          }
                        }}
                        className="w-full text-right p-2.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl flex items-center justify-end gap-3 transition-all group"
                      >
                        <div className="text-right flex-1">
                          <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                            حذف الطلب نهائياً
                          </span>
                          <span className="text-[10px] font-bold text-rose-400/80 block">
                            مسح السجل من قاعدة البيانات
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Trash2 size={15} />
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </td>
      </tr>
      <AnimatePresence>
        {isExpanded && (
          <tr className="border-b border-indigo-100/50 dark:border-indigo-500/10 bg-indigo-50/30 dark:bg-indigo-500/5 relative before:absolute before:inset-y-0 before:right-0 before:w-1 before:bg-indigo-500">
            <td colSpan={12} className="p-0 border-none">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col md:flex-row gap-6 p-6 md:p-8">
                  <div className="flex-1">
                    <ProductDetailsList order={order} />
                  </div>
                  <div className="w-full md:w-[350px]">
                    <ProfitBreakdown
                      order={order}
                      settings={settings}
                      onToggleFlexShipPaid={onToggleFlexShipPaid}
                    />
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
};

const KanbanView: React.FC<{
  orders: Order[];
  onStatusChange: (id: string, newStatus: OrderStatus) => void;
  onEdit: (order: Order) => void;
  settings: Settings;
  treasury?: any;
}> = ({ orders, onStatusChange, onEdit, settings, treasury }) => {
  const [activeStatusDropdown, setActiveStatusDropdown] = useState<string | null>(null);

  const columns: OrderStatus[] = [
    "في_انتظار_المكالمة",
    "جاري_المراجعة",
    "قيد_التنفيذ",
    "تم_الارسال",
    "تم_التحصيل",
    "مرتجع",
    "فشل_التوصيل",
    "ملغي",
  ];

  const statusColors: Record<OrderStatus, string> = {
    في_انتظار_المكالمة: "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    جاري_المراجعة: "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    قيد_التنفيذ: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    تم_الارسال: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    قيد_الشحن: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    تم_توصيلها: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    تم_التوصيل: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    تم_التحصيل: "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    مدفوعة: "border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
    مرتجع: "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    مرتجع_بعد_الاستلام: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    تم_الاستبدال: "border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    مرتجع_جزئي: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    فشل_التوصيل: "border-rose-600 bg-rose-600/10 text-rose-700 dark:text-rose-300",
    تمت_الاعادة_لشركة_الشحن: "border-rose-800 bg-rose-800/10 text-rose-800 dark:text-rose-300",
    ملغي: "border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    مؤرشف: "border-slate-500 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    مؤجل: "border-amber-600 bg-amber-600/10 text-amber-700 dark:text-amber-300",
    مجدول: "border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300",
  };

  return (
    <div className="flex gap-6 p-4 md:p-6 overflow-x-auto min-h-[75vh] no-scrollbar scroll-smooth">
      {columns.map((status, idx) => {
        const columnOrders = orders.filter((o) => o.status === status);
        const columnTotalSum = columnOrders.reduce(
          (sum, o) => sum + (Number(o.totalAmountOverride ?? o.productPrice) || 0),
          0,
        );

        return (
          <div
            key={status}
            className="flex-shrink-0 w-[350px] flex flex-col gap-4"
          >
            {/* Upgraded Column Header with Stats */}
            <div
              className={`p-4 rounded-[1.75rem] border-t-4 shadow-sm ${statusColors[status].split(" ")[0]} bg-white/95 dark:bg-[#0f1523]/95 backdrop-blur-xl border border-x-slate-200/80 border-b-slate-200/80 dark:border-x-white/10 dark:border-b-white/10 flex flex-col gap-2`}
            >
              <div className="flex justify-between items-center">
                <h3 className="font-black text-slate-900 dark:text-white text-sm tracking-tight flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusColors[status].split(" ")[0].replace("border-", "bg-")}`}></span>
                  <span>{ORDER_STATUS_METADATA[status]?.label || status.replace(/_/g, " ")}</span>
                </h3>
                <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 shadow-inner">
                  {columnOrders.length} طلب
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-white/5">
                <span>إجمالي القيمة:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {columnTotalSum.toLocaleString()} <span className="text-[10px] font-normal">ج.م</span>
                </span>
              </div>
            </div>

            {/* Column Cards Container */}
            <div className="flex-1 space-y-3.5">
              {columnOrders.map((order, oIdx) => {
                const safeTax = Number(order.tax) || 0;
                const safeAdvance = Number(order.advancePayment) || 0;
                return (
                  <motion.div
                    key={order.id}
                    layoutId={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 + oIdx * 0.03 }}
                    className="bg-white/90 dark:bg-[#0f1523]/90 backdrop-blur-md p-5 rounded-[1.75rem] border border-slate-200/70 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all cursor-pointer group relative overflow-visible"
                    onClick={() => onEdit(order)}
                  >
                  {/* Left status color accent line */}
                  <div
                    className={`absolute top-0 right-0 w-1.5 h-full rounded-r-[1.75rem] opacity-70 ${statusColors[status].split(" ")[0].replace("border-", "bg-")}`}
                  ></div>

                  {/* Top Bar: Order number & Payment pill */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">
                        #{order.orderNumber || order.id.slice(0, 5)}
                      </span>
                      {order.paymentStatus === "مدفوع" ? (
                        <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          ✓ مدفوع
                        </span>
                      ) : (
                        <span className="text-[9px] font-black bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">
                          ⏳ معلق
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`, "_blank");
                        }}
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors shadow-2xs"
                        title="مراسلة واتساب"
                      >
                        <MessageCircle size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`tel:${order.customerPhone}`);
                        }}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors shadow-2xs"
                        title="اتصال مباشر"
                      >
                        <Phone size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Customer & Product */}
                  <h4 className="font-black text-slate-900 dark:text-white text-sm mb-1 line-clamp-1">
                    {order.customerName}
                  </h4>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 line-clamp-1 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-1 rounded-xl">
                    📦 {order.productName || "منتج عام"} <span className="opacity-60 font-normal">({order.items?.length || 1} أصناف)</span>
                  </p>

                  {/* Financial & Location Bottom Bar */}
                  <div className="flex justify-between items-center flex-row-reverse border-t border-slate-100 dark:border-white/5 pt-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-black text-slate-900 dark:text-white tabular-nums">
                        {(order.totalAmountOverride ?? order.productPrice).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                        ج.م
                      </span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <MapPin size={11} className="text-indigo-500" />
                      <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">
                        {order.governorate || order.shippingArea?.split("-")[0] || "---"}
                      </span>
                    </div>
                  </div>

                  {safeTax > 0 && (
                    <div className="mt-2 flex items-center justify-end gap-1 px-2 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-black w-max ml-auto">
                      <Receipt size={11} />
                      <span>ضريبة: {safeTax.toLocaleString()} ج.م</span>
                    </div>
                  )}
                  {safeAdvance > 0 && (
                    <div className="mt-2 flex flex-col items-end gap-0.5 px-2 py-1 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg text-[10px] font-black w-max ml-auto border border-teal-200/50 dark:border-teal-800/40">
                      <div className="flex items-center gap-1">
                        <Coins size={11} />
                        <span>عربون مقدم: -{safeAdvance.toLocaleString()} ج.م</span>
                      </div>
                      <span className="text-[9px] font-bold opacity-90">في عهدة: {getAdvancePaymentCustodyName(order, settings, treasury)}</span>
                    </div>
                  )}

                  {/* Assigned Employee Tag if available */}
                  {order.assignedToName && (
                    <div className="mt-2 pt-2 border-t border-slate-100/60 dark:border-white/5 flex items-center justify-end gap-1.5 text-[10px] font-bold text-slate-400">
                      <span>👤 مسؤول التوصيل: <strong className="text-slate-600 dark:text-slate-300">{order.assignedToName}</strong></span>
                    </div>
                  )}
                </motion.div>
              );
            })}

              {/* Clean Executive Empty State */}
              {columnOrders.length === 0 && (
                <div className="h-40 border-2 border-dashed border-slate-200/80 dark:border-white/10 rounded-[1.75rem] flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-600 p-6 text-center bg-white/40 dark:bg-slate-900/40">
                  <Package size={24} className="opacity-40" />
                  <span className="text-xs font-black text-slate-500 dark:text-slate-400">لا توجد شحنات هنا حالياً</span>
                  <span className="text-[10px] font-bold opacity-60">سيتم إدراج الطلبات تلقائياً فور انتقالها لهذه المرحلة</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const AuditLogModal: React.FC<{ order: Order; onClose: () => void }> = ({
  order,
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | 'status' | 'financial' | 'shipping'>('all');

  const filteredLogs = (order.auditLogs || []).filter(log => {
    if (filter === 'all') return true;
    if (filter === 'status') return log.action.includes('حالة') || log.action.includes('تغيير');
    if (filter === 'financial') return log.action.includes('مالي') || log.action.includes('سعر') || log.action.includes('عربون') || log.action.includes('سحب') || log.action.includes('إيداع');
    if (filter === 'shipping') return log.action.includes('بوليصة') || log.action.includes('شحن') || log.action.includes('بوسطة');
    return true;
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-[#0b0f19] w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-200/80 dark:border-white/10 flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="p-6 bg-slate-50/80 dark:bg-[#0f1523]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-2xl transition-colors border border-slate-200/60 dark:border-white/5"
            >
              <X size={20} />
            </button>
            <div className="text-right">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-end gap-2.5">
                <span>سجل التدقيق وتاريخ الحالات (Audit Trail)</span>
                <History className="text-indigo-500" size={22} />
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                تتبع شامل لكافة الحركات، التعديلات المالية، وتغييرات الحالة التي تمت على طلب #{order.orderNumber || order.id.slice(0,6)}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex justify-end gap-2 pt-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilter('shipping')}
              className={`px-4 py-1.5 rounded-xl font-black text-xs transition-all ${filter === 'shipping' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-white/5'}`}
            >
              📦 بوليصة وشحن
            </button>
            <button
              onClick={() => setFilter('financial')}
              className={`px-4 py-1.5 rounded-xl font-black text-xs transition-all ${filter === 'financial' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-white/5'}`}
            >
              💰 تعديلات مالية
            </button>
            <button
              onClick={() => setFilter('status')}
              className={`px-4 py-1.5 rounded-xl font-black text-xs transition-all ${filter === 'status' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-white/5'}`}
            >
              🔄 تغييرات الحالة
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-xl font-black text-xs transition-all ${filter === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/60 dark:border-white/5'}`}
            >
              الكل ({order.auditLogs?.length || 0})
            </button>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {filteredLogs.length > 0 ? (
            <div className="space-y-4 relative before:absolute before:right-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {filteredLogs.slice().reverse().map((log, idx) => {
                const isStatus = log.action.includes('حالة') || log.action.includes('تغيير');
                const isFin = log.action.includes('مالي') || log.action.includes('سعر') || log.action.includes('عربون');
                const isShip = log.action.includes('بوليصة') || log.action.includes('شحن');

                return (
                  <div key={idx} className="relative pr-12 group">
                    <div className={`absolute right-2.5 top-4 w-6 h-6 rounded-full border-4 border-white dark:border-[#0b0f19] flex items-center justify-center text-[9px] z-10 shadow-xs ${
                      isStatus ? 'bg-indigo-600 text-white' : isFin ? 'bg-emerald-600 text-white' : isShip ? 'bg-purple-600 text-white' : 'bg-slate-500 text-white'
                    }`}>
                      {isStatus ? '🔄' : isFin ? '💰' : isShip ? '📦' : '•'}
                    </div>

                    <div className="p-5 bg-slate-50/80 dark:bg-[#0f1523] rounded-2xl border border-slate-200/70 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all text-right shadow-2xs">
                      <div className="flex justify-between items-start mb-2.5 flex-row-reverse">
                        <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                          isStatus ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400' :
                          isFin ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' :
                          isShip ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400' :
                          'bg-slate-200/60 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 font-mono">
                          {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.timestamp))}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed mb-3">
                        {log.details}
                      </p>

                      <div className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-slate-400 pt-2.5 border-t border-slate-200/50 dark:border-white/5">
                        <span>المستخدم الذي قام بالإجراء: <strong className="text-slate-700 dark:text-slate-300 font-mono">{log.userEmail || 'نظام تلقائي'}</strong></span>
                        <UserIcon size={12} className="opacity-60" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 bg-slate-50/50 dark:bg-[#0f1523]/50 rounded-3xl border border-dashed border-slate-200 dark:border-white/5 space-y-2">
              <History size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-black text-slate-600 dark:text-slate-300">لا توجد سجلات مطابقة للفلتر المحدد</p>
              <p className="text-xs font-bold text-slate-400">حاول اختيار فلتر آخر أو عرض الكل</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50/80 dark:bg-[#0f1523]/80 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10 flex justify-between items-center flex-row-reverse">
          <span className="text-xs font-black text-slate-400">إجمالي الحركات: {order.auditLogs?.length || 0} حركة</span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95"
          >
            إغلاق النافذة
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AssignmentModal: React.FC<{
  order: Order;
  employees: Employee[];
  onClose: () => void;
  onAssign: (id: string, name: string) => void;
}> = ({ order, employees, onClose, onAssign }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 dark:text-white">
              تعيين موظف للطلب
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="space-y-3">
            {employees.length > 0 ? (
              employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => onAssign(emp.id, emp.name)}
                  className={`w-full p-4 rounded-2xl border-2 text-right transition-all flex justify-between items-center ${order.assignedTo === emp.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800"}`}
                >
                  <span className="font-bold text-slate-800 dark:text-white">
                    {emp.name}
                  </span>
                  {order.assignedTo === emp.id && (
                    <CheckCircle size={18} className="text-indigo-500" />
                  )}
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Users size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-bold">لا يوجد موظفين مضافين حالياً.</p>
                <p className="text-xs mt-1">
                  يمكنك إضافة موظفين من صفحة الإعدادات.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const LowStockAlert: React.FC<{ products: Product[] }> = ({ products }) => {
  if (!products) return null;
  const lowStockProducts = products.filter(
    (p) =>
      p.stockQuantity !== null &&
      p.stockQuantity !== undefined &&
      p.stockQuantity <= (p.stockThreshold || 5),
  );

  if (lowStockProducts.length === 0) return null;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl mb-6 flex items-start gap-3"
    >
      <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
      <div>
        <h4 className="font-bold text-red-800 dark:text-red-300 text-sm mb-1">
          تنبيه: مخزون منخفض
        </h4>
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">
          المنتجات التالية وصلت للحد الأدنى للمخزون:
        </p>
        <div className="flex flex-wrap gap-2">
          {lowStockProducts.map((p) => (
            <span
              key={p.id}
              className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg text-[10px] font-bold border border-red-100 dark:border-red-900/50 shadow-sm"
            >
              {p.name} ({p.stockQuantity} قطعة)
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}
const QuickStat: React.FC<QuickStatProps> = ({ icon, label, value, color }) => {
  const colors: Record<string, string> = {
    purple:
      "text-purple-600 bg-purple-50/80 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20",
    sky: "text-sky-600 bg-sky-50/80 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20",
    emerald:
      "text-emerald-600 bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20",
    red: "text-red-600 bg-red-50/80 dark:bg-red-500/10 border-red-100 dark:border-red-500/20",
  };
  return (
    <div
      className={`p-5 rounded-2xl border flex flex-col gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${colors[color]}`}
    >
      <div className="flex items-center justify-between">
        <div className="p-2.5 bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm backdrop-blur-sm">
          {icon}
        </div>
        <div className="text-3xl font-black tracking-tight">{value}</div>
      </div>
      <div className="text-sm font-bold opacity-80">{label}</div>
    </div>
  );
};
interface TabButtonProps {
  label: string;
  activeTab: string;
  setActiveTab: (label: string) => void;
  count: number;
}
const TabButton: React.FC<TabButtonProps> = ({
  label,
  activeTab,
  setActiveTab,
  count,
}) => {
  const isActive = activeTab === label;
  return (
    <button
      onClick={() => setActiveTab(label)}
      className={`flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${
        isActive
          ? "bg-indigo-600 text-white border-transparent shadow-md hover:bg-indigo-700"
          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
      }`}
    >
      <span>{label}</span>
      <span
        className={`px-2 py-0.5 rounded-lg text-xs font-black transition-colors ${
          isActive
            ? "bg-white/20 text-white"
            : "bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
};
interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  orderData: NewOrderState | Order;
  setOrderData: React.Dispatch<React.SetStateAction<any>>;
  settings: Settings;
  isEditing: boolean;
  customers: any[];
  orders: Order[];
  treasury?: any;
}

const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  orderData,
  setOrderData,
  settings,
  isEditing,
  customers,
  orders,
  treasury,
}) => {
  if (!isOpen) return null;

  const isExchange =
    (orderData as NewOrderState).orderType === "exchange" ||
    (orderData as NewOrderState).shipmentType === "exchange";
  const isReturn = (orderData as NewOrderState).shipmentType === "return";
  const isCashCollection =
    (orderData as NewOrderState).shipmentType === "cash_collection";
  let creditAmount = (orderData as NewOrderState).creditAmount || 0;

  // Customer Search State
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
  const [showEditTotalModal, setShowEditTotalModal] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(event.target as Node)
      ) {
        setIsCustomerListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    return customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone || "").includes(customerSearch),
    );
  }, [customerSearch, customers]);

  if (isEditing && isExchange && !creditAmount && orderData.originalOrderId) {
    const originalOrder = orders.find(
      (o) => o.id === orderData.originalOrderId,
    );
    if (originalOrder) {
      creditAmount =
        originalOrder.totalAmountOverride ??
        originalOrder.productPrice +
          originalOrder.shippingFee -
          (originalOrder.discount || 0);
    }
  }

  const subtotal = useMemo(() => {
    if (
      (isExchange && orderData.useProductsForShipment === false) ||
      isCashCollection
    ) {
      return Number(orderData.customShipmentPrice) || 0;
    }
    if (isReturn) {
      return 0;
    }
    return (orderData.items || []).reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
      0,
    );
  }, [
    orderData.items,
    isExchange,
    orderData.useProductsForShipment,
    orderData.customShipmentPrice,
    isReturn,
    isCashCollection,
  ]);

  // Custom Product Dropdown Component
  const ProductSelect = ({
    value,
    onChange,
    products,
    index,
  }: {
    value: string;
    onChange: (val: string) => void;
    products: any[];
    index: number;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedProduct = products.find((p) => p.id === value);
    const filtered = products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()),
    );

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-right hover:bg-slate-100 dark:hover:bg-slate-700 transition-all outline-none"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
            {selectedProduct?.thumbnail ? (
              <img
                src={selectedProduct.thumbnail}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <Package size={20} />
              </div>
            )}
          </div>
          <div className="flex-1 text-right">
            <p className="text-slate-800 dark:text-slate-200 leading-tight">
              {selectedProduct?.name || "اختر منتجاً"}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              #{selectedProduct?.id.slice(-6)}
            </p>
          </div>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700">
              <input
                autoFocus
                type="text"
                placeholder="ابحث عن منتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {filtered.length > 0 ? (
                filtered.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      onChange(p.id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3 hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors ${value === p.id ? "bg-amber-50 dark:bg-amber-500/10" : ""}`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Package size={24} className="m-auto text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {p.name}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs font-black text-amber-600 truncate">
                          {p.price} ج.م
                        </span>
                        <span
                          className={`text-[10px] font-bold ${(p.stock || p.stockQuantity || 0) <= 0 ? "text-red-500" : "text-emerald-500"}`}
                        >
                          مخزون: {p.stock || p.stockQuantity || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  لا توجد نتائج للبحث
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const itemDiscounts = useMemo(
    () =>
      (orderData.items || []).reduce((sum, item) => {
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
    [orderData.items],
  );

  const inspectionFee = useMemo(() => {
    if (!orderData.includeInspectionFee) return 0;
    const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
    const useCustom = compFees?.useCustomFees ?? false;
    return useCustom
      ? compFees?.inspectionFee || 0
      : settings.enableInspection
        ? settings.inspectionFee
        : 0;
  }, [orderData.includeInspectionFee, orderData.shippingCompany, settings]);

  const totalBeforeCredit = useMemo(
    () =>
      subtotal -
      itemDiscounts +
      (orderData.shippingFee || 0) -
      (orderData.discount || 0),
    [subtotal, itemDiscounts, orderData.shippingFee, orderData.discount],
  );
  const finalAmount = useMemo(() => {
    const tax = Number(orderData.tax) || 0;
    const inspection = (orderData.includeInspectionFee && orderData.inspectionFeePaidByCustomer !== false) ? inspectionFee : 0;
    return totalBeforeCredit + tax + inspection - creditAmount - (orderData.advancePayment || 0);
  }, [totalBeforeCredit, creditAmount, orderData.advancePayment, orderData.includeInspectionFee, orderData.inspectionFeePaidByCustomer, inspectionFee, orderData.tax]);

  const liveProfitMargin = useMemo(() => {
    const costOfItems = (orderData.items || []).reduce(
      (sum: number, item: any) => {
        const prod = settings.products.find(
          (p) =>
            p.id === item.productId ||
            p.variants?.some((v) => v.id === item.productId),
        );
        let itemCostByQty = Number(prod?.costPrice) || 0;
        const targetId = item.variantId || item.productId;
        if (prod?.hasVariants && targetId) {
          const variant = prod.variants?.find((v) => v.id === targetId);
          itemCostByQty = Number(variant?.costPrice) || itemCostByQty;
        }
        return sum + itemCostByQty * (Number(item.quantity) || 1);
      },
      0,
    );

    const totalCollected =
      orderData.totalAmountOverride !== undefined &&
      orderData.totalAmountOverride !== null &&
      (orderData.totalAmountOverride as any) !== ""
        ? Number(orderData.totalAmountOverride)
        : Number(finalAmount || 0);

    const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
    const useCustom = compFees?.useCustomFees ?? false;

    const insuranceRate = useCustom
      ? (compFees?.insuranceFeePercent ?? 0)
      : settings.enableInsurance
        ? settings.insuranceFeePercent
        : 0;
    const inspectionCost = useCustom
      ? (compFees?.inspectionFee ?? 0)
      : settings.enableInspection
        ? settings.inspectionFee
        : 0;

    const mockOrderForInsurance = {
      ...orderData,
      productPrice: subtotal - itemDiscounts,
      shippingFee: Number(orderData.shippingFee) || 0,
      isInsured: orderData.isInsured !== false,
      items: orderData.items || [],
    } as any;
    const insuranceFee = calculateInsuranceFee(
      mockOrderForInsurance,
      insuranceRate,
      settings,
    );
    const effectiveInspectionCost = (orderData.includeInspectionFee)
      ? Number(inspectionCost)
      : 0;
    const codFee =
      Number(
        calculateCodFee(
          {
            status: "تم_التحصيل",
            totalPrice: totalCollected,
            shippingFee: orderData.shippingFee || 0,
          } as any,
          settings,
        ),
      ) || 0;

    const taxAmount = Number(orderData.tax) || 0;

    const totalExpenses =
      costOfItems +
      Number(orderData.shippingFee || 0) +
      insuranceFee +
      effectiveInspectionCost +
      codFee +
      taxAmount;
    const profit = totalCollected - totalExpenses;

    return {
      costOfItems,
      insuranceFee,
      effectiveInspectionCost,
      codFee,
      totalExpenses,
      profit,
      profitPercent:
        totalCollected > 0 ? Math.round((profit / totalCollected) * 100) : 0,
    };
  }, [
    orderData.items,
    orderData.totalAmountOverride,
    orderData.shippingFee,
    orderData.discount,
    orderData.isInsured,
    orderData.includeInspectionFee,
    orderData.shippingCompany,
    finalAmount,
    settings,
  ]);

  const handleFieldChange = (field: keyof NewOrderState, value: any) =>
    setOrderData((prev: any) => ({ ...prev, [field]: value }));
  const handleReturnProductChange = (productId: string) => {
    const prod = settings.products.find((p) => p.id === productId);
    handleFieldChange("returnProductId", productId);
    handleFieldChange("returnVariantId", undefined);
    const qty = orderData.returnQuantity || 1;
    const desc = prod ? `${prod.name}` : "";
    handleFieldChange("returnDescription", desc);
  };

  const handleReturnVariantChange = (variantId: string) => {
    const prod = settings.products.find(
      (p) => p.id === orderData.returnProductId,
    );
    const variant = prod?.variants?.find((v) => v.id === variantId);
    handleFieldChange("returnVariantId", variantId);
    let desc = prod ? prod.name : "";
    if (variant) {
      const varDesc = Object.entries(variant.options || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      desc += ` (${varDesc})`;
    }
    handleFieldChange("returnDescription", desc);
  };
  const handleCustomerSelect = (
    customer: Pick<CustomerProfile, "name" | "phone" | "address">,
  ) => {
    setOrderData((prev: any) => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
    }));
    setCustomerSearch("");
    setIsCustomerListOpen(false);
  };

  const handleItemChange = (
    index: number,
    field: keyof OrderItem,
    value: any,
  ) => {
    let newItems = [...(orderData.items || [])];

    if (field === "productId") {
      const product = settings.products.find((p) => p.id === value);
      if (!product) {
        handleFieldChange("items", newItems);
        return;
      }

      const existingItemIndex = newItems.findIndex(
        (item, i) => item.productId === value && !item.variantId && i !== index,
      );

      if (existingItemIndex !== -1) {
        // Product exists, merge them
        const existingItem = newItems[existingItemIndex];
        const currentItem = newItems[index];

        newItems[existingItemIndex] = {
          ...existingItem,
          quantity: existingItem.quantity + currentItem.quantity,
        };

        newItems = newItems.filter((_, i) => i !== index);
      } else {
        newItems[index] = {
          ...newItems[index],
          productId: value,
          name: product.name,
          price: product.price,
          cost: getLatestProductCost(value, settings),
          weight: product.weight,
          thumbnail: product.thumbnail,
          variantId: undefined,
          variantDescription: undefined,
        };
      }
    } else if (field === "variantId") {
      const product = settings.products.find(
        (p) => p.id === newItems[index].productId,
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
          cost: variant.costPrice,
          weight: variant.weight,
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

  const addItem = () => {
    const firstProduct = settings.products[0];
    if (!firstProduct) return;
    handleFieldChange("items", [
      ...(orderData.items || []),
      {
        productId: firstProduct.id,
        name: firstProduct.name,
        quantity: 1,
        price: firstProduct.price,
        cost: firstProduct.costPrice,
        weight: firstProduct.weight,
        thumbnail: firstProduct.thumbnail,
        discountValue: 0,
        discountType: "amount",
      },
    ]);
  };

  const removeItem = (index: number) =>
    handleFieldChange(
      "items",
      (orderData.items || []).filter((_, i) => i !== index),
    );
  const activeCompanies = Object.keys(settings.shippingOptions || {}).filter(
    (company) => settings.activeCompanies?.[company] !== false,
  );
  const shippingOptions = useMemo(() => {
    const options =
      settings.shippingOptions?.[orderData.shippingCompany!] || [];
    if (options.length > 0) return options;
    return EGYPT_GOVERNORATES.map((gov, index) => ({
      id: `gov_fallback_${index}`,
      label: gov.name,
      cities: gov.cities.map((city, cIndex) => ({
        id: `city_fallback_${index}_${cIndex}`,
        name: city,
      })),
    })) as any[];
  }, [settings.shippingOptions, orderData.shippingCompany]);

  useEffect(() => {
    const selectedOption = shippingOptions.find(
      (opt) => opt.label === (orderData.governorate || orderData.shippingArea),
    );
    if (selectedOption) {
      const getPriceKey = (
        type?: string,
      ):
        | "deliveryPrice"
        | "exchangePrice"
        | "returnPrice"
        | "cashCollectionPrice"
        | "returnToSenderPrice" => {
        if (type === "exchange") return "exchangePrice";
        if (type === "return") return "returnPrice";
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
          (c) => c.name === orderData.city,
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

      const totalWeight =
        orderData.items?.reduce((sum: number, item: any) => {
          const itemWeight = parseFloat(item.weight?.toString() || "0");
          const itemQuantity = parseInt(item.quantity?.toString() || "1");
          return sum + itemWeight * itemQuantity;
        }, 0) || 0;
      const extraWeight = Math.max(0, totalWeight - baseWeight);
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
  ]);

  const totalWeight = useMemo(
    () =>
      (orderData.items || []).reduce((sum, item) => {
        const itemWeight = parseFloat(item.weight?.toString() || "0");
        const itemQuantity = parseInt(item.quantity?.toString() || "1");
        return sum + itemWeight * itemQuantity;
      }, 0),
    [orderData.items],
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-hidden">
      <motion.form
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onSubmit={onSubmit}
        className="bg-white/95 dark:bg-slate-900/95 w-full max-w-6xl h-[92vh] rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] flex flex-col border border-white/20 dark:border-slate-800/50 backdrop-blur-xl"
      >
        {/* Header Section */}
        <div className="px-8 py-7 flex justify-between items-center bg-gradient-to-l from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-900 rounded-t-[2.5rem] border-b border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white transform -rotate-3">
              <ShoppingBag size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                {isEditing
                  ? `تعديل الطلب #${orderData.orderNumber}`
                  : "إنشاء طلب جديد"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium">
                أكمل بيانات الطلب لبدء عملية الشحن والتحصيل.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all duration-300"
          >
            <X size={28} />
          </button>
        </div>

        {/* Shipment Type Selector - Modern Segmented Control */}
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap gap-2 items-center justify-start bg-white/30 dark:bg-slate-900/30">
          <div className="flex p-1.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-[1.25rem] border border-slate-200/50 dark:border-slate-700/50 gap-1 overflow-x-auto no-scrollbar">
            {(() => {
              const compFees = (settings.companySpecificFees?.[
                orderData.shippingCompany
              ] || {}) as any;
              const tabs: {
                id: string;
                label: string;
                icon: React.ReactNode;
                badge?: string;
              }[] = [
                {
                  id: "delivery",
                  label: "توصيل شحنة",
                  icon: <Truck size={17} />,
                },
              ];
              if (compFees.enablePartialDelivery !== false) {
                tabs.push({
                  id: "partial_delivery",
                  label: "توصيل جزئي",
                  icon: <Package size={17} />,
                  badge: "جديد",
                });
              }
              if (compFees.enableExchange !== false) {
                tabs.push({
                  id: "exchange",
                  label: "تبديل شحنات",
                  icon: <ArrowRightLeft size={17} />,
                });
              }
              if (compFees.enableReturn !== false) {
                tabs.push({
                  id: "return",
                  label: "إرجاع شحنة",
                  icon: <RefreshCcw size={17} />,
                });
              }
              if (compFees.enableCashCollection !== false) {
                tabs.push({
                  id: "cash_collection",
                  label: "تحصيل نقدي",
                  icon: <Coins size={17} />,
                });
              }
              return tabs;
            })().map((tab) => {
              const isActive =
                (orderData.shipmentType || "delivery") === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleFieldChange("shipmentType", tab.id)}
                  className={`relative flex items-center gap-2.5 py-2.5 px-6 rounded-xl text-xs font-black transition-all duration-300 shrink-0 ${
                    isActive
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-500 text-white rounded-lg font-bold leading-none">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/50">
          <div className="lg:col-span-7 space-y-8">
            {/* Customer Details Card */}
            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-110"></div>
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-lg">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                  <UserIcon size={20} />
                </div>
                بيانات العميل
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="relative" ref={customerSearchRef}>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                    اسم العميل
                  </label>
                  <input
                    type="text"
                    placeholder="اسم العميل أو رقم الهاتف"
                    required
                    value={customerSearch || orderData.customerName || ""}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      handleFieldChange("customerName", e.target.value);
                    }}
                    onFocus={() => setIsCustomerListOpen(true)}
                    className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold"
                  />
                  {isCustomerListOpen && filteredCustomers.length > 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-20 max-h-60 overflow-y-auto custom-scrollbar">
                      {filteredCustomers.map((c) => (
                        <div
                          key={c.phone}
                          onClick={() => handleCustomerSelect(c)}
                          className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors"
                        >
                          <p className="font-black text-slate-800 dark:text-slate-200">
                            {c.name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            {c.phone}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                    رقم الهاتف الأساسي
                  </label>
                  <input
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    required
                    value={orderData.customerPhone || ""}
                    onChange={(e) =>
                      handleFieldChange("customerPhone", e.target.value)
                    }
                    className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold text-right"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                    رقم هاتف إضافي (اختياري)
                  </label>
                  <input
                    type="tel"
                    placeholder="رقم بديل للعميل"
                    value={(orderData as NewOrderState).customerPhone2 || ""}
                    onChange={(e) =>
                      handleFieldChange("customerPhone2", e.target.value)
                    }
                    className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold text-right"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                    الدولة
                  </label>
                  <input
                    type="text"
                    placeholder="مصر"
                    value={(orderData as NewOrderState).country || "مصر"}
                    onChange={(e) =>
                      handleFieldChange("country", e.target.value)
                    }
                    className="p-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl w-full opacity-70 cursor-not-allowed dark:text-slate-400 font-bold"
                    disabled
                  />
                </div>
              </div>
              <div className="mt-5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                  العنوان بالتفصيل
                </label>
                <textarea
                  placeholder="المحافظة، المنطقة، واسم الشارع..."
                  required
                  value={orderData.customerAddress || ""}
                  onChange={(e) =>
                    handleFieldChange("customerAddress", e.target.value)
                  }
                  className="w-full p-5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl h-28 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all resize-none dark:text-white font-medium"
                />
              </div>
              <div className="mt-5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                  تفاصيل المبنى (رقم الشقة، الدور...)
                </label>
                <input
                  type="text"
                  placeholder="مثال: عمارة رقم 5، الدور الثالث، شقة 10"
                  value={(orderData as NewOrderState).buildingDetails || ""}
                  onChange={(e) =>
                    handleFieldChange("buildingDetails", e.target.value)
                  }
                  className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-medium"
                />
              </div>
            </div>

            {/* Shipping Details Card */}
            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-lg">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                  <Building size={20} />
                </div>
                بيانات الشحن والطلب
              </h4>

              {orderData.waybillNumber && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1 uppercase tracking-wider">
                      رقم البوليصة (Waybill)
                    </p>
                    {orderData.waybillNumber.startsWith("http") ? (
                      <a
                        href={orderData.waybillNumber}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-1 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 font-black rounded-xl text-sm transition-all"
                      >
                        <ExternalLink size={16} /> فتح البوليصة بصيغة PDF
                      </a>
                    ) : (
                      <p className="text-lg font-black text-blue-800 dark:text-blue-200 tabular-nums break-all">
                        {orderData.waybillNumber}
                      </p>
                    )}
                  </div>
                  {orderData.trackingUrl && (
                    <a
                      href={orderData.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-black rounded-xl text-sm shadow-md hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                    >
                      <LinkIcon size={16} /> تتبع الشحنة
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                    شركة الشحن
                  </label>
                  <select
                    required
                    value={orderData.shippingCompany}
                    onChange={(e) =>
                      handleFieldChange("shippingCompany", e.target.value)
                    }
                    className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-bold cursor-pointer"
                  >
                    {activeCompanies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                      المحافظة
                    </label>
                    <select
                      required
                      value={
                        orderData.governorate || orderData.shippingArea || ""
                      }
                      onChange={(e) => {
                        const gov = e.target.value;
                        setOrderData((prev: any) => ({
                          ...prev,
                          governorate: gov,
                          shippingArea: gov,
                          city: "",
                        }));
                      }}
                      className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-bold cursor-pointer"
                    >
                      <option value="" disabled>
                        اختر المحافظة
                      </option>
                      {shippingOptions.map((opt) => (
                        <option key={opt.id} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1">
                      المدينة
                    </label>
                    <select
                      required
                      value={orderData.city || ""}
                      onChange={(e) =>
                        handleFieldChange("city", e.target.value)
                      }
                      className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={
                        !(orderData.governorate || orderData.shippingArea)
                      }
                    >
                      <option value="" disabled>
                        اختر المدينة
                      </option>
                      {(
                        shippingOptions.find(
                          (o) =>
                            o.label ===
                            (orderData.governorate || orderData.shippingArea),
                        )?.cities || []
                      ).map((city) => (
                        <option key={city.id} value={city.name}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                <div>
                  <label
                    htmlFor="orderNumberInput"
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1"
                  >
                    رقم الطلب (اختياري)
                  </label>
                  <input
                    id="orderNumberInput"
                    type="text"
                    placeholder="تلقائي"
                    value={orderData.orderNumber || ""}
                    onChange={(e) =>
                      handleFieldChange("orderNumber", e.target.value)
                    }
                    className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="referenceNumberInput"
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block mr-1"
                  >
                    رقام المرجع للفاتورة
                  </label>
                  <input
                    id="referenceNumberInput"
                    type="text"
                    placeholder="#"
                    value={orderData.referenceNumber || ""}
                    onChange={(e) =>
                      handleFieldChange("referenceNumber", e.target.value)
                    }
                    className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl w-full font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-lg">
                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-500/10 rounded-xl flex items-center justify-center text-slate-600">
                  <FileText size={20} />
                </div>
                ملاحظات إضافية
              </h4>
              <textarea
                placeholder="اكتب أي ملاحظات للمندوب أو الطلب هنا..."
                value={orderData.notes || ""}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                className="w-full p-5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl h-28 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 outline-none transition-all resize-none dark:text-white text-right font-medium"
              />
            </div>

            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-lg">
                <div className="w-10 h-10 bg-pink-50 dark:bg-pink-500/10 rounded-xl flex items-center justify-center text-pink-600">
                  <ImageIcon size={20} />
                </div>
                صور ومرفقات الطلب
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-5">
                {(orderData.images || []).map((img: string, idx: number) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-[1.5rem] overflow-hidden border border-slate-200/50 dark:border-slate-700/50 group shadow-sm transition-transform duration-300 hover:scale-[1.03]"
                  >
                    <img
                      src={img}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleFieldChange(
                            "images",
                            (orderData.images || []).filter(
                              (_: any, i: number) => i !== idx,
                            ),
                          )
                        }
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const url = prompt("أدخل رابط الصورة:");
                    if (url)
                      handleFieldChange("images", [
                        ...(orderData.images || []),
                        url,
                      ]);
                  }}
                  className="aspect-square rounded-[1.5rem] border-2 border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-slate-400 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50/10 transition-all bg-slate-50/30 dark:bg-slate-800/30 group"
                >
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <Plus size={22} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-tight">
                    إضافة صورة
                  </span>
                </button>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <p className="text-[11px] text-slate-400 font-bold italic leading-relaxed text-center">
                  إرفاق صور المنتج أو بوليصة الشحن يسهل عملية المتابعة ويقلل من
                  الأخطاء في التوصيل أو الإرجاع.
                </p>
              </div>
            </div>
            {/* Products Section */}
            {!isExchange && !isReturn && !isCashCollection && (
              <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center justify-between text-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                      <Package size={20} />
                    </div>
                    المنتجات المطلوبة
                  </div>
                  <span className="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500">
                    {(orderData.items || []).length} صنف
                  </span>
                </h4>
                <div className="space-y-5">
                  {(orderData.items || []).length === 0 && (
                    <div className="p-10 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] text-center bg-slate-50/30 dark:bg-slate-900/10">
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Package size={28} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-black text-slate-800 dark:text-white">
                        قائمة المنتجات فارغة
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5 font-medium">
                        ابدأ بإضافة المنتجات التي طلبها العميل لتفصيل الفاتورة.
                      </p>
                    </div>
                  )}
                  {(orderData.items || []).map((item, index) => {
                    const product = settings.products.find(
                      (p) =>
                        p.id === item.productId ||
                        p.variants?.some((v) => v.id === item.productId),
                    );
                    const hasVariants =
                      product?.variants && product.variants.length > 0;
                    const selectedVariant = hasVariants
                      ? product.variants?.find(
                          (v) => v.id === (item.variantId || item.productId),
                        )
                      : null;
                    const stock = hasVariants
                      ? selectedVariant?.stock || 0
                      : product?.stock || 0;

                    return (
                      <div
                        key={index}
                        className="p-6 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl relative group transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600"
                      >
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="absolute -top-3 -left-3 w-8 h-8 bg-white dark:bg-slate-700 text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-600 opacity-0 group-hover:opacity-100 transition-all z-10"
                        >
                          <X size={16} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-4">
                            <ProductSelect
                              value={item.productId}
                              onChange={(val) =>
                                handleItemChange(index, "productId", val)
                              }
                              products={settings.products}
                              index={index}
                            />

                            {hasVariants && (
                              <div className="space-y-1.5">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1">
                                  المتغير (المقاس / اللون)
                                </label>
                                <select
                                  value={item.variantId || ""}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "variantId",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white font-bold cursor-pointer"
                                >
                                  <option value="">اختر المتغير...</option>
                                  {product?.variants?.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {Object.entries(v.options || {})
                                        .map(([k, val]) => `${k}: ${val}`)
                                        .join(", ")}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1">
                                  الكمية
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "quantity",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1">
                                  السعر
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.price}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "price",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase mr-1">
                                  الخصم
                                </label>
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.discountValue || 0}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "discountValue",
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-xs"
                                  />
                                  <select
                                    value={item.discountType || "amount"}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "discountType",
                                        e.target.value,
                                      )
                                    }
                                    className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold outline-none dark:text-white"
                                  >
                                    <option value="amount">ج.م</option>
                                    <option value="percentage">%</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                              <span
                                className={`text-[10px] font-bold ${stock < item.quantity ? "text-red-500" : "text-emerald-500"}`}
                              >
                                المخزون المتوفر: {stock} قطعة
                              </span>
                              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                المجموع:{" "}
                                {(
                                  item.price * item.quantity -
                                  (item.discountType === "amount"
                                    ? item.discountValue || 0
                                    : (item.price *
                                        item.quantity *
                                        (item.discountValue || 0)) /
                                      100)
                                ).toLocaleString()}{" "}
                                ج.م
                              </span>
                            </div>
                          </div>

                          <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl flex flex-col items-center justify-center p-4 border border-slate-100 dark:border-slate-700/50">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                className="w-full aspect-square object-cover rounded-xl shadow-sm mb-3"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full aspect-square bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center mb-3">
                                <Package size={40} className="text-slate-300" />
                              </div>
                            )}
                            <div className="text-center">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                                الوزن التقديري
                              </p>
                              <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                                {item.weight || 0} كجم
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addItem}
                    className="w-full py-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={20} />
                    <span>إضافة منتج آخر</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-8">
            {isExchange && (
              <>
                {/* تفاصيل الشحنة المرسلة جديدة */}
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-5 text-right">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                      <Package size={18} className="text-indigo-500" />
                      تفاصيل الشحنة
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        اختر من المنتجات
                      </span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={!!orderData.useProductsForShipment}
                          onChange={(e) =>
                            handleFieldChange(
                              "useProductsForShipment",
                              e.target.checked,
                            )
                          }
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:content-[''] after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </div>
                    </label>
                  </div>

                  {orderData.useProductsForShipment ? (
                    <div className="space-y-3">
                      <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {(orderData.items || []).length === 0 && (
                          <div className="p-5 border border-dashed border-slate-200 dark:border-slate-700/60 rounded-xl text-center bg-white/40 dark:bg-slate-900/10">
                            <Package
                              className="mx-auto mb-2 opacity-35 text-slate-400"
                              size={20}
                            />
                            <p className="text-xs font-bold text-slate-500">
                              لم يتم إضافة أي منتج للطلب بعد
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              اضغط على زر "إضافة منتج" بالأسفل لبدء التحديد.
                            </p>
                          </div>
                        )}
                        {(orderData.items || []).map((item, index) => {
                          const product = settings.products.find(
                            (p) =>
                              p.id === item.productId ||
                              p.variants?.some((v) => v.id === item.productId),
                          );
                          const hasVariants =
                            product?.variants && product.variants.length > 0;
                          const selectedVariant = hasVariants
                            ? product.variants?.find(
                                (v) =>
                                  v.id === (item.variantId || item.productId),
                              )
                            : null;
                          const stock = hasVariants
                            ? selectedVariant?.stock || 0
                            : product?.stock || 0;

                          return (
                            <div
                              key={index}
                              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 relative group text-right"
                            >
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="absolute top-3 left-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded-full z-10"
                              >
                                <XCircle size={20} />
                              </button>
                              <ProductSelect
                                value={item.productId}
                                onChange={(val) =>
                                  handleItemChange(index, "productId", val)
                                }
                                products={settings.products}
                                index={index}
                              />

                              {hasVariants && (
                                <select
                                  value={item.variantId || ""}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "variantId",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all dark:text-white"
                                >
                                  <option value="">بدون متغيرات</option>
                                  {product.variants?.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {Object.entries(v.options || {})
                                        .map(([k, val]) => `${k}: ${val}`)
                                        .join(", ")}
                                    </option>
                                  ))}
                                </select>
                              )}

                              <div className="flex gap-3 items-center">
                                <div className="w-20 font-sans">
                                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                                    الكمية
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "quantity",
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-xs"
                                  />
                                </div>
                                <div className="flex-1 font-sans">
                                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                                    السعر
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.price}
                                    onChange={(e) =>
                                      handleItemChange(
                                        index,
                                        "price",
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-xs"
                                  />
                                </div>
                                <div className="flex-1 font-sans">
                                  <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                                    الخصم
                                  </label>
                                  <div className="flex gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.discountValue || 0}
                                      onChange={(e) =>
                                        handleItemChange(
                                          index,
                                          "discountValue",
                                          Number(e.target.value),
                                        )
                                      }
                                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-xs"
                                    />
                                    <select
                                      value={item.discountType || "amount"}
                                      onChange={(e) =>
                                        handleItemChange(
                                          index,
                                          "discountType",
                                          e.target.value,
                                        )
                                      }
                                      className="p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] outline-none dark:text-white"
                                    >
                                      <option value="amount">مبلغ</option>
                                      <option value="percentage">%</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex-1 text-center text-[10px] font-bold text-slate-500 pt-5">
                                  المخزون:{" "}
                                  <span
                                    className={
                                      stock < item.quantity
                                        ? "text-red-500"
                                        : "text-emerald-500"
                                    }
                                  >
                                    {stock}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={addItem}
                        className="w-full mt-2 p-3 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-bold rounded-xl text-sm border border-amber-100 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={16} /> إضافة منتج
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                            عدد القطع
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={orderData.shipmentQuantity || 1}
                            onChange={(e) =>
                              handleFieldChange(
                                "shipmentQuantity",
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-slate-605 dark:text-slate-400 mb-1 block flex justify-between">
                            <span>وصف المنتج</span>
                            <span className="text-[10px] text-slate-400">
                              اختياري
                            </span>
                          </label>
                          <input
                            type="text"
                            placeholder="تيشيرت، إكسسوارات، عطر، كتاب ...إلخ"
                            value={orderData.shipmentDescription || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                "shipmentDescription",
                                e.target.value,
                              )
                            }
                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                          سعر الشحنة المرسلة جديدة (ج.م)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={orderData.customShipmentPrice || 0}
                          onChange={(e) =>
                            handleFieldChange(
                              "customShipmentPrice",
                              Math.max(0, parseFloat(e.target.value) || 0),
                            )
                          }
                          className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500"
                          placeholder="أدخل قيمة المنتجات المرسلة"
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-100/50 dark:border-cyan-900/40 rounded-xl flex gap-3.5 text-right items-start">
                    <Info
                      size={16}
                      className="text-cyan-500 dark:text-cyan-400 mt-0.5 flex-shrink-0"
                    />
                    <p className="text-xs text-cyan-850 dark:text-cyan-300 leading-relaxed font-medium">
                      إضافة صورة ووصف للمنتج تساعدنا علي التحقق من الشحنة في
                      حالات الإرجاع أو الاستبدال و تقلل إمكانية فقد الشحنة.
                    </p>
                  </div>
                </div>
              </>
            )}

            {(isExchange || isReturn) && (
              <>
                {/* تفاصيل الشحنة المرتجعة */}
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-5 text-right">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm sm:text-base">
                      <RefreshCcw
                        size={18}
                        className="text-rose-500 animate-spin-slow"
                      />
                      تفاصيل الشحنة المرتجعة
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        اختر من المنتجات
                      </span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={!!orderData.useProductsForReturn}
                          onChange={(e) =>
                            handleFieldChange(
                              "useProductsForReturn",
                              e.target.checked,
                            )
                          }
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:content-[''] after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </div>
                    </label>
                  </div>

                  {orderData.useProductsForReturn ? (
                    <div className="space-y-4 text-right">
                      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 relative">
                        <label className="text-xs font-black text-slate-600 dark:text-slate-400 mb-1 block">
                          المنتج المرتجع
                        </label>
                        <ProductSelect
                          value={orderData.returnProductId || ""}
                          onChange={(val) => handleReturnProductChange(val)}
                          products={settings.products}
                          index={0}
                        />

                        {(() => {
                          const prod = settings.products.find(
                            (p) => p.id === orderData.returnProductId,
                          );
                          const hasVariants =
                            prod?.variants && prod.variants.length > 0;
                          if (!hasVariants) return null;
                          return (
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">
                                اختر نوع/متغير المنتج المرتجع
                              </label>
                              <select
                                value={orderData.returnVariantId || ""}
                                onChange={(e) =>
                                  handleReturnVariantChange(e.target.value)
                                }
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all dark:text-white"
                              >
                                <option value="">بدون متغيرات</option>
                                {prod.variants?.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {Object.entries(v.options || {})
                                      .map(([k, val]) => `${k}: ${val}`)
                                      .join(", ")}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}

                        <div className="flex gap-4 items-center">
                          <div className="w-24 font-sans">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                              الكمية
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={orderData.returnQuantity || 1}
                              onChange={(e) => {
                                const val = Math.max(
                                  1,
                                  parseInt(e.target.value) || 1,
                                );
                                handleFieldChange("returnQuantity", val);
                              }}
                              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold outline-none dark:text-white text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                              الوصف للمستودع
                            </label>
                            <input
                              type="text"
                              disabled
                              value={
                                orderData.returnDescription ||
                                "يرجى اختيار المنتج مرتجع"
                              }
                              className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-150 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                            عدد القطع
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={orderData.returnQuantity || 1}
                            onChange={(e) =>
                              handleFieldChange(
                                "returnQuantity",
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-slate-605 dark:text-slate-400 mb-1 block flex justify-between">
                            <span>وصف المنتج</span>
                            <span className="text-[10px] text-slate-400">
                              اختياري
                            </span>
                          </label>
                          <input
                            type="text"
                            placeholder="تيشيرت، إكسسوارات، عطر، كتاب ...إلخ"
                            value={orderData.returnDescription || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                "returnDescription",
                                e.target.value,
                              )
                            }
                            className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white text-sm focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* صورة المنتج اختياري */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block flex justify-between">
                          <span>صورة المنتج المرتجع</span>
                          <span className="text-[10px] text-slate-400">
                            اختياري
                          </span>
                        </label>

                        {orderData.returnImage ? (
                          <div className="relative border border-slate-200 dark:border-slate-850 p-2.5 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 overflow-hidden border border-slate-100 dark:border-slate-700 flex-shrink-0">
                                <img
                                  src={orderData.returnImage}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <span className="text-xs text-slate-500 select-none truncate max-w-[150px] font-mono">
                                {orderData.returnImage}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleFieldChange("returnImage", "")
                              }
                              className="p-1 px-3 bg-red-50 hover:bg-red-100 text-red-550 text-xs font-bold rounded-lg transition-colors border border-red-200/50"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              const url = prompt(
                                "أدخل رابط الصورة أو الصق رابط صورة المنتج المرتجع:",
                              );
                              if (url) {
                                handleFieldChange("returnImage", url);
                              }
                            }}
                            className="border-2 border-dashed border-slate-205 dark:border-slate-700/80 hover:border-amber-400 dark:hover:border-amber-500/80 p-8 rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer bg-white/50 dark:bg-slate-900/40 text-center shadow-inner"
                          >
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-full">
                              <UploadCloud size={22} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                اضغط للرفع أو اسحب وأرفق صورة المنتجات
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                يدعم JPG, PNG - بحد أقصى (800x400px)
                              </p>
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 font-bold block mt-1">
                          هذا سيساعدنا في استلام الشحنة الصحيحة من عميلك.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-100/50 dark:border-cyan-900/40 rounded-xl flex gap-3.5 text-right items-start">
                    <Info
                      size={16}
                      className="text-cyan-500 dark:text-cyan-400 mt-0.5 flex-shrink-0"
                    />
                    <p className="text-xs text-cyan-850 dark:text-cyan-300 leading-relaxed font-medium">
                      إضافة صورة ووصف للمنتج تساعدنا علي التحقق من الشحنة في
                      حالات الإرجاع أو الاستبدال و تقلل إمكانية فقد الشحنة.
                    </p>
                  </div>
                </div>
              </>
            )}

            {isCashCollection && (
              <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-lg">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                    <Coins size={20} />
                  </div>
                  تفاصيل التحصيل النقدي
                </h4>
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase mr-1 mb-2 block">
                      المبلغ المطلوب تحصيله من العميل
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={orderData.customShipmentPrice || 0}
                      onChange={(e) =>
                        handleFieldChange(
                          "customShipmentPrice",
                          Number(e.target.value),
                        )
                      }
                      className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl font-black text-xl text-center text-amber-600 outline-none focus:border-amber-400 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold uppercase mr-1 mb-2 block">
                      سبب التحصيل / ملاحظات
                    </label>
                    <textarea
                      value={orderData.shipmentDescription || ""}
                      onChange={(e) =>
                        handleFieldChange("shipmentDescription", e.target.value)
                      }
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl h-24 text-sm font-bold resize-none outline-none dark:text-white"
                      placeholder="مثال: تحصيل مديونية سابقة، عربون طلب كبير..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="p-8 bg-indigo-900 dark:bg-indigo-950 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 transition-transform duration-700 group-hover:scale-110"></div>
              <h4 className="font-black text-white mb-8 flex items-center gap-3 text-lg relative z-10">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <FileText size={20} className="text-indigo-200" />
                </div>
                الملخص المالي للطلب
              </h4>

              <div className="space-y-4">
                <div className="flex justify-between font-bold text-slate-300 text-sm">
                  <span>
                    المجموع الفرعي{" "}
                    {orderData.source === "synced" ? "(المنصة)" : ""}
                  </span>
                  <span>
                    {(orderData.source === "synced" && orderData.totalPrice
                      ? orderData.totalPrice
                      : subtotal
                    ).toLocaleString()}{" "}
                    ج.م
                  </span>
                </div>

                {!isReturn && !isCashCollection && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase flex justify-between">
                        <span>مصاريف الشحن</span>
                        <span className="text-indigo-400">تلقائي</span>
                      </label>
                      <input
                        type="number"
                        value={orderData.shippingFee || 0}
                        onChange={(e) =>
                          handleFieldChange(
                            "shippingFee",
                            Number(e.target.value),
                          )
                        }
                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white outline-none focus:bg-white/10 transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 font-bold uppercase">
                        خصم إضافي
                      </label>
                      <input
                        type="number"
                        value={orderData.discount || 0}
                        onChange={(e) =>
                          handleFieldChange("discount", Number(e.target.value))
                        }
                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white outline-none focus:bg-white/10 transition-all text-sm"
                      />
                    </div>
                  </div>
                )}

                {isExchange && (
                  <div className="flex justify-between font-bold text-orange-400 bg-orange-400/10 p-3.5 rounded-2xl border border-orange-400/20 text-xs">
                    <span>رصيد سابق (إستبدال)</span>
                    <span>-{creditAmount.toLocaleString()} ج.م</span>
                  </div>
                )}

                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex justify-between items-center group transition-all hover:bg-white/10">
                  <div>
                    <span className="font-black text-indigo-200 text-sm flex items-center gap-2">
                      {finalAmount >= 0 ? "المطلوب تحصيله" : "المستحق للعميل"}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-black text-white text-2xl">
                        {Math.abs(
                          orderData.totalAmountOverride ??
                            (orderData.source === "synced" &&
                            orderData.totalPrice
                              ? orderData.totalPrice
                              : finalAmount),
                        ).toLocaleString()}{" "}
                        ج.م
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowEditTotalModal(true)}
                        className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 shadow-lg group-hover:scale-110 transition-transform"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-200 border border-indigo-500/30">
                    <Calculator size={20} />
                  </div>
                </div>
              </div>
            </div>

            {/* Advance Payment Section */}
            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center justify-between text-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                    <Coins size={20} />
                  </div>
                  العربون والدفع المقدم
                </div>
                {orderData.advancePayment > 0 && (
                  <span className="text-xs font-black px-3 py-1 bg-emerald-500 text-white rounded-full">
                    مفعل
                  </span>
                )}
              </h4>

              <div className="space-y-5">
                <div className="relative group">
                  <label className="text-[10px] text-slate-500 font-bold uppercase mr-1 mb-2 block tracking-wider">
                    مبلغ العربون المستلم من العميل
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={orderData.advancePayment || 0}
                    onChange={(e) =>
                      handleFieldChange(
                        "advancePayment",
                        Number(e.target.value),
                      )
                    }
                    className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl font-black text-xl text-center text-emerald-600 outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all"
                    placeholder="0"
                  />
                  <div className="absolute top-[3.25rem] left-5 pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors text-xs font-black uppercase">
                    ج.م
                  </div>
                </div>

                {orderData.advancePayment > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 p-5 bg-slate-50/50 dark:bg-slate-800/50 rounded-3xl border border-slate-200/50 dark:border-slate-700/50"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase mr-1 tracking-wider leading-none mb-1 block">
                        حساب الاستلام / الخزينة
                      </label>
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
                              val.replace("treasury_", ""),
                            );
                            handleFieldChange("advancePaymentPartnerId", "");
                            handleFieldChange("advancePaymentEmployeeId", "");
                          } else if (val.startsWith("partner_")) {
                            handleFieldChange(
                              "advancePaymentPartnerId",
                              val.replace("partner_", ""),
                            );
                            handleFieldChange("advancePaymentTreasuryId", "");
                            handleFieldChange("advancePaymentEmployeeId", "");
                          } else if (val.startsWith("employee_")) {
                            handleFieldChange(
                              "advancePaymentEmployeeId",
                              val.replace("employee_", ""),
                            );
                            handleFieldChange("advancePaymentPartnerId", "");
                            handleFieldChange("advancePaymentTreasuryId", "");
                          } else {
                            handleFieldChange("advancePaymentPartnerId", "");
                            handleFieldChange("advancePaymentTreasuryId", "");
                            handleFieldChange("advancePaymentEmployeeId", "");
                          }
                        }}
                        className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black outline-none"
                      >
                        <option value="">-- اختر حساب الاستلام --</option>
                        {treasury?.accounts && (
                          <optgroup label="الحسابات البنكية">
                            {(Array.isArray(treasury.accounts) ? treasury.accounts : Object.values(treasury.accounts || {})).map((acc: any) => (
                              <option
                                key={`treasury_${acc.id}`}
                                value={`treasury_${acc.id}`}
                              >
                                {acc.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {(settings.employees || []).length >= 0 && (
                          <optgroup label="العهدة النقدية (شركاء وموظفين)">
                            <option value="employee_admin">المدير (أنت)</option>
                            {(Array.isArray(settings.partners) ? settings.partners : Object.values(settings.partners || {})).map((p: any) => (
                              <option
                                key={`employee_${p.id}`}
                                value={`employee_${p.id}`}
                              >
                                {p.name} (شريك)
                              </option>
                            ))}
                            {(settings.employees || []).map((emp) => (
                              <option
                                key={`employee_${emp.id}`}
                                value={`employee_${emp.id}`}
                              >
                                {emp.name} (موظف)
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="هاتف المستلم..."
                        value={orderData.advancePaymentRecipientPhone || ""}
                        onChange={(e) =>
                          handleFieldChange(
                            "advancePaymentRecipientPhone",
                            e.target.value,
                          )
                        }
                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black outline-none"
                      />
                      <input
                        type="text"
                        placeholder="بيانات المحول..."
                        value={orderData.advancePaymentSenderDetails || ""}
                        onChange={(e) =>
                          handleFieldChange(
                            "advancePaymentSenderDetails",
                            e.target.value,
                          )
                        }
                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black outline-none"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Advance Payment History Log */}
                {isEditing && orderData.advancePaymentHistory && orderData.advancePaymentHistory.length > 0 && (
                  <div className="mt-4 p-5 bg-slate-100/50 dark:bg-slate-800/30 rounded-3xl border border-slate-200/50 dark:border-slate-700/50">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <History size={14} className="text-slate-400" />
                       سجل تحديثات العربون
                    </h5>
                    <div className="space-y-3 max-h-40 overflow-y-auto no-scrollbar">
                      {orderData.advancePaymentHistory.slice().reverse().map((log: any) => (
                        <div key={log.id} className="text-right p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                              log.action === 'created' ? 'bg-emerald-50 text-emerald-600' : 
                              log.action === 'deleted' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {log.action === 'created' ? 'إضافة' : log.action === 'deleted' ? 'مسح' : 'تعديل'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold tabular-nums">
                              {new Date(log.timestamp).toLocaleString('ar-EG')}
                            </span>
                          </div>
                          <div className="flex justify-between items-baseline">
                             <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                               المبلغ: {log.amount.toLocaleString()} ج.م
                             </span>
                             <span className="text-[9px] text-slate-500 font-medium">
                               بواسطة: {log.userName}
                             </span>
                          </div>
                          {log.reason && (
                            <p className="text-[9px] text-slate-400 mt-1 italic leading-relaxed border-t border-slate-50 dark:border-slate-800 pt-1">
                              {log.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Profit Simulator - Modernized */}
            <div className="p-8 bg-emerald-950 dark:bg-black rounded-[2rem] border border-emerald-500/20 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
              <h4 className="font-extrabold text-emerald-400 text-sm flex items-center gap-2 mb-6 uppercase tracking-[0.2em] relative z-10 leading-none">
                <Sparkles size={16} className="animate-pulse" />
                محاكي الربحية الحية
              </h4>
              <div className="grid grid-cols-2 gap-2 relative z-10">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <p className="text-[9px] text-emerald-300/60 font-black uppercase tracking-tight mb-1">
                    تكلفة البضاعة
                  </p>
                  <p className="text-sm font-black text-white italic">
                    {liveProfitMargin.costOfItems.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <p className="text-[9px] text-emerald-300/60 font-black uppercase tracking-tight mb-1">
                    مصاريف التشغيل
                  </p>
                  <p className="text-sm font-black text-white italic">
                    {(
                      liveProfitMargin.insuranceFee + liveProfitMargin.codFee
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-5 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 flex justify-between items-center relative z-10">
                <div>
                  <p className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.15em] mb-1">
                    صافي الربح المتوقع
                  </p>
                  <h3 className="text-2xl font-black text-emerald-400 tracking-tighter italic">
                    {liveProfitMargin.profit.toLocaleString()}
                    <span className="text-[10px] ml-1 uppercase not-italic opacity-60">
                      L.E
                    </span>
                  </h3>
                </div>
                <div className="text-right">
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-emerald-950 font-black text-xs shadow-lg shadow-emerald-500/20">
                    {liveProfitMargin.profitPercent}%
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Settings - Modernized */}
            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-4">
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <SettingsIcon size={18} />
                </div>
                إعدادات إضافية
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleFieldChange(
                      "includeInspectionFee",
                      !orderData.includeInspectionFee,
                    )
                  }
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${orderData.includeInspectionFee ? "bg-indigo-50 border-indigo-400 text-indigo-700" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400"}`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${orderData.includeInspectionFee ? "bg-indigo-600" : "bg-slate-100 dark:bg-slate-800"}`}
                  >
                    {orderData.includeInspectionFee && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="font-black text-xs uppercase tracking-wider">
                    تفعيل رسوم المعاينة
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleFieldChange("isInsured", !orderData.isInsured)
                  }
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${orderData.isInsured !== false ? "bg-indigo-50 border-indigo-400 text-indigo-700" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400"}`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${orderData.isInsured !== false ? "bg-indigo-600" : "bg-slate-100 dark:bg-slate-800"}`}
                  >
                    {orderData.isInsured !== false && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="font-black text-xs uppercase tracking-wider">
                    تأمين الشحنة
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {showEditTotalModal && (
          <EditTotalModal
            currentTotal={orderData.totalAmountOverride ?? finalAmount}
            onClose={() => setShowEditTotalModal(false)}
            onApply={(amount, reason) => {
              handleFieldChange("totalAmountOverride", amount);
              handleFieldChange("totalAmountOverrideReason", reason);
              setShowEditTotalModal(false);
            }}
          />
        )}

        <div className="px-10 py-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 flex items-center justify-between rounded-b-[2.5rem] sticky bottom-0 z-50">
          <div className="flex items-center gap-10">
            <div className="hidden sm:block text-right">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2 leading-none">
                الإجمالي المطلوب
              </p>
              <h3 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 leading-none italic tracking-tighter">
                {finalAmount.toLocaleString()}{" "}
                <span className="text-xs uppercase opacity-30 not-italic tracking-normal">
                  ج.م
                </span>
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-8 font-black text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all text-sm uppercase tracking-widest"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="h-16 px-12 bg-indigo-600 dark:bg-indigo-500 text-white font-black rounded-3xl shadow-[0_20px_40px_-5px_rgba(79,70,229,0.3)] hover:bg-indigo-700 hover:scale-[1.05] active:scale-[0.98] transition-all flex items-center gap-4 text-base"
            >
              <span>{isEditing ? "حفظ التحديثات" : "تأكيد الطلب"}</span>
              <ArrowLeft size={20} strokeWidth={3} />
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  );
};
interface OrderConfirmationSummaryProps {
  order: Order;
  settings: Settings;
  onClose: () => void;
  storeName: string;
}
const OrderConfirmationSummary: React.FC<OrderConfirmationSummaryProps> = ({
  order,
  settings,
  onClose,
  storeName,
}) => {
  const compFees = settings?.companySpecificFees?.[order.shippingCompany];
  const inspectionFee = order.includeInspectionFee
    ? compFees?.useCustomFees
      ? compFees.inspectionFee
      : settings.inspectionFee
    : 0;
  const insuranceRate = order.isInsured
    ? compFees?.useCustomFees
      ? compFees.insuranceFeePercent
      : settings.insuranceFeePercent
    : 0;
  const insuranceFee = calculateInsuranceFee(order, insuranceRate, settings);
  const safeAdvance = Number(order.advancePayment) || 0;

  // Explicitly use the exact mathematical logic calculated for WalletPage
  const actualShippingFee = calculateOrderShippingAndFees(order, settings);

  const total =
    order.totalAmountOverride ??
    order.productPrice + actualShippingFee - order.discount - safeAdvance;

  // ...
  // Note: To preserve line count and simplicity, I'm replacing just the calculation part first.

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-sm">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">
          تم إنشاء الطلب بنجاح!
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          ملخص الطلب المالي للعميل{" "}
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {order.customerName}
          </span>
        </p>
        <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold text-slate-500">إجمالي المنتجات:</span>
            <span className="font-black text-slate-700 dark:text-slate-200">
              {order.productPrice.toLocaleString()} ج.م
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-500">مصاريف الشحن:</span>
              {(order.weight || 0) > 0 && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  (الوزن: {order.weight.toFixed(2)} كجم)
                </span>
              )}
            </div>
            <span className="font-black text-slate-700 dark:text-slate-200">
              {actualShippingFee.toLocaleString("ar-EG", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{" "}
              ج.م
            </span>
          </div>
          {inspectionFee > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-slate-500">رسوم المعاينة:</span>
              <span className="font-black text-slate-700 dark:text-slate-200">
                {inspectionFee.toLocaleString()} ج.م
              </span>
            </div>
          )}
          {insuranceFee > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-slate-500">
                رسوم التأمين ({insuranceRate}%):
              </span>
              <span className="font-black text-slate-700 dark:text-slate-200">
                {insuranceFee.toFixed(2)} ج.م
              </span>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between items-center text-sm text-red-500">
              <span className="font-bold">الخصم:</span>
              <span className="font-black">
                -{order.discount.toLocaleString()} ج.م
              </span>
            </div>
          )}
          <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
          <div className="flex justify-between items-center text-xl">
            <span className="font-black text-indigo-600 dark:text-indigo-400">
              الإجمالي المطلوب تحصيله:
            </span>
            <span className="font-black text-indigo-600 dark:text-indigo-400">
              {total.toLocaleString()} ج.م
            </span>
          </div>
          {order.totalAmountOverride !== undefined &&
            order.totalAmountOverrideReason && (
              <div className="mt-3 text-right">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider mb-1">
                  سبب تعديل الإجمالي
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 italic">
                  "{order.totalAmountOverrideReason}"
                </p>
              </div>
            )}
        </div>
        <div className="flex flex-col gap-3 mt-8">
          <button
            onClick={() => {
              const html = generateInvoiceHTML(order, settings, storeName);
              printHTMLDirectly(html);
            }}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3"
          >
            <Printer size={20} />
            <span>طباعة الفاتورة</span>
          </button>
          <button
            onClick={() => {
              const html = generateShippingLabelHTML(order, storeName, settings);
              printHTMLDirectly(html);
            }}
            className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-3"
          >
            <FileDown size={20} />
            <span>طباعة بوليصة الشحن</span>
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-all mt-2"
          >
            إغلاق الملخص
          </button>
        </div>
      </div>
    </div>
  );
};
const ConfirmationModal: React.FC<{
  title: string;
  description: string;
  onConfirm: (deleteRelated?: boolean) => void;
  onCancel: () => void;
  checkboxLabel?: string;
}> = ({ title, description, onConfirm, onCancel, checkboxLabel }) => {
  const [deleteRelated, setDeleteRelated] = React.useState(false);
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center animate-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {description}
        </p>

        {checkboxLabel && (
          <label className="flex items-center gap-2 mb-6 text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-3 rounded-xl transition-all">
            <input
              type="checkbox"
              checked={deleteRelated}
              onChange={(e) => setDeleteRelated(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {checkboxLabel}
            </span>
          </label>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(deleteRelated)}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-sm hover:shadow"
          >
            تأكيد الحذف
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            تراجع
          </button>
        </div>
      </div>
    </div>
  );
};
interface OrderPreConfirmationModalProps {
  order: Omit<Order, "id">;
  settings: Settings;
  onConfirm: () => void;
  onCancel: () => void;
}
const OrderPreConfirmationModal: React.FC<OrderPreConfirmationModalProps> = ({
  order,
  settings,
  onConfirm,
  onCancel,
}) => {
  const compFees = settings?.companySpecificFees?.[order.shippingCompany];
  const inspectionFee = order.includeInspectionFee
    ? compFees?.useCustomFees
      ? compFees.inspectionFee
      : settings.inspectionFee
    : 0;
  const insuranceRate = order.isInsured
    ? compFees?.useCustomFees
      ? compFees.insuranceFeePercent
      : settings.insuranceFeePercent
    : 0;
  const insuranceFee = calculateInsuranceFee(
    order as Order,
    insuranceRate,
    settings,
  );
  const safeAdvance = Number((order as any).advancePayment) || 0;

  const actualShippingFee = calculateOrderShippingAndFees(
    order as Order,
    settings,
  );

  const total =
    (order as any).totalAmountOverride ??
    order.productPrice +
      actualShippingFee +
      inspectionFee -
      (order.discount || 0) -
      safeAdvance;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-white dark:border-slate-800 shadow-sm">
          <AlertTriangle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">
          هل أنت متأكد من تفاصيل الطلب؟
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          يرجى مراجعة الملخص المالي قبل تأكيد الطلب.
        </p>
        <div className="space-y-3 text-right bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold text-slate-500">إجمالي المنتجات:</span>
            <span className="font-black text-slate-700 dark:text-slate-200">
              {order.productPrice.toLocaleString()} ج.م
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-500">مصاريف الشحن:</span>
              {(order.weight || 0) > 0 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  (الوزن: {order.weight.toFixed(2)} كجم)
                </span>
              )}
            </div>
            <span className="font-black text-slate-700 dark:text-slate-200">
              {actualShippingFee.toLocaleString("ar-EG", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{" "}
              ج.م
            </span>
          </div>
          {inspectionFee > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-slate-500">رسوم المعاينة:</span>
              <span className="font-black text-slate-700 dark:text-slate-200">
                {inspectionFee.toLocaleString()} ج.م
              </span>
            </div>
          )}
          {insuranceFee > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-slate-500">
                رسوم التأمين ({insuranceRate}%):
              </span>
              <span className="font-black text-slate-700 dark:text-slate-200">
                {insuranceFee.toFixed(2)} ج.م
              </span>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between items-center text-sm text-red-500">
              <span className="font-bold">الخصم:</span>
              <span className="font-black">
                -{order.discount.toLocaleString()} ج.م
              </span>
            </div>
          )}
          <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
          <div className="flex justify-between items-center text-xl">
            <span className="font-black text-indigo-600 dark:text-indigo-400">
              الإجمالي المطلوب تحصيله:
            </span>
            <span className="font-black text-indigo-600 dark:text-indigo-400">
              {total.toLocaleString()} ج.م
            </span>
          </div>
        </div>
        <div className="mt-8 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm hover:shadow"
          >
            تأكيد وإضافة
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            رفض وتعديل
          </button>
        </div>
      </div>
    </div>
  );
};

const AutoWhatsappModal: React.FC<{
  order: Order;
  newStatus: string;
  onClose: () => void;
  settings: Settings;
}> = ({ order, newStatus, onClose, settings }) => {
  const defaultTemplate =
    settings.whatsappTemplates?.find((t) => t.id === "confirm")?.text ||
    "أهلاً [اسم العميل] 👋، تم تحديث حالة طلبك [اسم المنتج] إلى [حالة الطلب].";

  const [message, setMessage] = useState("");

  useEffect(() => {
    let msg = defaultTemplate;
    msg = msg.replace(/\[اسم العميل\]/g, order.customerName || "عميلنا العزيز");
    msg = msg.replace(/\[اسم المتجر\]/g, "متجرنا");
    msg = msg.replace(
      /\[اسم المنتج\]/g,
      (order.items || []).map((i) => i.name).join(" و "),
    );
    msg = msg.replace(/\[حالة الطلب\]/g, newStatus.replace(/_/g, " "));
    setMessage(msg);
  }, [order, newStatus, defaultTemplate, settings]);

  const handleSend = () => {
    const phone = order.customerPhone.replace(/[^0-9]/g, "");
    const formattedPhone = phone.startsWith("20")
      ? phone
      : `20${phone.replace(/^0+/, "")}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(
      `https://wa.me/${formattedPhone}?text=${encodedMessage}`,
      "_blank",
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-xl font-black dark:text-white">
              إشعار تحديث الحالة
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
          هل تود تنبيه العميل بتغير حالة الطلب إلى{" "}
          <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg">
            {newStatus.replace(/_/g, " ")}
          </span>
          ؟
        </p>
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-500 mb-2">
            نص رسالة الواتساب:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[120px] resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSend}
            className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
          >
            إرسال عبر الواتساب
            <ExternalLink size={18} />
          </button>
          <button
            onClick={onClose}
            className="py-3.5 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-50 dark:hover:bg-slate-700 transition-all whitespace-nowrap"
          >
            تخطي
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrdersList;
