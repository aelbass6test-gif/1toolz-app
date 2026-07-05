
// ... (previous imports and declartions)

// FIX: Declaring the 'google' object in the global scope to make it accessible across all files.
declare global {
  const google: {
    script: {
      run: {
        withSuccessHandler(handler: (response: any) => void): any;
        withFailureHandler(handler: (error: Error) => void): any;
        serverApiCall(storeId: string, action: string, payload: any | null): void;
      };
    };
  };
}

export type OrderStatus = 'في_انتظار_المكالمة' | 'جاري_المراجعة' | 'قيد_التنفيذ' | 'تم_الارسال' | 'قيد_الشحن' | 'تم_توصيلها' | 'تم_التوصيل' | 'تم_التحصيل' | 'مرتجع' | 'مرتجع_جزئي' | 'فشل_التوصيل' | 'ملغي' | 'مؤرشف' | 'مرتجع_بعد_الاستلام' | 'تم_الاستبدال' | 'تمت_الاعادة_لشركة_الشحن' | 'مدفوعة' | 'مؤجل' | 'مجدول';
export type PaymentStatus = 'بانتظار الدفع' | 'مدفوع' | 'مدفوع جزئياً' | 'مرتجع';
export type PreparationStatus = 'بانتظار التجهيز' | 'جاهز';

export interface CityOption {
  id: string;
  name: string;
  deliveryPrice: number;
  extraKgPrice: number;
  returnPrice: number;
  exchangePrice: number;
  maintenancePickupPrice?: number;
  maintenanceReturnPrice?: number;
  cashCollectionPrice: number;
  returnToSenderPrice: number;
  useParentFees?: boolean; 
  active?: boolean; 
}

export interface ShippingOption {
  id: string;
  label: string;      
  details: string;    
  deliveryPrice: number;      
  extraKgPrice: number; 
  returnPrice: number;   
  exchangePrice: number;      
  maintenancePickupPrice?: number;
  maintenanceReturnPrice?: number;
  cashCollectionPrice: number;
  returnToSenderPrice: number;
  baseWeight: number;
  cities?: CityOption[];
  active?: boolean; 
}

export interface PlatformIntegration {
  platform: 'none' | 'wuilt';
  apiKey: string;
  shopId?: string;
  shopUrl?: string;
}

export interface ShippingCarrierIntegration {
  id: string;
  provider: 'bosta' | 'mylerz' | 'aramex_api' | 'turbo';
  apiKey: string;
  apiSecret?: string;
  accountNumber?: string;
  isConnected: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  isDefault?: boolean;
  type?: 'central' | 'pos' | 'backup' | 'logistics'; // نوع الفرع/المستودع
  managerName?: string; // مسؤول أو مدير الفرع
  phone?: string; // رقم هاتف الفرع
  capacity?: number; // السعة التخزينية القصوى
  notes?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  costPrice?: number;
  weight?: number;
  stock?: number;
  stockQuantity: number | null;
  warehouseStock?: Record<string, number>; // New field for multi-warehouse stock
  lastAudited?: Record<string, string>; // New field for audit tracking per warehouse
  minStockLevel?: number; // Minimum stock before alert
  expiryDate?: string; // Product expiry date
  options: { [optionName: string]: string };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  weight: number;
  costPrice: number;
  thumbnail?: string;
  images?: string[];
  inStock?: boolean;
  stock?: number;
  stockQuantity: number | null;
  warehouseStock?: Record<string, number>; // New field for multi-warehouse stock
  collectionId?: string; 
  hasVariants: boolean;
  options: string[];
  variants: ProductVariant[];
  lastAudited?: Record<string, string>; // New field for audit tracking per warehouse
  minStockLevel?: number; // Minimum stock before alert
  expiryDate?: string; // Product expiry date
  
  // For profit calculation
  useProfitPercentage?: boolean; // Legacy, will be phased out
  profitPercentage?: number;     // For margin mode

  profitMode?: 'manual' | 'margin' | 'commission';
  basePrice?: number;
  commissionPercentage?: number;
  stockThreshold?: number;
}

