export enum OrderStatus {
  PENDING = 'Pending',
  FULFILLED = 'Fulfilled',
  CANCELLED = 'Cancelled',
  REFUND = 'Refund',
  RESEND = 'Resend'
}

export interface Order {
  id: string;
  date: string;
  storeId: string;
  sku: string;
  tracking: string;
  status: string;
  link?: string;
  quantity?: string | number;
  handler?: string;
  isChecked?: boolean;
  isDesignDone?: boolean;
  isFulfilled?: boolean;
  actionRole?: string;
  itemName?: string;
  netPrice?: string | number;
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

export interface DailyStat {
  date: string;
  totalListing: number;
  totalSale: number;
}

// --- NEWS TYPES ---
export interface NewsItem {
  id: string;
  title: string;
  content: string;
  imageUrl: string;
  author: string;
  timestamp: string;
  likesCount: number;
  isLiked?: boolean;
  isLocked?: boolean; // NEW: Lock comments
  comments?: NewsComment[];
}

export interface NewsComment {
  id: string;
  newsId: string;
  username: string;
  text: string;
  timestamp: string;
}

// --- AUTH & PERMISSIONS ---
export type ViewScope = 'all' | 'own' | 'none';

export interface UserPermissions {
  canManageSku?: boolean;
  canPostNews?: boolean;
  dashboard?: ViewScope;      
  orders?: ViewScope;
  designer?: ViewScope;
  designerOnline?: ViewScope;
  customers?: ViewScope;      
  finance?: ViewScope;        
  system?: ViewScope;         
}

export interface User {
  username: string;
  fullName: string;
  role: string;
  permissions?: UserPermissions;
  status?: string;
  email?: string;
  phone?: string;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  payer: string;
  note: string;
}

export interface StoreHistoryItem {
  date: string;
  listing: string | number;
  sale: string | number;
}

export interface Role {
  name: string;
  level: number;
}

export interface SkuMapping {
  sku: string;
  category: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface FinanceMeta {
  categories: string[];
  payers: string[];
}