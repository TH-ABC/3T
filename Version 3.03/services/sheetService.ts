
import { Order, Store, User, DashboardMetrics, DailyStat, StoreHistoryItem, SkuMapping, Role, AuthResponse, FinanceTransaction, FinanceMeta, NewsItem, NewsComment, ScheduleStaff, AttendanceRecord, OTRecord, HandoverItem, UserNote, DailyNoteItem, PaymentRecord, PrintwayRecord, EbayRecord, GKERecord, StaffSalarySummary, HoldRecord } from '../types';

const API_URL = 'https://script.google.com/macros/s/AKfycbyw4ZdfirgKUHyXMH8Ro7UZ6-VWCdf1hgqU37ilLvNt2RwzusSPG_HUc_mi8z-9tInR/exec'; 

async function callAPI(action: string, method: string = 'POST', data: any = {}): Promise<any> {
  if (!API_URL) return { success: false, error: 'API URL not configured' };

  let fetchUrl = API_URL;
  if (action === 'getOrders' && data.month) {
     const separator = fetchUrl.includes('?') ? '&' : '?';
     fetchUrl = `${fetchUrl}${separator}month=${encodeURIComponent(data.month)}`;
  }

  try {
    const response = await fetch(fetchUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data }),
    });
    return await response.json();
  } catch (error) {
    console.error(`Error calling API ${action}:`, error);
    return { success: false, error: 'Network or API error' };
  }
}

