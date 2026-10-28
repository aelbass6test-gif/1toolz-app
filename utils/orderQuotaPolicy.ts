/**
 * Order Quota & Financial Ledger Policy Configuration
 * 
 * Centralizes the exact rules, timing, cancellation/return policies,
 * and currency math for merchant subscription plans and dedicated manager plans.
 */

export interface OrderQuotaPolicyConfig {
  // Plan Parameters for Dedicated Manager Monthly Plan
  DEDICATED_MANAGER_MONTHLY_PRICE: number; // 1,000 EGP
  DEDICATED_MANAGER_INCLUDED_ORDERS_QUOTA: number; // 50 orders per cycle
  DEDICATED_MANAGER_EXTRA_ORDER_FEE: number; // 20 EGP per order beyond 50
  BILLING_CYCLE_DAYS: number; // 30 days

  // Timing of Quota & Fee Deduction
  // Rule: Drafts consume 0 quota and 0 fees. First successful confirmation is the deduction event.
  FEE_DEDUCTION_EVENT: 'on_first_confirmation';

  // Cancellation & Returns Policy
  // Rule: Dedicated manager spent operational work communicating and confirming with the client.
  // Standard policy: Service fee is non-refundable on customer cancellation/return unless administrative reversal is explicitly approved.
  REFUND_SERVICE_FEE_ON_CANCEL: boolean;
  RESTORE_QUOTA_ON_CANCEL: boolean;

  // Cross-cycle order creation vs confirmation rule:
  // Rule: When an order is created near the end of Cycle A but confirmed during Cycle B,
  // the quota consumption and active quota limits are evaluated against the billing cycle ACTIVE AT THE MOMENT OF CONFIRMATION,
  // while preserving the unit fee terms stamped at creation.
  CROSS_CYCLE_POLICY: 'charge_at_confirmation_cycle_using_creation_terms';
}

export const ORDER_QUOTA_POLICY: OrderQuotaPolicyConfig = {
  DEDICATED_MANAGER_MONTHLY_PRICE: 1000,
  DEDICATED_MANAGER_INCLUDED_ORDERS_QUOTA: 50,
  DEDICATED_MANAGER_EXTRA_ORDER_FEE: 20,
  BILLING_CYCLE_DAYS: 30,
  FEE_DEDUCTION_EVENT: 'on_first_confirmation',
  REFUND_SERVICE_FEE_ON_CANCEL: false,
  RESTORE_QUOTA_ON_CANCEL: false,
  CROSS_CYCLE_POLICY: 'charge_at_confirmation_cycle_using_creation_terms'
};

/**
 * Currency Conversion Helper (avoid floating point inaccuracies)
 * Stores money internally in Piasters (قروش) as exact integer math.
 */
export const toPiasters = (egp: number): number => {
  if (!Number.isFinite(egp)) return 0;
  return Math.round(egp * 100);
};

export const fromPiasters = (piasters: number): number => {
  if (!Number.isFinite(piasters)) return 0;
  return Number((piasters / 100).toFixed(2));
};

/**
 * Safe ISO Date Formatter
 * Prevents "RangeError: Invalid time value" on unexpected date inputs.
 */
export const safeIsoDate = (input?: string | number | Date | null): string => {
  if (!input) return new Date().toISOString();
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) {
      return new Date().toISOString();
    }
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};
