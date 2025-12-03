
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Copy, ExternalLink, Calendar, FileSpreadsheet, ChevronLeft, ChevronRight, UserCircle, CheckSquare, Square, Loader2, AlertTriangle, Filter, ArrowDownAZ, ArrowUpAZ, Truck, Settings2, CheckCircle, Package, TrendingUp, Clock, FilePlus } from 'lucide-react';
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
  const [units, setUnits] = useState<string[]>([]); 
  const [allUsers, setAllUsers] = useState<User[]>([]); 
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
  
  // System modal state
  const [sysModal, setSysModal] = useState<SystemModalState>({ isOpen: false, type: 'alert', title: '', message: '' });

  // --- COLUMN VISIBILITY STATE ---
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try {
          const saved = localStorage.getItem('oms_visible_columns_v2'); // v2 to reset cache if structure changed
          return saved ? JSON.parse(saved) : {
              lastModified: true, // Date List
              date: true,         // Date Order
              id: true,
              storeName: true,
              type: true,
              sku: true,
              quantity: true,
              tracking: true,
              checkbox: true,
              link: true,
              status: true,
              note: true,
              handler: true,
              actionRole: true,
              isFulfilled: true
          };
      } catch {
          return {
              lastModified: true, date: true, id: true, storeName: true, type: true, sku: true, 
              quantity: true, tracking: true, checkbox: true, link: true, status: true, note: true, 
              handler: true, actionRole: true, isFulfilled: true
          };
      }
  });

  // Save column preference
  useEffect(() => {
      localStorage.setItem('oms_visible_columns_v2', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
      setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const columnLabels: Record<string, string> = {
      lastModified: 'Date List',
      date: 'Date Order',
      id: 'ID Order',
      storeName: 'Store',
      type: 'Loại',
      sku: 'SKU',
      quantity: 'Qty',
      tracking: 'Tracking',
      checkbox: 'Paid',
      link: 'Link',
      status: 'Trạng Thái',
      note: 'Note',
      handler: 'Handler',
      actionRole: 'Role',
      isFulfilled: 'Fulfill'
  };

  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const monthsList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  useEffect(() => {
      const fetchMetadata = async () => {
          try {
              const [storeData, unitList, userList] = await Promise.all([
                  sheetService.getStores(),
                  sheetService.getUnits(),
                  sheetService.getUsers()
              ]);
              setStores(storeData);
              setUnits(unitList);
              setAllUsers(userList);
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
      const stats: Record<string, { 
          name: string, 
          totalOrders: number, 
          totalQty: number,
          fulfilled: number, 
          hasTracking: number, // Replaced 'pending' with 'hasTracking'
          paid: number 
      }> = {};

      orders.forEach(order => {
          const storeId = order.storeId;
          const storeName = getStoreName(storeId);
          const qty = Number(order.quantity) || 1;

          if (!stats[storeId]) {
              stats[storeId] = {
                  name: storeName,
                  totalOrders: 0,
                  totalQty: 0,
                  fulfilled: 0,
                  hasTracking: 0,
                  paid: 0
              };
          }

          stats[storeId].totalOrders += 1;
          stats[storeId].totalQty += qty;

          if (order.isFulfilled) {
              stats[storeId].fulfilled += 1;
          }

          // Count Tracking
          if (order.tracking && String(order.tracking).trim() !== '') {
              stats[storeId].hasTracking += 1;
          }

          // Checkbox (Paid) Logic
          if (order.isChecked) {
              stats[storeId].paid += 1;
          }
      });

      return Object.values(stats).sort((a, b) => b.totalOrders - a.totalOrders);
  }, [orders, stores]);

  const loadData = async (monthToFetch: string) => {
    setLoading(true);
    setOrders([]); 
    setDataError(null);
    setCurrentFileId(null);

    try {
      const orderResult = await sheetService.getOrders(monthToFetch);
      
      if (selectedMonthRef.current !== monthToFetch) {
          return;
      }

      const rawOrders = orderResult.orders || [];
      const validOrders = rawOrders.filter(o => {
          // 1. Loại bỏ các dòng mà ID Order rỗng hoặc null
          if (!o.id || String(o.id).trim() === '') return false;

          // 2. Lọc theo tháng
          if (!o.date) return false;
          const dateStr = String(o.date).trim();
          return dateStr.startsWith(monthToFetch);
      });

      if (rawOrders.length > 0 && validOrders.length === 0) {
          // Trường hợp filter trả về rỗng nhưng raw có dữ liệu (có thể do sai tháng hoặc toàn dòng lỗi)
          // Kiểm tra xem có phải do sai tháng không
          const validDateOrders = rawOrders.filter(o => o.date && String(o.date).trim().startsWith(monthToFetch));
          
          if (rawOrders.length > 0 && validDateOrders.length === 0) {
             const sampleDate = rawOrders[0].date;
             const actualMonth = sampleDate ? sampleDate.substring(0, 7) : 'Không xác định';
             setDataError({
                  message: `Cảnh báo: Bạn đang chọn Tháng ${monthToFetch} nhưng dữ liệu tải về thuộc Tháng ${actualMonth}.`,
                  detail: `Hệ thống vẫn hiển thị dữ liệu bên dưới để bạn kiểm tra. Vui lòng kiểm tra nội dung File Sheet nguồn.`,
                  fileId: orderResult.fileId
              });
             // Vẫn phải filter ID rỗng cho rawOrders
             const cleanedRaw = rawOrders.filter(o => o.id && String(o.id).trim() !== '');
             setOrders(cleanedRaw);
             setCurrentFileId(orderResult.fileId); 
          } else {
             // Đúng tháng nhưng lọc ID rỗng hết -> set empty
             setOrders(validOrders);
             setCurrentFileId(orderResult.fileId); 
          }
      } else {
          setOrders(validOrders);
          setCurrentFileId(orderResult.fileId); 
      }
      
    } catch (e) {
      if (selectedMonthRef.current === monthToFetch) {
        console.error(e);
        setOrders([]);
        setCurrentFileId(null);
      }
    } finally {
      if (selectedMonthRef.current === monthToFetch) {
        setLoading(false);
      }
    }
  };

  useEffect(() => { 
      selectedMonthRef.current = selectedMonth;
      loadData(selectedMonth); 
  }, [selectedMonth]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (filterPopupRef.current && !filterPopupRef.current.contains(event.target as Node)) {
            setActiveFilterColumn(null);
            setFilterSearchTerm('');
            setFilterPopupPos(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', () => {
        if (activeFilterColumn) {
             setActiveFilterColumn(null);
             setFilterPopupPos(null);
        }
    }, true);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', () => {}, true);
    };
  }, [activeFilterColumn]);

  const getUniqueValues = (key: keyof Order | 'storeName' | 'isFulfilled'): string[] => {
      const values = new Set<string>();
      orders.forEach(order => {
          let val = '';
          if (key === 'storeName') {
              val = getStoreName(order.storeId);
          } else if (key === 'isFulfilled') {
              val = order.isFulfilled ? "Fulfilled" : "Chưa";
          } else {
              // @ts-ignore
              val = String(order[key] || '');
          }
          if (val) values.add(val);
      });
      return Array.from(values).sort();
  };

  const handleColumnSort = (key: keyof Order, direction: 'asc' | 'desc') => {
      setSortConfig({ key, direction });
      setActiveFilterColumn(null);
  };

  const handleFilterValueChange = (columnKey: string, value: string) => {
      const currentFilters = columnFilters[columnKey] || [];
      let newFilters: string[];
      if (currentFilters.includes(value)) {
          newFilters = currentFilters.filter(v => v !== value);
      } else {
          newFilters = [...currentFilters, value];
      }
      setColumnFilters({ ...columnFilters, [columnKey]: newFilters });
  };

  const handleSelectAllFilter = (columnKey: string, allValues: string[]) => {
      setColumnFilters({ ...columnFilters, [columnKey]: allValues });
  };

  const handleClearFilter = (columnKey: string) => {
      setColumnFilters({ ...columnFilters, [columnKey]: [] });
  };
  
  const handleResetFilterColumn = (columnKey: string) => {
       const newFilters = { ...columnFilters };
       delete newFilters[columnKey];
       setColumnFilters(newFilters);
  };

  const filteredOrders = orders.filter(o => {
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
        if (!selectedValues) continue;
        if (selectedValues.length === 0) return false;

        let cellValue = '';
        if (key === 'storeName') {
            cellValue = getStoreName(o.storeId);
        } else if (key === 'isFulfilled') {
            cellValue = o.isFulfilled ? "Fulfilled" : "Chưa";
        } else {
            // @ts-ignore
            cellValue = String(o[key] || '');
        }
        if (selectedValues.includes(cellValue)) return false;
    }
    return true;
  });

  const sortedOrders = filteredOrders
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
        const key = sortConfig.key;
        // @ts-ignore
        const valA = a.item[key];
        // @ts-ignore
        const valB = b.item[key];

        if (key === 'date') {
            const dateA = new Date(String(valA || '')).getTime();
            const dateB = new Date(String(valB || '')).getTime();
            if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }
        } 
        else {
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return a.index - b.index;
    })
    .map(x => x.item);

  const renderFilterPopup = () => {
      if (!activeFilterColumn || !filterPopupPos) return null;
      const columnKey = activeFilterColumn;
      const uniqueValues = getUniqueValues(columnKey === 'storeName' ? 'storeName' : columnKey === 'isFulfilled' ? 'isFulfilled' : columnKey as keyof Order);
      const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase()));
      const currentSelected = columnFilters[columnKey];
      const isChecked = (val: string) => {
          if (currentSelected === undefined) return true;
          return currentSelected.includes(val);
      };

      return (
        <div 
            ref={filterPopupRef} 
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-[100] flex flex-col text-left animate-fade-in text-gray-800 font-normal cursor-default w-72"
            style={{ 
                top: filterPopupPos.top, 
                left: filterPopupPos.alignRight ? 'auto' : filterPopupPos.left,
                right: filterPopupPos.alignRight ? (window.innerWidth - filterPopupPos.left) : 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-2 border-b border-gray-100 space-y-1">
                <button onClick={() => handleColumnSort(columnKey as keyof Order, 'asc')} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowDownAZ size={16} /> Sắp xếp A - Z</button>
                <button onClick={() => handleColumnSort(columnKey as keyof Order, 'desc')} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowUpAZ size={16} /> Sắp xếp Z - A</button>
            </div>
            <div className="p-2 border-b border-gray-100 bg-gray-50">
                <div className="relative"><Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/><input type="text" placeholder="Tìm trong danh sách..." className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 outline-none bg-white" value={filterSearchTerm} onChange={(e) => setFilterSearchTerm(e.target.value)} autoFocus /></div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-60 p-2 space-y-1 custom-scrollbar">
                {displayValues.length === 0 && <div className="text-xs text-center text-gray-400 py-2">Không tìm thấy</div>}
                {displayValues.map((val, idx) => (
                    <label key={idx} className="flex items-center gap-2 px-2 py-1.5 hover:bg-orange-50 rounded cursor-pointer text-sm select-none">
                        <input type="checkbox" className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-4 h-4" checked={isChecked(val)} onChange={() => handleFilterValueChange(columnKey, val)} />
                        <span className="truncate flex-1">{val || '(Trống)'}</span>
                    </label>
                ))}
            </div>
            <div className="p-3 border-t border-gray-100 flex justify-between bg-gray-50 rounded-b-lg">
                <div className="flex gap-2">
                    <button onClick={() => handleSelectAllFilter(columnKey, uniqueValues)} className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2 py-1 hover:bg-blue-50 rounded">Chọn tất cả</button>
                    <button onClick={() => handleClearFilter(columnKey)} className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2 py-1 hover:bg-blue-50 rounded">Bỏ chọn</button>
                </div>
                {columnFilters[columnKey] !== undefined && (<button onClick={() => handleResetFilterColumn(columnKey)} className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 hover:bg-red-50 rounded">Hủy lọc</button>)}
            </div>
        </div>
      );
  };

  const handleFilterClick = (e: React.MouseEvent, columnKey: string) => {
      e.stopPropagation();
      if (activeFilterColumn === columnKey) { setActiveFilterColumn(null); setFilterPopupPos(null); } 
      else {
          const rect = e.currentTarget.getBoundingClientRect();
          let top = rect.bottom + 5;
          let left = rect.left;
          const POPUP_WIDTH = 288;
          const viewportWidth = window.innerWidth;
          let alignRight = false;
          if (left + POPUP_WIDTH > viewportWidth - 10) { left = rect.right; alignRight = true; }
          if (alignRight && (left - POPUP_WIDTH < 10)) { alignRight = false; left = 10; }
          setFilterPopupPos({ top, left, alignRight });
          setActiveFilterColumn(columnKey);
          setFilterSearchTerm('');
      }
  };

  const showMessage = (title: string, message: string, type: SystemModalState['type'] = 'alert', onConfirm?: () => void) => {
      setSysModal({ isOpen: true, title, message, type, onConfirm });
  };
  const closeMessage = () => setSysModal(prev => ({ ...prev, isOpen: false }));

  const handleCreateFile = async () => { showMessage('Xác nhận tạo file', `Bạn có chắc chắn muốn tạo file dữ liệu cho Tháng ${selectedMonth}?`, 'confirm', async () => { if (onProcessStart) onProcessStart(); try { const result = await sheetService.createMonthFile(selectedMonth); if (result && result.success) { showMessage('Thành công', `Đã tạo file cho tháng ${selectedMonth} thành công!`, 'success'); loadData(selectedMonth); } else { showMessage('Lỗi', `Không thể tạo file: ${result?.error || "Lỗi không xác định."}`, 'error'); } } catch (e) { showMessage('Lỗi kết nối', 'Không thể kết nối đến server.', 'error'); } finally { if (onProcessEnd) onProcessEnd(); } }); };

  const handleToggleCheckbox = async (order: Order) => { if (updatingOrderIds.has(order.id)) return; if (!currentFileId) return; const newValue = !order.isChecked; setUpdatingOrderIds(prev => new Set(prev).add(order.id)); if (onProcessStart) onProcessStart(); try { await sheetService.updateOrder(currentFileId, order.id, 'isChecked', newValue ? "TRUE" : "FALSE"); setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isChecked: newValue } : o)); } catch (error) { showMessage('Lỗi', 'Không thể cập nhật trạng thái.', 'error'); } finally { setUpdatingOrderIds(prev => { const newSet = new Set(prev); newSet.delete(order.id); return newSet; }); if (onProcessEnd) onProcessEnd(); } };
  
  const handleMonthChange = (step: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + step, 1);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newYear}-${newMonth}`);
  };

  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');

  return (
    <div className="flex flex-col h-full bg-gray-100">
        {/* --- HEADER --- */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm z-40">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="bg-orange-100 text-orange-700 p-1.5 rounded-lg"><FileSpreadsheet size={20}/></span>
                        Quản Lý Đơn Hàng
                    </h2>
                    
                    <div className="h-8 w-px bg-gray-300 mx-2 hidden sm:block"></div>

                    {/* Month Picker */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 shadow-inner">
                        <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-white hover:shadow rounded-md text-gray-500 transition-all"><ChevronLeft size={16} /></button>
                        <div className="flex items-center px-3 gap-1 font-semibold text-gray-700 text-sm">
                            <Calendar size={14} className="text-orange-500 mb-0.5" />
                            <span>Tháng {currentMonthStr}/{currentYearStr}</span>
                        </div>
                        <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-white hover:shadow rounded-md text-gray-500 transition-all"><ChevronRight size={16} /></button>
                    </div>

                    <button 
                        onClick={() => loadData(selectedMonth)} 
                        className={`p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-all ${loading ? 'animate-spin text-orange-500' : ''}`}
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw size={18} />
                    </button>
                    
                    {/* NEW: STYLED OPEN SHEET / CREATE SHEET BUTTON */}
                    {currentFileId ? (
                        <a 
                            href={`https://docs.google.com/spreadsheets/d/${currentFileId}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 bg-white border border-green-500 text-green-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors shadow-sm"
                            title="Mở Google Sheet"
                        >
                            <FileSpreadsheet size={16} />
                            <span>Mở Sheet</span>
                        </a>
                    ) : (
                        <button 
                            onClick={handleCreateFile}
                            disabled={loading}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            title={`Tạo file dữ liệu cho tháng ${currentMonthStr}/${currentYearStr}`}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <FilePlus size={16} />}
                            <span>Tạo Sheet</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                    <div className="relative flex-1 lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Tìm ID, SKU, Tracking..." 
                            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none shadow-sm transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {/* Column Selector Toggle */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 bg-white shadow-sm"
                            title="Ẩn/Hiện cột"
                        >
                            <Settings2 size={18} />
                        </button>
                        {showColumnSelector && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] p-2 animate-fade-in">
                                <h4 className="text-xs font-bold text-gray-500 uppercase px-2 py-1 mb-1">Hiển thị cột</h4>
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                    {Object.keys(visibleColumns).map(key => (
                                        <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={visibleColumns[key]} 
                                                onChange={() => toggleColumn(key)}
                                                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
                                            />
                                            <span>{columnLabels[key] || key}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* --- STORE STATS DASHBOARD --- */}
        <div className="bg-white border-b border-gray-200 p-4 overflow-x-auto custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-orange-500"/> Thống Kê Theo Store (Tháng {currentMonthStr})
            </h3>
            <div className="flex gap-4 min-w-max pb-2">
                {storeStats.map((stat, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-56 shadow-sm flex flex-col justify-between">
                        <div className="mb-2">
                            <h4 className="font-bold text-gray-800 text-sm truncate" title={stat.name}>{stat.name}</h4>
                            <div className="text-[10px] text-gray-400">Total Items: {stat.totalQty}</div>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="text-center">
                                <div className="text-xs text-gray-500 mb-0.5">Tổng</div>
                                <span className="text-lg font-bold text-gray-800">{stat.totalOrders}</span>
                            </div>
                            <div className="h-8 w-px bg-gray-200 mx-1"></div>
                            {/* NEW: PAID COLUMN */}
                            <div className="text-center">
                                <div className="text-xs text-blue-600 mb-0.5 font-medium">Đã Pay</div>
                                <span className="text-lg font-bold text-blue-600">{stat.paid}</span>
                            </div>
                            <div className="h-8 w-px bg-gray-200 mx-1"></div>
                            <div className="text-center">
                                <div className="text-xs text-green-600 mb-0.5 font-medium">Đã FF</div>
                                <span className="text-lg font-bold text-green-600">{stat.fulfilled}</span>
                            </div>
                            <div className="h-8 w-px bg-gray-200 mx-1"></div>
                            <div className="text-center">
                                <div className="text-xs text-purple-600 mb-0.5 font-medium">Tracking</div>
                                <span className="text-lg font-bold text-purple-600">{stat.hasTracking}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {storeStats.length === 0 && (
                     <div className="text-sm text-gray-400 italic p-2">Chưa có dữ liệu store trong tháng này.</div>
                )}
            </div>
        </div>

        {/* --- MAIN TABLE --- */}
        <div className="flex-1 overflow-auto custom-scrollbar relative max-h-[calc(100vh-300px)]">
             <table className="w-full text-left border-collapse text-sm relative">
                <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 z-30 shadow-sm">
                    <tr>
                         {/* DATE LIST */}
                         {visibleColumns['lastModified'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-32 text-center">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('lastModified', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Date List</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'lastModified')} className={`p-1 rounded hover:bg-gray-200 transition-colors ${columnFilters['lastModified'] ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Filter size={14} className={columnFilters['lastModified'] ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                                        </button>
                                    </div>
                                </div>
                                {sortConfig.key === 'lastModified' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>}
                             </th>
                         )}
                         
                         {/* DATE ORDER */}
                         {visibleColumns['date'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-32 text-center">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('date', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Date Order</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'date')} className={`p-1 rounded hover:bg-gray-200 transition-colors ${columnFilters['date'] ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Filter size={14} className={columnFilters['date'] ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                                        </button>
                                    </div>
                                </div>
                                {sortConfig.key === 'date' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>}
                             </th>
                         )}

                         {/* ID ORDER */}
                         {visibleColumns['id'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-40">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('id', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>ID Order</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'id')} className="p-1 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100">
                                            <Filter size={14} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* STORE */}
                         {visibleColumns['storeName'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-40">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('storeId', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Store</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'storeName')} className={`p-1 rounded hover:bg-gray-200 transition-colors ${columnFilters['storeName'] ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Filter size={14} className={columnFilters['storeName'] ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* TYPE */}
                         {visibleColumns['type'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-24 text-center">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('type', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Loại</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'type')} className={`p-1 rounded hover:bg-gray-200 transition-colors ${columnFilters['type'] ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Filter size={14} className={columnFilters['type'] ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* SKU */}
                         {visibleColumns['sku'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-48">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('sku', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>SKU</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'sku')} className="p-1 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100">
                                            <Filter size={14} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* QTY */}
                         {visibleColumns['quantity'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-16 text-center">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('quantity', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Qty</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'quantity')} className="p-1 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100">
                                            <Filter size={14} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* TRACKING */}
                         {visibleColumns['tracking'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-40">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('tracking', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Tracking</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'tracking')} className="p-1 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100">
                                            <Filter size={14} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* PAY (CHECKBOX) - CUSTOM HEADER */}
                         {visibleColumns['checkbox'] && (
                             <th className="px-2 py-3 sticky top-0 bg-gray-100 border-b border-gray-200 text-center w-12 z-30 shadow-sm">
                                <div className="flex flex-col items-center">
                                    <CheckSquare size={16} className="text-blue-500" />
                                    <span className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">Pay</span>
                                </div>
                             </th>
                         )}

                         {/* LINK */}
                         {visibleColumns['link'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-16 text-center">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase">Link</span>
                                    <div className="relative">
                                        <button className="p-1 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100">
                                            <Filter size={14} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* STATUS */}
                         {visibleColumns['status'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-32 text-center">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('status', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Trạng Thái</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'status')} className={`p-1 rounded hover:bg-gray-200 transition-colors ${columnFilters['status'] ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Filter size={14} className={columnFilters['status'] ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* NOTE */}
                         {visibleColumns['note'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-48">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('note', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Note</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'note')} className="p-1 rounded hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100">
                                            <Filter size={14} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* HANDLER */}
                         {visibleColumns['handler'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-32">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('handler', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Handler</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'handler')} className={`p-1 rounded hover:bg-gray-200 transition-colors ${columnFilters['handler'] ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Filter size={14} className={columnFilters['handler'] ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* ROLE */}
                         {visibleColumns['actionRole'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-32">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('actionRole', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Role</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'actionRole')} className={`p-1 rounded hover:bg-gray-200 transition-colors ${columnFilters['actionRole'] ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Filter size={14} className={columnFilters['actionRole'] ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}

                         {/* FULFILL */}
                         {visibleColumns['isFulfilled'] && (
                             <th className="px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-30 shadow-sm w-24 text-center">
                                <div className="flex items-center justify-between gap-1 group">
                                    <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort('isFulfilled', sortConfig.direction === 'asc' ? 'desc' : 'asc')}>Fulfill</span>
                                    <div className="relative">
                                        <button onClick={(e) => handleFilterClick(e, 'isFulfilled')} className={`p-1 rounded hover:bg-gray-200 transition-colors ${columnFilters['isFulfilled'] ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <Filter size={14} className={columnFilters['isFulfilled'] ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                                        </button>
                                    </div>
                                </div>
                             </th>
                         )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {loading ? (
                        <tr><td colSpan={20} className="py-20 text-center"><div className="flex flex-col items-center justify-center gap-3"><Loader2 className="animate-spin text-orange-500" size={32} /><span className="text-gray-500 font-medium">Đang tải dữ liệu...</span></div></td></tr>
                    ) : sortedOrders.length === 0 ? (
                        <tr><td colSpan={20} className="py-12 text-center text-gray-500">
                             {dataError ? (
                                <div className="max-w-md mx-auto bg-red-50 p-6 rounded-lg border border-red-200 text-center">
                                    <AlertTriangle className="mx-auto text-red-500 mb-2" size={32} />
                                    <h3 className="text-red-800 font-bold mb-1">{dataError.message}</h3>
                                    <p className="text-red-600 text-sm mb-4">{dataError.detail}</p>
                                    {dataError.fileId ? (
                                        <button onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${dataError.fileId}`, '_blank')} className="text-blue-600 hover:underline text-sm flex items-center justify-center gap-1"><ExternalLink size={14}/> Mở Google Sheet kiểm tra</button>
                                    ) : (
                                        <button onClick={handleCreateFile} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded shadow-sm text-sm font-medium">Tạo File Tháng Này</button>
                                    )}
                                </div>
                             ) : (
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <FileSpreadsheet className="text-gray-300" size={48} />
                                    <p>Không có đơn hàng nào.</p>
                                    {!currentFileId && <button onClick={handleCreateFile} className="mt-2 text-blue-600 hover:underline text-sm font-medium">Chưa có file? Tạo ngay</button>}
                                </div>
                             )}
                        </td></tr>
                    ) : (
                        sortedOrders.map((order, idx) => {
                            const isUpdating = updatingOrderIds.has(order.id);
                            return (
                                <tr key={order.id + idx} className="hover:bg-blue-50/30 transition-colors group">
                                    {visibleColumns['lastModified'] && <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap border-r border-gray-100">{formatDateDisplay(order.lastModified || order.date)}</td>}
                                    {visibleColumns['date'] && <td className="px-3 py-3 text-xs font-medium text-gray-700 whitespace-nowrap border-r border-gray-100">{formatDateOnly(order.date)}</td>}
                                    {visibleColumns['id'] && <td className="px-3 py-3 border-r border-gray-100"><div className="flex items-center gap-2"><span className="font-bold text-gray-800 text-xs">{order.id}</span><button onClick={() => navigator.clipboard.writeText(order.id)} className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Copy size={12} /></button></div></td>}
                                    {visibleColumns['storeName'] && <td className="px-3 py-3 border-r border-gray-100"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${getStoreBadgeStyle(getStoreName(order.storeId))}`}>{getStoreName(order.storeId)}</span></td>}
                                    {visibleColumns['type'] && <td className="px-3 py-3 text-center border-r border-gray-100"><span className="text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{order.type}</span></td>}
                                    {visibleColumns['sku'] && <td className="px-3 py-3 border-r border-gray-100"><div className="text-xs font-mono text-gray-700 truncate max-w-[12rem]" title={order.sku}>{order.sku}</div></td>}
                                    {visibleColumns['quantity'] && <td className="px-3 py-3 text-center font-bold text-gray-800 border-r border-gray-100">{order.quantity}</td>}
                                    {visibleColumns['tracking'] && <td className="px-3 py-3 border-r border-gray-100">{order.tracking ? <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit"><Truck size={12} /><span className="truncate max-w-[8rem]">{order.tracking}</span><button onClick={() => navigator.clipboard.writeText(order.tracking)} className="hover:text-blue-800 ml-1"><Copy size={10} /></button></div> : <span className="text-xs text-gray-400 italic">---</span>}</td>}
                                    
                                    {visibleColumns['checkbox'] && (
                                        <td className="px-2 py-3 text-center border-r border-gray-100">
                                            {isUpdating ? <Loader2 size={16} className="animate-spin text-orange-500 mx-auto" /> : 
                                            <button onClick={() => handleToggleCheckbox(order)} className={`hover:scale-110 transition-transform ${order.isChecked ? 'text-blue-600' : 'text-gray-300'}`}>{order.isChecked ? <CheckSquare size={18} /> : <Square size={18} />}</button>}
                                        </td>
                                    )}

                                    {visibleColumns['link'] && <td className="px-3 py-3 text-center border-r border-gray-100">{order.link ? <a href={order.link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-full inline-flex"><ExternalLink size={14} /></a> : <span className="text-gray-300">-</span>}</td>}
                                    
                                    {visibleColumns['status'] && (
                                        <td className="px-3 py-3 text-center border-r border-gray-100">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${order.status === 'Fulfilled' ? 'bg-green-100 text-green-700 border-green-200' : order.status === 'Cancelled' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                {order.status || 'Pending'}
                                            </span>
                                        </td>
                                    )}

                                    {visibleColumns['note'] && <td className="px-3 py-3 border-r border-gray-100"><div className="text-xs text-gray-500 italic truncate max-w-[8rem]" title={order.note}>{order.note}</div></td>}
                                    {visibleColumns['handler'] && <td className="px-3 py-3 border-r border-gray-100"><div className="flex items-center gap-1.5"><UserCircle size={14} className="text-gray-400" /><span className="text-xs text-gray-700 font-medium">{order.handler}</span></div></td>}
                                    {visibleColumns['actionRole'] && <td className="px-3 py-3 border-r border-gray-100">{order.actionRole && <span className={`text-[10px] px-2 py-0.5 rounded border ${getRoleBadgeStyle(order.actionRole)}`}>{order.actionRole}</span>}</td>}
                                    
                                    {visibleColumns['isFulfilled'] && (
                                        <td className="px-3 py-3 text-center border-r border-gray-100">
                                            {order.isFulfilled ? (
                                                <div className="flex justify-center">
                                                    <Truck size={18} className="text-green-600" />
                                                </div>
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border border-gray-300 mx-auto"></div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })
                    )}
                </tbody>
             </table>
        </div>

        {/* --- FILTER POPUP --- */}
        {renderFilterPopup()}

        {/* --- SYSTEM MESSAGE MODAL --- */}
        {sysModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                    <div className="p-5 text-center">
                        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
                            sysModal.type === 'success' ? 'bg-green-100' : 
                            sysModal.type === 'error' ? 'bg-red-100' : 
                            sysModal.type === 'confirm' ? 'bg-blue-100' : 'bg-yellow-100'
                        }`}>
                            {sysModal.type === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
                            {sysModal.type === 'error' && <AlertTriangle className="h-6 w-6 text-red-600" />}
                            {sysModal.type === 'confirm' && <Package className="h-6 w-6 text-blue-600" />}
                            {sysModal.type === 'alert' && <Package className="h-6 w-6 text-yellow-600" />}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{sysModal.title}</h3>
                        <p className="text-sm text-gray-500">{sysModal.message}</p>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                        {sysModal.type === 'confirm' ? (
                            <>
                                <button type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm" onClick={() => { sysModal.onConfirm?.(); closeMessage(); }}>
                                    Xác Nhận
                                </button>
                                <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={closeMessage}>
                                    Hủy
                                </button>
                            </>
                        ) : (
                            <button type="button" className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:w-auto sm:text-sm" onClick={closeMessage}>
                                Đóng
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
