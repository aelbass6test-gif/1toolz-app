import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { User, Store, StoreData } from '../types';
import { getRoleName } from '../utils/roles';
import { Wind, LogOut, Settings, User as UserIcon, Sun, Moon, Monitor, Replace, ChevronDown, Check, LayoutDashboard, PhoneForwarded, Download, MessageSquare, History } from 'lucide-react';
import FloatingChat, { FloatingChatHandles } from './FloatingChat';
import IosInstallPrompt from './IosInstallPrompt';
import { db } from '../services/firebaseClient';
import { doc, setDoc, deleteDoc, onSnapshot, collection, query, where } from 'firebase/firestore';

interface EmployeeLayoutProps {
    currentUser: User | null;
    onLogout: () => void;
    children: React.ReactNode;
    storeOwner: User | null;
    activeStoreId: string | null;
    theme: string;
    setTheme: (theme: string) => void;
    allStoresData: Record<string, StoreData>;
    users: User[];
    handleSetActiveStore: (storeId: string) => void;
    installPrompt: any;
    onInstall: () => void;
    isStandalone: boolean;
    isIos: boolean;
}

import { isSupabaseActive } from '../services/databaseService';

const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ currentUser, onLogout, children, storeOwner, activeStoreId, theme, setTheme, allStoresData, users, handleSetActiveStore, installPrompt, onInstall, isStandalone, isIos }) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
    const [showIosInstallModal, setShowIosInstallModal] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<Record<string, { lastSeen: number }>>({});
    const userMenuRef = useRef<HTMLDivElement>(null);
    const storeMenuRef = useRef<HTMLDivElement>(null);
    const chatRef = useRef<FloatingChatHandles>(null);

    useEffect(() => {
        if (!currentUser || !activeStoreId || isSupabaseActive()) return;

        const presenceDocRef = doc(db, 'presence', `${activeStoreId}_${currentUser.phone}`);

        const updateStatus = async () => {
            try {
                await setDoc(presenceDocRef, {
                    userId: currentUser.phone,
                    storeId: activeStoreId,
                    lastSeen: Date.now()
                }, { merge: true });
            } catch (err) {
                console.warn('Failed to update presence status:', err);
            }
        };

        updateStatus();
        const interval = setInterval(updateStatus, 300000); // update every 5 mins

        // Listen for all active presences in this store
        const q = query(collection(db, 'presence'), where('storeId', '==', activeStoreId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersMap: Record<string, { lastSeen: number }> = {};
            const now = Date.now();
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                // Filter out statuses stale for more than 400 seconds (offline threshold)
                if (data.lastSeen && (now - data.lastSeen) < 400000) {
                    usersMap[data.userId] = { lastSeen: data.lastSeen };
                }
            });
            setOnlineUsers(usersMap);
        }, (error) => {
            console.error('Error listening to presence snapshot:', error);
        });

        return () => {
            clearInterval(interval);
            unsubscribe();
            // clean up presence
            deleteDoc(presenceDocRef).catch(err => console.warn('Clean presence doc failed:', err));
        };
    }, [currentUser, activeStoreId]);

    const employeeStores = useMemo(() => {
        if (!currentUser) return [];
        const stores: Store[] = [];
        for (const storeId in allStoresData) {
            const storeData = allStoresData[storeId];
            if (storeData.settings.employees.some(e => e.id === currentUser.phone && (e.status === 'active' || !e.status))) {
                const owner = users.find(u => u.stores?.some(s => s.id === storeId));
                const storeInfo = owner?.stores?.find(s => s.id === storeId);
                if (storeInfo) {
                    stores.push(storeInfo);
                }
            }
        }
        return stores;
    }, [allStoresData, currentUser, users]);

    const currentStoreName = useMemo(() => {
        return employeeStores.find(s => s.id === activeStoreId)?.name || '...';
    }, [employeeStores, activeStoreId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
            if (storeMenuRef.current && !storeMenuRef.current.contains(event.target as Node)) {
                setIsStoreMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getUserInitials = (name: string) => {
        const names = name.split(' ');
        return names.length > 1 && names[names.length - 1]
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();
    };

    const NavItem: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => (
        <NavLink 
            to={to}
            className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
            {icon}
            <span className="hidden md:inline">{label}</span>
        </NavLink>
    );

    return (
        <div className="flex flex-col h-screen">
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 h-20 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-2 md:gap-4">
                    <Link to="/employee/dashboard" className="flex items-center gap-2">
                        <Wind className="w-8 h-8 text-pink-500" />
                        <span className="font-black text-2xl text-slate-800 dark:text-white hidden md:inline">wuilt</span>
                    </Link>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                    <nav className="flex items-center gap-1">
                        <NavItem to="/employee/dashboard" icon={<LayoutDashboard size={18}/>} label="الرئيسية" />
                        <NavItem to="/employee/confirmation-queue" icon={<PhoneForwarded size={18}/>} label="تأكيد الطلبات" />
                        <NavItem to="/employee/my-activity" icon={<History size={18}/>} label="سجل طلباتي" />
                    </nav>

                    {employeeStores.length > 1 && (
                         <div className="relative" ref={storeMenuRef}>
                            <button onClick={() => setIsStoreMenuOpen(p => !p)} className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                                <Replace size={16} />
                                <span className="hidden md:inline max-w-[120px] truncate">{currentStoreName}</span>
                                <ChevronDown size={16} className={`transition-transform ${isStoreMenuOpen && 'rotate-180'}`}/>
                            </button>
                            {isStoreMenuOpen && (
                                <div className="absolute left-0 top-12 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 p-2 z-50">
                                   {employeeStores.map(store => (
                                       <button 
                                            key={store.id} 
                                            onClick={() => { handleSetActiveStore(store.id); setIsStoreMenuOpen(false); }}
                                            className="w-full text-right flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-sm"
                                        >
                                           <span className={store.id === activeStoreId ? 'text-indigo-600' : 'text-slate-700 dark:text-slate-300'}>{store.name}</span>
                                           {store.id === activeStoreId && <Check size={16} className="text-indigo-600"/>}
                                       </button>
                                   ))}
                                </div>
                            )}
                         </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => chatRef.current?.toggle()}
                        className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <MessageSquare size={20} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="font-bold text-sm text-slate-800 dark:text-white">{currentUser?.fullName}</div>
                            <div className="text-xs text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full w-fit mt-1">
                                {currentUser ? getRoleName(currentUser.permissions || []) : ''}
                            </div>
                        </div>
                        <div className="relative" ref={userMenuRef}>
                            <button onClick={() => setIsUserMenuOpen(prev => !prev)} className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-2 border-white dark:border-slate-900">
                                    {currentUser ? getUserInitials(currentUser.fullName) : '..'}
                                </div>
                            </button>
                            {isUserMenuOpen && (
                                <div className="absolute left-0 top-14 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200 p-2 z-50">
                                    {!isStandalone && installPrompt && (
                                        <button
                                            onClick={() => { onInstall(); setIsUserMenuOpen(false); }}
                                            className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
                                        >
                                            <Download size={16} /> <span>تثبيت التطبيق</span>
                                        </button>
                                    )}
                                    {!isStandalone && isIos && !installPrompt && (
                                        <button
                                            onClick={() => { setShowIosInstallModal(true); setIsUserMenuOpen(false); }}
                                            className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm"
                                        >
                                            <Download size={16} /> <span>تثبيت على آيفون</span>
                                        </button>
                                    )}
                                    <Link to="/employee/account-settings" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">
                                        <Settings size={16} /> <span>إعدادات الحساب</span>
                                    </Link>
                                    <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                                    <div className="px-3 py-2">
                                        <p className="text-xs font-bold text-slate-400 mb-2">المظهر</p>
                                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-md p-1 gap-1">
                                            <button onClick={() => setTheme('light')} className={`w-full flex justify-center items-center gap-1.5 py-1 text-xs rounded-sm font-bold transition-colors ${theme === 'light' ? 'bg-white dark:bg-slate-900 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><Sun size={14}/><span>فاتح</span></button>
                                            <button onClick={() => setTheme('dark')} className={`w-full flex justify-center items-center gap-1.5 py-1 text-xs rounded-sm font-bold transition-colors ${theme === 'dark' ? 'bg-white dark:bg-slate-900 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><Moon size={14}/><span>داكن</span></button>
                                            <button onClick={() => setTheme('system')} className={`w-full flex justify-center items-center gap-1.5 py-1 text-xs rounded-sm font-bold transition-colors ${theme === 'system' ? 'bg-white dark:bg-slate-900 shadow text-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><Monitor size={14}/><span>النظام</span></button>
                                        </div>
                                    </div>
                                    <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                                    <button onClick={onLogout} className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-red-500 font-bold text-sm">
                                        <LogOut size={16} /> <span>تسجيل الخروج</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
            <FloatingChat ref={chatRef} currentUser={currentUser} storeOwner={storeOwner} activeStoreId={activeStoreId} employees={allStoresData[activeStoreId || '']?.settings.employees || []} onlineUsers={onlineUsers} />
            {showIosInstallModal && <IosInstallPrompt onClose={() => setShowIosInstallModal(false)} />}
        </div>
    );
};

export default EmployeeLayout;