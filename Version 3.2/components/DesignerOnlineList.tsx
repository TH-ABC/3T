import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Copy, ArrowUp, ArrowDown, Calendar, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { Order, Store } from '../types';

// Helper: Lấy tháng hiện tại theo giờ địa phương (YYYY-MM)
const getCurrentLocalMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const DesignerOnlineList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentLocalMonth());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  
  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const monthsList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  const getStoreName = (id: string) => {
      const store = stores.find(s => String(s.id) === String(id) || s.name === id);
      return store ? store.name : id;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [orderResult, storeData, users] = await Promise.all([
          sheetService.getOrders(selectedMonth), 
          sheetService.getStores(),
          sheetService.getUsers()
      ]);

      setStores(storeData);
      setCurrentFileId(orderResult.fileId);

      // --- LOGIC LỌC ĐƠN DESIGNER ONLINE ---
      // 1. Tìm danh sách username có role là "designer" hoặc "designer online"
      const designerUsernames = users
          .filter(u => {
              const r = (u.role || '').toLowerCase();
              return r.includes('designer');
          })
          .map(u => u.username);

      // 2. Lọc các đơn hàng có actionRole nằm trong danh sách trên
      const rawOrders = orderResult.orders || [];
      const designerOrders = rawOrders.filter(o => {
          return o.actionRole && designerUsernames.includes(o.actionRole);
      });

      setOrders(designerOrders);

    } catch (e) {
      console.error(e);
      setOrders([]);
      setCurrentFileId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedMonth]);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const [y, m, d] = dateStr.split('-');
        if (y && m && d) return `${d}/${m}/${y}`;
        return dateStr;
    } catch (e) { return dateStr; }
  };

  const handleMonthChange = (step: number) => {
    try {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + step, 1);
        const newYear = date.getFullYear();
        const newMonth = String(date.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(`${newYear}-${newMonth}`);
    } catch (e) {
        console.error("Invalid date", e);
    }
  };

  const [currentYearStr, currentMonthStr] = selectedMonth.split('-');

  // --- DERIVED STATE FOR SORTING & FILTERING ---
  const filteredOrders = orders.filter(o => 
    (o.id ? String(o.id).toLowerCase() : '').includes(searchTerm.toLowerCase()) || 
    (o.sku ? String(o.sku).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
    (o.storeId ? getStoreName(o.storeId).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
    (o.handler ? String(o.handler).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
    (o.actionRole ? String(o.actionRole).toLowerCase() : '').includes(searchTerm.toLowerCase())
  );

  const sortedOrders = filteredOrders
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (sortConfig.key === 'date') {
          const dateA = new Date(a.item.date || '').getTime();
          const dateB = new Date(b.item.date || '').getTime();
          
          const validA = !isNaN(dateA);
          const validB = !isNaN(dateB);
          if (!validA && !validB) return 0;
          if (!validA) return 1;
          if (!validB) return -1;

          if (dateA !== dateB) {
              return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
          }
          // Tie-breaker: Stable sort (Lower index first)
          return a.index - b.index;
      }
      return 0;
    })
    .map(x => x.item);

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="bg-white shadow-sm overflow-hidden rounded-lg flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white z-20">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
            <h2 className="text-xl font-bold text-gray-800 whitespace-nowrap flex items-center gap-2">
                DESIGNER ONLINE
                <button onClick={loadData} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors" title="Làm mới">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
            </h2>
            
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm p-1">
                    <button onClick={() => handleMonthChange(-1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center px-2 border-l border-r border-gray-100 gap-1 min-w-[160px] justify-center">
                        <Calendar size={14} className="text-orange-500 mr-1" />
                        <select value={currentMonthStr} onChange={(e) => setSelectedMonth(`${currentYearStr}-${e.target.value}`)} className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-center text-sm">
                            {monthsList.map(m => (<option key={m} value={m}>Tháng {parseInt(m)}</option>))}
                        </select>
                        <span className="text-gray-400">/</span>
                        <select value={currentYearStr} onChange={(e) => setSelectedMonth(`${e.target.value}-${currentMonthStr}`)} className="font-bold text-gray-700 bg-transparent cursor-pointer outline-none appearance-none hover:bg-gray-50 rounded px-1 py-1 text-sm">
                            {yearsList.map(y => (<option key={y} value={y}>{y}</option>))}
                        </select>
                    </div>
                    <button onClick={() => handleMonthChange(1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
          </div>

          <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="Tìm ID, SKU..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-[#1a4019] focus:border-transparent outline-none shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Table Container - Fixed Height for Sticky Header */}
        <div className="overflow-auto max-h-[calc(100vh-200px)] custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm relative">
            <thead className="text-white font-bold text-center uppercase text-xs tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-3 py-3 border-r border-gray-600 cursor-pointer hover:bg-[#235221] w-32 sticky top-0 bg-[#1a4019] z-20" onClick={() => setSortConfig({ key: 'date', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                    <div className="flex items-center justify-center gap-1">Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>)}</div>
                </th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20">ID Order Etsy</th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20">STORE</th>
                <th className="px-3 py-3 border-r border-gray-600 sticky top-0 bg-[#1a4019] z-20">SKU</th>
                <th className="px-3 py-3 border-r border-gray-600 w-48 sticky top-0 bg-[#1a4019] z-20">Người xử lý</th>
                <th className="px-3 py-3 border-l border-gray-600 w-48 sticky top-0 bg-[#1a4019] z-20">Action Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? 
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">Đang tải dữ liệu...</td></tr> : 
                (sortedOrders.length === 0 ? 
                    <tr><td colSpan={6} className="text-center py-12 text-gray-500">Không có đơn hàng nào được phân cho Designer Online trong tháng này.</td></tr> :
                    sortedOrders.map((order, idx) => (
                        <tr key={order.id + idx} className="hover:bg-gray-50 border-b border-gray-200 text-gray-800 transition-colors">
                            <td className="px-2 py-3 border-r text-center whitespace-nowrap text-gray-600">{formatDateDisplay(order.date)}</td>
                            <td className="px-3 py-3 border-r font-semibold text-gray-900 whitespace-nowrap">
                                <div className="flex justify-between items-center group gap-2">
                                    <span>{order.id}</span>
                                    <button className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(order.id)} title="Copy ID">
                                        <Copy size={12} />
                                    </button>
                                </div>
                            </td>
                            <td className="px-3 py-3 border-r text-gray-700">{getStoreName(order.storeId)}</td>
                            
                            <td className="px-3 py-3 border-r font-mono text-xs text-gray-600">
                                {order.sku}
                            </td>
                            
                            <td className="px-3 py-3 border-r text-center text-xs text-gray-600 font-medium whitespace-nowrap bg-gray-50/50">
                                <div className="flex items-center justify-center gap-1.5">
                                    <UserCircle size={14} className="text-gray-400"/>
                                    {order.handler}
                                </div>
                            </td>
                            
                            <td className="px-3 py-3 border-l text-center bg-gray-50/30 font-bold text-orange-600">
                                {order.actionRole}
                            </td>
                        </tr>
                    ))
                )
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DesignerOnlineList;