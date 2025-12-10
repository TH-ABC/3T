import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Copy, ExternalLink, Calendar, FileSpreadsheet, ChevronLeft, ChevronRight, UserCircle, CheckSquare, Square, Loader2, AlertTriangle, Filter, ArrowDownAZ, ArrowUpAZ, Truck, Settings2, CheckCircle, Package, TrendingUp, Clock, FilePlus, PenTool, X } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { Order, Store, User } from '../types';

// Helper: Lấy tháng hiện tại theo giờ địa phương (YYYY-MM)
const getCurrentLocalMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

// --- FIX LỖI HIỂN THỊ NGÀY ---
const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split(/[-T :]/); 
    
    if (parts.length >= 5) { 
        const y = parts[0];
        const m = parts[1];
        const d = parts[2];
        const hh = parts[3] || '00';
        const mm = parts[4] || '00';
        
        if (y.length === 4) {
             return `${d}/${m}/${y} ${hh}:${mm}`;
        }
    }

    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        
        return `${d}/${m}/${y} ${hh}:${mm}`;
    } catch (e) { return dateStr; }
};

// Helper: Chỉ hiển thị Ngày (DD/MM/YYYY) cho cột Date Order
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

const ROLE_HIERARCHY: Record<string, number> = {
    'admin': 1,
    'leader': 2,
    'idea': 3,
    'support': 4,
    'designer': 5,
    'designer online': 5
};

const getRoleLevel = (role: string): number => {
    return ROLE_HIERARCHY[(role || '').toLowerCase().trim()] || 99;
};

// --- HELPER FOR STORE COLORS ---
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
    for (let i = 0; i < storeName.length; i++) {
        hash = storeName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
};