export const sheetService = {
  // --- HANDOVER ---
  getHandover: async (date: string, viewerName?: string, viewerRole?: string): Promise<HandoverItem[]> => 
    await callAPI('getHandover', 'POST', { date, viewerName, viewerRole }),
  
  addHandover: async (item: Partial<HandoverItem>): Promise<any> => await callAPI('addHandover', 'POST', item),
  updateHandover: async (id: string, updates: Partial<HandoverItem>): Promise<any> => await callAPI('updateHandover', 'POST', { id, updates }),
  deleteHandover: async (id: string): Promise<any> => await callAPI('deleteHandover', 'POST', { id }),
  markHandoverAsSeen: async (id: string): Promise<any> => await callAPI('markHandoverAsSeen', 'POST', { id }), 
  getUserNote: async (username: string, date: string): Promise<UserNote> => await callAPI('getUserNote', 'POST', { username, date }),
  saveUserNote: async (note: UserNote): Promise<any> => await callAPI('saveUserNote', 'POST', note),

  // --- SCHEDULE & ATTENDANCE ---
  getScheduleStaff: async (): Promise<ScheduleStaff[]> => await callAPI('getScheduleStaff', 'GET'),
  saveScheduleStaff: async (staffList: ScheduleStaff[]): Promise<any> => await callAPI('saveScheduleStaff', 'POST', { staffList }),
  deleteScheduleStaffMember: async (username: string, name: string): Promise<any> => await callAPI('deleteScheduleStaffMember', 'POST', { username, name }),
  getAttendance: async (month: string): Promise<AttendanceRecord[]> => await callAPI('getAttendance', 'POST', { month }),
  checkIn: async (username: string, name: string): Promise<any> => await callAPI('checkIn', 'POST', { username, name }),
  checkOut: async (username: string, name: string): Promise<any> => await callAPI('checkOut', 'POST', { username, name }),
  
  // --- TIMEKEEPING & FULL TABLE SAVE ---
  getManualTimekeeping: async (month: string): Promise<any> => await callAPI('getManualTimekeeping', 'POST', { month }),
  saveManualTimekeeping: async (month: string, username: string, day: number, value: string): Promise<any> => await callAPI('saveManualTimekeeping', 'POST', { month, username, day, value }),
  saveFullMonthlyTable: async (month: string, matrix: any[]): Promise<any> => await callAPI('saveFullMonthlyTable', 'POST', { month, matrix }),

  // --- OT FUNCTIONS ---
  getOTAttendance: async (month: string): Promise<OTRecord[]> => await callAPI('getOTAttendance', 'POST', { month }),
  checkInOT: async (username: string, name: string): Promise<any> => await callAPI('checkInOT', 'POST', { username, name }),
  checkOutOT: async (username: string, name: string): Promise<any> => await callAPI('checkOutOT', 'POST', { username, name }),
  getHolidays: async (month: string): Promise<string[]> => await callAPI('getHolidays', 'POST', { month }),
  toggleHoliday: async (date: string): Promise<any> => await callAPI('toggleHoliday', 'POST', { date }),

  // --- NEWS & NOTIFICATIONS ---
  getNews: async (username: string): Promise<{ news: NewsItem[], lastReadTime: number }> => {
    const res = await callAPI('getNews', 'POST', { username });
    if (res && res.news) {
        return { news: res.news, lastReadTime: res.lastReadTime || 0 };
    }
    return { news: [], lastReadTime: 0 };
  },
  updateLastReadTime: async (username: string): Promise<any> => await callAPI('updateLastReadTime', 'POST', { username }),
  addNews: async (news: Partial<NewsItem>): Promise<any> => await callAPI('addNews', 'POST', news),
  updateNews: async (news: Partial<NewsItem>): Promise<any> => await callAPI('updateNews', 'POST', news),
  deleteNews: async (newsId: string): Promise<any> => await callAPI('deleteNews', 'POST', { newsId }),
  toggleLockNews: async (newsId: string): Promise<any> => await callAPI('toggleLockNews', 'POST', { newsId }),
  addComment: async (comment: Partial<NewsComment>): Promise<any> => await callAPI('addComment', 'POST', comment),
  toggleLike: async (newsId: string, username: string): Promise<any> => await callAPI('toggleLike', 'POST', { newsId, username }),

  // --- AUTH & SESSION ---
  login: async (username: string, password: string, ip?: string): Promise<AuthResponse> => await callAPI('login', 'POST', { username, password, ip }),
  logout: async (username: string, type: string = 'LOGOUT'): Promise<any> => await callAPI('logout', 'POST', { username, type }),

  // --- FINANCE METHODS ---
  getFinance: async (year: string): Promise<{ transactions: FinanceTransaction[], payments: PaymentRecord[], printway: PrintwayRecord[], ebay: EbayRecord[], gke: GKERecord[], hold: HoldRecord[], fileId: string | null, error?: string }> => await callAPI('getFinance', 'POST', { year }),
  addFinance: async (year: string, transaction: Partial<FinanceTransaction>): Promise<any> => await callAPI('addFinance', 'POST', { year, transaction }),
  addPayment: async (year: string, payment: Partial<PaymentRecord>): Promise<any> => await callAPI('addPayment', 'POST', { year, payment }),
  addHold: async (year: string, hold: Partial<HoldRecord>): Promise<any> => await callAPI('addHold', 'POST', { year, hold }),
  addPrintwayBatch: async (year: string, list: PrintwayRecord[]): Promise<any> => await callAPI('addPrintwayBatch', 'POST', { year, list }),
  syncPrintwayData: async (month: string, list: PrintwayRecord[]): Promise<any> => await callAPI('syncPrintwayData', 'POST', { month, list }),
  addEbayBatch: async (year: string, list: EbayRecord[]): Promise<any> => await callAPI('addEbayBatch', 'POST', { year, list }),
  addGKEBatch: async (year: string, list: GKERecord[]): Promise<any> => await callAPI('addGKEBatch', 'POST', { year, list }),
  updateFinanceField: async (year: string, id: string, field: string, value: any): Promise<any> => await callAPI('updateFinanceField', 'POST', { year, id, field, value }),
  updatePaymentField: async (year: string, id: string, field: string, value: any): Promise<any> => await callAPI('updatePaymentField', 'POST', { year, id, field, value }),
  createFinanceFile: async (year: string): Promise<any> => await callAPI('createFinanceFile', 'POST', { year }),
  getFinanceMeta: async (): Promise<FinanceMeta> => await callAPI('getFinanceMeta', 'GET'),
  addFinanceMeta: async (type: 'category' | 'subCategory' | 'payer' | 'store' | 'region', value: string): Promise<any> => await callAPI('addFinanceMeta', 'POST', { type, value }),
  getStaffSalarySummary: async (year: string): Promise<StaffSalarySummary[]> => await callAPI('getStaffSalarySummary', 'POST', { year }),
  
  // AI INSIGHTS
  getAiInsight: async (monthKey: string, year: string): Promise<any> => await callAPI('getAiInsight', 'POST', { monthKey, year }),
  saveAiInsight: async (monthKey: string, year: string, content: string): Promise<any> => await callAPI('saveAiInsight', 'POST', { monthKey, year, content }),

  // --- EXISTING METHODS ---
  getDashboardStats: async (): Promise<DashboardMetrics> => ({ revenue: 0, netIncome: 0, inventoryValue: 0, debt: 0 }),
  getStores: async (): Promise<Store[]> => await callAPI('getStores', 'GET'),
  getDailyStats: async (): Promise<DailyStat[]> => await callAPI('getDailyStats', 'GET'),
  triggerDebugSnapshot: async (): Promise<any> => await callAPI('debugSnapshot', 'POST'),
  addStore: async (store: Partial<Store>): Promise<any> => await callAPI('addStore', 'POST', store),
  deleteStore: async (id: string): Promise<any> => await callAPI('deleteStore', 'POST', { id }),
  getUnits: async (): Promise<string[]> => await callAPI('getUnits', 'GET'),
  getUsers: async (): Promise<User[]> => await callAPI('getUsers', 'GET'),
  getOrders: async (month: string): Promise<{ orders: Order[], fileId: string }> => await callAPI('getOrders', 'GET', { month }),
  createMonthFile: async (month: string): Promise<any> => await callAPI('createMonthFile', 'POST', { month }),
  updateOrder: async (fileId: string, orderId: string, field: string, value: string): Promise<any> => await callAPI('updateOrder', 'POST', { fileId, orderId, field, value }),
  updateDesignerStatus: async (fileId: string, order: Order, sheetName: string, isDone: boolean): Promise<any> => await callAPI('updateDesignerStatus', 'POST', { fileId, order, sheetName, isDone }),
  batchUpdateOrder: async (fileId: string, orderIds: string[], field: string, value: any): Promise<any> => await callAPI('batchUpdateOrder', 'POST', { fileId, orderIds, field, value: value ? "TRUE" : "FALSE" }),
  batchUpdateDesigner: async (fileId: string, orderIds: string[], value: any): Promise<any> => await callAPI('batchUpdateDesigner', 'POST', { fileId, orderIds, value: value ? "TRUE" : "FALSE" }),
  fulfillOrder: async (fileId: string, order: Order): Promise<any> => await callAPI('fulfillOrder', 'POST', { fileId, ...order }),
  syncFulfillment: async (fileId: string): Promise<any> => await callAPI('syncFulfillment', 'POST', { fileId }),
  syncPW: async (fileId: string): Promise<any> => await callAPI('syncPW', 'POST', { fileId }),
  syncFF: async (fileId: string): Promise<any> => await callAPI('syncFF', 'POST', { fileId }),
  addOrder: async (order: Order, fileId?: string): Promise<any> => await callAPI('addOrder', 'POST', { ...order, isDesignDone: order.isDesignDone || false, fileId }),
  addUnit: async (name: string): Promise<any> => await callAPI('addUnit', 'POST', { name }),
  getRoles: async (): Promise<Role[]> => await callAPI('getRoles', 'GET'),
  createUser: async (user: any): Promise<any> => await callAPI('createUser', 'POST', user),
  addRole: async (name: string, level: number): Promise<any> => await callAPI('addRole', 'POST', { name, level }),
  updateUser: async (username: string, role?: string, status?: string, permissions?: any): Promise<any> => await callAPI('updateUser', 'POST', { username, role, status, permissions }),
  getStoreHistory: async (storeId: string): Promise<StoreHistoryItem[]> => await callAPI('getStoreHistory', 'GET', { storeId }),
  getSkuMappings: async (): Promise<SkuMapping[]> => await callAPI('getSkuMappings', 'GET'),
  updateSkuCategory: async (sku: string, category: string): Promise<any> => await callAPI('updateSkuCategory', 'POST', { sku, category }),
  getPriceMappings: async (): Promise<{category: string, price: number}[]> => await callAPI('getPriceMappings', 'GET'),
  updateCategoryPrice: async (category: string, price: number): Promise<any> => await callAPI('updateCategoryPrice', 'POST', { category, price }),
  changePassword: async (username: string, oldPass: string, newPass: string): Promise<any> => await callAPI('changePassword', 'POST', { username, oldPass, newPass }),
};