export type TransactionCategory = 'shipping' | 'insurance' | 'inspection' | 'collection' | 'cod' | 'return' | 'manual_deposit' | 'manual_withdrawal' | 'expense_ads' | 'expense_salary' | 'expense_rent' | 'expense_packaging' | 'expense_shipping_fees' | 'expense_other' | 'inventory_purchase' | 'capital_addition' | 'profit_withdrawal' | 'loan' | 'repayment' | 'wallet_charge' | 'wallet_withdrawal' | 'withdrawal_fee' | 'partner_supply' | 'supplier_payment' | 'supply_purchase' | 'supply_deposit' | 'supply_funding' | 'supply_expense_shipping' | 'supply_expense_other' | 'pos_digital' | 'pos_cash' | 'vat';

export type WithdrawStatus = 'pending' | 'accepted' | 'rejected' | 'processing';

export interface WithdrawRequest {
  id: string;
  amount: number;
  date: string;
  status: WithdrawStatus;
  method: 'bank' | 'wallet' | 'instapay' | 'treasury';
  details: string; // JSON or formatted string of bank/wallet details
  fee: number;
  netAmount: number;
  isSameDay?: boolean;
}

export interface BankAccount {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban?: string;
}

export interface WalletSettings {
  preferredWithdrawMethod: 'bank' | 'wallet' | 'instapay' | 'treasury';
  bankAccount?: BankAccount;
  mobileWallet?: string;
  instapayAddress?: string;
  autoWithdrawal: boolean;
  autoWithdrawalDays: ('Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[];
  minAutoWithdrawAmount: number;
}

export interface Transaction {
  id: string;
  type: 'إيداع' | 'سحب';
  amount: number;
  date: string;
  note: string;
  category?: TransactionCategory;
  status: 'pending' | 'completed' | 'cancelled';
  fees?: number;
  orderId?: string;
  orderNumber?: string;
  service?: string;
  details?: any; // Keep details for generic extra data
}

export interface Wallet {
  id?: string;
  data?: any;
  balance: number;
  supplyBalance?: number; // Added supplyBalance for inventory funding
  transactions: Transaction[];
  withdrawRequests?: WithdrawRequest[];
  settings?: WalletSettings;
}

export interface CompanyFees {
  insuranceFeePercent: number;
  inspectionFee: number;
  returnShippingFee: number;
  useCustomFees: boolean;
  defaultInspectionActive: boolean; 
  enableReturnAfter: boolean;    
  enableReturnWithout: boolean;  
  enableExchange: boolean;       
  enableMaintenancePickup?: boolean;
  enableMaintenanceReturn?: boolean;
  enableReturn?: boolean;
  enablePartialDelivery?: boolean;
  enableCashCollection?: boolean;
  enableReturnToSender?: boolean;
  enableFixedReturn: boolean;    
  baseWeight?: number;
  enableCodFees: boolean;
  codThreshold: number;
  codFeeRate: number;
  codTaxRate: number;
  postCollectionReturnRefundsProductPrice: boolean;
  insuranceBasis?: 'cost' | 'price' | 'total' | 'base';
  shippingVatRate?: number;
  vatBasis?: 'shipping_only' | 'shipping_and_insurance'; // New field
  enableVat?: boolean; // Toggle to completely turn off/on VAT for this company
  enableFlexShip?: boolean;
  flexShipFee?: number;
  flexShipCompanyFee?: number;
}

export const PERMISSIONS = {
  // 1. Dashboard & Reports
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  REPORTS_VIEW: 'REPORTS_VIEW',
  
  // 2. Orders & Returns
  ORDERS_VIEW: 'ORDERS_VIEW',
  ORDERS_MANAGE: 'ORDERS_MANAGE',
  RETURNS_MANAGE: 'RETURNS_MANAGE',
  
  // 3. POS
  POS_VIEW: 'POS_VIEW',
  POS_MANAGE: 'POS_MANAGE',
  
  // 4. Products & Inventory
  PRODUCTS_VIEW: 'PRODUCTS_VIEW',
  PRODUCTS_MANAGE: 'PRODUCTS_MANAGE',
  INVENTORY_MANAGE: 'INVENTORY_MANAGE',
  COLLECTIONS_MANAGE: 'COLLECTIONS_MANAGE',
  
  // 5. Customers & Marketing
  CUSTOMERS_VIEW: 'CUSTOMERS_VIEW',
  CUSTOMERS_MANAGE: 'CUSTOMERS_MANAGE',
  MARKETING_MANAGE: 'MARKETING_MANAGE',
  DISCOUNTS_MANAGE: 'DISCOUNTS_MANAGE',
  REVIEWS_MANAGE: 'REVIEWS_MANAGE',

  // 6. Finances & Treasury
  WALLET_VIEW: 'WALLET_VIEW',
  WALLET_MANAGE: 'WALLET_MANAGE',
  CASH_MANAGE: 'CASH_MANAGE',
  EXPENSES_MANAGE: 'EXPENSES_MANAGE',
  
  // 7. Store Settings & Team
  SETTINGS_VIEW: 'SETTINGS_VIEW',
  SETTINGS_MANAGE: 'SETTINGS_MANAGE',
  APPS_MANAGE: 'APPS_MANAGE',
  STOREFRONT_MANAGE: 'STOREFRONT_MANAGE',
  TEAM_VIEW: 'TEAM_VIEW',
  TEAM_MANAGE: 'TEAM_MANAGE'
} as const;

export type Permission = keyof typeof PERMISSIONS;

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  permissions: Permission[];
  status?: 'active' | 'invited' | 'pending';
}

