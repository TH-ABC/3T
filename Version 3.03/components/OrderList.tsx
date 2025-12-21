import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Copy, Calendar, FileSpreadsheet, ChevronLeft, ChevronRight, CheckSquare, Square, Loader2, AlertTriangle, Filter, ArrowDownAZ, ArrowUpAZ, Truck, Settings2, CheckCircle, TrendingUp, Clock, PenTool, X, RefreshCcw, Zap, Plus, BarChart3, ShoppingBag } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { Order, Store, User } from '../types';

const getCurrentLocalMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split(/[-T :]/); 
    if (parts.length >= 3) {
        const y = parts[0];
        const m = parts[1];
        const d = parts[2];
        if (y.length === 4) return `${d}/${m}/${y}`;
    }
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    } catch (e) { return dateStr; }
};

const getStoreBadgeStyle = (storeName: string) => {
    const colors = [
        'bg-blue-100 text-blue-800 border-blue-200',
        'bg-green-100 text-green-800 border-green-200',
        'bg-purple-100 text-purple-800 border-purple-200',
        'bg-pink-100 text-pink-800 border-pink-200',
        'bg-indigo-100 text-indigo-800 border-indigo-200',
        'bg-teal-100 text-teal-800 border-teal-200',
        'bg-orange-100 text-orange-800 border-orange-200',
        'bg-cyan-100 text-cyan-800 border-cyan-200',
    ];
    let hash = 0;
    for (let i = 0; i < storeName.length; i++) hash = storeName.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash % colors.length);
    return colors[index];
};

interface OrderListProps {
    user?: User; 
    onProcessStart?: () => void;
    onProcessEnd?: () => void;
}

interface SystemModalState {
    isOpen: boolean;
    type: 'success' | 'error' | 'confirm' | 'alert';
    title: string;
    message: string;
    onConfirm?: () => void;
}

