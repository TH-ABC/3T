
import { Order, OrderStatus, DailyRevenue, Store, User, AuthResponse, DailyStat, StoreHistoryItem, Role } from '../types';

// ============================================================================
// CẤU HÌNH KẾT NỐI GOOGLE SHEET
// ============================================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbyw4ZdfirgKUHyXMH8Ro7UZ6-VWCdf1hgqU37ilLvNt2RwzusSPG_HUc_mi8z-9tInR/exec'; 
// ============================================================================

const callAPI = async (action: string, method: 'GET' | 'POST' = 'GET', data?: any, fetchOptions: { keepalive?: boolean } = { keepalive: false }) => {
  const cleanUrl = API_URL.trim();
  if (cleanUrl.includes('HAY_DAN_URL') || !cleanUrl) {
    console.warn("Chưa cấu hình API URL Google Apps Script.");
    return [];
  }

  const nocache = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  let url = `${cleanUrl}?action=${action}&_t=${nocache}`;
  
  if (method === 'GET' && data) {
    const params = new URLSearchParams(data).toString();
    url += `&${params}`;
  }
  
  const options: RequestInit = {
    method: method,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    keepalive: fetchOptions.keepalive // Mặc định là false để đảm bảo ổn định
  };

  if (method === 'POST') {
    options.body = JSON.stringify({ action: action, ...data });
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      
      // Xử lý lỗi trả về từ Backend
      if (json && json.error) return { success: false, error: json.error };
      
      // Xử lý trường hợp Backend không hiểu lệnh (trả về object rỗng {})
      // Nguyên nhân thường do chưa New Deployment code mới
      if (json && Object.keys(json).length === 0) {
          return { success: false, error: "Backend chưa cập nhật. Vui lòng vào Google Apps Script > Deploy > New deployment." };
      }

      return json;
    } catch (e) {
      return { success: false, error: "Lỗi phản hồi từ Google Sheet (JSON Parse Error)." };
    }
  } catch (error) {
    return { success: false, error: "Lỗi kết nối mạng hoặc bị chặn bởi trình duyệt." };
  }
};

const parseSheetNumber = (val: any): string => {
  if (val === null || val === undefined || val === '') return '0';
  if (typeof val === 'number') return String(val);
  const str = String(val).trim().replace(/,/g, '');
  const num = Number(str); 
  return isNaN(num) ? '0' : String(num);
};

const getClientIP = async (): Promise<string> => {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'Unknown';
    } catch (error) { return 'Unknown'; }
};

