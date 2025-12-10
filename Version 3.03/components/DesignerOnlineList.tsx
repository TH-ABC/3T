import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Copy, ArrowUp, ArrowDown, Calendar, UserCircle, ChevronLeft, ChevronRight, Settings, Save, X, Loader2, CheckCircle, AlertCircle, Filter, ArrowDownAZ, ArrowUpAZ, AlertTriangle, Info, FileSpreadsheet, DollarSign, CheckSquare, Square, Users, Layers, Code, PenTool } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { Order, Store, User } from '../types';

const getCurrentLocalMonth = () => { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); return `${year}-${month}`; };
const ROLE_HIERARCHY: Record<string, number> = { 'admin': 1, 'leader': 2, 'idea': 3, 'support': 4, 'designer': 5, 'designer online': 5 };
const getRoleLevel = (role: string): number => { return ROLE_HIERARCHY[(role || '').toLowerCase().trim()] || 99; };

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
  const yearsList = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const monthsList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
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
      const userRole = (user.role || '').toLowerCase().trim();
      const currentUsername = user.username.toLowerCase().trim();
      const currentUserLevel = getRoleLevel(user.role);
      const filteredOrders = ordersInMonth.filter(o => {
          const actionRoleRaw = (o.actionRole || '').toLowerCase().trim();
          let isDesignerOnlineOrder = false;
          if (actionRoleRaw === 'designer online') isDesignerOnlineOrder = true;
          else { const assignedUser = usersData.find((u: User) => u.username.toLowerCase() === actionRoleRaw); if (assignedUser && (assignedUser.role || '').toLowerCase() === 'designer online') isDesignerOnlineOrder = true; }
          if (!isDesignerOnlineOrder) return false;
          if (currentUserLevel < 5) return true;
          if (userRole === 'designer online') { if (actionRoleRaw === currentUsername) return true; if (actionRoleRaw === 'designer online') return true; return false; }
          return false;
      });
      setOrders(filteredOrders);
    } catch (e) { if (selectedMonthRef.current === monthToFetch) console.error("Load Data Error:", e); } finally { if (selectedMonthRef.current === monthToFetch) setLoading(false); }
  };

  const fetchLatestPrices = async () => { setIsLoadingPrices(true); setBackendConfigError(false); try { const res = await sheetService.getPriceMappings(); if (Array.isArray(res)) { const newMap: Record<string, number> = {}; res.forEach(p => { if(p.category) newMap[normalizeKey(p.category)] = Number(p.price) || 0; }); setPriceMap(newMap); } else { setBackendConfigError(true); } } catch(e) { console.error(e); } finally { setIsLoadingPrices(false); } };
  useEffect(() => { selectedMonthRef.current = selectedMonth; loadData(selectedMonth); }, [selectedMonth, user.username]);
  useEffect(() => { if (isPriceModalOpen) fetchLatestPrices(); }, [isPriceModalOpen]);
  useEffect(() => { if (isPriceModalOpen) { const initialMap: Record<string, number> = {}; PRICE_CATEGORIES.forEach(cat => { const key = normalizeKey(cat); initialMap[cat] = priceMap[key] || 0; }); setTempPriceMap(initialMap); } }, [priceMap, isPriceModalOpen]);
  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (filterPopupRef.current && !filterPopupRef.current.contains(event.target as Node)) { setActiveFilterColumn(null); setFilterSearchTerm(''); setFilterPopupPos(null); } }; document.addEventListener('mousedown', handleClickOutside); window.addEventListener('scroll', () => { if (activeFilterColumn) setActiveFilterColumn(null); }, true); return () => { document.removeEventListener('mousedown', handleClickOutside); window.removeEventListener('scroll', () => {}, true); }; }, [activeFilterColumn]);

  const getPriceForCategory = (categoryName: string) => { if (!categoryName) return 0; const key = normalizeKey(categoryName); return priceMap[key] || 0; };
  const getUniqueValues = (key: keyof Order | 'storeName' | 'category' | 'isDesignDone'): string[] => { const values = new Set<string>(); orders.forEach(order => { let val = ''; if (key === 'storeName') val = getStoreName(order.storeId); else if (key === 'category') { const skuNorm = normalizeKey(order.sku); val = skuMap[skuNorm] || ''; const matched = PRICE_CATEGORIES.find(c => normalizeKey(c) === normalizeKey(val)); if (matched) val = matched; if (!val) val = '(Chưa phân loại)'; } else if (key === 'isDesignDone') val = order.isDesignDone ? "Đã xong" : "Chưa xong"; else val = String(order[key as keyof Order] || ''); if (val) values.add(val); }); return Array.from(values).sort() as string[]; };
  const handleFilterClick = (e: React.MouseEvent, columnKey: string) => { e.stopPropagation(); if (activeFilterColumn === columnKey) { setActiveFilterColumn(null); setFilterPopupPos(null); } else { const rect = e.currentTarget.getBoundingClientRect(); let top = rect.bottom + 5; let left = rect.left; const POPUP_WIDTH = 288; if (left + POPUP_WIDTH > window.innerWidth - 10) { left = rect.right - POPUP_WIDTH; } setFilterPopupPos({ top, left, alignRight: false }); setActiveFilterColumn(columnKey); setFilterSearchTerm(''); } };
  const handleFilterValueChange = (columnKey: string, value: string) => { const currentFilters = columnFilters[columnKey] || []; const newFilters = currentFilters.includes(value) ? currentFilters.filter(v => v !== value) : [...currentFilters, value]; setColumnFilters({ ...columnFilters, [columnKey]: newFilters }); };
  const handleClearFilter = (columnKey: string) => setColumnFilters({ ...columnFilters, [columnKey]: [] });
  const handleSelectAllFilter = (columnKey: string, values: string[]) => setColumnFilters({ ...columnFilters, [columnKey]: values });

  const renderFilterPopup = () => { if (!activeFilterColumn || !filterPopupPos) return null; const columnKey = activeFilterColumn; const uniqueValues = getUniqueValues(columnKey as any) as string[]; const displayValues = uniqueValues.filter(v => v.toLowerCase().includes(filterSearchTerm.toLowerCase())); const currentSelected = columnFilters[columnKey]; const isChecked = (val: string) => !currentSelected || currentSelected.includes(val); return ( <div ref={filterPopupRef} className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-[100] flex flex-col w-72 animate-fade-in" style={{ top: filterPopupPos.top, left: filterPopupPos.left }}> <div className="p-2 border-b border-gray-100 space-y-1"> <button onClick={() => { setSortConfig({ key: columnKey as keyof Order, direction: 'asc' }); setActiveFilterColumn(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowDownAZ size={16} /> Sắp xếp A - Z</button> <button onClick={() => { setSortConfig({ key: columnKey as keyof Order, direction: 'desc' }); setActiveFilterColumn(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded text-gray-700 font-medium"><ArrowUpAZ size={16} /> Sắp xếp Z - A</button> </div> <div className="p-2 border-b border-gray-100 bg-gray-50"><div className="relative"><Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"/><input type="text" placeholder="Tìm..." className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none" value={filterSearchTerm} onChange={(e) => setFilterSearchTerm(e.target.value)} autoFocus /></div></div> <div className="flex-1 overflow-y-auto max-h-60 p-2 space-y-1 custom-scrollbar"> {displayValues.map((val, idx) => ( <label key={idx} className="flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50 rounded cursor-pointer text-sm select-none"> <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={isChecked(val)} onChange={() => handleFilterValueChange(columnKey, val)} /> <span className="truncate flex-1">{val || '(Trống)'}</span> </label> ))} </div> <div className="p-2 border-t border-gray-100 flex justify-between bg-gray-50 rounded-b-lg"> <button onClick={() => handleSelectAllFilter(columnKey, uniqueValues)} className="text-xs text-blue-600 font-bold px-2 py-1 hover:bg-blue-50 rounded">Chọn tất cả</button> <button onClick={() => handleClearFilter(columnKey)} className="text-xs text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded">Bỏ chọn</button> </div> </div> ); };

  const stats = useMemo<{ totalOrders: number; totalMoney: number; categories: Record<string, { total: number; checked: number; money: number }>; designers: Record<string, { total: number; checked: number; money: number }>; }>(() => { const result = { totalOrders: 0, totalMoney: 0, categories: { 'Loại 1': { total: 0, checked: 0, money: 0 }, 'Loại 2': { total: 0, checked: 0, money: 0 }, 'Loại 3': { total: 0, checked: 0, money: 0 }, 'Loại 4': { total: 0, checked: 0, money: 0 }, 'Khác': { total: 0, checked: 0, money: 0 } } as Record<string, { total: number; checked: number; money: number }>, designers: {} as Record<string, { total: number; checked: number; money: number }> }; orders.forEach(o => { const skuNorm = normalizeKey(o.sku); let rawCategory = skuMap[skuNorm] || 'Khác'; let category = rawCategory.trim(); const matchedCategory = PRICE_CATEGORIES.find(c => normalizeKey(c) === normalizeKey(category)); if (matchedCategory) category = matchedCategory; else category = 'Khác'; const price = getPriceForCategory(category); const isChecked = o.isDesignDone === true; const designerName = o.actionRole ? o.actionRole.trim() : 'Chưa Giao'; let catKey = category; if (!result.categories[catKey]) catKey = 'Khác'; const target = result.categories[catKey]; target.total += 1; target.money += price; if (isChecked) target.checked += 1; if (!result.designers[designerName]) { result.designers[designerName] = { total: 0, checked: 0, money: 0 }; } result.designers[designerName].total += 1; result.designers[designerName].money += price; if (isChecked) result.designers[designerName].checked += 1; result.totalOrders += 1; result.totalMoney += price; }); return result; }, [orders, skuMap, priceMap]);

  const formatDateDisplay = (dateStr: string) => { if (!dateStr) return ''; try { const parts = dateStr.split(/[-T :]/); if (parts.length >= 5) { const y = parts[0]; const m = parts[1]; const d = parts[2]; const hh = parts[3] || '00'; const mm = parts[4] || '00'; if (y.length === 4) return `${d}/${m}/${y} ${hh}:${mm}`; } return dateStr; } catch (e) { return dateStr; } };
  const handleMonthChange = (step: number) => { const [year, month] = selectedMonth.split('-').map(Number); const date = new Date(year, month - 1 + step, 1); const newYear = date.getFullYear(); const newMonth = String(date.getMonth() + 1).padStart(2, '0'); setSelectedMonth(`${newYear}-${newMonth}`); };
  const handleUpdateSku = async (e: React.FormEvent) => { e.preventDefault(); if (!skuFormData.sku.trim()) { setSkuMessage({ type: 'error', text: 'Vui lòng nhập SKU' }); return; } setIsSubmittingSku(true); setSkuMessage(null); try { const result = await sheetService.updateSkuCategory(skuFormData.sku.trim(), skuFormData.category); if (result.success) { setSkuMessage({ type: 'success', text: 'Cập nhật phân loại thành công!' }); setSkuFormData(prev => ({ ...prev, sku: '' })); await loadData(selectedMonth); setTimeout(() => { setIsSkuModalOpen(false); setSkuMessage(null); }, 1500); } else { setSkuMessage({ type: 'error', text: result.error || 'Lỗi cập nhật.' }); } } catch (err) { setSkuMessage({ type: 'error', text: 'Lỗi kết nối hệ thống.' }); } finally { setIsSubmittingSku(false); } };
  const handleSavePrices = async () => { setIsSavingPrices(true); try { const categories = Object.keys(tempPriceMap); let successCount = 0; const newMap = {...priceMap}; categories.forEach(cat => { newMap[normalizeKey(cat)] = tempPriceMap[cat]; }); setPriceMap(newMap); for (const cat of categories) { const res = await sheetService.updateCategoryPrice(cat, tempPriceMap[cat]); if (res && res.success) successCount++; await new Promise(r => setTimeout(r, 300)); } setIsPriceModalOpen(false); fetchLatestPrices(); } catch (e) { alert('Lỗi khi lưu bảng giá.'); } finally { setIsSavingPrices(false); } };
  const handleDesignerToggle = async (order: Order) => { if (!currentFileId) return; if (updatingIds.has(order.id)) return; const newValue = !order.isDesignDone; if (onProcessStart) onProcessStart(); setUpdatingIds(prev => new Set(prev).add(order.id)); setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isDesignDone: newValue } : o)); try { await sheetService.updateDesignerStatus(currentFileId, order, "Designer Online", newValue); } catch (error) { setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isDesignDone: !newValue } : o)); alert('Lỗi cập nhật trạng thái'); } finally { setUpdatingIds(prev => { const newSet = new Set(prev); newSet.delete(order.id); return newSet; }); if (onProcessEnd) onProcessEnd(); } };
  const formatPrice = (price: number) => { if (!price) return '-'; return price.toLocaleString('vi-VN') + ' đ'; };
  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');
  const userLevel = getRoleLevel(user.role);
  const canManageSku = userLevel === 1 || user.permissions?.canManageSku === true;
  const canManagePrice = userLevel === 1 || user.permissions?.canManageSku === true; 
  const canCheckDesign = userLevel <= 4; 

  const filteredOrders = orders.filter(o => { const matchesSearch = ((o.id ? String(o.id).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.sku ? String(o.sku).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.storeId ? getStoreName(o.storeId).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.handler ? String(o.handler).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.actionRole ? String(o.actionRole).toLowerCase() : '').includes(searchTerm.toLowerCase())); if (!matchesSearch) return false; for (const [key, val] of Object.entries(columnFilters)) { const selectedValues = val as string[]; if (!selectedValues || selectedValues.length === 0) continue; let cellValue = ''; if (key === 'storeName') cellValue = getStoreName(o.storeId); else if (key === 'category') { const skuNorm = normalizeKey(o.sku); cellValue = skuMap[skuNorm] || ''; const matched = PRICE_CATEGORIES.find(c => normalizeKey(c) === normalizeKey(cellValue)); if (matched) cellValue = matched; if (!cellValue) cellValue = '(Chưa phân loại)'; } else if (key === 'isDesignDone') cellValue = o.isDesignDone ? "Đã xong" : "Chưa xong"; else cellValue = String(o[key as keyof Order] || ''); if (!selectedValues.includes(cellValue)) return false; } return true; });
  const sortedOrders = filteredOrders.map((item, index) => ({ item, index })).sort((a, b) => { if (sortConfig.key === 'date') { const dateA = new Date(a.item.date || '').getTime(); const dateB = new Date(b.item.date || '').getTime(); const validA = !isNaN(dateA); const validB = !isNaN(dateB); if (!validA && !validB) return 0; if (!validA) return 1; if (!validB) return -1; if (dateA !== dateB) { return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA; } return a.index - b.index; } const valA = String((a.item as any)[sortConfig.key] || ''); const valB = String((b.item as any)[sortConfig.key] || ''); if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }).map(x => x.item);

  // --- SELECTION HANDLERS ---
  const handleSelectAll = () => { if (selectedOrderIds.size === sortedOrders.length && sortedOrders.length > 0) setSelectedOrderIds(new Set()); else setSelectedOrderIds(new Set(sortedOrders.map(o => o.id))); };
  const handleSelectRow = (id: string) => { const newSelected = new Set(selectedOrderIds); if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id); setSelectedOrderIds(newSelected); };
  const handleBatchAction = async (actionType: 'design_done' | 'design_pending') => {
      if (!currentFileId) return;
      if (selectedOrderIds.size === 0) return;
      const idsToUpdate = Array.from(selectedOrderIds);
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
        {/* TOP SUMMARY DASHBOARD */}
        <div className="bg-white border-b border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2"><DollarSign size={16} className="text-green-600"/> Tổng Hợp Tháng {currentMonthStr}/{currentYearStr}</h3>
            <div className="flex flex-col xl:flex-row gap-6">
                <div className="flex-1"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-3"><div className="bg-indigo-600 text-white rounded p-3 shadow-sm flex flex-col justify-center items-center text-center"><span className="text-xs opacity-80 uppercase tracking-wide">Tổng Đơn</span><span className="text-xl font-bold">{stats.totalOrders}</span></div><div className="bg-emerald-600 text-white rounded p-3 shadow-sm flex flex-col justify-center items-center text-center"><span className="text-xs opacity-80 uppercase tracking-wide">Tổng Tiền</span><span className="text-lg font-bold">{formatPrice(stats.totalMoney)}</span></div>{PRICE_CATEGORIES.map(cat => { const data = (stats.categories[cat] as { total: number; checked: number; money: number } | undefined) || { total: 0, checked: 0, money: 0 }; return (<div key={cat} className="bg-gray-50 border border-gray-200 rounded p-3 shadow-sm flex flex-col justify-between"><div className="flex justify-between items-start border-b border-gray-200 pb-1 mb-1"><span className="text-xs font-bold text-gray-700 uppercase">{cat}</span><span className="text-xs font-medium text-green-600">{formatPrice(data.money)}</span></div><div className="flex justify-between items-end"><div className="text-center"><div className="text-[10px] text-gray-400 uppercase">Đơn</div><div className="text-sm font-bold text-gray-800">{data.total}</div></div><div className="text-center"><div className="text-[10px] text-gray-400 uppercase">Check</div><div className="text-sm font-bold text-blue-600">{data.checked}</div></div></div></div>); })}</div></div>
                <div className="flex-1 border-l border-gray-200 xl:pl-6 pt-4 xl:pt-0 border-t xl:border-t-0 mt-2 xl:mt-0"><h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><Users size={14} /> Chi Tiết Theo Designer</h4><div className="overflow-x-auto custom-scrollbar max-h-[140px]"><table className="w-full text-left text-xs border-collapse"><thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0"><tr><th className="px-3 py-2 border-b">Designer</th><th className="px-3 py-2 border-b text-center">Số lượng</th><th className="px-3 py-2 border-b text-center">Đã Check</th><th className="px-3 py-2 border-b text-right">Tạm tính</th></tr></thead><tbody className="divide-y divide-gray-100">{Object.entries(stats.designers).map(([name, data]: [string, { total: number; checked: number; money: number }]) => (<tr key={name} className="hover:bg-gray-50"><td className="px-3 py-2 font-medium text-gray-700 truncate max-w-[120px]" title={name}>{name}</td><td className="px-3 py-2 text-center text-gray-600">{data.total}</td><td className="px-3 py-2 text-center font-bold text-blue-600">{data.checked}</td><td className="px-3 py-2 text-right font-medium text-green-700">{data.money.toLocaleString('vi-VN')}</td></tr>))}{Object.keys(stats.designers).length === 0 && (<tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400 italic">Chưa có dữ liệu designer.</td></tr>)}</tbody></table></div></div>
            </div>
        </div>

        <div className="p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white z-20">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap flex items-center gap-2">DESIGNER ONLINE <span className="text-orange-600 uppercase text-sm border border-orange-200 bg-orange-50 px-2 py-0.5 rounded">Tháng {currentMonthStr}/{currentYearStr}</span><button onClick={() => loadData(selectedMonth)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Làm mới"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button></h2>
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm p-1"><button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><ChevronLeft size={18} /></button><div className="flex items-center px-2 border-l border-r border-gray-100 gap-1 min-w-[160px] justify-center"><Calendar size={14} className="text-orange-500 mr-1" /><select value={currentMonthStr} onChange={(e) => setSelectedMonth(`${currentYearStr}-${e.target.value}`)} className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-center text-sm">{monthsList.map(m => (<option key={m} value={m}>Tháng {parseInt(m)}</option>))}</select><span className="text-gray-400">/</span><select value={currentYearStr} onChange={(e) => setSelectedMonth(`${e.target.value}-${currentMonthStr}`)} className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-sm">{yearsList.map(y => (<option key={y} value={y}>{y}</option>))}</select></div><button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><ChevronRight size={18} /></button></div>
                {canManageSku && (<button onClick={() => setIsSkuModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm h-[42px] whitespace-nowrap ml-2"><Settings size={16} /> <span className="hidden sm:inline">Phân loại</span></button>)}
                {canManagePrice && (<button onClick={() => setIsPriceModalOpen(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm h-[42px] whitespace-nowrap ml-2"><DollarSign size={16} /> <span className="hidden sm:inline">Cấu hình Giá</span></button>)}
            </div>
          </div>
          <div className="relative flex-1 sm:flex-none sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="Tìm ID, SKU..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-[#1a4019] focus:border-transparent outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-250px)] custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm relative">
            <thead className="text-white font-bold text-center uppercase text-xs tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-2 py-3 bg-[#1a4019] border-r border-gray-600 sticky top-0 z-20 w-10">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-400 text-orange-600 focus:ring-orange-500 cursor-pointer" checked={selectedOrderIds.size > 0 && selectedOrderIds.size === sortedOrders.length} onChange={handleSelectAll} />
                </th>
                <th className="px-3 py-3 border-r border-gray-600 w-32 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-center gap-1 group cursor-pointer" onClick={() => setSortConfig({ key: 'date', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>)}</div></th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>ID Order Etsy</span><button onClick={(e) => handleFilterClick(e, 'id')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['id']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>STORE</span><button onClick={(e) => handleFilterClick(e, 'storeName')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['storeName']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>SKU</span><button onClick={(e) => handleFilterClick(e, 'sku')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['sku']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-32 text-yellow-300"><div className="flex items-center justify-between gap-1"><span>Phân Loại</span><button onClick={(e) => handleFilterClick(e, 'category')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['category']?.length ? 'text-white' : 'text-yellow-600'}`}><Filter size={14} /></button></div></th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-32 text-green-300">Giá Tiền</th>
                <th className="px-1 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-12 text-center text-blue-300"><div className="flex flex-col items-center"><span className="mb-1">CHK</span><button onClick={(e) => handleFilterClick(e, 'isDesignDone')} className={`p-0.5 rounded hover:bg-[#235221] ${columnFilters['isDesignDone']?.length ? 'text-white' : 'text-blue-400'}`}><Filter size={12} /></button></div></th>
                <th className="px-3 py-3 border-r border-gray-600 w-48 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>Người xử lý</span><button onClick={(e) => handleFilterClick(e, 'handler')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['handler']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
                <th className="px-3 py-3 border-l border-gray-600 w-48 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>Action Role</span><button onClick={(e) => handleFilterClick(e, 'actionRole')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['actionRole']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? <tr><td colSpan={9} className="text-center py-12 text-gray-500">Đang tải dữ liệu Tháng {currentMonthStr}...</td></tr> : (sortedOrders.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-gray-500">{dataError ? (<div className="flex flex-col items-center justify-center p-4 bg-red-50 border border-red-200 rounded-lg max-w-2xl mx-auto my-4 text-red-700"><div className="flex items-center gap-2 font-bold text-lg mb-2"><AlertTriangle size={24} /> {dataError.message}</div>{dataError.detail && <p className="text-sm mb-3">{dataError.detail}</p>}<div className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-red-100"><Info size={16} className="text-blue-500"/><span>Vui lòng kiểm tra tab <strong>FileIndex</strong> trong Master Sheet để đảm bảo ID file chính xác.</span></div>{dataError.fileId && (<a href={`https://docs.google.com/spreadsheets/d/${dataError.fileId}/edit`} target="_blank" rel="noreferrer" className="mt-3 text-blue-600 hover:underline text-sm font-semibold flex items-center gap-1"><FileSpreadsheet size={16} /> Bấm vào đây để kiểm tra File hiện tại (ID: {dataError.fileId.substring(0, 10)}...)</a>)}</div>) : 'Không có đơn hàng nào thuộc nhóm Designer Online.'}</td></tr> : sortedOrders.map((order, idx) => {
                  const normalizedSku = normalizeKey(order.sku);
                  const category = skuMap[normalizedSku] || '';
                  const price = getPriceForCategory(category);
                  const isUpdating = updatingIds.has(order.id);
                  return (
                      <tr key={order.id + idx} className={`hover:bg-gray-50 border-b border-gray-200 text-gray-800 transition-colors ${selectedOrderIds.has(order.id) ? 'bg-indigo-50' : ''}`}>
                          <td className="px-2 py-3 border-r text-center align-middle"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectRow(order.id)} /></td>
                          <td className="px-2 py-3 border-r text-center whitespace-nowrap text-gray-600">{formatDateDisplay(order.date)}</td>
                          <td className="px-3 py-3 border-r font-semibold text-gray-900 whitespace-nowrap"><div className="flex justify-between items-center group gap-2"><span>{order.id}</span><button className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(order.id)} title="Copy ID"><Copy size={12} /></button></div></td>
                          <td className="px-3 py-3 border-r text-gray-700">{getStoreName(order.storeId)}</td>
                          <td className="px-3 py-3 border-r font-mono text-xs text-gray-600">{order.sku}</td>
                          <td className="px-3 py-3 border-r text-center font-medium text-indigo-600 bg-indigo-50/50">{category}</td>
                          <td className="px-3 py-3 border-r text-center font-bold text-green-700 bg-green-50/50">{formatPrice(price)}</td>
                          <td className="px-1 py-1 border-r text-center align-middle bg-blue-50/30">{isUpdating ? (<div className="flex justify-center"><Loader2 size={16} className="animate-spin text-blue-500" /></div>) : (<button onClick={() => handleDesignerToggle(order)} disabled={!canCheckDesign} className={`p-1 rounded focus:outline-none transition-colors ${!canCheckDesign ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100'}`} title={canCheckDesign ? "Check hoàn thành và Lưu sheet" : "Bạn không có quyền check"}>{order.isDesignDone ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-300" />}</button>)}</td>
                          <td className="px-3 py-3 border-r text-center text-xs text-gray-600 font-medium whitespace-nowrap bg-gray-50/50"><div className="flex items-center justify-center gap-1.5"><UserCircle size={14} className="text-gray-400"/>{order.handler}</div></td>
                          <td className="px-3 py-3 border-l text-center bg-gray-50/30 font-bold text-orange-600">{order.actionRole}</td>
                      </tr>
                  );
              }))}
            </tbody>
          </table>
        </div>

        {/* --- FLOATING BATCH ACTION BAR --- */}
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
        {isPriceModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"><div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"><div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><DollarSign className="text-green-600" size={20} /> Cấu Hình Giá Tiền</h3><button onClick={() => setIsPriceModalOpen(false)} disabled={isSavingPrices} className="text-gray-400 hover:text-gray-600">✕</button></div><div className="p-5"><div className="bg-blue-50 border border-blue-100 p-3 rounded text-xs text-blue-700 mb-4 flex gap-2"><Info size={16} className="flex-shrink-0"/><span>Giá tiền sẽ được áp dụng tự động cho các đơn hàng có SKU thuộc phân loại tương ứng.</span></div>{backendConfigError && (<div className="bg-red-50 border border-red-200 p-3 rounded text-xs text-red-700 mb-4 flex gap-2"><AlertCircle size={16} className="flex-shrink-0 mt-0.5"/><div><strong>Lỗi Backend:</strong> Hệ thống Google Sheet chưa có các hàm xử lý <code>getPriceMappings</code> và <code>updateCategoryPrice</code>.<br/>Vui lòng cập nhật script trong Google Apps Script.</div></div>)}{isLoadingPrices && (<div className="text-center py-2 text-gray-500 text-xs flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={14} /> Đang cập nhật dữ liệu mới nhất...</div>)}{!isLoadingPrices && !backendConfigError && Object.keys(priceMap).length === 0 && (<div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-700 mb-4 flex gap-2"><AlertTriangle size={16} className="flex-shrink-0"/><span>Chưa tải được bảng giá từ Sheet (Sheet có thể đang trống).</span></div>)}<div className="space-y-3 mb-6">{PRICE_CATEGORIES.map(cat => (<div key={cat} className="flex items-center gap-3"><div className="w-24 text-sm font-bold text-gray-700">{cat}</div><div className="flex-1 relative"><input type="number" className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-right pr-8 font-mono focus:ring-2 focus:ring-green-500 outline-none" value={tempPriceMap[cat] !== undefined ? tempPriceMap[cat] : 0} onChange={(e) => setTempPriceMap({...tempPriceMap, [cat]: Number(e.target.value)})} placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">đ</span></div></div>))}</div><div className="flex gap-3 pt-2 border-t border-gray-100"><button onClick={() => setIsPriceModalOpen(false)} disabled={isSavingPrices} className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium">Hủy bỏ</button><button onClick={handleSavePrices} disabled={isSavingPrices} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-bold shadow-sm flex items-center justify-center gap-2">{isSavingPrices ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Lưu Cấu Hình</button></div></div></div></div>)}
      </div>
    </div>
  );
};