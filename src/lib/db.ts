import Dexie, { type Table } from 'dexie';
import { Order, Settings, Wallet, Treasury, CustomerProfile, Quotation } from '../../types';

export class AppDatabase extends Dexie {
  orders!: Table<Order>;
  settings!: Table<Settings>;
  wallet!: Table<Wallet>;
  treasury!: Table<Treasury>;
  customers!: Table<CustomerProfile>;
  quotations!: Table<Quotation & { store_id?: string }>;

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
  }
}

export const db = new AppDatabase();