export interface StoreSection {
  id: string;
  type: 'hero' | 'products' | 'about_us';
  enabled: boolean;
}

export interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  buttonText?: string;
  link?: string;
}

export interface StoreCustomization {
  logoUrl: string;
  faviconUrl: string;
  logoSize: 'sm' | 'md' | 'lg';
  banners: Banner[];
  footerText: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: 'Cairo' | 'Readex Pro' | 'Tajawal';
  headingFontWeight: 'font-bold' | 'font-black';
  bodyFontSize: 'text-sm' | 'text-base' | 'text-lg';
  announcementBarText: string;
  isAnnouncementBarVisible: boolean;
  socialLinks: {
    facebook: string;
    instagram: string;
    x: string;
    tiktok: string;
  };
  pageSections: StoreSection[];
  buttonBorderRadius: 'rounded-none' | 'rounded-md' | 'rounded-lg' | 'rounded-full';
  cardStyle: 'default' | 'elevated' | 'outlined';
  productColumnsDesktop: 2 | 3 | 4 | 5;
  headerStyle?: 'floating' | 'classic' | 'minimal' | 'luxury';
  footerStyle?: 'simple' | 'multi-column' | 'glass';
  tabStyle?: 'pills' | 'underline' | 'sidebar' | 'bento';
  cardHoverEffect?: 'scale' | 'glow' | 'shadow' | 'none';
  cardInfoAlignment?: 'right' | 'center' | 'left';
  cardShadowSize?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  // --- New SaaS style fields for high-fidelity controls ---
  navigationLinks?: { label: string; url: string }[];
  aboutUs?: {
    enabled: boolean;
    title: string;
    subtitle: string;
    content: string;
    imageUrl?: string;
  };
  contactInfo?: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    workHours: string;
  };
  checkoutFieldsOptions?: {
    fullName: { show: boolean; required: boolean };
    phone: { show: boolean; required: boolean };
    address: { show: boolean; required: boolean };
    email: { show: boolean; required: boolean };
    notes: { show: boolean; required: boolean };
  };
  successScreen?: {
    title: string;
    description: string;
    buttonText: string;
  };
  emailNotifications?: {
    customerEnabled: boolean;
    adminEnabled: boolean;
    templateType: 'minimal' | 'dark' | 'luxury';
  };
  socialLinksExtended?: {
    facebook: string;
    instagram: string;
    x: string;
    tiktok: string;
    youtube: string;
    snapchat: string;
    pinterest: string;
  };
}

export interface DiscountCode {
  id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  active: boolean;
  usageCount: number;
}

export interface AbandonedCart {
  id: string;
  customerName: string;
  customerPhone: string;
  date: string;
  items: OrderItem[];
  totalValue: number;
}

