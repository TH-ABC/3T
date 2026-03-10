import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Copy, ArrowUp, ArrowDown, Calendar, UserCircle, ChevronLeft, ChevronRight, Settings, Save, X, Loader2, CheckCircle, AlertCircle, Filter, ArrowDownAZ, ArrowUpAZ, AlertTriangle, Info, FileSpreadsheet, DollarSign, CheckSquare, Square, Users, Layers, Code, PenTool, Edit, Shield } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { Order, Store, User } from '../types';

const getCurrentLocalMonth = () => { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); return `${year}-${month}`; };

interface DesignerOnlineListProps { user: User; onProcessStart?: () => void; onProcessEnd?: () => void; }

export const DesignerOnlineList: React.FC<DesignerOnlineListProps> = ({ user, onProcessStart, onProcessEnd }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [skuMap, setSkuMap] = useState<Record<string, string>>({}); 
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<{ message: string, detail?: string, fileId?: string } | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterSearchTerm, setFilterSearchTerm] = useState(''); 
  const [filterPopupPos, setFilterPopupPos] = useState<{ top: number, left: number, alignRight: boolean } | null>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentLocalMonth());
  const selectedMonthRef = useRef<string>(selectedMonth);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
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
  const [isLoadingPrices, setIsLoadingPrices] = useState(false); 
  const [backendConfigError, setBackendConfigError] = useState(false);

  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try {
          const saved = localStorage.getItem('oms_designer_online_visible_columns');
          return saved ? JSON.parse(saved) : {
              id: true, store: true, sku: true, pl: true, linkDs: true,
              check: true, note: true, chk: true, nxl: true, ar: true, optionsText: true
          };
      } catch {
          return {
              id: true, store: true, sku: true, pl: true, linkDs: true,
              check: true, note: true, chk: true, nxl: true, ar: true, optionsText: true
          };
      }
  });

  useEffect(() => { localStorage.setItem('oms_designer_online_visible_columns', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  const currentYear = new Date().getFullYear();
  const monthsList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const yearsList = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));
  const PRICE_CATEGORIES = ['Loại 1', 'Loại 2', 'Loại 3', 'Loại 4'];

  const getStoreName = (id: string) => { const store = stores.find(s => String(s.id) === String(id) || s.name === id); return store ? store.name : id; };
  
  // FIX: Đảm bảo key luôn là string trước khi toLowerCase
  const normalizeKey = (key: any) => key !== undefined && key !== null ? String(key).toLowerCase().trim() : '';

  const loadData = async (monthToFetch: string) => {
    setLoading(true); setOrders([]); setDataError(null); setCurrentFileId(null); setSelectedOrderIds(new Set());
    try {
      const results = await Promise.allSettled([sheetService.getOrders(monthToFetch), sheetService.getStores(), sheetService.getUsers(), sheetService.getSkuMappings(), sheetService.getPriceMappings()]);
      if (selectedMonthRef.current !== monthToFetch) return;
      
      const orderResultRaw = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: 'Lỗi kết nối API' };
      
      // Handle API Error
      if (orderResultRaw && (orderResultRaw as any).success === false) {
        setDataError({ 
          message: 'Không thể tải dữ liệu từ Google Sheets', 
          detail: (orderResultRaw as any).error || 'Vui lòng kiểm tra lại kết nối mạng hoặc cấu hình API.',
          fileId: (orderResultRaw as any).fileId
        });
        setLoading(false);
        return;
      }

      const orderResult = orderResultRaw as { orders: Order[], fileId: string };
      const storeData = results[1].status === 'fulfilled' ? results[1].value : [];
      const usersData = results[2].status === 'fulfilled' ? results[2].value : [];
      const skuMappings = results[3].status === 'fulfilled' ? results[3].value : [];
      const priceMappings = results[4].status === 'fulfilled' ? results[4].value : [];
      
      setStores(Array.isArray(storeData) ? storeData : []); 
      setUsers(Array.isArray(usersData) ? usersData : []); 
      setCurrentFileId(orderResult.fileId);
      
      const safeSkuMappings = Array.isArray(skuMappings) ? skuMappings : [];
      const mappingObj: Record<string, string> = {};
      safeSkuMappings.forEach(m => { if (m && m.sku) { mappingObj[normalizeKey(m.sku)] = String(m.category).trim(); } });
      setSkuMap(mappingObj);
    const rawOrders = orderResult.orders || [];
    const safePriceMappings = Array.isArray(priceMappings) ? priceMappings : [];
    const priceObj: Record<string, number> = {};
    safePriceMappings.forEach(p => { 
      if (p && p.category) { 
        const normalizedKey = normalizeKey(p.category); 
        // Robust price parsing for VND and other formats
        let priceVal = 0;
        if (typeof p.price === 'number') {
          priceVal = p.price;
        } else if (p.price) {
          const cleanStr = String(p.price).replace(/[^\d]/g, '');
          priceVal = parseInt(cleanStr, 10) || 0;
        }
        priceObj[normalizedKey] = priceVal; 
      } 
    });
    setPriceMap(priceObj);
    
    if (rawOrders.length > 0) {
      console.log(`Loaded ${rawOrders.length} raw orders. SKU Map size: ${Object.keys(mappingObj).length}. Price Map size: ${Object.keys(priceObj).length}`);
    }
      
      // Improved date filtering with fallback
      let ordersInMonth = rawOrders.filter(o => { 
        if (!o.date) return false; 
        const dateStr = String(o.date).trim();
        if (!dateStr) return false;

        const [targetY, targetM] = monthToFetch.split('-').map(Number);
        
        const isoMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (isoMatch) return parseInt(isoMatch[1]) === targetY && parseInt(isoMatch[2]) === targetM;
        
        const vnMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (vnMatch) return parseInt(vnMatch[3]) === targetY && parseInt(vnMatch[2]) === targetM;

        const tMStr = String(targetM).padStart(2, '0');
        const tYStr = String(targetY);
        const shortMStr = String(targetM);
        
        const patterns = [
          `${tYStr}-${tMStr}`, `${tYStr}-${shortMStr}`,
          `${tMStr}/${tYStr}`, `${shortMStr}/${tYStr}`,
          `${tYStr}/${tMStr}`, `${tYStr}/${shortMStr}`,
          `${tMStr}-${tYStr}`, `${shortMStr}-${tYStr}`
        ];

        return patterns.some(p => dateStr.includes(p));
      });

      // Fallback: If date filtering returns nothing but there are orders, 
      // check if the file might be using a different format or if it's just the wrong month
      if (rawOrders.length > 0 && ordersInMonth.length === 0) {
          ordersInMonth = rawOrders.filter(o => o.id && String(o.id).trim() !== '');
          console.warn(`Date filtering returned 0 orders for ${monthToFetch}. Falling back to all orders.`);
      }
      
      const currentUsername = (user.username || '').toLowerCase().trim();
      const userRole = (user.role || '').toLowerCase().trim();
      
      let filteredOrders = ordersInMonth;

      // Helper to check if an order belongs to Designer Online
      const isDesignerOnlineOrder = (o: Order) => {
          const actionRoleRaw = (o.actionRole || '').toLowerCase().trim();
          if (actionRoleRaw === 'designer online') return true;
          const assignedUser = (usersData as any).find((u: User) => (u.username || '').toLowerCase() === actionRoleRaw); 
          return assignedUser && (assignedUser.role || '').toLowerCase() === 'designer online';
      };

      if (userRole !== 'admin' && userRole !== 'ceo' && userRole !== 'leader') {
          const scope = user.permissions?.designerOnline;
          if (scope === 'none') {
              filteredOrders = [];
          } else if (scope === 'own') {
              filteredOrders = ordersInMonth.filter(o => (o.actionRole || '').toLowerCase().trim() === currentUsername);
          } else {
              filteredOrders = ordersInMonth.filter(isDesignerOnlineOrder);
          }
      } else {
          // For Admin/Leader/CEO: Default to showing Designer Online orders, 
          // but if none found, show everything so they can see if data is missing
          const designerOrders = ordersInMonth.filter(isDesignerOnlineOrder);
          filteredOrders = designerOrders.length > 0 ? designerOrders : ordersInMonth;
      }
      setOrders(filteredOrders);
    } catch (e) { if (selectedMonthRef.current === monthToFetch) console.error("Load Data Error:", e); } finally { if (selectedMonthRef.current === monthToFetch) setLoading(false); }
  };

  const fetchLatestPrices = async () => { setIsLoadingPrices(true); setBackendConfigError(false); try { const res = await sheetService.getPriceMappings(); if (Array.isArray(res)) { const newMap: Record<string, number> = {}; res.forEach(p => { if(p.category) newMap[normalizeKey(p.category)] = Number(p.price) || 0; }); setPriceMap(newMap); } else { setBackendConfigError(true); } } catch(e) { console.error(e); } finally { setIsLoadingPrices(false); } };
  useEffect(() => { selectedMonthRef.current = selectedMonth; loadData(selectedMonth); }, [selectedMonth, user.username]);
  useEffect(() => { if (isPriceModalOpen) fetchLatestPrices(); }, [isPriceModalOpen]);
  useEffect(() => { if (isPriceModalOpen) { const initialMap: Record<string, number> = {}; PRICE_CATEGORIES.forEach(cat => { const key = normalizeKey(cat); initialMap[cat] = priceMap[key] || 0; }); setTempPriceMap(initialMap); } }, [priceMap, isPriceModalOpen]);
  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (filterPopupRef.current && !filterPopupRef.current.contains(event.target as Node)) { setActiveFilterColumn(null); setFilterSearchTerm(''); setFilterPopupPos(null); } }; document.addEventListener('mousedown', handleClickOutside); window.addEventListener('scroll', () => { if (activeFilterColumn) setActiveFilterColumn(null); }, true); return () => { document.removeEventListener('mousedown', handleClickOutside); window.removeEventListener('scroll', () => {}, true); }; }, [activeFilterColumn]);

  const getPriceForCategory = (categoryName: string) => { if (!categoryName) return 0; const key = normalizeKey(categoryName); return priceMap[key] || 0; };
  
  const getUniqueValues = (key: string): string[] => { 
    const values = new Set<string>(); 
    orders.forEach(order => { 
      let val = ''; 
      if (key === 'storeName') val = getStoreName(order.storeId); 
      else if (key === 'category') { 
        const skuNorm = normalizeKey(order.sku); 
        val = skuMap[skuNorm] || ''; 
        const matched = PRICE_CATEGORIES.find(c => normalizeKey(c) === normalizeKey(val)); 
        if (matched) val = matched; 
        if (!val) val = '(Chưa phân loại)'; 
      } 
      else if (key === 'isDesignDone') val = order.isDesignDone ? "Đã xong" : "Chưa xong"; 
      else {
        const v = order[key as keyof Order];
        val = v !== undefined && v !== null ? String(v) : '';
      }
      if (val) values.add(val); 
    }); 
    return Array.from(values).sort(); 
  };
  
  const handleFilterClick = (e: React.MouseEvent, columnKey: string) => { e.stopPropagation(); if (activeFilterColumn === columnKey) { setActiveFilterColumn(null); setFilterPopupPos(null); } else { const rect = e.currentTarget.getBoundingClientRect(); let top = rect.bottom + 5; let left = rect.left; const POPUP_WIDTH = 288; if (left + POPUP_WIDTH > window.innerWidth - 10) { left = rect.right - POPUP_WIDTH; } setFilterPopupPos({ top, left, alignRight: false }); setActiveFilterColumn(columnKey); setFilterSearchTerm(''); } };
  const handleFilterValueChange = (columnKey: string, value: string) => { setColumnFilters(prev => { const currentFilters = (prev[columnKey] || []) as string[]; const newFilters = currentFilters.includes(value) ? currentFilters.filter(v => v !== value) : [...currentFilters, value]; return { ...prev, [columnKey]: newFilters }; }); };
  const handleClearFilter = (columnKey: string) => setColumnFilters(prev => ({ ...prev, [columnKey]: [] }));
  const handleSelectAllFilter = (columnKey: string, values: string[]) => setColumnFilters(prev => ({ ...prev, [columnKey]: values }));

  const renderFilterPopup = () => { 
    if (!activeFilterColumn || !filterPopupPos) return null; 
    const col = activeFilterColumn; 
    const uniqueValues = getUniqueValues(col); 
    const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase())); 
    const currentSelected = columnFilters[col]; 
    const isChecked = (val: string) => !currentSelected || currentSelected.includes(val); 
    
    return ( 
      <div ref={filterPopupRef} className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-[100] flex flex-col w-72 animate-fade-in" style={{ top: filterPopupPos.top, left: filterPopupPos.left }}> 
        <div className="p-2 border-b border-gray-100 space-y-1"> 
          <button onClick={() => { setSortConfig({ key: col as keyof Order, direction: 'asc' }); setActiveFilterColumn(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowDownAZ size={16} /> Sắp xếp A - Z</button> 
          <button onClick={() => { setSortConfig({ key: col as keyof Order, direction: 'desc' }); setActiveFilterColumn(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowUpAZ size={16} /> Sắp xếp Z - A</button> 
        </div> 
        <div className="p-2 border-b border-gray-100 bg-gray-50">
          <div className="relative"><Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/><input type="text" placeholder="Tìm..." className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none" value={filterSearchTerm} onChange={(e) => setFilterSearchTerm(e.target.value)} autoFocus /></div>
        </div> 
        <div className="flex-1 overflow-y-auto max-h-60 p-2 space-y-1 custom-scrollbar"> 
          {displayValues.map((val, idx) => ( 
            <label key={idx} className="flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50 rounded cursor-pointer text-sm select-none"> 
              <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={isChecked(val)} onChange={() => handleFilterValueChange(col, val)} /> 
              <span className="truncate flex-1">{val || '(Trống)'}</span> 
            </label> 
          ))} 
        </div> 
        <div className="p-2 border-t border-gray-100 flex justify-between bg-gray-50 rounded-b-lg"> 
          <button onClick={() => handleSelectAllFilter(col, uniqueValues)} className="text-xs text-blue-600 font-bold px-2 py-1 hover:bg-blue-50 rounded">Chọn tất cả</button> 
          <button onClick={() => handleClearFilter(col)} className="text-xs text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded">Bỏ chọn</button> 
        </div> 
      </div> 
    ); 
  };

  const stats = useMemo<{ 
      totalOrders: number; 
      totalMoney: number; 
      categories: Record<string, { total: number; checked: number; money: number }>; 
      designers: Record<string, { total: number; checked: number; totalMoney: number; checkedMoney: number }>; 
  }>(() => { 
      const result = { 
          totalOrders: 0, 
          totalMoney: 0, 
          categories: { 
              'Loại 1': { total: 0, checked: 0, money: 0 }, 
              'Loại 2': { total: 0, checked: 0, money: 0 }, 
              'Loại 3': { total: 0, checked: 0, money: 0 }, 
              'Loại 4': { total: 0, checked: 0, money: 0 }, 
              'Khác': { total: 0, checked: 0, money: 0 } 
          } as Record<string, { total: number; checked: number; money: number }>, 
          designers: {} as Record<string, { total: number; checked: number; totalMoney: number; checkedMoney: number }> 
      }; 
      
      orders.forEach(o => { 
          const skuNorm = normalizeKey(o.sku); 
          let rawCategory = skuMap[skuNorm] || 'Khác'; 
          let category = rawCategory.trim(); 
          const matchedCategory = PRICE_CATEGORIES.find(c => normalizeKey(c) === normalizeKey(category)); 
          if (matchedCategory) category = matchedCategory; 
          else category = 'Khác'; 
          
          const price = getPriceForCategory(category); 
          const isChecked = o.isDesignDone === true; 
          const designerName = o.actionRole ? o.actionRole.trim() : 'Chưa Giao'; 
          
          let catKey = category; 
          if (!result.categories[catKey]) catKey = 'Khác'; 
          
          const target = result.categories[catKey]; 
          target.total += 1; 
          target.money += price; 
          if (isChecked) target.checked += 1; 
          
          if (!result.designers[designerName]) { 
              result.designers[designerName] = { total: 0, checked: 0, totalMoney: 0, checkedMoney: 0 }; 
          } 
          
          result.designers[designerName].total += 1; 
          result.designers[designerName].totalMoney += price; 
          
          if (isChecked) {
              result.designers[designerName].checked += 1;
              result.designers[designerName].checkedMoney += price;
          }
          
          result.totalOrders += 1; 
          result.totalMoney += price; 
      }); 
      
      return result; 
  }, [orders, skuMap, priceMap]);

  const formatDateDisplay = (dateStr: string) => { if (!dateStr) return ''; try { const parts = dateStr.split(/[-T :]/); if (parts.length >= 5) { const y = parts[0]; const m = parts[1]; const d = parts[2]; const hh = parts[3] || '00'; const mm = parts[4] || '00'; if (y.length === 4) return `${d}/${m}/${y} ${hh}:${mm}`; } return dateStr; } catch (e) { return dateStr; } };
  const handleMonthChange = (step: number) => { const [year, month] = selectedMonth.split('-').map(Number); const date = new Date(year, month - 1 + step, 1); const newYear = date.getFullYear(); const newMonth = String(date.getMonth() + 1).padStart(2, '0'); setSelectedMonth(`${newYear}-${newMonth}`); };
  const handleUpdateSku = async (e: React.FormEvent) => { e.preventDefault(); if (!skuFormData.sku.trim()) { setSkuMessage({ type: 'error', text: 'Vui lòng nhập SKU' }); return; } setIsSubmittingSku(true); setSkuMessage(null); try { const result = await sheetService.updateSkuCategory(skuFormData.sku.trim(), skuFormData.category); if (result.success) { setSkuMessage({ type: 'success', text: 'Cập nhật phân loại thành công!' }); setSkuFormData(prev => ({ ...prev, sku: '' })); await loadData(selectedMonth); setTimeout(() => { setIsSkuModalOpen(false); setSkuMessage(null); }, 1500); } else { setSkuMessage({ type: 'error', text: result.error || 'Lỗi cập nhật.' }); } } catch (err) { setSkuMessage({ type: 'error', text: 'Lỗi kết nối hệ thống.' }); } finally { setIsSubmittingSku(false); } };
  const handleSavePrices = async () => { setIsSavingPrices(true); try { const categories = Object.keys(tempPriceMap); for (const cat of categories) { await sheetService.updateCategoryPrice(cat, tempPriceMap[cat]); } setIsPriceModalOpen(false); fetchLatestPrices(); } catch (e) { alert('Lỗi khi lưu bảng giá.'); } finally { setIsSavingPrices(false); } };
  
  // Handle batch designer toggle updates
  const handleDesignerToggle = async (order: Order) => { if (!currentFileId) return; if (updatingIds.has(order.id)) return; const newValue = !order.isDesignDone; if (onProcessStart) onProcessStart(); setUpdatingIds(prev => new Set(prev).add(order.id)); try { await sheetService.updateDesignerStatus(currentFileId, order, "Designer Online", newValue); setOrders(prev => prev.map(o => (o.id === order.id && o.rowNumber === order.rowNumber) ? { ...o, isDesignDone: newValue } : o)); } catch (error) { setOrders(prev => prev.map(o => (o.id === order.id && o.rowNumber === order.rowNumber) ? { ...o, isDesignDone: !newValue } : o)); alert('Lỗi cập nhật trạng thái'); } finally { setUpdatingIds(prev => { const newSet = new Set(prev); newSet.delete(order.id); return newSet; }); if (onProcessEnd) onProcessEnd(); } };
  
  const handleUpdateLinkDs = async (order: Order) => {
    if (!currentFileId) return;
    const newValue = editingLinkDs[order.id] ?? order.linkDs ?? '';

    setUpdatingLinkDsIds(prev => new Set(prev).add(order.id));
    if (onProcessStart) onProcessStart();
    try {
      const result = await sheetService.updateOrder(currentFileId, order.id, 'linkDs', newValue, order.rowNumber);
      if (result.success) {
        setOrders(prev => prev.map(o => (o.id === order.id && o.rowNumber === order.rowNumber) ? { ...o, linkDs: newValue } : o));
        setEditingLinkDs(prev => {
          const newState = { ...prev };
          delete newState[order.id];
          return newState;
        });
      } else {
        alert('Lỗi cập nhật Link DS: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi cập nhật Link DS');
    } finally {
      setUpdatingLinkDsIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  const handleUpdateUrlArtworkFront = async (order: Order) => {
    if (!currentFileId) return;
    
    const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
    const canEditUrls = isAdmin || user.permissions?.canEditDesignerOnlineUrls === true;
    
    if (!canEditUrls) {
      alert(`Bạn không có quyền chỉnh sửa URL Artwork. (Quyền: ${user.permissions?.canEditDesignerOnlineUrls ? 'Đã bật' : 'Chưa bật'})`);
      return;
    }

    const newValue = editingUrlArtworkFront[order.id] ?? order.urlArtworkFront ?? '';

    setUpdatingUrlArtworkFrontIds(prev => new Set(prev).add(order.id));
    if (onProcessStart) onProcessStart();
    try {
      const result = await sheetService.updateDesignerOnlineFields(currentFileId, order.id, { urlArtworkFront: newValue }, order.rowNumber);
      if (result.success) {
        setOrders(prev => prev.map(o => (o.id === order.id && o.rowNumber === order.rowNumber) ? { ...o, urlArtworkFront: newValue } : o));
        setEditingUrlArtworkFront(prev => {
          const newState = { ...prev };
          delete newState[order.id];
          return newState;
        });
      } else {
        alert('Lỗi cập nhật URL_artwork_front: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi cập nhật URL_artwork_front');
    } finally {
      setUpdatingUrlArtworkFrontIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  const handleUpdateUrlMockup = async (order: Order) => {
    if (!currentFileId) return;

    const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
    const canEditUrls = isAdmin || user.permissions?.canEditDesignerOnlineUrls === true;
    
    if (!canEditUrls) {
      alert(`Bạn không có quyền chỉnh sửa URL Mockup. (Quyền: ${user.permissions?.canEditDesignerOnlineUrls ? 'Đã bật' : 'Chưa bật'})`);
      return;
    }

    const newValue = editingUrlMockup[order.id] ?? order.urlMockup ?? '';

    setUpdatingUrlMockupIds(prev => new Set(prev).add(order.id));
    if (onProcessStart) onProcessStart();
    try {
      const result = await sheetService.updateDesignerOnlineFields(currentFileId, order.id, { urlMockup: newValue }, order.rowNumber);
      if (result.success) {
        setOrders(prev => prev.map(o => (o.id === order.id && o.rowNumber === order.rowNumber) ? { ...o, urlMockup: newValue } : o));
        setEditingUrlMockup(prev => {
          const newState = { ...prev };
          delete newState[order.id];
          return newState;
        });
      } else {
        alert('Lỗi cập nhật URL_mockup: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi cập nhật URL_mockup');
    } finally {
      setUpdatingUrlMockupIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  const handleUpdateCheck = async (order: Order, newValue: string) => {
    if (!currentFileId) return;
    
    // Check permissions
    const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
    const allowedChecks = (user.permissions?.allowedDesignerOnlineChecks || '').split(',').map(s => s.trim()).filter(s => s !== '');
    
    // Check if user is trying to ADD or DELETE restricted items
    const currentValues = (order.check || '').split(',').map(s => s.trim()).filter(s => s !== '');
    const newValues = newValue.split(',').map(s => s.trim()).filter(s => s !== '');
    
    if (!isAdmin) {
        const isSettingDoneOder = newValue === 'Done Oder';
        
        // If setting to exactly Done Oder, we allow it for everyone (as requested: "Done Oder ai cũng được bấm")
        if (!isSettingDoneOder) {
            // Check if any NEWLY added value is not allowed
            const addedValues = newValues.filter(v => !currentValues.includes(v));
            const isAddingAllowed = addedValues.every(v => v === 'Done Oder' || allowedChecks.includes(v));
            
            // Check if any REMOVED value is restricted
            const removedValues = currentValues.filter(v => !newValues.includes(v));
            const isRemovingAllowed = removedValues.every(v => v === 'Done Oder' || allowedChecks.includes(v));

            if (!isAddingAllowed || !isRemovingAllowed) {
                alert('Bạn không có quyền thực hiện thay đổi này (Vui lòng kiểm tra quyền hạn của bạn đối với các mục trong cột Check).');
                return;
            }
        }
    }

    // If it's Done Oder, we clear other selections as requested
    const finalValue = newValue === 'Done Oder' ? 'Done Oder' : newValue;

    setUpdatingCheckIds(prev => new Set(prev).add(order.id));
    if (onProcessStart) onProcessStart();
    try {
      const result = await sheetService.updateDesignerOnlineFields(currentFileId, order.id, { check: finalValue }, order.rowNumber);
      if (result.success) {
        setOrders(prev => prev.map(o => (o.id === order.id && o.rowNumber === order.rowNumber) ? { ...o, check: finalValue } : o));
      } else {
        alert('Lỗi cập nhật Check: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi cập nhật Check');
    } finally {
      setUpdatingCheckIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  const handleUpdateDesignerNote = async (order: Order) => {
    if (!currentFileId) return;
    
    // Check permissions
    const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
    if (!isAdmin && !user.permissions?.canEditDesignerOnlineNote) {
        alert('Bạn không có quyền chỉnh sửa cột Note.');
        return;
    }

    const newValue = editingDesignerNote[order.id] ?? order.designerNote ?? '';
    
    setUpdatingDesignerNoteIds(prev => new Set(prev).add(order.id));
    if (onProcessStart) onProcessStart();
    try {
      const result = await sheetService.updateDesignerOnlineFields(currentFileId, order.id, { designerNote: newValue }, order.rowNumber);
      if (result.success) {
        setOrders(prev => prev.map(o => (o.id === order.id && o.rowNumber === order.rowNumber) ? { ...o, designerNote: newValue } : o));
        setEditingDesignerNote(prev => {
          const newState = { ...prev };
          delete newState[order.id];
          return newState;
        });
      } else {
        alert('Lỗi cập nhật Note: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi kết nối khi cập nhật Note');
    } finally {
      setUpdatingDesignerNoteIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
      if (onProcessEnd) onProcessEnd();
    }
  };

  const formatPrice = (price: number) => { if (!price) return '-'; return price.toLocaleString('vi-VN') + ' đ'; };
  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');
  
  const canManageSku = user.role === 'admin' || user.permissions?.canManageSku === true;
  const canManagePrice = user.role === 'admin' || user.permissions?.canManageSku === true; 
  const canCheckDesign = user.role === 'admin' || user.role === 'leader' || user.role === 'support' || (user.permissions?.designerOnline !== 'none');

  const filteredOrders = orders.filter(o => { 
    const matchesSearch = ((o.id ? String(o.id).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.sku ? String(o.sku).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.storeId ? getStoreName(o.storeId).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.handler ? String(o.handler).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.actionRole ? String(o.actionRole).toLowerCase() : '').includes(searchTerm.toLowerCase())); 
    if (!matchesSearch) return false; 
    
    for (const [key, val] of Object.entries(columnFilters) as [string, string[]][]) { 
        const selectedValues = val;
        if (!selectedValues || selectedValues.length === 0) continue; 
        let cellValue = ''; 
        if (key === 'storeName') cellValue = getStoreName(o.storeId); 
        else if (key === 'category') { 
            const skuNorm = normalizeKey(o.sku); 
            cellValue = skuMap[skuNorm] || ''; 
            const matched = PRICE_CATEGORIES.find(c => normalizeKey(c) === normalizeKey(cellValue)); 
            if (matched) cellValue = matched; 
            if (!cellValue) cellValue = '(Chưa phân loại)'; 
        } 
        else if (key === 'isDesignDone') cellValue = o.isDesignDone ? "Đã xong" : "Chưa xong"; 
        else cellValue = String(o[key as keyof Order] || ''); 
        if (!selectedValues.includes(cellValue)) return false; 
    } 
    return true; 
  });
  const sortedOrdersResult = filteredOrders.map((item, index) => ({ item, index })).sort((a, b) => { if (sortConfig.key === 'date') { const dateA = new Date(a.item.date || '').getTime(); const dateB = new Date(b.item.date || '').getTime(); const validA = !isNaN(dateA); const validB = !isNaN(dateB); if (!validA && !validB) return 0; if (!validA) return 1; if (!validB) return -1; if (dateA !== dateB) { return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA; } return a.index - b.index; } const valA = String((a.item as any)[sortConfig.key] || ''); const valB = String((b.item as any)[sortConfig.key] || ''); if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }).map(x => x.item);

  const handleSelectAll = () => { if (selectedOrderIds.size === sortedOrdersResult.length && sortedOrdersResult.length > 0) setSelectedOrderIds(new Set()); else setSelectedOrderIds(new Set(sortedOrdersResult.map(o => o.id))); };
  const handleSelectRow = (id: string) => { const newSelected = new Set(selectedOrderIds); if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id); setSelectedOrderIds(newSelected); };
  
  const handleBatchAction = async (actionType: 'design_done' | 'design_pending') => {
      if (!currentFileId) return;
      if (selectedOrderIds.size === 0) return;
      const idsToUpdate = Array.from(selectedOrderIds) as string[];
      const newValue = actionType === 'design_done';
      setIsBatchProcessing(true);
      if (onProcessStart) onProcessStart();
      try {
          const result = await sheetService.batchUpdateDesigner(currentFileId, idsToUpdate, newValue);
          if (result.success) {
              setOrders(prev => prev.map(o => idsToUpdate.includes(o.id) ? { ...o, isDesignDone: newValue } : o));
              alert(`Đã cập nhật ${idsToUpdate.length} đơn hàng.`);
              setSelectedOrderIds(new Set());
          } else throw new Error(result.error);
      } catch (error) { alert('Có lỗi xảy ra khi cập nhật hàng loạt.'); } 
      finally { setIsBatchProcessing(false); if (onProcessEnd) onProcessEnd(); }
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen relative pb-20">
      <div className="bg-white shadow-sm overflow-hidden rounded-lg flex flex-col h-full">
        {dataError && (
          <div className="m-4 p-5 bg-rose-50 border-2 border-rose-200 rounded-3xl animate-fade-in">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200">
                   <AlertTriangle size={32} />
                </div>
                <div>
                   <h3 className="text-xl font-black text-rose-900 uppercase tracking-tight">{dataError.message}</h3>
                   <p className="text-xs font-bold text-rose-600 mt-1">{dataError.detail}</p>
                </div>
             </div>
             {dataError.fileId && (
               <a 
                 href={`https://docs.google.com/spreadsheets/d/${dataError.fileId}/edit`} 
                 target="_blank" rel="noreferrer"
                 className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 underline transition-colors"
               >
                 <FileSpreadsheet size={14}/> Bấm vào đây để kiểm tra trực tiếp file dữ liệu nguồn
               </a>
             )}
          </div>
        )}

        <div className="bg-white border-b border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2"><DollarSign size={16} className="text-green-600"/> Tổng Hợp Tháng {currentMonthStr}/{currentYearStr}</h3>
            <div className="flex flex-col xl:flex-row gap-6">
                <div className="flex-1"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-3"><div className="bg-indigo-600 text-white rounded p-3 shadow-sm flex flex-col justify-center items-center text-center"><span className="text-xs opacity-80 uppercase tracking-wide">Tổng Đơn</span><span className="text-xl font-bold">{stats.totalOrders}</span></div><div className="bg-emerald-600 text-white rounded p-3 shadow-sm flex flex-col justify-center items-center text-center"><span className="text-xs opacity-80 uppercase tracking-wide">Tổng Tiền</span><span className="text-lg font-bold">{formatPrice(stats.totalMoney)}</span></div>{PRICE_CATEGORIES.map(cat => { const data = (stats.categories[cat] as { total: number; checked: number; money: number } | undefined) || { total: 0, checked: 0, money: 0 }; return (<div key={cat} className="bg-gray-50 border border-gray-200 rounded p-3 shadow-sm flex flex-col justify-between"><div className="flex justify-between items-start border-b border-gray-200 pb-1 mb-1"><span className="text-xs font-bold text-gray-700 uppercase">{cat}</span><span className="text-xs font-medium text-green-600">{formatPrice(data.money)}</span></div><div className="flex justify-between items-end"><div className="text-center"><div className="text-[10px] text-gray-400 uppercase">Đơn</div><div className="text-sm font-bold text-gray-800">{data.total}</div></div><div className="text-center"><div className="text-[10px] text-gray-400 uppercase">Check</div><div className="text-sm font-bold text-blue-600">{data.checked}</div></div></div></div>); })}</div></div>
                <div className="flex-1 border-l border-gray-200 xl:pl-6 pt-4 xl:pt-0 border-t xl:border-t-0 mt-2 xl:mt-0">
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-2 flex items-center gap-2"><Users size={14} /> Chi Tiết Theo Designer</h4>
                    <div className="overflow-x-auto custom-scrollbar max-h-[140px]">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-gray-50 text-gray-900 font-black sticky top-0">
                                <tr>
                                    <th className="px-2 py-2 border-b">Designer</th>
                                    <th className="px-2 py-2 border-b text-center">SL</th>
                                    <th className="px-2 py-2 border-b text-center">Check</th>
                                    <th className="px-2 py-2 border-b text-right">Tạm tính</th>
                                    <th className="px-2 py-2 border-b text-right">Đã Check</th>
                                    <th className="px-2 py-2 border-b text-right">Còn Lại</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(stats.designers).map(([name, data]: [string, { total: number; checked: number; totalMoney: number; checkedMoney: number }]) => {
                                    const isItemAdmin = (name || '').toLowerCase().includes('admin');
                                    return (
                                        <tr key={name} className="hover:bg-gray-50">
                                            <td className={`px-2 py-2 font-black truncate max-w-[100px] ${isItemAdmin ? 'admin-red-gradient' : 'text-slate-900'}`} title={name}>{name}</td>
                                            <td className="px-2 py-2 text-center text-gray-600">{data.total}</td>
                                            <td className="px-2 py-2 text-center font-bold text-blue-600">{data.checked}</td>
                                            <td className="px-2 py-2 text-right font-medium text-gray-700">{data.totalMoney.toLocaleString('vi-VN')}</td>
                                            <td className="px-2 py-2 text-right font-medium text-green-600">{data.checkedMoney.toLocaleString('vi-VN')}</td>
                                            <td className={`px-2 py-2 text-right font-medium text-orange-600`}>{ (data.totalMoney - data.checkedMoney).toLocaleString('vi-VN')}</td>
                                        </tr>
                                    )
                                })}
                                {Object.keys(stats.designers).length === 0 && (
                                    <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400 italic">Chưa có dữ liệu designer.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white z-20">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap flex items-center gap-2">DESIGNER ONLINE <span className="text-orange-600 uppercase text-sm border border-orange-200 bg-orange-50 px-2 py-0.5 rounded">Tháng {currentMonthStr}/{currentYearStr}</span><button onClick={() => loadData(selectedMonth)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Làm mới"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
            <button 
              onClick={() => window.location.reload()} 
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all border border-gray-200"
              title="Làm mới phiên làm việc để cập nhật quyền hạn mới nhất"
            >
              <Shield size={14} className="text-indigo-600" />
              <span>Đồng bộ quyền</span>
            </button>
            </h2>
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm p-1">
                    <button 
                        onClick={() => handleMonthChange(-1)} 
                        disabled={updatingLinkDsIds.size > 0 || updatingCheckIds.size > 0}
                        className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center px-2 border-l border-r border-gray-100 gap-1 min-w-[160px] justify-center">
                        <Calendar size={14} className="text-orange-500 mr-1" />
                        <select 
                            value={currentMonthStr} 
                            disabled={updatingLinkDsIds.size > 0 || updatingCheckIds.size > 0}
                            onChange={(e) => setSelectedMonth(`${currentYearStr}-${e.target.value}`)} 
                            className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-center text-sm disabled:opacity-50"
                        >
                            {monthsList.map(m => (<option key={m} value={m}>Tháng {parseInt(m)}</option>))}
                        </select>
                        <span className="text-gray-400">/</span>
                        <select 
                            value={currentYearStr} 
                            disabled={updatingLinkDsIds.size > 0 || updatingCheckIds.size > 0}
                            onChange={(e) => setSelectedMonth(`${e.target.value}-${currentMonthStr}`)} 
                            className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-sm disabled:opacity-50"
                        >
                            {yearsList.map(y => (<option key={y} value={y}>{y}</option>))}
                        </select>
                    </div>
                    <button 
                        onClick={() => handleMonthChange(1)} 
                        disabled={updatingLinkDsIds.size > 0 || updatingCheckIds.size > 0}
                        className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
                {canManageSku && (<button onClick={() => setIsSkuModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm h-[42px] whitespace-nowrap ml-2"><Settings size={16} /> <span className="hidden sm:inline">Phân loại</span></button>)}
                {canManagePrice && (<button onClick={() => setIsPriceModalOpen(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm h-[42px] whitespace-nowrap ml-2"><DollarSign size={16} /> <span className="hidden sm:inline">Cấu hình Giá</span></button>)}
                <button onClick={() => setShowColumnSelector(!showColumnSelector)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 bg-white shadow-sm h-[42px] ml-2"><Settings size={16} /></button>
            </div>
          </div>
          <div className="relative flex-1 sm:flex-none sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="Tìm ID, SKU..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-[#1a4019] focus:border-transparent outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-250px)] custom-scrollbar">
          {showColumnSelector && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setShowColumnSelector(false)}></div>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden relative animate-slide-in">
                      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                          <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Hiển thị cột</h3>
                          <button onClick={() => setShowColumnSelector(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                      </div>
                      <div className="p-4 grid grid-cols-1 gap-2">
                          {Object.keys(visibleColumns).map(col => (
                              <label key={col} className="flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                                  <input 
                                      type="checkbox" 
                                      checked={visibleColumns[col]} 
                                      onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs font-bold text-gray-700 capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</span>
                              </label>
                          ))}
                      </div>
                      <div className="p-3 bg-gray-50 border-t border-gray-100">
                          <button onClick={() => setShowColumnSelector(false)} className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Xong</button>
                      </div>
                  </div>
              </div>
          )}
          <table className="w-full text-left border-collapse text-xs relative">
            <thead className="text-white font-bold text-center uppercase text-xs tracking-wider sticky top-0 z-20">
              <tr>
                {visibleColumns['id'] && <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-fit"><div className="flex items-center justify-between gap-1"><span>ID Oder</span><button onClick={(e) => handleFilterClick(e, 'id')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['id']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>}
                {visibleColumns['store'] && <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>STORE</span><button onClick={(e) => handleFilterClick(e, 'storeName')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['storeName']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>}
                {visibleColumns['sku'] && <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>SKU</span><button onClick={(e) => handleFilterClick(e, 'sku')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['sku']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>}
                {visibleColumns['pl'] && <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-fit text-yellow-300"><div className="flex items-center justify-between gap-1"><span>PL</span><button onClick={(e) => handleFilterClick(e, 'category')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['category']?.length ? 'text-white' : 'text-yellow-600'}`}><Filter size={14} /></button></div></th>}
                <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-fit text-green-300">Giá Tiền</th>
                {visibleColumns['linkDs'] && <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-fit text-blue-300">Link DS</th>}
                {visibleColumns['check'] && <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-24 text-blue-300"><div className="flex items-center justify-between gap-1"><span>Check</span><button onClick={(e) => handleFilterClick(e, 'check')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['check']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>}
                {visibleColumns['note'] && <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-80 text-blue-300"><div className="flex items-center justify-between gap-1"><span>Note</span><button onClick={(e) => handleFilterClick(e, 'designerNote')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['designerNote']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>}
                <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-12 text-blue-300" title="Product URL">PU</th>
                {visibleColumns['optionsText'] && <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-[400px] text-blue-300">options_text</th>}
                <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-32 text-blue-300">URL_artwork_front</th>
                <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-32 text-blue-300">URL_mockup</th>
                {visibleColumns['nxl'] && <th className="px-2 py-2 border-r border-gray-600 w-12 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>NXL</span><button onClick={(e) => handleFilterClick(e, 'handler')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['handler']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>}
                {visibleColumns['ar'] && <th className="px-2 py-2 border-l border-gray-600 w-12 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>AR</span><button onClick={(e) => handleFilterClick(e, 'actionRole')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['actionRole']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={12} className="text-center py-12 text-gray-500">Đang tải dữ liệu Tháng {currentMonthStr}...</td></tr>
              ) : sortedOrdersResult.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-gray-500">
                    {'Không có đơn hàng nào khớp với bộ lọc.'}
                  </td>
                </tr>
              ) : sortedOrdersResult.map((order, idx) => {
                  const normalizedSku = normalizeKey(order.sku);
                  const category = skuMap[normalizedSku] || '';
                  const price = getPriceForCategory(category);
                  const isUpdating = updatingIds.has(order.id);
                  const isUpdatingLinkDs = updatingLinkDsIds.has(order.id);
                  const isHandlerAdmin = (order.handler || '').toLowerCase().includes('admin');
                  const isActionAdmin = (order.actionRole || '').toLowerCase().includes('admin');

                  return (
                      <tr key={order.id + idx} className={`hover:bg-gray-50 border-b border-gray-200 text-gray-800 transition-colors ${selectedOrderIds.has(order.id) ? 'bg-indigo-50' : ''}`}>
                          {visibleColumns['id'] && <td className="px-2 py-2 border-r font-semibold text-gray-900 whitespace-nowrap"><div className="flex justify-between items-center group gap-1"><span>{order.id}</span><button className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(order.id)} title="Copy ID"><Copy size={10} /></button></div></td>}
                          {visibleColumns['store'] && <td className="px-2 py-2 border-r text-gray-700">{getStoreName(order.storeId)}</td>}
                          {visibleColumns['sku'] && <td className="px-2 py-2 border-r font-mono text-[10px] text-gray-600">{order.sku}</td>}
                          {visibleColumns['pl'] && <td className="px-2 py-2 border-r text-center font-medium text-indigo-600 bg-indigo-50/50">{category}</td>}
                          <td className="px-2 py-2 border-r text-center font-bold text-green-700 bg-green-50/50">{formatPrice(price)}</td>
                          {visibleColumns['linkDs'] && (
                              <td className="px-2 py-2 border-r bg-blue-50/10 w-fit whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                      {order.linkDs && editingLinkDs[order.id] === undefined ? (
                                          <div className="flex items-center gap-1">
                                              <a href={order.linkDs} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] truncate max-w-[100px]" title={order.linkDs}>Link DS</a>
                                              <button onClick={() => setEditingLinkDs(prev => ({ ...prev, [order.id]: order.linkDs || '' }))} className="text-gray-400 hover:text-blue-500"><Edit size={10}/></button>
                                          </div>
                                      ) : (
                                          <>
                                              <input 
                                                  type="text" 
                                                  className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-500"
                                                  value={editingLinkDs[order.id] !== undefined ? editingLinkDs[order.id] : (order.linkDs || '')}
                                                  onChange={(e) => setEditingLinkDs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                  placeholder="Dán link..."
                                              />
                                              <button 
                                                  onClick={() => handleUpdateLinkDs(order)}
                                                  disabled={isUpdatingLinkDs}
                                                  className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                                                  title="Cập nhật Link DS"
                                              >
                                                  {isUpdatingLinkDs ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                              </button>
                                          </>
                                      )}
                                  </div>
                              </td>
                          )}
                          {visibleColumns['check'] && (
                              <td className="px-2 py-2 border-r text-center text-[10px] text-gray-600 relative min-w-[140px]">
                                  <div className="flex flex-col items-center gap-2">
                                      <div className="flex flex-wrap gap-1 justify-center">
                                          {(order.check || '').split(',').map(s => s.trim()).filter(s => s !== '').map(val => (
                                              <div key={val} className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[9px] font-black border shadow-sm animate-fade-in group ${val === 'Done Oder' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                                  {val}
                                                  {val !== 'Done Oder' && (
                                                      <button 
                                                          onClick={() => {
                                                              const currentValues = (order.check || '').split(',').map(s => s.trim()).filter(s => s !== '');
                                                              const newValues = currentValues.filter(v => v !== val);
                                                              handleUpdateCheck(order, newValues.join(', '));
                                                          }}
                                                          className="text-gray-300 hover:text-red-500 transition-colors"
                                                          title="Xóa"
                                                      >
                                                          <X size={10} strokeWidth={3} />
                                                      </button>
                                                  )}
                                              </div>
                                          ))}
                                          <button 
                                              onClick={() => {
                                                  const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
                                                  const hasCheckPermission = isAdmin || (user.permissions?.allowedDesignerOnlineChecks || '').trim() !== '';
                                                  
                                                  if (!hasCheckPermission) {
                                                      alert('Bạn không có quyền chỉnh sửa nội dung cột Check.');
                                                      return;
                                                  }
    
                                                  if (updatingCheckIds.has(order.id)) return;
                                                  if (activeCheckDropdown === order.id) {
                                                      // Close and save
                                                      const finalValue = tempCheckSelections[order.id] ?? order.check ?? '';
                                                      if (finalValue !== (order.check || '')) {
                                                          handleUpdateCheck(order, finalValue);
                                                      }
                                                      setActiveCheckDropdown(null);
                                                  } else {
                                                      // Open
                                                      setTempCheckSelections(prev => ({ ...prev, [order.id]: order.check || '' }));
                                                      setActiveCheckDropdown(order.id);
                                                  }
                                              }}
                                              className={`w-6 h-6 rounded-full border border-dashed flex items-center justify-center transition-all ${activeCheckDropdown === order.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-gray-400 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50'} ${updatingCheckIds.has(order.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                              title="Chỉnh sửa Check"
                                              disabled={updatingCheckIds.has(order.id)}
                                          >
                                              {activeCheckDropdown === order.id ? <Save size={12} /> : <Settings size={12} />}
                                          </button>
                                      </div>
    
                                      {/* Done Oder Button */}
                                      {order.check !== 'Done Oder' && (
                                          <button 
                                              onClick={() => handleUpdateCheck(order, 'Done Oder')}
                                              disabled={updatingCheckIds.has(order.id)}
                                              className="px-2 py-0.5 bg-orange-500 text-white rounded text-[9px] font-black hover:bg-orange-600 disabled:bg-orange-300 transition-colors flex items-center justify-center gap-1 min-w-[70px] shadow-sm active:scale-95"
                                              title="Xác nhận Done Oder"
                                          >
                                              {updatingCheckIds.has(order.id) ? <Loader2 size={10} className="animate-spin" /> : null}
                                              Done Oder
                                          </button>
                                      )}
    
                                      {activeCheckDropdown === order.id && (
                                          <div 
                                              ref={checkDropdownRef}
                                              className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 shadow-2xl rounded-xl z-[110] w-48 p-2 animate-fade-in ring-4 ring-black/5"
                                          >
                                              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 px-2 flex justify-between items-center">
                                                  <span>Chọn nội dung</span>
                                                  <span className="text-indigo-600 bg-indigo-50 px-1 rounded">Temp</span>
                                              </div>
                                              
                                              {/* Selected items in temp state (Jumped up) */}
                                              <div className="flex flex-wrap gap-1 mb-3 px-1 border-b border-gray-100 pb-2">
                                                  {(tempCheckSelections[order.id] || '').split(',').map(s => s.trim()).filter(s => s !== '').map(val => (
                                                      <div key={val} className="bg-indigo-600 text-white px-1.5 py-0.5 rounded flex items-center gap-1 text-[8px] font-bold">
                                                          {val}
                                                          <button 
                                                              onClick={() => {
                                                                  const current = (tempCheckSelections[order.id] || '').split(',').map(s => s.trim()).filter(s => s !== '');
                                                                  const next = current.filter(v => v !== val);
                                                                  setTempCheckSelections(prev => ({ ...prev, [order.id]: next.join(', ') }));
                                                              }}
                                                          >
                                                              <X size={8} />
                                                          </button>
                                                      </div>
                                                  ))}
                                                  {!(tempCheckSelections[order.id]) && <span className="text-[8px] text-gray-300 italic">Chưa chọn...</span>}
                                              </div>
    
                                              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                                                  {['Fix', 'Đã check File', 'Done FF', 'Chờ CF', 'New', 'Gift Card', 'Demo', 'Done Oder'].map(opt => {
                                                      const currentValues = (tempCheckSelections[order.id] || '').split(',').map(s => s.trim()).filter(s => s !== '');
                                                      const isSelected = currentValues.includes(opt);
                                                      
                                                      return (
                                                          <button 
                                                              key={opt} 
                                                              onClick={() => {
                                                                  let nextValues = [...currentValues];
                                                                  if (isSelected) {
                                                                      nextValues = nextValues.filter(v => v !== opt);
                                                                  } else {
                                                                      nextValues.push(opt);
                                                                  }
                                                                  setTempCheckSelections(prev => ({ ...prev, [order.id]: nextValues.join(', ') }));
                                                              }}
                                                              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-[10px] font-bold text-left group ${isSelected ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50 text-gray-700'}`}
                                                          >
                                                              <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isSelected ? 'bg-indigo-600' : 'bg-gray-300 group-hover:bg-indigo-400'}`} />
                                                              {opt}
                                                          </button>
                                                      );
                                                  })}
                                              </div>
                                              <button 
                                                  onClick={() => {
                                                      const finalValue = tempCheckSelections[order.id] ?? order.check ?? '';
                                                      if (finalValue !== (order.check || '')) {
                                                          handleUpdateCheck(order, finalValue);
                                                      }
                                                      setActiveCheckDropdown(null);
                                                  }}
                                                  className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                                              >
                                                  Cập nhật & Đóng
                                              </button>
                                          </div>
                                      )}
    
                                      {updatingCheckIds.has(order.id) && (
                                          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
                                              <Loader2 size={14} className="animate-spin text-indigo-600" />
                                          </div>
                                      )}
                                  </div>
                              </td>
                          )}
                          {visibleColumns['note'] && (
                              <td className="px-2 py-2 border-r text-left text-[10px] text-gray-600 w-80 min-w-[200px] max-w-[400px]">
                                  <div className="flex items-start gap-1">
                                      {editingNoteIds.has(order.id) ? (
                                          <>
                                              <textarea
                                                  className="w-full p-1 border border-gray-200 rounded text-[10px] outline-none focus:ring-1 focus:ring-indigo-500 min-h-[60px] resize-y"
                                                  value={editingDesignerNote[order.id] ?? order.designerNote ?? ''}
                                                  onChange={(e) => setEditingDesignerNote(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                  placeholder="Ghi chú..."
                                                  autoFocus
                                              />
                                              <button 
                                                  onClick={async () => {
                                                      await handleUpdateDesignerNote(order);
                                                      setEditingNoteIds(prev => {
                                                          const next = new Set(prev);
                                                          next.delete(order.id);
                                                          return next;
                                                      });
                                                  }}
                                                  disabled={updatingDesignerNoteIds.has(order.id)}
                                                  className="p-1 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:bg-teal-300 transition-colors mt-1"
                                                  title="Lưu Note"
                                              >
                                                  {updatingDesignerNoteIds.has(order.id) ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                              </button>
                                          </>
                                      ) : (
                                          <>
                                              <div className="flex-1 min-w-0 whitespace-pre-wrap break-words overflow-hidden">{order.designerNote || '-'}</div>
                                              <button 
                                                  onClick={() => {
                                                      setEditingDesignerNote(prev => ({ ...prev, [order.id]: order.designerNote || '' }));
                                                      setEditingNoteIds(prev => new Set(prev).add(order.id));
                                                  }}
                                                  className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                                  title="Sửa Note"
                                              >
                                                  <Edit size={12} />
                                              </button>
                                          </>
                                      )}
                                  </div>
                              </td>
                          )}
                          <td className="px-2 py-2 border-r text-center text-[10px] text-blue-600 truncate max-w-[100px]">
                              {order.productUrl ? (
                                  <a href={order.productUrl} target="_blank" rel="noreferrer" className="hover:underline" title={order.productUrl}>PU</a>
                              ) : '-'}
                          </td>
                          {visibleColumns['optionsText'] && <td className="px-2 py-2 border-r text-left text-[10px] text-gray-600 break-words min-w-[300px] max-w-[500px] whitespace-pre-wrap" title={order.optionsText}>{order.optionsText}</td>}
                          <td className="px-2 py-2 border-r bg-blue-50/10 w-32 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                  {order.urlArtworkFront && editingUrlArtworkFront[order.id] === undefined ? (
                                      <div className="flex items-center gap-1">
                                          <a href={order.urlArtworkFront} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] truncate max-w-[100px]" title={order.urlArtworkFront}>URL_artwork_front</a>
                                          <button onClick={() => {
                                              const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
                                              const canEditUrls = isAdmin || user.permissions?.canEditDesignerOnlineUrls === true;
                                              if (!canEditUrls) {
                                                  alert(`Bạn không có quyền chỉnh sửa URL Artwork. (Quyền: ${user.permissions?.canEditDesignerOnlineUrls ? 'Đã bật' : 'Chưa bật'})`);
                                                  return;
                                              }
                                              setEditingUrlArtworkFront(prev => ({ ...prev, [order.id]: order.urlArtworkFront || '' }));
                                          }} className="text-gray-400 hover:text-blue-500"><Edit size={10}/></button>
                                      </div>
                                  ) : (
                                      <>
                                          <input 
                                              type="text" 
                                              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-500"
                                              value={editingUrlArtworkFront[order.id] !== undefined ? editingUrlArtworkFront[order.id] : (order.urlArtworkFront || '')}
                                              onChange={(e) => setEditingUrlArtworkFront(prev => ({ ...prev, [order.id]: e.target.value }))}
                                              placeholder="Dán link..."
                                          />
                                          <button 
                                              onClick={() => handleUpdateUrlArtworkFront(order)}
                                              disabled={updatingUrlArtworkFrontIds.has(order.id)}
                                              className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                                              title="Cập nhật URL_artwork_front"
                                          >
                                              {updatingUrlArtworkFrontIds.has(order.id) ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                          </button>
                                      </>
                                  )}
                              </div>
                          </td>
                          <td className="px-2 py-2 border-r bg-blue-50/10 w-32 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                  {order.urlMockup && editingUrlMockup[order.id] === undefined ? (
                                      <div className="flex items-center gap-1">
                                          <a href={order.urlMockup} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] truncate max-w-[100px]" title={order.urlMockup}>URL_mockup</a>
                                          <button onClick={() => {
                                              const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'ceo' || user.role?.toLowerCase() === 'leader';
                                              const canEditUrls = isAdmin || user.permissions?.canEditDesignerOnlineUrls === true;
                                              if (!canEditUrls) {
                                                  alert(`Bạn không có quyền chỉnh sửa URL Mockup. (Quyền: ${user.permissions?.canEditDesignerOnlineUrls ? 'Đã bật' : 'Chưa bật'})`);
                                                  return;
                                              }
                                              setEditingUrlMockup(prev => ({ ...prev, [order.id]: order.urlMockup || '' }));
                                          }} className="text-gray-400 hover:text-blue-500"><Edit size={10}/></button>
                                      </div>
                                  ) : (
                                      <>
                                          <input 
                                              type="text" 
                                              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-500"
                                              value={editingUrlMockup[order.id] !== undefined ? editingUrlMockup[order.id] : (order.urlMockup || '')}
                                              onChange={(e) => setEditingUrlMockup(prev => ({ ...prev, [order.id]: e.target.value }))}
                                              placeholder="Dán link..."
                                          />
                                          <button 
                                              onClick={() => handleUpdateUrlMockup(order)}
                                              disabled={updatingUrlMockupIds.has(order.id)}
                                              className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                                              title="Cập nhật URL_mockup"
                                          >
                                              {updatingUrlMockupIds.has(order.id) ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                          </button>
                                      </>
                                  )}
                              </div>
                          </td>
                          {visibleColumns['nxl'] && (
                              <td className="px-2 py-2 border-r text-center text-[10px] font-medium whitespace-nowrap bg-gray-50/50 w-12">
                                  <div className="flex items-center justify-center" title={order.handler}>
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${isHandlerAdmin ? 'bg-red-500' : 'bg-indigo-500'}`}>
                                          {order.handler ? order.handler.charAt(0).toUpperCase() : '?'}
                                      </div>
                                  </div>
                              </td>
                          )}
                          {visibleColumns['ar'] && (
                              <td className={`px-2 py-2 border-l text-center bg-gray-50/30 font-bold w-12 ${isActionAdmin ? 'admin-red-gradient' : 'text-orange-600'}`} title={order.actionRole}>
                                  <div className="flex items-center justify-center">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold ${isActionAdmin ? 'bg-red-600' : 'bg-orange-500'}`}>
                                          {order.actionRole ? order.actionRole.charAt(0).toUpperCase() : '?'}
                                      </div>
                                  </div>
                              </td>
                          )}
                      </tr>
                  );
              })}
            </tbody>
          </table>
        </div>

        {selectedOrderIds.size > 0 && canCheckDesign && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-2xl border border-gray-200 px-6 py-3 flex items-center gap-4 z-50 animate-slide-in">
                <span className="text-sm font-bold text-gray-700 whitespace-nowrap bg-gray-100 px-3 py-1 rounded-full">{selectedOrderIds.size} đã chọn</span>
                <div className="h-6 w-px bg-gray-300"></div>
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
        {isSkuModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"><div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden"><div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Settings className="text-indigo-500" size={20} /> Cập Nhật Phân Loại</h3><button onClick={() => setIsSkuModalOpen(false)} disabled={isSubmittingSku} className="text-gray-400 hover:text-gray-600">✕</button></div><form onSubmit={handleUpdateSku} className="p-5 space-y-4">{skuMessage && (<div className={`p-3 rounded-md flex items-center gap-2 text-sm ${skuMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{skuMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}<span>{skuMessage.text}</span></div>)}<div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU Sản Phẩm</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-gray-800 bg-white" placeholder="Nhập mã SKU..." value={skuFormData.sku} onChange={(e) => setSkuFormData({...skuFormData, sku: e.target.value})} autoFocus /></div><div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chọn Phân Loại</label><select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer text-gray-800 bg-white" value={skuFormData.category} onChange={(e) => setSkuFormData({...skuFormData, category: e.target.value})}><option value="Loại 1">Loại 1</option><option value="Loại 2">Loại 2</option><option value="Loại 3">Loại 3</option><option value="Loại 4">Loại 4</option></select></div><div className="pt-2 flex gap-3"><button type="button" onClick={() => setIsSkuModalOpen(false)} disabled={isSubmittingSku} className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm transition-colors font-medium">Hủy</button><button type="submit" disabled={isSubmittingSku} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-bold transition-colors shadow-sm disabled:opacity-70">{isSubmittingSku ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Lưu</button></div></form></div></div>)}
        {isPriceModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"><div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"><div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><DollarSign className="text-green-600" size={20} /> Cấu Hình Giá Tiền</h3><button onClick={() => setIsPriceModalOpen(false)} disabled={isSavingPrices} className="text-gray-400 hover:text-gray-600">✕</button></div><div className="p-5"><div className="bg-blue-50 border border-blue-100 p-3 rounded text-xs text-blue-700 mb-4 flex gap-2"><Info size={16} className="flex-shrink-0"/><span>Giá tiền sẽ được áp dụng tự động cho các đơn hàng có SKU thuộc phân loại tương ứng.</span></div>{isLoadingPrices && (<div className="text-center py-2 text-gray-500 text-xs flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={14} /> Đang cập nhật dữ liệu mới nhất...</div>)}{!isLoadingPrices && !backendConfigError && Object.keys(priceMap).length === 0 && (<div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-700 mb-4 flex gap-2"><AlertTriangle size={16} className="flex-shrink-0"/><span>Chưa tải được bảng giá từ Sheet (Sheet có thể đang trống).</span></div>)}<div className="space-y-3 mb-6">{PRICE_CATEGORIES.map(cat => (<div key={cat} className="flex items-center gap-3"><div className="w-24 text-sm font-bold text-gray-700">{cat}</div><div className="flex-1 relative"><input type="number" className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-right pr-8 font-mono focus:ring-2 focus:ring-green-500 outline-none" value={tempPriceMap[cat] !== undefined ? tempPriceMap[cat] : 0} onChange={(e) => setTempPriceMap({...tempPriceMap, [cat]: Number(e.target.value)})} placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">đ</span></div></div>))}</div><div className="flex gap-3 pt-2 border-t border-gray-100"><button onClick={() => setIsPriceModalOpen(false)} disabled={isSavingPrices} className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium">Hủy bỏ</button><button onClick={handleSavePrices} disabled={isSavingPrices} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-bold shadow-sm flex items-center justify-center gap-2">{isSavingPrices ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Lưu Cấu Hình</button></div></div></div></div>)}
      </div>
    </div>
  );
};
