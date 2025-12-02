import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, RefreshCw, Copy, ArrowDown, Save, ExternalLink, Calendar, FileSpreadsheet, ChevronLeft, ChevronRight, UserCircle, CheckSquare, Square, Trash2, Edit, Loader2, FolderPlus, AlertTriangle, Info, Filter, ArrowDownAZ, ArrowUpAZ, MapPin, Truck, Lock, Link as LinkIcon, Package, CheckCircle, Tag, ChevronDown, ChevronUp, LayoutGrid, BarChart3, Clock, Settings2, Eye, EyeOff } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { Order, Store, User, OrderItem } from '../types';

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
    // Manual parsing chuỗi để giữ nguyên giá trị Server gửi về
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

// Helper để convert date string sang format cho input datetime-local (YYYY-MM-DDThh:mm)
const toDatetimeLocal = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return localDate.toISOString().slice(0, 16);
    } catch (e) { return ''; }
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
        // Special flashing Red-Green style for Admin
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [sysModal, setSysModal] = useState<SystemModalState>({ isOpen: false, type: 'alert', title: '', message: '' });

  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  
  // --- COLUMN VISIBILITY STATE ---
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try {
          const saved = localStorage.getItem('oms_visible_columns');
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
              isFulfilled: true,
              action: true
          };
      } catch {
          return {
              lastModified: true, date: true, id: true, storeName: true, type: true, sku: true, 
              quantity: true, tracking: true, checkbox: true, link: true, status: true, note: true, 
              handler: true, actionRole: true, isFulfilled: true, action: true
          };
      }
  });

  // Save column preference
  useEffect(() => {
      localStorage.setItem('oms_visible_columns', JSON.stringify(visibleColumns));
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
      checkbox: 'Checkbox',
      link: 'Link',
      status: 'Trạng Thái',
      note: 'Note',
      handler: 'Handler',
      actionRole: 'Role',
      isFulfilled: 'Fulfill',
      action: 'Action'
  };

  // --- SUMMARY STATS STATE ---
  const [showSummary, setShowSummary] = useState(false);
  const [summaryDateRange, setSummaryDateRange] = useState<{start: string, end: string}>({
      start: new Date().toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10)
  });

  const [formDataCommon, setFormDataCommon] = useState({
    id: '', 
    // DATE LIST: No default value for create mode
    date: '', 
    storeId: ''
  });

  const [formDataExtra, setFormDataExtra] = useState({
      tracking: '',
      link: '',
      status: 'Pending',
      actionRole: '',
      isChecked: false,
      isFulfilled: false
  });

  const [rawAddress, setRawAddress] = useState('');
  const [formItems, setFormItems] = useState<OrderItem[]>([
    { 
        sku: '', type: 'Printway', quantity: 1, note: '', 
        productName: '', itemSku: '', 
        urlMockup: '', mockupType: 'Mockup để tham khảo',
        urlArtworkFront: '', urlArtworkBack: ''
    }
  ]);

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

  // Define getStoreName before useMemo
  const getStoreName = (id: string) => {
      const store = stores.find(s => String(s.id) === String(id) || s.name === id);
      return store ? store.name : id;
  };

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
          if (!o.date) return false;
          const dateStr = String(o.date).trim();
          return dateStr.startsWith(monthToFetch);
      });

      if (rawOrders.length > 0 && validOrders.length === 0) {
          const sampleDate = rawOrders[0].date;
          const actualMonth = sampleDate ? sampleDate.substring(0, 7) : 'Không xác định';
          
          setDataError({
              message: `Cảnh báo: Bạn đang chọn Tháng ${monthToFetch} nhưng dữ liệu tải về thuộc Tháng ${actualMonth}.`,
              detail: `Hệ thống vẫn hiển thị dữ liệu bên dưới để bạn kiểm tra. Vui lòng kiểm tra nội dung File Sheet nguồn.`,
              fileId: orderResult.fileId
          });
          setOrders(rawOrders);
          setCurrentFileId(orderResult.fileId); 
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

  // --- SUMMARY CALCULATION ---
  const summaryStats = useMemo(() => {
      const stats: Record<string, number> = {};
      let total = 0;
      
      const start = new Date(summaryDateRange.start);
      start.setHours(0,0,0,0);
      const end = new Date(summaryDateRange.end);
      end.setHours(23,59,59,999);

      orders.forEach(o => {
          const d = new Date(o.date);
          if (d >= start && d <= end) {
              const sName = getStoreName(o.storeId);
              stats[sName] = (stats[sName] || 0) + 1;
              total++;
          }
      });

      return { stats, total };
  }, [orders, summaryDateRange, stores]);


  // ... (Filter logic omitted for brevity, keeping existing)
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
        if (!selectedValues.includes(cellValue)) return false;
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

  // ... (renderFilterPopup, renderTh, showMessage, closeMessage logic maintained)
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

  const renderTh = (label: string, columnKey: string, widthClass?: string, className?: string) => {
      // Check visibility
      if (columnKey !== 'action' && visibleColumns[columnKey] === false) return null;

      const isFilterActive = columnFilters[columnKey] !== undefined;
      const isSorted = sortConfig.key === columnKey;
      return (
        <th className={`px-3 py-3 sticky top-0 bg-gray-100 text-gray-600 border-b border-gray-200 z-20 ${widthClass || ''} ${className || ''}`}>
            <div className="flex items-center justify-between gap-1 group">
                <span className="truncate cursor-pointer flex-1 font-bold text-xs uppercase" onClick={() => handleColumnSort(columnKey as keyof Order, sortConfig.direction === 'asc' ? 'desc' : 'asc')}>{label}</span>
                <div className="relative">
                    <button onClick={(e) => handleFilterClick(e, columnKey)} className={`p-1 rounded hover:bg-gray-200 transition-colors ${isFilterActive || isSorted || activeFilterColumn === columnKey ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'}`}>
                        <Filter size={14} className={isFilterActive ? "text-orange-600 fill-orange-600" : "text-gray-400"} />
                    </button>
                </div>
            </div>
            {isSorted && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500"></div>}
        </th>
      );
  };

  const showMessage = (title: string, message: string, type: SystemModalState['type'] = 'alert', onConfirm?: () => void) => {
      setSysModal({ isOpen: true, title, message, type, onConfirm });
  };
  const closeMessage = () => setSysModal(prev => ({ ...prev, isOpen: false }));

  // ... Handlers ...
  const handleAddItemRow = () => { setFormItems([...formItems, { sku: '', type: 'Printway', quantity: 1, note: '', productName: '', itemSku: '', urlMockup: '', mockupType: 'Mockup để tham khảo', urlArtworkFront: '', urlArtworkBack: '' }]); };
  const handleDuplicateItemRow = (index: number) => { setFormItems([...formItems, { ...formItems[index] }]); };
  const handleRemoveItemRow = (index: number) => { if (formItems.length === 1 && !isEditMode) { setFormItems([{ sku: '', type: 'Printway', quantity: 1, note: '', productName: '', itemSku: '', urlMockup: '', mockupType: 'Mockup để tham khảo', urlArtworkFront: '', urlArtworkBack: '' }]); return; } setFormItems(formItems.filter((_, i) => i !== index)); };
  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => { const updatedItems = [...formItems]; updatedItems[index] = { ...updatedItems[index], [field]: value }; setFormItems(updatedItems); };
  
  const handleIdBlur = () => { if (!isEditMode && formDataCommon.id) { const isDuplicate = orders.some(o => String(o.id).toLowerCase() === formDataCommon.id.trim().toLowerCase()); if (isDuplicate) showMessage('Cảnh báo trùng lặp', `Mã đơn hàng "${formDataCommon.id}" đã tồn tại!`, 'error'); } };
  
  const handleCreateFile = async () => { showMessage('Xác nhận tạo file', `Bạn có chắc chắn muốn tạo file dữ liệu cho Tháng ${selectedMonth}?`, 'confirm', async () => { if (onProcessStart) onProcessStart(); try { const result = await sheetService.createMonthFile(selectedMonth); if (result && result.success) { showMessage('Thành công', `Đã tạo file cho tháng ${selectedMonth} thành công!`, 'success'); loadData(selectedMonth); } else { showMessage('Lỗi', `Không thể tạo file: ${result?.error || "Lỗi không xác định."}`, 'error'); } } catch (e) { showMessage('Lỗi kết nối', 'Không thể kết nối đến server.', 'error'); } finally { if (onProcessEnd) onProcessEnd(); } }); };

  const handleToggleCheckbox = async (order: Order) => { if (updatingOrderIds.has(order.id)) return; if (!currentFileId) return; const newValue = !order.isChecked; setUpdatingOrderIds(prev => new Set(prev).add(order.id)); if (onProcessStart) onProcessStart(); try { await sheetService.updateOrder(currentFileId, order.id, 'isChecked', newValue ? "TRUE" : "FALSE"); setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isChecked: newValue } : o)); } catch (error) { showMessage('Lỗi', 'Không thể cập nhật trạng thái.', 'error'); } finally { setUpdatingOrderIds(prev => { const newSet = new Set(prev); newSet.delete(order.id); return newSet; }); if (onProcessEnd) onProcessEnd(); } };
  
  const openAddModal = () => { 
      setIsEditMode(false); 
      setEditingOrderId(null); 
      // Initialize with empty date for user selection
      setFormDataCommon({ id: '', date: '', storeId: '' }); 
      setFormDataExtra({ tracking: '', link: '', status: 'Pending', actionRole: '', isChecked: false, isFulfilled: false }); 
      setFormItems([{ sku: '', type: 'Printway', quantity: 1, note: '', productName: '', itemSku: '', urlMockup: '', mockupType: 'Mockup để tham khảo', urlArtworkFront: '', urlArtworkBack: '' }]); 
      setRawAddress(''); 
      setIsModalOpen(true); 
  };
  
  const openDuplicateModal = (order: Order) => { 
      setIsEditMode(false); 
      setEditingOrderId(null); 
      // Keep original order date for duplication convenience, or clear it if strict policy
      // Here we keep it but user can change
      const dateVal = toDatetimeLocal(order.date);
      setFormDataCommon({ id: '', date: dateVal, storeId: order.storeId }); 
      setFormDataExtra({ tracking: '', link: '', status: 'Pending', actionRole: order.actionRole || '', isChecked: false, isFulfilled: false }); 
      setFormItems([{ sku: String(order.sku || ''), type: order.type || '', quantity: order.quantity || 1, note: order.note || '', productName: order.productName || '', itemSku: order.itemSku || '', urlMockup: order.urlMockup || '', mockupType: order.mockupType || 'Mockup để tham khảo', urlArtworkFront: order.urlArtworkFront || '', urlArtworkBack: order.urlArtworkBack || '' }]); 
      setIsModalOpen(true); 
  };

  const openEditModal = (order: Order) => { 
      if (updatingOrderIds.has(order.id)) return; 
      setIsEditMode(true); 
      setEditingOrderId(order.id); 
      const dateVal = toDatetimeLocal(order.date); 
      setFormDataCommon({ id: order.id, date: dateVal || order.date, storeId: order.storeId }); 
      setFormDataExtra({ tracking: order.tracking || '', link: order.link || '', status: order.status || 'Pending', actionRole: order.actionRole || '', isChecked: order.isChecked || false, isFulfilled: order.isFulfilled || false }); 
      setFormItems([{ sku: String(order.sku || ''), type: order.type || '', quantity: order.quantity || 1, note: order.note || (order.note || ''), productName: order.productName || '', itemSku: order.itemSku || '', urlMockup: order.urlMockup || '', mockupType: order.mockupType || 'Mockup để tham khảo', urlArtworkFront: order.urlArtworkFront || '', urlArtworkBack: order.urlArtworkBack || '' }]); 
      if (order.shippingFirstName || order.shippingAddress1) { const constructed = `First_name: ${order.shippingFirstName}\nLast_name: ${order.shippingLastName}\nShipping_address1: ${order.shippingAddress1}\nShipping_address2: ${order.shippingAddress2}\nShipping_city: ${order.shippingCity}\nShipping_zip: ${order.shippingZip}\nShipping_province: ${order.shippingProvince}\nShipping_country: ${order.shippingCountry}\nShipping_phone: ${order.shippingPhone}`; setRawAddress(constructed); } else { setRawAddress(''); } 
      setIsModalOpen(true); 
  };

  const getShippingInfoFromRaw = () => { let shipInfo = { name: '', firstName: '', lastName: '', address1: '', address2: '', city: '', province: '', zip: '', country: '', phone: '' }; if (rawAddress.trim()) { const lines = rawAddress.split('\n'); lines.forEach(line => { const parts = line.split(':'); if (parts.length < 2) return; const key = parts[0].trim().toLowerCase(); let value = parts.slice(1).join(':').trim(); if (value === '--') value = ''; if (key === 'first_name') shipInfo.firstName = value; else if (key === 'last_name') shipInfo.lastName = value; else if (key === 'shipping_address1') shipInfo.address1 = value; else if (key === 'shipping_address2') shipInfo.address2 = value; else if (key === 'shipping_city') shipInfo.city = value; else if (key === 'shipping_zip') shipInfo.zip = value; else if (key === 'shipping_province') shipInfo.province = value; else if (key === 'shipping_country') shipInfo.country = value; else if (key === 'shipping_phone') shipInfo.phone = value; }); shipInfo.name = `${shipInfo.firstName} ${shipInfo.lastName}`.trim(); } return shipInfo; };

  // --- UPDATED FULFILL HANDLER ---
  const handleFulfillFromModal = async () => {
        if (!formDataCommon.id || !formDataCommon.storeId) return showMessage('Thiếu thông tin', 'Vui lòng nhập ID và chọn Store.', 'error');
        const validItems = formItems.filter(item => String(item.sku || '').trim() !== '');
        if (validItems.length === 0) return showMessage('Thiếu sản phẩm', "Vui lòng nhập ít nhất 1 sản phẩm (SKU).", 'error');
        if (!currentFileId) return showMessage('Lỗi', 'Không tìm thấy file dữ liệu của tháng này.', 'error');

        showMessage('Xác nhận Fulfill', `Bạn có muốn gửi ${validItems.length} sản phẩm này sang sheet Fulfillment Export?`, 'confirm', async () => {
            setIsModalOpen(false); // Close Modal Immediately
            const orderId = formDataCommon.id;
            setUpdatingOrderIds(prev => new Set(prev).add(orderId)); // Show Loading on Row

            if (onProcessStart) onProcessStart();

            try {
                const selectedStore = stores.find(s => s.id === formDataCommon.storeId);
                const storeValue = selectedStore ? selectedStore.name : formDataCommon.storeId;
                const shipInfo = getShippingInfoFromRaw();
                const systemTime = new Date().toISOString(); // System timestamp for fulfillment action
                
                for (const item of validItems) {
                    const orderToFulfill: Order = {
                        id: orderId,
                        date: formDataCommon.date,
                        lastModified: systemTime, // Track timestamp
                        storeId: storeValue,
                        handler: user?.username || 'Unknown',
                        sku: String(item.sku),
                        type: item.type,
                        quantity: item.quantity,
                        note: item.note,
                        status: formDataExtra.status,
                        tracking: formDataExtra.tracking,
                        link: formDataExtra.link,
                        isChecked: formDataExtra.isChecked,
                        actionRole: formDataExtra.actionRole,
                        shippingName: shipInfo.name,
                        shippingFirstName: shipInfo.firstName,
                        shippingLastName: shipInfo.lastName,
                        shippingAddress1: shipInfo.address1,
                        shippingAddress2: shipInfo.address2,
                        shippingCity: shipInfo.city,
                        shippingProvince: shipInfo.province,
                        shippingZip: shipInfo.zip,
                        shippingCountry: shipInfo.country,
                        shippingPhone: shipInfo.phone,
                        productName: item.productName,
                        itemSku: item.itemSku,
                        urlMockup: item.urlMockup,
                        mockupType: item.mockupType,
                        urlArtworkFront: item.urlArtworkFront,
                        urlArtworkBack: item.urlArtworkBack,
                        isFulfilled: true
                    };
                    await sheetService.fulfillOrder(currentFileId!, orderToFulfill);
                }

                // Update UI state silently without success popup
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isFulfilled: true } : o));
                if (isEditMode) {
                     await sheetService.updateOrder(currentFileId!, orderId, 'isFulfilled', "TRUE");
                }
            } catch (error: any) {
                showMessage('Lỗi Fulfill', error.message || "Không thể gửi dữ liệu.", 'error');
            } finally {
                setUpdatingOrderIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(orderId);
                    return newSet;
                });
                if (onProcessEnd) onProcessEnd();
            }
        });
  };

  const handleSubmitOrder = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!formDataCommon.id || !formDataCommon.storeId) return showMessage('Thiếu thông tin', 'Vui lòng nhập ID và chọn Store.', 'error'); 
      if (!formDataCommon.date) return showMessage('Thiếu thông tin', 'Vui lòng chọn Ngày Đặt.', 'error');
      
      const validItems = formItems.filter(item => String(item.sku || '').trim() !== ''); 
      if (validItems.length === 0) return showMessage('Thiếu sản phẩm', "Vui lòng nhập ít nhất 1 sản phẩm (SKU).", 'error'); 
      
      const selectedStore = stores.find(s => s.id === formDataCommon.storeId); 
      const storeValue = selectedStore ? selectedStore.name : formDataCommon.storeId; 
      const shipInfo = getShippingInfoFromRaw(); 
      
      // AUTO GENERATE SYSTEM TIMESTAMP (Last Modified / Created At)
      const systemTime = new Date().toISOString();

      if (isEditMode) { 
          const itemToUpdate = validItems[0]; 
          const updateData = { 
              // Basic fields
              type: itemToUpdate.type, 
              sku: itemToUpdate.sku, 
              quantity: itemToUpdate.quantity, 
              note: itemToUpdate.note, 
              tracking: formDataExtra.tracking, 
              link: formDataExtra.link, 
              status: formDataExtra.status, 
              actionRole: formDataExtra.actionRole, 
              isChecked: formDataExtra.isChecked, 
              
              // Product details
              productName: itemToUpdate.productName, 
              itemSku: itemToUpdate.itemSku, 
              urlMockup: itemToUpdate.urlMockup, 
              mockupType: itemToUpdate.mockupType, 
              urlArtworkFront: itemToUpdate.urlArtworkFront, 
              urlArtworkBack: itemToUpdate.urlArtworkBack, 
              
              // Shipping
              shippingName: shipInfo.name, 
              shippingFirstName: shipInfo.firstName, 
              shippingLastName: shipInfo.lastName, 
              shippingAddress1: shipInfo.address1, 
              shippingAddress2: shipInfo.address2, 
              shippingCity: shipInfo.city, 
              shippingProvince: shipInfo.province, 
              shippingZip: shipInfo.zip, 
              shippingCountry: shipInfo.country, 
              shippingPhone: shipInfo.phone, 
              
              // NEW: Update system timestamp
              lastModified: systemTime
          }; 
          
          const orderIdToUpdate = editingOrderId!; 
          setIsModalOpen(false); 
          setUpdatingOrderIds(prev => new Set(prev).add(orderIdToUpdate)); 
          
          if (onProcessStart) onProcessStart(); 
          try { 
              if (currentFileId) { 
                  await sheetService.updateOrderBatch(currentFileId, orderIdToUpdate, updateData); 
                  // Update local state immediately including system timestamp
                  setOrders(prev => prev.map(o => o.id === orderIdToUpdate ? { ...o, ...updateData, date: formDataCommon.date } : o));
              } 
          } catch (error) { 
              showMessage('Lỗi cập nhật', `Không thể cập nhật đơn ${orderIdToUpdate}.`, 'error'); 
          } finally { 
              setUpdatingOrderIds(prev => { const newSet = new Set(prev); newSet.delete(orderIdToUpdate); return newSet; }); 
              if (onProcessEnd) onProcessEnd(); 
          } 
      } else { 
          const orderIdToAdd = formDataCommon.id.trim(); 
          const orderMonth = formDataCommon.date.substring(0, 7); 
          const needsFileCreation = !currentFileId || (orderMonth !== selectedMonth); 
          
          const ordersToCreate: Order[] = validItems.map(item => ({ 
              id: orderIdToAdd, 
              date: formDataCommon.date, 
              lastModified: systemTime, // New Order Timestamp
              storeId: storeValue, 
              handler: user?.username || 'Unknown', 
              sku: item.sku, 
              type: item.type, 
              quantity: item.quantity, 
              note: item.note, 
              status: formDataExtra.status, 
              tracking: formDataExtra.tracking, 
              link: formDataExtra.link, 
              isChecked: formDataExtra.isChecked, 
              actionRole: formDataExtra.actionRole, 
              shippingName: shipInfo.name, 
              shippingFirstName: shipInfo.firstName, 
              shippingLastName: shipInfo.lastName, 
              shippingAddress1: shipInfo.address1, 
              shippingAddress2: shipInfo.address2, 
              shippingCity: shipInfo.city, 
              shippingProvince: shipInfo.province, 
              shippingZip: shipInfo.zip, 
              shippingCountry: shipInfo.country, 
              shippingPhone: shipInfo.phone, 
              rawShipping: '', 
              productName: item.productName, 
              itemSku: item.itemSku, 
              urlMockup: item.urlMockup, 
              mockupType: item.mockupType, 
              urlArtworkFront: item.urlArtworkFront, 
              urlArtworkBack: item.urlArtworkBack, 
              isFulfilled: false 
          })); 
          
          const targetFileId = (orderMonth === selectedMonth) ? currentFileId : undefined; 
          
          if (needsFileCreation && !targetFileId) { 
              setIsSubmitting(true); 
              if (onProcessStart) onProcessStart(); 
              try { 
                  await sheetService.addOrder(ordersToCreate[0]); 
                  if (ordersToCreate.length > 1) { 
                      await Promise.all(ordersToCreate.slice(1).map(o => sheetService.addOrder(o))); 
                  } 
                  setIsModalOpen(false); 
                  setIsSubmitting(false); 
                  showMessage('Thành công', `Đã tạo đơn ${orderIdToAdd} và file dữ liệu mới.`, 'success'); 
                  if (orderMonth === selectedMonth) await loadData(selectedMonth); 
              } catch (error: any) { 
                  setIsSubmitting(false); 
                  showMessage('Lỗi tạo đơn', error.message || "Không thể tạo file mới.", 'error'); 
              } finally { 
                  if (onProcessEnd) onProcessEnd(); 
              } 
          } else { 
              if (orders.some(o => String(o.id).toLowerCase() === orderIdToAdd.toLowerCase())) { 
                  showMessage('Trùng lặp', `Mã đơn hàng ${orderIdToAdd} đã tồn tại!`, 'error'); 
                  return; 
              } 
              setIsModalOpen(false); 
              setOrders(prev => [...ordersToCreate, ...prev]); 
              setUpdatingOrderIds(prev => new Set(prev).add(orderIdToAdd)); 
              if (onProcessStart) onProcessStart(); 
              Promise.all(ordersToCreate.map(order => sheetService.addOrder(order, targetFileId || undefined)))
                  .then(() => { })
                  .catch((error) => { 
                      showMessage('Lỗi lưu đơn', `${error.message || "Không thể đồng bộ."} Đã hoàn tác.`, 'error'); 
                      setOrders(prev => prev.filter(o => o.id !== orderIdToAdd)); 
                  })
                  .finally(() => { 
                      setUpdatingOrderIds(prev => { const newSet = new Set(prev); newSet.delete(orderIdToAdd); return newSet; }); 
                      if (onProcessEnd) onProcessEnd(); 
                  }); 
          } 
      } 
  };

  const handleAddUnit = async () => { if (!newUnitName.trim()) return; try { await sheetService.addUnit(newUnitName.trim()); const updatedUnits = await sheetService.getUnits(); setUnits(updatedUnits); if (formItems.length > 0) handleItemChange(0, 'type', newUnitName.trim()); setIsAddingUnit(false); setNewUnitName(''); } catch (error) { showMessage('Lỗi', "Lỗi khi thêm Đơn vị", 'error'); } };

  const getStatusColorClass = (status: string) => { const s = String(status).toLowerCase(); if (s === 'fulfilled' || s === 'completed') return 'text-green-700 bg-green-50 border-green-200'; if (s === 'pending' || s === 'processing') return 'text-yellow-700 bg-yellow-50 border-yellow-200'; if (s === 'cancelled') return 'text-red-700 bg-red-50 border-red-200'; if (s === 'refund') return 'text-purple-700 bg-purple-50 border-purple-200'; if (s === 'resend') return 'text-blue-700 bg-blue-50 border-blue-200'; return 'text-gray-700 bg-gray-50 border-gray-200'; };

  const handleMonthChange = (step: number) => { const [year, month] = selectedMonth.split('-').map(Number); const date = new Date(year, month - 1 + step, 1); const newYear = date.getFullYear(); const newMonth = String(date.getMonth() + 1).padStart(2, '0'); setSelectedMonth(`${newYear}-${newMonth}`); };

  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');
  const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400 bg-white text-gray-900";
  const assignableUsers = allUsers.filter(u => getRoleLevel(u.role) >= getRoleLevel(user?.role || ''));

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="bg-white shadow-sm overflow-hidden rounded-lg flex flex-col h-full relative">
        {renderFilterPopup()}

        <div className="p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white z-20">
          {/* Header content ... */}
          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap flex items-center gap-2">
                DANH SÁCH ĐƠN HÀNG <span className="text-orange-600 uppercase text-sm border border-orange-200 bg-orange-50 px-2 py-0.5 rounded">Tháng {currentMonthStr}/{currentYearStr}</span>
                <button onClick={() => loadData(selectedMonth)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Làm mới">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
            </h2>
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm p-1">
                    <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500"><ChevronLeft size={18} /></button>
                    <div className="flex items-center px-2 gap-1 font-bold text-gray-700 min-w-[140px] justify-center">
                        <Calendar size={14} className="text-orange-500" />
                        <select value={currentMonthStr} onChange={(e) => setSelectedMonth(`${currentYearStr}-${e.target.value}`)} className="bg-transparent outline-none appearance-none cursor-pointer hover:text-orange-600 text-center">{monthsList.map(m => (<option key={m} value={m}>Tháng {parseInt(m)}</option>))}</select>
                        <span>/</span>
                        <select value={currentYearStr} onChange={(e) => setSelectedMonth(`${e.target.value}-${currentMonthStr}`)} className="bg-transparent outline-none appearance-none cursor-pointer hover:text-orange-600">{yearsList.map(y => (<option key={y} value={y}>{y}</option>))}</select>
                    </div>
                    <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500"><ChevronRight size={18} /></button>
                </div>
                {/* File handling buttons */}
                {currentFileId ? (
                    <a href={`https://docs.google.com/spreadsheets/d/${currentFileId}/edit`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors shadow-sm text-sm font-medium h-[42px]">
                        <FileSpreadsheet size={18} /> <span className="hidden sm:inline">Mở Sheet</span>
                    </a>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="h-[42px] px-3 flex items-center justify-center bg-gray-50 text-gray-400 border border-gray-200 rounded-lg text-xs italic">No File</div>
                        {user?.role === 'admin' && (
                             <button onClick={handleCreateFile} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm text-sm font-medium h-[42px]" title="Admin: Tạo file cho tháng này"><FolderPlus size={18} /> <span className="hidden sm:inline">Tạo File</span></button>
                        )}
                    </div>
                )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
             <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="Tìm ID, SKU, Tracking, User..." className="pl-9 pr-4 py-2 border border-gray-500 rounded-lg text-sm w-full focus:ring-2 focus:ring-orange-500 outline-none shadow-sm bg-slate-700 text-white placeholder-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
             </div>
             
             {/* COLUMN VISIBILITY TOGGLE */}
             <div className="relative">
                <button 
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm h-[42px]"
                    title="Cấu hình cột hiển thị"
                >
                    <Settings2 size={18} />
                </button>
                
                {showColumnSelector && (
                    <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-3 animate-fade-in">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 px-1">Cột hiển thị</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {Object.entries(columnLabels).map(([key, label]) => (
                                <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm">
                                    <input 
                                        type="checkbox" 
                                        checked={visibleColumns[key]} 
                                        onChange={() => toggleColumn(key)}
                                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
                                    />
                                    <span className="flex-1">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
             </div>

             <button onClick={() => setShowSummary(!showSummary)} className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${showSummary ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <BarChart3 size={18} />
             </button>
             <button onClick={openAddModal} className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow-md whitespace-nowrap">
                <Plus size={18} /> <span>Thêm Đơn</span>
             </button>
          </div>
        </div>

        {/* ERROR WARNING BANNER */}
        {dataError && (
             <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-start gap-3 text-red-700">
                    <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-sm">{dataError.message}</p>
                        <p className="text-xs mt-1 opacity-90">{dataError.detail}</p>
                    </div>
                </div>
                {dataError.fileId && (
                     <a href={`https://docs.google.com/spreadsheets/d/${dataError.fileId}/edit`} target="_blank" rel="noreferrer" className="flex-shrink-0 flex items-center gap-1.5 bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-50 transition-colors shadow-sm">
                         <FileSpreadsheet size={14} /> Kiểm tra File Gốc
                     </a>
                )}
            </div>
        )}

        {/* --- SUMMARY DASHBOARD --- */}
        {showSummary && (
             <div className="bg-gray-50 border-b border-gray-200 p-4 animate-slide-in">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                     <h3 className="text-sm font-bold text-indigo-800 uppercase flex items-center gap-2">
                         <BarChart3 size={16} /> Tổng hợp theo Store
                     </h3>
                     <div className="flex items-center gap-2 bg-slate-700 p-1 rounded-md border border-gray-600 shadow-sm">
                         <input type="date" className="text-xs border-none outline-none text-white font-medium bg-transparent" value={summaryDateRange.start} onChange={(e) => setSummaryDateRange({...summaryDateRange, start: e.target.value})} />
                         <span className="text-gray-400 text-xs">→</span>
                         <input type="date" className="text-xs border-none outline-none text-white font-medium bg-transparent" value={summaryDateRange.end} onChange={(e) => setSummaryDateRange({...summaryDateRange, end: e.target.value})} />
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                     {stores.map(store => {
                         const count = summaryStats.stats[store.name] || 0;
                         if (count === 0) return null;
                         return (
                             <div key={store.id} className="bg-white rounded border border-indigo-100 p-3 shadow-sm flex flex-col items-center justify-center text-center">
                                 <span className="text-xs text-gray-500 font-medium truncate w-full" title={store.name}>{store.name}</span>
                                 <span className="text-xl font-bold text-indigo-600 mt-1">{count}</span>
                                 <span className="text-[10px] text-gray-400">đơn hàng</span>
                             </div>
                         )
                     })}
                     <div className="bg-indigo-600 rounded border border-indigo-700 p-3 shadow-sm flex flex-col items-center justify-center text-center text-white">
                         <span className="text-xs font-medium opacity-80">TỔNG CỘNG</span>
                         <span className="text-xl font-bold mt-1">{summaryStats.total}</span>
                         <span className="text-[10px] opacity-80">đơn hàng</span>
                     </div>
                 </div>
             </div>
        )}

        <div className="overflow-auto max-h-[calc(100vh-200px)] custom-scrollbar" onClick={() => setShowColumnSelector(false)}>
          <table className="w-full text-left border-collapse text-sm relative">
            <thead className="text-gray-600 bg-gray-50 border-b border-gray-200 font-bold uppercase text-xs tracking-wider sticky top-0 z-20">
              <tr>
                {/* SWAPPED & RENAMED: lastModified -> Date List */}
                {renderTh("Date List", "lastModified", "w-32", "text-gray-400")}
                
                {/* SWAPPED & RENAMED: date -> Date Order */}
                {renderTh("Date Order", "date", "w-32")}
                
                {renderTh("ID Order", "id")}
                {renderTh("Store", "storeName")}
                {renderTh("Loại", "type", "w-24")}
                {renderTh("SKU", "sku")}
                {renderTh("Qty", "quantity", "w-16")}
                {renderTh("Tracking", "tracking", "w-32")}
                {visibleColumns['checkbox'] && <th className="px-1 py-3 border-r border-gray-200 w-10 sticky top-0 bg-gray-50 z-20 text-center">Chk</th>}
                {renderTh("Link", "link", "w-20")}
                {renderTh("Trạng Thái", "status", "w-32")}
                {visibleColumns['note'] && <th className="px-3 py-3 border-r border-gray-200 min-w-[150px] sticky top-0 bg-yellow-50 text-gray-700 z-20">Note</th>}
                {renderTh("Handler", "handler", "w-32")}
                {renderTh("Role", "actionRole", "w-32")}
                {renderTh("Fulfill", "isFulfilled", "w-24")}
                {visibleColumns['action'] && <th className="px-3 py-3 w-16 sticky top-0 bg-gray-50 z-20 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? 
                <tr><td colSpan={Object.keys(visibleColumns).filter(k => visibleColumns[k]).length + 2} className="text-center py-12 text-gray-500"><div className="flex justify-center items-center gap-2"><Loader2 className="animate-spin" /> Đang tải dữ liệu Tháng {currentMonthStr}...</div></td></tr> : 
                (sortedOrders.length === 0 ? 
                    <tr><td colSpan={Object.keys(visibleColumns).filter(k => visibleColumns[k]).length + 2} className="text-center py-12 text-gray-500">
                        {dataError ? 'Dữ liệu không khớp nhưng đã được hiển thị để kiểm tra.' : `Tháng ${selectedMonth} chưa có đơn hàng nào hoặc không tìm thấy kết quả.`}
                    </td></tr> :
                    sortedOrders.map((order, idx) => (
                        <tr key={order.id + idx} className={`border-b border-gray-200 transition-colors ${dataError ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50 text-gray-800'}`}>
                            {/* System Date Column (Date List) - Has Time */}
                            {visibleColumns['lastModified'] && (
                                <td className="px-3 py-3 border-r text-center whitespace-nowrap text-gray-400 font-mono text-[10px]">
                                    {order.lastModified ? formatDateDisplay(order.lastModified) : '-'}
                                </td>
                            )}
                            
                            {/* User Input Date Column (Date Order) - Date Only */}
                            {visibleColumns['date'] && (
                                <td className="px-3 py-3 border-r text-center whitespace-nowrap text-gray-600 font-mono text-xs font-bold">
                                    {formatDateOnly(order.date)}
                                </td>
                            )}

                            {visibleColumns['id'] && (
                                <td className="px-3 py-3 border-r font-semibold text-gray-900 whitespace-nowrap">
                                    <div className="flex justify-between items-center group gap-2">
                                        <span>{order.id}</span>
                                        <button className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(order.id)} title="Copy ID">
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                </td>
                            )}
                            
                            {visibleColumns['storeName'] && (
                                <td className={`px-3 py-3 border-r`}>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getStoreBadgeStyle(getStoreName(order.storeId))}`}>
                                        {getStoreName(order.storeId)}
                                    </span>
                                </td>
                            )}
                            
                            {visibleColumns['type'] && <td className="px-3 py-3 border-r text-center">{order.type}</td>}
                            {visibleColumns['sku'] && <td className="px-3 py-3 border-r font-mono text-xs text-gray-600">{order.sku}</td>}
                            {visibleColumns['quantity'] && <td className="px-3 py-3 border-r text-center font-bold">{order.quantity}</td>}
                            {visibleColumns['tracking'] && <td className="px-3 py-3 border-r text-center text-xs text-gray-600">{order.tracking || '-'}</td>}
                            
                            {visibleColumns['checkbox'] && (
                                <td className="px-1 py-1 border-r text-center align-middle">
                                    {updatingOrderIds.has(order.id) ? (
                                        <div className="flex justify-center">
                                            <Loader2 size={16} className="animate-spin text-orange-500" />
                                        </div>
                                    ) : (
                                        <button onClick={() => handleToggleCheckbox(order)} className="p-1 hover:bg-gray-100 rounded focus:outline-none transition-colors">
                                            {order.isChecked ? <CheckSquare size={18} className="text-green-600" /> : <Square size={18} className="text-gray-300" />}
                                        </button>
                                    )}
                                </td>
                            )}
                            
                            {visibleColumns['link'] && (
                                <td className="px-3 py-3 border-r text-center">
                                    {order.link && (
                                        <a href={order.link} target="_blank" className="text-blue-600 hover:underline text-xs flex items-center justify-center gap-1">
                                            <ExternalLink size={14} />
                                        </a>
                                    )}
                                </td>
                            )}
                            
                            {visibleColumns['status'] && (
                                <td className="px-3 py-3 border-r text-center">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStatusColorClass(order.status as string).replace('bg-white', '').replace('text-gray-700', '')}`}>
                                        {order.status}
                                    </span>
                                </td>
                            )}
                            
                            {visibleColumns['note'] && <td className="px-3 py-3 bg-yellow-50 border-r text-xs text-gray-700">{order.note}</td>}
                            {visibleColumns['handler'] && <td className="px-3 py-3 border-r text-center text-xs font-medium text-gray-700 bg-gray-50/50">{order.handler || user?.username}</td>}
                            
                            {visibleColumns['actionRole'] && (
                                <td className="px-3 py-3 border-r text-center">
                                    {order.actionRole && (
                                        <span className={`text-xs px-2 py-1 rounded ${getRoleBadgeStyle(order.actionRole)}`}>
                                            {order.actionRole}
                                        </span>
                                    )}
                                    {!order.actionRole && <span className="text-gray-300 text-xs">-</span>}
                                </td>
                            )}
                            
                            {visibleColumns['isFulfilled'] && (
                                <td className="px-3 py-3 border-r text-center">
                                    {order.isFulfilled ? <span title="Đã Fulfill"><Truck size={18} className="text-blue-600 inline" /></span> : <span className="text-gray-300">-</span>}
                                </td>
                            )}
                            
                            {visibleColumns['action'] && (
                                <td className="px-3 py-3 text-center">
                                    {updatingOrderIds.has(order.id) ? (
                                        <Loader2 size={16} className="animate-spin text-orange-500 mx-auto" />
                                    ) : (
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => openEditModal(order)} className={`p-1.5 rounded transition-colors ${order.isFulfilled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`} title={order.isFulfilled ? "Đã khóa do Fulfill" : "Sửa"} disabled={order.isFulfilled}>{order.isFulfilled ? <Lock size={16} /> : <Edit size={16} />}</button>
                                            <button onClick={() => openDuplicateModal(order)} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded" title="Nhân bản"><Copy size={16} /></button>
                                        </div>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))
                )
              }
            </tbody>
          </table>
        </div>

        {/* Modal Logic ... */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-6xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-fade-in border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-800 text-white">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            {isEditMode ? <Edit className="text-orange-400" size={24} /> : <Plus className="text-orange-400" size={24} />}
                            {isEditMode ? 'CHỈNH SỬA ĐƠN HÀNG' : 'TẠO ĐƠN HÀNG MỚI'}
                        </h3>
                        {!isSubmitting && <button onClick={() => setIsModalOpen(false)} className="text-gray-300 hover:text-white transition-colors"><Trash2 size={24} className="rotate-45" /></button>}
                    </div>
                    <form onSubmit={handleSubmitOrder} className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                         <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* GENERAL INFO */}
                            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                                <h4 className="text-orange-600 text-xs font-bold uppercase mb-4 border-b border-orange-100 pb-2 flex items-center gap-2"><Info size={16} /> Thông tin chung</h4>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ngày Order (List) <span className="text-red-500">*</span></label>
                                        <input 
                                            type="datetime-local" 
                                            step="1" 
                                            required 
                                            className={inputClass} 
                                            value={formDataCommon.date} 
                                            onChange={(e) => setFormDataCommon({...formDataCommon, date: e.target.value})} 
                                            readOnly={isEditMode} 
                                            placeholder="Chọn ngày..."
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1 italic">
                                            Thời gian hiển thị trên danh sách.
                                        </p>
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mã Đơn (ID) <span className="text-red-500">*</span></label>
                                        <input type="text" required className={inputClass} placeholder="ORD-..." value={formDataCommon.id} onChange={(e) => setFormDataCommon({...formDataCommon, id: e.target.value})} onBlur={handleIdBlur} readOnly={isEditMode} />
                                    </div>
                                    <div className="md:col-span-4">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cửa Hàng <span className="text-red-500">*</span></label>
                                        <select required className={inputClass} value={formDataCommon.storeId} onChange={(e) => setFormDataCommon({...formDataCommon, storeId: e.target.value})} disabled={isEditMode}>
                                            <option value="">-- Chọn Store --</option>
                                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    
                                    {/* System Date Display (Only in Edit Mode) */}
                                    {isEditMode && (
                                        <div className="md:col-span-12 flex items-center gap-2 text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-100">
                                            <Clock size={14} className="text-orange-500"/>
                                            <span>
                                                Hệ thống sẽ tự động cập nhật <strong>Ngày Hệ Thống</strong> thành thời điểm hiện tại khi bạn lưu thay đổi.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* PRODUCT INFO ... (Rest of Form) */}
                            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2"><h4 className="text-orange-600 text-xs font-bold uppercase flex items-center gap-2"><Package size={16} /> Sản Phẩm ({formItems.length})</h4>{!isEditMode && user?.role === 'admin' && (<button type="button" onClick={() => setIsAddingUnit(true)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-2 py-1 rounded border border-blue-200"><Plus size={12} className="mr-1" /> Thêm Unit</button>)}</div>
                                {isAddingUnit && (<div className="flex gap-2 mb-4 bg-blue-50 p-3 rounded border border-blue-200"><input type="text" className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm bg-white" placeholder="Tên đơn vị mới..." value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} /><button type="button" onClick={handleAddUnit} className="bg-blue-600 text-white px-3 rounded text-xs font-bold">Lưu</button><button type="button" onClick={() => setIsAddingUnit(false)} className="bg-white text-gray-600 px-2 rounded text-xs border border-gray-300">✕</button></div>)}
                                <div className="space-y-4">
                                    {formItems.map((item, index) => (
                                        <div key={index} className="bg-slate-50 border border-gray-300 rounded-lg p-4 relative group hover:border-orange-300 transition-colors">
                                            <div className="flex justify-between items-start mb-3 border-b border-gray-200 pb-2">
                                                <div className="flex items-center gap-2"><span className="bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded">#{index + 1}</span>{!isEditMode && <button type="button" onClick={() => handleDuplicateItemRow(index)} className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"><Copy size={12} /> Nhân bản</button>}</div>
                                                {!isEditMode && <button type="button" onClick={() => handleRemoveItemRow(index)} className="text-gray-400 hover:text-red-500 bg-white p-1 rounded hover:bg-red-50"><Trash2 size={16} /></button>}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                                                <div className="lg:col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Loại</label><select className={inputClass} value={item.type} onChange={(e) => handleItemChange(index, 'type', e.target.value)}><option value="">-- Chọn --</option>{units.map((u, i) => <option key={i} value={u}>{u}</option>)}{!units.includes('Printway') && <option value="Printway">Printway</option>}<option value="Khác">Khác</option></select></div>
                                                <div className="lg:col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SKU <span className="text-red-500">*</span></label><input type="text" className={`font-mono font-bold ${inputClass}`} placeholder="Mã SKU..." value={item.sku} onChange={(e) => handleItemChange(index, 'sku', e.target.value)} /></div>
                                                <div className="lg:col-span-1"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Lượng</label><input type="number" className={`text-center font-bold ${inputClass}`} value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="1" /></div>
                                                <div className="lg:col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Item SKU</label><input type="text" className={inputClass} placeholder="Mã item..." value={item.itemSku || ''} onChange={(e) => handleItemChange(index, 'itemSku', e.target.value)} /></div>
                                                <div className="lg:col-span-5"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Mockup URL</label><input type="text" className={inputClass} placeholder="URL..." value={item.urlMockup || ''} onChange={(e) => handleItemChange(index, 'urlMockup', e.target.value)} /></div>
                                                <div className="lg:col-span-5"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Product Name</label><input type="text" className={inputClass} placeholder="Tên sản phẩm..." value={item.productName || ''} onChange={(e) => handleItemChange(index, 'productName', e.target.value)} /></div>
                                                <div className="lg:col-span-7"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ghi Chú Sản Phẩm (Note)</label><input type="text" className={`${inputClass} bg-yellow-50 border-yellow-200 focus:ring-yellow-400`} placeholder="Ghi chú chi tiết cho sản phẩm này..." value={item.note || ''} onChange={(e) => handleItemChange(index, 'note', e.target.value)} /></div>
                                                <div className="lg:col-span-6"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Artwork Front</label><input type="text" className={inputClass} placeholder="URL..." value={item.urlArtworkFront || ''} onChange={(e) => handleItemChange(index, 'urlArtworkFront', e.target.value)} /></div>
                                                <div className="lg:col-span-6"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Artwork Back</label><input type="text" className={inputClass} placeholder="URL..." value={item.urlArtworkBack || ''} onChange={(e) => handleItemChange(index, 'urlArtworkBack', e.target.value)} /></div>
                                            </div>
                                        </div>
                                    ))}
                                    {!isEditMode && (<button type="button" onClick={handleAddItemRow} className="w-full py-3 bg-white border-2 border-dashed border-gray-300 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2"><Plus size={16} /> Thêm Sản Phẩm</button>)}
                                </div>
                            </div>

                            {/* TRACKING & SHIPPING */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm"><h4 className="text-orange-600 text-xs font-bold uppercase mb-4 border-b border-orange-100 pb-2 flex items-center gap-2"><Tag size={16} /> Xử lý & Tracking</h4><div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 mb-1">Tracking Number</label><input type="text" className={inputClass} value={formDataExtra.tracking} onChange={(e) => setFormDataExtra({...formDataExtra, tracking: e.target.value})} /></div><div><label className="block text-xs font-bold text-gray-500 mb-1">Link Tracking</label><input type="text" className={inputClass} value={formDataExtra.link} onChange={(e) => setFormDataExtra({...formDataExtra, link: e.target.value})} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-500 mb-1">Trạng Thái</label><select className={inputClass} value={formDataExtra.status} onChange={(e) => setFormDataExtra({...formDataExtra, status: e.target.value})}><option value="Pending">Pending</option><option value="Fulfilled">Fulfilled</option><option value="Cancelled">Cancelled</option><option value="Resend">Resend</option><option value="Refund">Refund</option></select></div><div><label className="block text-xs font-bold text-gray-500 mb-1">Role Action</label><select className={inputClass} value={formDataExtra.actionRole} onChange={(e) => setFormDataExtra({...formDataExtra, actionRole: e.target.value})}><option value="">-- Assign User --</option>{assignableUsers.map(u => (<option key={u.username} value={u.username}>{u.username} ({u.role})</option>))}</select></div></div></div></div>
                                <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-100 shadow-sm"><h4 className="text-blue-700 text-xs font-bold uppercase mb-4 border-b border-blue-200 pb-2 flex items-center gap-2"><MapPin size={16} /> Thông tin Giao Hàng</h4><div><label className="block text-xs font-bold text-gray-500 mb-1">Paste Shipping Info (Key: Value)</label><textarea className={`${inputClass} h-32 font-mono text-xs`} placeholder={`First_name: John\nLast_name: Doe\nShipping_address1: 123 Main St...`} value={rawAddress} onChange={(e) => setRawAddress(e.target.value)} /><p className="text-[10px] text-gray-500 mt-1 italic">* Hệ thống tự động phân tích định dạng Key: Value khi lưu.</p></div></div>
                            </div>
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                            {isEditMode && !formDataExtra.isFulfilled && (
                                <button 
                                    type="button" 
                                    disabled={isSubmitting} 
                                    onClick={handleFulfillFromModal} 
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 mr-auto"
                                    title="Lưu thông tin hiện tại và gửi sang Fulfillment"
                                >
                                    <Truck size={18} /> Fulfill Ngay
                                </button>
                            )}
                            <button type="button" disabled={isSubmitting} onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-all transform active:scale-95">
                                {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20} />} 
                                {isSubmitting ? 'Đang xử lý...' : (isEditMode ? 'Lưu Thay Đổi' : 'Tạo Đơn Hàng')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      {sysModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4">
                  <h3 className="font-bold text-lg mb-2">{sysModal.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{sysModal.message}</p>
                  <div className="flex justify-end gap-2">
                      {sysModal.type === 'confirm' && <button onClick={closeMessage} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Hủy</button>}
                      <button onClick={() => { closeMessage(); if(sysModal.onConfirm) sysModal.onConfirm(); }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded font-bold">OK</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
