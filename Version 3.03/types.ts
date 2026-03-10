
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
  linkDs?: string;
  check?: string;
  note?: string;
  designerNote?: string;
  productUrl?: string;
  optionsText?: string;
  urlArtworkFront?: string;
  urlMockup?: string;
  rowNumber?: number;
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
  title?: string;
  text: string;
  content?: string;
  images?: string[];
  completed: boolean;
  columnId?: string; // Optional for backward compatibility
}

export interface PlannerColumn {
  id: string;
  title: string;
  order: number;
}

export interface UserNote {
  username: string;
  date: string;
  items: DailyNoteItem[];
  columns?: PlannerColumn[];
  showPlanner?: boolean; 
  plannerPosition?: { x: number, y: number };
  plannerSize?: { width: number, height: number };
}

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
  macrame?: ViewScope;
  system?: ViewScope;         
  canEditDesignerOnlineNote?: boolean;
  canEditDesignerOnlineUrls?: boolean;
  canAssignHandover?: boolean;
  allowedDesignerOnlineChecks?: string; // Comma separated list of allowed options
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

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
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

export interface HoldRecord {
  id: string;
  storeName: string;
  amount: number;
  region: 'Au' | 'Us' | 'VN';
  date: string;
}

export interface PrintwayRecord {
  invoiceId: string;
  type: string;
  loai: string;
  status: string;
  date: string;
  method: string;
  amountUsd: number;
  fee?: number;
  totalAmount: number;
  note: string;
}

export interface EbayRecord {
  recordId: string;
  accountingTime: string;
  type: string;
  amount: number;
  cardRemark: string;
  timestamp?: string;
}

export interface GKERecord {
  date: string;
  orderNumber: string;
  trackingNumber: string;
  paymentAmount: number; 
  topupAmount: number;    
  note: string;
}

export interface StaffSalarySummary {
  month: string;
  amountVnd: number;
  amountUsd: number;
}

export interface FinanceMeta {
  categories: string[];
  subCategories: string[];
  payers: string[];
  stores: string[];
  regions: string[];
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

export interface MacrameProduct {
  id: string;
  order_id: string;
  sku: string;
  quantity: number;
  product_name: string;
  etsy_link: string;
  size: string;
  color: string;
  unit_price: number;
  total_amount: number;
  order_date: string;
  packaging_size: string;
  note: string;
  label_link: string;
  shipping_cost?: number;
  created_at?: string;
  created_by?: string;
}

export interface MacramePayment {
  id: string;
  amount: number;
  payment_date: string;
  image_url?: string;
  image_link?: string;
  created_at?: string;
  created_by?: string;
}