export interface CustomerProfile {
  id: string; 
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  successfulOrders: number;
  returnedOrders: number;
  totalSpent: number; 
  lastOrderDate: string;
  firstOrderDate: string;
  averageOrderValue: number;
  loyaltyPoints: number;
  notes?: string;
  governorate?: string;
  city?: string;
  shippingFee?: number;
  debtBalance?: number;
  debtHistory?: Array<{
    amount: number;
    type: 'increase' | 'decrease';
    reason: string;
    date: string;
    orderId?: string;
  }>;
  tags?: string[];
  email?: string;
  customerSegment?: string;
}

export interface Review {
  id: string;
  productId: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Partner {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  balance: number;
  profitRatio: number; // Added profit ratio
}

export interface PartnerTransaction {
  id: string;
  partnerId: string;
  type: 'loan' | 'capital_addition' | 'profit_withdrawal' | 'repayment' | 'supply_funding' | 'profit_distribution' | 'shipping_funding' | 'customer_advance' | 'expense_coverage' | 'expense_repayment' | 'pos_collection' | 'internal_transfer_out' | 'internal_transfer_in';
  amount: number;
  date: string;
  note?: string;
  treasuryAccountId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  balance?: number; // Zero or Positive means debt to them
  category?: 'raw_materials' | 'ready_products' | 'logistics' | 'general'; // تصنيف المورد
  creditLimit?: number; // الحد الائتماني
  taxNumber?: string; // الرقم الضريبي
  bankAccount?: string; // الآيبان أو الحساب البنكي
  rating?: 1 | 2 | 3 | 4 | 5; // تقييم المورد
  tier?: 'vip' | 'gold' | 'standard'; // مستوى الشراكة
}

export interface SupplyOrderItem {
  productId: string;
  variantId?: string;
  name?: string;
  quantity: number;
  bonusQuantity?: number;
  cost: number;
  discountValue?: number;
  discountType?: 'amount' | 'percentage';
  profitMode?: 'manual' | 'margin' | 'commission';
  profitPercentage?: number;
  basePrice?: number;
  commissionPercentage?: number;
  sellingPrice?: number;
  updateCatalogPrice?: boolean;
  orderedQuantity?: number;
  receivedQuantity?: number;
  damagedQuantity?: number;
  expiryDate?: string;
  batchNumber?: string;
  landedCost?: number;
  returnedQuantity?: number;
  sku?: string;
  isReturn?: boolean;
  warehouseId?: string;
}

export interface PartnerPayment {
  partnerId: string;
  amount: number;
}

export interface TreasuryPayment {
  treasuryAccountId: string;
  amount: number;
}

export interface SupplyOrder {
  id: string;
  supplierId: string;
  date: string;
  orderNumber?: string;
  referenceNumber?: string;
  items: SupplyOrderItem[];
  totalCost: number;
  status: 'completed' | 'draft' | 'cancelled';
  partnerId?: string;
  partnerPayments?: PartnerPayment[]; // New field for multiple partners
  treasuryPayments?: TreasuryPayment[]; // New field for multiple treasury/custody accounts
  custodyPayments?: { cashHolderId: string, amount: number }[]; // New field for custody payments
  notes?: string;
  paymentMethod?: 'cash' | 'credit' | 'partner' | 'supply_wallet' | 'treasury' | 'custody';
  shippingFees?: number;
  shippingFeesNote?: string;
  shippingFeesPaymentMethod?: 'with_order' | 'wallet';
  otherFees?: number;
  taxRate?: number;
  taxAmount?: number;
  grandTotal?: number;
  attachmentUrl?: string;
  treasuryAccountId?: string;
  warehouseId?: string; // New field for warehouse allocation
  recordExpensesFormally?: boolean;
  distributeExpensesEqually?: boolean;
  costUpdateMethod?: 'last_purchase' | 'weighted_average';
  otherFeesNote?: string;
  expensePaidBy?: string;
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  details: string;
  date: string;
  timestamp: number;
}

export interface CustomPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string; 
  details: string;
  instructions: string;
  logoUrl?: string;
  active: boolean;
  type: 'cod' | 'manual';
}

export interface GlobalOption {
  id: string;
  name: string;
  values: string[];
}

export interface Collection {
  id: string;
  name: string;
  image?: string;
  description?: string;
}

