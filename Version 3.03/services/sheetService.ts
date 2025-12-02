
import { Order, Store, User, DashboardMetrics, DailyStat, StoreHistoryItem, SkuMapping, Role, AuthResponse } from '../types';

// ============================================================================
// CẤU HÌNH KẾT NỐI GOOGLE SHEET
// ============================================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbyw4ZdfirgKUHyXMH8Ro7UZ6-VWCdf1hgqU37ilLvNt2RwzusSPG_HUc_mi8z-9tInR/exec'; 
// ============================================================================

async function callAPI(action: string, method: string = 'POST', data: any = {}): Promise<any> {
  if (!API_URL) {
    console.warn(`API_URL is missing. Call to ${action} skipped.`);
    if (action === 'getDashboardStats') return { revenue: 0, netIncome: 0, inventoryValue: 0, debt: 0 };
    if (action === 'getStores') return [];
    if (action === 'getDailyStats') return [];
    if (action === 'getUnits') return [];
    if (action === 'getUsers') return [];
    if (action === 'getRoles') return [];
    if (action === 'getSkuMappings') return [];
    if (action === 'getStoreHistory') return [];
    if (action === 'getOrders') return { orders: [], fileId: null };
    return { success: false, error: 'API URL not configured in services/sheetService.ts' };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action, ...data }),
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error calling API ${action}:`, error);
    return { success: false, error: 'Network or API error' };
  }
}

export const sheetService = {
  getDashboardStats: async (): Promise<DashboardMetrics> => {
    return { revenue: 0, netIncome: 0, inventoryValue: 0, debt: 0 };
  },

  getStores: async (): Promise<Store[]> => {
    return await callAPI('getStores', 'GET');
  },

  getDailyStats: async (): Promise<DailyStat[]> => {
    return await callAPI('getDailyStats', 'GET');
  },

  triggerDebugSnapshot: async (): Promise<any> => {
    return await callAPI('debugSnapshot', 'POST');
  },

  addStore: async (store: Partial<Store>): Promise<any> => {
    return await callAPI('addStore', 'POST', store);
  },

  deleteStore: async (id: string): Promise<any> => {
    return await callAPI('deleteStore', 'POST', { id });
  },

  getUnits: async (): Promise<string[]> => {
    return await callAPI('getUnits', 'GET');
  },

  getUsers: async (): Promise<User[]> => {
    return await callAPI('getUsers', 'GET');
  },

  getOrders: async (month: string): Promise<{ orders: Order[], fileId: string }> => {
    return await callAPI('getOrders', 'GET', { month });
  },

  createMonthFile: async (month: string): Promise<any> => {
    return await callAPI('createMonthFile', 'POST', { month });
  },

  updateOrder: async (fileId: string, orderId: string, field: string, value: string): Promise<any> => {
    return await callAPI('updateOrder', 'POST', { fileId, orderId, field, value });
  },

  fulfillOrder: async (fileId: string, order: Order): Promise<any> => {
    return await callAPI('fulfillOrder', 'POST', { fileId, order });
  },

  updateOrderBatch: async (fileId: string, orderId: string, data: Partial<Order>): Promise<any> => {
    return await callAPI('updateOrderBatch', 'POST', { fileId, orderId, data });
  },

  addOrder: async (order: Order): Promise<any> => {
    return await callAPI('addOrder', 'POST', { order });
  },

  addUnit: async (name: string): Promise<any> => {
    return await callAPI('addUnit', 'POST', { name });
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    return await callAPI('login', 'POST', { username, password });
  },

  getRoles: async (): Promise<Role[]> => {
    return await callAPI('getRoles', 'GET');
  },

  createUser: async (user: any): Promise<any> => {
    return await callAPI('createUser', 'POST', user);
  },

  addRole: async (name: string, level: number): Promise<any> => {
    return await callAPI('addRole', 'POST', { name, level });
  },

  updateUser: async (username: string, role?: string, status?: string): Promise<any> => {
    return await callAPI('updateUser', 'POST', { username, role, status });
  },

  getStoreHistory: async (storeId: string): Promise<StoreHistoryItem[]> => {
    return await callAPI('getStoreHistory', 'GET', { storeId });
  },

  getSkuMappings: async (): Promise<SkuMapping[]> => {
    return await callAPI('getSkuMappings', 'GET');
  },

  updateSkuCategory: async (sku: string, category: string): Promise<any> => {
    return await callAPI('updateSkuCategory', 'POST', { sku, category });
  },

  changePassword: async (username: string, oldPass: string, newPass: string): Promise<any> => {
    return await callAPI('changePassword', 'POST', { username, oldPass, newPass });
  }
};
