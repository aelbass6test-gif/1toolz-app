import { Order, CustomerProfile } from '../../types';
import * as XLSX from 'xlsx';

export interface EnrichedCustomerProfile extends CustomerProfile {
  computedSegment: 'vip' | 'regular' | 'new' | 'risk' | 'inactive' | 'debt';
  successRate: number;
  healthScore: number;
  customerOrders: Order[];
}

export function computeEnrichedCustomers(
  orders: Order[],
  loyaltyData: Record<string, number>,
  savedCustomers?: CustomerProfile[]
): EnrichedCustomerProfile[] {
  const computedMap = new Map<string, EnrichedCustomerProfile>();
  const ordersByPhone = new Map<string, Order[]>();

  // Process orders
  orders.forEach(order => {
    const cleanPhone = (order.customerPhone || '').replace(/\s/g, '').replace('+2', '');
    if (!cleanPhone) return;

    if (!ordersByPhone.has(cleanPhone)) {
      ordersByPhone.set(cleanPhone, []);
    }
    ordersByPhone.get(cleanPhone)!.push(order);

    if (!computedMap.has(cleanPhone)) {
      computedMap.set(cleanPhone, {
        id: cleanPhone,
        name: order.customerName || 'عميل بدون اسم',
        phone: order.customerPhone || '',
        address: order.customerAddress || '',
        totalOrders: 0,
        successfulOrders: 0,
        returnedOrders: 0,
        totalSpent: 0,
        lastOrderDate: order.date,
        firstOrderDate: order.date,
        averageOrderValue: 0,
        loyaltyPoints: loyaltyData[cleanPhone] || 0,
        governorate: order.governorate || order.shippingArea || '',
        city: order.city || '',
        shippingFee: order.shippingFee || 0,
        debtBalance: 0,
        debtHistory: [],
        tags: [],
        email: '',
        computedSegment: 'regular',
        successRate: 0,
        healthScore: 50,
        customerOrders: []
      });
    }

    const customer = computedMap.get(cleanPhone)!;
    customer.totalOrders += 1;

    if (new Date(order.date) > new Date(customer.lastOrderDate)) {
      customer.name = order.customerName || customer.name;
      customer.address = order.customerAddress || customer.address;
      customer.governorate = order.governorate || order.shippingArea || customer.governorate;
      customer.city = order.city || customer.city;
      customer.shippingFee = order.shippingFee || customer.shippingFee;
      customer.lastOrderDate = order.date;
    }
    if (new Date(order.date) < new Date(customer.firstOrderDate)) {
      customer.firstOrderDate = order.date;
    }

    if (
      order.status === 'تم_التحصيل' ||
      order.status === 'تم_توصيلها' ||
      order.status === 'تم_التوصيل' ||
      order.status === 'مدفوعة'
    ) {
      customer.successfulOrders += 1;
      const orderTotal = (order.productPrice || 0) + (order.shippingFee || 0) - (order.discount || 0);
      customer.totalSpent += Math.max(0, orderTotal);
    } else if (
      order.status === 'مرتجع' ||
      order.status === 'فشل_التوصيل' ||
      order.status === 'تمت_الاعادة_لشركة_الشحن'
    ) {
      customer.returnedOrders += 1;
    }
  });

  // Merge saved customers
  (savedCustomers || []).forEach(savedC => {
    const cleanPhone = (savedC.phone || '').replace(/\s/g, '').replace('+2', '');
    if (!cleanPhone) return;

    if (computedMap.has(cleanPhone)) {
      const compC = computedMap.get(cleanPhone)!;
      compC.totalOrders = Math.max(compC.totalOrders, savedC.totalOrders || 0);
      compC.successfulOrders = Math.max(compC.successfulOrders, savedC.successfulOrders || 0);
      compC.returnedOrders = Math.max(compC.returnedOrders, savedC.returnedOrders || 0);
      compC.totalSpent = Math.max(compC.totalSpent, savedC.totalSpent || 0);
      compC.loyaltyPoints = savedC.loyaltyPoints !== undefined ? savedC.loyaltyPoints : compC.loyaltyPoints;
      compC.debtBalance = savedC.debtBalance || 0;
      compC.debtHistory = savedC.debtHistory || compC.debtHistory || [];
      compC.notes = savedC.notes || compC.notes;
      compC.tags = savedC.tags || compC.tags || [];
      compC.email = savedC.email || compC.email;
      if (savedC.governorate) compC.governorate = savedC.governorate;
      if (savedC.city) compC.city = savedC.city;
      if (savedC.address) compC.address = savedC.address;
      if (savedC.name) compC.name = savedC.name;
    } else {
      computedMap.set(cleanPhone, {
        ...savedC,
        id: cleanPhone,
        loyaltyPoints: savedC.loyaltyPoints || loyaltyData[cleanPhone] || 0,
        debtBalance: savedC.debtBalance || 0,
        debtHistory: savedC.debtHistory || [],
        tags: savedC.tags || [],
        computedSegment: 'regular',
        successRate: 0,
        healthScore: 50,
        customerOrders: ordersByPhone.get(cleanPhone) || []
      });
    }
  });

  const now = new Date().getTime();

  return Array.from(computedMap.values()).map(c => {
    const cleanPhone = (c.phone || '').replace(/\s/g, '').replace('+2', '');
    const cOrders = ordersByPhone.get(cleanPhone) || [];
    cOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const successRate = c.totalOrders > 0 ? (c.successfulOrders / c.totalOrders) * 100 : 0;
    const aov = c.successfulOrders > 0 ? c.totalSpent / c.successfulOrders : 0;

    // Calculate segment
    let segment: EnrichedCustomerProfile['computedSegment'] = 'regular';
    if ((c.debtBalance || 0) > 0) {
      segment = 'debt';
    } else if (c.totalSpent >= 5000 || c.successfulOrders >= 10) {
      segment = 'vip';
    } else if (c.returnedOrders > 2 && successRate < 50) {
      segment = 'risk';
    } else if (c.totalOrders <= 1 && (now - new Date(c.firstOrderDate).getTime()) < 14 * 24 * 3600 * 1000) {
      segment = 'new';
    } else if (c.totalOrders > 0 && (now - new Date(c.lastOrderDate).getTime()) > 30 * 24 * 3600 * 1000) {
      segment = 'inactive';
    }

    // Calculate Health Score (5 to 100)
    let score = 50;
    score += (successRate / 100) * 30;
    if (c.totalSpent > 5000) score += 15;
    else if (c.totalSpent > 2000) score += 10;
    
    const daysSinceLastOrder = (now - new Date(c.lastOrderDate).getTime()) / (24 * 3600 * 1000);
    if (daysSinceLastOrder <= 15) score += 15;
    else if (daysSinceLastOrder <= 30) score += 5;
    else if (daysSinceLastOrder > 60) score -= 15;

    if (c.returnedOrders > 3) score -= 20;
    if ((c.debtBalance || 0) > 1000) score -= 10;

    const healthScore = Math.min(100, Math.max(5, Math.round(score)));

    return {
      ...c,
      averageOrderValue: aov,
      successRate,
      computedSegment: segment,
      healthScore,
      customerOrders: cOrders
    };
  });
}