export const OrderList: React.FC<OrderListProps> = ({ user, onProcessStart, onProcessEnd }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterSearchTerm, setFilterSearchTerm] = useState(''); 
  const [filterPopupPos, setFilterPopupPos] = useState<{ top: number, left: number, alignRight: boolean } | null>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentLocalMonth());
  const selectedMonthRef = useRef<string>(selectedMonth);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(new Set());
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isSyncingPW, setIsSyncingPW] = useState(false);
  const [isSyncingFF, setIsSyncingFF] = useState(false);
  
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [sysModal, setSysModal] = useState<SystemModalState>({ isOpen: false, type: 'alert', title: '', message: '' });
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try {
          const saved = localStorage.getItem('oms_visible_columns_v5');
          return saved ? JSON.parse(saved) : {
              date: true, id: true, storeName: true, sku: true, tracking: true,
              quantity: true, status: true, handler: true, actionRole: true,
              checkbox: true, designCheck: true, ffIcon: true
          };
      } catch {
          return {
              date: true, id: true, storeName: true, sku: true, tracking: true,
              quantity: true, status: true, handler: true, actionRole: true,
              checkbox: true, designCheck: true, ffIcon: true
          };
      }
  });

  useEffect(() => { localStorage.setItem('oms_visible_columns_v5', JSON.stringify(visibleColumns)); }, [visibleColumns]);
  
  useEffect(() => {
      const fetchMetadata = async () => {
          try {
              const [storeData, usersRes] = await Promise.all([ sheetService.getStores(), sheetService.getUsers() ]);
              setStores(storeData); 
              setSystemUsers(Array.isArray(usersRes) ? usersRes : []);
          } catch (e) { console.error(e); }
      };
      fetchMetadata();
  }, []);

  const getStoreName = (id: string) => { 
    const store = stores.find(s => String(s.id) === String(id) || s.name === id); 
    return store ? store.name : id; 
  };

  const storeStats = useMemo(() => {
      const stats: Record<string, { name: string, totalOrders: number, totalQty: number, fulfilled: number, hasTracking: number, paid: number, designDone: number, daily: Record<string, number> }> = {};
      orders.forEach(order => {
          const storeId = order.storeId; 
          const storeName = getStoreName(storeId); 
          const qty = Number(order.quantity) || 1;
          if (!stats[storeId]) stats[storeId] = { name: storeName, totalOrders: 0, totalQty: 0, fulfilled: 0, hasTracking: 0, paid: 0, designDone: 0, daily: {} };
          stats[storeId].totalOrders += 1; 
          stats[storeId].totalQty += qty;
          if (order.isFulfilled) stats[storeId].fulfilled += 1;
          if (order.tracking && String(order.tracking).trim() !== '') stats[storeId].hasTracking += 1;
          if (order.isChecked) stats[storeId].paid += 1;
          if (order.isDesignDone) stats[storeId].designDone += 1;
          let dateKey = 'Unknown'; 
          if (order.date) { 
              const parts = order.date.split(/[-T :]/); 
              if (parts.length >= 3) { 
                  if (parts[0].length === 4) dateKey = `${parts[2]}/${parts[1]}`; 
                  else dateKey = `${parts[0]}/${parts[1]}`; 
              } 
          }
          if (!stats[storeId].daily[dateKey]) stats[storeId].daily[dateKey] = 0; 
          stats[storeId].daily[dateKey] += 1; 
      });
      return Object.values(stats).sort((a, b) => b.totalOrders - a.totalOrders).map(stat => {
          const sortedDaily = Object.entries(stat.daily).sort((a, b) => {
              const [d1, m1] = a[0].split('/').map(Number); 
              const [d2, m2] = b[0].split('/').map(Number);
              if (isNaN(d1) || isNaN(m1)) return 1; 
              if (isNaN(d2) || isNaN(m2)) return -1;
              if (m1 !== m2) return m1 - m2; 
              return d1 - d2;
          });
          return { ...stat, dailySorted: sortedDaily };
      });
  }, [orders, stores]);

  const globalSummary = useMemo(() => {
    return {
        total: orders.length,
        paid: orders.filter(o => o.isChecked).length,
        tracking: orders.filter(o => o.tracking && String(o.tracking).trim() !== '').length,
        fulfilled: orders.filter(o => o.isFulfilled).length
    };
  }, [orders]);

  const loadData = async (monthToFetch: string) => {
    setLoading(true); 
    setOrders([]); 
    setCurrentFileId(null); 
    setSelectedOrderIds(new Set());
    try {
      const orderResult = await sheetService.getOrders(monthToFetch);
      if (selectedMonthRef.current !== monthToFetch) return;
      const rawOrders = orderResult.orders || [];
      let filteredByPerm = rawOrders;
      if (user && user.role !== 'admin') {
          const scope = user.permissions?.orders;
          if (scope === 'none') filteredByPerm = [];
          else if (scope === 'own') {
              const username = (user.username || '').toLowerCase().trim();
              filteredByPerm = rawOrders.filter(o => (o.handler || '').toLowerCase().trim() === username || (o.actionRole || '').toLowerCase().trim() === username);
          }
      }
      const validOrders = filteredByPerm.filter(o => o.id && String(o.id).trim() !== '' && o.date && String(o.date).trim().startsWith(monthToFetch));
      setOrders(validOrders.length === 0 && filteredByPerm.length > 0 ? filteredByPerm.filter(o => o.id && String(o.id).trim() !== '') : validOrders);
      setCurrentFileId(orderResult.fileId); 
    } catch (e) { console.error(e); } 
    finally { if (selectedMonthRef.current === monthToFetch) setLoading(false); }
  };

  useEffect(() => { selectedMonthRef.current = selectedMonth; loadData(selectedMonth); }, [selectedMonth]);

  const filteredOrders = useMemo(() => orders.filter(o => {
      const matchesSearch = ((o.id ? String(o.id).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.sku ? String(o.sku).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.tracking ? String(o.tracking).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.storeId ? getStoreName(o.storeId).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.handler ? String(o.handler).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.itemName ? String(o.itemName).toLowerCase() : '').includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;
      
      for (const [key, selectedValues] of Object.entries(columnFilters) as [string, string[]][]) {
          if (!selectedValues || selectedValues.length === 0) continue;
          let cellValue = ''; 
          if (key === 'storeName') cellValue = getStoreName(o.storeId); 
          else if (key === 'isFulfilled') cellValue = o.isFulfilled ? "Fulfilled" : "Chưa"; 
          else if (key === 'isDesignDone') cellValue = o.isDesignDone ? "Done" : "Pending"; 
          else cellValue = String(o[key as keyof Order] || ''); 
          if (!selectedValues.includes(cellValue)) return false;
      }
      return true;
  }), [orders, searchTerm, columnFilters, stores]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const key = sortConfig.key; 
      const valA = a[key as keyof Order]; 
      const valB = b[key as keyof Order];
      if (key === 'date') { 
        const dateA = new Date(String(valA || '')).getTime(); 
        const dateB = new Date(String(valB || '')).getTime(); 
        if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA; 
      } 
      else { 
        if (valA! < valB!) return sortConfig.direction === 'asc' ? -1 : 1; 
        if (valA! > valB!) return sortConfig.direction === 'asc' ? 1 : -1; 
      }
      return 0;
    });
  }, [filteredOrders, sortConfig]);

  const handleSelectAll = () => { 
    if (selectedOrderIds.size === sortedOrders.length && sortedOrders.length > 0) setSelectedOrderIds(new Set()); 
    else setSelectedOrderIds(new Set(sortedOrders.map(o => o.id))); 
  };
  
  const handleSelectRow = (id: string) => { 
    const newSelected = new Set(selectedOrderIds); 
    if (newSelected.has(id)) newSelected.delete(id); 
    else newSelected.add(id); 
    setSelectedOrderIds(newSelected); 
  };

  const handleBatchAction = async (actionType: 'paid' | 'unpaid' | 'design_done' | 'design_pending') => {
      if (!currentFileId || selectedOrderIds.size === 0) return;
      const idsToUpdate = Array.from(selectedOrderIds) as string[];
      const isPaidAction = actionType === 'paid' || actionType === 'unpaid';
      const newValue = actionType === 'paid' || actionType === 'design_done';
      
      setIsBatchProcessing(true); 
      if (onProcessStart) onProcessStart();
      
      try {
          let result;
          if (isPaidAction) {
              result = await sheetService.batchUpdateOrder(currentFileId, idsToUpdate, 'isChecked', newValue);
              if (result.success) { 
                setOrders(prev => prev.map(o => idsToUpdate.includes(o.id) ? { ...o, isChecked: newValue } : o)); 
              }
          } else {
              result = await sheetService.batchUpdateDesigner(currentFileId, idsToUpdate, newValue);
              if (result.success) { 
                setOrders(prev => prev.map(o => idsToUpdate.includes(o.id) ? { ...o, isDesignDone: newValue } : o)); 
              }
          }
          if (!result?.success) throw new Error(result?.error || "Unknown error");
          setSelectedOrderIds(new Set()); 
      } catch (error) { 
        alert('Có lỗi xảy ra khi cập nhật.');
      } finally { 
        setIsBatchProcessing(false); 
        if (onProcessEnd) onProcessEnd(); 
      }
  };

  const handleColumnSort = (key: keyof Order, direction: 'asc' | 'desc') => { 
    setSortConfig({ key, direction }); 
    setActiveFilterColumn(null); 
  };

  const getUniqueValues = (key: string): string[] => { 
    const values = new Set<string>(); 
    orders.forEach(o => { 
      let val = ''; 
      if(key==='storeName') val=getStoreName(o.storeId); 
      else if(key==='isFulfilled') val=o.isFulfilled?"Fulfilled":"Chưa"; 
      else if(key==='isDesignDone') val=o.isDesignDone?"Done":"Pending"; 
      else val=String(o[key as keyof Order]||''); 
      if(val) values.add(val); 
    }); 
    return Array.from(values).sort(); 
  };

  const handleFilterValueChange = (col: string, val: string) => { 
    setColumnFilters(prev => {
      const cur = (prev[col] || []) as string[]; 
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; 
      return { ...prev, [col]: next };
    });
  };

  const handleClearFilter = (columnKey: string) => setColumnFilters(prev => ({ ...prev, [columnKey]: [] }));
  const handleSelectAllFilter = (columnKey: string, values: string[]) => setColumnFilters(prev => ({ ...prev, [columnKey]: values }));

  const showMessage = (title: string, message: string, type: SystemModalState['type'] = 'alert', onConfirm?: () => void) => { 
    setSysModal({ isOpen: true, title, message, type, onConfirm }); 
  };
  const closeMessage = () => setSysModal(prev => ({ ...prev, isOpen: false }));
  
  const handleCreateFile = async () => { 
    showMessage('Tạo file', `Tạo file cho Tháng ${selectedMonth}?`, 'confirm', async () => { 
      if (onProcessStart) onProcessStart(); 
      try { 
        const result = await sheetService.createMonthFile(selectedMonth); 
        if (result && result.success) { 
          showMessage('Thành công', 'Đã tạo file!', 'success'); 
          loadData(selectedMonth); 
        } else showMessage('Lỗi', result?.error || "Lỗi", 'error'); 
      } catch (e) { 
        showMessage('Lỗi', 'Lỗi kết nối.', 'error'); 
      } finally { 
        if (onProcessEnd) onProcessEnd(); 
      } 
    }); 
  };

  const handleToggleCheckbox = async (order: Order) => { 
    if (updatingOrderIds.has(order.id) || !currentFileId) return; 
    const newValue = !order.isChecked; 
    setUpdatingOrderIds(prev => new Set(prev).add(order.id)); 
    if (onProcessStart) onProcessStart(); 
    try { 
      await sheetService.updateOrder(currentFileId, order.id, 'isChecked', newValue ? "TRUE" : "FALSE"); 
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isChecked: newValue } : o)); 
    } catch (error) { 
      showMessage('Lỗi', 'Lỗi cập nhật.', 'error'); 
    } finally { 
      setUpdatingOrderIds(prev => { 
        const newSet = new Set(prev); 
        newSet.delete(order.id); 
        return newSet; 
      }); 
      if (onProcessEnd) onProcessEnd(); 
    } 
  };

  const handleToggleDesignDone = async (order: Order) => { 
    if (updatingOrderIds.has(order.id) || !currentFileId) return; 
    const newValue = !order.isDesignDone; 
    setUpdatingOrderIds(prev => new Set(prev).add(order.id)); 
    if (onProcessStart) onProcessStart(); 
    try { 
      await sheetService.updateDesignerStatus(currentFileId, order, "Master", newValue); 
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isDesignDone: newValue } : o)); 
    } catch (error) { 
      showMessage('Lỗi', 'Lỗi Design.', 'error'); 
    } finally { 
      setUpdatingOrderIds(prev => { 
        const newSet = new Set(prev); 
        newSet.delete(order.id); 
        return newSet; 
      }); 
      if (onProcessEnd) onProcessEnd(); 
    } 
  };

  const handleSyncFullFF = async () => { 
    if (!currentFileId) return; 
    setIsSyncingFF(true); 
    if (onProcessStart) onProcessStart(); 
    try { 
      const result = await sheetService.syncFulfillment(currentFileId); 
      if (result && result.success) { 
        showMessage('Thành công', `Đã đồng bộ ${result.updatedCount} đơn hàng qua 2 bước.`, 'success'); 
        loadData(selectedMonth); 
      } else showMessage('Lỗi', result.error || 'Lỗi xử lý.', 'error'); 
    } catch (e) { 
      showMessage('Lỗi', 'Lỗi kết nối hệ thống.', 'error'); 
    } finally { 
      setIsSyncingFF(false); 
      if (onProcessEnd) onProcessEnd(); 
    } 
  };

  const handleMonthChange = (step: number) => { 
    const [year, month] = selectedMonth.split('-').map(Number); 
    const date = new Date(year, month - 1 + step, 1); 
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`); 
  };

  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');

  const renderFilterPopup = () => { 
    if (!activeFilterColumn || !filterPopupPos) return null; 
    const col = activeFilterColumn; 
    const vals: string[] = getUniqueValues(col === 'storeName' ? 'storeName' : col === 'isFulfilled' ? 'isFulfilled' : col === 'isDesignDone' ? 'isDesignDone' : col); 
    const display = vals.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase())); 
    const selected: string[] | undefined = columnFilters[col]; 
    
    return ( 
      <div ref={filterPopupRef} className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] flex flex-col w-64 sm:w-72 animate-fade-in" style={{ top: filterPopupPos.top, left: Math.min(filterPopupPos.left, window.innerWidth - 280) }}> 
        <div className="p-2 border-b border-gray-100 space-y-1">
          <button onClick={() => { handleColumnSort(col as keyof Order, 'asc'); setActiveFilterColumn(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs sm:text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowDownAZ size={14} /> Sắp xếp A - Z</button> 
          <button onClick={() => { handleColumnSort(col as keyof Order, 'desc'); setActiveFilterColumn(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs sm:text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowUpAZ size={14} /> Sắp xếp Z - A</button> 
        </div>
        <div className="p-2 border-b border-gray-100 bg-gray-50">
            <input type="text" placeholder="Tìm..." className="w-full px-2 py-1.5 text-xs sm:text-sm border rounded focus:ring-2 focus:ring-orange-500 outline-none" value={filterSearchTerm} onChange={(e) => setFilterSearchTerm(e.target.value)} autoFocus />
        </div> 
        <div className="flex-1 overflow-y-auto max-h-48 sm:max-h-60 p-2 space-y-1 custom-scrollbar"> 
            {display.map((val, idx) => ( 
                <label key={idx} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs sm:text-sm"> 
                    <input type="checkbox" checked={!selected || selected.includes(val as string)} onChange={() => handleFilterValueChange(col, val as string)} className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" /> 
                    <span>{val || '(Trống)'}</span> 
                </label> 
            ))} 
        </div> 
        <div className="p-2 border-t border-gray-100 flex justify-between bg-gray-50 rounded-b-xl"> 
          <button onClick={() => handleSelectAllFilter(col, vals)} className="text-[10px] sm:text-xs text-blue-600 font-bold px-2 py-1 hover:bg-blue-50 rounded uppercase">Tất cả</button> 
          <button onClick={() => handleClearFilter(col)} className="text-[10px] sm:text-xs text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded uppercase">Bỏ</button> 
        </div> 
      </div> 
    ); 
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 relative overflow-hidden">
        {/* --- HEADER --- */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 shadow-sm z-40">
            <div className="flex flex-wrap lg:flex-row justify-between items-center gap-3 sm:gap-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <h2 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-1.5 sm:gap-2">
                        <span className="bg-orange-100 text-orange-700 p-1.5 rounded-lg"><FileSpreadsheet size={18}/></span>
                        Orders
                    </h2>
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 shadow-inner scale-90 sm:scale-100 origin-left">
                        <button onClick={() => handleMonthChange(-1)} className="p-1 sm:p-1.5 hover:bg-white rounded-md text-gray-500"><ChevronLeft size={14} /></button>
                        <div className="flex items-center px-2 sm:px-3 gap-1 font-black text-gray-700 text-[10px] sm:text-sm uppercase tracking-tighter"><span>{currentMonthStr}/{currentYearStr}</span></div>
                        <button onClick={() => handleMonthChange(1)} className="p-1.5 sm:p-2 rounded-md text-gray-500"><ChevronRight size={14} /></button>
                    </div>
                    <button onClick={() => loadData(selectedMonth)} className={`p-1.5 sm:p-2 rounded-full hover:bg-gray-100 text-gray-500 ${loading ? 'animate-spin text-orange-500' : ''}`}><RefreshCw size={16} /></button>
                    
                    {currentFileId && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <a 
                                href={`https://docs.google.com/spreadsheets/d/${currentFileId}/edit`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-1 bg-white border border-green-600 text-green-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] font-black uppercase shadow-md hover:bg-green-50 transition-all"
                            >
                                <FileSpreadsheet size={14} />
                                <span>Mở Sheet</span>
                            </a>
                            <button onClick={handleSyncFullFF} disabled={isSyncingFF} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] font-black uppercase shadow-md disabled:opacity-50">
                                {isSyncingFF ? <Loader2 size={12} className="animate-spin" /> : <Truck size={14} />}
                                <span>FF (Sync)</span>
                            </button>
                        </div>
                    )}

                    {!currentFileId && (
                        <button onClick={handleCreateFile} disabled={loading} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] font-black bg-blue-600 hover:bg-blue-700 text-white uppercase shadow-md tracking-wider"><Plus size={14} /><span>Tạo Sheet</span></button>
                    )}
                </div>
                <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                    <div className="relative flex-1 lg:w-64"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="ID, SKU..." className="pl-8 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs w-full focus:ring-2 focus:ring-orange-500 outline-none shadow-sm font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    <button onClick={() => setShowColumnSelector(!showColumnSelector)} className="p-1.5 sm:p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 bg-white shadow-sm"><Settings2 size={16} /></button>
                </div>
            </div>
        </div>

        {/* --- QUICK STATS BAR --- */}
        <div className="px-3 sm:px-4 py-2 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-sm">
            <div className="flex items-center gap-4 sm:gap-6 overflow-visible shrink-0">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Tổng đơn</span>
                    <span className="text-sm font-black text-slate-800 leading-none">{globalSummary.total}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Đã Paid</span>
                    <span className="text-sm font-black text-blue-600 leading-none">{globalSummary.paid}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">Đã Track</span>
                    <span className="text-sm font-black text-orange-600 leading-none">{globalSummary.tracking}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">FF Hoàn tất</span>
                    <span className="text-sm font-black text-emerald-600 leading-none">{globalSummary.fulfilled}</span>
                </div>
            </div>
            
            <button 
                onClick={() => setIsStatsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-100 hover:bg-orange-100 transition-all shadow-sm active:scale-95"
            >
                <BarChart3 size={14} /> Thống kê chi tiết
            </button>
        </div>

        {/* --- MAIN TABLE --- */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
             <table className="w-full text-left border-collapse text-[10px] sm:text-xs relative">
                <thead className="bg-gray-50 text-gray-500 font-black uppercase tracking-widest sticky top-0 z-30 shadow-sm border-b border-gray-200">
                    <tr>
                         <th className="px-2 py-3 bg-gray-50 border-r border-gray-100 w-8 text-center">
                             <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer" checked={selectedOrderIds.size > 0 && selectedOrderIds.size === sortedOrders.length} onChange={handleSelectAll} />
                         </th>
                         {visibleColumns['date'] && <th className="px-2 py-3 border-r border-gray-100 w-24 cursor-pointer text-left" onClick={() => handleColumnSort('date', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Ngày</th>}
                         {visibleColumns['id'] && <th className="px-2 py-3 border-r border-gray-100 w-32 text-left">OrderID</th>}
                         {visibleColumns['storeName'] && <th className="px-2 py-3 border-r border-gray-100 w-32 cursor-pointer text-left" onClick={(e) => {
                             const rect = e.currentTarget.getBoundingClientRect();
                             setActiveFilterColumn('storeName'); 
                             setFilterPopupPos({top: rect.bottom, left: rect.left, alignRight: false})
                         }}>Store</th>}
                         {visibleColumns['sku'] && <th className="px-2 py-3 border-r border-gray-100 w-32 text-left">SKU</th>}
                         {visibleColumns['tracking'] && <th className="px-2 py-3 border-r border-gray-100 w-32 text-left">Tracking</th>}
                         {visibleColumns['quantity'] && <th className="px-2 py-3 border-r border-gray-100 w-12 text-center">SL</th>}
                         {visibleColumns['status'] && <th className="px-2 py-3 border-r border-gray-100 w-28 text-left">Status</th>}
                         {visibleColumns['handler'] && <th className="px-2 py-3 border-r border-gray-100 w-24 text-left">Handle</th>}
                         {visibleColumns['actionRole'] && <th className="px-2 py-3 border-r border-gray-100 w-28 text-left">Action Role</th>}
                         {visibleColumns['checkbox'] && <th className="px-1 py-3 text-center w-12">Pay</th>}
                         {visibleColumns['designCheck'] && <th className="px-1 py-3 text-center w-12">Design</th>}
                         {visibleColumns['ffIcon'] && <th className="px-1 py-3 text-center w-12">FF</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {loading ? (
                        <tr>
                            <td colSpan={13} className="py-20 text-center text-gray-400 font-black uppercase tracking-widest">
                                <Loader2 className="animate-spin inline mr-2 text-indigo-600" size={16}/> Đang kết nối...
                            </td>
                        </tr>
                    ) : sortedOrders.length === 0 ? (
                        <tr>
                            <td colSpan={13} className="py-12 text-center text-gray-500 font-bold uppercase tracking-widest opacity-20 italic">
                                Trống
                            </td>
                        </tr>
                    ) : (
                        sortedOrders.map((order, idx) => {
                            const isUpdating = updatingOrderIds.has(order.id);
                            return (
                                <tr key={order.id + idx} className={`hover:bg-indigo-50/20 transition-colors group ${selectedOrderIds.has(order.id) ? 'bg-orange-50/50' : ''}`}>
                                    <td className="px-2 py-2.5 border-r border-gray-50 text-center"><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-orange-600 cursor-pointer" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectRow(order.id)} /></td>
                                    {visibleColumns['date'] && <td className="px-2 py-2.5 text-[9px] font-bold text-gray-400 whitespace-nowrap border-r border-gray-50 uppercase text-left">{formatDateOnly(order.date)}</td>}
                                    {visibleColumns['id'] && <td className="px-2 py-2.5 border-r border-gray-50 text-left font-black text-slate-800 tracking-tight truncate max-w-[8rem]">{order.id}</td>}
                                    {visibleColumns['storeName'] && <td className="px-2 py-2.5 border-r border-gray-50 text-left"><span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border whitespace-nowrap ${getStoreBadgeStyle(getStoreName(order.storeId))}`}>{getStoreName(order.storeId)}</span></td>}
                                    {visibleColumns['sku'] && <td className="px-2 py-2.5 border-r border-gray-50 text-left font-mono text-gray-500 truncate max-w-[8rem]">{order.sku}</td>}
                                    {visibleColumns['tracking'] && <td className="px-2 py-2.5 border-r border-gray-50 text-left font-bold text-blue-600 truncate max-w-[8rem]">{order.tracking || '---'}</td>}
                                    {visibleColumns['quantity'] && <td className="px-2 py-2.5 text-center font-black text-indigo-600 border-r border-gray-50">{order.quantity}</td>}
                                    {visibleColumns['status'] && <td className="px-2 py-2.5 border-r border-gray-50 text-left"><span className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded border ${String(order.status).toLowerCase().includes('fulfilled') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>{order.status || 'Pending'}</span></td>}
                                    {visibleColumns['handler'] && <td className={`px-2 py-2.5 border-r border-gray-50 text-[9px] font-black text-slate-600 uppercase truncate max-w-[6rem] text-left`}>{order.handler || '---'}</td>}
                                    {visibleColumns['actionRole'] && <td className={`px-2 py-2.5 border-r border-gray-50 text-[9px] font-black text-orange-600 uppercase truncate max-w-[6rem] text-left`}>{order.actionRole || '---'}</td>}
                                    {visibleColumns['checkbox'] && <td className="px-1 py-2 text-center border-r border-gray-50">{isUpdating ? <Loader2 size={14} className="animate-spin text-orange-500 mx-auto" /> : <button onClick={() => handleToggleCheckbox(order)} className={`p-1 ${order.isChecked ? 'text-blue-600' : 'text-gray-200'}`}>{order.isChecked ? <CheckSquare size={18} strokeWidth={3}/> : <Square size={18} />}</button>}</td>}
                                    {visibleColumns['designCheck'] && <td className="px-1 py-2 text-center border-r border-gray-50">{isUpdating ? <Loader2 size={14} className="animate-spin text-indigo-500 mx-auto" /> : <button onClick={() => handleToggleDesignDone(order)} className={`p-1 ${order.isDesignDone ? 'text-indigo-600' : 'text-gray-200'}`}>{order.isDesignDone ? <CheckSquare size={18} strokeWidth={3}/> : <Square size={18} />}</button>}</td>}
                                    {visibleColumns['ffIcon'] && <td className="px-1 py-2 text-center">{order.isFulfilled ? <Truck size={18} className="text-emerald-500 animate-swing mx-auto" /> : <div className="w-5 h-5 mx-auto border-2 border-dashed border-slate-100 rounded-md"></div>}</td>}
                                </tr>
                            );
                        })
                    )}
                </tbody>
             </table>
        </div>

        {/* --- MODAL THỐNG KÊ CHI TIẾT --- */}
        {isStatsModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsStatsModalOpen(false)}></div>
                <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-slide-in flex flex-col">
                    <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-200">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thống kê Store</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tháng {currentMonthStr}/{currentYearStr}</p>
                            </div>
                        </div>
                        <button onClick={() => setIsStatsModalOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:bg-slate-50"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
                            {storeStats.map((stat, idx) => {
                                const paidPercent = stat.totalOrders > 0 ? Math.round((stat.paid / stat.totalOrders) * 100) : 0;
                                return (
                                    <div key={idx} className="bg-white rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-slate-200/60 p-6 hover:border-orange-200 transition-all group overflow-hidden relative">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="max-w-[70%]">
                                                <h4 className="font-black text-slate-800 text-base truncate mb-1" title={stat.name}>{stat.name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-900 text-white text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter">{stat.totalOrders} đơn</span>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase">{stat.totalQty} items</span>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-orange-500 transition-colors">
                                                <ShoppingBag size={20} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 mb-6">
                                            <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-2.5 text-center">
                                                <div className="text-[8px] text-blue-400 font-black uppercase tracking-widest mb-1">Paid</div>
                                                <div className="text-sm font-black text-blue-700">{stat.paid}</div>
                                            </div>
                                            <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-2.5 text-center">
                                                <div className="text-[8px] text-amber-400 font-black uppercase tracking-widest mb-1">Track</div>
                                                <div className="text-sm font-black text-amber-700">{stat.hasTracking}</div>
                                            </div>
                                            <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-2.5 text-center">
                                                <div className="text-[8px] text-emerald-400 font-black uppercase tracking-widest mb-1">FF</div>
                                                <div className="text-sm font-black text-emerald-700">{stat.fulfilled}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiến độ thanh toán</span>
                                                <span className="text-[11px] font-black text-indigo-600">{paidPercent}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-700" style={{ width: `${paidPercent}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-5 border-t border-dashed border-slate-100">
                                            <div className="text-[9px] text-slate-400 mb-2 flex items-center gap-1.5 font-bold uppercase tracking-widest"><Clock size={10}/> Lịch sử ngày</div>
                                            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                                {stat.dailySorted.map(([date, count]) => (
                                                    <div key={date} className="flex-shrink-0 bg-slate-50 border border-slate-100 rounded-xl px-2 py-1.5 flex flex-col items-center min-w-[42px] hover:bg-white hover:shadow-sm transition-all">
                                                        <span className="text-[8px] text-slate-400 font-black whitespace-nowrap mb-0.5">{date}</span>
                                                        <span className="text-xs font-black text-slate-800">{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-8 bg-gray-50 border-t border-slate-100 text-center">
                         <button onClick={() => setIsStatsModalOpen(false)} className="w-full sm:w-64 py-4 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 active:scale-95 transition-all">Đóng báo cáo</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- FLOATING BATCH ACTION BAR --- */}
        {selectedOrderIds.size > 0 && (
            <div className="fixed bottom-16 sm:bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-2xl sm:rounded-full shadow-2xl border border-slate-200 px-4 sm:px-6 py-2 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-4 z-50 animate-slide-in w-[90vw] sm:w-auto">
                <span className="text-[10px] sm:text-sm font-black text-indigo-600 whitespace-nowrap bg-indigo-50 px-2 sm:px-3 py-1 rounded-lg uppercase tracking-widest">{selectedOrderIds.size} đơn</span>
                <div className="hidden sm:block h-6 w-px bg-gray-200"></div>
                <div className="flex gap-1 sm:gap-2">
                    <button onClick={() => handleBatchAction('paid')} disabled={isBatchProcessing} className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-lg active:scale-95">
                        <CheckSquare size={12} /> Pay
                    </button>
                    <button onClick={() => handleBatchAction('design_done')} disabled={isBatchProcessing} className="flex items-center gap-1 px-2 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-lg active:scale-95">
                        <PenTool size={12} /> Done
                    </button>
                    <button onClick={() => setSelectedOrderIds(new Set())} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                </div>
            </div>
        )}

        {renderFilterPopup()}
        
        {sysModal.isOpen && (
            <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100">
                    <div className="p-6 text-center">
                        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${sysModal.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}`}>
                            {sysModal.type === 'success' ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">{sysModal.title}</h3>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">{sysModal.message}</p>
                    </div>
                    <div className="bg-slate-50 px-4 py-4 flex gap-2">
                        {sysModal.type === 'confirm' ? (
                            <>
                                <button className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase active:scale-95 transition-all shadow-lg" onClick={() => { sysModal.onConfirm?.(); closeMessage(); }}>Đồng ý</button>
                                <button className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl text-xs font-black uppercase" onClick={closeMessage}>Hủy</button>
                            </>
                        ) : (
                            <button className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest" onClick={closeMessage}>Đóng</button>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
