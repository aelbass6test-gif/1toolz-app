import { Permission, Settings } from '../types';

const IMPLIED_PERMISSION_PARENTS: Partial<Record<Permission, Permission>> = {
  ORDERS_VIEW: 'ORDERS_MANAGE',
  PRODUCTS_VIEW: 'PRODUCTS_MANAGE',
  POS_VIEW: 'POS_MANAGE',
  CUSTOMERS_VIEW: 'CUSTOMERS_MANAGE',
  WALLET_VIEW: 'WALLET_MANAGE',
  SETTINGS_VIEW: 'SETTINGS_MANAGE',
  TEAM_VIEW: 'TEAM_MANAGE',
};

export function hasEffectiveOwnerPermission(
  settings: Settings | undefined,
  requiredPermission: Permission | null,
  bypass?: boolean
): boolean {
  if (bypass || !requiredPermission) return true;
  const ownerPerms = settings?.ownerPermissions;
  // When undefined/null, store owner holds full unrestricted permissions by default
  if (!Array.isArray(ownerPerms)) return true;
  if (ownerPerms.includes(requiredPermission)) return true;
  const parent = IMPLIED_PERMISSION_PARENTS[requiredPermission];
  if (parent && ownerPerms.includes(parent)) return true;
  return false;
}

export function getOwnerRouteRequiredPermission(pathname: string): Permission | null {
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  const storeMatch = clean.match(/^\/store\/[^/]+(\/.*)?$/);
  if (!storeMatch) return null;

  const sub = storeMatch[1] || '/dashboard';
  // Storefront live preview or critical account/subscription routes are never blocked
  if (sub === '/store' || sub === '/subscription' || sub === '/account-settings' || sub === '/select-store' || sub === '/manage-stores') {
    return null;
  }

  if (sub === '/dashboard') return 'DASHBOARD_VIEW';
  if (sub === '/reports' || sub === '/standard-reports' || sub === '/collections-report') return 'REPORTS_VIEW';

  if (sub.startsWith('/orders/new') || sub.startsWith('/orders/edit') || sub === '/create-order') return 'ORDERS_MANAGE';
  if (
    sub.startsWith('/orders') ||
    sub === '/confirmation-queue' ||
    sub === '/abandoned-carts' ||
    sub === '/failed-delivery-compensation' ||
    sub === '/tracking' ||
    sub === '/quotations'
  ) {
    return 'ORDERS_VIEW';
  }
  if (sub === '/returns' || sub === '/purchase-returns') return 'RETURNS_MANAGE';
  if (sub === '/pos') return 'POS_VIEW';

  if (sub === '/products' || sub === '/product-options') return 'PRODUCTS_VIEW';
  if (sub === '/collections') return 'COLLECTIONS_MANAGE';
  if (sub === '/inventory-transfers') return 'INVENTORY_MANAGE';

  if (sub === '/customers') return 'CUSTOMERS_VIEW';
  if (sub === '/marketing') return 'MARKETING_MANAGE';
  if (sub === '/discounts') return 'DISCOUNTS_MANAGE';
  if (sub === '/reviews') return 'REVIEWS_MANAGE';

  if (sub === '/wallet') return 'WALLET_VIEW';
  if (sub === '/treasury' || sub === '/cash-management' || sub === '/reconciliation') return 'CASH_MANAGE';
  if (sub === '/expenses') return 'EXPENSES_MANAGE';

  if (sub === '/settings/employees' || sub === '/employees-payroll') return 'TEAM_VIEW';
  if (sub === '/settings/developer' || sub === '/apps' || sub === '/api-docs' || sub === '/docs' || sub === '/webhook-monitor') return 'APPS_MANAGE';
  if (sub.startsWith('/settings') || sub === '/maintenance') return 'SETTINGS_VIEW';
  if (sub === '/customize-store' || sub === '/design-templates' || sub === '/domain' || sub === '/pages') return 'STOREFRONT_MANAGE';

  return null;
}
