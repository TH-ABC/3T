
import { Order, Store, User, DashboardMetrics, DailyStat, StoreHistoryItem, SkuMapping, Role, AuthResponse, FinanceTransaction, FinanceMeta, NewsItem, NewsComment, ScheduleStaff, AttendanceRecord, OTRecord } from '../types';

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
  // --- SCHEDULE & ATTENDANCE ---
  getScheduleStaff: async (): Promise<ScheduleStaff[]> => await callAPI('getScheduleStaff', 'GET'),
  saveScheduleStaff: async (staffList: ScheduleStaff[]): Promise<any> => await callAPI('saveScheduleStaff', 'POST', { staffList }),
  getAttendance: async (month: string): Promise<AttendanceRecord[]> => await callAPI('getAttendance', 'POST', { month }),
  checkIn: async (username: string, name: string): Promise<any> => await callAPI('checkIn', 'POST', { username, name }),
  checkOut: async (username: string, name: string): Promise<any> => await callAPI('checkOut', 'POST', { username, name }),
  
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

  updateLastReadTime: async (username: string): Promise<any> => {
    return await callAPI('updateLastReadTime', 'POST', { username });
  },

  addNews: async (news: Partial<NewsItem>): Promise<any> => {
    return await callAPI('addNews', 'POST', news);
  },

  updateNews: async (news: Partial<NewsItem>): Promise<any> => {
    return await callAPI('updateNews', 'POST', news);
  },

  deleteNews: async (newsId: string): Promise<any> => {
    return await callAPI('deleteNews', 'POST', { newsId });
  },

  toggleLockNews: async (newsId: string): Promise<any> => {
    return await callAPI('toggleLockNews', 'POST', { newsId });
  },

  addComment: async (comment: Partial<NewsComment>): Promise<any> => {
    return await callAPI('addComment', 'POST', comment);
  },

  toggleLike: async (newsId: string, username: string): Promise<any> => {
    return await callAPI('toggleLike', 'POST', { newsId, username });
  },

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
  login: async (username: string, password: string, ip?: string): Promise<AuthResponse> => await callAPI('login', 'POST', { username, password, ip }),
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
  getFinance: async (year: string): Promise<{ transactions: FinanceTransaction[], fileId: string | null }> => await callAPI('getFinance', 'POST', { year }),
  addFinance: async (year: string, transaction: Partial<FinanceTransaction>): Promise<any> => await callAPI('addFinance', 'POST', { year, transaction }),
  createFinanceFile: async (year: string): Promise<any> => await callAPI('createFinanceFile', 'POST', { year }),
  getFinanceMeta: async (): Promise<FinanceMeta> => await callAPI('getFinanceMeta', 'GET'),
  addFinanceMeta: async (type: 'category' | 'payer', value: string): Promise<any> => await callAPI('addFinanceMeta', 'POST', { type, value })
};
