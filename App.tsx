import { useState, useMemo, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';

import { User, Store, StoreData, Order, Settings, Wallet, OrderItem, Employee, Product, PlaceOrderData, CustomerProfile } from './types';
import * as db from './services/databaseService';
import { onSnapshot, collection, query, where, doc, getDocs } from 'firebase/firestore';
import { db as firebaseDb } from './services/firebaseClient';
import { INITIAL_SETTINGS } from './constants';
import { oneToolzProducts } from './data/one-toolz-products';

import { triggerWebhooks } from './utils/webhook';
import { audioSynth } from './utils/audioSynth';

// Page Components (will be loaded via router)
import SignUpPage from './components/SignUpPage';
import EmployeeLoginPage from './components/EmployeeLoginPage';
import CreateStorePage from './components/CreateStorePage';
import ManageSitesPage from './components/ManageSitesPage';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import OrdersList from './components/OrdersList';
import ProductsPage from './components/ProductsPage';
import CustomersPage from './components/CustomersPage';
import WalletPage from './components/WalletPage';
import SettingsPage from './components/SettingsPage';
import StorefrontPage from './components/StorefrontPage';
import { SmartUpdatesWidget } from './components/SmartUpdatesWidget';
import CheckoutPage from './components/CheckoutPage';
import OrderSuccessPage from './components/OrderSuccessPage';
import StoreCustomizationPage from './components/StoreCustomizationPage';
import ShippingPage from './components/ShippingPage';
import ConfirmationQueuePage from './components/ConfirmationQueuePage';
import AbandonedCartsPage from './components/AbandonedCartsPage';
import DiscountsPage from './components/DiscountsPage';
import ReviewsPage from './components/ReviewsPage';
import CollectionsPage from './components/CollectionsPage';
import ProductOptionsPage from './components/ProductOptionsPage';
import ExpensesPage from './components/ExpensesPage';
import MarketingPage from './components/MarketingPage';
import AnalyticsPage from './components/AnalyticsPage';
import AdminPage from './components/AdminPage';
import MaintenancePage from './src/pages/MaintenancePage';
import EmployeeLayout from './components/EmployeeLayout';
import EmployeeDashboardPage from './components/EmployeeDashboardPage';
import EmployeeAccountSettingsPage from './components/EmployeeAccountSettingsPage';
import EmployeeActivityPage from './components/EmployeeActivityPage';
import AccountSettingsPage from './components/AccountSettingsPage';
import CollectionsReportPage from './components/CollectionsReportPage';
import ActivityLogsPage from './components/ActivityLogsPage';
import SuppliersPage from './components/SuppliersPage';
import PartnersPage from './components/PartnersPage';
import PartnerProfilePage from './components/PartnerProfilePage';
import PagesManager from './components/PagesManager';
import PaymentSettingsPage from './components/PaymentSettingsPage';
import DeveloperSettingsPage from './components/DeveloperSettingsPage';
import TeamChatPage from './components/TeamChatPage';
import WhatsAppPage from './components/WhatsAppPage';
import WelcomeLoader from './components/WelcomeLoader';
import GlobalLoader from './components/GlobalLoader';
import EmployeesPage from './components/EmployeesPage';
import ReportsPage from './components/ReportsPage';
import { TreasuryPage } from './components/TreasuryPage';
import { DomainSettingsPage } from './components/DomainSettingsPage';
import InventoryTransfers from './components/InventoryTransfers';
import OrderReturnsPage from './components/OrderReturnsPage';
import PurchaseReturnsPage from './components/PurchaseReturnsPage';
import POSPage from './components/POSPage';
import CashManagement from './components/CashManagement';
import CreateOrderPage from './components/CreateOrderPage';
import EditOrderPage from './components/EditOrderPage';
import ChatBot from './components/ChatBot';
import CongratsModal from './components/CongratsModal';
import OrderTrackingPage from './components/OrderTrackingPage';
import OtpVerificationPage from './components/OtpVerificationPage';
import IosInstallPrompt from './components/IosInstallPrompt';
import ComingSoonPage from './components/ComingSoonPage';
import AppsPage from './components/AppsPage';
import UniversalInstallPrompt from './components/UniversalInstallPrompt';

interface EmployeeRegisterRequestData {
  fullName: string;
  phone: string;
  password: string;
  storeId: string;
  email: string;
}

import MobileNavigation from './components/MobileNavigation';

const MainLayout = ({ 
    currentUser, 
    handleLogout, 
    isSidebarOpen, 
    setSidebarOpen, 
    activeStore, 
    settings,
    orders = [],
    theme, 
    setTheme,
    dbSyncMode,
    setDbSyncMode,
    forceSync,
    forcePullFromCloud,
    saveStatus,
    saveMessage,
    unsavedChanges
}: any) => {
    const inventoryAlerts = useMemo(() => {
        if (!settings) return [];
        
        const alerts: any[] = [];
        const products = settings.products || [];
        const auditAlertDays = settings.auditAlertDays || 30;
        const suppliers = settings.suppliers || [];
        
        const now = new Date();

        // 1. Check Low Stock, Audits & Expiry
        products.forEach(p => {
            if (p.hasVariants && p.variants) {
                p.variants.forEach(v => {
                    const stock = v.stockQuantity ?? 0;
                    const minStock = v.minStockLevel || 0;
                    if (minStock > 0 && stock <= minStock) {
                        alerts.push({
                            type: 'low_stock',
                            id: `lowstock-${p.id}-${v.id}`,
                            title: 'مخزون منخفض',
                            message: `المنتج "${p.name} - ${Object.values(v.options).join(' ')}" وصل للحد الأدنى (المتاح: ${stock})`,
                            severity: stock === 0 ? 'critical' : 'warning'
                        });
                    }
                    
                    // Expiry check for variants
                    if (v.expiryDate) {
                        const expDate = new Date(v.expiryDate);
                        const daysToExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysToExpiry <= 30 && daysToExpiry > 0) {
                            alerts.push({
                                type: 'expiry',
                                id: `expiry-${p.id}-${v.id}`,
                                title: 'اقتراب تاريخ الانتهاء',
                                message: `المنتج "${p.name} - ${Object.values(v.options).join(' ')}" سينتهي خلال ${daysToExpiry} يوم.`,
                                severity: daysToExpiry <= 7 ? 'critical' : 'warning'
                            });
                        } else if (daysToExpiry <= 0) {
                            alerts.push({
                                type: 'expiry_expired',
                                id: `expired-${p.id}-${v.id}`,
                                title: 'منتج منتهي الصلاحية',
                                message: `المنتج "${p.name} - ${Object.values(v.options).join(' ')}" منتهي الصلاحية منذ ${Math.abs(daysToExpiry)} يوم.`,
                                severity: 'critical'
                            });
                        }
                    }
                });
            } else {
                const stock = p.stockQuantity ?? 0;
                const minStock = p.minStockLevel || 0;
                if (minStock > 0 && stock <= minStock) {
                    alerts.push({
                        type: 'low_stock',
                        id: `lowstock-${p.id}`,
                        title: 'مخزون منخفض',
                        message: `المنتج "${p.name}" وصل للحد الأدنى (المتاح: ${stock})`,
                        severity: stock === 0 ? 'critical' : 'warning'
                    });
                }

                // Expiry check for products
                if (p.expiryDate) {
                    const expDate = new Date(p.expiryDate);
                    const daysToExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysToExpiry <= 30 && daysToExpiry > 0) {
                        alerts.push({
                            type: 'expiry',
                            id: `expiry-${p.id}`,
                            title: 'اقتراب تاريخ الانتهاء',
                            message: `المنتج "${p.name}" سينتهي خلال ${daysToExpiry} يوم.`,
                            severity: daysToExpiry <= 7 ? 'critical' : 'warning'
                        });
                    } else if (daysToExpiry <= 0) {
                        alerts.push({
                            type: 'expiry_expired',
                            id: `expired-${p.id}`,
                            title: 'منتج منتهي الصلاحية',
                            message: `المنتج "${p.name}" منتهي الصلاحية منذ ${Math.abs(daysToExpiry)} يوم.`,
                            severity: 'critical'
                        });
                    }
                }
            }

            const audits = p.lastAudited || {};
            const lastAuditDateStr = audits['all'] || Object.values(audits)[0];
            if (lastAuditDateStr) {
                const lastAuditDate = new Date(lastAuditDateStr);
                const diffTime = Math.abs(now.getTime() - lastAuditDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays >= auditAlertDays) {
                    alerts.push({
                        type: 'audit_overdue',
                        id: `audit-${p.id}`,
                        title: 'جرد متأخر',
                        message: `المنتج "${p.name}" لم يتم جرده منذ ${diffDays} يوم.`,
                        severity: 'info'
                    });
                }
            }
        });

        // 2. Check Pending Orders (Older than 24 hours)
        orders.forEach(order => {
            if (order.status === 'pending') {
                const orderDate = new Date(order.date);
                const hoursDiff = Math.abs(now.getTime() - orderDate.getTime()) / 36e5;
                if (hoursDiff >= 24) {
                    alerts.push({
                        type: 'pending_order',
                        id: `pending-${order.id}`,
                        title: 'أوردر معلق متأخر',
                        message: `الأوردر #${order.orderNumber || order.id.slice(-6)} ينتظر التأكيد منذ ${Math.floor(hoursDiff)} ساعة.`,
                        severity: 'warning'
                    });
                }
            }
        });

        // 3. Check High Supplier Debts (Threshold: 5000)
        suppliers.forEach(sup => {
            if ((sup.balance || 0) >= 5000) {
                alerts.push({
                    type: 'supplier_debt',
                    id: `debt-${sup.id}`,
                    title: 'مديونية مورد مرتفعة',
                    message: `المورد "${sup.name}" لديه مديونية مستحقة بقيمة ${sup.balance.toLocaleString()} ج.م`,
                    severity: 'warning'
                });
            }
        });

        // 4. Check High Cash Holder Balances (Threshold: 5000)
        const cashHolders = settings.cashHolders || [];
        cashHolders.forEach(ch => {
            if (ch.currentBalance >= 5000) {
                alerts.push({
                    type: 'cash_balance',
                    id: `cash-${ch.userId}`,
                    title: 'عهدة نقدية مرتفعة',
                    message: `الموظف "${ch.userName}" يحمل عهدة نقدية كبيرة بقيمة ${ch.currentBalance.toLocaleString()} ج.م`,
                    severity: 'warning'
                });
            }
        });

        // 5. Check Abandoned Carts (High value: 2000+)
        const abandonedCarts = settings.abandonedCarts || [];
        abandonedCarts.forEach(cart => {
            if (cart.totalValue >= 2000) {
                const cartDate = new Date(cart.date);
                const hoursDiff = Math.abs(now.getTime() - cartDate.getTime()) / 36e5;
                if (hoursDiff <= 48) { // Only alert for recent ones
                    alerts.push({
                        type: 'abandoned_cart',
                        id: `abandoned-${cart.id}`,
                        title: 'سلة متروكة هامة',
                        message: `العميل "${cart.customerName}" ترك سلة بقيمة ${cart.totalValue.toLocaleString()} ج.م`,
                        severity: 'info'
                    });
                }
            }
        });

        return alerts;
    }, [settings, orders]);

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-50 transition-colors duration-500 overflow-hidden relative" dir="rtl">
            {/* Immersive Floating Ambient Glow Elements */}
            <div className="absolute top-[-5%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-[120px] pointer-events-none z-0 animate-ambient-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/8 dark:bg-purple-500/12 blur-[140px] pointer-events-none z-0 animate-ambient-pulse-slow" />
            <div className="absolute top-[35%] left-[25%] w-[300px] h-[300px] rounded-full bg-cyan-400/8 dark:bg-cyan-550/10 blur-[100px] pointer-events-none z-0 animate-float" />

            <div className="relative z-10 flex flex-col h-full overflow-hidden">
                <Header 
                    currentUser={currentUser} 
                    onLogout={handleLogout} 
                    onToggleSidebar={() => setSidebarOpen(true)} 
                    theme={theme} 
                    setTheme={setTheme} 
                    activeStore={activeStore} 
                    dbSyncMode={dbSyncMode}
                    setDbSyncMode={setDbSyncMode}
                    forceSync={forceSync}
                    forcePullFromCloud={forcePullFromCloud}
                    saveStatus={saveStatus}
                    saveMessage={saveMessage}
                    unsavedChanges={unsavedChanges}
                    inventoryAlerts={inventoryAlerts}
                />
                <div className="flex flex-1 overflow-hidden relative">
                    <Sidebar activeStore={activeStore} settings={settings} isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 no-scrollbar relative">
                        <Outlet />
                    </main>
                    <MobileNavigation activeStoreId={activeStore?.id} />
                </div>
            </div>
        </div>
    );
};

