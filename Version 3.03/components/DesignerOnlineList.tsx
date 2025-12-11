import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Copy, ArrowUp, ArrowDown, Calendar, UserCircle, ChevronLeft, ChevronRight, Settings, Save, X, Loader2, CheckCircle, AlertCircle, Filter, ArrowDownAZ, ArrowUpAZ, AlertTriangle, Info, FileSpreadsheet, DollarSign, CheckSquare, Square, Users, Layers, Code, PenTool } from 'lucide-react';
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
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterSearchTerm, setFilterSearchTerm] = useState(''); 
  const [filterPopupPos, setFilterPopupPos] = useState<{ top: number, left: number, alignRight: boolean } | null>(null);
  const filterPopupRef = useRef<HTMLDivElement>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentLocalMonth());
  const selectedMonthRef = useRef<string>(selectedMonth);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // --- BATCH SELECTION STATE ---
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

  const currentYear = new Date().getFullYear();
  const monthsList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const yearsList = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));
  const PRICE_CATEGORIES = ['Loại 1', 'Loại 2', 'Loại 3', 'Loại 4'];

  const getStoreName = (id: string) => { const store = stores.find(s => String(s.id) === String(id) || s.name === id); return store ? store.name : id; };
  const normalizeKey = (key: string) => key ? key.toLowerCase().trim() : '';

  const loadData = async (monthToFetch: string) => {
    setLoading(true); setOrders([]); setDataError(null); setCurrentFileId(null); setSelectedOrderIds(new Set());
    try {
      const results = await Promise.allSettled([sheetService.getOrders(monthToFetch), sheetService.getStores(), sheetService.getUsers(), sheetService.getSkuMappings(), sheetService.getPriceMappings()]);
      if (selectedMonthRef.current !== monthToFetch) return;
      const orderResult = results[0].status === 'fulfilled' ? results[0].value : { orders: [], fileId: null };
      const storeData = results[1].status === 'fulfilled' ? results[1].value : [];
      const usersData = results[2].status === 'fulfilled' ? results[2].value : [];
      const skuMappings = results[3].status === 'fulfilled' ? results[3].value : [];
      const priceMappings = results[4].status === 'fulfilled' ? results[4].value : [];
      setStores(Array.isArray(storeData) ? storeData : []); setUsers(Array.isArray(usersData) ? usersData : []); setCurrentFileId(orderResult.fileId);
      const safeSkuMappings = Array.isArray(skuMappings) ? skuMappings : [];
      const mappingObj: Record<string, string> = {};
      safeSkuMappings.forEach(m => { if (m && m.sku) { mappingObj[normalizeKey(m.sku)] = String(m.category).trim(); } });
      setSkuMap(mappingObj);
      const safePriceMappings = Array.isArray(priceMappings) ? priceMappings : [];
      const priceObj: Record<string, number> = {};
      safePriceMappings.forEach(p => { if (p && p.category) { const normalizedKey = normalizeKey(String(p.category)); priceObj[normalizedKey] = Number(p.price) || 0; } });
      setPriceMap(priceObj);
      const rawOrders = orderResult.orders || [];
      const ordersInMonth = rawOrders.filter(o => { if (!o.date) return false; const dateStr = String(o.date).trim(); return dateStr.startsWith(monthToFetch); });
      if (rawOrders.length > 0 && ordersInMonth.length === 0) {
          const sampleDate = rawOrders[0].date;
          const actualMonth = sampleDate ? sampleDate.substring(0, 7) : 'Không xác định';
          setDataError({ message: `Lỗi Dữ Liệu: Bạn chọn tháng ${monthToFetch} nhưng hệ thống trả về dữ liệu tháng ${actualMonth}.`, detail: `Nguyên nhân: File ID trong sheet "FileIndex" sai.`, fileId: orderResult.fileId });
          setCurrentFileId(orderResult.fileId);
      }
      
      const currentUsername = (user.username || '').toLowerCase().trim();
      const userRole = (user.role || '').toLowerCase().trim();
      
      // Determine permissions
      let filteredOrders = ordersInMonth;
      if (userRole !== 'admin') {
          const scope = user.permissions?.designerOnline;
          
          if (!scope) {
              // LEGACY Fallback
              filteredOrders = ordersInMonth.filter(o => {
                  const actionRoleRaw = (o.actionRole || '').toLowerCase().trim();
                  let isDesignerOnlineOrder = false;
                  if (actionRoleRaw === 'designer online') isDesignerOnlineOrder = true;
                  else { 
                      const assignedUser = usersData.find((u: User) => u.username.toLowerCase() === actionRoleRaw); 
                      if (assignedUser && (assignedUser.role || '').toLowerCase() === 'designer online') isDesignerOnlineOrder = true; 
                  }
                  if (!isDesignerOnlineOrder) return false;
                  
                  // View All for Leaders/Supports/Idea?
                  if (userRole.includes('leader')) return true;

                  // View Own for Designer Online Role
                  if (userRole === 'designer online') { 
                      if (actionRoleRaw === currentUsername) return true; 
                      if (actionRoleRaw === 'designer online') return true; // Unassigned pool
                      return false; 
                  }
                  return false;
              });
          } else if (scope === 'none') {
              filteredOrders = [];
          } else if (scope === 'own') {
              // View Own: Filter by actionRole match
              filteredOrders = ordersInMonth.filter(o => (o.actionRole || '').toLowerCase().trim() === currentUsername);
          } else {
              // scope === 'all'
              filteredOrders = ordersInMonth.filter(o => {
                  const actionRoleRaw = (o.actionRole || '').toLowerCase().trim();
                  let isDesignerOnlineOrder = false;
                  if (actionRoleRaw === 'designer online') isDesignerOnlineOrder = true;
                  else { 
                      const assignedUser = usersData.find((u: User) => u.username.toLowerCase() === actionRoleRaw); 
                      if (assignedUser && (assignedUser.role || '').toLowerCase() === 'designer online') isDesignerOnlineOrder = true; 
                  }
                  return isDesignerOnlineOrder;
              });
          }
      } else {
          // Admin View: All
          filteredOrders = ordersInMonth.filter(o => {
              const actionRoleRaw = (o.actionRole || '').toLowerCase().trim();
              let isDesignerOnlineOrder = false;
              if (actionRoleRaw === 'designer online') isDesignerOnlineOrder = true;
              else { 
                  const assignedUser = usersData.find((u: User) => u.username.toLowerCase() === actionRoleRaw); 
                  if (assignedUser && (assignedUser.role || '').toLowerCase() === 'designer online') isDesignerOnlineOrder = true; 
              }
              return isDesignerOnlineOrder;
          });
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
  const handleFilterValueChange = (columnKey: string, value: string) => { const currentFilters = columnFilters[columnKey] || []; const newFilters = currentFilters.includes(value) ? currentFilters.filter(v => v !== value) : [...currentFilters, value]; setColumnFilters({ ...columnFilters, [columnKey]: newFilters }); };
  const handleClearFilter = (columnKey: string) => setColumnFilters({ ...columnFilters, [columnKey]: [] });
  const handleSelectAllFilter = (columnKey: string, values: string[]) => setColumnFilters({ ...columnFilters, [columnKey]: values });

  const renderFilterPopup = () => { 
    if (!activeFilterColumn || !filterPopupPos) return null; 
    const columnKey = activeFilterColumn; 
    const uniqueValues = getUniqueValues(columnKey); 
    const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase())); 
    const currentSelected = columnFilters[columnKey]; 
    const isChecked = (val: string) => !currentSelected || currentSelected.includes(val); 
    
    return ( 
      <div ref={filterPopupRef} className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-[100] flex flex-col w-72 animate-fade-in" style={{ top: filterPopupPos.top, left: filterPopupPos.left }}> 
        <div className="p-2 border-b border-gray-100 space-y-1"> 
          <button onClick={() => { setSortConfig({ key: columnKey as keyof Order, direction: 'asc' }); setActiveFilterColumn(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowDownAZ size={16} /> Sắp xếp A - Z</button> 
          <button onClick={() => { setSortConfig({ key: columnKey as keyof Order, direction: 'desc' }); setActiveFilterColumn(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowUpAZ size={16} /> Sắp xếp Z - A</button> 
        </div> 
        <div className="p-2 border-b border-gray-100 bg-gray-50">
          <div className="relative"><Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/><input type="text" placeholder="Tìm..." className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none" value={filterSearchTerm} onChange={(e) => setFilterSearchTerm(e.target.value)} autoFocus /></div>
        </div> 
        <div className="flex-1 overflow-y-auto max-h-60 p-2 space-y-1 custom-scrollbar"> 
          {displayValues.map((val, idx) => ( 
            <label key={idx} className="flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50 rounded cursor-pointer text-sm select-none"> 
              <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={isChecked(val)} onChange={() => handleFilterValueChange(columnKey, val)} /> 
              <span className="truncate flex-1">{val || '(Trống)'}</span> 
            </label> 
          ))} 
        </div> 
        <div className="p-2 border-t border-gray-100 flex justify-between bg-gray-50 rounded-b-lg"> 
          <button onClick={() => handleSelectAllFilter(columnKey, uniqueValues)} className="text-xs text-blue-600 font-bold px-2 py-1 hover:bg-blue-50 rounded">Chọn tất cả</button> 
          <button onClick={() => handleClearFilter(columnKey)} className="text-xs text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded">Bỏ chọn</button> 
        </div> 
      </div> 
    ); 
  };

  const stats = useMemo<{ totalOrders: number; totalMoney: number; categories: Record<string, { total: number; checked: number; money: number }>; designers: Record<string, { total: number; checked: number; money: number }>; }>(() => { const result = { totalOrders: 0, totalMoney: 0, categories: { 'Loại 1': { total: 0, checked: 0, money: 0 }, 'Loại 2': { total: 0, checked: 0, money: 0 }, 'Loại 3': { total: 0, checked: 0, money: 0 }, 'Loại 4': { total: 0, checked: 0, money: 0 }, 'Khác': { total: 0, checked: 0, money: 0 } } as Record<string, { total: number; checked: number; money: number }>, designers: {} as Record<string, { total: number; checked: number; money: number }> }; orders.forEach(o => { const skuNorm = normalizeKey(o.sku); let rawCategory = skuMap[skuNorm] || 'Khác'; let category = rawCategory.trim(); const matchedCategory = PRICE_CATEGORIES.find(c => normalizeKey(c) === normalizeKey(category)); if (matchedCategory) category = matchedCategory; else category = 'Khác'; const price = getPriceForCategory(category); const isChecked = o.isDesignDone === true; const designerName = o.actionRole ? o.actionRole.trim() : 'Chưa Giao'; let catKey = category; if (!result.categories[catKey]) catKey = 'Khác'; const target = result.categories[catKey]; target.total += 1; target.money += price; if (isChecked) target.checked += 1; if (!result.designers[designerName]) { result.designers[designerName] = { total: 0, checked: 0, money: 0 }; } result.designers[designerName].total += 1; result.designers[designerName].money += price; if (isChecked) result.designers[designerName].checked += 1; result.totalOrders += 1; result.totalMoney += price; }); return result; }, [orders, skuMap, priceMap]);

  const formatDateDisplay = (dateStr: string) => { if (!dateStr) return ''; try { const parts = dateStr.split(/[-T :]/); if (parts.length >= 5) { const y = parts[0]; const m = parts[1]; const d = parts[2]; const hh = parts[3] || '00'; const mm = parts[4] || '00'; if (y.length === 4) return `${d}/${m}/${y} ${hh}:${mm}`; } return dateStr; } catch (e) { return dateStr; } };
  const handleMonthChange = (step: number) => { const [year, month] = selectedMonth.split('-').map(Number); const date = new Date(year, month - 1 + step, 1); const newYear = date.getFullYear(); const newMonth = String(date.getMonth() + 1).padStart(2, '0'); setSelectedMonth(`${newYear}-${newMonth}`); };
  const handleUpdateSku = async (e: React.FormEvent) => { e.preventDefault(); if (!skuFormData.sku.trim()) { setSkuMessage({ type: 'error', text: 'Vui lòng nhập SKU' }); return; } setIsSubmittingSku(true); setSkuMessage(null); try { const result = await sheetService.updateSkuCategory(skuFormData.sku.trim(), skuFormData.category); if (result.success) { setSkuMessage({ type: 'success', text: 'Cập nhật phân loại thành công!' }); setSkuFormData(prev => ({ ...prev, sku: '' })); await loadData(selectedMonth); setTimeout(() => { setIsSkuModalOpen(false); setSkuMessage(null); }, 1500); } else { setSkuMessage({ type: 'error', text: result.error || 'Lỗi cập nhật.' }); } } catch (err) { setSkuMessage({ type: 'error', text: 'Lỗi kết nối hệ thống.' }); } finally { setIsSubmittingSku(false); } };
  const handleSavePrices = async () => { setIsSavingPrices(true); try { const categories = Object.keys(tempPriceMap); let successCount = 0; const newMap = {...priceMap}; categories.forEach(cat => { newMap[normalizeKey(cat)] = tempPriceMap[cat]; }); setPriceMap(newMap); for (const cat of categories) { const res = await sheetService.updateCategoryPrice(cat, tempPriceMap[cat]); if (res && res.success) successCount++; await new Promise(r => setTimeout(r, 300)); } setIsPriceModalOpen(false); fetchLatestPrices(); } catch (e) { alert('Lỗi khi lưu bảng giá.'); } finally { setIsSavingPrices(false); } };
  const handleDesignerToggle = async (order: Order) => { if (!currentFileId) return; if (updatingIds.has(order.id)) return; const newValue = !order.isDesignDone; if (onProcessStart) onProcessStart(); setUpdatingIds(prev => new Set(prev).add(order.id)); setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isDesignDone: newValue } : o)); try { await sheetService.updateDesignerStatus(currentFileId, order, "Designer Online", newValue); } catch (error) { setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isDesignDone: !newValue } : o)); alert('Lỗi cập nhật trạng thái'); } finally { setUpdatingIds(prev => { const newSet = new Set(prev); newSet.delete(order.id); return newSet; }); if (onProcessEnd) onProcessEnd(); } };
  const formatPrice = (price: number) => { if (!price) return '-'; return price.toLocaleString('vi-VN') + ' đ'; };
  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');
  
  const canManageSku = user.role === 'admin' || user.permissions?.canManageSku === true;
  const canManagePrice = user.role === 'admin' || user.permissions?.canManageSku === true; 
  // Determine check rights based on permissions or role fallback
  const canCheckDesign = user.role === 'admin' || user.role === 'leader' || user.role === 'support' || (user.permissions?.designerOnline !== 'none');

  const filteredOrders = orders.filter(o => { 
    const matchesSearch = ((o.id ? String(o.id).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.sku ? String(o.sku).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.storeId ? getStoreName(o.storeId).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.handler ? String(o.handler).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.actionRole ? String(o.actionRole).toLowerCase() : '').includes(searchTerm.toLowerCase())); 
    if (!matchesSearch) return false; 
    
    // Explicitly iterate over object entries without casting in the loop head
    for (const [key, val] of Object.entries(columnFilters)) { 
        const selectedValues = val as string[];
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
  const sortedOrders = filteredOrders.map((item, index) => ({ item, index })).sort((a, b) => { if (sortConfig.key === 'date') { const dateA = new Date(a.item.date || '').getTime(); const dateB = new Date(b.item.date || '').getTime(); const validA = !isNaN(dateA); const validB = !isNaN(dateB); if (!validA && !validB) return 0; if (!validA) return 1; if (!validB) return -1; if (dateA !== dateB) { return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA; } return a.index - b.index; } const valA = String((a.item as any)[sortConfig.key] || ''); const valB = String((b.item as any)[sortConfig.key] || ''); if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }).map(x => x.item);

  // --- SE