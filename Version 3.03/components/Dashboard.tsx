import React, { useEffect, useState } from 'react';
import { ShoppingCart, DollarSign, Store as StoreIcon, Users, Plus, X, Link as LinkIcon, ExternalLink, Trash2, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, MapPin, TrendingUp, History, Eye, Zap, CheckCircle2, AlertOctagon, UserCheck, Loader2 } from 'lucide-react';
import StatCard from './StatCard';
import { sheetService } from '../services/sheetService';
import { DashboardMetrics, Store, User, DailyStat } from '../types';

interface DashboardProps {
  user: User;
  onSelectStore: (store: Store) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onSelectStore }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDebugLoading, setIsDebugLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ name: '', url: '', region: '' });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, storeId: string | null, storeName: string }>({
    isOpen: false, storeId: null, storeName: ''
  });
  const [resultModal, setResultModal] = useState<{ isOpen: boolean, type: 'success' | 'error', message: string }>({
    isOpen: false, type: 'success', message: ''
  });

  const [todayGrowth, setTodayGrowth] = useState({ listing: 0, sale: 0, totalListingNow: 0, totalSaleNow: 0 });

  const liveCount = stores.filter(s => String(s.status || '').trim().toUpperCase() === 'LIVE').length;
  const suspendedCount = stores.filter(s => String(s.status || '').trim().toUpperCase() === 'SUSPENDED' || String(s.status || '').trim().toUpperCase() === 'DIE').length;

  const parseSafeDate = (dateStr: any): number => {
    if (!dateStr) return 0;
    const str = String(dateStr);
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d.getTime();
    return 0; 
  };

  const safeToLocaleString = (val: any) => {
    if (val === undefined || val === null) return "0";
    const n = Number(String(val).replace(/,/g, ''));
    return isNaN(n) ? "0" : n.toLocaleString('vi-VN');
  };

  const loadData = async (showMainLoading = true) => {
    if (showMainLoading) setLoading(true);
    else setIsRefreshing(true);
    try {
      const [stats, storeData, historyStats, userData] = await Promise.all([
         sheetService.getDashboardStats(),
         sheetService.getStores(),
         sheetService.getDailyStats(),
         sheetService.getUsers()
      ]);
      
      setMetrics(stats);
      setUsers(Array.isArray(userData) ? userData : []);

      // --- CHUẨN HÓA DỮ LIỆU STORE VỚI MAPPING CỘT B (Store Name) ---
      const normalizedStores: Store[] = (Array.isArray(storeData) ? storeData : []).map((s: any) => {
          const rawName = s.name || s['store name'] || s.Name || s['tên store'] || 'Không tên';
          return {
            id: s.id || s.ID || '',
            name: String(rawName), // KHÔNG ÉP VIẾT HOA TÊN STORE THEO YÊU CẦU
            url: s.url || s.URL || s['link'] || '',
            region: s.region || s.Region || '',
            status: s.status || s.Status || 'LIVE',
            listing: String(s.listing || s.Listing || '0'),
            sale: String(s.sale || s.Sale || '0')
          };
      });
      setStores(normalizedStores);

      const mappedHistory: DailyStat[] = (Array.isArray(historyStats) ? historyStats : []).map((item: any) => ({
          date: item.date,
          totalListing: Number(item.totallisting || item.totalListing || 0),
          totalSale: Number(item.totalsale || item.totalSale || 0)
      }));

      const sortedHistory = mappedHistory.sort((a, b) => parseSafeDate(b.date) - parseSafeDate(a.date));
      setDailyStats(sortedHistory);
      
      let currentTotalListing = 0;
      let currentTotalSale = 0;
      normalizedStores.forEach(s => {
         currentTotalListing += Number(String(s.listing || '0').replace(/,/g,'')) || 0;
         currentTotalSale += Number(String(s.sale || '0').replace(/,/g,'')) || 0;
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const lastClosedRecord = sortedHistory.find(h => !String(h.date).includes(todayStr)) || sortedHistory[0];

      setTodayGrowth({
        listing: lastClosedRecord ? currentTotalListing - lastClosedRecord.totalListing : 0,
        sale: lastClosedRecord ? currentTotalSale - lastClosedRecord.totalSale : 0,
        totalListingNow: currentTotalListing,
        totalSaleNow: currentTotalSale
      });

    } catch (error) { console.error("Dashboard Load Error:", error); } 
    finally { setLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const handleManualRefresh = () => loadData(false);

  const handleDebugSnapshot = async () => {
    setIsDebugLoading(true);
    try {
        const result = await sheetService.triggerDebugSnapshot();
        if (result.success) {
            setResultModal({ isOpen: true, type: 'success', message: 'Đã tạo bản ghi thống kê mới thành công!' });
            setTimeout(() => loadData(false), 1000);
        } else setResultModal({ isOpen: true, type: 'error', message: result.error || 'Lỗi API.' });
    } catch (e) { setResultModal({ isOpen: true, type: 'error', message: 'Lỗi kết nối.' }); } finally { setIsDebugLoading(false); }
  };

  const handleAddStore = async () => {
    if (!newStoreData.name) return;
    const res = await sheetService.addStore(newStoreData);
    if (res && res.success) {
        setIsModalOpen(false);
        setNewStoreData({ name: '', url: '', region: '' });
        loadData(false); 
    } else {
        alert("Lỗi khi thêm Store. Vui lòng thử lại.");
    }
  };

  const formatNumber = (val: string | number) => {
    const num = Number(String(val).replace(/,/g, ''));
    return isNaN(num) ? "0" : num.toLocaleString('vi-VN');
  };

  const formatDateFull = (dateStr: string) => {
    const ts = parseSafeDate(dateStr);
    return ts > 0 ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts)) : dateStr;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20 flex-col gap-4">
      <Loader2 className="animate-spin text-orange-500" size={48} />
      <p className="text-gray-500 font-medium">Đang tải dữ liệu Tab Quản lý...</p>
    </div>
  );

  return (
    <div className="p-6 space-y-8 animate-fade-in bg-gray-50/50 pb-20">
      {/* --- STAT CARDS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="DOANH SỐ TỔNG" value={`${safeToLocaleString(metrics?.revenue)} đ`} subValue="Tháng hiện tại" bgColor="bg-blue-600" icon={<ShoppingCart size={32} />} />
        <StatCard title="LỢI NHUẬN" value={`${safeToLocaleString(metrics?.netIncome)} đ`} subValue="Sau khi trừ chi phí" bgColor="bg-emerald-600" icon={<DollarSign size={32} />} />
        <StatCard title="TỔNG STORE" value={`${stores.length}`} subValue={<div className="flex items-center gap-2 mt-1"><span className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-50 text-[10px] font-bold uppercase">LIVE: {liveCount}</span><span className="bg-rose-500/30 px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-50 text-[10px] font-bold uppercase">DIE: {suspendedCount}</span></div>} bgColor="bg-indigo-600" icon={<StoreIcon size={32} />} />
        <StatCard title="NHÂN SỰ" value={`${users.length}`} subValue="Thành viên hệ thống" bgColor="bg-orange-600" icon={<Users size={32} />} />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
          <div>
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                <StoreIcon className="text-indigo-600" size={20} />
                Danh sách Store
                </h2>
                <button onClick={handleManualRefresh} className={`p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-all ${isRefreshing ? 'animate-spin text-indigo-500 bg-indigo-50' : ''}`} title="Làm mới dữ liệu"><RefreshCw size={16} /></button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-widest">Theo dõi hiệu suất và trạng thái của các cửa hàng</p>
          </div>
          {user.role === 'admin' && (
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95"><Plus size={18} strokeWidth={3} /><span>Thêm Store</span></button>
          )}
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-[10px] uppercase text-gray-400 font-bold tracking-widest">
                <th className="px-8 py-5 w-1/12">ID</th>
                <th className="px-8 py-5 w-3/12">Tên Store</th>
                <th className="px-8 py-5 w-2/12">Region</th>
                <th className="px-8 py-5 w-2/12 text-center">Trạng Thái</th>
                <th className="px-8 py-5 w-1/12 text-right">Listing</th>
                <th className="px-8 py-5 w-1/12 text-right text-indigo-600 font-bold">Sale</th>
                <th className="px-8 py-5 w-1/12 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-indigo-50/20 transition-all cursor-pointer group" onClick={() => onSelectStore(store)}>
                  <td className="px-8 py-5 font-mono text-gray-400 text-xs">{store.id}</td>
                  <td className="px-8 py-5">
                    <div className="font-black text-gray-900 text-sm tracking-tight">{store.name}</div>
                    {store.url && (
                      <a href={store.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-1 opacity-60 group-hover:opacity-100 transition-opacity uppercase font-bold tracking-tighter">
                        <LinkIcon size={10} /> Link cửa hàng
                      </a>
                    )}
                  </td>
                  <td className="px-8 py-5 text-gray-500 font-bold text-xs uppercase">{store.region}</td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase border-2 ${String(store.status).toUpperCase() === 'LIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{store.status}</span>
                  </td>
                  <td className="px-8 py-5 text-right font-mono font-bold text-gray-600">{formatNumber(store.listing)}</td>
                  <td className="px-8 py-5 text-right font-mono font-bold text-indigo-600 text-base">{formatNumber(store.sale)}</td>
                  <td className="px-8 py-5 text-center">
                    <button className="p-2 text-gray-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all"><Eye size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
             <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl shadow-lg p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={100} /></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-8 opacity-90"><TrendingUp size={20} /><h3 className="font-bold text-base uppercase tracking-wider">Biến động hôm nay</h3></div>
                    <div className="space-y-8">
                        <div>
                            <p className="text-[10px] opacity-70 uppercase font-black tracking-[0.2em] mb-2">Sale mới</p>
                            <div className="flex items-end gap-2"><span className="text-5xl font-black">{todayGrowth.sale > 0 ? '+' : ''}{todayGrowth.sale.toLocaleString('vi-VN')}</span></div>
                        </div>
                        <div className="w-full h-px bg-white/10"></div>
                        <div>
                            <p className="text-[10px] opacity-70 uppercase font-black tracking-[0.2em] mb-2">Listing mới</p>
                            <div className="flex items-end gap-2"><span className="text-4xl font-black">{todayGrowth.listing > 0 ? '+' : ''}{todayGrowth.listing.toLocaleString('vi-VN')}</span></div>
                        </div>
                    </div>
                </div>
             </div>
             <div className="bg-white rounded-3xl shadow-sm p-6 border border-gray-200">
                <h4 className="font-black text-gray-700 mb-5 border-b border-gray-100 pb-4 text-xs uppercase tracking-[0.2em] flex items-center gap-2"><Zap size={14} className="text-orange-500"/> Tổng kết hệ thống</h4>
                <div className="space-y-4">
                    <div className="flex justify-between items-center"><span className="text-sm text-gray-500 font-bold">Tổng Listing All</span><span className="font-mono font-black text-indigo-600 text-lg">{todayGrowth.totalListingNow.toLocaleString('vi-VN')}</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm text-gray-500 font-bold">Tổng Sale All</span><span className="font-mono font-black text-emerald-600 text-lg">{todayGrowth.totalSaleNow.toLocaleString('vi-VN')}</span></div>
                </div>
             </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                 <div className="flex items-center gap-2"><History size={20} className="text-indigo-600"/><h3 className="font-black text-gray-800 uppercase tracking-tight">Lịch sử hệ thống</h3></div>
                 {user.role === 'admin' && (
                     <button onClick={handleDebugSnapshot} disabled={isDebugLoading} className="text-[10px] bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all font-black uppercase tracking-widest shadow-md">
                        {isDebugLoading ? <Loader2 size={12} className="animate-spin" /> : "Snapshot Manual"}
                     </button>
                 )}
             </div>
             <div className="overflow-auto max-h-[480px] custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-white sticky top-0 shadow-sm z-10">
                        <tr className="text-gray-400 font-black uppercase tracking-widest text-[10px] border-b border-gray-100">
                            <th className="px-6 py-5">Ngày chốt số</th>
                            <th className="px-4 py-5 text-right">Tổng Listing</th>
                            <th className="px-4 py-5 text-center">+/- Listing</th>
                            <th className="px-4 py-5 text-right">Tổng Sale</th>
                            <th className="px-4 py-5 text-center">+/- Sale</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {dailyStats.map((stat, idx) => {
                            const prev = dailyStats[idx + 1];
                            const diffSale = prev ? stat.totalSale - prev.totalSale : 0;
                            const diffListing = prev ? stat.totalListing - prev.totalListing : 0;
                            return (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-5 font-bold text-gray-600 whitespace-nowrap">{formatDateFull(stat.date)}</td>
                                    <td className="px-4 py-5 text-right font-mono text-gray-500 font-bold">{stat.totalListing.toLocaleString('vi-VN')}</td>
                                    <td className="px-4 py-5 text-center">
                                        {prev ? <span className={`px-2 py-1 rounded-lg font-black text-[9px] border ${diffListing >= 0 ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{diffListing >= 0 ? '+' : ''}{diffListing}</span> : '---'}
                                    </td>
                                    <td className="px-4 py-5 text-right font-mono font-black text-gray-800 text-sm">{stat.totalSale.toLocaleString('vi-VN')}</td>
                                    <td className="px-4 py-5 text-center">
                                        {prev ? <span className={`px-2 py-1 rounded-lg font-black text-[9px] border ${diffSale >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{diffSale >= 0 ? '+' : ''}{diffSale}</span> : '---'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
             </div>
        </div>
      </div>

      {/* --- MODAL ADD STORE --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-gray-100">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-gray-800 text-lg flex items-center gap-2 uppercase"><StoreIcon size={20} className="text-indigo-600"/> Thêm Store Mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Tên Store (Cột B)</label><input type="text" className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-gray-50" value={newStoreData.name} onChange={(e) => setNewStoreData({...newStoreData, name: e.target.value})} placeholder="Etsy Shop A..." /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">URL (Link cửa hàng)</label><input type="text" className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-gray-50" value={newStoreData.url} onChange={(e) => setNewStoreData({...newStoreData, url: e.target.value})} placeholder="https://..." /></div>
              <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Khu Vực (Region)</label><input type="text" className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-gray-50" value={newStoreData.region} onChange={(e) => setNewStoreData({...newStoreData, region: e.target.value})} placeholder="VN, US, UK..." /></div>
            </div>
            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-gray-200 rounded-xl transition-colors">Hủy</button>
                <button onClick={handleAddStore} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95">Lưu Store</button>
            </div>
          </div>
        </div>
      )}

      {/* --- RESULT NOTIFICATION --- */}
      {resultModal.isOpen && (
        <div className="fixed bottom-10 right-10 z-[100] animate-slide-in">
          <div className={`p-6 rounded-2xl shadow-2xl border-2 flex items-center gap-5 min-w-[360px] bg-white ${resultModal.type === 'success' ? 'border-emerald-100' : 'border-rose-100'}`}>
            <div className={`p-3 rounded-xl ${resultModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {resultModal.type === 'success' ? <CheckCircle size={28} /> : <AlertCircle size={28} />}
            </div>
            <div className="flex-1">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">{resultModal.type === 'success' ? 'Thành công' : 'Thất bại'}</h4>
                <p className="text-xs text-gray-500 font-bold mt-1 leading-snug">{resultModal.message}</p>
            </div>
            <button onClick={() => setResultModal({ ...resultModal, isOpen: false })} className="p-1 text-gray-300 hover:text-gray-500 transition-colors"><X size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;