export interface WhatsAppTemplate {
  id: string;
  label: string;
  text: string;
}

export interface CallScript {
  id: string;
  title: string;
  text: string;
}

export interface EmployeeDashboardSettings {
  showAssignedOrders: boolean;
  showOrderStatuses: OrderStatus[];
  showFollowUpReminders: boolean;
}

export interface WebhookIntegration {
  id: string;
  storeUrl: string;
  webhookUrl: string;
  secretKey: string;
  isActive: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  baseSalary: number;
  position: string;
  joinDate: string;
  active: boolean;
  notes?: string;
}

export interface PayrollTransaction {
  id: string;
  staffId: string;
  staffName: string;
  type: 'salary' | 'incentive' | 'deduction';
  amount: number;
  date: string;
  note?: string;
  walletTransactionId?: string;
  treasuryAccountId?: string;
}

export interface Settings {
  id?: string;
  data?: any; // For flexible local storage
  storeBranches?: any[];
  companyNames?: string[];
  enableGlobalFinancials: boolean; 
  webhookIntegrations?: WebhookIntegration[];
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  insuranceFeePercent: number;
  enableInsurance: boolean; 
  inspectionFee: number;
  enableInspection: boolean; 
  returnShippingFee: number;
  enableReturnShipping: boolean; 
  enableFlexShip?: boolean;
  flexShipFee?: number;
  flexShipCompanyFee?: number;
  enableReturnAfterPrice: boolean;
  enableReturnWithoutPrice: boolean;
  enableExchangePrice: boolean;
  baseWeight?: number;
  products: Product[];
  shippingOptions: Record<string, ShippingOption[]>;
  activeCompanies: Record<string, boolean>;
  exchangeSupported: Record<string, boolean>;
  companySpecificFees: Record<string, CompanyFees>; 
  enableGlobalCod: boolean; 
  codThreshold: number;
  codFeeRate: number;
  codTaxRate: number;
  insuranceBasis?: 'cost' | 'price' | 'total' | 'base';
  shippingVatRate?: number;
  vatBasis?: 'shipping_only' | 'shipping_and_insurance';
  sku: string; 
  defaultProductPrice: number;
  enableDefaultPrice: boolean;
  enablePlatformIntegration: boolean;
  integration: PlatformIntegration;
  customAppDomain?: string; // <-- New field for SaaS integration
  customDomain?: string; // <-- New field for live store domain mapping
  domainStatus?: 'pending' | 'active' | 'error' | 'pending_validation';
  domainConflict?: boolean;
  domainDNSRecords?: any; 
  subdomain?: string; // <-- New field for subdomains
  isSubdomainFixed?: boolean; // <-- To pin/fix subdomain
  disableCustodySelling?: boolean; // <-- New field to disable personal custody and deposit to wallet instead
  platformConfigs?: Record<string, {
    appId: string;
    apiKey?: string;
    apiSecret?: string;
    shopUrl?: string;
    shopId?: string;
    lastSync?: string;
    lastProductSync?: string;
    isActive: boolean;
  }>;
  employees: Employee[];
  staffMembers?: StaffMember[]; 
  payrollTransactions?: PayrollTransaction[]; 
  customization: StoreCustomization;
  discountCodes: DiscountCode[];
  abandonedCarts: AbandonedCart[];
  reviews: Review[]; 
  shippingIntegrations: ShippingCarrierIntegration[];
  suppliers: Supplier[];
  supplyOrders: SupplyOrder[];
  activityLogs: ActivityLog[];
  customPages: CustomPage[];
  paymentMethods: PaymentMethod[];
  globalOptions: GlobalOption[]; 
  collections: Collection[];
  connectedPlatforms: string[]; // <-- Added connected platforms (e.g., 'wuilt', 'shopify')
  whatsappTemplates?: WhatsAppTemplate[];
  callScripts?: CallScript[];
  employeeDashboardSettings?: EmployeeDashboardSettings;
  isPosEnabled?: boolean;
  wallet?: WalletSettings;
  partners?: Partner[];
  partnerTransactions?: PartnerTransaction[];
  expenseCategories?: string[]; // Added expense categories
  warehouses?: Warehouse[]; // New field for stores/warehouses
  