// --- HELPER FOR ROLE STYLES ---
const getRoleBadgeStyle = (role: string) => {
    const r = (role || '').toLowerCase().trim();
    if (r === 'admin') {
        return 'font-extrabold bg-gradient-to-r from-red-600 via-green-500 to-red-600 bg-[length:200%_auto] text-transparent bg-clip-text animate-pulse border-2 border-red-200 bg-red-50';
    }
    if (r.includes('leader')) return 'bg-amber-100 text-amber-800 border-amber-200 font-bold';
    if (r.includes('support')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (r.includes('designer')) return 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200';
    if (r.includes('idea')) return 'bg-lime-100 text-lime-800 border-lime-200';
    
    return 'bg-gray-100 text-gray-600 border-gray-200';
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
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<{ message: string, detail?: string, fileId?: string } | null>(null);
  
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
  
  // --- BATCH SELECTION STATE ---
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // System modal state
  const [sysModal, setSysModal] = useState<SystemModalState>({ isOpen: false, type: 'alert', title: '', message: '' });

  // --- COLUMN VISIBILITY STATE ---
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try {
          const saved = localStorage.getItem('oms_visible_columns_v3');
          return saved ? JSON.parse(saved) : {
              lastModified: true, date: true, id: true, storeName: true, type: true, sku: true, 
              quantity: true, tracking: true, checkbox: true, designCheck: true, link: true, 
              status: true, note: true, handler: true, actionRole: true, isFulfilled: true
          };
      } catch {
          return {
              lastModified: true, date: true, id: true, storeName: true, type: true, sku: true, 
              quantity: true, tracking: true, checkbox: true, designCheck: true, link: true, 
              status: true, note: true, handler: true, actionRole: true, isFulfilled: true
          };
      }
  });

  useEffect(() => { localStorage.setItem('oms_visible_columns_v3', JSON.stringify(visibleColumns)); }, [visibleColumns]);
  const toggleColumn = (key: string) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  const columnLabels: Record<string, string> = {
      lastModified: 'Date List', date: 'Date Order', id: 'ID Order', storeName: 'Store', type: 'Loại',
      sku: 'SKU', quantity: 'Qty', tracking: 'Tracking', checkbox: 'Paid', designCheck: 'Design Done',
      link: 'Link', status: 'Trạng Thái', note: 'Note', handler: 'Handler', actionRole: 'Role', isFulfilled: 'Fulfill'
  };

  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const monthsList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  useEffect(() => {
      const fetchMetadata = async () => {
          try {
              const [storeData] = await Promise.all([sheetService.getStores()]);
              setStores(storeData);
          } catch (e) { console.error("Error fetching metadata", e); }
      };
      fetchMetadata();
  }, []);

  const getStoreName = (id: string) => {
      const store = stores.find(s => String(s.id) === String(id) || s.name === id);
      return store ? store.name : id;
  };

  // --- STATS CALCULATION ---
  const storeStats = useMemo(() => {
      const stats: Record<string, { name: string, totalOrders: number, totalQty: number, fulfilled: number, hasTracking: number, paid: number, designDone: number }> = {};
      orders.forEach(order => {
          const storeId = order.storeId;
          const storeName = getStoreName(storeId);
          const qty = Number(order.quantity) || 1;
          if (!stats[storeId]) stats[storeId] = { name: storeName, totalOrders: 0, totalQty: 0, fulfilled: 0, hasTracking: 0, paid: 0, designDone: 0 };
          stats[storeId].totalOrders += 1;
          stats[storeId].totalQty += qty;
          if (order.isFulfilled) stats[storeId].fulfilled += 1;
          if (order.tracking && String(order.tracking).trim() !== '') stats[storeId].hasTracking += 1;
          if (order.isChecked) stats[storeId].paid += 1;
          if (order.isDesignDone) stats[storeId].designDone += 1;
      });
      return Object.values(stats).sort((a, b) => b.totalOrders - a.totalOrders);
  }, [orders, stores]);

  const loadData = async (monthToFetch: string) => {
    setLoading(true); setOrders([]); setDataError(null); setCurrentFileId(null); setSelectedOrderIds(new Set());
    try {
      const orderResult = await sheetService.getOrders(monthToFetch);
      if (selectedMonthRef.current !== monthToFetch) return;
      const rawOrders = orderResult.orders || [];
      const validOrders = rawOrders.filter(o => o.id && String(o.id).trim() !== '' && o.date && String(o.date).trim().startsWith(monthToFetch));
      if (rawOrders.length > 0 && validOrders.length === 0) {
          const sampleDate = rawOrders[0].date;
          const actualMonth = sampleDate ? sampleDate.substring(0, 7) : 'Không xác định';
          setDataError({ message: `Cảnh báo: Bạn đang chọn Tháng ${monthToFetch} nhưng dữ liệu tải về thuộc Tháng ${actualMonth}.`, detail: `Vui lòng kiểm tra nội dung File Sheet nguồn.`, fileId: orderResult.fileId });
          setOrders(rawOrders.filter(o => o.id && String(o.id).trim() !== ''));
          setCurrentFileId(orderResult.fileId); 
      } else {
          setOrders(validOrders);
          setCurrentFileId(orderResult.fileId); 
      }
    } catch (e) { console.error(e); } finally { if (selectedMonthRef.current === monthToFetch) setLoading(false); }
  };

  useEffect(() => { selectedMonthRef.current = selectedMonth; loadData(selectedMonth); }, [selectedMonth]);

  // Filter Logic
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
        const matchesSearch = (
            (o.id ? String(o.id).toLowerCase() : '').includes(searchTerm.toLowerCase()) || 
            (o.sku ? String(o.sku).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
            (o.tracking ? String(o.tracking).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
            (o.storeId ? getStoreName(o.storeId).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
            (o.handler ? String(o.handler).toLowerCase() : '').includes(searchTerm.toLowerCase())
        );
        if (!matchesSearch) return false;
        for (const [key, val] of Object.entries(columnFilters)) {
            const selectedValues = val as string[];
            if (!selectedValues || selectedValues.length === 0) continue;
            let cellValue = '';
            if (key === 'storeName') cellValue = getStoreName(o.storeId);
            else if (key === 'isFulfilled') cellValue = o.isFulfilled ? "Fulfilled" : "Chưa";
            else if (key === 'isDesignDone') cellValue = o.isDesignDone ? "Done" : "Pending";
            else cellValue = String(o[key as keyof Order] || ''); // @ts-ignore
            if (!selectedValues.includes(cellValue)) return false;
        }
        return true;
    });
  }, [orders, searchTerm, columnFilters]);

  const sortedOrders = useMemo(() => {
    return filteredOrders.sort((a, b) => {
        const key = sortConfig.key;
        // @ts-ignore
        const valA = a[key]; // @ts-ignore
        const valB = b[key];
        if (key === 'date') {
            const dateA = new Date(String(valA || '')).getTime();
            const dateB = new Date(String(valB || '')).getTime();
            if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        } 
        else {
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
  }, [filteredOrders, sortConfig]);

  // --- SELECTION HANDLERS ---
  const handleSelectAll = () => {
      if (selectedOrderIds.size === sortedOrders.length && sortedOrders.length > 0) {
          setSelectedOrderIds(new Set());
      } else {
          const allIds = new Set(sortedOrders.map(o => o.id));
          setSelectedOrderIds(allIds);
      }
  };

  const handleSelectRow = (id: string) => {
      const newSelected = new Set(selectedOrderIds);
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
      setSelectedOrderIds(newSelected);
  };

  const handleBatchAction = async (actionType: 'paid' | 'unpaid' | 'design_done' | 'design_pending') => {
      if (!currentFileId) return;
      if (selectedOrderIds.size === 0) return;

      const idsToUpdate = Array.from(selectedOrderIds);
      const isPaidAction = actionType === 'paid' || actionType === 'unpaid';
      const isDesignAction = actionType === 'design_done' || actionType === 'design_pending';
      const newValue = actionType === 'paid' || actionType === 'design_done';

      setIsBatchProcessing(true);
      if (onProcessStart) onProcessStart();

      try {
          let result;
          if (isPaidAction) {
              result = await sheetService.batchUpdateOrder(currentFileId, idsToUpdate, 'isChecked', newValue);
              if (result.success) {
                  setOrders(prev => prev.map(o => idsToUpdate.includes(o.id) ? { ...o, isChecked: newValue } : o));
                  showMessage('Thành công', `Đã cập nhật ${idsToUpdate.length} đơn hàng.`, 'success');
              }
          } else if (isDesignAction) {
              // Batch update for Designer needs to sync with sub-sheets
              result = await sheetService.batchUpdateDesigner(currentFileId, idsToUpdate, newValue);
              if (result.success) {
                  setOrders(prev => prev.map(o => idsToUpdate.includes(o.id) ? { ...o, isDesignDone: newValue } : o));
                  showMessage('Thành công', `Đã cập nhật trạng thái Design cho ${idsToUpdate.length} đơn hàng.`, 'success');
              }
          }
          
          if (!result?.success) throw new Error(result?.error || "Unknown error");
          
          setSelectedOrderIds(new Set()); // Clear selection after success

      } catch (error) {
          console.error(error);
          showMessage('Lỗi', 'Có lỗi xảy ra khi cập nhật hàng loạt.', 'error');
      } finally {
          setIsBatchProcessing(false);
          if (onProcessEnd) onProcessEnd();
      }
  };

  // --- FILTER UI ---
  const handleColumnSort = (key: keyof Order, direction: 'asc' | 'desc') => { setSortConfig({ key, direction }); setActiveFilterColumn(null); };
  const getUniqueValues = (key: string): string[] => { const values = new Set<string>(); orders.forEach(o => { let val = ''; if(key==='storeName') val=getStoreName(o.storeId); else if(key==='isFulfilled') val=o.isFulfilled?"Fulfilled":"Chưa"; else if(key==='isDesignDone') val=o.isDesignDone?"Done":"Pending"; else val=String(o[key as keyof Order]||''); if(val) values.add(val); }); return Array.from(values).sort() as string[]; };
  const handleFilterValueChange = (col: string, val: string) => { const cur = columnFilters[col] || []; const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]; setColumnFilters({ ...columnFilters, [col]: next }); };
  
  const showMessage = (title: string, message: string, type: SystemModalState['type'] = 'alert', onConfirm?: () => void) => { setSysModal({ isOpen: true, title, message, type, onConfirm }); };
  const closeMessage = () => setSysModal(prev => ({ ...prev, isOpen: false }));
  
  const handleCreateFile = async () => { showMessage('Xác nhận tạo file', `Bạn có chắc chắn muốn tạo file dữ liệu cho Tháng ${selectedMonth}?`, 'confirm', async () => { if (onProcessStart) onProcessStart(); try { const result = await sheetService.createMonthFile(selectedMonth); if (result && result.success) { showMessage('Thành công', `Đã tạo file cho tháng ${selectedMonth} thành công!`, 'success'); loadData(selectedMonth); } else { showMessage('Lỗi', `Không thể tạo file: ${result?.error || "Lỗi không xác định."}`, 'error'); } } catch (e) { showMessage('Lỗi kết nối', 'Không thể kết nối đến server.', 'error'); } finally { if (onProcessEnd) onProcessEnd(); } }); };
  
  const handleToggleCheckbox = async (order: Order) => { 
    if (updatingOrderIds.has(order.id)) return; 
    if (!currentFileId) return; 
    const newValue = !order.isChecked; 
    setUpdatingOrderIds(prev => new Set(prev).add(order.id)); 
    if (onProcessStart) onProcessStart(); 
    try { 
        await sheetService.updateOrder(currentFileId, order.id, 'isChecked', newValue ? "TRUE" : "FALSE"); 
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isChecked: newValue } : o)); 
    } catch (error) { 
        showMessage('Lỗi', 'Không thể cập nhật trạng thái.', 'error'); 
    } finally { 
        setUpdatingOrderIds(prev => { const newSet = new Set(prev); newSet.delete(order.id); return newSet; }); 
        if (onProcessEnd) onProcessEnd(); 
    } 
  };

  const handleToggleDesignDone = async (order: Order) => { 
    if (updatingOrderIds.has(order.id)) return; 
    if (!currentFileId) return; 
    const newValue = !order.isDesignDone; 
    setUpdatingOrderIds(prev => new Set(prev).add(order.id)); 
    if (onProcessStart) onProcessStart(); 
    try { 
        await sheetService.updateDesignerStatus(currentFileId, order, "Master", newValue); 
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isDesignDone: newValue } : o)); 
    } catch (error) { 
        showMessage('Lỗi', 'Không thể cập nhật trạng thái Design.', 'error'); 
    } finally { 
        setUpdatingOrderIds(prev => { const newSet = new Set(prev); newSet.delete(order.id); return newSet; }); 
        if (onProcessEnd) onProcessEnd(); 
    } 
  };
  
  const handleMonthChange = (step: number) => { const [year, month] = selectedMonth.split('-').map(Number); const date = new Date(year, month - 1 + step, 1); setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`); };
  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');

  // Filter Popup Render (Simplified for brevity)
  const renderFilterPopup = () => { if (!activeFilterColumn || !filterPopupPos) return null; const col = activeFilterColumn; const vals = getUniqueValues(col === 'storeName' ? 'storeName' : col === 'isFulfilled' ? 'isFulfilled' : col === 'isDesignDone' ? 'isDesignDone' : col) as string[]; const display = vals.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase())); const selected = columnFilters[col]; return ( <div ref={filterPopupRef} className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-[100] flex flex-col w-72" style={{ top: filterPopupPos.top, left: filterPopupPos.left }}> <div className="p-2 border-b border-gray-100"><input type="text" placeholder="Tìm..." className="w-full px-2 py-1 text-sm border rounded" value={filterSearchTerm} onChange={(e) => setFilterSearchTerm(e.target.value)} autoFocus /></div> <div className="flex-1 overflow-y-auto max-h-60 p-2 space-y-1 custom-scrollbar"> {display.map((val, idx) => ( <label key={idx} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-sm"> <input type="checkbox" checked={!selected || selected.includes(val)} onChange={() => handleFilterValueChange(col, val)} /> <span>{val || '(Trống)'}</span> </label> ))} </div> </div> ); };

  return (
    <div className="flex flex-col h-full bg-gray-100 relative">
        {/* --- HEADER --- */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm z-40">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="bg-orange-100 text-orange-700 p-1.5 rounded-lg"><FileSpreadsheet size={20}/></span>
                        Quản Lý Đơn Hàng
                    </h2>
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 shadow-inner">
                        <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-white rounded-md text-gray-500"><ChevronLeft size={16} /></button>
                        <div className="flex items-center px-3 gap-1 font-semibold text-gray-700 text-sm"><Calendar size={14} className="text-orange-500 mb-0.5" /><span>Tháng {currentMonthStr}/{currentYearStr}</span></div>
                        <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white rounded-md text-gray-500"><ChevronRight size={16} /></button>
                    </div>
                    <button onClick={() => loadData(selectedMonth)} className={`p-2 rounded-full hover:bg-gray-100 text-gray-500 ${loading ? 'animate-spin text-orange-500' : ''}`}><RefreshCw size={18} /></button>
                    {currentFileId ? (<a href={`https://docs.google.com/spreadsheets/d/${currentFileId}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white border border-green-500 text-green-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-50 shadow-sm"><FileSpreadsheet size={16} /><span>Mở Sheet</span></a>) : (<button onClick={handleCreateFile} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"><FilePlus size={16} /><span>Tạo Sheet</span></button>)}
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                    <div className="relative flex-1 lg:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="Tìm ID, SKU, Tracking..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-orange-500 outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    <div className="relative">
                        <button onClick={() => setShowColumnSelector(!showColumnSelector)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 bg-white shadow-sm"><Settings2 size={18} /></button>
                        {showColumnSelector && (<div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] p-2 animate-fade-in"><div className="max-h-60 overflow-y-auto space-y-1">{Object.keys(visibleColumns).map(key => (<label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm"><input type="checkbox" checked={visibleColumns[key]} onChange={() => toggleColumn(key)} className="rounded border-gray-300 text-orange-600" /><span>{columnLabels[key] || key}</span></label>))}</div></div>)}
                    </div>
                </div>
            </div>
        </div>

        {/* --- STORE STATS --- */}
        <div className="bg-white border-b border-gray-200 p-4 overflow-x-auto custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-orange-500"/> Thống Kê Theo Store (Tháng {currentMonthStr})</h3>
            <div className="flex gap-4 min-w-max pb-2">
                {storeStats.map((stat, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-64 shadow-sm flex flex-col justify-between">
                        <div className="mb-2"><h4 className="font-bold text-gray-800 text-sm truncate" title={stat.name}>{stat.name}</h4><div className="text-[10px] text-gray-400">Items: {stat.totalQty}</div></div>
                        <div className="flex justify-between items-end"><div className="text-center"><div className="text-xs text-gray-500 mb-0.5">Tổng</div><span className="text-lg font-bold text-gray-800">{stat.totalOrders}</span></div><div className="h-8 w-px bg-gray-200 mx-1"></div><div className="text-center"><div className="text-xs text-blue-600 mb-0.5 font-medium">Paid</div><span className="text-lg font-bold text-blue-600">{stat.paid}</span></div><div className="h-8 w-px bg-gray-200 mx-1"></div><div className="text-center"><div className="text-xs text-indigo-600 mb-0.5 font-medium">Design</div><span className="text-lg font-bold text-indigo-600">{stat.designDone}</span></div></div>
                    </div>
                ))}
            </div>
        </div>

        {/* --- MAIN TABLE --- */}
        <div className="flex-1 overflow-auto custom-scrollbar relative max-h-[calc(100vh-300px)] pb-16">
             <table className="w-full text-left border-collapse text-sm relative">
                <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 z-30 shadow-sm">
                    <tr>
                         <th className="px-2 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 w-10 text-center z-30">
                             <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer" checked={selectedOrderIds.size > 0 && selectedOrderIds.size === sortedOrders.length} onChange={handleSelectAll} />
                         </th>
                         {/* Other Columns... */}
                         {visibleColumns['lastModified'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-32 cursor-pointer" onClick={() => handleColumnSort('lastModified', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Date List</th>}
                         {visibleColumns['date'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-32 cursor-pointer" onClick={() => handleColumnSort('date', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Date Order</th>}
                         {visibleColumns['id'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-40">ID Order</th>}
                         {visibleColumns['storeName'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-40 cursor-pointer" onClick={(e) => {setActiveFilterColumn('storeName'); setFilterPopupPos({top: e.currentTarget.getBoundingClientRect().bottom, left: e.currentTarget.getBoundingClientRect().left, alignRight: false})}}>Store <Filter size={12} className="inline ml-1 text-gray-400" /></th>}
                         {visibleColumns['sku'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-48">SKU</th>}
                         {visibleColumns['quantity'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-16 text-center">Qty</th>}
                         {visibleColumns['tracking'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-40">Tracking</th>}
                         {visibleColumns['checkbox'] && <th className="px-2 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 text-center w-12 z-30"><div className="flex flex-col items-center"><CheckSquare size={16} className="text-blue-500" /><span className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">Pay</span></div></th>}
                         {visibleColumns['designCheck'] && <th className="px-2 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 text-center w-12 z-30 bg-indigo-50"><div className="flex flex-col items-center"><PenTool size={16} className="text-indigo-500" /><span className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">Design</span></div></th>}
                         {visibleColumns['status'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-32 text-center">Status</th>}
                         {visibleColumns['handler'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-32">Handler</th>}
                         {visibleColumns['actionRole'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-32">Role</th>}
                         {visibleColumns['isFulfilled'] && <th className="px-3 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 z-30 w-24 text-center">FF</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {loading ? (<tr><td colSpan={20} className="py-20 text-center"><div className="flex flex-col items-center justify-center gap-3"><Loader2 className="animate-spin text-orange-500" size={32} /><span className="text-gray-500 font-medium">Đang tải dữ liệu...</span></div></td></tr>) : 
                    sortedOrders.length === 0 ? (<tr><td colSpan={20} className="py-12 text-center text-gray-500">Không có đơn hàng.</td></tr>) : 
                    sortedOrders.map((order, idx) => {
                        const isUpdating = updatingOrderIds.has(order.id);
                        return (
                            <tr key={order.id + idx} className={`hover:bg-blue-50/30 transition-colors group ${selectedOrderIds.has(order.id) ? 'bg-orange-50' : ''}`}>
                                <td className="px-2 py-3 text-center border-r border-gray-100"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectRow(order.id)} /></td>
                                {visibleColumns['lastModified'] && <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap border-r border-gray-100">{formatDateDisplay(order.lastModified || order.date)}</td>}
                                {visibleColumns['date'] && <td className="px-3 py-3 text-xs font-medium text-gray-700 whitespace-nowrap border-r border-gray-100">{formatDateOnly(order.date)}</td>}
                                {visibleColumns['id'] && <td className="px-3 py-3 border-r border-gray-100"><div className="flex items-center gap-2"><span className="font-bold text-gray-800 text-xs">{order.id}</span><button onClick={() => navigator.clipboard.writeText(order.id)} className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100"><Copy size={12} /></button></div></td>}
                                {visibleColumns['storeName'] && <td className="px-3 py-3 border-r border-gray-100"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${getStoreBadgeStyle(getStoreName(order.storeId))}`}>{getStoreName(order.storeId)}</span></td>}
                                {visibleColumns['sku'] && <td className="px-3 py-3 border-r border-gray-100"><div className="text-xs font-mono text-gray-700 truncate max-w-[12rem]" title={order.sku}>{order.sku}</div></td>}
                                {visibleColumns['quantity'] && <td className="px-3 py-3 text-center font-bold text-gray-800 border-r border-gray-100">{order.quantity}</td>}
                                {visibleColumns['tracking'] && <td className="px-3 py-3 border-r border-gray-100">{order.tracking ? <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{order.tracking}</span> : <span className="text-xs text-gray-400 italic">---</span>}</td>}
                                {visibleColumns['checkbox'] && <td className="px-2 py-3 text-center border-r border-gray-100">{isUpdating ? <Loader2 size={16} className="animate-spin text-orange-500 mx-auto" /> : <button onClick={() => handleToggleCheckbox(order)} className={`hover:scale-110 transition-transform ${order.isChecked ? 'text-blue-600' : 'text-gray-300'}`}>{order.isChecked ? <CheckSquare size={18} /> : <Square size={18} />}</button>}</td>}
                                {visibleColumns['designCheck'] && <td className="px-2 py-3 text-center border-r border-gray-100 bg-indigo-50/30">{isUpdating ? <Loader2 size={16} className="animate-spin text-indigo-500 mx-auto" /> : <button onClick={() => handleToggleDesignDone(order)} className={`hover:scale-110 transition-transform ${order.isDesignDone ? 'text-indigo-600' : 'text-gray-300'}`}>{order.isDesignDone ? <CheckSquare size={18} /> : <Square size={18} />}</button>}</td>}
                                {visibleColumns['status'] && <td className="px-3 py-3 text-center border-r border-gray-100"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${order.status === 'Fulfilled' ? 'bg-green-100 text-green-700 border-green-200' : order.status === 'Cancelled' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{order.status || 'Pending'}</span></td>}
                                {visibleColumns['handler'] && <td className="px-3 py-3 border-r border-gray-100 text-xs">{order.handler}</td>}
                                {visibleColumns['actionRole'] && <td className="px-3 py-3 border-r border-gray-100"><span className={`text-[10px] px-2 py-0.5 rounded border ${getRoleBadgeStyle(order.actionRole)}`}>{order.actionRole}</span></td>}
                                {visibleColumns['isFulfilled'] && <td className="px-3 py-3 text-center border-r border-gray-100">{order.isFulfilled ? <Truck size={18} className="text-green-600 mx-auto" /> : <div className="w-4 h-4 rounded-full border border-gray-300 mx-auto"></div>}</td>}
                            </tr>
                        );
                    })}
                </tbody>
             </table>
        </div>

        {/* --- FLOATING BATCH ACTION BAR --- */}
        {selectedOrderIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-2xl border border-gray-200 px-6 py-3 flex items-center gap-4 z-50 animate-slide-in">
                <span className="text-sm font-bold text-gray-700 whitespace-nowrap bg-gray-100 px-3 py-1 rounded-full">{selectedOrderIds.size} đã chọn</span>
                <div className="h-6 w-px bg-gray-300"></div>
                
                {/* Pay Actions */}
                <div className="flex gap-2">
                    <button onClick={() => handleBatchAction('paid')} disabled={isBatchProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold border border-blue-200">
                        {isBatchProcessing ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />} Đã Pay
                    </button>
                    <button onClick={() => handleBatchAction('unpaid')} disabled={isBatchProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-xs font-bold border border-gray-200">
                        <Square size={14} /> Bỏ Pay
                    </button>
                </div>

                <div className="h-6 w-px bg-gray-300"></div>

                {/* Design Actions */}
                <div className="flex gap-2">
                    <button onClick={() => handleBatchAction('design_done')} disabled={isBatchProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-bold border border-indigo-200">
                        {isBatchProcessing ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />} Design Xong
                    </button>
                    <button onClick={() => handleBatchAction('design_pending')} disabled={isBatchProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-xs font-bold border border-gray-200">
                        <Square size={14} /> Chưa Design
                    </button>
                </div>

                <button onClick={() => setSelectedOrderIds(new Set())} className="ml-2 text-gray-400 hover:text-red-500 transition-colors" title="Hủy chọn">
                    <X size={20} />
                </button>
            </div>
        )}

        {renderFilterPopup()}
        {sysModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                    <div className="p-5 text-center">
                        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${sysModal.type === 'success' ? 'bg-green-100' : sysModal.type === 'error' ? 'bg-red-100' : 'bg-blue-100'}`}>
                            {sysModal.type === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
                            {sysModal.type === 'error' && <AlertTriangle className="h-6 w-6 text-red-600" />}
                            {sysModal.type === 'confirm' && <Package className="h-6 w-6 text-blue-600" />}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{sysModal.title}</h3>
                        <p className="text-sm text-gray-500">{sysModal.message}</p>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                        {sysModal.type === 'confirm' ? (<><button type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm" onClick={() => { sysModal.onConfirm?.(); closeMessage(); }}>Xác Nhận</button><button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={closeMessage}>Hủy</button></>) : (<button type="button" className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm" onClick={closeMessage}>Đóng</button>)}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};