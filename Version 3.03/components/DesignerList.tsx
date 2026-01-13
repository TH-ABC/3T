import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, RefreshCw, Copy, ArrowUp, ArrowDown, Calendar, UserCircle, ChevronLeft, ChevronRight, Settings, Save, Loader2, CheckCircle, AlertCircle, AlertTriangle, Info, FileSpreadsheet, PenTool, CheckSquare, Square, Users, Layers, Filter, ArrowDownAZ, ArrowUpAZ, X } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { Order, Store, User } from '../types';

const getCurrentLocalMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

interface DesignerListProps { user: User; onProcessStart?: () => void; onProcessEnd?: () => void; }

export const DesignerList: React.FC<DesignerListProps> = ({ user, onProcessStart, onProcessEnd }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [skuMap, setSkuMap] = useState<Record<string, string>>({}); 
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

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);
  const [skuFormData, setSkuFormData] = useState({ sku: '', category: 'Loại 1' });
  const [isSubmittingSku, setIsSubmittingSku] = useState(false);
  const [skuMessage, setSkuMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
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
      const results = await Promise.allSettled([sheetService.getOrders(monthToFetch), sheetService.getStores(), sheetService.getUsers(), sheetService.getSkuMappings()]);
      if (selectedMonthRef.current !== monthToFetch) return;
      const orderResult = results[0].status === 'fulfilled' ? results[0].value : { orders: [], fileId: null };
      const storeData = results[1].status === 'fulfilled' ? results[1].value : [];
      const usersData = results[2].status === 'fulfilled' ? results[2].value : [];
      const skuMappings = results[3].status === 'fulfilled' ? results[3].value : [];
      setStores(Array.isArray(storeData) ? storeData : []); setUsers(Array.isArray(usersData) ? usersData : []); setCurrentFileId(orderResult.fileId);
      const safeSkuMappings = Array.isArray(skuMappings) ? skuMappings : [];
      const mappingObj: Record<string, string> = {};
      safeSkuMappings.forEach(m => { if (m && m.sku) mappingObj[normalizeKey(m.sku)] = String(m.category); });
      setSkuMap(mappingObj);
      const rawOrders = orderResult.orders || [];
      
      const ordersInMonth = rawOrders.filter(o => { 
        if (!o.date) return false; 
        const dateStr = String(o.date).trim();
        const [targetY, targetM] = monthToFetch.split('-');
        const isIsoMatch = dateStr.includes(`${targetY}-${targetM}`);
        const isVnMatch = dateStr.includes(`/${targetM}/${targetY}`);
        return isIsoMatch || isVnMatch || dateStr.startsWith(monthToFetch);
      });

      if (rawOrders.length > 0 && ordersInMonth.length === 0) {
          const sampleDate = rawOrders[0].date;
          setDataError({ 
            message: `Dữ liệu tháng ${monthToFetch} bị lệch.`, 
            detail: `Đã tìm thấy file nhưng ngày tháng đơn hàng (${sampleDate}) không khớp bộ lọc.`, 
            fileId: orderResult.fileId 
          });
          setCurrentFileId(orderResult.fileId);
      }
      
      const currentUsername = (user.username || '').toLowerCase().trim();
      const userRole = (user.role || '').toLowerCase().trim();
      
      let filteredOrdersList = ordersInMonth;
      if (userRole !== 'admin') {
          const scope = user.permissions?.designer;
          if (!scope) {
              filteredOrdersList = ordersInMonth.filter(o => {
                  const actionRoleRaw = (o.actionRole || '').toLowerCase().trim();
                  if (actionRoleRaw === 'designer') return true;
                  const assignedUser = (usersData as any).find((u: User) => u.username.toLowerCase() === actionRoleRaw);
                  if (assignedUser && (assignedUser.role || '').toLowerCase() === 'designer') return true;
                  if (userRole === 'designer' && actionRoleRaw === currentUsername) return true;
                  if (userRole.includes('leader')) return true;
                  return false;
              });
          } else if (scope === 'none') {
              filteredOrdersList = [];
          } else if (scope === 'own') {
              filteredOrdersList = ordersInMonth.filter(o => (o.actionRole || '').toLowerCase().trim() === currentUsername);
          } else {
              filteredOrdersList = ordersInMonth.filter(o => {
                  const actionRoleRaw = (o.actionRole || '').toLowerCase().trim();
                  if (actionRoleRaw === 'designer') return true;
                  const assignedUser = (usersData as any).find((u: User) => u.username.toLowerCase() === actionRoleRaw);
                  if (assignedUser && (assignedUser.role || '').toLowerCase() === 'designer') return true;
                  return false;
              });
          }
      } else {
           filteredOrdersList = ordersInMonth.filter(o => {
              const actionRoleRaw = (o.actionRole || '').toLowerCase().trim();
              if (actionRoleRaw === 'designer') return true;
              const assignedUser = (usersData as any).find((u: User) => u.username.toLowerCase() === actionRoleRaw);
              if (assignedUser && (assignedUser.role || '').toLowerCase() === 'designer') return true;
              return false;
          });
      }

      setOrders(filteredOrdersList);
    } catch (e) { console.error(e); } finally { if (selectedMonthRef.current === monthToFetch) setLoading(false); }
  };

  useEffect(() => { selectedMonthRef.current = selectedMonth; loadData(selectedMonth); }, [selectedMonth, user.username]);

  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (filterPopupRef.current && !filterPopupRef.current.contains(event.target as Node)) { setActiveFilterColumn(null); setFilterSearchTerm(''); setFilterPopupPos(null); } }; document.addEventListener('mousedown', handleClickOutside); window.addEventListener('scroll', () => { if (activeFilterColumn) setActiveFilterColumn(null); }, true); return () => { document.removeEventListener('mousedown', handleClickOutside); window.removeEventListener('scroll', () => {}, true); }; }, [activeFilterColumn]);

  const getUniqueValues = (key: string): string[] => { 
    const values = new Set<string>(); 
    orders.forEach(order => { 
      let val = ''; 
      if (key === 'storeName') val = getStoreName(order.storeId); 
      else if (key === 'category') val = skuMap[normalizeKey(order.sku)] || '(Chưa phân loại)'; 
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
  const handleFilterValueChange = (columnKey: string, value: string) => { 
      setColumnFilters(prev => {
          const currentFilters = (prev[columnKey] || []) as string[]; 
          const newFilters = currentFilters.includes(value) ? currentFilters.filter(v => v !== value) : [...currentFilters, value]; 
          return { ...prev, [columnKey]: newFilters };
      });
  };
  const handleClearFilter = (columnKey: string) => setColumnFilters(prev => ({ ...prev, [columnKey]: [] }));
  const handleSelectAllFilter = (columnKey: string, values: string[]) => setColumnFilters(prev => ({ ...prev, [columnKey]: values }));

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

  const stats = useMemo<{ totalOrders: number; categories: Record<string, { total: number; checked: number }>; designers: Record<string, { total: number; checked: number }>; }>(() => { 
      const result = { 
          totalOrders: 0, 
          categories: { 'Loại 1': { total: 0, checked: 0 }, 'Loại 2': { total: 0, checked: 0 }, 'Loại 3': { total: 0, checked: 0 }, 'Loại 4': { total: 0, checked: 0 }, 'Khác': { total: 0, checked: 0 } } as Record<string, { total: number; checked: number }>, 
          designers: {} as Record<string, { total: number; checked: number }> 
      }; 
      orders.forEach(o => { 
          const category = skuMap[normalizeKey(o.sku)] || 'Khác'; 
          const isChecked = o.isDesignDone === true; 
          const designerName = o.actionRole ? o.actionRole.trim() : 'Chưa Giao'; 
          let catKey = category; 
          if (!result.categories[catKey]) catKey = 'Khác'; 
          const target = result.categories[catKey]; 
          target.total += 1; 
          if (isChecked) target.checked += 1; 
          if (!result.designers[designerName]) { 
              result.designers[designerName] = { total: 0, checked: 0 }; 
          } 
          result.designers[designerName].total += 1; 
          if (isChecked) result.designers[designerName].checked += 1; 
          result.totalOrders += 1; 
      }); 
      return result; 
  }, [orders, skuMap]);

  const formatDateDisplay = (dateStr: string) => { if (!dateStr) return ''; try { const parts = dateStr.split(/[-T :]/); if (parts.length >= 5) { const y = parts[0]; const m = parts[1]; const d = parts[2]; const hh = parts[3] || '00'; const mm = parts[4] || '00'; if (y.length === 4) return `${d}/${m}/${y} ${hh}:${mm}`; } return dateStr; } catch (e) { return dateStr; } };
  const handleMonthChange = (step: number) => { const [year, month] = selectedMonth.split('-').map(Number); const date = new Date(year, month - 1 + step, 1); const newYear = date.getFullYear(); const newMonth = String(date.getMonth() + 1).padStart(2, '0'); setSelectedMonth(`${newYear}-${newMonth}`); };
  const handleUpdateSku = async (e: React.FormEvent) => { e.preventDefault(); if (!skuFormData.sku.trim()) { setSkuMessage({ type: 'error', text: 'Vui lòng nhập SKU' }); return; } setIsSubmittingSku(true); setSkuMessage(null); try { const result = await sheetService.updateSkuCategory(skuFormData.sku.trim(), skuFormData.category); if (result.success) { setSkuMessage({ type: 'success', text: 'Cập nhật phân loại thành công!' }); setSkuFormData(prev => ({ ...prev, sku: '' })); await loadData(selectedMonth); setTimeout(() => { setIsSkuModalOpen(false); setSkuMessage(null); }, 1500); } else { setSkuMessage({ type: 'error', text: result.error || 'Lỗi cập nhật.' }); } } catch (err) { setSkuMessage({ type: 'error', text: 'Lỗi kết nối hệ thống.' }); } finally { setIsSubmittingSku(false); } };
  const handleDesignerToggle = async (order: Order) => { if (!currentFileId) return; if (updatingIds.has(order.id)) return; const newValue = !order.isDesignDone; if (onProcessStart) onProcessStart(); setUpdatingIds(prev => new Set(prev).add(order.id)); try { await sheetService.updateDesignerStatus(currentFileId, order, "Designer", newValue); setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isDesignDone: newValue } : o)); } catch (error) { alert('Lỗi cập nhật trạng thái'); } finally { setUpdatingIds(prev => { const newSet = new Set(prev); newSet.delete(order.id); return newSet; }); if (onProcessEnd) onProcessEnd(); } };

  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');
  const canManageSku = user.role === 'admin' || user.permissions?.canManageSku === true; 
  const canCheckDesign = user.role === 'admin' || user.role === 'leader' || user.role === 'support' || (user.permissions?.designer !== 'none');

  const filteredOrdersList = orders.filter(o => { 
    const matchesSearch = ((o.id ? String(o.id).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.sku ? String(o.sku).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.storeId ? getStoreName(o.storeId).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.handler ? String(o.handler).toLowerCase() : '').includes(searchTerm.toLowerCase()) || (o.actionRole ? String(o.actionRole).toLowerCase() : '').includes(searchTerm.toLowerCase())); 
    if (!matchesSearch) return false; 
    
    for (const [key, val] of Object.entries(columnFilters) as [string, string[]][]) { 
        const selectedValues = val;
        if (!selectedValues || selectedValues.length === 0) continue; 
        let cellValue = ''; 
        if (key === 'storeName') cellValue = getStoreName(o.storeId); 
        else if (key === 'category') cellValue = skuMap[normalizeKey(o.sku)] || '(Chưa phân loại)'; 
        else if (key === 'isDesignDone') cellValue = o.isDesignDone ? "Đã xong" : "Chưa xong"; 
        else cellValue = String(o[key as keyof Order] || ''); 
        if (!selectedValues.includes(cellValue)) return false; 
    } 
    return true; 
  });
  const sortedOrdersResult = filteredOrdersList.map((item, index) => ({ item, index })).sort((a, b) => { if (sortConfig.key === 'date') { const dateA = new Date(a.item.date || '').getTime(); const dateB = new Date(b.item.date || '').getTime(); const validA = !isNaN(dateA); const validB = !isNaN(dateB); if (!validA && !validB) return 0; if (!validA) return 1; if (!validB) return -1; if (dateA !== dateB) { return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA; } return a.index - b.index; } const valA = String((a.item as any)[sortConfig.key] || ''); const valB = String((b.item as any)[sortConfig.key] || ''); if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }).map(x => x.item);

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
          </div>
        )}

        <div className="bg-white border-b border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-800 uppercase mb-3 flex items-center gap-2"><PenTool size={16} className="text-indigo-600"/> Tổng Hợp Tháng {currentMonthStr}/{currentYearStr}</h3>
            <div className="flex flex-col xl:flex-row gap-6">
                <div className="flex-1"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-3"><div className="bg-indigo-600 text-white rounded p-3 shadow-sm flex flex-col justify-center items-center text-center"><span className="text-xs opacity-80 uppercase tracking-wide">Tổng Đơn</span><span className="text-xl font-bold">{stats.totalOrders}</span></div>{PRICE_CATEGORIES.map(cat => { const data = (stats.categories[cat] as { total: number; checked: number } | undefined) || { total: 0, checked: 0 }; return (<div key={cat} className="bg-gray-50 border border-gray-200 rounded p-3 shadow-sm flex flex-col justify-between"><div className="flex justify-between items-start border-b border-gray-200 pb-1 mb-1"><span className="text-xs font-bold text-gray-800 uppercase">{cat}</span></div><div className="flex justify-between items-end"><div className="text-center"><div className="text-[10px] text-gray-400 uppercase">Đơn</div><div className="text-sm font-bold text-gray-800">{data.total}</div></div><div className="text-center"><div className="text-[10px] text-gray-400 uppercase">Check</div><div className="text-sm font-bold text-blue-600">{data.checked}</div></div></div></div>); })}</div></div>
                <div className="flex-1 border-l border-gray-200 xl:pl-6 pt-4 xl:pt-0 border-t xl:border-t-0 mt-2 xl:mt-0">
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-2 flex items-center gap-2"><Users size={14} /> Chi Tiết Theo Designer</h4>
                    <div className="overflow-x-auto custom-scrollbar max-h-[140px]">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-gray-50 text-gray-900 font-black sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 border-b">Designer</th>
                                    <th className="px-3 py-2 border-b text-center">Số lượng</th>
                                    <th className="px-3 py-2 border-b text-center">Đã Check</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(stats.designers).map(([name, data]: [string, { total: number; checked: number }]) => (
                                    <tr key={name} className="hover:bg-gray-50">
                                        <td className={`px-3 py-2 font-black truncate max-w-[120px] ${name.toLowerCase().includes('admin') ? 'admin-red-gradient' : 'text-slate-900'}`} title={name}>{name}</td>
                                        <td className="px-3 py-2 text-center text-gray-600">{data.total}</td>
                                        <td className="px-3 py-2 text-center font-bold text-blue-600">{data.checked}</td>
                                    </tr>
                                ))}
                                {Object.keys(stats.designers).length === 0 && (
                                    <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400 italic">Chưa có dữ liệu designer.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white z-20">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap flex items-center gap-2">DESIGNER <span className="text-orange-600 uppercase text-sm border border-orange-200 bg-orange-50 px-2 py-0.5 rounded">Tháng {currentMonthStr}/{currentYearStr}</span><button onClick={() => loadData(selectedMonth)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Làm mới"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button></h2>
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm p-1"><button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><ChevronLeft size={18} /></button><div className="flex items-center px-2 border-l border-r border-gray-100 gap-1 min-w-[160px] justify-center"><Calendar size={14} className="text-orange-500 mr-1" /><select value={currentMonthStr} onChange={(e) => setSelectedMonth(`${currentYearStr}-${e.target.value}`)} className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-center text-sm">{monthsList.map(m => (<option key={m} value={m}>Tháng {parseInt(m)}</option>))}</select><span className="text-gray-400">/</span><select value={currentYearStr} onChange={(e) => setSelectedMonth(`${e.target.value}-${currentMonthStr}`)} className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-sm">{yearsList.map(y => (<option key={y} value={y}>{y}</option>))}</select></div><button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"><ChevronRight size={18} /></button></div>
                {canManageSku && (<button onClick={() => setIsSkuModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm h-[42px] whitespace-nowrap ml-2"><Settings size={16} /> <span className="hidden sm:inline">Phân loại</span></button>)}
            </div>
          </div>
          <div className="relative flex-1 sm:flex-none sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="Tìm ID, SKU..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-[#1a4019] focus:border-transparent outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-250px)] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs relative">
            <thead className="text-white font-bold text-center uppercase text-xs tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-2 py-2 bg-[#1a4019] border-r border-gray-600 sticky top-0 z-20 w-8">
                    <input type="checkbox" className="w-3 h-3 rounded border-gray-400 text-orange-600 focus:ring-orange-500 cursor-pointer" checked={selectedOrderIds.size > 0 && selectedOrderIds.size === sortedOrdersResult.length} onChange={handleSelectAll} />
                </th>
                <th className="px-2 py-2 border-r border-gray-600 w-24 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-center gap-1 group cursor-pointer" onClick={() => setSortConfig({ key: 'date', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>)}</div></th>
                <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>ID Order</span><button onClick={(e) => handleFilterClick(e, 'id')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['id']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
                <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>STORE</span><button onClick={(e) => handleFilterClick(e, 'storeName')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['storeName']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
                <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>SKU</span><button onClick={(e) => handleFilterClick(e, 'sku')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['sku']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
                <th className="px-2 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-24 text-yellow-300"><div className="flex items-center justify-between gap-1"><span>Phân Loại</span><button onClick={(e) => handleFilterClick(e, 'category')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['category']?.length ? 'text-white' : 'text-yellow-600'}`}><Filter size={14} /></button></div></th>
                <th className="px-1 py-2 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20 w-10 text-center text-blue-300"><div className="flex flex-col items-center"><span className="mb-1">CHK</span><button onClick={(e) => handleFilterClick(e, 'isDesignDone')} className={`p-0.5 rounded hover:bg-[#235221] ${columnFilters['isDesignDone']?.length ? 'text-white' : 'text-blue-400'}`}><Filter size={12} /></button></div></th>
                <th className="px-2 py-2 border-r border-gray-600 w-32 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>Người xử lý</span><button onClick={(e) => handleFilterClick(e, 'handler')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['handler']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
                <th className="px-2 py-2 border-l border-gray-600 w-32 sticky top-0 bg-[#1a4019] z-20"><div className="flex items-center justify-between gap-1"><span>Action Role</span><button onClick={(e) => handleFilterClick(e, 'actionRole')} className={`p-1 rounded hover:bg-[#235221] ${columnFilters['actionRole']?.length ? 'text-yellow-300' : 'text-gray-300'}`}><Filter size={14} /></button></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? <tr><td colSpan={9} className="text-center py-12 text-gray-500">Đang tải dữ liệu Tháng {currentMonthStr}...</td></tr> : (sortedOrdersResult.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-gray-500">{'Không có đơn hàng nào khớp với bộ lọc.'}</td></tr> : sortedOrdersResult.map((order, idx) => {
                  const category = skuMap[normalizeKey(order.sku)] || '';
                  const isUpdating = updatingIds.has(order.id);
                  const isHandlerAdmin = (order.handler || '').toLowerCase().includes('admin');
                  const isActionAdmin = (order.actionRole || '').toLowerCase().includes('admin');
                  return (
                      <tr key={order.id + idx} className={`hover:bg-gray-50 border-b border-gray-200 text-gray-800 transition-colors ${selectedOrderIds.has(order.id) ? 'bg-indigo-50' : ''}`}>
                          <td className="px-2 py-2 border-r text-center align-middle"><input type="checkbox" className="w-3 h-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={selectedOrderIds.has(order.id)} onChange={() => handleSelectRow(order.id)} /></td>
                          <td className="px-2 py-2 border-r text-center whitespace-nowrap text-gray-600">{formatDateDisplay(order.date)}</td>
                          <td className="px-2 py-2 border-r font-semibold text-gray-900 whitespace-nowrap"><div className="flex justify-between items-center group gap-1"><span>{order.id}</span><button className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(order.id)} title="Copy ID"><Copy size={10} /></button></div></td>
                          <td className="px-2 py-2 border-r text-gray-700">{getStoreName(order.storeId)}</td>
                          <td className="px-2 py-2 border-r font-mono text-[10px] text-gray-600">{order.sku}</td>
                          <td className="px-2 py-2 border-r text-center font-medium text-indigo-600 bg-indigo-50/50">{category}</td>
                          <td className="px-1 py-1 border-r text-center align-middle bg-blue-50/30">{isUpdating ? (<div className="flex justify-center"><Loader2 size={14} className="animate-spin text-blue-500" /></div>) : (<button onClick={() => handleDesignerToggle(order)} disabled={!canCheckDesign} className={`p-1 rounded focus:outline-none transition-colors ${!canCheckDesign ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100'}`} title={canCheckDesign ? "Check hoàn thành và Lưu sheet" : "Bạn không có quyền check"}>{order.isDesignDone ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-300" />}</button>)}</td>
                          <td className={`px-2 py-2 border-r text-center text-[10px] font-black whitespace-nowrap bg-gray-50/50 ${isHandlerAdmin ? 'admin-red-gradient' : 'text-gray-800'}`}><div className="flex items-center justify-center gap-1.5"><UserCircle size={12} className={isHandlerAdmin ? 'text-red-500' : 'text-gray-400'}/>{order.handler}</div></td>
                          <td className={`px-2 py-2 border-l text-center bg-gray-50/30 font-black ${isActionAdmin ? 'admin-red-gradient' : 'text-orange-600'}`}>{order.actionRole}</td>
                      </tr>
                  );
              }))}
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
      </div>
    </div>
  );
};