export const sheetService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const userIP = await getClientIP();
    const result = await callAPI('login', 'POST', { username, password, ip: userIP });
    if (result.success && result.user) return { success: true, user: result.user };
    return { success: false, error: result.error || 'Đăng nhập thất bại' };
  },

  // --- USER MANAGEMENT ---
  createUser: async (userData: any): Promise<AuthResponse> => {
    return await callAPI('createUser', 'POST', userData);
  },

  getUsers: async (): Promise<User[]> => {
    const data = await callAPI('getUsers', 'GET');
    if (Array.isArray(data)) {
        return data.map((u: any) => ({
            username: u.username,
            fullName: u.fullName,
            role: u.role,
            email: u.email,
            phone: u.phone,
            status: u.status || 'Active'
        }));
    }
    return [];
  },

  updateUser: async (username: string, role?: string, status?: string): Promise<any> => {
    return await callAPI('updateUser', 'POST', { username, role, status });
  },
  // -----------------------

  // --- ROLE MANAGEMENT ---
  getRoles: async (): Promise<Role[]> => {
    const data = await callAPI('getRoles', 'GET');
    return Array.isArray(data) ? data : [];
  },

  addRole: async (roleName: string, level: number): Promise<any> => {
    return await callAPI('addRole', 'POST', { role: roleName, level: level });
  },
  // -----------------------

  // GET ORDERS: Hỗ trợ lấy theo tháng và trả về fileId
  getOrders: async (monthYear?: string): Promise<{ orders: Order[], fileId: string | null }> => {
    const targetMonth = monthYear || new Date().toISOString().slice(0, 7);
    const data = await callAPI('getOrders', 'GET', { month: targetMonth });
    
    // Helper function để map dữ liệu từ API sang object Order
    const mapOrder = (item: any): Order => ({
        date: item.date ? String(item.date) : '',        
        id: String(item.id || ''),                        
        storeId: String(item.storeId || ''),              
        type: String(item.type || ''),                    
        sku: String(item.sku || ''),                      
        quantity: item.quantity || '1',                   
        tracking: String(item.tracking || ''),            
        isChecked: item.isChecked === true || item.isChecked === "TRUE", 
        link: item.link || '',                            
        status: item.status || 'Pending',                 
        note: item.note || '',                            
        handler: item.handler || item.user || '',         
        actionRole: item.actionRole || ''                 
    });

    // Xử lý dữ liệu trả về
    if (data) {
        // Trường hợp 1: Backend trả về cấu trúc chuẩn { orders: [...], fileId: "..." }
        if (data.orders && Array.isArray(data.orders)) {
            return { orders: data.orders.map(mapOrder), fileId: data.fileId || null };
        }
        
        // Trường hợp 2: Backend trả về mảng trực tiếp [...] (Legacy / Code cũ)
        if (Array.isArray(data)) {
            return { orders: data.map(mapOrder), fileId: null };
        }
    }
    
    return { orders: [], fileId: null };
  },

  addOrder: async (order: Order): Promise<Order> => {
    // Trích xuất tháng (YYYY-MM) từ ngày đặt hàng
    const month = (order.date && order.date.length >= 7) 
        ? order.date.substring(0, 7) 
        : new Date().toISOString().substring(0, 7);

    // QUAN TRỌNG: Không dùng keepalive để có thể nhận phản hồi lỗi
    const result = await callAPI('addOrder', 'POST', {
        ...order,
        user: order.handler, 
        month: month         
    }, { keepalive: false });

    // Nếu backend trả về lỗi, ném lỗi ra để Frontend bắt được (quan trọng cho logic Multi-file)
    if (result && result.success === false) {
        throw new Error(result.error || "Lỗi khi thêm đơn hàng");
    }

    return order;
  },

  // Update a specific field of an order directly to Google Sheet
  updateOrder: async (fileId: string, orderId: string, field: string, value: any): Promise<any> => {
    return await callAPI('updateOrder', 'POST', { fileId, orderId, field, value });
  },

  // Update multiple fields for a single order (BATCH UPDATE - Single Request)
  updateOrderBatch: async (fileId: string, orderId: string, data: Partial<Order>): Promise<any> => {
    return await callAPI('updateOrderRow', 'POST', { fileId, orderId, data });
  },

  // Manual trigger to create a month file
  createMonthFile: async (month: string): Promise<any> => {
    // Disable keepalive for manual actions to ensure we get immediate feedback/error
    return await callAPI('createMonthFile', 'POST', { month }, { keepalive: false });
  },

  // --- QUẢN LÝ ĐƠN VỊ (UNITS) ---
  getUnits: async (): Promise<string[]> => {
    const data = await callAPI('getUnits', 'GET');
    return Array.isArray(data) ? data : [];
  },

  addUnit: async (unit: string): Promise<any> => {
    return await callAPI('addUnit', 'POST', { unit });
  },
  // ------------------------------

  getStores: async (): Promise<Store[]> => {
    const data = await callAPI('getStores', 'GET');
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
          id: String(item.id || ''),
          name: item.name,
          url: item.url,
          region: item.region || '', 
          status: item.status || 'LIVE',
          listing: parseSheetNumber(item.listing),
          sale: parseSheetNumber(item.sale)
      }));
    }
    return [];
  },

  addStore: async (storeData: any): Promise<Store> => {
    const newStore: Store = {
      id: `ST-${Date.now().toString().slice(-6)}`,
      name: storeData.name,
      url: storeData.url,
      region: storeData.region,
      status: 'LIVE', listing: '0', sale: '0'
    };
    await callAPI('addStore', 'POST', newStore);
    return newStore;
  },

  deleteStore: async (storeId: string): Promise<any> => {
    return await callAPI('deleteStore', 'POST', { id: storeId });
  },

  getDailyStats: async (): Promise<DailyStat[]> => {
    const data = await callAPI('getDailyStats', 'GET');
    return Array.isArray(data) ? data : [];
  },
  
  getStoreHistory: async (storeId: string): Promise<StoreHistoryItem[]> => {
    const data = await callAPI('getStoreHistory', 'POST', { storeId });
    return Array.isArray(data) ? data : [];
  },

  triggerDebugSnapshot: async (): Promise<any> => {
      return await callAPI('debugSnapshot', 'POST', {});
  },

  getDashboardStats: async () => {
    const stores = await sheetService.getStores();
    const totalSalesCount = stores.reduce((sum, s) => sum + (Number(s.sale.replace(/,/g,'')) || 0), 0);
    const revenue = totalSalesCount * 500000;
    return { revenue, netIncome: revenue * 0.3, inventoryValue: 55000000, debt: 0 };
  },

  getDailyRevenue: async (): Promise<DailyRevenue[]> => {
    try {
      const stats = await sheetService.getDailyStats();
      if (!stats || stats.length < 2) return [];

      const sortedStats = [...stats].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const dailyRevenue: DailyRevenue[] = [];
      const AVERAGE_ORDER_VALUE = 500000; 

      for (let i = 1; i < sortedStats.length; i++) {
        const prev = sortedStats[i - 1];
        const curr = sortedStats[i];
        
        const saleDelta = Math.max(0, curr.totalSale - prev.totalSale);
        
        dailyRevenue.push({
          date: curr.date,
          amount: saleDelta * AVERAGE_ORDER_VALUE
        });
      }

      return dailyRevenue;
    } catch (error) {
      console.error("Error calculating daily revenue:", error);
      return [];
    }
  }
};
