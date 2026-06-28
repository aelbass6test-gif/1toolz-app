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
} from "lucide-react";
import {
  Order,
  Settings,
  OrderItem,
  Product,
  CustomerProfile,
  Store,
  User,
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

  if (!settings)
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Loader2 size={32} className="animate-spin mb-4" />
        <p className="text-sm font-bold">جاري تحميل الإعدادات...</p>
      </div>
    );

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
  const isDelivery =
    !(orderData as NewOrderState).shipmentType ||
    (orderData as NewOrderState).shipmentType === "delivery" ||
    (orderData as NewOrderState).shipmentType === "partial_delivery";
  let creditAmount = (orderData as NewOrderState).creditAmount || 0;

  const getCompanyDisplayName = (companyKey?: string) => {
    if (!companyKey) return "شركة الشحن";
    const name = companyKey.toLowerCase();
    if (name.includes("bosta") || name.includes("بوسطة") || name.includes("بوسطه")) {
      return "بوسطة";
    }
    if (name.includes("aramex") || name.includes("ارامكس")) {
      return "أرامكس";
    }
    if (name.includes("mylerz") || name.includes("مايلرز")) {
      return "مايلرز";
    }
    if (name.includes("turbo") || name.includes("توربو") || name.includes("تربو")) {
      return "توربو";
    }
    return companyKey;
  };

  // Customer Search State
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
  const [isDuesExpanded, setIsDuesExpanded] = useState(true);

  const globalCustomerStats = useMemo(() => {
    if (!allStoresData || !orderData.customerPhone) return null;
    let totalOrders = 0;
    let successfulOrders = 0;
    let debtBalance = 0;
    const cleanPhone = orderData.customerPhone
      .replace(/\s/g, "")
      .replace("+2", "");

    if (cleanPhone.length < 8) return null;

    Object.values(allStoresData).forEach((storeData: any) => {
      const storeCustomers = storeData.customers || [];
      const storeOrders = storeData.orders || [];

      const matchingOrders = storeOrders.filter(
        (o: any) =>
          o.customerPhone &&
          o.customerPhone.replace(/\s/g, "").replace("+2", "") === cleanPhone,
      );
      let dynamicTotal = matchingOrders.length;
      let dynamicSuccess = matchingOrders.filter((o: any) =>
        ["تم_توصيلها", "تم_التوصيل", "تم_التحصيل", "مدفوعة"].includes(o.status),
      ).length;

      const matchingCustomer = storeCustomers.find(
        (c: any) =>
          c.phone &&
          c.phone.replace(/\s/g, "").replace("+2", "") === cleanPhone,
      );
      if (matchingCustomer) {
        dynamicTotal = Math.max(
          dynamicTotal,
          matchingCustomer.totalOrders || 0,
        );
        dynamicSuccess = Math.max(
          dynamicSuccess,
          matchingCustomer.successfulOrders || 0,
        );
        debtBalance += matchingCustomer.debtBalance || 0;
      }

      totalOrders += dynamicTotal;
      successfulOrders += dynamicSuccess;
    });

    if (totalOrders === 0 && debtBalance === 0) {
      return {
        isNew: true,
        totalOrders: 0,
        successfulOrders: 0,
        successRate: 0,
        debtBalance: 0,
      };
    }
    return {
      isNew: false,
      totalOrders,
      successfulOrders,
      successRate: (successfulOrders / totalOrders) * 100,
      debtBalance,
    };
  }, [allStoresData, orderData.customerPhone]);

  if (isExchange && !creditAmount && orderData.originalOrderId) {
    const originalOrder = orders.find(
      (o) => o.id === orderData.originalOrderId,
    );
    if (originalOrder) {
      // User asked: "Only the initial shipping costs are unrelated, right?"
      // So we exclude shipping from the credit calculation.
      creditAmount = (originalOrder.productPrice || 0) - (originalOrder.discount || 0);
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

  const totalWeight = useMemo(() => {
    return (orderData.items || []).reduce(
      (sum, item) => sum + (item.weight || 0) * (item.quantity || 1),
      0,
    );
  }, [orderData.items]);

  // Helper functions moved from OrderModal
  const handleFieldChange = (field: keyof NewOrderState, value: any) =>
    setOrderData((prev: any) => ({ ...prev, [field]: value }));

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
        cost: firstProduct.costPrice || 0,
        weight: firstProduct.weight || 0,
        thumbnail: firstProduct.thumbnail || "",
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

  // Smart Calculation for Insurance Fee
  const insuranceFee = useMemo(() => {
    if (orderData.isInsured === false) return 0;

    const company = orderData.shippingCompany;
    const compFees = settings.companySpecificFees?.[company!];
    const useCustom = compFees?.useCustomFees ?? false;

    // Use company specific insurance rate if available, otherwise global setting
    const insuranceRate = useCustom
      ? (compFees?.insuranceFeePercent ?? 0)
      : settings.enableInsurance
        ? settings.insuranceFeePercent
        : 0;

    // Use the centralized method to ensure bosta and other settings are respected perfectly
    const valueForInsurance = Number(orderData.maintenanceItemValue || orderData.returnProductValue || 0);
    
    return calculateInsuranceFee(
      {
        ...(orderData as any),
        productPrice: valueForInsurance > 0 
          ? valueForInsurance 
          : (isMaintenance
            ? Number(orderData.maintenanceCost) || 0
            : isReturn
              ? Number(orderData.returnProductValue || orderData.maintenanceItemValue || 0)
              : subtotal - itemDiscounts),
      },
      insuranceRate,
      settings,
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
    orderData.governorate,
    orderData.city,
    orderData.shippingArea,
    orderData.vatOnStandardShipping,
    orderData.items,
  ]);

  // Smart VAT Calculation (14% default or from settings)
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

  const returnShippingFee = useMemo(() => {
    return getStandardShippingFee({ ...orderData, shipmentType: "return" } as any, settings);
  }, [orderData.shippingCompany, orderData.governorate, orderData.shippingArea, orderData.city, settings]);

  const returnVat = useMemo(() => {
    return Math.round(returnShippingFee * 0.14 * 100) / 100;
  }, [returnShippingFee]);

  // Final Amount to Collect (مبلغ التحصيل)
  const finalAmount = useMemo(() => {
    if (
      orderData.shipmentType === "maintenance_pickup" &&
      orderData.deferPaymentToReturn
    ) {
      return 0; // Customer pays everything upon return
    }

    const basePrice = isMaintenance
      ? Number(orderData.maintenanceCost) || 0
      : subtotal - itemDiscounts;
    const shipping = Number(orderData.shippingFee) || 0;
    const inspection = (orderData.includeInspectionFee && orderData.inspectionFeePaidByCustomer !== false) ? inspectionFee : 0;
    const insurance = insuranceFee;
    const vat = activeVatAmount;
    const flexShip = orderData.enableFlexShip ? Number(orderData.flexShipFee || 150) : 0;
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

    // Handle "Return cash to customer" (إرجاع مبالغ نقدية)
    if (orderData.returnCashToCustomer && orderData.cashToReturnAmount) {
      total -= Number(orderData.cashToReturnAmount);
    }

    return Math.max(0, Math.round(total));
  }, [
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
    orderData.enableFlexShip,
    orderData.flexShipFee,
    orderData.discount,
    orderData.advancePayment,
    creditAmount,
    orderData.returnCashToCustomer,
    orderData.cashToReturnAmount,
  ]);

  const liveProfitMargin = useMemo(() => {
    const costOfItems = (orderData.items || []).reduce(
      (sum: number, item: any) => {
        const prod = settings.products.find((p) => p.id === item.productId);
        let itemCostByQty = Number(prod?.costPrice) || 0;
        if (prod?.hasVariants && item.variantId) {
          const variant = prod.variants?.find((v) => v.id === item.variantId);
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

    const effectiveInspectionCost = (orderData.includeInspectionFee)
      ? inspectionFee
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
    const totalExpenses =
      costOfItems +
      Number(orderData.shippingFee || 0) +
      insuranceFee +
      effectiveInspectionCost +
      codFee +
      activeVatAmount;
    
    const advance = Number(orderData.advancePayment) || 0;
    const revenue = totalCollected + advance;
    const profit = revenue - totalExpenses;

    return {
      costOfItems,
      insuranceFee,
      effectiveInspectionCost,
      codFee,
      totalExpenses,
      profit,
      profitPercent:
        revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
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
    insuranceFee,
    activeVatAmount,
  ]);

  // FIX: Optimized and simplified companies calculation to prevent "missing carriers" issue
  const activeCompanies = useMemo(() => {
    const carrierKeys = Object.keys(settings.shippingOptions || {});
    return carrierKeys.filter(
      (company) => settings.activeCompanies?.[company] !== false,
    );
  }, [settings.shippingOptions, settings.activeCompanies]);

  const isFlexShipConfigured = useMemo(() => {
    const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
    const useCustom = compFees?.useCustomFees ?? false;
    return useCustom
      ? (compFees?.enableFlexShip ?? false)
      : (settings.enableFlexShip ?? false);
  }, [orderData.shippingCompany, settings]);

  const orderFlexShipActive = useMemo(() => {
    return orderData.enableFlexShip !== undefined
      ? orderData.enableFlexShip
      : isFlexShipConfigured;
  }, [orderData.enableFlexShip, isFlexShipConfigured]);

  const activeFlexShipFee = useMemo(() => {
    const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
    const useCustom = compFees?.useCustomFees ?? false;
    const defaultFlexShipFee = useCustom
      ? (compFees?.flexShipFee ?? 0)
      : (settings.flexShipFee ?? 0);
    return orderData.flexShipFee !== undefined && orderData.flexShipFee !== null
      ? orderData.flexShipFee
      : defaultFlexShipFee;
  }, [orderData.flexShipFee, orderData.shippingCompany, settings]);

  const activeFlexShipCompanyFee = useMemo(() => {
    const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
    const useCustom = compFees?.useCustomFees ?? false;
    const defaultFlexShipCompanyFee = useCustom
      ? (compFees?.flexShipCompanyFee ?? 0)
      : (settings.flexShipCompanyFee ?? 0);
    return orderData.flexShipCompanyFee !== undefined &&
      orderData.flexShipCompanyFee !== null
      ? orderData.flexShipCompanyFee
      : defaultFlexShipCompanyFee;
  }, [orderData.flexShipCompanyFee, orderData.shippingCompany, settings]);

  const shippingOptions = useMemo(() => {
    const company = orderData.shippingCompany;
    const userOptions = (company && settings.shippingOptions?.[company]) || [];

    // 1. Start with all user-defined options
    const result = [...userOptions];

    // 2. Add missing default governorates from EGYPT_GOVERNORATES
    EGYPT_GOVERNORATES.forEach((gov, index) => {
      const exists = result.some((o) => o.label === gov.name);
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
          cities: gov.cities.map((city, cIndex) => ({
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

    return result as any[];
  }, [settings.shippingOptions, orderData.shippingCompany]);

  const isFirstEditLoad = useRef(isEditing);

  useEffect(() => {
    const selectedOption = shippingOptions.find(
      (opt) => opt.label === (orderData.governorate || orderData.shippingArea),
    );
    if (selectedOption) {
      if (isFirstEditLoad.current) {
        isFirstEditLoad.current = false;
        return;
      }

      // If Manual Shipping is selected, we don't automatically update the shippingFee field
      // based on governorate/city changes. The user entered it manually.
      if (orderData.vatOnStandardShipping !== true) return;

      const getPriceKey = (
        type?: string,
      ):
        | "deliveryPrice"
        | "exchangePrice"
        | "returnPrice"
        | "cashCollectionPrice"
        | "returnToSenderPrice"
        | "maintenancePickupPrice"
        | "maintenanceReturnPrice" => {
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

      const currentTotalWeight =
        orderData.items?.reduce((sum: number, item: any) => {
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
    orderData.vatOnStandardShipping,
  ]);

  // ProductSelect Sub-component
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
          className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-sm font-bold text-right hover:bg-slate-100 dark:hover:bg-slate-700 transition-all outline-none"
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
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700">
              <input
                autoFocus
                type="text"
                placeholder="ابحث عن منتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
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
                        <Package size={24} className="m-auto text-slate-700 dark:text-slate-400" />
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

  const getThemeClasses = (type?: string) => {
    const base = {
      exchange: {
        baseColor: "purple",
        cardBg: "bg-white dark:bg-slate-900 border-t-4 border-t-purple-500",
      },
      return: {
        baseColor: "rose",
        cardBg: "bg-white dark:bg-slate-900 border-t-4 border-t-rose-500",
      },
      maintenance_pickup: {
        baseColor: "amber",
        cardBg: "bg-white dark:bg-slate-900 border-t-4 border-t-amber-500",
      },
      maintenance_return: {
        baseColor: "amber",
        cardBg: "bg-white dark:bg-slate-900 border-t-4 border-t-amber-500",
      },
      cash_collection: {
        baseColor: "emerald",
        cardBg: "bg-white dark:bg-slate-900 border-t-4 border-t-emerald-500",
      },
      partial_delivery: {
        baseColor: "blue",
        cardBg: "bg-white dark:bg-slate-900 border-t-4 border-t-blue-500",
      },
      delivery: {
        baseColor: "indigo",
        cardBg: "bg-white dark:bg-slate-900 border-t-4 border-t-indigo-500",
      }
    };
    
    const config = base[type as keyof typeof base] || base.delivery;
    const c = config.baseColor;
    
    return {
      baseColor: c,
      bgMain: `bg-${c}-600`,
      bgHover: `hover:bg-${c}-700`,
      textMain: `text-${c}-600`,
      textDark: `dark:text-${c}-400`,
      textStrong: `text-${c}-700`,
      textUltraDark: `text-${c}-900`,
      textUltraLight: `text-${c}-100`,
      bgLight: `bg-${c}-50`,
      bgLightDark: `dark:bg-${c}-500/10`,
      bgLightHover: `bg-${c}-100`,
      bgLightHoverDark: `dark:bg-${c}-500/20`,
      shadow: `shadow-${c}-500/30`,
      border: `border-${c}-500`,
      borderLight: `border-slate-200/80 dark:border-slate-700/80`,
      ring: `ring-${c}-200 dark:ring-${c}-700`,
      ringGlow: `ring-${c}-500/10`,
      glow: `bg-${c}-500/5`,
      bgDark: `bg-${c}-900`,
      cardBg: config.cardBg,
    };
  };

  const tClass = getThemeClasses(orderData.shipmentType);

  return (
    <div
      className={`min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 transition-colors duration-700`}
      dir="rtl"
    >
      <div className={`fixed inset-0 pointer-events-none ${tClass.glow} opacity-50 transition-colors duration-1000`}></div>
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSubmit}
        className="max-w-6xl mx-auto space-y-8"
      >
        {/* Header (Desktop Style) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onCancel}
              className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm group"
            >
              <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight flex items-center gap-3">
                <div className={`w-2 h-8 ${tClass.bgMain} rounded-full`}></div>
                {isEditing
                  ? `تعديل الطلب #${orderData.orderNumber}`
                  : "إنشاء طلب جديد"}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-bold mt-1">
                أكمل بيانات الطلب لبدء عملية الشحن والتحصيل في الوقت الفعلي.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 font-bold rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className={`px-8 py-3.5 ${tClass.bgMain} text-white font-black rounded-2xl ${tClass.bgHover} transition-all shadow-xl ${tClass.shadow} flex items-center gap-2.5 text-sm active:scale-95`}
            >
              <Save size={18} />
              <span>{isEditing ? "حفظ التعديلات" : "إتمام الطلب"}</span>
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className={`flex flex-col xl:flex-row gap-6 lg:gap-10 pb-20 max-w-[1400px] mx-auto transition-all items-start`}>
          <div className={`space-y-6 lg:space-y-8 transition-all duration-500 w-full flex-1 ${isCashCollection ? "order-2 xl:order-2" : "order-1 xl:order-1"}`}>
            {/* Shipment Type Selector - Modern Segmented Control */}
            <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-1">
              {(() => {
                const compFees = (settings.companySpecificFees?.[
                  orderData.shippingCompany!
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
                if (compFees.enableExchange !== false)
                  tabs.push({
                    id: "exchange",
                    label: "تبديل شحنة",
                    icon: <ArrowRightLeft size={17} />,
                  });
                if (compFees.enableReturn !== false)
                  tabs.push({
                    id: "return",
                    label: "إرجاع شحنة",
                    icon: <RefreshCcw size={17} />,
                  });
                if (compFees.enableCashCollection !== false)
                  tabs.push({
                    id: "cash_collection",
                    label: "تحصيل نقدي",
                    icon: <Coins size={17} />,
                  });
                tabs.push({
                  id: "maintenance_pickup",
                  label: "سحب منتج للصيانة",
                  icon: <SettingsIcon size={17} />,
                });
                tabs.push({
                  id: "maintenance_return",
                  label: "توصيل منتج صيانة",
                  icon: <Wand2 size={17} />,
                });
                return tabs;
              })().map((tab) => {
                const isActive =
                  (orderData.shipmentType || "delivery") === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      handleFieldChange("shipmentType", tab.id);
                      if (tab.id.startsWith("maintenance_")) {
                        handleFieldChange("orderType", "maintenance");
                      } else if (tab.id === "exchange") {
                        handleFieldChange("orderType", "exchange");
                      } else {
                        handleFieldChange("orderType", "standard");
                      }
                    }}
                    className={`relative flex items-center gap-2.5 py-3 px-6 rounded-2xl text-xs font-black transition-all duration-300 shrink-0 ${
                      isActive
                        ? `bg-white dark:bg-slate-800 ${tClass.textMain} dark:text-white shadow-xl shadow-black/5 ring-1 ${tClass.ring}`
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-700 dark:text-slate-400"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className="text-[10px] px-2 py-0.5 ${tClass.bgMain} text-white rounded-lg font-bold leading-none">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tracking Number Input for Returns */}
            {(isReturn || isExchange) && (
              <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm relative overflow-hidden group`}>
                <div className="flex justify-between items-center mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      const tracking = (orderData.returnTrackingNumber || "").trim();
                      if (!tracking) {
                        alert("يرجى إدخال رقم البوليصة أو رقم الأوردر.");
                        return;
                      }
                      const foundOrder = orders?.find(
                        (o) =>
                          o.waybillNumber === tracking ||
                          o.orderNumber === tracking ||
                          o.referenceNumber === tracking ||
                          o.id === tracking
                      );
                      if (foundOrder) {
                        setOrderData((prev: any) => ({
                          ...prev,
                          customerName: foundOrder.customerName || "",
                          customerPhone: foundOrder.customerPhone || "",
                          customerPhone2: foundOrder.customerPhone2 || "",
                          customerAddress: foundOrder.customerAddress || "",
                          city: foundOrder.city || "",
                          governorate: foundOrder.governorate || "",
                          store_id: foundOrder.store_id || prev.store_id,
                          // Autoload item details
                          useProductsForReturn: foundOrder.items?.length > 0 && foundOrder.items?.[0]?.productId !== "return-shipment",
                          returnProductId: foundOrder.items?.[0]?.productId || "",
                          returnVariantId: foundOrder.items?.[0]?.variantId || "",
                          returnDescription: foundOrder.items?.[0]?.name || "",
                          returnQuantity: foundOrder.items?.[0]?.quantity || 1,
                        }));
                        alert("تم جلب بيانات العميل والمنتج بنجاح!");
                      } else {
                        alert("لم يتم العثور على أوردر بهذا الرقم.");
                      }
                    }}
                    className={`text-xs font-black ${tClass.textMain} ${tClass.textDark} ${tClass.bgLight} ${tClass.bgLightDark} px-4 py-1.5 rounded-lg hover:${tClass.bgLightHover} ${tClass.bgLightHoverDark} transition-colors`}
                  >
                    تطبيق
                  </button>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider uppercase">
                    رقم تتبع الأوردر المراد إرجاعه اختياري
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="أدخل رقم البوليصة أو رقم الأوردر لملى البيانات اوتوماتيكيا"
                  value={orderData.returnTrackingNumber || ""}
                  onChange={(e) => handleFieldChange("returnTrackingNumber", e.target.value)}
                  className={`p-4.5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full focus:ring-4 focus:${tClass.ringGlow} focus:${tClass.border} focus:bg-white outline-none transition-all dark:text-white font-black text-lg text-right`}
                />
                <p className="text-[10px] text-slate-400 font-bold block mt-2 text-right">
                  لملى البيانات اوتوماتيكيا
                </p>
              </div>
            )}

            {/* Customer Details Card */}
            <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm relative overflow-hidden group`}>
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                <div className="w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}">
                  <UserIcon size={24} />
                </div>
                بيانات العميل
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider uppercase">
                      اسم العميل
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomerListOpen(true)}
                      className={`text-[10px] font-black ${tClass.textMain} ${tClass.textDark} ${tClass.bgLight} ${tClass.bgLightDark} px-2 py-1 rounded-lg hover:${tClass.bgLightHover} transition-colors flex items-center gap-1`}
                    >
                      <UserIcon size={12} /> اختيار من المسجلين
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="اسم العميل"
                    required
                    value={orderData.customerName || ""}
                    onChange={(e) =>
                      handleFieldChange("customerName", e.target.value)
                    }
                    className="p-4.5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-black text-lg"
                  />

                  {/* Debt Notification */}
                  {orderData.customerPhone &&
                    (customers || []).find(
                      (c) => c.phone === orderData.customerPhone,
                    )?.debtBalance! > 0 && (
                      <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-center gap-3 animate-pulse">
                        <AlertCircle
                          className="text-red-600 shrink-0"
                          size={20}
                        />
                        <div>
                          <p className="text-red-700 dark:text-red-400 text-xs font-black">
                            تنبيه: مديونية مسجلة
                          </p>
                          <p className="text-red-600 dark:text-red-300 text-[10px] font-bold">
                            العميل عليه دين بقيمة{" "}
                            <span className="underline font-black text-xs">
                              {
                                (customers || []).find(
                                  (c) => c.phone === orderData.customerPhone,
                                )?.debtBalance
                              }{" "}
                              ج.م
                            </span>
                          </p>
                        </div>
                      </div>
                    )}

                  <CustomerSelectModal
                    isOpen={isCustomerListOpen}
                    onClose={() => setIsCustomerListOpen(false)}
                    customers={customers}
                    onSelect={(c) => {
                      handleCustomerSelect(c);
                      setIsCustomerListOpen(false);
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider uppercase">
                      رقم الهاتف الأساسي
                    </label>
                    {orderData.customerPhone && (
                      <button
                        type="button"
                        onClick={() => window.open(`https://wa.me/2${orderData.customerPhone!.replace(/\s/g, "")}`, '_blank')}
                        className="text-[10px] font-black ${tClass.textMain} dark:text-emerald-400 ${tClass.bgLight} ${tClass.bgLightDark} px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> تواصل واتساب
                      </button>
                    )}
                  </div>
                  <input
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    required
                    value={orderData.customerPhone || ""}
                    onChange={(e) =>
                      handleFieldChange("customerPhone", e.target.value)
                    }
                    className="p-4.5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-black text-lg text-right tracking-widest"
                    dir="ltr"
                  />
                  {globalCustomerStats && (
                    <div
                      className={`mt-3 text-xs flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border ${globalCustomerStats.isNew ? "bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300" : globalCustomerStats.totalOrders > 0 && globalCustomerStats.successRate < 50 ? "bg-rose-50/80 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-700 dark:text-rose-300" : "${tClass.bgLight}/80 dark:${tClass.bgMain}/10 ${tClass.borderLight} dark:${tClass.border}/20 ${tClass.textStrong} dark:${tClass.textDark}"}`}
                    >
                      {globalCustomerStats.isNew ? (
                        <span className="font-bold flex items-center gap-1.5">
                          <Star size={14} className="fill-current" />
                          عميل جديد (أول تعامل)
                        </span>
                      ) : (
                        <>
                          <span className="font-bold flex items-center gap-1.5">
                            <Star size={14} className="fill-current" />
                            نسبة نجاح العميل:{" "}
                            <span className="font-black text-sm">
                              {Math.round(globalCustomerStats.successRate)}%
                            </span>
                          </span>
                          {globalCustomerStats.debtBalance > 0 && (
                            <span className="font-bold flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg animate-pulse">
                              <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                              مديونية سابقة:{" "}
                              <span className="font-black text-sm">
                                {globalCustomerStats.debtBalance} ج.م
                              </span>
                            </span>
                          )}
                          <span className="font-medium opacity-80 backdrop-blur-sm">
                            ({globalCustomerStats.successfulOrders} طلب ناجح /{" "}
                            {globalCustomerStats.totalOrders} إجمالي) بجميع
                            متاجرك
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                    رقم هاتف إضافي (اختياري)
                  </label>
                  <input
                    type="tel"
                    placeholder="رقم بديل للعميل"
                    value={(orderData as NewOrderState).customerPhone2 || ""}
                    onChange={(e) =>
                      handleFieldChange("customerPhone2", e.target.value)
                    }
                    className="p-4.5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold text-right"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                    الدولة
                  </label>
                  <input
                    type="text"
                    placeholder="مصر"
                    value={(orderData as NewOrderState).country || "مصر"}
                    className="p-4.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full opacity-60 cursor-not-allowed dark:text-slate-400 font-black"
                    disabled
                  />
                </div>
              </div>
              <div className="mt-6">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                  العنوان بالتفصيل
                </label>
                <textarea
                  placeholder="شارع، منطقة، علامة مميزة..."
                  required
                  value={orderData.customerAddress || ""}
                  onChange={(e) =>
                    handleFieldChange("customerAddress", e.target.value)
                  }
                  className="w-full p-5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-3xl h-28 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all resize-none dark:text-white font-bold"
                />
              </div>
              <div className="mt-6">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                  تفاصيل المبنى (رقم الشقة، الدور...)
                </label>
                <input
                  type="text"
                  placeholder="مثال: عمارة رقم 5، الدور الثالث، شقة 10"
                  value={(orderData as NewOrderState).buildingDetails || ""}
                  onChange={(e) =>
                    handleFieldChange("buildingDetails", e.target.value)
                  }
                  className="w-full p-4 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold"
                />
              </div>
            </div>

            {/* Shipping Details Card */}
            <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm relative overflow-hidden group`}>
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                <div className="w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}">
                  <Building size={24} />
                </div>
                بيانات الشحن والمنطقة
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                    شركة الشحن
                  </label>
                  <select
                    required
                    value={orderData.shippingCompany}
                    onChange={(e) =>
                      handleFieldChange("shippingCompany", e.target.value)
                    }
                    className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-black cursor-pointer"
                  >
                    {activeCompanies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                {(settings.warehouses || []).length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                      مستودع الشحن (المصدر)
                    </label>
                    <select
                      required
                      value={
                        orderData.warehouseId ||
                        settings.warehouses?.find((w) => w.isDefault)?.id ||
                        ""
                      }
                      onChange={(e) =>
                        handleFieldChange("warehouseId", e.target.value)
                      }
                      className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-black cursor-pointer"
                    >
                      <option value="">-- اختر مستودع الشحن --</option>
                      {settings.warehouses?.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.isDefault ? "(الافتراضي)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
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
                      className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-black cursor-pointer text-sm"
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
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                      المدينة
                    </label>
                    <select
                      required
                      value={orderData.city || ""}
                      onChange={(e) =>
                        handleFieldChange("city", e.target.value)
                      }
                      className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-black cursor-pointer text-sm disabled:opacity-50"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                    رقم الطلب (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="تلقائي"
                    value={orderData.orderNumber || ""}
                    onChange={(e) =>
                      handleFieldChange("orderNumber", e.target.value)
                    }
                    className="p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white text-sm font-black"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                    رقم المرجع للفاتورة
                  </label>
                  <input
                    type="text"
                    placeholder="#"
                    value={orderData.referenceNumber || ""}
                    onChange={(e) =>
                      handleFieldChange("referenceNumber", e.target.value)
                    }
                    className="p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white text-sm font-black"
                  />
                </div>
              </div>
            </div>

            <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm`}>
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-xl">
                <div className="w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}">
                  <CreditCard size={24} />
                </div>
                طريقة الدفع
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {settings.paymentMethods
                  ?.filter((m) => m.active)
                  .map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() =>
                        handleFieldChange("paymentMethod", method.name)
                      }
                      className={`p-4 rounded-2xl border-2 font-bold transition-all ${orderData.paymentMethod === method.name ? "bg-sky-100 border-sky-500 text-sky-700 dark:bg-sky-500/20 dark:border-sky-500 dark:text-sky-300" : "bg-slate-50 border-transparent text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100"}`}
                    >
                      {method.name}
                    </button>
                  )) ||
                  /* Fallback if no payment methods configured */
                  ["كاش", "محفظة", "تحويل", "فيزا"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handleFieldChange("paymentMethod", method)}
                      className={`p-4 rounded-2xl border-2 font-bold transition-all ${orderData.paymentMethod === method ? "bg-sky-100 border-sky-500 text-sky-700 dark:bg-sky-500/20 dark:border-sky-500 dark:text-sky-300" : "bg-slate-50 border-transparent text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100"}`}
                    >
                      {method}
                    </button>
                  ))}
              </div>
            </div>

            <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm`}>
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-xl">
                <div className="w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}">
                  <ImageIcon size={24} />
                </div>
                صور ومرفقات الطلب
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                {(orderData.images || []).map((img: string, idx: number) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-3xl overflow-hidden border border-slate-200/60 dark:border-slate-700/60 group shadow-lg"
                  >
                    <img
                      src={img}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
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
                        className="w-10 h-10 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-xl scale-90 group-hover:scale-100 flex items-center justify-center"
                      >
                        <X size={20} />
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
                  className={`aspect-square rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center justify-center text-slate-400 hover:${tClass.textMain} hover:${tClass.border} hover:${tClass.bgLight} dark:hover:${tClass.glow} transition-all group`}
                >
                  <Plus
                    size={32}
                    className="mb-2 group-hover:scale-110 transition-transform"
                  />
                  <span className="text-xs font-black">إضافة صوره</span>
                </button>
              </div>
            </div>

            {!isReturn && !isExchange && (
              <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm`}>
                <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-xl">
                  <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}`}>
                    <FileText size={24} />
                  </div>
                  ملاحظات إضافية
                </h4>
                <textarea
                  placeholder="اكتب أي ملاحظات خاصة للطلب أو المندوب..."
                  value={orderData.notes || ""}
                  onChange={(e) => handleFieldChange("notes", e.target.value)}
                  className="w-full p-6 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-[2rem] h-32 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 outline-none transition-all resize-none dark:text-white font-bold"
                />
              </div>
            )}

            {isExchange && (
              <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm space-y-6`}>
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}`}>
                      <LayoutList size={24} />
                    </div>
                    <h4 className="font-extrabold text-slate-800 dark:text-white text-xl">
                      تفاصيل الشحنة (المنتجات البديلة المرسلة)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className={`flex items-center gap-2 px-6 py-3 ${tClass.bgLight} ${tClass.bgLightDark} ${tClass.textMain} dark:${tClass.textDark} rounded-2xl font-black hover:${tClass.bgLightHover} ${tClass.bgLightHoverDark} transition-all text-sm group`}
                  >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                    <span>إضافة منتج</span>
                  </button>
                </div>

                <div className="space-y-6">
                  {(orderData.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 relative group transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-xl"
                    >
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="absolute top-4 left-4 p-2.5 text-slate-700 dark:text-slate-400 hover:text-red-500 hover:bg-red-55 dark:hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="space-y-5">
                        <ProductSelect
                          value={item.productId || ""}
                          onChange={(val) => handleItemChange(idx, "productId", val)}
                          products={settings.products}
                          index={idx}
                        />
                        {settings.products.find((p) => p.id === item.productId)?.hasVariants && (
                          <div>
                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest text-right">
                              المقاس / اللون
                            </label>
                            <select
                              value={item.variantId || ""}
                              onChange={(e) => handleItemChange(idx, "variantId", e.target.value)}
                              className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-sm text-right cursor-pointer"
                            >
                              <option value="">اختر النوع</option>
                              {settings.products
                                .find((p) => p.id === item.productId)
                                ?.variants?.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {Object.entries(v.options || {})
                                      .map(([k, val]) => `${k}:${val}`)
                                      .join(" - ")}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest text-right">
                              الكمية
                            </label>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-1.5">
                              <button
                                type="button"
                                onClick={() => handleItemChange(idx, "quantity", Math.max(1, (item.quantity || 1) - 1))}
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all font-bold text-lg"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity || 1}
                                onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                                className="w-full bg-transparent text-center font-black text-lg p-0 border-none outline-none text-right"
                              />
                              <button
                                type="button"
                                onClick={() => handleItemChange(idx, "quantity", (item.quantity || 1) + 1)}
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all font-bold text-lg"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest text-right">
                              السعر
                            </label>
                            <input
                              type="number"
                              value={item.price || 0}
                              onChange={(e) => handleItemChange(idx, "price", Number(e.target.value))}
                              className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl w-full font-black text-lg ${tClass.textMain} text-center"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                          <span className="text-xs font-bold text-slate-400">إجمالي المنتج:</span>
                          <span className={`text-sm font-black ${tClass.textMain} ${tClass.textDark}`}>
                            {((item.price || 0) * (item.quantity || 1)).toLocaleString()} ج.م
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!orderData.items || orderData.items.length === 0) && (
                    <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200/60 dark:border-slate-700/60 rounded-[2.5rem]">
                      <p className="text-slate-400 font-bold">لا توجد منتجات مضافة لهذا الطلب</p>
                      <button
                        type="button"
                        onClick={addItem}
                        className={`mt-4 px-8 py-3 ${tClass.bgMain} text-white rounded-2xl font-black text-sm shadow-lg ${tClass.shadow}`}
                      >
                        أضف المنتج الأول
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(isReturn || isExchange) && (
              <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm space-y-6`}>
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}`}>
                      <RefreshCcw size={24} />
                    </div>
                    <h4 className="font-extrabold text-slate-800 dark:text-white text-xl">
                      تفاصيل الشحنة المرتجعة
                    </h4>
                  </div>

                  {/* Switch toggle "اختر من المنتجات" */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-600 dark:text-slate-700 dark:text-slate-400">
                      اختر من المنتجات
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFieldChange("useProductsForReturn", !orderData.useProductsForReturn)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 relative flex items-center ${
                        orderData.useProductsForReturn ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 absolute ${
                          orderData.useProductsForReturn ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {orderData.useProductsForReturn ? (
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase text-right">
                        المنتج المراد استرجاعه
                      </label>
                      <ProductSelect
                        value={orderData.returnProductId || ""}
                        onChange={(val) => {
                          const prod = settings.products.find((p) => p.id === val);
                          handleFieldChange("returnProductId", val);
                          handleFieldChange("returnVariantId", undefined);
                          handleFieldChange("returnDescription", prod?.name || "");
                          // set default return value to product price for insurance
                          const price = prod?.price || 0;
                          handleFieldChange("returnProductValue", price);
                          handleFieldChange("maintenanceItemValue", price);
                        }}
                        products={settings.products}
                        index={0}
                      />
                    </div>
                    {settings.products.find((p) => p.id === orderData.returnProductId)?.hasVariants && (
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase text-right">
                          المقاس / اللون
                        </label>
                        <select
                          value={orderData.returnVariantId || ""}
                          onChange={(e) => {
                            const varId = e.target.value;
                            const prod = settings.products.find((p) => p.id === orderData.returnProductId);
                            const variant = prod?.variants?.find((v) => v.id === varId);
                            handleFieldChange("returnVariantId", varId);
                            let desc = prod?.name || "";
                            if (variant) {
                              desc += ` (${Object.entries(variant.options || {})
                                .map(([k, v]) => `${k}:${v}`)
                                .join(", ")})`;
                            }
                            handleFieldChange("returnDescription", desc);
                          }}
                          className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-sm text-right cursor-pointer"
                        >
                          <option value="">اختر النوع</option>
                          {settings.products
                            .find((p) => p.id === orderData.returnProductId)
                            ?.variants?.map((v) => (
                              <option key={v.id} value={v.id}>
                                {Object.entries(v.options || {})
                                  .map(([key, val]) => `${key}: ${val}`)
                                  .join(" - ")}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase text-right">
                          الكمية
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={orderData.returnQuantity || 1}
                          onChange={(e) => handleFieldChange("returnQuantity", Number(e.target.value))}
                          className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-center text-lg"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase text-right">
                          سعر الفتح
                        </label>
                        <div className="w-full p-4.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-center text-lg">
                          0 ج.م
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase text-right">
                        سبب الإرجاع / تفاصيل
                      </label>
                      <textarea
                        value={orderData.returnDescription || ""}
                        onChange={(e) => handleFieldChange("returnDescription", e.target.value)}
                        className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl h-24 text-sm font-bold resize-none text-right"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase text-right">
                        تفاصيل الشحنة المرتجعة / سبب الإرجاع
                      </label>
                      <textarea
                        value={orderData.returnDescription || ""}
                        onChange={(e) => handleFieldChange("returnDescription", e.target.value)}
                        placeholder="مثال: يرجى كتابة اسم المنتج وسبب الاسترجاع هنا..."
                        className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl h-32 text-sm font-bold resize-none text-right"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase text-right">
                          الكمية
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={orderData.returnQuantity || 1}
                          onChange={(e) => handleFieldChange("returnQuantity", Number(e.target.value))}
                          className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-center text-lg text-right"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase text-right">
                          سعر الفتح
                        </label>
                        <div className="w-full p-4.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-center text-lg">
                          0 ج.م
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`space-y-6 lg:space-y-8 transition-all duration-500 w-full ${isCashCollection ? "xl:w-full order-1 xl:order-1" : isExchange ? "xl:max-w-[600px] order-2 xl:order-2 xl:sticky xl:top-8 self-start" : "xl:max-w-[450px] 2xl:max-w-[500px] order-2 xl:order-2 xl:sticky xl:top-8 self-start"}`}>
            {/* Products / Details based on Shipment type */}
            {isReturn ? (
              <div className="space-y-8">
                {/* Card 1: Financial & Insurance Card */}
                <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm relative overflow-hidden`}>
                  <div className="flex justify-between items-center mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt("أدخل رابط صورة إثبات الإرجاع:");
                        if (url) {
                          handleFieldChange("returnImage", url);
                          alert("تم رفع إثبات الإرجاع بنجاح!");
                        }
                      }}
                      className={`text-xs font-black ${tClass.textMain} ${tClass.textDark} ${tClass.bgLight} ${tClass.bgLightDark} px-4 py-1.5 rounded-lg hover:${tClass.bgLightHover} ${tClass.bgLightHoverDark} transition-colors flex items-center gap-1.5`}
                    >
                      <Upload size={14} />
                      <span>رفع الإثبات</span>
                    </button>
                    <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2.5 text-lg">
                      <Coins size={20} className="text-amber-500" />
                      <span>التحصيل المالي والتأمين</span>
                    </h4>
                  </div>

                  <div className="space-y-6">
                    {/* Toggle: Return Cash To Customer */}
                    <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <button
                        type="button"
                        onClick={() => handleFieldChange("returnCashToCustomer", !orderData.returnCashToCustomer)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 relative flex items-center ${
                          orderData.returnCashToCustomer ? tClass.bgMain : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 absolute ${
                            orderData.returnCashToCustomer ? "right-1" : "left-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm font-black text-slate-700 dark:text-slate-700 dark:text-slate-400">
                        إرجاع مبلغ نقدى للعميل
                      </span>
                    </div>

                    {orderData.returnCashToCustomer && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider text-right">
                          القيمة المراد إرجاعها للعميل
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            placeholder="0"
                            value={orderData.cashToReturnAmount || ""}
                            onChange={(e) => handleFieldChange("cashToReturnAmount", Number(e.target.value))}
                            className={`p-4.5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full text-right font-black text-lg focus:ring-4 focus:${tClass.ringGlow} focus:${tClass.border} outline-none transition-all dark:text-white pl-12`}
                          />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">
                            ج.م
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Insurance Field */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider text-right">
                        قيمة المنتج (للتأمين)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="0"
                          value={orderData.returnProductValue || orderData.maintenanceItemValue || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            handleFieldChange("returnProductValue", val);
                            handleFieldChange("maintenanceItemValue", val);
                          }}
                          className={`p-4.5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full text-right font-black text-lg focus:ring-4 focus:${tClass.ringGlow} focus:${tClass.border} outline-none transition-all dark:text-white pl-12`}
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">
                          ج.م
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold text-right mr-1 flex items-center justify-end gap-1">
                        <span>مصاريف التأمين = {insuranceFee} ج.م</span>
                        <HelpCircle size={12} />
                      </p>
                    </div>

                    {/* Accordion: Bosta Dues Estimation */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-850">
                      <button
                        type="button"
                        onClick={() => setIsDuesExpanded(!isDuesExpanded)}
                        className="w-full p-4 flex justify-between items-center font-extrabold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isDuesExpanded ? <ChevronDown size={16} /> : <ChevronDown size={16} className="rotate-180" />}
                          <span className={`${tClass.textMain} ${tClass.textDark} font-black`}>
                            {(returnShippingFee + returnVat + insuranceFee).toFixed(2)} ج.م
                          </span>
                        </div>
                        <span className="flex items-center gap-1.5">
                          <Calculator size={18} className={`${tClass.textMain} transition-transform group-hover:scale-110`} />
                          <span>تقدير مستحقات {getCompanyDisplayName(orderData.shippingCompany)}</span>
                        </span>
                      </button>

                      {isDuesExpanded && (
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-3.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <div className="flex justify-between items-center">
                            <span>{returnShippingFee} ج.م</span>
                            <span>سعر الشحن</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>{returnVat} ج.م</span>
                            <span>ضريبة قيمة مضافة 14%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>{insuranceFee} ج.م</span>
                            <span>التأمين</span>
                          </div>
                          <div className="pt-3 border-t border-dashed border-slate-100 dark:border-slate-800 flex justify-between items-center font-black text-slate-800 dark:text-white">
                            <span className={`${tClass.textMain} ${tClass.textDark} font-extrabold text-sm`}>
                              {(returnShippingFee + returnVat + insuranceFee).toFixed(2)} ج.م
                            </span>
                            <span>المجموع الكلي المقدر</span>
                          </div>

                          {/* Pay with Bosta Points */}
                          <div className="pt-3 border-t border-dashed border-slate-100 dark:border-slate-800 flex justify-end items-center gap-2.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-700 dark:text-slate-400">
                              دفع الأوردر بنقاط {getCompanyDisplayName(orderData.shippingCompany)}
                            </span>
                            <input
                              type="checkbox"
                              checked={orderData.payWithBostaPoints || false}
                              onChange={(e) => handleFieldChange("payWithBostaPoints", e.target.checked)}
                              className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 ${tClass.textMain} focus:ring-${tClass.baseColor}-500 dark:bg-slate-800 cursor-pointer`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card 2: Location & References Card */}
                <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm space-y-6`}>
                  <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center justify-end gap-2.5 text-lg pb-4 border-b border-slate-100 dark:border-slate-800">
                    <Building size={20} className={`${tClass.textMain}`} />
                    <span>الموقع والراجع</span>
                  </h4>

                  {/* Return Location / Warehouse */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider text-right">
                      موقع إرجاع الشحنة
                    </label>
                    <select
                      value={orderData.warehouseId || ""}
                      onChange={(e) => handleFieldChange("warehouseId", e.target.value)}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-sm text-right cursor-pointer"
                    >
                      <option value="">اختر موقع الإرجاع</option>
                      {settings.warehouses?.map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* platformOrderId */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider text-right">
                      مرجع الطلب اختياري
                    </label>
                    <input
                      type="text"
                      placeholder="أدخل مرجع الطلب الخاص بك..."
                      value={orderData.platformOrderId || ""}
                      onChange={(e) => handleFieldChange("platformOrderId", e.target.value)}
                      className={`p-4.5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full text-right font-black text-sm focus:ring-4 focus:${tClass.ringGlow} focus:${tClass.border} outline-none transition-all dark:text-white`}
                    />
                  </div>

                  {/* Delivery Notes */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider text-right">
                      ملحوظات عند التوصيل اختياري
                    </label>
                    <textarea
                      placeholder="أدخل أي ملاحظات للتوصيل..."
                      value={orderData.notes || ""}
                      onChange={(e) => handleFieldChange("notes", e.target.value)}
                      className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl h-24 text-sm font-bold resize-none text-right"
                    />
                  </div>
                </div>
              </div>
            ) : isExchange ? (
              <>
                {/* Card 1: التحصيل المالي والتأمين */}
                <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm space-y-6`}>
                  <h4 className="font-extrabold text-slate-800 dark:text-white mb-2 flex items-center gap-3 text-xl">
                    <div className="w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}">
                      <CreditCard size={24} />
                    </div>
                    التحصيل المالي والتأمين
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleFieldChange("returnCashToCustomer", false)}
                      className={`p-4 rounded-2xl border-2 font-bold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${!orderData.returnCashToCustomer ? "${tClass.bgLight} ${tClass.bgLightDark} border-emerald-500 text-emerald-700" : "bg-slate-50 border-transparent text-slate-600 dark:bg-slate-800"}`}
                    >
                      <span className="text-xs font-black">تحصيل مبالغ من العميل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleFieldChange("returnCashToCustomer", true);
                        if (!orderData.cashToReturnAmount) {
                          handleFieldChange("cashToReturnAmount", 0);
                        }
                      }}
                      className={`p-4 rounded-2xl border-2 font-bold transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${orderData.returnCashToCustomer ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-700" : "bg-slate-50 border-transparent text-slate-600 dark:bg-slate-800"}`}
                    >
                      <span className="text-xs font-black">إرجاع مبالغ للعميل</span>
                    </button>
                  </div>

                  {!orderData.returnCashToCustomer ? (
                    <div className="space-y-2 mt-4 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-[10px] font-black text-slate-400 block mr-1 text-right uppercase">
                        المبلغ المطلوب تحصيله نقداً من العميل
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder={finalAmount.toString()}
                          value={orderData.totalAmountOverride ?? ""}
                          onChange={(e) => handleFieldChange("totalAmountOverride", e.target.value === "" ? undefined : Number(e.target.value))}
                          className="w-full p-4 pl-14 bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-xl ${tClass.textMain} text-center"
                        />
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400">ج.م</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-4 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-[10px] font-black text-slate-400 block mr-1 text-right uppercase">
                        المبلغ المطلوب إرجاعه نقداً للعميل
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="0"
                          value={orderData.cashToReturnAmount ?? ""}
                          onChange={(e) => handleFieldChange("cashToReturnAmount", Number(e.target.value))}
                          className="w-full p-4 pl-14 bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-xl text-rose-600 text-center"
                        />
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400">ج.م</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-4.5 bg-slate-50 dark:bg-slate-800 rounded-2xl cursor-pointer">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">السماح للعميل بفتح الشحنة؟</span>
                      <input
                        type="checkbox"
                        checked={orderData.includeInspectionFee || false}
                        onChange={(e) => handleFieldChange("includeInspectionFee", e.target.checked)}
                        className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
                      />
                    </label>

                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-4.5 bg-slate-50 dark:bg-slate-800 rounded-2xl cursor-pointer">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">تطبيق فليكس شيب</span>
                        <input
                          type="checkbox"
                          checked={orderData.enableFlexShip || false}
                          onChange={(e) => {
                            handleFieldChange("enableFlexShip", e.target.checked);
                            if (e.target.checked && !orderData.flexShipFee) {
                              handleFieldChange("flexShipFee", 150);
                            }
                          }}
                          className="w-5 h-5 accent-sky-500 rounded cursor-pointer"
                        />
                      </label>
                      {orderData.enableFlexShip && (
                        <div className="flex gap-4 items-center animate-in slide-in-from-top-1 duration-200">
                          <div className="w-full">
                            <label className="text-[10px] text-slate-400 font-bold block mb-1 text-right">رسوم فليكس شيب</label>
                            <input
                              type="number"
                              value={orderData.flexShipFee || 150}
                              onChange={(e) => handleFieldChange("flexShipFee", Number(e.target.value))}
                              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl w-full text-center font-bold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 flex items-center gap-2 justify-end">
                          <span className="text-[10px] text-slate-400">(لتغطية {getCompanyDisplayName(orderData.shippingCompany)} للتأمين)</span>
                          <span>قيمة المنتج (للتأمين)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={orderData.returnProductValue || ""}
                            onChange={(e) => handleFieldChange("returnProductValue", Number(e.target.value))}
                            className="w-full p-4.5 pl-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-black text-xl text-right"
                            placeholder="0"
                          />
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-700 dark:text-slate-400">ج.م</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 text-right">
                          مصاريف التأمين = {Math.round((orderData.returnProductValue || 0) * 0.01)} ج.م (تقريباً 1% من قيمة المنتج)
                        </p>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            const url = prompt("أدخل رابط إثبات التأمين / صورة المنتج:");
                            if (url) handleFieldChange("returnImage", url);
                          }}
                          className={`w-full py-3 ${tClass.bgLight} ${tClass.bgLightDark} ${tClass.textMain} dark:${tClass.textDark} font-bold rounded-2xl border-2 border-dashed ${tClass.borderLight} dark:border-${tClass.baseColor}-800 hover:${tClass.bgLightHover} transition-colors flex items-center justify-center gap-2 cursor-pointer`}
                        >
                          <Plus size={16} />
                          <span>{orderData.returnImage ? "تعديل إثبات التأمين" : "رفع الإثبات (اختياري)"}</span>
                        </button>
                        {orderData.returnImage && (
                          <div className="mt-3 relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                            <img src={orderData.returnImage} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleFieldChange("returnImage", undefined)}
                              className="absolute top-1 left-1 bg-red-500 text-white p-1 rounded-full text-xs animate-in zoom-in-50"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800/40">
                      <span className="text-xs font-black text-slate-500 block text-right">تقدير مستحقات {getCompanyDisplayName(orderData.shippingCompany)}</span>
                      <div className="space-y-1 text-xs text-right">
                        <div className="flex justify-between text-slate-500 font-bold">
                          <span>سعر الشحن الأساسي:</span>
                          <span>{Number(orderData.shippingFee || 0)} ج.م</span>
                        </div>
                        <div className="flex justify-between text-slate-500 font-bold">
                          <span>ضريبة قيمة مضافة 14%:</span>
                          <span>{Math.round(Number(orderData.shippingFee || 0) * 0.14)} ج.م</span>
                        </div>
                        <div className="flex justify-between text-slate-500 font-bold">
                          <span>التأمين (1%):</span>
                          <span>{Math.round((orderData.returnProductValue || 0) * 0.01)} ج.م</span>
                        </div>
                        <div className="flex justify-between font-black text-slate-800 dark:text-white pt-2 border-t border-dashed border-slate-200">
                          <span>المجموع الكلي المقدر:</span>
                          <span>{Number(orderData.shippingFee || 0) + Math.round(Number(orderData.shippingFee || 0) * 0.14) + Math.round((orderData.returnProductValue || 0) * 0.01)} ج.م</span>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/60 cursor-pointer justify-end">
                        <input
                          type="checkbox"
                          checked={orderData.payWithBostaPoints || false}
                          onChange={(e) => handleFieldChange("payWithBostaPoints", e.target.checked)}
                          className="w-4 h-4 accent-${tClass.baseColor}-500 rounded cursor-pointer"
                        />
                        <span className="text-xs font-black text-slate-600 dark:text-slate-700 dark:text-slate-400">دفع الأوردر بنقاط {getCompanyDisplayName(orderData.shippingCompany)}</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Card 2: الموقع والراجع */}
                <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm space-y-6 animate-in fade-in duration-300`}>
                  <h4 className="font-extrabold text-slate-800 dark:text-white mb-2 flex items-center gap-3 text-xl">
                    <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}`}>
                      <MapPin size={24} />
                    </div>
                    الموقع والراجع
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 text-right">
                        اختر الراجع إلى (المستودع)
                      </label>
                      <select
                        value={orderData.warehouseId || ""}
                        onChange={(e) => handleFieldChange("warehouseId", e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-bold cursor-pointer text-sm text-right"
                      >
                        <option value="">المستودع الافتراضي</option>
                        {settings.warehouses?.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 text-right">
                        رقم المرجع (اختياري)
                      </label>
                      <input
                        type="text"
                        placeholder="أدخل مرجع الطلب الخاص بك..."
                        value={orderData.platformOrderId || ""}
                        onChange={(e) => handleFieldChange("platformOrderId", e.target.value)}
                        className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl w-full text-right font-black text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 text-right">
                        ملحوظات عند التوصيل (اختياري)
                      </label>
                      <textarea
                        placeholder="أدخل أي ملاحظات للتوصيل..."
                        value={orderData.notes || ""}
                        onChange={(e) => handleFieldChange("notes", e.target.value)}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl h-24 text-sm font-bold resize-none text-right outline-none"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : isCashCollection ? (
              <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm`}>
                <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                  <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}`}>
                    <Coins size={24} />
                  </div>
                  تفاصيل التحصيل النقدي
                </h4>
                <div className="space-y-6">
                  <p className="text-slate-500 font-bold p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200/60 dark:border-slate-700/60 text-center">
                    هذا الطلب مخصص لتحصيل مبالغ نقدية فقط بدون منتجات.
                  </p>
                </div>
              </div>
            ) : isMaintenance ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Technical Info Card */}
                <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm relative overflow-hidden`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 ${tClass.glow} rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl`}></div>

                  <h4 className="font-extrabold text-slate-800 dark:text-white mb-10 flex items-center gap-4 text-xl justify-between relative">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain} shadow-sm`}>
                        {orderData.shipmentType === "maintenance_pickup" ? (
                          <SettingsIcon size={24} />
                        ) : (
                          <Wand2 size={24} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg">
                          {orderData.shipmentType === "maintenance_pickup"
                            ? "سحب منتج للصيانة"
                            : "توصيل منتج من الصيانة"}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${orderData.shipmentType === "maintenance_pickup" ? "${tClass.bgMain}/10 ${tClass.textMain}" : "bg-emerald-500/10 text-emerald-500"}`}
                    >
                      {orderData.shipmentType === "maintenance_pickup"
                        ? "سحب فني"
                        : "توصيل فني"}
                    </div>
                  </h4>

                  <div className="space-y-10 relative">
                    {/* Group 1: Identify Product */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 ${tClass.bgMain} rounded-full"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          بيانات المنتج الأساسية
                        </span>
                      </div>
                      <div className="space-y-6">
                        <div>
                          <label className="text-xs font-black text-slate-500 mb-3 block mr-1">
                            وصف المنتج (خارج البراند)
                          </label>
                          <input
                            type="text"
                            placeholder="مثال: سماعة ابل ايربودز الجيل الثالث"
                            value={orderData.maintenanceItemDescription || ""}
                            onChange={(e) =>
                              handleFieldChange(
                                "maintenanceItemDescription",
                                e.target.value,
                              )
                            }
                            className={`w-full p-4.5 bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white transition-all focus:ring-4 focus:${tClass.ringGlow} focus:${tClass.border} outline-none`}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="text-xs font-black text-slate-500 mb-3 block mr-1">
                              الرقم التسلسلي / S.N
                            </label>
                            <input
                              type="text"
                              placeholder="S/N: xxxxxxxx"
                              value={orderData.maintenanceItemSerial || ""}
                              onChange={(e) =>
                                handleFieldChange(
                                  "maintenanceItemSerial",
                                  e.target.value,
                                )
                              }
                              className={`w-full p-4.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white text-sm focus:ring-4 focus:${tClass.ringGlow} focus:${tClass.border} outline-none`}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-black text-slate-500 mb-3 block mr-1">
                              تقرير العطل / المشكلة
                            </label>
                            <input
                              type="text"
                              placeholder="وصف المشكلة المذكورة"
                              value={orderData.maintenanceTechnicalReport || ""}
                              onChange={(e) =>
                                handleFieldChange(
                                  "maintenanceTechnicalReport",
                                  e.target.value,
                                )
                              }
                              className={`w-full p-4.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white text-sm focus:ring-4 focus:${tClass.ringGlow} focus:${tClass.border} outline-none`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Group 2: Financial Estimates */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800/20 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 space-y-8">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          التقديرات المالية والتحصيل
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="text-xs font-black text-slate-500 flex items-center gap-2 mr-1">
                            <span>قيمة المنتج (للتأمين)</span>
                            <Info size={14} className={`${tClass.textDark}`} />
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={orderData.maintenanceItemValue || ""}
                              onChange={(e) =>
                                handleFieldChange(
                                  "maintenanceItemValue",
                                  Number(e.target.value),
                                )
                              }
                              className={`w-full p-5 pl-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-2xl text-slate-900 dark:text-white focus:${tClass.border} outline-none transition-all`}
                              placeholder="0"
                            />
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-700 dark:text-slate-400">
                              ج.م
                            </span>
                            <div className={`absolute -top-3 right-4 ${tClass.bgMain} text-white text-[9px] px-3 py-1 font-black rounded-lg shadow-lg`}>
                              تأمين: {insuranceFee} ج.م
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-xs font-black text-slate-500 mr-1">
                            تكلفة الصيانة المقدرة
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={orderData.maintenanceCost || ""}
                              onChange={(e) =>
                                handleFieldChange(
                                  "maintenanceCost",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full p-5 pl-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-2xl ${tClass.textMain} focus:border-emerald-500 outline-none transition-all"
                              placeholder="0"
                            />
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-700 dark:text-slate-400">
                              ج.م
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8 border-t border-slate-200/60 dark:border-slate-700/60/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange(
                              "returnCashToCustomer",
                              !orderData.returnCashToCustomer,
                            );
                            if (!orderData.returnCashToCustomer)
                              handleFieldChange("deferPaymentToReturn", false);
                          }}
                          className={`p-5 rounded-2xl border-2 transition-all text-right flex flex-col gap-1.5 group ${orderData.returnCashToCustomer ? "border-rose-500 bg-rose-50 dark:bg-rose-500/10" : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"}`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider ${orderData.returnCashToCustomer ? "text-rose-600" : "text-slate-400"}`}
                            >
                              التحصيل المالي
                            </span>
                            <div
                              className={`w-2 h-2 rounded-full ${orderData.returnCashToCustomer ? "bg-rose-500 animate-pulse" : "bg-slate-200 dark:bg-slate-700"}`}
                            ></div>
                          </div>
                          <span className="text-sm font-black">
                            إرجاع مبلغ نقدى للعميل
                          </span>
                        </button>

                        {orderData.shipmentType === "maintenance_pickup" && (
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange(
                                "deferPaymentToReturn",
                                !orderData.deferPaymentToReturn,
                              );
                              handleFieldChange(
                                "recordedAsDebt",
                                !orderData.deferPaymentToReturn,
                              );
                              if (!orderData.deferPaymentToReturn)
                                handleFieldChange(
                                  "returnCashToCustomer",
                                  false,
                                );
                            }}
                            className={`p-5 rounded-2xl border-2 transition-all text-right flex flex-col gap-1.5 group ${orderData.deferPaymentToReturn ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"}`}
                          >
                            <div className="flex justify-between items-center w-full">
                              <span
                                className={`text-[10px] font-black uppercase tracking-wider ${orderData.deferPaymentToReturn ? "text-amber-600" : "text-slate-400"}`}
                              >
                                موعد الدفع
                              </span>
                              <div
                                className={`w-2 h-2 rounded-full ${orderData.deferPaymentToReturn ? "bg-amber-500 animate-pulse" : "bg-slate-200 dark:bg-slate-700"}`}
                              ></div>
                            </div>
                            <span className="text-sm font-black">
                              الدفع عند التوصيل لاحقاً
                            </span>
                          </button>
                        )}
                      </div>

                      {orderData.returnCashToCustomer && (
                        <div className="mt-4 p-6 bg-rose-50 dark:bg-rose-500/5 rounded-3xl border border-rose-100 dark:border-rose-900/30 animate-in zoom-in-95 duration-300">
                          <label className="text-[10px] font-black text-rose-500 mb-2 block mr-1 uppercase">
                            المبلغ المرتجع للعميل نقداً
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              placeholder="0"
                              value={orderData.cashToReturnAmount || ""}
                              onChange={(e) =>
                                handleFieldChange(
                                  "cashToReturnAmount",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full p-4.5 pl-14 bg-white dark:bg-slate-900 border-2 border-rose-200 dark:border-rose-900/40 rounded-2xl font-black text-2xl text-rose-500 text-center focus:border-rose-500 outline-none shadow-sm"
                            />
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-rose-200">
                              ج.م
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm`}>
                <div className="flex justify-between items-center mb-8">
                  <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-3 text-xl">
                    <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}`}>
                      <LayoutList size={24} />
                    </div>
                    عناصر الطلب
                  </h4>
                  <button
                    type="button"
                    onClick={addItem}
                    className={`flex items-center gap-2 px-6 py-3 ${tClass.bgLight} ${tClass.bgLightDark} ${tClass.textMain} dark:${tClass.textDark} rounded-2xl font-black hover:${tClass.bgLightHover} ${tClass.bgLightHoverDark} transition-all text-sm group`}
                  >
                    <Plus
                      size={18}
                      className="group-hover:rotate-90 transition-transform"
                    />
                    <span>إضافة منتج</span>
                  </button>
                </div>

                <div className="space-y-6">
                  {(orderData.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 relative group transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-xl hover:shadow-black/5"
                    >
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="absolute top-4 left-4 p-2.5 text-slate-700 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="space-y-5">
                        <ProductSelect
                          value={item.productId || ""}
                          onChange={(val) =>
                            handleItemChange(idx, "productId", val)
                          }
                          products={settings.products}
                          index={idx}
                        />
                        {settings.products.find((p) => p.id === item.productId)
                          ?.hasVariants && (
                          <div>
                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">
                              المقاس / اللون
                            </label>
                            <select
                              value={item.variantId || ""}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "variantId",
                                  e.target.value,
                                )
                              }
                              className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-sm"
                            >
                              <option value="">اختر النوع</option>
                              {settings.products
                                .find((p) => p.id === item.productId)
                                ?.variants?.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {Object.entries(v.options || {})
                                      .map(([k, val]) => `${k}:${val}`)
                                      .join(" - ")}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">
                              الكمية
                            </label>
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemChange(
                                    idx,
                                    "quantity",
                                    Math.max(1, (item.quantity || 1) - 1),
                                  )
                                }
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity || 1}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "quantity",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-full bg-transparent text-center font-black text-lg p-0 border-none outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemChange(
                                    idx,
                                    "quantity",
                                    (item.quantity || 1) + 1,
                                  )
                                }
                                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">
                              السعر
                            </label>
                            <input
                              type="number"
                              value={item.price || 0}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  "price",
                                  Number(e.target.value),
                                )
                              }
                              className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl w-full font-black text-lg ${tClass.textMain} text-center"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                          <span className="text-xs font-bold text-slate-400">إجمالي المنتج:</span>
                          <span className={`text-sm font-black ${tClass.textMain} ${tClass.textDark}`}>
                            {((item.price || 0) * (item.quantity || 1)).toLocaleString()} ج.م
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!orderData.items || orderData.items.length === 0) && (
                    <div className="py-20 text-center bg-slate-50/50 dark:bg-slate-800/50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200/60 dark:border-slate-700/60 rounded-[2.5rem]">
                      <p className="text-slate-400 font-bold">
                        لا توجد منتجات مضافة لهذا الطلب
                      </p>
                      <button
                        type="button"
                        onClick={addItem}
                        className={`mt-4 px-8 py-3 ${tClass.bgMain} text-white rounded-2xl font-black text-sm shadow-lg ${tClass.shadow}`}
                      >
                        أضف المنتج الأول
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] shadow-xl relative overflow-hidden group border ${tClass.borderLight}`}>
              <div className={`absolute top-0 right-0 w-64 h-64 ${tClass.glow} rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-125`}></div>
              <div className={`absolute bottom-0 left-0 w-32 h-32 ${tClass.glow} rounded-full -ml-16 -mb-16 transition-transform duration-1000 group-hover:scale-150`}></div>
              
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl relative">
                <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain} shadow-sm`}>
                  <Banknote size={24} />
                </div>
                ملخص مالي دقيق
              </h4>
              <div className="bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl space-y-2 mb-4">
                <label className="text-slate-500 dark:text-slate-400 text-xs font-bold block text-right">
                  طريقة حساب ضريبة القيمة المضافة:
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-850 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() =>
                      handleFieldChange("vatOnStandardShipping", true)
                    }
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                      orderData.vatOnStandardShipping === true
                        ? "bg-white ${tClass.textUltraDark} shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    الشحن القياسي بالمدن
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleFieldChange("vatOnStandardShipping", false)
                    }
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                      orderData.vatOnStandardShipping !== true
                        ? "bg-white ${tClass.textUltraDark} shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    الشحن المدخل بالطلب
                  </button>
                </div>
              </div>

              {/* Manual Insurance Value Input */}
              <div className="space-y-4 mb-6">
                <label className="text-xs font-black text-slate-500 flex items-center gap-2 justify-end">
                  <span className="text-[10px] text-slate-400 font-bold">(لتحديد مبلغ التأمين يدوياً)</span>
                  <span>قيمة المنتج (للتأمين)</span>
                  <Info size={14} className={`${tClass.textDark}`} />
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={orderData.maintenanceItemValue || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "maintenanceItemValue",
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                    className={`w-full p-4.5 pl-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xl text-slate-900 dark:text-white focus:${tClass.border} outline-none transition-all text-right`}
                    placeholder={(subtotal - itemDiscounts).toString()}
                  />
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400">
                    ج.م
                  </span>
                  <div className={`absolute -top-3 right-4 ${tClass.bgMain} text-white text-[9px] px-3 py-1 font-black rounded-lg shadow-lg`}>
                    تأمين: {insuranceFee} ج.م
                  </div>
                </div>
              </div>

              {/* Accordion: Dues Estimation for Standard Delivery */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/50 mb-6">
                <button
                  type="button"
                  onClick={() => setIsDuesExpanded(!isDuesExpanded)}
                  className="w-full p-4 flex justify-between items-center font-extrabold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isDuesExpanded ? <ChevronDown size={16} /> : <ChevronDown size={16} className="rotate-180" />}
                    <span className={`${tClass.textMain} ${tClass.textDark} font-black`}>
                      {((orderData.vatOnStandardShipping === true ? getStandardShippingFee(orderData as Order, settings) : (Number(orderData.shippingFee) || 0)) + activeVatAmount + insuranceFee + (orderData.includeInspectionFee ? inspectionFee : 0)).toFixed(2)} ج.م
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5">
                    <Calculator size={18} className={`${tClass.textMain}`} />
                    <span>تقدير مستحقات {getCompanyDisplayName(orderData.shippingCompany)}</span>
                  </span>
                </button>

                {isDuesExpanded && (
                  <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-3.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-900 dark:text-white font-black">{orderData.vatOnStandardShipping === true ? getStandardShippingFee(orderData as Order, settings) : (Number(orderData.shippingFee) || 0)} ج.م</span>
                      <span className="text-slate-500">سعر الشحن</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-900 dark:text-white font-black">{activeVatAmount} ج.م</span>
                      <span className="text-slate-500">ضريبة قيمة مضافة 14%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-900 dark:text-white font-black">{insuranceFee} ج.م</span>
                      <span className="text-slate-500">التأمين</span>
                    </div>
                    {orderData.includeInspectionFee && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-900 dark:text-white font-black">{inspectionFee} ج.م</span>
                        <span className="text-slate-500">رسوم معاينة</span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-dashed border-slate-100 dark:border-slate-800 flex justify-between items-center font-black text-slate-800 dark:text-white">
                      <span className={`${tClass.textMain} ${tClass.textDark} font-extrabold text-sm`}>
                        {((orderData.vatOnStandardShipping === true ? getStandardShippingFee(orderData as Order, settings) : (Number(orderData.shippingFee) || 0)) + activeVatAmount + insuranceFee + (orderData.includeInspectionFee ? inspectionFee : 0)).toFixed(2)} ج.م
                      </span>
                      <span>المجموع الكلي المقدر</span>
                    </div>

                    {/* Pay with Points */}
                    <div className="pt-3 border-t border-dashed border-slate-100 dark:border-slate-800 flex justify-end items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-400">
                        دفع الأوردر بنقاط {getCompanyDisplayName(orderData.shippingCompany)}
                      </span>
                      <input
                        type="checkbox"
                        checked={orderData.payWithBostaPoints || false}
                        onChange={(e) => handleFieldChange("payWithBostaPoints", e.target.checked)}
                        className={`w-4 h-4 rounded border-slate-300 dark:border-slate-700 ${tClass.textMain} focus:ring-${tClass.baseColor}-500 dark:bg-slate-800 cursor-pointer`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 text-xs font-bold block">
                      الشحن
                    </label>
                    <input
                      type="number"
                      value={orderData.shippingFee || 0}
                      onChange={(e) =>
                        handleFieldChange("shippingFee", Number(e.target.value))
                      }
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-black text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 dark:text-slate-400 text-xs font-bold block">
                      الخصم الإضافي
                    </label>
                    <input
                      type="number"
                      value={orderData.discount || 0}
                      onChange={(e) =>
                        handleFieldChange("discount", Number(e.target.value))
                      }
                      className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-black text-sm"
                    />
                  </div>
                </div>

                {[
                  {
                    label: isMaintenance ? "سعر الصيانة" : "سعر المنتجات",
                    value: isMaintenance
                      ? orderData.maintenanceCost || 0
                      : subtotal,
                  },
                  { label: "الشحن (على العميل)", value: orderData.shippingFee || 0 },
                  { label: "خصم إضافي", value: -(orderData.discount || 0) },
                  ...(creditAmount > 0 ? [{ label: "رصيد دائن (بدل استبدال)", value: -creditAmount }] : []),
                  { label: "رسوم معاينة", value: inspectionFee },
                  { label: "تأمين الشحن (يخصم من ربحك)", value: -insuranceFee, isDeduction: true },
                  { label: "ضريبة الشحن (تخصم من ربحك)", value: -activeVatAmount, isDeduction: true },
                  ...(orderData.returnCashToCustomer
                    ? [
                        {
                          label: "مبلغ مرتجع للعميل",
                          value: -(orderData.cashToReturnAmount || 0),
                        },
                      ]
                    : []),
                ].map((row: any, idx) => (
                  <div
                    key={idx}
                    className={`flex justify-between font-bold text-sm ${row.isDeduction ? "text-amber-600 dark:text-amber-400/80 italic" : "text-slate-700 dark:text-slate-400"}`}
                  >
                    <span>{row.label}</span>
                    <span className={`font-black ${row.isDeduction ? "text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-white"}`}>
                      {row.value.toLocaleString()} ج.م
                    </span>
                  </div>
                ))}

                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                  {isExchange && (
                    <div className="mb-4 space-y-2">
                       <label className="text-slate-500 dark:text-slate-400 text-xs font-black mb-1 block">قيمة الاستبدال (رصيد العميل)</label>
                       <div className="relative">
                         <input 
                           type="number"
                           value={orderData.creditAmount || ""}
                           onChange={(e) => handleFieldChange("creditAmount", e.target.value === "" ? 0 : Number(e.target.value))}
                           className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-white font-black text-lg outline-none focus:ring-2 focus:ring-amber-400/50 transition-all"
                           placeholder="0"
                         />
                         <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">ج.م</div>
                       </div>
                       <p className="text-[10px] text-slate-400 font-bold leading-tight">
                         هذا المبلغ سيتم خصمه من إجمالي الفاتورة الجديدة. تلقائياً تم حساب قيمة منتجات الأوردر القديم فقط (بدون الشحن).
                       </p>
                    </div>
                  )}
                  {!orderData.totalAmountOverride && (
                    <button
                      type="button"
                      onClick={() =>
                        handleFieldChange("totalAmountOverride", finalAmount)
                      }
                      className="text-xs text-amber-600 dark:text-amber-400 font-bold underline"
                    >
                      تعديل الإجمالي يدوياً
                    </button>
                  )}
                  {orderData.totalAmountOverride !== undefined && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-2 block">
                          تعديل الإجمالي يدوياً (للرقابة)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange("totalAmountOverride", undefined);
                            handleFieldChange(
                              "totalAmountOverrideReason",
                              undefined,
                            );
                          }}
                          className="text-xs text-red-600 dark:text-red-400 font-bold underline"
                        >
                          إلغاء التعديل
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={orderData.totalAmountOverride ?? ""}
                          placeholder={`الإجمالي: ${finalAmount.toLocaleString()}`}
                          onChange={(e) =>
                            handleFieldChange(
                              "totalAmountOverride",
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-white font-black text-sm"
                        />
                        <input
                          type="text"
                          value={orderData.totalAmountOverrideReason || ""}
                          placeholder="سبب التعديل"
                          onChange={(e) =>
                            handleFieldChange(
                              "totalAmountOverrideReason",
                              e.target.value,
                            )
                          }
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-white font-bold text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-2 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-black text-xs uppercase tracking-widest">
                      {finalAmount < 0 ? "المبلغ المسترد (للعميل)" : "مبلغ التحصيل (المطلوب من العميل)"}
                    </span>
                    <div className="text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
                      {orderData.totalAmountOverride !== undefined &&
                      orderData.totalAmountOverride !== null &&
                      (orderData.totalAmountOverride as any) !== ""
                        ? Math.max(
                            0,
                            Math.round(Number(orderData.totalAmountOverride)),
                          ).toLocaleString()
                        : Math.abs(finalAmount).toLocaleString()}
                      <span className="text-sm font-bold text-slate-400">
                        ج.م
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Advance Payment Card */}
            <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm overflow-hidden relative group`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-xl">
                <div className={`w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}`}>
                  <Coins size={24} />
                </div>
                دفع عربون مسبق (دفعة مقدمة)
              </h4>

              <div className="flex flex-col gap-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                      مبلغ العربون
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={orderData.advancePayment !== undefined && orderData.advancePayment !== 0 ? orderData.advancePayment : ""}
                        onChange={(e) =>
                          handleFieldChange(
                            "advancePayment",
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                        className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200/60 dark:border-slate-700/60 rounded-2xl font-black text-amber-600 dark:text-amber-500 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-xl pr-12"
                      />
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                        <Banknote size={20} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">
                      وسيلة استلام العربون
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange(
                            "advancePaymentPartnerId",
                            settings.partners?.[0]?.id || "",
                          );
                          handleFieldChange("advancePaymentTreasuryId", "");
                          handleFieldChange("advancePaymentEmployeeId", "");
                        }}
                        className={`py-3.5 px-4 rounded-2xl font-black text-xs transition-all border-2 flex flex-col items-center justify-center gap-2 cursor-pointer ${orderData.advancePaymentPartnerId ? "bg-amber-100 dark:bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 shadow-sm" : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500"}`}
                      >
                        <Users size={18} />
                        <span>شريك / مودع</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange(
                            "advancePaymentTreasuryId",
                            treasury?.accounts?.[0]?.id || "1",
                          );
                          handleFieldChange("advancePaymentPartnerId", "");
                          handleFieldChange("advancePaymentEmployeeId", "");
                        }}
                        className={`py-3.5 px-4 rounded-2xl font-black text-xs transition-all border-2 flex flex-col items-center justify-center gap-2 cursor-pointer ${orderData.advancePaymentTreasuryId ? "${tClass.bgLightHover} dark:${tClass.bgMain}/15 ${tClass.border} ${tClass.textStrong} dark:${tClass.textDark} shadow-sm" : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500"}`}
                      >
                        <Wallet size={18} />
                        <span>خزينة / محفظة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange(
                            "advancePaymentEmployeeId",
                            "admin",
                          );
                          handleFieldChange("advancePaymentPartnerId", "");
                          handleFieldChange("advancePaymentTreasuryId", "");
                        }}
                        className={`py-3.5 px-4 rounded-2xl font-black text-xs transition-all border-2 flex flex-col items-center justify-center gap-2 cursor-pointer ${orderData.advancePaymentEmployeeId ? "bg-emerald-100 dark:bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm" : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500"}`}
                      >
                        <Shield size={18} />
                        <span>عهدة شخصية</span>
                      </button>
                    </div>
                  </div>
                </div>

                {orderData.advancePaymentEmployeeId && (
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-500/5 rounded-3xl border border-emerald-100 dark:border-emerald-500/20 space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-2 block">
                        اختر الشخص المسؤول عن العهدة
                      </label>
                      <select
                        value={orderData.advancePaymentEmployeeId}
                        onChange={(e) =>
                          handleFieldChange(
                            "advancePaymentEmployeeId",
                            e.target.value,
                          )
                        }
                        className="w-full p-3.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/30 rounded-xl font-bold outline-none text-emerald-900 dark:text-emerald-100 appearance-none text-right"
                      >
                        <option value="admin">
                          المدير (أنت) (الرصيد:{" "}
                          {Number(
                            (settings.cashHolders || []).find(
                              (h) => h.userId === "admin",
                            )?.currentBalance || 0,
                          ).toLocaleString()}{" "}
                          ج.م)
                        </option>
                        {settings.partners?.map((p) => {
                          const bal = Number(
                            (settings.cashHolders || []).find(
                              (h) => h.userId === p.id,
                            )?.currentBalance || 0,
                          );
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} (الشريك) (الرصيد: {bal.toLocaleString()}{" "}
                              ج.م)
                            </option>
                          );
                        })}
                        {settings.employees?.map((emp) => {
                          const bal = Number(
                            (settings.cashHolders || []).find(
                              (h) => h.userId === emp.id,
                            )?.currentBalance || 0,
                          );
                          return (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} (الموظف) (الرصيد:{" "}
                              {bal.toLocaleString()} ج.م)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}

                {orderData.advancePaymentPartnerId && (
                  <div className="p-6 bg-amber-50 dark:bg-amber-500/5 rounded-3xl border border-amber-100 dark:border-amber-500/20 space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 block">
                        اختر الشريك
                      </label>
                      <select
                        value={orderData.advancePaymentPartnerId}
                        onChange={(e) =>
                          handleFieldChange(
                            "advancePaymentPartnerId",
                            e.target.value,
                          )
                        }
                        className="w-full p-3.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-xl font-bold outline-none text-amber-900 dark:text-amber-100 appearance-none"
                      >
                        {settings.partners?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (الرصيد: {p.balance?.toLocaleString()} ج.م)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {orderData.advancePaymentTreasuryId && (
                  <div className={`p-6 ${tClass.bgLight} dark:${tClass.glow} rounded-3xl border ${tClass.borderLight} dark:${tClass.border}/20 space-y-4`}>
                    <div>
                      <label className="text-[10px] font-black ${tClass.textStrong} dark:${tClass.textDark} uppercase tracking-widest mb-2 block">
                        الحساب المستلم
                      </label>
                      <select
                        value={orderData.advancePaymentTreasuryId}
                        onChange={(e) =>
                          handleFieldChange(
                            "advancePaymentTreasuryId",
                            e.target.value,
                          )
                        }
                        className={`w-full p-3.5 bg-white dark:bg-slate-800 border ${tClass.borderLight} dark:${tClass.border}/30 rounded-xl font-bold outline-none ${tClass.textUltraDark} dark:${tClass.textUltraLight} appearance-none`}
                      >
                        {treasury?.accounts?.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.balance?.toLocaleString()} ج.م)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black ${tClass.textStrong} dark:${tClass.textDark} uppercase tracking-widest mb-2 block">
                          رقم المرسل
                        </label>
                        <input
                          type="tel"
                          placeholder="رقم المحفظة المرسلة"
                          value={orderData.advancePaymentRecipientPhone || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              "advancePaymentRecipientPhone",
                              e.target.value,
                            )
                          }
                          className={`w-full p-3.5 bg-white dark:bg-slate-800 border ${tClass.borderLight} dark:${tClass.border}/30 rounded-xl font-bold outline-none`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black ${tClass.textStrong} dark:${tClass.textDark} uppercase tracking-widest mb-2 block">
                          تفاصيل العملية
                        </label>
                        <input
                          type="text"
                          placeholder="ID العملية أو ملاحظة"
                          value={orderData.advancePaymentSenderDetails || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              "advancePaymentSenderDetails",
                              e.target.value,
                            )
                          }
                          className={`w-full p-3.5 bg-white dark:bg-slate-800 border ${tClass.borderLight} dark:${tClass.border}/30 rounded-xl font-bold outline-none`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {orderData.advancePaymentHistory && orderData.advancePaymentHistory.length > 0 && (
              <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm mt-8`}>
                <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-lg">
                  <Clock size={20} className="text-slate-400" />
                  سجل مدفوعات العربون
                </h4>
                <div className="space-y-4">
                  {orderData.advancePaymentHistory.map((log) => (
                    <div key={log.id} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            log.action === 'created' ? 'bg-emerald-100 ${tClass.textMain} dark:bg-emerald-500/10 dark:text-emerald-400' :
                            log.action === 'deleted' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' :
                            'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                          }`}>
                            {log.action === 'created' ? 'استلام' : log.action === 'deleted' ? 'حذف' : 'تعديل'}
                          </span>
                          <span className="text-sm font-black text-slate-800 dark:text-white">{log.amount.toLocaleString()} ج.م</span>
                          {log.recipientType && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-0.5 rounded-md">
                              {log.recipientType === 'partner' ? 'شريك' : log.recipientType === 'treasury' ? 'خزينة' : 'عهدة'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-bold leading-relaxed">{log.reason || 'تعديل في بيانات العربون المسبق'}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                          <span>بواسطة: {log.userName}</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <span>{new Date(log.timestamp).toLocaleString('ar-EG')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Options Card */}
            <div className={`p-8 ${tClass.cardBg} rounded-[2.5rem] border ${tClass.borderLight} shadow-sm`}>
              <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                <div className="w-12 h-12 ${tClass.bgLight} ${tClass.bgLightDark} rounded-2xl flex items-center justify-center ${tClass.textMain}">
                  <SettingsIcon size={24} />
                </div>
                خيارات الطلب الإضافية
              </h4>
              <div
                className={`grid grid-cols-1 sm:grid-cols-${isDelivery ? (isFlexShipConfigured && orderData.includeInspectionFee ? "3" : "2") : "1"} gap-5`}
              >
                {isDelivery && (
                  <button
                    type="button"
                    onClick={() =>
                      handleFieldChange(
                        "includeInspectionFee",
                        !orderData.includeInspectionFee,
                      )
                    }
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-start gap-3 relative overflow-hidden group ${orderData.includeInspectionFee ? "${tClass.bgLight} ${tClass.bgLightDark} ${tClass.border} ${tClass.textStrong} dark:${tClass.textDark} shadow-lg" : "bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${orderData.includeInspectionFee ? `${tClass.bgMain} text-white` : "bg-slate-200 dark:bg-slate-700 text-slate-400"}`}
                    >
                      <Wand2 size={20} />
                    </div>
                    <div className="text-right">
                      <p className="font-black text-base">دفع مصاريف المعاينة</p>
                      <p className="text-xs font-bold opacity-70 mt-1">
                        يتحمل العميل التكاليف في حال الرفض
                      </p>
                    </div>
                    {orderData.includeInspectionFee && (
                      <CheckCircle className="absolute top-4 left-4" size={24} />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    handleFieldChange(
                      "isInsured",
                      orderData.isInsured === false ? true : false,
                    )
                  }
                  className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-start gap-3 relative overflow-hidden group ${orderData.isInsured !== false ? "${tClass.bgLight} ${tClass.bgLightDark} border-sky-500 text-sky-700 dark:text-sky-400 shadow-lg" : "bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500"}`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${orderData.isInsured !== false ? "bg-sky-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-400"}`}
                  >
                    <Shield size={20} />
                  </div>
                  <div className="text-right">
                    <p className="font-black text-base">تأمين الشحن</p>
                    <p className="text-xs font-bold opacity-70 mt-1">
                      حماية ضد الضياع أو التلف لخدمات الشحن
                    </p>
                  </div>
                  {orderData.isInsured !== false && (
                    <CheckCircle className="absolute top-4 left-4" size={24} />
                  )}
                </button>

                {isFlexShipConfigured && isDelivery && orderData.includeInspectionFee && (
                  <button
                    type="button"
                    onClick={() =>
                      handleFieldChange("enableFlexShip", !orderFlexShipActive)
                    }
                    className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-start gap-3 relative overflow-hidden group ${orderFlexShipActive ? "bg-violet-50 dark:bg-violet-500/10 border-violet-500 text-violet-700 dark:text-violet-400 shadow-lg" : "bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${orderFlexShipActive ? "bg-violet-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-400"}`}
                    >
                      <Truck size={20} />
                    </div>
                    <div className="text-right">
                      <p className="font-black text-base">خدمة فليكس شيب</p>
                      <p className="text-xs font-bold opacity-70 mt-1">
                        تحصيل رسوم من المستلم في حال الرفض
                      </p>
                    </div>
                    {orderFlexShipActive && (
                      <CheckCircle
                        className="absolute top-4 left-4"
                        size={24}
                      />
                    )}
                  </button>
                )}
              </div>

              {/* Custom Flex Ship Amounts inside Order */}
              {isFlexShipConfigured &&
                orderData.includeInspectionFee &&
                orderFlexShipActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 p-6 bg-violet-50/50 dark:bg-violet-950/10 rounded-[2rem] border border-violet-100 dark:border-violet-900/30 grid grid-cols-1 gap-4 text-right"
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-black text-violet-800 dark:text-violet-400 block mb-1">
                        تحديد رسوم فليكس شيب للعميل (ج.م)
                      </label>
                      <input
                        type="number"
                        value={activeFlexShipFee}
                        onChange={(e) =>
                          handleFieldChange(
                            "flexShipFee",
                            Number(e.target.value),
                          )
                        }
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800 rounded-2xl font-black text-slate-850 dark:text-white focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none transition-all text-right"
                        placeholder="مثلاً 50"
                      />
                    </div>
                  </motion.div>
                )}
            </div>
          </div>
        </div>
      </motion.form>

      {/* Sticky Mobile/Tablet Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-[100] flex items-center justify-between gap-4 animate-in slide-in-from-bottom-full duration-500">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{finalAmount < 0 ? "المبلغ المرتجع" : "مبلغ التحصيل"}</span>
          <span className={`text-xl font-black ${tClass.textMain} ${tClass.textDark}`}>
            {Math.abs(finalAmount).toLocaleString()} ج.م
          </span>
        </div>
        <button
          type="button"
          onClick={() => (document.querySelector('form') as HTMLFormElement)?.requestSubmit()}
          className={`flex-1 py-4 ${tClass.bgMain} text-white font-black rounded-2xl ${tClass.bgHover} transition-all shadow-xl ${tClass.shadow} flex items-center justify-center gap-2 text-sm active:scale-95`}
        >
          <CheckCircle size={18} />
          <span>إتمام الطلب</span>
        </button>
      </div>
    </div>
  );
};