  // Wallet & Payment Fees
  depositFeePercent?: number;
  withdrawalFeeType?: 'flat' | 'percent';
  withdrawalFeePercent?: number;
  withdrawalFlatFee?: number;
  sameDayWithdrawalFeeType?: 'flat' | 'percent';
  sameDayWithdrawalFeePercent?: number;
  sameDayWithdrawalFlatFee?: number;
  minWithdrawalFee?: number;
  enableWithdrawalFees?: boolean;
  feeApplicableMethods?: string[]; // e.g. ['card', 'instapay', 'wallet']
  inventoryAudits?: InventoryAuditSession[];
  stockTransfers?: StockTransfer[];
  orderReturns?: OrderReturn[];
  purchaseReturns?: PurchaseReturn[];
  posSales?: POSSale[];
  cashHolders?: CashHolder[];
  cashHandovers?: CashHandover[];
  auditAlertDays?: number; // Days between manual audits before alert
  confettiSettings?: {
    particleCount: number;
    gravity: number;
    spread: number;
    theme?: 'rainbow' | 'gold' | 'fireworks';
    enabledEvents?: string[]; // e.g. ['create_order', 'edit_order', 'complete_order', 'add_product', 'delete_product', 'wallet_withdraw', 'save_settings']
    soundVolume?: number; 
    enableSound?: boolean;
    soundType?: 'standard' | 'cash' | 'success' | 'trumpet' | 'fireworks';
    enableWelcomeSound?: boolean;
    welcomeSoundType?: 'standard' | 'cash' | 'success' | 'trumpet' | 'fireworks' | 'magic' | 'modern_shine' | 'pro_chime' | 'future_ui' | 'soft_welcome' | 'tech_rise';
    enableLoadingSound?: boolean;
  };
}

export interface CashHolder {
  userId: string;
  userName: string;
  currentBalance: number;
  lastUpdated: string;
}

export interface CashHandover {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  date: string;
  notes?: string;
  status: 'completed' | 'cancelled';
  type?: string;
  orderId?: string; // Explicitly link handover to an order
}

export interface POSSaleItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
}

export interface POSSale {
  id: string;
  saleNumber: string;
  date: string;
  items: POSSaleItem[];
  totalAmount: number;
  paymentMethod: 'cash' | 'card' | 'wallet';
  warehouseId: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;
  performedBy: string;
  cashHolderId?: string;
  cashHolderName?: string;
  notes?: string;
}

export interface PurchaseReturnItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  costPrice: number;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseReturnItem[];
  totalRefundAmount: number;
  warehouseId: string;
  status: 'completed' | 'cancelled';
  notes?: string;
  performedBy: string;
}

export interface StockTransferItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  date: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  items: StockTransferItem[];
  status: 'completed' | 'draft' | 'cancelled';
  notes?: string;
  performedBy: string;
}

export interface OrderReturnItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
}

export interface OrderReturn {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  date: string;
  items: OrderReturnItem[];
  totalRefund: number;
  reason: string;
  warehouseId: string;
  restockItems: boolean;
  status: 'completed' | 'cancelled';
  performedBy: string;
  notes?: string;
}

export interface InventoryAuditItemDiscrepancy {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  systemQty: number;
  actualQty: number;
  variance: number;
  costPrice: number;
  varianceValue: number;
  method: 'correction' | 'scrap' | 'surplus'; // تصفية المخزن أو هالك أو بضاعة زائدة
  notes?: string;
}

export interface InventoryAuditSession {
  id: string;
  title: string;
  date: string;
  performedBy: string; // user name/email
  scope: 'all' | string; // 'all' or collection ID
  warehouseId?: string; // New field for warehouse-specific audits
  totalSystemQty: number;
  totalActualQty: number;
  totalVarianceQty: number;
  totalVarianceValue: number;
  discrepancies: InventoryAuditItemDiscrepancy[];
  notes?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
  weight: number;
  thumbnail?: string;
  variantId?: string;
  variantDescription?: string;
  description?: string;
  discountValue?: number;
  discountType?: 'amount' | 'percentage';
}

export interface ConfirmationLog {
  userId: string;
  userName: string;
  timestamp: string;
  action: string;
  notes?: string;
  duration?: number; // Call duration in seconds
}

