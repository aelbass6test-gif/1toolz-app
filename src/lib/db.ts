import Dexie, { type Table } from 'dexie';
import { Order, Settings, Wallet, Treasury, CustomerProfile, Quotation } from '../../types';

export class AppDatabase extends Dexie {
  users!: Table<any>;
  orders!: Table<Order>;
  settings!: Table<any>;
  wallet!: Table<Wallet>;
  treasury!: Table<Treasury>;
  customers!: Table<CustomerProfile>;
  quotations!: Table<Quotation & { store_id?: string }>;
  products!: Table<any>;
  suppliers!: Table<any>;
  supply_orders!: Table<any>;
  transactions!: Table<any>;
  treasury_accounts!: Table<any>;
  treasury_transactions!: Table<any>;
  partners!: Table<any>;
  partner_transactions!: Table<any>;
  warehouses!: Table<any>;
  inventory_audits!: Table<any>;
  stock_transfers!: Table<any>;
  order_returns!: Table<any>;
  purchase_returns!: Table<any>;
  pos_sales!: Table<any>;
  cash_holders!: Table<any>;
  cash_handovers!: Table<any>;
  whatsapp_templates!: Table<any>;
  call_scripts!: Table<any>;

  constructor() {
    super('SmartOrderManagerDB');
    this.version(2).stores({
      orders: 'id, store_id, orderNumber, date, status, customerPhone',
      settings: 'id',
      wallet: 'id',
      treasury: 'id',
      customers: 'id, store_id, phone, name',
    });
    this.version(3).stores({
      orders: 'id, store_id, orderNumber, date, status, customerPhone',
      settings: 'id',
      wallet: 'id',
      treasury: 'id',
      customers: 'id, store_id, phone, name',
      quotations: 'id, store_id, quotationNumber, createdAt, status, customerPhone, customerName',
    });
    this.version(4).stores({
      users: 'phone, email, fullName',
      orders: 'id, store_id, orderNumber, date, status, customerPhone',
      settings: 'id',
      wallet: 'id',
      treasury: 'id',
      customers: 'id, store_id, phone, name',
      quotations: 'id, store_id, quotationNumber, createdAt, status, customerPhone, customerName',
      products: 'id, store_id',
      suppliers: 'id, store_id',
      supply_orders: 'id, store_id',
      transactions: 'id, store_id',
      treasury_accounts: 'id, store_id',
      treasury_transactions: 'id, store_id',
      partners: 'id, store_id',
      partner_transactions: 'id, store_id',
      warehouses: 'id, store_id',
      inventory_audits: 'id, store_id',
      stock_transfers: 'id, store_id',
      order_returns: 'id, store_id',
      purchase_returns: 'id, store_id',
      pos_sales: 'id, store_id',
      cash_holders: 'id, store_id',
      cash_handovers: 'id, store_id',
      whatsapp_templates: 'id, store_id',
      call_scripts: 'id, store_id',
    });
  }
}

export const db = new AppDatabase();