export function exportCustomersToExcel(customers: EnrichedCustomerProfile[]) {
  const data = customers.map(c => ({
    'اسم العميل': c.name,
    'رقم الهاتف': c.phone,
    'المحافظة': c.governorate || 'غير محدد',
    'المدينة': c.city || 'غير محدد',
    'العنوان': c.address || 'غير محدد',
    'إجمالي الإنفاق (LTV)': c.totalSpent,
    'إجمالي الطلبات': c.totalOrders,
    'الطلبات الناجحة': c.successfulOrders,
    'المرتجعات': c.returnedOrders,
    'نسبة النجاح %': `${c.successRate.toFixed(0)}%`,
    'رصيد المديونية': c.debtBalance || 0,
    'نقاط الولاء': c.loyaltyPoints || 0,
    'مؤشر الصحة %': `${c.healthScore}%`,
    'آخر ظهور': c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('ar-EG') : 'غير محدد',
    'التصنيف': getSegmentLabel(c.computedSegment).label,
    'التصنيفات المخصصة': (c.tags || []).join('، '),
    'ملاحظات': c.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قاعدة العملاء CRM');
  XLSX.writeFile(workbook, `قاعدة_العملاء_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function getSegmentLabel(segment: string) {
  switch (segment) {
    case 'vip':
      return { label: 'VIP ⭐', bg: 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50', iconColor: 'text-amber-500' };
    case 'debt':
      return { label: 'مديونية 🔴', bg: 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/50', iconColor: 'text-rose-500' };
    case 'new':
      return { label: 'جديد 🌟', bg: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50', iconColor: 'text-emerald-500' };
    case 'risk':
      return { label: 'عالي المخاطر ⚠️', bg: 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/50', iconColor: 'text-red-500' };
    case 'inactive':
      return { label: 'خامل 💤', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700', iconColor: 'text-slate-400' };
    default:
      return { label: 'منتظم 🟢', bg: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/50', iconColor: 'text-blue-500' };
  }
}
