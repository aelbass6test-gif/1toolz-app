import { Permission, PERMISSIONS } from '../types';

export const ROLES: Record<string, { name: string; icon: string; permissions: Permission[] }> = {
  FULL_MANAGER: { name: 'مدير عام', icon: '👑', permissions: Object.keys(PERMISSIONS) as Permission[] },
  CONFIRMATION: { name: 'تأكيد الطلبات', icon: '✅', permissions: ['ORDERS_VIEW', 'PRODUCTS_VIEW'] },
  ACCOUNTANT: { name: 'محاسب', icon: '💰', permissions: ['DASHBOARD_VIEW', 'REPORTS_VIEW', 'WALLET_VIEW', 'WALLET_MANAGE', 'CASH_MANAGE', 'EXPENSES_MANAGE', 'ORDERS_VIEW', 'RETURNS_MANAGE'] },
  CUSTOMER_SERVICE: { name: 'خدمة عملاء', icon: '📞', permissions: ['DASHBOARD_VIEW', 'ORDERS_VIEW', 'ORDERS_MANAGE', 'RETURNS_MANAGE', 'PRODUCTS_VIEW', 'CUSTOMERS_VIEW', 'CUSTOMERS_MANAGE', 'REVIEWS_MANAGE'] },
  STOCK_MANAGER: { name: 'مدير مخزون', icon: '📦', permissions: ['PRODUCTS_VIEW', 'PRODUCTS_MANAGE', 'INVENTORY_MANAGE', 'COLLECTIONS_MANAGE', 'ORDERS_VIEW', 'RETURNS_MANAGE'] },
  MARKETER: { name: 'مسوق', icon: '🚀', permissions: ['DASHBOARD_VIEW', 'REPORTS_VIEW', 'CUSTOMERS_VIEW', 'MARKETING_MANAGE', 'DISCOUNTS_MANAGE', 'PRODUCTS_VIEW', 'APPS_MANAGE'] },
  CASHIER: { name: 'كاشير (POS)', icon: '🏪', permissions: ['POS_VIEW', 'POS_MANAGE', 'PRODUCTS_VIEW', 'ORDERS_VIEW'] },
};

export const getRoleName = (permissions: Permission[]): string => {
    if (!permissions) return 'بدون صلاحيات';
    const totalPermissions = Object.keys(PERMISSIONS).length;
    if (permissions.length === totalPermissions) return 'صلاحيات كاملة';

    const currentPermissions = new Set(permissions);
    let foundRole = 'مخصص';
    for (const roleKey in ROLES) {
        if (roleKey === 'FULL_MANAGER') continue;
        const rolePermissions = new Set(ROLES[roleKey].permissions);
        if (currentPermissions.size === rolePermissions.size && [...currentPermissions].every(p => rolePermissions.has(p))) {
            return ROLES[roleKey].name;
        }
    }
    
    if (permissions.length === 0) return 'بدون صلاحيات';
    return `${permissions.length} صلاحيات مخصصة`;
};