export interface CallAttempt {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  status: string;
  notes?: string;
  duration?: number;
}

export interface AdvancePaymentHistoryLog {
  id: string;
  timestamp: string;
  amount: number;
  userId: string;
  userName: string;
  recipientType?: 'partner' | 'treasury' | 'employee';
  recipientId?: string;
  recipientName?: string;
  recipientPhone?: string;
  senderDetails?: string;
  action: 'created' | 'updated' | 'reverted' | 'deleted';
  reason?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  action?: string;
  details?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface MaintenancePart {
  id: string;
  productId?: string;
  name: string;
  cost: number;
  priceToCustomer: number;
  purchaseSource?: string;
  purchaseDate?: string;
  quantity?: number;
}

export interface MaintenanceRequest {
  id: string;
  storeId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  governorate?: string;
  city?: string;
  
  itemDescription: string;
  itemSerial?: string;
  itemValue?: number;
  technicalReport?: string;
  initialProblemDescription: string;
  
  status: 'received' | 'inspecting' | 'waiting_for_parts' | 'in_repair' | 'ready' | 'delivered' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  parts: MaintenancePart[];
  laborCost: number;
  shippingFee?: number;
  totalCost: number;
  
  receivedDate: string;
  promisedDate?: string;
  deliveryDate?: string;
  
  technicianName?: string;
  internalNotes?: string;
  attachments?: string[];

  // Shipping details
  shippingCompany?: string;
  shippingTrackingNumber?: string;
  shippingCostToShop?: number;
  shippingCostToCustomer?: number;
  shippingPaymentMethod?: 'cash' | 'add_to_debt';
  shippingStatus?: 'none' | 'pickup_requested' | 'picked_up' | 'received_at_shop' | 'ready_for_shipping' | 'shipped_to_customer' | 'delivered' | 'returned_without_repair';

  // Payment & Financial integration
  paymentMethod?: 'cash' | 'add_to_debt' | 'wallet' | 'bank';
  paymentStatus?: 'unpaid' | 'paid';
  treasuryAccountId?: string;
  financialLogged?: boolean;

  // Commission details
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
  commissionAmount?: number;

