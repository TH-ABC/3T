
import { Order, Store, User, DashboardMetrics, DailyStat, StoreHistoryItem, SkuMapping, Role, AuthResponse, FinanceTransaction, FinanceMeta, NewsItem, NewsComment, ScheduleStaff, AttendanceRecord, OTRecord, HandoverItem, UserNote, DailyNoteItem, PaymentRecord, PrintwayRecord, EbayRecord, GKERecord, StaffSalarySummary, HoldRecord } from '../types';
import { supabase } from '../lib/supabase';

const API_URL = 'https://script.google.com/macros/s/AKfycbyw4ZdfirgKUHyXMH8Ro7UZ6-VWCdf1hgqU37ilLvNt2RwzusSPG_HUc_mi8z-9tInR/exec'; 

async function callAPI(action: string, method: string = 'POST', data: any = {}, retries: number = 3): Promise<any> {
  if (!API_URL) return { success: false, error: 'API URL not configured' };

  let fetchUrl = API_URL;
  if (action === 'getOrders' && data.month) {
     const separator = fetchUrl.includes('?') ? '&' : '?';
     fetchUrl = `${fetchUrl}${separator}month=${encodeURIComponent(data.month)}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(fetchUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (parseError) {
        console.error(`JSON Parse Error for action ${action}:`, text.substring(0, 200));
        throw new Error('Invalid JSON response from server');
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    const isRetryable = retries > 0 && (
        error.name === 'AbortError' || 
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('Invalid JSON response') ||
        error.message.includes('Unexpected token')
    );

    if (isRetryable) {
        console.warn(`Retrying API ${action} (${retries} attempts left) due to: ${error.message}`);
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
        return callAPI(action, method, data, retries - 1);
    }
    
    console.error(`Error calling API ${action}:`, error);
    return { success: false, error: error.message || 'Network or API error' };
  }
}

export const sheetService = {
  // --- HANDOVER ---
  getHandover: async (date: string, viewerName?: string, viewerRole?: string): Promise<HandoverItem[]> => {
    try {
      let query = supabase.from('handovers').select('*');
      
      if (date) {
        query = query.eq('date', date);
      }

      // Role-based filtering logic (similar to DailyHandover.tsx)
      const role = (viewerRole || '').toLowerCase();
      if (role !== 'admin' && role !== 'leader' && role !== 'ceo' && viewerName) {
        query = query.eq('assignee', viewerName);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map(h => ({
        id: h.id,
        date: h.date,
        task: h.task,
        assignee: h.assignee,
        deadlineAt: h.deadline_at,
        status: h.status,
        startTime: h.start_time,
        endTime: h.end_time,
        report: h.report,
        fileLink: h.file_link,
        resultLink: h.result_link,
        imageLink: h.image_link,
        createdBy: h.created_by,
        isSeen: h.is_seen
      }));
    } catch (error) {
      console.error('Error in getHandover (Supabase):', error);
      // Fallback to Sheets if Supabase fails (optional, but user wants to fix "Failed to fetch" which is Sheets)
      return await callAPI('getHandover', 'POST', { date, viewerName, viewerRole });
    }
  },
  
  addHandover: async (item: Partial<HandoverItem>): Promise<any> => {
    try {
      const { error } = await supabase.from('handovers').insert({
        date: item.date || new Date().toISOString().split('T')[0],
        task: item.task,
        assignee: item.assignee,
        deadline_at: item.deadlineAt,
        status: item.status || 'Pending',
        file_link: item.fileLink,
        image_link: item.imageLink,
        created_by: item.createdBy
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error in addHandover (Supabase):', error);
      return await callAPI('addHandover', 'POST', item);
    }
  },
  updateHandover: async (id: string, updates: Partial<HandoverItem>): Promise<any> => {
    try {
      const { error } = await supabase.from('handovers').update({
        task: updates.task,
        assignee: updates.assignee,
        deadline_at: updates.deadlineAt,
        status: updates.status,
        start_time: updates.startTime,
        end_time: updates.endTime,
        report: updates.report,
        file_link: updates.fileLink,
        result_link: updates.resultLink,
        image_link: updates.imageLink,
        is_seen: updates.isSeen
      }).eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error in updateHandover (Supabase):', error);
      return await callAPI('updateHandover', 'POST', { id, updates });
    }
  },
  deleteHandover: async (id: string): Promise<any> => {
    try {
      const { error } = await supabase.from('handovers').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error in deleteHandover (Supabase):', error);
      return await callAPI('deleteHandover', 'POST', { id });
    }
  },
  markHandoverAsSeen: async (id: string): Promise<any> => {
    try {
      const { error } = await supabase.from('handovers').update({ is_seen: true }).eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error in markHandoverAsSeen (Supabase):', error);
      return await callAPI('markHandoverAsSeen', 'POST', { id });
    }
  },
  getUserNote: async (username: string, date: string): Promise<UserNote> => {
    try {
      const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('username', username)
        .eq('date', date)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        return {
          username: data.username,
          date: data.date,
          items: data.items || [],
          columns: data.columns || [],
          showPlanner: data.show_planner !== undefined ? data.show_planner : true
        };
      }
      return { username, date, items: [], columns: [], showPlanner: true };
    } catch (error: any) {
      console.error('Error in getUserNote (Supabase):', error);
      return await callAPI('getUserNote', 'POST', { username, date });
    }
  },
  saveUserNote: async (note: UserNote): Promise<any> => {
    try {
      const { error } = await supabase
        .from('user_notes')
        .upsert({
          username: note.username,
          date: note.date,
          items: note.items,
          columns: note.columns,
          show_planner: note.showPlanner
        }, { onConflict: 'username,date' });
      
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error in saveUserNote (Supabase):', error);
      return await callAPI('saveUserNote', 'POST', note);
    }
  },

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
    try {
      const { data: newsData, error: newsError } = await supabase
        .from('news')
        .select(`
          *,
          news_likes (username),
          news_comments (*)
        `)
        .order('created_at', { ascending: false });

      if (newsError) throw newsError;

      const transformedNews: NewsItem[] = (newsData || []).map(item => ({
        id: item.id,
        title: item.title,
        content: item.content,
        imageUrl: item.image_url,
        author: item.author,
        timestamp: new Date(item.created_at).toLocaleString('vi-VN'),
        isLocked: item.is_locked,
        likesCount: item.news_likes?.length || 0,
        isLiked: item.news_likes?.some((l: any) => l.username === username),
        comments: (item.news_comments || []).map((c: any) => ({
          id: c.id,
          newsId: c.news_id,
          username: c.username,
          text: c.text,
          timestamp: new Date(c.created_at).toLocaleString('vi-VN')
        })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      }));

      // For lastReadTime, we might need a separate table or just use 0 for now
      return { news: transformedNews, lastReadTime: 0 };
    } catch (error) {
      console.error('Error in getNews (Supabase):', error);
      const res = await callAPI('getNews', 'POST', { username });
      if (res && res.news) {
          return { news: res.news, lastReadTime: res.lastReadTime || 0 };
      }
      return { news: [], lastReadTime: 0 };
    }
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
  getStores: async (): Promise<Store[]> => {
    try {
      const { data, error } = await supabase.from('stores').select('*');
      if (error) throw error;
      return (data || []).map(s => ({
        id: s.id,
        name: s.name,
        url: s.url,
        region: s.region,
        status: s.status,
        listing: s.listing,
        sale: s.sale
      }));
    } catch (error) {
      console.error('Error in getStores (Supabase):', error);
      return await callAPI('getStores', 'GET');
    }
  },
  getDailyStats: async (): Promise<DailyStat[]> => await callAPI('getDailyStats', 'GET'),
  triggerDebugSnapshot: async (): Promise<any> => await callAPI('debugSnapshot', 'POST'),
  addStore: async (store: Partial<Store>): Promise<any> => await callAPI('addStore', 'POST', store),
  deleteStore: async (id: string): Promise<any> => await callAPI('deleteStore', 'POST', { id }),
  getUnits: async (): Promise<string[]> => await callAPI('getUnits', 'GET'),
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      
      if (error) throw error;

      return (data || []).map(profile => ({
        username: profile.username,
        fullName: profile.full_name,
        role: profile.role,
        permissions: profile.permissions || {},
        status: profile.status || 'Active',
        email: profile.email,
        phone: profile.phone || '',
      }));
    } catch (error) {
      console.error('Error in getUsers (Supabase):', error);
      return await callAPI('getUsers', 'GET');
    }
  },
  getOrders: async (month: string): Promise<{ orders: Order[], fileId: string }> => await callAPI('getOrders', 'GET', { month }),
  createMonthFile: async (month: string): Promise<any> => await callAPI('createMonthFile', 'POST', { month }),
  updateOrder: async (fileId: string, orderId: string, field: string, value: string, rowNumber?: number): Promise<any> => await callAPI('updateOrder', 'POST', { fileId, orderId, field, value, rowNumber }),
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
  getSkuMappings: async (): Promise<SkuMapping[]> => {
    try {
      const { data, error } = await supabase.from('sku_mappings').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        return data.map(m => ({
          sku: m.sku,
          category: m.category
        }));
      }
      return await callAPI('getSkuMappings', 'GET');
    } catch (error) {
      console.error('Error in getSkuMappings (Supabase):', error);
      return await callAPI('getSkuMappings', 'GET');
    }
  },
  updateSkuCategory: async (sku: string, category: string): Promise<any> => await callAPI('updateSkuCategory', 'POST', { sku, category }),
  getPriceMappings: async (): Promise<{category: string, price: number}[]> => {
    try {
      const { data, error } = await supabase.from('price_mappings').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        return data.map(p => ({
          category: p.category,
          price: Number(p.price) || 0
        }));
      }
      return await callAPI('getPriceMappings', 'GET');
    } catch (error) {
      console.error('Error in getPriceMappings (Supabase):', error);
      return await callAPI('getPriceMappings', 'GET');
    }
  },
  updateCategoryPrice: async (category: string, price: number): Promise<any> => await callAPI('updateCategoryPrice', 'POST', { category, price }),
  changePassword: async (username: string, oldPass: string, newPass: string): Promise<any> => await callAPI('changePassword', 'POST', { username, oldPass, newPass }),
  updateDesignerOnlineFields: async (fileId: string, orderId: string, updates: any, rowNumber?: number): Promise<any> => await callAPI('handleUpdateDesignerOnlineFields', 'POST', { fileId, orderId, rowNumber, ...updates }),
};
