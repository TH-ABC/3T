import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Copy, ArrowUp, ArrowDown, Calendar, UserCircle, ChevronLeft, ChevronRight, Settings, Save, X, Loader2, CheckCircle, AlertCircle, Filter, ArrowDownAZ, ArrowUpAZ, AlertTriangle, Info, FileSpreadsheet, DollarSign, CheckSquare, Square, Users, Layers, Code, PenTool, Edit, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, Store, User } from '../types';

const getCurrentLocalMonth = () => { 
  const now = new Date(); 
  const year = now.getFullYear(); 
  const month = String(now.getMonth() + 1).padStart(2, '0'); 
  return `${year}-${month}`; 
};

interface DesignerListProps { 
  user: User; 
  onProcessStart?: () => void; 
  onProcessEnd?: () => void; 
}

export const DesignerList: React.FC<DesignerListProps> = ({ user, onProcessStart, onProcessEnd }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [skuMap, setSkuMap] = useState<Record<string, string>>({}); 
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<{ message: string, detail?: string } | null>(null);
  const [tableExists, setTableExists] = useState<boolean>(true);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterSearchTerm, setFilterSearchTerm] = useState(''); 
  const [filterPopupPos, setFilterPopupPos] = useState<{ top: number, left: number } | null>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentLocalMonth());
  const selectedMonthRef = useRef<string>(selectedMonth);
  
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [updatingLinkDsIds, setUpdatingLinkDsIds] = useState<Set<string>>(new Set());
  const [updatingCheckIds, setUpdatingCheckIds] = useState<Set<string>>(new Set());
  const [updatingUrlArtworkFrontIds, setUpdatingUrlArtworkFrontIds] = useState<Set<string>>(new Set());
  const [updatingUrlMockupIds, setUpdatingUrlMockupIds] = useState<Set<string>>(new Set());
  
  const [editingLinkDs, setEditingLinkDs] = useState<Record<string, string>>({});
  const [editingUrlArtworkFront, setEditingUrlArtworkFront] = useState<Record<string, string>>({});
  const [editingUrlMockup, setEditingUrlMockup] = useState<Record<string, string>>({});
  const [editingDesignerNote, setEditingDesignerNote] = useState<Record<string, string>>({});
  const [updatingDesignerNoteIds, setUpdatingDesignerNoteIds] = useState<Set<string>>(new Set());
  
  const [activeCheckDropdown, setActiveCheckDropdown] = useState<string | null>(null);
  const [tempCheckSelections, setTempCheckSelections] = useState<Record<string, string>>({});
  const [editingNoteIds, setEditingNoteIds] = useState<Set<string>>(new Set());
  const checkDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);
  const [skuFormData, setSkuFormData] = useState({ sku: '', category: 'Loại 1' });
  const [isSubmittingSku, setIsSubmittingSku] = useState(false);
  const [skuMessage, setSkuMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [tempPriceMap, setTempPriceMap] = useState<Record<string, number>>({});
  const [isSavingPrices, setIsSavingPrices] = useState(false);

  const PRICE_CATEGORIES = ['Loại 1', 'Loại 2', 'Loại 3', 'Loại 4'];
  const allowedDesignerOnlineChecks = ['Done Oder', 'Done Mockup', 'Done Artwork', 'Done All'];

  const getStoreName = (id: string) => { 
    const store = stores.find(s => String(s.id) === String(id) || s.name === id); 
    return store ? store.name : id; 
  };
  
  const normalizeKey = (key: any) => key !== undefined && key !== null ? String(key).toLowerCase().trim() : '';
  const getTableName = (month: string) => `designer_orders_${month.replace('-', '_')}`;

  const loadData = async (monthToFetch: string) => {
    setLoading(true); 
    setOrders([]); 
    setDataError(null); 
    setSelectedOrderIds(new Set());
    const tableName = getTableName(monthToFetch);
    
    try {
      // 1. Kiểm tra bảng tồn tại
      const { data: exists, error: checkError } = await supabase.rpc('check_table_exists', { target_table_name: tableName });
      
      if (checkError) throw checkError;
      setTableExists(!!exists);

      if (!exists) {
        setLoading(false);
        return;
      }

      // 2. Tải dữ liệu từ bảng động
      const [ordersRes, storesRes, profilesRes, skuRes, priceRes] = await Promise.all([
        supabase.from(tableName).select('*').ilike('date', `%${monthToFetch}%`),
        supabase.from('stores').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('sku_mappings').select('*'),
        supabase.from('price_mappings').select('*')
      ]);

      if (selectedMonthRef.current !== monthToFetch) return;

      if (ordersRes.error) throw ordersRes.error;
      
      setStores(storesRes.data || []);
      setUsers(profilesRes.data || []);
      
      const mappingObj: Record<string, string> = {};
      (skuRes.data || []).forEach(m => { mappingObj[normalizeKey(m.sku)] = String(m.category).trim(); });
      setSkuMap(mappingObj);

      const priceObj: Record<string, number> = {};
      (priceRes.data || []).forEach(p => { priceObj[normalizeKey(p.category)] = Number(p.price) || 0; });
      setPriceMap(priceObj);

      const rawOrders: Order[] = (ordersRes.data || []).map(o => ({
        id: o.id,
        date: o.date,
        storeId: o.store_id,
        sku: o.sku,
        linkDs: o.link_ds,
        check: o.check,
        designerNote: o.designer_note,
        productUrl: o.product_url,
        optionsText: o.options_text,
        urlArtworkFront: o.url_artwork_front,
        urlMockup: o.url_mockup,
        handler: o.handler,
        actionRole: o.action_role,
        isDesignDone: o.is_design_done,
        tracking: '',
        status: 'Active'
      }));

      const currentUsername = (user.username || '').toLowerCase().trim();
      const userRole = (user.role || '').toLowerCase().trim();
      
      let filtered = rawOrders;
      if (userRole !== 'admin') {
          const scope = user.permissions?.designer;
          if (scope === 'none') {
              filtered = [];
          } else if (scope === 'own') {
              filtered = rawOrders.filter(o => (o.actionRole || '').toLowerCase().trim() === currentUsername);
          }
      }
      
      setOrders(filtered);
    } catch (e: any) { 
      console.error("Load Data Error:", e);
      setDataError({ message: "Lỗi tải dữ liệu từ Supabase", detail: e.message });
    } finally { 
      if (selectedMonthRef.current === monthToFetch) setLoading(false); 
    }
  };

  const handleCreateTable = async () => {
    const tableName = getTableName(selectedMonth);
    setIsCreatingTable(true);
    try {
      const { error } = await supabase.rpc('create_monthly_designer_table', { target_table_name: tableName });
      if (error) throw error;
      alert(`Đã tạo bảng ${tableName} thành công!`);
      loadData(selectedMonth);
    } catch (e: any) {
      alert("Lỗi tạo bảng: " + e.message);
    } finally {
      setIsCreatingTable(false);
    }
  };

  useEffect(() => { 
    selectedMonthRef.current = selectedMonth; 
    loadData(selectedMonth); 
  }, [selectedMonth, user.username]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPopupRef.current && !filterPopupRef.current.contains(event.target as Node)) {
        setActiveFilterColumn(null);
        setFilterPopupPos(null);
      }
      if (checkDropdownRef.current && !checkDropdownRef.current.contains(event.target as Node)) {
        if (activeCheckDropdown) {
          const order = orders.find(o => o.id === activeCheckDropdown);
          if (order) {
            const finalValue = tempCheckSelections[order.id] ?? order.check ?? '';
            if (finalValue !== (order.check || '')) {
              handleUpdateCheck(order, finalValue);
            }
          }
          setActiveCheckDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeCheckDropdown, tempCheckSelections, orders]);

  const getPriceForCategory = (categoryName: string) => { 
    if (!categoryName) return 0; 
    return priceMap[normalizeKey(categoryName)] || 0; 
  };
  
  const handleUpdateCheck = async (order: Order, newValue: string) => {
    const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
    const allowedChecks = (user.permissions?.allowedDesignerOnlineChecks || '').split(',').map(s => s.trim()).filter(s => s !== '');
    
    const currentValues = (order.check || '').split(',').map(s => s.trim()).filter(s => s !== '');
    const newValues = newValue.split(',').map(s => s.trim()).filter(s => s !== '');
    
    if (!isAdmin) {
        const isSettingDoneOder = newValue === 'Done Oder';
        if (!isSettingDoneOder) {
            const addedValues = newValues.filter(v => !currentValues.includes(v));
            const isAddingAllowed = addedValues.every(v => v === 'Done Oder' || allowedChecks.includes(v));
            const removedValues = currentValues.filter(v => !newValues.includes(v));
            const isRemovingAllowed = removedValues.every(v => v === 'Done Oder' || allowedChecks.includes(v));

            if (!isAddingAllowed || !isRemovingAllowed) {
                alert('Bạn không có quyền thực hiện thay đổi này.');
                return;
            }
        }
    }

    const finalValue = newValue === 'Done Oder' ? 'Done Oder' : newValue;

    if (onProcessStart) onProcessStart();
    setUpdatingCheckIds(prev => new Set(prev).add(order.id));
    const tableName = getTableName(selectedMonth);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ check: finalValue })
        .eq('id', order.id);
      
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, check: finalValue } : o));
    } catch (e: any) {
      alert("Lỗi cập nhật Check: " + e.message);
    } finally {
      setUpdatingCheckIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  const handleUpdateDesignerNote = async (order: Order) => {
    const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
    if (!isAdmin && !user.permissions?.canEditDesignerOnlineNote) {
        alert('Bạn không có quyền chỉnh sửa cột Note.');
        return;
    }

    const newValue = editingDesignerNote[order.id] ?? order.designerNote ?? '';
    setUpdatingDesignerNoteIds(prev => new Set(prev).add(order.id));
    if (onProcessStart) onProcessStart();
    const tableName = getTableName(selectedMonth);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ designer_note: newValue })
        .eq('id', order.id);
      
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, designerNote: newValue } : o));
      setEditingNoteIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    } catch (e: any) {
      alert("Lỗi cập nhật Note: " + e.message);
    } finally {
      setUpdatingDesignerNoteIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  const handleUpdateLinkDs = async (order: Order) => {
    const newValue = editingLinkDs[order.id] ?? order.linkDs ?? '';
    setUpdatingLinkDsIds(prev => new Set(prev).add(order.id));
    if (onProcessStart) onProcessStart();
    const tableName = getTableName(selectedMonth);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ link_ds: newValue })
        .eq('id', order.id);
      
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, linkDs: newValue } : o));
      setEditingLinkDs(prev => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    } catch (e: any) {
      alert("Lỗi cập nhật Link DS: " + e.message);
    } finally {
      setUpdatingLinkDsIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  const handleDesignerToggle = async (order: Order) => {
    const newValue = !order.isDesignDone;
    setUpdatingIds(prev => new Set(prev).add(order.id));
    if (onProcessStart) onProcessStart();
    const tableName = getTableName(selectedMonth);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ is_design_done: newValue })
        .eq('id', order.id);
      
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isDesignDone: newValue } : o));
    } catch (e: any) {
      alert("Lỗi cập nhật trạng thái: " + e.message);
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  const handleBatchAction = async (actionType: 'design_done' | 'design_pending') => {
      if (selectedOrderIds.size === 0) return;
      const idsToUpdate = Array.from(selectedOrderIds);
      const newValue = actionType === 'design_done';
      setIsBatchProcessing(true);
      if (onProcessStart) onProcessStart();
      const tableName = getTableName(selectedMonth);
      try {
          const { error } = await supabase
              .from(tableName)
              .update({ is_design_done: newValue })
              .in('id', idsToUpdate);
          
          if (error) throw error;
          setOrders(prev => prev.map(o => idsToUpdate.includes(o.id) ? { ...o, isDesignDone: newValue } : o));
          alert(`Đã cập nhật ${idsToUpdate.length} đơn hàng.`);
          setSelectedOrderIds(new Set());
      } catch (error: any) { alert('Có lỗi xảy ra khi cập nhật hàng loạt: ' + error.message); } 
      finally { setIsBatchProcessing(false); if (onProcessEnd) onProcessEnd(); }
  };

  const handleUpdateSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuFormData.sku.trim()) return;
    setIsSubmittingSku(true);
    try {
      const { error } = await supabase
        .from('sku_mappings')
        .upsert({ sku: skuFormData.sku.trim(), category: skuFormData.category });
      
      if (error) throw error;
      setSkuMessage({ type: 'success', text: 'Cập nhật thành công' });
      loadData(selectedMonth);
      setTimeout(() => setIsSkuModalOpen(false), 1000);
    } catch (e: any) {
      setSkuMessage({ type: 'error', text: e.message });
    } finally {
      setIsSubmittingSku(false);
    }
  };

  const handleSavePrices = async () => {
    setIsSavingPrices(true);
    try {
      for (const [cat, price] of Object.entries(tempPriceMap)) {
        await supabase.from('price_mappings').upsert({ category: cat, price });
      }
      setIsPriceModalOpen(false);
      loadData(selectedMonth);
    } catch (e: any) {
      alert("Lỗi lưu giá: " + e.message);
    } finally {
      setIsSavingPrices(false);
    }
  };

  const stats = useMemo(() => {
    const res = {
      totalOrders: 0,
      totalMoney: 0,
      categories: {} as Record<string, { total: number, checked: number, money: number }>
    };
    PRICE_CATEGORIES.forEach(c => res.categories[c] = { total: 0, checked: 0, money: 0 });
    res.categories['Khác'] = { total: 0, checked: 0, money: 0 };

    orders.forEach(o => {
      const cat = skuMap[normalizeKey(o.sku)] || 'Khác';
      const price = getPriceForCategory(cat);
      res.totalOrders++;
      res.totalMoney += price;
      if (res.categories[cat]) {
        res.categories[cat].total++;
        res.categories[cat].money += price;
        if (o.isDesignDone) res.categories[cat].checked++;
      }
    });
    return res;
  }, [orders, skuMap, priceMap]);

  const filteredOrders = orders.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getStoreName(o.storeId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedOrdersResult = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const valA = String(a[sortConfig.key] || '');
      const valB = String(b[sortConfig.key] || '');
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortConfig]);

  const formatPrice = (price: number) => price.toLocaleString('vi-VN') + ' đ';

  return (
    <div className="p-4 bg-gray-100 min-h-screen relative pb-20">
      <div className="bg-white shadow-sm overflow-hidden rounded-lg flex flex-col h-full">
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex flex-col xl:flex-row gap-6">
            <div className="flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="bg-indigo-600 text-white rounded p-3 shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-xs opacity-80 uppercase">Tổng Đơn</span>
                  <span className="text-xl font-bold">{stats.totalOrders}</span>
                </div>
                <div className="bg-emerald-600 text-white rounded p-3 shadow-sm flex flex-col justify-center items-center text-center">
                  <span className="text-xs opacity-80 uppercase">Tổng Tiền</span>
                  <span className="text-lg font-bold">{formatPrice(stats.totalMoney)}</span>
                </div>
                {PRICE_CATEGORIES.map(cat => (
                  <div key={cat} className="bg-gray-50 border border-gray-200 rounded p-3 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase">{cat}</span>
                    <div className="flex justify-between items-end mt-1">
                      <span className="text-sm font-bold text-gray-800">{stats.categories[cat].total}</span>
                      <span className="text-[10px] text-blue-600 font-bold">{stats.categories[cat].checked} Check</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white z-20">
          <div className="flex items-center gap-4 w-full xl:w-auto">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              DESIGNER <span className="text-orange-600 text-sm bg-orange-50 px-2 py-0.5 rounded border border-orange-100 uppercase">Supabase</span>
              <button onClick={() => loadData(selectedMonth)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </h2>
            <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm p-1">
              <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500"><ChevronLeft size={18} /></button>
              <div className="px-4 font-bold text-sm text-gray-700 border-x border-gray-100">Tháng {selectedMonth}</div>
              <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500"><ChevronRight size={18} /></button>
            </div>
            <button onClick={() => setIsSkuModalOpen(true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"><Settings size={20}/></button>
            <button onClick={() => setIsPriceModalOpen(true)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"><DollarSign size={20}/></button>
            
            {!tableExists && (
              <button 
                onClick={handleCreateTable} 
                disabled={isCreatingTable}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 animate-pulse"
              >
                {isCreatingTable ? <Loader2 size={18} className="animate-spin" /> : <Layers size={18} />}
                Tạo Bảng Tháng {selectedMonth}
              </button>
            )}

            {selectedOrderIds.size > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1 animate-fade-in">
                <span className="text-xs font-bold text-orange-700">{selectedOrderIds.size} đã chọn</span>
                <div className="flex gap-1">
                  <button onClick={() => handleBatchAction('design_done')} disabled={isBatchProcessing} className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"><CheckCircle size={14}/></button>
                  <button onClick={() => handleBatchAction('design_pending')} disabled={isBatchProcessing} className="p-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"><X size={14}/></button>
                </div>
              </div>
            )}
          </div>
          <div className="relative w-full xl:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Tìm ID, SKU..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-300px)] custom-scrollbar">
          <table className="w-full text-left border-collapse text-[11px] relative">
            <thead className="text-white font-bold text-center uppercase tracking-wider sticky top-0 z-20">
              <tr className="bg-[#1a4019]">
                <th className="px-2 py-3 border-r border-gray-600 w-10">
                  <button onClick={() => {
                    if (selectedOrderIds.size === sortedOrdersResult.length && sortedOrdersResult.length > 0) setSelectedOrderIds(new Set());
                    else setSelectedOrderIds(new Set(sortedOrdersResult.map(o => o.id)));
                  }} className="p-1 hover:bg-white/10 rounded">
                    {selectedOrderIds.size === sortedOrdersResult.length && sortedOrdersResult.length > 0 ? <CheckSquare size={14}/> : <Square size={14}/>}
                  </button>
                </th>
                <th className="px-2 py-3 border-r border-gray-600 w-24">ID Order</th>
                <th className="px-2 py-3 border-r border-gray-600">Store</th>
                <th className="px-2 py-3 border-r border-gray-600">SKU</th>
                <th className="px-2 py-3 border-r border-gray-600 w-20">PL</th>
                <th className="px-2 py-3 border-r border-gray-600 w-24">Link DS</th>
                <th className="px-2 py-3 border-r border-gray-600 w-24">Check</th>
                <th className="px-2 py-3 border-r border-gray-600 w-[75ch]">Note</th>
                <th className="px-2 py-3 border-r border-gray-600 w-10">CHK</th>
                <th className="px-2 py-3 border-r border-gray-600 w-20">NXL</th>
                <th className="px-2 py-3 w-20">AR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-20 text-gray-400 font-medium">Đang tải dữ liệu từ Supabase...</td></tr>
              ) : !tableExists ? (
                <tr>
                  <td colSpan={11} className="text-center py-32">
                    <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                      <div className="p-6 bg-rose-50 rounded-full text-rose-600">
                        <AlertTriangle size={48} />
                      </div>
                      <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Bảng dữ liệu chưa tồn tại</h3>
                      <p className="text-sm text-gray-500 font-medium">Dữ liệu cho tháng <span className="text-rose-600 font-bold">{selectedMonth}</span> chưa được khởi tạo trong hệ thống Supabase.</p>
                      <button 
                        onClick={handleCreateTable}
                        disabled={isCreatingTable}
                        className="mt-2 flex items-center gap-2 px-8 py-3 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 disabled:opacity-50"
                      >
                        {isCreatingTable ? <Loader2 size={20} className="animate-spin" /> : <Layers size={20} />}
                        Khởi tạo bảng ngay
                      </button>
                    </div>
                  </td>
                </tr>
              ) : sortedOrdersResult.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-20 text-gray-400 italic">Không tìm thấy đơn hàng nào.</td></tr>
              ) : sortedOrdersResult.map((order) => {
                const category = skuMap[normalizeKey(order.sku)] || 'Khác';
                const isSelected = selectedOrderIds.has(order.id);
                return (
                  <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}>
                    <td className="px-2 py-2 border-r text-center">
                      <button onClick={() => {
                        const next = new Set(selectedOrderIds);
                        if (next.has(order.id)) next.delete(order.id);
                        else next.add(order.id);
                        setSelectedOrderIds(next);
                      }} className={`p-1 rounded ${isSelected ? 'text-indigo-600' : 'text-gray-300'}`}>
                        {isSelected ? <CheckSquare size={14}/> : <Square size={14}/>}
                      </button>
                    </td>
                    <td className="px-2 py-2 border-r font-bold text-gray-900">{order.id}</td>
                    <td className="px-2 py-2 border-r text-gray-600">{getStoreName(order.storeId)}</td>
                    <td className="px-2 py-2 border-r font-mono text-gray-500">{order.sku}</td>
                    <td className="px-2 py-2 border-r text-center font-bold text-indigo-600 bg-indigo-50/30">{category}</td>
                    <td className="px-2 py-2 border-r">
                      <div className="flex items-center gap-1">
                        {order.linkDs && editingLinkDs[order.id] === undefined ? (
                          <div className="flex items-center gap-1">
                            <a href={order.linkDs} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[80px]">Link</a>
                            <button onClick={() => setEditingLinkDs(prev => ({ ...prev, [order.id]: order.linkDs || '' }))} className="text-gray-400 hover:text-blue-500"><Edit size={10}/></button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <input type="text" className="w-full border border-gray-300 rounded px-1 py-0.5" value={editingLinkDs[order.id] ?? ''} onChange={e => setEditingLinkDs(prev => ({ ...prev, [order.id]: e.target.value }))} />
                            <button onClick={() => handleUpdateLinkDs(order)} className="p-1 bg-blue-600 text-white rounded"><Save size={10}/></button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 border-r text-center relative">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {(order.check || '').split(',').filter(s => s.trim()).map(val => (
                          <span key={val} className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full text-[8px] font-bold border border-orange-200">{val}</span>
                        ))}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCheckDropdown(activeCheckDropdown === order.id ? null : order.id);
                            setTempCheckSelections(prev => ({ ...prev, [order.id]: order.check || '' }));
                          }}
                          className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-orange-100 hover:text-orange-600"
                        >
                          <Edit size={10}/>
                        </button>
                      </div>
                      
                      {activeCheckDropdown === order.id && (
                        <div ref={checkDropdownRef} className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 shadow-xl rounded-lg z-50 p-2 text-left animate-slide-in">
                          <div className="space-y-1">
                            <button 
                              onClick={() => {
                                handleUpdateCheck(order, 'Done Oder');
                                setActiveCheckDropdown(null);
                              }}
                              className="w-full text-left px-2 py-1.5 hover:bg-orange-50 text-orange-600 font-bold rounded flex items-center gap-2"
                            >
                              <CheckCircle size={12}/> Done Oder
                            </button>
                            <div className="h-px bg-gray-100 my-1"></div>
                            {allowedDesignerOnlineChecks.filter(c => c !== 'Done Oder').map(checkVal => {
                              const currentSelections = (tempCheckSelections[order.id] || '').split(',').map(s => s.trim()).filter(s => s !== '');
                              const isChecked = currentSelections.includes(checkVal);
                              return (
                                <label key={checkVal} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={() => {
                                      let next;
                                      if (isChecked) next = currentSelections.filter(v => v !== checkVal);
                                      else next = [...currentSelections, checkVal];
                                      setTempCheckSelections(prev => ({ ...prev, [order.id]: next.join(', ') }));
                                    }}
                                    className="rounded text-indigo-600"
                                  />
                                  <span className="text-[10px] font-medium text-gray-700">{checkVal}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 border-r w-[75ch] min-w-[75ch] max-w-[75ch]">
                      <div className="flex items-start gap-1">
                        {editingNoteIds.has(order.id) ? (
                          <div className="flex gap-1 w-full">
                            <textarea className="w-full border rounded p-1 text-[10px] min-h-[60px] resize-y" value={editingDesignerNote[order.id] ?? ''} onChange={e => setEditingDesignerNote(prev => ({ ...prev, [order.id]: e.target.value }))} />
                            <button onClick={() => handleUpdateDesignerNote(order)} className="p-1 bg-teal-600 text-white rounded self-start mt-1"><Save size={10}/></button>
                          </div>
                        ) : (
                          <div className="flex justify-between w-full group items-start">
                            <span className="whitespace-pre-wrap break-words overflow-hidden flex-1">{order.designerNote || '-'}</span>
                            <button onClick={() => {
                              setEditingDesignerNote(prev => ({ ...prev, [order.id]: order.designerNote || '' }));
                              setEditingNoteIds(prev => new Set(prev).add(order.id));
                            }} className="text-gray-300 group-hover:text-indigo-500 p-1"><Edit size={10}/></button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 border-r text-center">
                      <button onClick={() => handleDesignerToggle(order)} className={`p-1 rounded ${order.isDesignDone ? 'text-blue-600' : 'text-gray-300'}`}>
                        {updatingIds.has(order.id) ? <Loader2 size={14} className="animate-spin" /> : (order.isDesignDone ? <CheckSquare size={16}/> : <Square size={16}/>)}
                      </button>
                    </td>
                    <td className="px-2 py-2 border-r text-center font-bold text-gray-500 uppercase">{order.handler?.charAt(0) || '?'}</td>
                    <td className="px-2 py-2 text-center font-bold text-orange-600 uppercase">{order.actionRole?.charAt(0) || '?'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isSkuModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-in">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Settings size={18} className="text-indigo-500"/> Phân Loại SKU</h3>
              <button onClick={() => setIsSkuModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleUpdateSku} className="p-5 space-y-4">
              {skuMessage && <div className={`p-2 rounded text-xs ${skuMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{skuMessage.text}</div>}
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">SKU</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" value={skuFormData.sku} onChange={e => setSkuFormData({...skuFormData, sku: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Loại</label>
                <select className="w-full border rounded-lg px-3 py-2" value={skuFormData.category} onChange={e => setSkuFormData({...skuFormData, category: e.target.value})}>
                  {PRICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" disabled={isSubmittingSku} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                {isSubmittingSku ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu
              </button>
            </form>
          </div>
        </div>
      )}

      {isPriceModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-in">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><DollarSign size={18} className="text-emerald-500"/> Cấu Hình Giá</h3>
              <button onClick={() => setIsPriceModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {PRICE_CATEGORIES.map(cat => (
                <div key={cat} className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-gray-700">{cat}</span>
                  <input type="number" className="border rounded-lg px-3 py-1.5 text-right w-32" value={tempPriceMap[cat] || 0} onChange={e => setTempPriceMap({...tempPriceMap, [cat]: Number(e.target.value)})} />
                </div>
              ))}
              <button onClick={handleSavePrices} disabled={isSavingPrices} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                {isSavingPrices ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu Bảng Giá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleMonthChange(step: number) {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + step, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
};