  // Waybill and companion order
  waybillOrderId?: string;
  stockDeducted?: boolean;
}

export interface Order {
  id: string;
  store_id?: string;
  source?: 'manual' | 'synced' | 'saas';
  platform?: string;
  orderNumber: string;
  referenceNumber?: string;
  waybillNumber?: string;
  trackingUrl?: string;
  platformOrderId?: string;
  date: string;
  shippingCompany: string;
  shippingArea: string;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string;
  customerAddress: string;
  city?: string;
  governorate?: string;
  notes?: string;
  items: OrderItem[];
  shippingFee: number;
  adminFee?: number;
  tax?: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  productName: string; 
  productPrice: number; 
  productCost: number; 
  totalPrice?: number;
  insuranceFee?: number;
  inspectionFee?: number;
  weight: number; 
  discount: number;
  totalAmountOverride?: number;
  totalAmountOverrideReason?: string;
  includeInspectionFee?: boolean; 
  isInsured?: boolean; 
  inspectionFeeDeducted?: boolean;
  inspectionFeePaidByCustomer?: boolean;
  shippingAndInsuranceDeducted?: boolean;
  returnFeeDeducted?: boolean;
  collectionProcessed?: boolean;
  preparationStatus: PreparationStatus;
  classification?: string;
  redeemedPoints?: number;
  pointsDiscount?: number;
  loyaltyPointsAwarded?: boolean;
  stockDeducted?: boolean;
  orderType?: 'standard' | 'exchange' | 'maintenance';
  shipmentType?: 'delivery' | 'partial_delivery' | 'exchange' | 'return' | 'cash_collection' | 'maintenance_pickup' | 'maintenance_return';
  maintenanceCost?: number;
  maintenanceItemDescription?: string;
  maintenanceItemSerial?: string;
  maintenanceItemValue?: number;
  maintenanceTechnicalReport?: string;
  maintenanceStatus?: 'not_started' | 'received' | 'in_repair' | 'ready_to_ship' | 'delivered' | 'cancelled';
  vatOnStandardShipping?: boolean;
  returnProductValue?: number;
  returnTrackingNumber?: string;
  payWithBostaPoints?: boolean;
  originalOrderId?: string;
  confirmationLogs?: ConfirmationLog[];
  cancellationReason?: string;
  followUpReminder?: string;
  lockedBy?: string;
  lockedByName?: string;
  lockedAt?: string;
  transferStatus?: 'pending' | 'accepted' | 'rejected';
  transferTo?: string;
  transferFrom?: string;
  assignedTo?: string;
  assignedToName?: string;
  auditLogs?: AuditLog[];
  callAttempts?: CallAttempt[];
  sentiment?: string;
  images?: string[];
  advancePayment?: number;
  advancePaymentPartnerId?: string;
  advancePaymentTreasuryId?: string;
  advancePaymentEmployeeId?: string;
  advancePaymentRecipientPhone?: string;
  advancePaymentSenderDetails?: string;
  advancePaymentHistory?: AdvancePaymentHistoryLog[];
  useProductsForShipment?: boolean;
  shipmentDescription?: string;
  shipmentQuantity?: number;
  customShipmentPrice?: number;
  useProductsForReturn?: boolean;
  returnProductId?: string;
  returnVariantId?: string;
  returnDescription?: string;
  returnQuantity?: number;
  returnImage?: string;
  enableFlexShip?: boolean;
  flexShipFee?: number;
  flexShipCompanyFee?: number;
  flexShipFeePaidByCustomer?: boolean;
  flexShipTransactionAdded?: boolean;
  warehouseId?: string; // New field for sales order fulfillment
  channel?: 'website' | 'pos';
  cashHolderId?: string;
  cashHolderName?: string;
  createdBy?: string;
  recordedAsDebt?: boolean;
  deferPaymentToReturn?: boolean;
  returnCashToCustomer?: boolean;
  cashToReturnAmount?: number;
  creditAmount?: number;
  updatedAt?: string;
  exchangeDifference?: number;
  storeBranchId?: string;
  allowOpenShipment?: boolean;
  assignedEmployeeId?: string;
  deliveryNotes?: string;
}

export interface TreasuryAccount {
  id: string;
  name: string;
  type: 'safe' | 'bank' | 'wallet' | 'custody';
  balance: number;
  currency: string;
  accountNumber?: string;
  beneficiaryName?: string;
  bankName?: string;
  walletNumber?: string;
  walletName?: string;
}

export interface TreasuryTransaction {
  id: string;
  date: string;
  fromAccountId?: string;
  toAccountId?: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'advance';
  description: string;
  reference?: string;
}

export interface Treasury {
  id?: string;
  data?: any;
  accounts: TreasuryAccount[];
  transactions: TreasuryTransaction[];
}

export interface StoreData {
  name?: string;
  orders: Order[];
  settings: Settings;
  wallet: Wallet;
  treasury?: Treasury;
  cart: OrderItem[];
  customers: CustomerProfile[]; // Added customers to StoreData
}

export interface PlaceOrderData {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    shippingCompany: string;
    shippingArea: string;
    shippingFee: number;
    paymentMethod: string;
    notes?: string;
    redeemedPoints: number;
    discount: number;
}

export interface Store {
  id: string;
  name: string;
  specialization: string;
  language: string;
  currency: string;
  url: string;
  customDomain?: string;
  subdomain?: string;
  creationDate: string;
}

export interface Site {
  id: string;
  name: string;
  type: 'business' | 'ecommerce';
  url: string;
}

export interface User {
  name?: string;
  fullName: string;
  phone: string;
  email: string;
  password?: string;
  stores?: Store[];
  sites?: Site[];
  isAdmin?: boolean; 
  isBanned?: boolean; 
  joinDate?: string;
  permissions?: Permission[];
  ownedStoreIds?: string[];
}

export interface Invitation {
  storeId: string;
  storeName: string;
  inviterName: string;
}

export interface JoinRequest {
  storeId: string;
  storeName: string;
  employeeId: string;
  employeeName: string;
}

export interface ChatMessage {
  id: string | number;
  store_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  is_file?: boolean;
}
