import Dexie, { type Table } from 'dexie';
import { Order, Settings, Wallet, Treasury, CustomerProfile } from '../../types';

export class AppDatabase extends Dexie {
  orders!: Table<Order>;
  settings!: Table<Settings>;
  wallet!: Table<Wallet>;
  treasury!: Table<Treasury>;
  customers!: Table<CustomerProfile>;

  constructor() {
    super('SmartOrderManagerDB');
    this.version(2).stores({
      orders: 'id, store_id, orderNumber, date, status, customerPhone',
      settings: 'id', 
      wallet: 'id',
      treasury: 'id',
      customers: 'id, store_id, phone, name',
    });
  }
}

export const db = new AppDatabase();
