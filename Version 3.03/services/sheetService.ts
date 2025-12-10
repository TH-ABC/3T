
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
    if (action === 'getPriceMappings') return [];
    if (action === 'getStoreHistory') return [];
    if (action === 'getOrders') return { orders: [], fileId: null };
    return { success: false, error: 'API URL not configured in services/sheetService.ts' };
  }

  // PATCH: Sửa lỗi Backend Google Apps Script
  let fetchUrl = API_URL;
  if (action === 'getOrders' && data.month) {
     const separator = fetchUrl.includes('?') ? '&' : '?';
     fetchUrl = `${fetchUrl}${separator}month=${encodeURIComponent(data.month)}`;
  }

  try {
    const response = await fetch(fetchUrl, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit', // Fix CORS issues
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

  // NEW: Hàm cập nhật trạng thái Designer và lưu sang sheet riêng
  updateDesignerStatus: async (fileId: string, order: Order, sheetName: string, isDone: boolean): Promise<any> => {
    return await callAPI('updateDesignerStatus', 'POST', { 
        fileId, 
        order, 
        sheetName, 
        isDone 
    });
  },

  // NEW: BATCH UPDATE cho Order (Cột Checkbox, Fulfilled...)
  batchUpdateOrder: async (fileId: string, orderIds: string[], field: string, value: any): Promise<any> => {
    return await callAPI('batchUpdateOrder', 'POST', {
        fileId,
        orderIds,
        field,
        value: value ? "TRUE" : "FALSE"
    });
  },

  // NEW: BATCH UPDATE cho Designer (Đồng bộ sheet con)
  batchUpdateDesigner: async (fileId: string, orderIds: string[], value: any): Promise<any> => {
    return await callAPI('batchUpdateDesigner', 'POST', {
        fileId,
        orderIds,
        value: value ? "TRUE" : "FALSE"
    });
  },

  fulfillOrder: async (fileId: string, order: Order): Promise<any> => {
    return await callAPI('fulfillOrder', 'POST', { fileId, ...order });
  },

  addOrder: async (order: Order, fileId?: string): Promise<any> => {
    return await callAPI('addOrder', 'POST', { ...order, isDesignDone: order.isDesignDone || false, fileId });
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

  updateUser: async (username: string, role?: string, status?: string, permissions?: any): Promise<any> => {
    return await callAPI('updateUser', 'POST', { username, role, status, permissions });
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

  // --- PRICE MAPPING ---
  getPriceMappings: async (): Promise<{category: string, price: number}[]> => {
    return await callAPI('getPriceMappings', 'GET');
  },

  updateCategoryPrice: async (category: string, price: number): Promise<any> => {
    return await callAPI('updateCategoryPrice', 'POST', { category, price });
  },

  changePassword: async (username: string, oldPass: string, newPass: string): Promise<any> => {
    return await callAPI('changePassword', 'POST', { username, oldPass, newPass });
  }
};
