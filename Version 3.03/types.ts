
export enum OrderStatus {
  PENDING = 'Pending',
  FULFILLED = 'Fulfilled',
  CANCELLED = 'Cancelled',
  REFUND = 'Refund',
  RESEND = 'Resend'
}

export interface OrderItem {
  sku: string;
  type: string;
  quantity: string | number;
  note: string;
}

export interface Order {
  id: string;
  date: string; // YYYY-MM-DD
  storeId: string;
  sku: string;
  tracking: string;
  status: OrderStatus | string;
  link?: string;
  type?: string;
  note?: string;
  quantity?: string | number;
  handler?: string; // Người xử lý (Username)
  isChecked?: boolean; // New Checkbox
  actionRole?: string; // New Role Action
  items?: OrderItem[]; // Support multiple items per order
}

export interface Store {
  id: string;
  name: string;
  url: string;
  region: string; 
  status: string; 
  listing: string;
  sale: string;
}

export interface DashboardMetrics {
  revenue: number;
  netIncome: number;
  inventoryValue: number;
  debt: number;
}

export interface ChartData {
  name: string;
  value: number;
}

export interface DailyRevenue {
  date: string;
  amount: number;
}

// --- AUTH TYPES ---
export interface User {
  username: string;
  fullName: string;
  role: 'admin' | 'leader' | 'support' | 'designer' | 'idea' | string;
  email?: string;
  phone?: string;
  status?: 'Active' | 'Inactive' | string;
}

export interface Role {
  name: string;
  level: number;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

// --- DAILY STATS TYPES ---
export interface DailyStat {
  date: string;
  totalListing: number;
  totalSale: number;
}

// --- STORE HISTORY TYPES ---
export interface StoreHistoryItem {
  date: string;
  storeId: string;
  listing: number;
  sale: number;
}

// --- SYSTEM TYPES ---
export interface MonthOption {
  value: string; // YYYY-MM
  label: string;
}