const AdminLayout = ({ currentUser, handleLogout, theme, setTheme }: any) => (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-[#030712] text-slate-900 dark:text-slate-50 overflow-hidden relative" dir="rtl">
        {/* Floating Ambient Glow Elements */}
        <div className="absolute top-[-5%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-[120px] pointer-events-none z-0 animate-ambient-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-500/8 dark:bg-purple-500/12 blur-[140px] pointer-events-none z-0 animate-ambient-pulse-slow" />
        
        <div className="relative z-10 flex flex-col h-full overflow-hidden">
            <Header currentUser={currentUser} onLogout={handleLogout} theme={theme} setTheme={setTheme} onToggleSidebar={() => {}} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar relative">
                <Outlet />
            </main>
        </div>
    </div>
);

const EmployeeLayoutWrapper = ({ children, ...props }: any) => {
    return <EmployeeLayout {...props}>{children}</EmployeeLayout>;
};

function sanitizeData(storeData: StoreData): StoreData {
    if (!storeData) return storeData;

    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/; 
    let hasChanges = false;

    const fixDate = (dateString: string): string | null => {
        if (!dateString || typeof dateString !== 'string') return null;
        if (isoDateRegex.test(dateString)) return null;
        
        const parsedDate = new Date(dateString);
        if (isNaN(parsedDate.getTime()) || /[٠-٩]/.test(dateString)) {
            hasChanges = true;
            return new Date().toISOString();
        } else {
            hasChanges = true;
            return parsedDate.toISOString();
        }
    };
    
    const sanitizedTransactions = storeData.wallet?.transactions?.map(tx => {
        const fixedDate = fixDate(tx.date);
        return fixedDate ? { ...tx, date: fixedDate } : tx;
    });

    const sanitizedOrders = storeData.orders?.map(order => {
        const fixedDate = fixDate(order.date);
        return fixedDate ? { ...order, date: fixedDate } : order;
    });

    if (hasChanges) {
        return {
            ...storeData,
            wallet: {
                ...(storeData.wallet || {balance: 0, transactions: []}),
                transactions: sanitizedTransactions || storeData.wallet?.transactions || []
            },
            orders: sanitizedOrders || storeData.orders || [],
        };
    }

    return storeData;
}

// -------------------------------------------------------------------------------------------------
// تم سحب المكونات الداخلية للخارج لمنع إعادة البناء وتدمير واجهة المستخدم (The Flicker Fix)
// -------------------------------------------------------------------------------------------------
const OwnerLayoutWrapper = ({
    currentUser,
    isEmployeeSession,
    welcomeScreenShown,
    setWelcomeScreenShown,
    handleLogout,
    isSidebarOpen,
    setIsSidebarOpen,
    activeStore,
    activeStoreId,
    handleSetActiveStore,
    settings,
    orders = [],
    theme,
    setTheme,
    dbSyncMode,
    setDbSyncMode,
    forceSync,
    forcePullFromCloud,
    saveStatus,
    saveMessage,
    unsavedChanges
}: any) => {
    const location = useLocation();
    const { storeId: urlStoreId } = useParams();

    useEffect(() => {
        if (urlStoreId && urlStoreId !== activeStoreId) {
            handleSetActiveStore(urlStoreId);
        }
    }, [urlStoreId, activeStoreId, handleSetActiveStore]);

    useEffect(() => {
        if (!welcomeScreenShown && settings) {
            // Preload the sound immediately when settings are available
            const confettiSettings = settings?.confettiSettings;
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
            const selectedType = confettiSettings?.welcomeSoundType || 'standard';
            const soundUrl = soundMap[selectedType] || soundMap.standard;
            const welcomeAudio = new Audio(soundUrl);
            welcomeAudio.preload = 'auto';
            welcomeAudio.volume = confettiSettings?.soundVolume ?? 0.3;

            // Loading sound logic
            let loadingAudio: HTMLAudioElement | null = null;
            if (confettiSettings?.enableLoadingSound !== false) {
                loadingAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3');
                loadingAudio.volume = (confettiSettings?.soundVolume ?? 0.3) * 0.5; // Slightly quieter
                loadingAudio.loop = true;
                loadingAudio.play().catch(() => {
                    // Fallback play if blocked
                    const playOnInteract = () => {
                        if (loadingAudio) loadingAudio.play().catch(() => {});
                        window.removeEventListener('mousedown', playOnInteract);
                    };
                    window.addEventListener('mousedown', playOnInteract);
                });
            }

            const timer = setTimeout(() => {
                // Stop loading sound
                if (loadingAudio) {
                    loadingAudio.pause();
                    loadingAudio = null;
                }

                setWelcomeScreenShown(true);
                
                if (confettiSettings?.enableWelcomeSound !== false && currentUser) {
                    const playWelcome = () => {
                        welcomeAudio.play().catch(() => {
                            // Fallback: play on first user interaction if blocked
                            const playOnInteract = () => {
                                welcomeAudio.play().catch(() => {});
                                window.removeEventListener('click', playOnInteract);
                            };
                            window.addEventListener('click', playOnInteract);
                        });
                    };
                    playWelcome();
                }
            }, 1800); // Slightly longer to ensure loading and visual impact
            
            return () => {
                clearTimeout(timer);
                if (loadingAudio) {
                    loadingAudio.pause();
                    loadingAudio = null;
                }
            };
        }
    }, [welcomeScreenShown, setWelcomeScreenShown, settings, currentUser]);

    if (isEmployeeSession) {
        return <Navigate to="/employee/dashboard" replace />;
    }
    if (!currentUser) {
        return <Navigate to="/owner-login" replace />;
    }

    const hasNoStores = !currentUser.stores || currentUser.stores.length === 0;

    if (hasNoStores && !currentUser.isAdmin) {
        if (location.pathname !== '/create-store') {
            return <Navigate to="/create-store" replace />;
        }
        return (
            <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-slate-950 dark:to-[#111827] text-slate-800 dark:text-slate-200 min-h-screen" dir="rtl">
                <Header currentUser={currentUser} onLogout={handleLogout} onToggleSidebar={() => {}} theme={theme} setTheme={setTheme} />
                <main className="flex-1 p-4 md:p-6">
                    <Outlet />
                </main>
            </div>
        );
    }

    if (!welcomeScreenShown) {
        return <WelcomeLoader userName={currentUser?.fullName.split(' ')[0] || ''} />;
    }

    return (
        <MainLayout 
            currentUser={currentUser} 
            handleLogout={handleLogout} 
            isSidebarOpen={isSidebarOpen} 
            setSidebarOpen={setIsSidebarOpen} 
            activeStore={activeStore} 
            settings={settings}
            orders={orders}
            theme={theme} 
            setTheme={setTheme} 
            dbSyncMode={dbSyncMode}
            setDbSyncMode={setDbSyncMode}
            forceSync={forceSync}
            forcePullFromCloud={forcePullFromCloud}
            saveStatus={saveStatus}
            saveMessage={saveMessage}
            unsavedChanges={unsavedChanges}
        />
    );
};

const CatchAllRedirect = ({ currentUser, isEmployeeSession, activeStoreId }: any) => {
    if (!currentUser) return <Navigate to="/owner-login" replace />;
    if (isEmployeeSession) return <Navigate to="/employee/dashboard" replace />;
    if (currentUser.isAdmin) return <Navigate to="/admin" replace />;
    
    if (activeStoreId) {
        return <Navigate to={`/store/${activeStoreId}/dashboard`} replace />;
    }
    
    if (currentUser.stores && currentUser.stores.length > 0) {
        return <Navigate to={`/store/${currentUser.stores[0].id}/dashboard`} replace />;
    }

    return <Navigate to="/create-store" replace />;
};
// -------------------------------------------------------------------------------------------------


export const AppComponent = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [allStoresData, setAllStoresData] = useState<Record<string, StoreData>>({});
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
    const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
    const [syncedSnapshot, setSyncedSnapshot] = useState<{ users: User[]; allStoresData: Record<string, StoreData>; } | null>(null);
    const [authChecked, setAuthChecked] = useState<boolean>(false);
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    const [isEmployeeSession, setIsEmployeeSession] = useState<boolean>(false);
    const [theme, setTheme] = useState<string>(localStorage.getItem('theme') || 'system');
    const [showCongratsModal, setShowCongratsModal] = useState<boolean>(false);
    const [welcomeScreenShown, setWelcomeScreenShown] = useState<boolean>(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'local_saved' | 'success' | 'pending' | 'error'>('idle');
    const [saveMessage, setSaveMessage] = useState('');
    const [isStandaloneStorefront, setIsStandaloneStorefront] = useState<boolean>(false);
    const [isStoreNotFound, setIsStoreNotFound] = useState<boolean>(false);
    
    const [dbSyncMode, setDbSyncModeState] = useState<'manual' | 'auto'>(() => {
        const value = localStorage.getItem('dbSyncMode');
        return (value === 'auto' || value === 'manual') ? value : 'auto';
    });

    const setDbSyncMode = (mode: 'manual' | 'auto') => {
        localStorage.setItem('dbSyncMode', mode);
        setDbSyncModeState(mode);
        // Force state update to trigger listener changes
        window.dispatchEvent(new Event('storage'));
    };
    
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const refreshDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
    const isRefreshing = useRef(false);
    
    // Stable refs for unstable dependencies
    const refreshStoreDataRef = useRef<any>(null);
    const refreshGlobalDataRef = useRef<any>(null);
    const activeStoreRef = useRef<any>(null);
    const allStoresDataRef = useRef<any>(null);
    
    // 2FA State
    const [userForOtp, setUserForOtp] = useState<User | null>(null);
    const [sessionInfoForOtp, setSessionInfoForOtp] = useState<{isEmployee: boolean, storeId: string} | null>(null);
    const [otpError, setOtpError] = useState<string>('');

    // PWA Install State
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isStandalone, setIsStandalone] = useState(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
    const [isIos, setIsIos] = useState(false);
    
    const navigate = useNavigate();
    const location = useLocation();

    // تشغيل أصوات المأثرات التفاعلية لجميع أزار وتبويبات اللوحة تلقائياً وبشكل شيك جداً
    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            // البحث عن أقرب عنصر قابل للنقر
            const clickable = target.closest('button, [role="button"], a, input[type="submit"], input[type="button"], select');
            if (!clickable) return;

            const textContent = (clickable.textContent || '').trim();
            const classList = clickable.className || '';
            
            // تصنيف الصوت ومستوى التفاعل
            const isDelete = classList.includes('delete') || 
                             classList.includes('trash') || 
                             classList.includes('remove') || 
                             classList.includes('clear') || 
                             textContent.includes('مسح') || 
                             textContent.includes('حذف') || 
                             textContent.includes('إلغاء');

            const isSuccess = classList.includes('success') || 
                              textContent.includes('حفظ') || 
                              textContent.includes('تأكيد') || 
                              textContent.includes('إضافة') || 
                              textContent.includes('نشر') ||
                              textContent.includes('إرسال') ||
                              textContent.includes('تفعيل') ||
                              textContent.includes('دفع') ||
                              textContent.includes('شحن');

            const isTabOrNav = classList.includes('tab') || 
                               classList.includes('nav') || 
                               clickable.tagName === 'A' || 
                               clickable.getAttribute('role') === 'tab' ||
                               clickable.closest('nav') ||
                               classList.includes('sidebar-link');

            if (isDelete) {
                audioSynth.playTone('warning');
            } else if (isSuccess) {
                audioSynth.playTone('success');
            } else if (isTabOrNav) {
                audioSynth.playTone('info'); // نغمة انسيابية وناعمة للتبويبات
            } else {
                audioSynth.playTone('click'); // نقرة هادئة للأزرار العادية
            }
        };

        document.addEventListener('click', handleGlobalClick, { capture: true });
        return () => {
            document.removeEventListener('click', handleGlobalClick, { capture: true });
        };
    }, []);

    // إغلاق القائمة تلقائياً عند تغيير المسار في الموبايل
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // تتبع حالة الحفظ لمنع تداخل التحديثات اللحظية
    const isSavingRef = useRef(false);
    const isDirtyRef = useRef(false);
    useEffect(() => {
        isSavingRef.current = (saveStatus === 'saving' || saveStatus === 'pending');
    }, [saveStatus]);

    const activeStore = useMemo(() => {
        if (!activeStoreId) return undefined;
        const owner = users.find(u => u.stores?.some(s => s.id === activeStoreId));
        return owner?.stores?.find(s => s.id === activeStoreId);
    }, [activeStoreId, users]);

    // Capture/update synced snapshot
    useEffect(() => {
        if (isInitialLoad) return;
        
        // When initial load is done, set the initial snapshot
        if (!syncedSnapshot && users.length > 0) {
            setSyncedSnapshot({
                users: JSON.parse(JSON.stringify(users)),
                allStoresData: JSON.parse(JSON.stringify(allStoresData))
            });
        }
    }, [isInitialLoad, users, allStoresData, syncedSnapshot]);

    useEffect(() => {
        if (saveStatus === 'success') {
            setSyncedSnapshot({
                users: JSON.parse(JSON.stringify(users)),
                allStoresData: JSON.parse(JSON.stringify(allStoresData))
            });
        }
    }, [saveStatus, users, allStoresData]);

    const getUnsavedChanges = (): any[] => {
        if (!syncedSnapshot || !activeStoreId) return [];

        const currentStore = allStoresData[activeStoreId];
        const snapStore = syncedSnapshot.allStoresData[activeStoreId];

        if (!currentStore) return [];

        const changes: any[] = [];

        const oldProducts = snapStore?.settings?.products || [];
        const newProducts = currentStore.settings?.products || [];

        const oldOrders = snapStore?.orders || [];
        const newOrders = currentStore.orders || [];

        const oldSuppliers = snapStore?.settings?.suppliers || [];
        const newSuppliers = currentStore.settings?.suppliers || [];

        const oldSupplyOrders = snapStore?.settings?.supplyOrders || [];
        const newSupplyOrders = currentStore.settings?.supplyOrders || [];

        const oldDiscountCodes = snapStore?.settings?.discountCodes || [];
        const newDiscountCodes = currentStore.settings?.discountCodes || [];

        const oldReviews = snapStore?.settings?.reviews || [];
        const newReviews = currentStore.settings?.reviews || [];

        const oldTreasury = snapStore?.treasury?.accounts || [];
        const newTreasury = currentStore.treasury?.accounts || [];

        const oldPartners = snapStore?.settings?.partners || [];
        const newPartners = currentStore.settings?.partners || [];

        const oldUsers = syncedSnapshot.users || [];
        const newUsers = users || [];

        // Products comparison
        newProducts.forEach(p => {
            const oldP = oldProducts.find(o => o.id === p.id);
            if (!oldP) {
                changes.push({ type: 'product', action: 'add', name: p.name });
            } else {
                if (oldP.name !== p.name || oldP.price !== p.price || oldP.costPrice !== p.costPrice || oldP.stockQuantity !== p.stockQuantity) {
                    changes.push({ type: 'product', action: 'modify', name: p.name });
                }
            }
        });
        oldProducts.forEach(p => {
            if (!newProducts.some(n => n.id === p.id)) {
                changes.push({ type: 'product', action: 'delete', name: p.name });
            }
        });

        // Orders comparison
        newOrders.forEach(o => {
            const oldO = oldOrders.find(oldItem => oldItem.id === o.id);
            if (!oldO) {
                changes.push({ type: 'order', action: 'add', name: `طلب #${o.id.slice(-6)}` });
            } else {
                if (oldO.status !== o.status || oldO.totalPrice !== o.totalPrice || (oldO.items || []).length !== (o.items || []).length) {
                    changes.push({ type: 'order', action: 'modify', name: `طلب #${o.id.slice(-6)}` });
                }
            }
        });
        oldOrders.forEach(o => {
            if (!newOrders.some(n => n.id === o.id)) {
                changes.push({ type: 'order', action: 'delete', name: `طلب #${o.id.slice(-6)}` });
            }
        });

        // Suppliers comparison
        newSuppliers.forEach(s => {
            const oldS = oldSuppliers.find(o => o.id === s.id);
            if (!oldS) {
                changes.push({ type: 'supplier', action: 'add', name: s.name });
            } else {
                if (oldS.name !== s.name || oldS.balance !== s.balance || oldS.phone !== s.phone) {
                    changes.push({ type: 'supplier', action: 'modify', name: s.name });
                }
            }
        });
        oldSuppliers.forEach(s => {
            if (!newSuppliers.some(n => n.id === s.id)) {
                changes.push({ type: 'supplier', action: 'delete', name: s.name });
            }
        });

        // Supply Orders comparison
        newSupplyOrders.forEach(so => {
            const oldSo = oldSupplyOrders.find(o => o.id === so.id);
            if (!oldSo) {
                changes.push({ type: 'supply_order', action: 'add', name: `فاتورة شراء #${so.orderNumber || so.id.slice(-6)}` });
            } else {
                if (oldSo.status !== so.status || oldSo.totalCost !== so.totalCost) {
                    changes.push({ type: 'supply_order', action: 'modify', name: `فاتورة شراء #${so.orderNumber || so.id.slice(-6)}` });
                }
            }
        });
        oldSupplyOrders.forEach(so => {
            if (!newSupplyOrders.some(n => n.id === so.id)) {
                changes.push({ type: 'supply_order', action: 'delete', name: `فاتورة شراء #${so.orderNumber || so.id.slice(-6)}` });
            }
        });

        // Discount Codes comparison
        newDiscountCodes.forEach(d => {
            const oldD = oldDiscountCodes.find(o => o.id === d.id);
            if (!oldD) {
                changes.push({ type: 'discount', action: 'add', name: d.code });
            } else {
                if (oldD.code !== d.code || oldD.value !== d.value || oldD.active !== d.active) {
                    changes.push({ type: 'discount', action: 'modify', name: d.code });
                }
            }
        });
        oldDiscountCodes.forEach(d => {
            if (!newDiscountCodes.some(n => n.id === d.id)) {
                changes.push({ type: 'discount', action: 'delete', name: d.code });
            }
        });

        // Reviews comparison
        newReviews.forEach(r => {
            const oldR = oldReviews.find(o => o.id === r.id);
            if (!oldR) {
                changes.push({ type: 'review', action: 'add', name: r.comment || `تقييم العميل ${r.customerName}` });
            } else {
                if (oldR.status !== r.status || oldR.rating !== r.rating) {
                    changes.push({ type: 'review', action: 'modify', name: r.comment || `تقييم العميل ${r.customerName}` });
                }
            }
        });
        oldReviews.forEach(r => {
            if (!newReviews.some(n => n.id === r.id)) {
                changes.push({ type: 'review', action: 'delete', name: r.comment || `تقييم العميل ${r.customerName}` });
            }
        });

        // Treasury comparison
        newTreasury.forEach(a => {
            const oldA = oldTreasury.find(o => o.id === a.id);
            if (!oldA) {
                changes.push({ type: 'treasury', action: 'add', name: a.name });
            } else if (oldA.balance !== a.balance) {
                changes.push({ type: 'treasury', action: 'modify', name: a.name });
            }
        });

        // Partners comparison
        newPartners.forEach(p => {
            const oldP = oldPartners.find(o => o.id === p.id);
            if (!oldP) {
                changes.push({ type: 'partner', action: 'add', name: p.name });
            } else if (oldP.balance !== p.balance) {
                changes.push({ type: 'partner', action: 'modify', name: p.name });
            }
        });

        // Users comparison
        newUsers.forEach(u => {
            const oldU = oldUsers.find(o => o.phone === u.phone);
            if (!oldU) {
                changes.push({ type: 'user', action: 'add', name: u.fullName });
            } else {
                if (oldU.fullName !== u.fullName || oldU.email !== u.email || oldU.isAdmin !== u.isAdmin || JSON.stringify(oldU.stores) !== JSON.stringify(u.stores)) {
                    changes.push({ type: 'user', action: 'modify', name: u.fullName });
                }
            }
        });
        oldUsers.forEach(u => {
            if (!newUsers.some(n => n.phone === u.phone)) {
                changes.push({ type: 'user', action: 'delete', name: u.fullName });
            }
        });

        // Settings comparison
        if (snapStore) {
            const keysToCompare = [
                'store_name', 'phone', 'address', 'currency', 'taxNumber', 'commercialRegister', 'shippingVatRate',
                'enableInsurance', 'enableInspection', 'enableReturnShipping', 'enableFlexShip', 'flexShipFee', 'flexShipCompanyFee',
                'enableReturnAfterPrice', 'enableExchangePrice', 'enableGlobalCod', 'insuranceFeePercent'
            ];
            const settingsChanged = keysToCompare.some(k => currentStore.settings?.[k as keyof Settings] !== snapStore.settings?.[k as keyof Settings]);
            if (settingsChanged) {
                changes.push({ type: 'settings', action: 'modify', name: 'الإعدادات العامة للمتجر' });
            }
        }

        return changes;
    };

    // Ensure every store has a subdomain and generate a random one if missing
    useEffect(() => {
        if (isInitialLoad || isRefreshing.current) return;
        
        let changed = false;
        const newAllStoresData = { ...allStoresData };
        
        Object.keys(newAllStoresData).forEach(storeId => {
            const data = newAllStoresData[storeId];
            if (data && data.settings && !data.settings.subdomain && !data.settings.isSubdomainFixed) {
                // Find existing subdomain in users object first
                const owner = users.find(u => u.stores?.some(s => s.id === storeId));
                const storeMeta = owner?.stores?.find(s => s.id === storeId);
                const existingSub = storeMeta?.subdomain;

                const generatedSubdomain = existingSub || (() => {
                    const storeName = storeId;
                    const base = storeName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
                    const random = Math.floor(1000 + Math.random() * 9000).toString();
                    return `${base || 'store'}-${random}`;
                })();
                
                newAllStoresData[storeId] = {
                    ...data,
                    settings: {
                        ...data.settings,
                        subdomain: generatedSubdomain,
                        isSubdomainFixed: true
                    }
                };
                changed = true;
            }
        });
        
        if (changed) {
            setAllStoresData(newAllStoresData);
        }
    }, [allStoresData, isInitialLoad, users]);

    // Sync domains to users for ALL stores that have loaded data
    useEffect(() => {
        if (isInitialLoad || isRefreshing.current) return;

        const updateTimeout = setTimeout(() => {
            setUsers(prevUsers => {
                let changed = false;
                const newUsers = prevUsers.map(user => {
                    if (!user.stores) return user;
                    
                    let storesChanged = false;
                    const newStores = user.stores.map(store => {
                        const storeData = allStoresData[store.id];
                        
                        let currentCustomDomain = store.customDomain;
                        let currentSubdomain = store.subdomain;
                        
                        if (storeData && storeData.settings) {
                            currentCustomDomain = storeData.settings.customAppDomain || currentCustomDomain;
                            currentSubdomain = storeData.settings.subdomain || currentSubdomain;
                            // If it's fixed in settings, respect that even if currentSubdomain is somehow null in store object
                            if (storeData.settings.isSubdomainFixed && storeData.settings.subdomain) {
                                currentSubdomain = storeData.settings.subdomain;
                            }
                        }

                        if (!currentSubdomain && !storeData?.settings?.isSubdomainFixed && (!store.url || store.url.includes('wuitstore') || store.url.includes('---'))) {
                            const base = store.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
                            const random = Math.floor(1000 + Math.random() * 9000).toString();
                            currentSubdomain = `${base || 'store'}-${random}`;
                        }
                        
                        let bestUrl = store.url;
                        if (currentCustomDomain) {
                            bestUrl = currentCustomDomain;
                        } else if (currentSubdomain) {
                            bestUrl = `${currentSubdomain}.abdomedi.com`;
                        }

                        if (
                            store.customDomain !== currentCustomDomain || 
                            store.subdomain !== currentSubdomain ||
                            store.url !== bestUrl
                        ) {
                            changed = true;
                            storesChanged = true;
                            return { 
                                ...store, 
                                customDomain: currentCustomDomain, 
                                subdomain: currentSubdomain,
                                url: bestUrl
                            };
                        }
                        return store;
                    });
                    
                    if (storesChanged) return { ...user, stores: newStores };
                    return user;
                });
                
                return changed ? newUsers : prevUsers;
            });
        }, 1000);

        return () => clearTimeout(updateTimeout);
    }, [allStoresData, isInitialLoad]);

    // --- Aggressive Auto-Save Logic ---
    // 1. Instant local persistence to IndexedDB
    useEffect(() => {
        if (isInitialLoad || isRefreshing.current) return;

        const fastLocalSave = async () => {
            try {
                // Always save global users immediately locally
                await db.saveLocal('global', { users, loyaltyData: {} });
                
                // Save active store data immediately locally
                if (activeStoreId && allStoresData[activeStoreId]) {
                    await db.saveLocal(activeStoreId, allStoresData[activeStoreId]);
                }
                
                // Set status to local_saved to reassure the user, but don't overwrite if we are currently cloud-saving or in error
                setSaveStatus(prev => {
                    if (prev === 'saving' || prev === 'error') return prev;
                    return 'local_saved';
                });
            } catch (err) {
                console.warn('[LOCAL-SAVE] Quick local save failed:', err);
            }
        };

        const timer = setTimeout(fastLocalSave, 200); // 200ms for responsiveness
        return () => clearTimeout(timer);
    }, [users, allStoresData, activeStoreId, isInitialLoad]);

    // 2. Network sync debounce (Firebase)
    useEffect(() => {
        if (isInitialLoad) return;
        
        if (isRefreshing.current) {
            isRefreshing.current = false; 
            return;
        }

        // Bypasses auto-cloud writes when in manual (local desktop) mode.
        if (dbSyncMode === 'manual') {
            setSaveStatus('local_saved');
            setSaveMessage('محفوظ محلياً (ديسك توب)');
            return;
        }

        if (saveStatus !== 'saving') {
            setSaveStatus('pending');
            setSaveMessage('تغييرات غير محفوظة...');
        }

        isDirtyRef.current = true;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(async () => {
            // Already a save in progress? Wait for it.
            if (isSavingRef.current) {
                // If it's been saving for too long, just ignore the flag as a failsafe
                return;
            }

            setSaveStatus('saving');
            setSaveMessage('جاري المزامنة مع السحاب...');

            const syncWithTimeout = async () => {
                isSavingRef.current = true;
                try {
                    // Sync parallel
                    const cloudPromises = [];
                    cloudPromises.push(db.saveGlobalData({ users, loyaltyData: {} }));
                    
                    if (activeStoreId && allStoresData[activeStoreId] && activeStore) {
                        cloudPromises.push(db.saveStoreData(activeStore, allStoresData[activeStoreId]));
                    }

                    const results = await Promise.all(cloudPromises);
                    const quotaExceeded = results.some(r => r.error === 'QUOTA_EXCEEDED');
                    
                    if (quotaExceeded) {
                        setDbSyncMode('manual');
                        setSaveStatus('error');
                        setSaveMessage('تم استهلاك حصة الاستخدام اليومية. تم التحويل للعمل دون اتصال.');
                        return;
                    }

                    const failed = results.find(r => !r.success);
                    
                    if (failed) {
                        console.warn('[AUTO-SYNC] Cloud sync failed partially:', failed.error);
                        // Still consider success locally since fastLocalSave already finished
                        setSaveStatus('local_saved');
                        return;
                    }

                    isDirtyRef.current = false;
                    setSaveStatus('success');
                    setSaveMessage('تمت المزامنة بنجاح!');
                    setTimeout(() => {
                        setSaveStatus(prev => prev === 'success' ? 'idle' : prev);
                    }, 3000);
                } catch (e: any) {
                    if (e?.message === 'QUOTA_EXCEEDED' || e === 'QUOTA_EXCEEDED') {
                        setDbSyncMode('manual');
                        setSaveStatus('error');
                        setSaveMessage('تم استهلاك حصة الاستخدام اليومية. تم التحويل للعمل دون اتصال.');
                        return;
                    }
                    console.error('[AUTO-SYNC] Error during cloud sync:', e);
                    // Fallback to local_saved so the user doesn't see a permanent error/loading
                    setSaveStatus('local_saved');
                    setSaveMessage('محفوظ محلياً (المزامنة معطلة مؤقتاً)');
                } finally {
                    isSavingRef.current = false;
                }
            };

            syncWithTimeout();
        }, 15000); // 15s debounce for efficiency - reduced from 5s to conserve writes

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [users, allStoresData, activeStore, activeStoreId, isInitialLoad, dbSyncMode]);

    // 3. Emergency save on close/visibility change
    useEffect(() => {
        const handleEmergencySave = () => {
            if (activeStoreId && allStoresData[activeStoreId]) {
                db.saveLocal('global', { users, loyaltyData: {} });
                db.saveLocal(activeStoreId, allStoresData[activeStoreId]);
            }
        };

        window.addEventListener('beforeunload', handleEmergencySave);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                handleEmergencySave();
            }
        });

        return () => {
            window.removeEventListener('beforeunload', handleEmergencySave);
            document.removeEventListener('visibilitychange', handleEmergencySave);
        };
    }, [users, allStoresData, activeStoreId]);


    useEffect(() => {
        const applyTheme = () => {
            // If we are on a storefront page, we ALWAYS want light mode (no 'dark' class on element)
            const isStorefrontPath = isStandaloneStorefront || 
                location.pathname === '/store' || 
                location.pathname === '/cart' || 
                location.pathname === '/checkout' || 
                location.pathname.startsWith('/order-success');

            if (isStorefrontPath) {
                document.documentElement.classList.remove('dark');
                return;
            }

            const themeToApply = theme === 'system' 
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : theme;

            if (themeToApply === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };
        applyTheme();
        localStorage.setItem('theme', theme);
    }, [theme, location.pathname, isStandaloneStorefront]);

    const loadData = async () => {
        setIsInitialLoad(true);
        isRefreshing.current = true;
        try {
            let loadedUsers: User[] = [];
            try {
                const globalData = await db.getGlobalData();
                loadedUsers = globalData?.users || [];
                setUsers(loadedUsers);
            } catch (globalErr) {
                console.warn('[LOAD-DATA] Failed to fetch global user data (expected for guest storefront page):', globalErr);
            }
            
            const host = window.location.hostname.toLowerCase();
            const hostNoWww = host.replace(/^www\./, '');
            const mainDomains = ['app.abdomedi.com', 'abdomedi.com', 'fallback.abdomedi.com', 'localhost', '127.0.0.1'];
            
            // Refined isMainDomain check: exact match for root domains or the dev/preview pages
            const isExactMainDomain = mainDomains.includes(hostNoWww) || hostNoWww.includes('run.app') || hostNoWww.includes('pages.dev');
            
            // Support for forcing storefront view in development via query param
            const urlParams = new URLSearchParams(window.location.search);
            const previewId = urlParams.get('preview_store');

            let foundStoreId: string | null = previewId;
            
            if (!foundStoreId && !isExactMainDomain) {
                // 1. HIGH-PERFORMANCE DIRECT LOOKUP IN STORES_DATA COLLECTION
                // This bypasses Firebase Auth guest list restriction and quota issues
                try {
                    console.log('[STOREFRONT-LOOKUP] Attempting direct stores_data query for:', host);
                    
                    if (host.endsWith('.abdomedi.com')) {
                        const sub = host.split('.')[0].toLowerCase();
                        if (sub && sub !== 'www' && sub !== 'app' && sub !== 'fallback') {
                            const qSub = query(collection(firebaseDb, 'stores_data'), where('settings.subdomain', '==', sub));
                            const subSnap = await getDocs(qSub);
                            if (!subSnap.empty) {
                                foundStoreId = subSnap.docs[0].id;
                                console.log('[STOREFRONT-LOOKUP] Matched store ID via subdomain query:', foundStoreId);
                            }
                        }
                    }
                    
                    if (!foundStoreId) {
                        const qCD = query(collection(firebaseDb, 'stores_data'), where('settings.customDomain', '==', hostNoWww));
                        const cdSnap = await getDocs(qCD);
                        if (!cdSnap.empty) {
                            foundStoreId = cdSnap.docs[0].id;
                            console.log('[STOREFRONT-LOOKUP] Matched store ID via custom domain query:', foundStoreId);
                        }
                    }
                } catch (lookupErr) {
                    console.error('[STOREFRONT-LOOKUP] Error in direct stores_data lookup:', lookupErr);
                }

                // 2. FALLBACK: LOOP OVER ALL USERS (IF ACCESSIBLE / CACHED)
                if (!foundStoreId) {
                    for (const u of loadedUsers) {
                        if (!u.stores) continue;
                        const store = u.stores.find(s => {
                            const storeCustomDomain = (s.customDomain || '').toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
                            const storeSubdomain = (s.subdomain || '').toLowerCase().trim();
                            
                            // 1. Match custom domain (e.g. 3bdomedia.com or www.3bdomedia.com)
                            if (storeCustomDomain && (storeCustomDomain === hostNoWww || `www.${storeCustomDomain}` === host)) {
                                return true;
                            }
                            
                            // 2. Match free subdomain of abdomedi (e.g. mystore.abdomedi.com)
                            if (storeSubdomain && host.endsWith('.abdomedi.com')) {
                                const sub = host.split('.')[0].toLowerCase();
                                if (sub === storeSubdomain) {
                                    console.log('[DOMAIN-MATCH] Fallback matched subdomain:', sub);
                                    return true;
                                }
                            }
                            
                            return false;
                        });
                        if (store) { foundStoreId = store.id; break; }
                    }
                }
            }
            
            if (foundStoreId) {
                setIsStandaloneStorefront(true);
                setActiveStoreId(foundStoreId);
                const storeData = await db.getStoreData(foundStoreId, dbSyncMode === 'auto') as StoreData | null;
                if (storeData) {
                    const sanitizedStoreData = sanitizeData(storeData);
                    setAllStoresData(prev => ({ ...prev, [foundStoreId!]: sanitizedStoreData }));
                } else if (!isExactMainDomain || previewId) {
                    setIsStoreNotFound(true);
                }
            } else if (!isExactMainDomain) {
                // Not a main domain and no store matched by domain/subdomain
                setIsStoreNotFound(true);
            } else {
                // Normal Dashboard flow (no match found or it is the main domain)
                const savedUserPhone = localStorage.getItem('currentUserPhone');
                const savedStoreId = localStorage.getItem('lastActiveStoreId');
                const savedSessionType = localStorage.getItem('sessionType');
                
                if (loadedUsers.length > 0) {
                    let user = loadedUsers.find((u: User) => u.phone === savedUserPhone);
                    
                    if (user) {
                        setCurrentUser(user);
                        if (savedSessionType === 'employee') {
                            setIsEmployeeSession(true);
                        }
                        const storeId = savedStoreId || (user.stores && user.stores.length > 0 ? user.stores[0].id : null);
                        if (storeId) {
                            setActiveStoreId(storeId);
                            
                            const storeData = await db.getStoreData(storeId, dbSyncMode === 'auto') as StoreData | null;
                            if (storeData) {
                                const sanitizedStoreData = sanitizeData(storeData);
                                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedStoreData }));
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load initial data:", error);
        } finally {
            setAuthChecked(true);
            setIsInitialLoad(false);
        }
    };

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleDisplayModeChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
        mediaQuery.addEventListener('change', handleDisplayModeChange);
        setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);

        loadData();

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            mediaQuery.removeEventListener('change', handleDisplayModeChange);
        };
    }, []);

    const handleLogout = () => {
        setCurrentUser(null);
        setActiveStoreId(null);
        setIsEmployeeSession(false);
        localStorage.removeItem('currentUserPhone');
        localStorage.removeItem('lastActiveStoreId');
        localStorage.removeItem('sessionType');
        setWelcomeScreenShown(false);
        navigate('/owner-login');
    };

    const handleOtpVerification = async (otp: string) => {
        if (!userForOtp) return;
        setOtpError('');

        try {
            const response = await fetch('/api/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userForOtp.email, otp })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'فشل التحقق');
            }

            const data = await response.json();

            if (data.valid) {
                completeLogin(userForOtp, sessionInfoForOtp);
            } else {
                setOtpError(data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية.');
            }
        } catch (err: any) {
            console.error('Error verifying OTP:', err);
            setOtpError('حدث خطأ أثناء التحقق من الرمز. يرجى المحاولة مرة أخرى.');
        }
    };

    const handleOtpCancel = () => {
        setUserForOtp(null);
        setSessionInfoForOtp(null);
        setOtpError('');
    };
    
    const completeLogin = (user: User, sessionInfo: {isEmployee: boolean, storeId: string} | null) => {
        if (sessionInfo?.isEmployee) {
            setCurrentUser(user);
            setIsEmployeeSession(true);
            setActiveStoreId(sessionInfo.storeId);
            localStorage.setItem('currentUserPhone', user.phone);
            localStorage.setItem('lastActiveStoreId', sessionInfo.storeId);
            localStorage.setItem('sessionType', 'employee');
            navigate('/employee/dashboard');
        } else {
            setCurrentUser(user);
            setIsEmployeeSession(false);
            localStorage.setItem('currentUserPhone', user.phone);
            
            if (user.isAdmin) {
                localStorage.setItem('sessionType', 'admin');
                setActiveStoreId(null);
                localStorage.removeItem('lastActiveStoreId');
                navigate('/admin');
            } else {
                localStorage.setItem('sessionType', 'owner');
                const lastStoreId = localStorage.getItem('lastActiveStoreId');
                const firstStoreId = user.stores?.[0]?.id;
                
                if (lastStoreId && user.stores?.some(s => s.id === lastStoreId)) {
                    handleSetActiveStore(lastStoreId);
                    navigate('/');
                } else if (firstStoreId) {
                    handleSetActiveStore(firstStoreId);
                    navigate('/');
                } else {
                    setActiveStoreId(null); 
                    navigate('/create-store');
                }
            }
        }
    
        setUserForOtp(null);
        setSessionInfoForOtp(null);
        setOtpError('');
    };

    const handleSetActiveStore = async (storeId: string) => {
        setActiveStoreId(storeId);
        localStorage.setItem('lastActiveStoreId', storeId);
        setCart([]); 
        if (!allStoresData[storeId]) {
            const storeData = await db.getStoreData(storeId, dbSyncMode === 'auto') as StoreData | null;
            if (storeData) {
                const sanitizedStoreData = sanitizeData(storeData);
                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedStoreData }));
            }
        }
    };

    const handleEmployeeLogin = async ({ storeId, phone, password }: { storeId: string; phone: string; password: string }) => {
        const owner = users.find(u => u.stores?.some(s => s.id === storeId));
        if (!owner) {
            throw new Error("كود المتجر غير صحيح.");
        }

        let storeData = allStoresData[storeId];
        if (!storeData) {
            const data = await db.getStoreData(storeId, dbSyncMode === 'auto') as StoreData | null;
            if (data) {
                const sanitizedData = sanitizeData(data);
                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedData }));
                storeData = sanitizedData;
            } else {
                 throw new Error("لا يمكن تحميل بيانات المتجر.");
            }
        }
        
        const employeeRecord = storeData.settings.employees.find(e => e.id === phone);
        if (!employeeRecord) {
            throw new Error("لست موظفاً في هذا المتجر.");
        }

        if (employeeRecord.status !== 'active') {
            const statusMap: Record<string, string> = { 'invited': 'في انتظار القبول', 'pending': 'معلق' };
            const statusText = statusMap[employeeRecord.status || ''] || employeeRecord.status;
            throw new Error(`حالة حسابك هي "${statusText}". يرجى التواصل مع مدير المتجر.`);
        }

        const employeeUser = users.find(u => u.phone === phone);
        if (!employeeUser || employeeUser.password !== password) {
            throw new Error("رقم الهاتف أو كلمة المرور غير صحيحة.");
        }

        completeLogin(employeeUser, { isEmployee: true, storeId: storeId });
    };

    const handleEmployeeRegisterRequest = async (data: EmployeeRegisterRequestData) => {
        const { fullName, phone, password, storeId, email } = data;

        const owner = users.find(u => u.stores?.some(s => s.id === storeId));
        if (!owner) throw new Error("كود المتجر غير صحيح.");
        if (users.some(u => u.phone === phone)) throw new Error("رقم الهاتف هذا مسجل بالفعل.");
        if (users.some(u => u.email === email)) throw new Error("هذا البريد الإلكتروني مسجل بالفعل.");
        
        let storeData = allStoresData[storeId];
        if (!storeData) {
            const data = await db.getStoreData(storeId, dbSyncMode === 'auto') as StoreData | null;
            if (data) {
                const sanitizedData = sanitizeData(data);
                setAllStoresData(prev => ({ ...prev, [storeId]: sanitizedData }));
                storeData = sanitizedData;
            } else {
                 throw new Error("لا يمكن تحميل بيانات المتجر.");
            }
        }
        if (storeData.settings.employees.some(e => e.id === phone)) {
            throw new Error("لديك بالفعل طلب انضمام معلق أو أنت موظف في هذا المتجر.");
        }

        const newUser: User = { fullName, phone, password, email, joinDate: new Date().toISOString() };
        setUsers(prev => [...prev, newUser]);

        const newEmployee: Employee = { id: phone, name: fullName, email, permissions: [], status: 'pending' };
        
        const updatedStoreData: StoreData = {
            ...storeData,
            settings: {
                ...storeData.settings,
                employees: [...storeData.settings.employees, newEmployee]
            }
        };

        setAllStoresData(p => ({
            ...p, 
            [storeId]: updatedStoreData
        }));

        const storeInfo = owner!.stores!.find(s => s.id === storeId);
        if (storeInfo) {
            await db.saveStoreData(storeInfo, updatedStoreData);
        }
    };

    const handleStoreCreated = (newStore: Store) => {
        if (!currentUser) return;

        const newStoreData: StoreData = {
            orders: [],
            settings: {
                ...INITIAL_SETTINGS,
                subdomain: newStore.subdomain,
                isSubdomainFixed: true,
                products: oneToolzProducts, 
            },
            wallet: { balance: 0, transactions: [] },
            cart: [],
            customers: [],
        };
        
        const updatedUsers = users.map(user => {
            if (user.phone === currentUser.phone) {
                return { ...user, stores: [...(user.stores || []), newStore] };
            }
            return user;
        });

        setUsers(updatedUsers);
        setCurrentUser(prevUser => prevUser ? { ...prevUser, stores: [...(prevUser.stores || []), newStore] } : null);
        
        setAllStoresData(prevData => ({
            ...prevData,
            [newStore.id]: newStoreData
        }));
        
        handleSetActiveStore(newStore.id);
    };

    const handleManualMigration = async () => {
        const result = await db.migrateAllLegacyDataToRelational(users);
        if (!result.success && result.error) {
            alert(`فشل النقل!\nالخطأ: ${result.error}\nالملخص: ${result.summary}`);
        } else {
            alert(`اكتمل النقل!\nالملخص: ${result.summary}`);
        }
        return { success: result.success, error: result.error };
    };

    const handleImpersonate = (userToImpersonate: User) => {
        console.log(`Impersonating user: ${userToImpersonate.fullName}`);
        completeLogin(userToImpersonate, null); 
    };

    const refreshStoreData = (storeId: string): Promise<void> => {
        if (isSavingRef.current || isDirtyRef.current) {
            console.log(`[REALTIME] Ignoring refresh to prevent flicker during active save or pending changes.`);
            return Promise.resolve();
        }

        if (!storeId || storeId !== activeStoreId) {
            if (storeId !== activeStoreId) console.log(`[REALTIME] Ignoring refresh for non-active store: ${storeId}`);
            return Promise.resolve();
        }

        if (refreshDebounceTimers.current[storeId]) {
            clearTimeout(refreshDebounceTimers.current[storeId]!);
        }

        return new Promise((resolve) => {
            refreshDebounceTimers.current[storeId] = setTimeout(async () => {
                console.log(`[REALTIME] Debounced refresh executing for store: ${storeId}`);
                const storeData = await db.getStoreData(storeId, true) as StoreData | null;
                if (storeData) {
                    const sanitizedStoreData = sanitizeData(storeData);
                    
                    setAllStoresData(prev => {
                        const isIdentical = JSON.stringify(prev[storeId]) === JSON.stringify(sanitizedStoreData);
                        if (isIdentical) {
                            resolve();
                            return prev;
                        }
                        
                        isRefreshing.current = true;
                        return { ...prev, [storeId]: sanitizedStoreData };
                    });
                    console.log(`[REALTIME] Store ${storeId} data updated via debounce.`);
                }
                refreshDebounceTimers.current[storeId] = null;
                resolve();
            }, 500);
        });
    };

    const refreshGlobalData = () => {
        if (isSavingRef.current || isDirtyRef.current) {
            console.log(`[REALTIME] Ignoring global refresh to prevent flicker during active save or pending changes.`);
            return;
        }
        const key = 'global';
        if (refreshDebounceTimers.current[key]) {
            clearTimeout(refreshDebounceTimers.current[key]!);
        }
        refreshDebounceTimers.current[key] = setTimeout(async () => {
            console.log('[REALTIME] Debounced global refresh executing.');
            const globalData = await db.getGlobalData(true);
            if (globalData?.users) {
                isRefreshing.current = true;
                setUsers(globalData.users);
                setCurrentUser(prevUser => {
                    if (!prevUser) return null;
                    const updatedCurrentUser = globalData.users.find(u => u.phone === prevUser.phone);
                    return updatedCurrentUser || prevUser;
                });
                console.log('[REALTIME] Global user data updated via debounce.');
            }
            refreshDebounceTimers.current[key] = null;
        }, 1500);
    };

    useEffect(() => {
        if (dbSyncMode === 'manual') {
            console.log('[REALTIME] Manual desktop database mode active: Live cloud listeners and background intervals are paused.');
            return () => {};
        }

        if (db.isSupabaseActive()) {
            console.log('[REALTIME] Custom Supabase cloud active: Firestore live snapshots are disabled to prevent quota issues.');
            return () => {};
        }

        console.log('[REALTIME] Setting up Firestore snapshots...');
        
        // Update refs with current values
        refreshStoreDataRef.current = refreshStoreData;
        refreshGlobalDataRef.current = refreshGlobalData;
        activeStoreRef.current = activeStore;
        allStoresDataRef.current = allStoresData;
        
        const unsubscribers: (() => void)[] = [];

        if (activeStoreId) {
            // Listen for changes on store configuration
            const unsubStore = onSnapshot(doc(firebaseDb, 'stores_data', activeStoreId), (snap) => {
                if (snap.exists() && !isSavingRef.current && !isDirtyRef.current && !snap.metadata.hasPendingWrites) {
                    const snapData = snap.data() as any;
                    console.log('[REALTIME] Store settings change detected via Firestore snapshot');
                    isRefreshing.current = true;
                    setAllStoresData(prev => {
                        const store = prev[activeStoreId];
                        if (!store) return prev;
                        // Only update name and settings from the store document
                        return {
                            ...prev,
                            [activeStoreId]: {
                                ...store,
                                name: snapData.name || store.name,
                                settings: {
                                    ...store.settings,
                                    ...(snapData.settings || {})
                                }
                            }
                        };
                    });
                }
            });
            unsubscribers.push(unsubStore);

            // Listen for changes on orders
            const qOrders = query(collection(firebaseDb, 'orders'), where('storeId', '==', activeStoreId));
            const unsubOrders = onSnapshot(qOrders, (snap) => {
                if (!isSavingRef.current && !isDirtyRef.current && !snap.metadata.hasPendingWrites) {
                    console.log('[REALTIME] Orders change detected via Firestore snapshot');
                    isRefreshing.current = true;
                    const newOrders = snap.docs.map(doc => ({ 
                        id: doc.id.startsWith(activeStoreId + '_') ? doc.id.substring(activeStoreId.length + 1) : doc.id, 
                        ...doc.data() 
                    } as Order));
                    setAllStoresData(prev => {
                        const store = prev[activeStoreId];
                        if (!store) return prev;
                        return {
                            ...prev,
                            [activeStoreId]: { ...store, orders: newOrders }
                        };
                    });
                }
            });
            unsubscribers.push(unsubOrders);

            // Listen for changes on products
            const qProducts = query(collection(firebaseDb, 'products'), where('storeId', '==', activeStoreId));
            const unsubProducts = onSnapshot(qProducts, (snap) => {
                if (!isSavingRef.current && !isDirtyRef.current && !snap.metadata.hasPendingWrites) {
                    console.log('[REALTIME] Products change detected via Firestore snapshot');
                    isRefreshing.current = true;
                    const newProducts = snap.docs.map(doc => ({ 
                        id: doc.id.startsWith(activeStoreId + '_') ? doc.id.substring(activeStoreId.length + 1) : doc.id, 
                        ...doc.data() 
                    } as Product));
                    setAllStoresData(prev => {
                        const store = prev[activeStoreId];
                        if (!store) return prev;
                        return {
                            ...prev,
                            [activeStoreId]: { 
                                ...store, 
                                settings: { ...store.settings, products: newProducts } 
                            }
                        };
                    });
                }
            });
            unsubscribers.push(unsubProducts);

            // Listen for changes on employees
            const qEmployees = query(collection(firebaseDb, 'employees'), where('storeId', '==', activeStoreId));
            const unsubEmployees = onSnapshot(qEmployees, (snap) => {
                if (!isSavingRef.current && !isDirtyRef.current && !snap.metadata.hasPendingWrites) {
                    console.log('[REALTIME] Employees change detected via Firestore snapshot');
                    isRefreshing.current = true;
                    const newEmployees = snap.docs.map(doc => ({ 
                        ...doc.data(),
                        phone: doc.id.split('_').pop() // doc.id is storeId_phone
                    } as any));
                    setAllStoresData(prev => {
                        const store = prev[activeStoreId];
                        if (!store) return prev;
                        return {
                            ...prev,
                            [activeStoreId]: { 
                                ...store, 
                                settings: { ...store.settings, employees: newEmployees } 
                            }
                        };
                    });
                }
            });
            unsubscribers.push(unsubEmployees);
        }

        // Listen for user collections change
        const unsubUsers = onSnapshot(collection(firebaseDb, 'users'), (snap) => {
            if (!isSavingRef.current && !isDirtyRef.current && !snap.metadata.hasPendingWrites) {
                console.log('[REALTIME] Users collection change detected via Firestore snapshot');
                isRefreshing.current = true;
                const updatedUsers = snap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        fullName: data.fullName || '',
                        phone: doc.id,
                        password: data.password || '',
                        email: data.email || '',
                        stores: data.stores || [],
                        sites: data.sites || [],
                        isAdmin: data.isAdmin || false,
                        isBanned: data.isBanned || false,
                        joinDate: data.joinDate || ''
                    } as User;
                });
                setUsers(updatedUsers);
            }
        });
        unsubscribers.push(unsubUsers);

        // No redundant polling - onSnapshot handles real-time updates efficiently.
        // Background Auto-Sync for Platforms (Wuilt, etc.)
        const autoSyncInterval = setInterval(async () => {
            if (activeStoreId && !isSavingRef.current && activeStoreRef.current) {
                const connectedPlatforms = allStoresDataRef.current[activeStoreId]?.settings?.connectedPlatforms || [];
                const platformConfigs = (allStoresDataRef.current[activeStoreId]?.settings as any)?.platformConfigs || {};

                for (const platformId of connectedPlatforms) {
                    const config = platformConfigs[platformId];
                    if (config?.isActive) {
                        console.log(`[AUTO-SYNC] Triggering background sync for ${platformId}...`);
                        try {
                            isRefreshing.current = true;
                            
                            const response = await fetch(`/api/sync/platform/${platformId}/${activeStoreId}?type=orders`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            
                            if (response.ok) {
                                console.log(`[AUTO-SYNC] Successfully synced orders for ${platformId}`);
                                await refreshStoreDataRef.current(activeStoreId);
                            } else {
                                isRefreshing.current = false;
                            }
                        } catch (err) {
                            console.error(`[AUTO-SYNC] Failed to sync ${platformId}:`, err);
                            isRefreshing.current = false;
                        }
                    }
                }
            }
        }, 120000); // Every 2 minutes

        return () => {
            console.log('[REALTIME] Unsubscribing Firestore listeners and background intervals.');
            unsubscribers.forEach(unsub => unsub());
            clearInterval(autoSyncInterval);
        };
    }, [activeStoreId, dbSyncMode]); 

    if (!authChecked) {
        return <GlobalLoader />;
    }

    if (userForOtp) {
        return <OtpVerificationPage 
            user={userForOtp} 
            onVerifyAttempt={handleOtpVerification}
            onCancel={handleOtpCancel}
            error={otpError}
        />;
    }
    
    const forceSync = async () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        setSaveStatus('saving');
        setSaveMessage('جاري الحفظ والمزامنة...');
        try {
            isSavingRef.current = true;
            
            // 1. Sync custom domains up to users
            let updatedUsers = [...users];
            if (activeStoreId && allStoresData[activeStoreId]) {
                const storeSettings = allStoresData[activeStoreId].settings;
                updatedUsers = updatedUsers.map(user => {
                    if (user.stores) {
                        return {
                            ...user,
                            stores: user.stores.map(store => {
                                if (store.id === activeStoreId) {
                                    return {
                                        ...store,
                                        customDomain: storeSettings.customDomain,
                                        subdomain: storeSettings.subdomain
                                    };
                                }
                                return store;
                            })
                        }
                    }
                    return user;
                });
                
                // Update users state if it's different
                if (JSON.stringify(users) !== JSON.stringify(updatedUsers)) {
                    setUsers(updatedUsers);
                }
            }
            
            // 2. Local backup (Instant)
            await db.saveLocal('global', { users: updatedUsers, loyaltyData: {} });
            if (activeStoreId && allStoresData[activeStoreId]) {
                await db.saveLocal(activeStoreId, allStoresData[activeStoreId]);
            }

            // 3. Cloud sync (Parallel with Timeout)
            const syncPromises = [];
            syncPromises.push(db.saveGlobalData({ users: updatedUsers, loyaltyData: {} }));
            if (activeStoreId && allStoresData[activeStoreId] && activeStore) {
                // Must pass updated version of store!
                const updatedStore = updatedUsers.find(u => u.stores?.some(s => s.id === activeStoreId))?.stores?.find(s => s.id === activeStoreId) || activeStore;
                syncPromises.push(db.saveStoreData(updatedStore, allStoresData[activeStoreId]));
            }

            const results = await Promise.all(syncPromises);
            const failed = results.find(r => !r.success);
            
            if (failed) {
                console.warn('[MANUAL-SYNC] Cloud failed, but data saved locally:', failed.error);
                setSaveStatus('local_saved');
                setSaveMessage('تم الحفظ محلياً (فشل المزامنة السحابية)');
                return;
            }

            setSaveStatus('success');
            setSaveMessage('تم الحفظ والمزامنة بنجاح!');
            setTimeout(() => setSaveStatus(prev => prev === 'success' ? 'idle' : prev), 3000);
        } catch (e: any) {
            console.error('[MANUAL-SAVE] Save failed:', e);
            // Even if everything fails, we likely have it in fastLocalSave already, 
            // but let's at least show local_saved if we think we got it.
            setSaveStatus('local_saved');
            setSaveMessage('محفوظ على هذا الجهاز (خطأ سحابي)');
        } finally {
            isSavingRef.current = false;
        }
    };

    const forcePullFromCloud = async () => {
        if (!activeStoreId || !activeStore) {
            return { success: false, error: 'لم يتم اختيار متجر نشط' };
        }
        setSaveStatus('saving');
        setSaveMessage('جاري سحب البيانات كلياً من السحاب للمحلي...');
        try {
            isSavingRef.current = true;
            // Force pull remote data directly from Firestore bypassing local cache
            const remoteData = await db.getStoreData(activeStoreId, true);
            if (remoteData) {
                setAllStoresData(prev => ({
                    ...prev,
                    [activeStoreId]: remoteData
                }));
                // Save immediately to IndexedDB
                await db.saveLocal(activeStoreId, remoteData);
                
                setSaveStatus('success');
                setSaveMessage('تم سحب وتزامن البيانات المحلية بنجاح!');
                setTimeout(() => setSaveStatus('idle'), 3000);
                return { success: true };
            } else {
                throw new Error('فشل استيراد البيانات: لم يتم العثور على أي سجلات في السحابة لهذا المتجر');
            }
        } catch (e: any) {
            console.error('[CLOUD-PULL] cloud pull failed:', e);
            setSaveStatus('error');
            setSaveMessage('فشل سحب البيانات: ' + (e.message || String(e)));
            setTimeout(() => setSaveStatus('idle'), 4000);
            return { success: false, error: e.message || String(e) };
        } finally {
            isSavingRef.current = false;
        }
    };

    const pageProps = {
        users, setUsers, allStoresData, setAllStoresData, currentUser, activeStore, activeStoreId,
        orders: activeStoreId ? allStoresData[activeStoreId]?.orders || [] : [],
        products: activeStoreId ? allStoresData[activeStoreId]?.settings?.products || [] : [],
        settings: activeStoreId ? allStoresData[activeStoreId]?.settings || INITIAL_SETTINGS : INITIAL_SETTINGS,
        wallet: activeStoreId ? allStoresData[activeStoreId]?.wallet || { balance: 0, transactions: [] } : { balance: 0, transactions: [] },
        treasury: activeStoreId ? allStoresData[activeStoreId]?.treasury || { accounts: [{ id: '1', name: 'الخزينة الرئيسية', type: 'safe', balance: 0, currency: 'EGP' }, { id: '2', name: 'فودافون كاش', type: 'wallet', balance: 0, currency: 'EGP' }, { id: '3', name: 'الحساب البنكي', type: 'bank', balance: 0, currency: 'EGP' }], transactions: [] } : undefined,
        cart,
        forceSync,
        forcePullFromCloud,
        dbSyncMode,
        setDbSyncMode,
        saveStatus,
        saveMessage,
        onRefresh: async () => { if (activeStoreId) await refreshStoreData(activeStoreId); },
        customers: activeStoreId ? allStoresData[activeStoreId]?.customers || [] : [],
        setCustomers: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const currentCustomers = p[activeStoreId]?.customers || [];
                    const newCustomers = typeof updater === 'function' ? updater(currentCustomers) : updater;
                    
                    if (currentCustomers === newCustomers) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            customers: newCustomers
                        }
                    };
                });
            }
        },
        setOrders: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const currentOrders = p[activeStoreId]?.orders || [];
                    const newOrders = typeof updater === 'function' ? updater(currentOrders) : updater;
                    
                    if (currentOrders === newOrders) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            orders: newOrders
                        }
                    };
                });
            }
        },
        setSettings: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const currentSettings = p[activeStoreId]?.settings || INITIAL_SETTINGS;
                    const newSettings = typeof updater === 'function' ? updater(currentSettings) : updater;
                    
                    if (currentSettings === newSettings) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            settings: newSettings
                        }
                    };
                });
            }
        },
        setWallet: (updater: any) => {
             if(activeStoreId) {
                setAllStoresData(p => {
                    const currentWallet = p[activeStoreId]?.wallet || { balance: 0, transactions: [] };
                    const newWallet = typeof updater === 'function' ? updater(currentWallet) : updater;
                    
                    if (currentWallet === newWallet) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            wallet: newWallet
                        }
                    };
                });
            }
        },
        setTreasury: (updater: any) => {
             if(activeStoreId) {
                setAllStoresData(p => {
                    const currentTreasury = p[activeStoreId]?.treasury || { accounts: [{ id: '1', name: 'الخزينة الرئيسية', type: 'safe', balance: 0, currency: 'EGP' }, { id: '2', name: 'فودافون كاش', type: 'wallet', balance: 0, currency: 'EGP' }, { id: '3', name: 'الحساب البنكي', type: 'bank', balance: 0, currency: 'EGP' }], transactions: [] };
                    const newTreasury = typeof updater === 'function' ? updater(currentTreasury) : updater;
                    
                    if (currentTreasury === newTreasury) return p;

                    return {
                        ...p,
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            treasury: newTreasury
                        }
                    };
                });
            }
        },
        setCart: (updater: any) => {
            if(activeStoreId) {
                setAllStoresData(p => {
                    const currentCart = p[activeStoreId]?.cart || [];
                    const newCart = typeof updater === 'function' ? updater(currentCart) : updater;
                    
                    if (currentCart === newCart) return p;

                    return {
                        ...p, 
                        [activeStoreId]: {
                            ...(p[activeStoreId] || { orders: [], settings: INITIAL_SETTINGS, wallet: { balance: 0, transactions: [] }, cart: [], customers: [] }),
                            cart: newCart
                        }
                    };
                });
            }
        },
    };

    const getNextOrderNumber = (orders: Order[]) => {
        const nums = orders
            .map(o => {
                const match = o.orderNumber.match(/\d+/);
                return match ? parseInt(match[0]) : null;
            })
            .filter((n): n is number => n !== null);
        return nums.length > 0 ? Math.max(...nums) + 1 : 1;
    };

    const handlePlaceOrder = (orderData: any) => {
        if (!activeStoreId) return '123';
        const nextNum = getNextOrderNumber(pageProps.orders);
        const newOrder: Order = {
            id: `order-${Date.now()}`,
            orderNumber: `${nextNum}`,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            customerAddress: orderData.customerAddress,
            shippingCompany: orderData.shippingCompany,
            shippingArea: orderData.shippingArea,
            shippingFee: orderData.shippingFee,
            notes: orderData.notes,
            status: 'في_انتظار_المكالمة',
            date: new Date().toISOString(),
            items: pageProps.cart.map((item: any) => ({
                productId: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                cost: item.cost || 0,
                weight: item.weight || 0,
            })),
            productPrice: (pageProps.cart || []).reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0),
            productCost: (pageProps.cart || []).reduce((sum: number, item: any) => sum + ((item.cost || 0) * (item.quantity || 1)), 0),
            weight: (pageProps.cart || []).reduce((sum: number, item: any) => sum + ((item.weight || 0) * (item.quantity || 1)), 0),
            discount: orderData.discount || 0,
            orderType: 'standard',
            paymentMethod: orderData.paymentMethod || 'cash_on_delivery',
            productName: pageProps.cart.map((i: any) => i.name).join(', '),
            includeInspectionFee: false,
            isInsured: false,
            paymentStatus: 'بانتظار الدفع',
            preparationStatus: 'بانتظار التجهيز',
        };
        
        pageProps.setOrders((prev: Order[]) => [newOrder, ...prev]);
        pageProps.setCart([]); // Clear cart
        triggerWebhooks(newOrder, pageProps.settings);
        return newOrder.id;
    };

    const handleAddToCart = (product: any) => {
        pageProps.setCart((prev: any[]) => {
            const existing = prev.find(item => (item.productId || item.id) === product.id);
            if (existing) {
                return prev.map(item => (item.productId || item.id) === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            const newItem: OrderItem = {
                productId: product.id,
                name: product.name,
                price: product.price,
                cost: product.costPrice || 0,
                weight: product.weight || 0,
                thumbnail: product.thumbnail,
                quantity: 1
            };
            return [...prev, newItem];
        });
    };

    const handleUpdateCartQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) {
            handleRemoveFromCart(productId);
            return;
        }
        pageProps.setCart((prev: any[]) => prev.map(item => (item.productId || item.id) === productId ? { ...item, quantity } : item));
    };

    const handleRemoveFromCart = (productId: string) => {
        pageProps.setCart((prev: any[]) => prev.filter(item => (item.productId || item.id) !== productId));
    };

    if (isStoreNotFound) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-800" dir="rtl">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold">404</h1>
                    <p className="text-lg">هذا المتجر غير موجود أو غير مفعل.</p>
                </div>
            </div>
        );
    }

    if (isStandaloneStorefront) {
        if (!activeStoreId || isInitialLoad) return <WelcomeLoader userName="" />;
        
        return (
            <Routes>
                <Route path="/" element={<StorefrontPage {...pageProps} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onRemoveFromCart={handleRemoveFromCart} />} />
                <Route path="/store" element={<StorefrontPage {...pageProps} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onRemoveFromCart={handleRemoveFromCart} />} />
                <Route path="/cart" element={<StorefrontPage {...pageProps} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onRemoveFromCart={handleRemoveFromCart} />} />
                <Route path="/checkout" element={<CheckoutPage {...pageProps} onPlaceOrder={handlePlaceOrder} />} />
                <Route path="/order-success/:orderId" element={<OrderSuccessPage {...pageProps} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    return (
        <>
            <Routes>
                <Route path="/owner-login" element={<SignUpPage onPasswordSuccess={(user) => completeLogin(user, null)} users={users} setUsers={setUsers} />} />
                <Route path="/employee-login" element={<EmployeeLoginPage allStoresData={allStoresData} users={users} onLoginAttempt={handleEmployeeLogin} onRegisterRequest={handleEmployeeRegisterRequest} />} />
                <Route path="/track-order" element={<OrderTrackingPage orders={pageProps.orders} />} />
                
                <Route path="/admin" element={<AdminLayout currentUser={currentUser} handleLogout={handleLogout} theme={theme} setTheme={setTheme} />}>
                    <Route index element={<AdminPage {...pageProps} onImpersonate={handleImpersonate} currentUser={currentUser as User} />} />
                    <Route path="manage-stores" element={<ManageSitesPage ownedStores={currentUser?.stores || []} collaboratingStores={[]} setActiveStoreId={handleSetActiveStore} {...pageProps} />} />
                    <Route path="account-settings" element={<AccountSettingsPage currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} setUsers={setUsers} />} />
                </Route>

                <Route path="/employee" element={
                    <EmployeeLayoutWrapper 
                        currentUser={currentUser} onLogout={handleLogout}
                        storeOwner={users.find(u => u.stores?.some(s => s.id === activeStoreId))}
                        activeStoreId={activeStoreId}
                        theme={theme} setTheme={setTheme}
                        allStoresData={allStoresData} users={users}
                        handleSetActiveStore={handleSetActiveStore}
                        installPrompt={installPrompt} onInstall={() => installPrompt?.prompt()}
                        isStandalone={isStandalone} isIos={isIos}
                    >
                        <Outlet/>
                    </EmployeeLayoutWrapper>
                }>
                    <Route index element={<EmployeeDashboardPage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} />} />
                    <Route path="dashboard" element={<EmployeeDashboardPage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} />} />
                    <Route path="confirmation-queue" element={<ConfirmationQueuePage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} activeStore={pageProps.activeStore} onRefresh={() => pageProps.activeStore?.id && refreshStoreData(pageProps.activeStore.id)} forceSync={pageProps.forceSync} />} />
                    <Route path="my-activity" element={<EmployeeActivityPage currentUser={currentUser} orders={pageProps.orders} />} />
                    <Route path="account-settings" element={<EmployeeAccountSettingsPage currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} setUsers={setUsers} />} />
                </Route>

                <Route path="/" element={
                    <OwnerLayoutWrapper
                        currentUser={currentUser}
                        isEmployeeSession={isEmployeeSession}
                        welcomeScreenShown={welcomeScreenShown}
                        setWelcomeScreenShown={setWelcomeScreenShown}
                        handleLogout={handleLogout}
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        activeStore={activeStore}
                        activeStoreId={activeStoreId}
                        handleSetActiveStore={handleSetActiveStore}
                        settings={pageProps.settings}
                        orders={pageProps.orders}
                        theme={theme}
                        setTheme={setTheme}
                        dbSyncMode={dbSyncMode}
                        setDbSyncMode={setDbSyncMode}
                        forceSync={forceSync}
                        forcePullFromCloud={forcePullFromCloud}
                        saveStatus={saveStatus}
                        saveMessage={saveMessage}
                        unsavedChanges={getUnsavedChanges()}
                    />
                }>
                    <Route index element={<Navigate to={`/store/${activeStoreId || (currentUser?.stores && currentUser.stores.length > 0 ? currentUser.stores[0].id : '')}/dashboard`} replace />} />
                    <Route path="manage-stores" element={<ManageSitesPage ownedStores={currentUser?.stores || []} collaboratingStores={[]} setActiveStoreId={handleSetActiveStore} {...pageProps} />} />
                    <Route path="create-store" element={<CreateStorePage currentUser={currentUser} onStoreCreated={handleStoreCreated} />} />
                    <Route path="account-settings" element={<AccountSettingsPage currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} setUsers={setUsers} />} />
                </Route>

                <Route path="/store/:storeId" element={
                    <OwnerLayoutWrapper
                        currentUser={currentUser}
                        isEmployeeSession={isEmployeeSession}
                        welcomeScreenShown={welcomeScreenShown}
                        setWelcomeScreenShown={setWelcomeScreenShown}
                        handleLogout={handleLogout}
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        activeStore={activeStore}
                        activeStoreId={activeStoreId}
                        handleSetActiveStore={handleSetActiveStore}
                        settings={pageProps.settings}
                        orders={pageProps.orders}
                        theme={theme}
                        setTheme={setTheme}
                        dbSyncMode={dbSyncMode}
                        setDbSyncMode={setDbSyncMode}
                        forceSync={forceSync}
                        forcePullFromCloud={forcePullFromCloud}
                        saveStatus={saveStatus}
                        saveMessage={saveMessage}
                        unsavedChanges={getUnsavedChanges()}
                    />
                }>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard {...pageProps} />} />
                    <Route path="maintenance" element={<MaintenancePage currentStoreId={activeStoreId!} settings={pageProps.settings} />} />
                    <Route path="confirmation-queue" element={<ConfirmationQueuePage currentUser={currentUser} orders={pageProps.orders} setOrders={pageProps.setOrders} settings={pageProps.settings} activeStore={pageProps.activeStore} onRefresh={() => pageProps.activeStore?.id && refreshStoreData(pageProps.activeStore.id)} forceSync={pageProps.forceSync} />} />
                    <Route path="orders" element={<OrdersList {...pageProps} currentUser={currentUser} addLoyaltyPointsForOrder={() => {}} />} />
                    <Route path="returns" element={<OrderReturnsPage settings={pageProps.settings} updateSettings={pageProps.setSettings} orders={pageProps.orders} updateStoreData={(data) => setAllStoresData(p => ({ ...p, [activeStoreId!]: { ...p[activeStoreId!], ...data } }))} currentUser={currentUser} />} />
                    <Route path="pos" element={<POSPage settings={pageProps.settings} updateSettings={pageProps.setSettings} orders={pageProps.orders} wallet={pageProps.wallet} updateStoreData={(data) => setAllStoresData(p => ({ ...p, [activeStoreId!]: { ...p[activeStoreId!], ...data } }))} currentUser={currentUser} activeStore={pageProps.activeStore} customers={pageProps.customers} />} />
                    <Route path="cash-management" element={<CashManagement settings={pageProps.settings} updateSettings={pageProps.setSettings} currentUser={currentUser} treasury={pageProps.treasury} setTreasury={pageProps.setTreasury} wallet={pageProps.wallet} setWallet={pageProps.setWallet} />} />
                    <Route path="purchase-returns" element={<PurchaseReturnsPage settings={pageProps.settings} updateSettings={pageProps.setSettings} currentUser={currentUser} />} />
                    <Route path="orders/new" element={<CreateOrderPage {...pageProps} />} />
                    <Route path="orders/edit/:id" element={<EditOrderPage {...pageProps} />} />
                    <Route path="create-order" element={<Navigate to="../orders/new" replace />} />
                    <Route path="products" element={<ProductsPage {...pageProps} orders={pageProps.orders} />} />
                    <Route path="inventory-transfers" element={<InventoryTransfers settings={pageProps.settings} updateSettings={pageProps.setSettings} currentUser={currentUser} />} />
                    <Route path="customers" element={
                      <CustomersPage 
                        orders={pageProps.orders} 
                        loyaltyData={{}} 
                        customers={pageProps.customers}
                        onUpdateCustomer={(phone, updates) => {
                          pageProps.setCustomers((prev: CustomerProfile[]) => {
                            // Check if customer exists in current list
                            const exists = prev.some(c => c.phone === phone);
                            if (exists) {
                              return prev.map(c => c.phone === phone ? { ...c, ...updates } : c);
                            } else {
                              // If they don't exist yet (dynamically created in view), add them explicitly
                              const customerFromOrders = pageProps.customers.find((c: any) => c.phone === phone);
                              return [...prev, { ...customerFromOrders, ...updates, phone, id: phone }];
                            }
                          });
                        }}
                      />
                    } />
                    <Route path="wallet" element={<WalletPage {...pageProps} />} />
                    <Route path="settings" element={<SettingsPage {...pageProps} onManualSave={currentUser?.isAdmin ? handleManualMigration : undefined} />} />
                    <Route path="customize-store" element={<StoreCustomizationPage {...pageProps} initialSection="colors" />} />
                    <Route path="shipping" element={<ShippingPage {...pageProps} />} />
                    <Route path="abandoned-carts" element={<AbandonedCartsPage {...pageProps} />} />
                    <Route path="discounts" element={<DiscountsPage {...pageProps} />} />
                    <Route path="reviews" element={<ReviewsPage {...pageProps} />} />
                    <Route path="collections" element={<CollectionsPage {...pageProps} />} />
                    <Route path="product-options" element={<ProductOptionsPage {...pageProps} />} />
                    <Route path="expenses" element={<ExpensesPage {...pageProps} settings={pageProps.settings} updateSettings={pageProps.setSettings} treasury={pageProps.treasury} setTreasury={pageProps.setTreasury} />} />
                    <Route path="marketing" element={<MarketingPage {...pageProps} />} />
                    <Route path="ai-assistant" element={<ChatBot {...pageProps} />} />
                    <Route path="reports" element={<AnalyticsPage {...pageProps} />} />
                    <Route path="standard-reports" element={<ReportsPage {...pageProps} />} />
                    <Route path="collections-report" element={<CollectionsReportPage {...pageProps} />} />
                    <Route path="activity-logs" element={<ActivityLogsPage logs={pageProps.settings.activityLogs || []} />} />
                    <Route path="suppliers" element={<SuppliersPage {...pageProps} orders={pageProps.orders} />} />
                    <Route path="partners" element={<PartnersPage settings={pageProps.settings} updateSettings={pageProps.setSettings} wallet={pageProps.wallet} setWallet={pageProps.setWallet} orders={pageProps.orders} treasury={pageProps.treasury} setTreasury={pageProps.setTreasury} />} />
                    <Route path="partners/:partnerId" element={<PartnerProfilePage settings={pageProps.settings} updateSettings={pageProps.setSettings} wallet={pageProps.wallet} setWallet={pageProps.setWallet} orders={pageProps.orders} treasury={pageProps.treasury} setTreasury={pageProps.setTreasury} />} />
                    <Route path="pages" element={<PagesManager {...pageProps} />} />
                    <Route path="settings/payment" element={<PaymentSettingsPage {...pageProps} />} />
                    <Route path="settings/employees" element={<EmployeesPage {...pageProps} activeStoreId={activeStoreId} />} />
                    <Route path="team-chat" element={<TeamChatPage {...pageProps} activeStoreId={activeStoreId} />} />
                    <Route path="whatsapp" element={<WhatsAppPage {...pageProps} />} />
                    <Route path="treasury" element={<TreasuryPage settings={pageProps.settings} treasury={pageProps.treasury} setTreasury={pageProps.setTreasury} wallet={pageProps.wallet} setWallet={pageProps.setWallet} />} />
                    
                    {/* Coming Soon Routes */}
                    <Route path="product-attributes" element={<ComingSoonPage />} />
                    <Route path="withdrawals" element={<ComingSoonPage />} />
                    <Route path="design-templates" element={<StoreCustomizationPage {...pageProps} initialSection="templates" />} />
                    <Route path="domain" element={<DomainSettingsPage activeStoreId={activeStoreId} storeData={allStoresData[activeStoreId] || null} settings={pageProps.settings} setSettings={pageProps.setSettings} users={users} />} />
                    <Route path="legal-pages" element={<ComingSoonPage />} />
                    <Route path="apps" element={<AppsPage storeId={activeStoreId} storeData={allStoresData[activeStoreId] || null} onUpdateSettings={pageProps.setSettings} onUpdateOrders={pageProps.setOrders} onRefresh={pageProps.onRefresh} hostUrl={pageProps.settings.customAppDomain || window.location.origin} />} />
                    <Route path="settings/tax" element={<ComingSoonPage />} />
                    <Route path="settings/developer" element={
                        <DeveloperSettingsPage 
                            settings={pageProps.settings} 
                            setSettings={pageProps.setSettings} 
                            activeStoreId={activeStoreId} 
                            activeStore={activeStore}
                            hostUrl={pageProps.settings.customAppDomain || window.location.origin}
                            dbSyncMode={dbSyncMode}
                            setDbSyncMode={setDbSyncMode}
                            forcePullFromCloud={pageProps.forcePullFromCloud}
                            forceSync={pageProps.forceSync}
                            saveStatus={saveStatus}
                            saveMessage={saveMessage}
                        />
                    } />
                </Route>

                <Route path="store" element={<StorefrontPage {...pageProps} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onRemoveFromCart={handleRemoveFromCart} />} />
                <Route path="checkout" element={<CheckoutPage {...pageProps} onPlaceOrder={handlePlaceOrder} />} />
                <Route path="order-success/:orderId" element={<OrderSuccessPage {...pageProps} />} />
                <Route path="*" element={<CatchAllRedirect currentUser={currentUser} isEmployeeSession={isEmployeeSession} activeStoreId={activeStoreId} />} />
            </Routes>
            {showCongratsModal && (
                <CongratsModal 
                    isOpen={showCongratsModal}
                    onClose={() => setShowCongratsModal(false)}
                    title="تهانينا!"
                    message="تم تفعيل المتجر الخاص بك بنجاح. يمكنك الآن البدء في استقبال الطلبات وإدارة منتجاتك بسهولة."
                />
            )}
            <UniversalInstallPrompt 
                installPrompt={installPrompt} 
                onInstall={() => installPrompt?.prompt()} 
                isStandalone={isStandalone} 
                isIos={isIos} 
            />
            {currentUser && !isStandaloneStorefront && (
                <SmartUpdatesWidget isAdminView={true} primaryColor="#6366f1" />
            )}
        </>
    );
};

export const AppWrapper = () => (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AppComponent />
    </BrowserRouter>
);

export default AppWrapper;

