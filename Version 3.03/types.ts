
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

// --- ATTENDANCE & SCHEDULE ---
export interface ScheduleStaff {
  name: string;
  role: string;
  username?: string; 
}

export interface AttendanceRecord {
  username?: string;
  name: string;
  date: string; // YYYY-MM-DD
  checkIn: string;
  checkOut?: string;
  totalHours?: number;
}

export interface OTRecord {
  username?: string;
  name: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  totalHours?: number;
  type: 'Normal' | 'Weekend' | 'Holiday';
}

// --- HANDOVER TYPES ---
export type HandoverStatus = 'Pending' | 'Processing' | 'Completed' | 'Overdue';

export interface HandoverItem {
  id: string;
  date: string;
  task: string;
  assignee: string;
  deadlineAt: string;
  status: HandoverStatus;
  startTime?: string;
  endTime?: string;
  report?: string;
  fileLink?: string; 
  resultLink?: string; 
  imageLink?: string;
  createdBy: string;
  isSeen?: boolean; 
}

export interface DailyNoteItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface UserNote {
  username: string;
  date: string;
  items: DailyNoteItem[];
  showPlanner?: boolean; 
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
  isLocked?: boolean;
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
export type FinanceScope = string;

export interface UserPermissions {
  canManageSku?: boolean;
  canPostNews?: boolean;
  canViewFinanceSummary?: boolean; 
  dashboard?: ViewScope;      
  orders?: ViewScope;
  designer?: ViewScope;
  designerOnline?: ViewScope;
  handover?: ViewScope;
  customers?: ViewScope;      
  finance?: FinanceScope;        
  system?: ViewScope;         
}

export interface User {
  username: string;
  password?: string;
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
  subCategory: string; 
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  payer: string;
  note: string;
}

export interface PaymentRecord {
  id: string;
  storeName: string;
  amount: number;
  region: 'Au' | 'Us' | 'VN';
  convertedUsd: number;
  date: string;
  timestamp?: string;
}

export interface PrintwayRecord {
  invoiceId: string;
  type: string;
  loai: string;
  status: string;
  date: string;
  method: string;
  amountUsd: number;
  totalAmount: number;
  note: string;
}

export interface EbayRecord {
  recordId: string;
  accountingTime: string;
  type: string;
  amount: number;
  cardRemark: string;
}

export interface StaffSalarySummary {
  month: string;
  amountVnd: number;
  amountUsd: number;
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
  subCategories: string[];
  payers: string[];
  stores: string[];
  regions: string[];
}
