
import React, { useEffect, useState } from 'react';
import { ShoppingCart, DollarSign, Store as StoreIcon, Users, Plus, X, Link as LinkIcon, ExternalLink, Trash2, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, MapPin, TrendingUp, History, Eye, Zap, CheckCircle2, AlertOctagon, UserCheck } from 'lucide-react';
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, storeId: string | null, storeName: string }>({
    isOpen: false, storeId: null, storeName: ''
  });
  const [resultModal, setResultModal] = useState<{ isOpen: boolean, type: 'success' | 'error', message: string }>({
    isOpen: false, type: 'success', message: ''
  });

  const [todayGrowth, setTodayGrowth] = useState({ listing: 0, sale: 0, totalListingNow: 0, totalSaleNow: 0 });

  // --- STATS CALCULATION ---
  const liveCount = stores.filter(s => (s.status || '').trim().toUpperCase() === 'LIVE').length;
  const suspendedCount = stores.filter(s => (s.status || '').trim().toUpperCase() === 'SUSPENDED').length;

  const parseSafeDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.getTime();
    const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const year = parseInt(match[3], 10);
        const hour = match[4] ? parseInt(match[4], 10) : 0;
        const minute = match[5] ? parseInt(match[5], 10) : 0;
        const second = match[6] ? parseInt(match[6], 10) : 0;
        return new Date(year, month, day, hour, minute, second).getTime();
    }
    return 0; 
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
      setStores(storeData);
      setUsers(userData);
      const sortedHistory = [...historyStats].sort((a, b) => parseSafeDate(b.date) - parseSafeDate(a.date));
      setDailyStats(sortedHistory);
      
      let currentTotalListing = 0;
      let currentTotalSale = 0;
      storeData.forEach(s => {
         currentTotalListing += Number(String(s.listing || '0').replace(/,/g,'')) || 0;
         currentTotalSale += Number(String(s.sale || '0').replace(/,/g,'')) || 0;
      });
      const lastRecord = sortedHistory.length > 0 ? sortedHistory[0] : null; 
      setTodayGrowth({
        listing: lastRecord ? currentTotalListing - lastRecord.totalListing : currentTotalListing,
        sale: lastRecord ? currentTotalSale - lastRecord.totalSale : currentTotalSale,
        totalListingNow: currentTotalListing,
        totalSaleNow: currentTotalSale
      });
    } catch (error) { console.error(error); } finally { setLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => {
    loadData(true);
    const intervalId = setInterval(() => loadData(false), 120000);
    return () => clearInterval(intervalId);
  }, []);

  const handleManualRefresh = () => loadData(false);
  const formatDateFull = (dateStr: string) => {
      const ts = parseSafeDate(dateStr);
      return ts > 0 ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts)) : dateStr;
  };

  const handleDebugSnapshot = async () => {
    setIsDebugLoading(true);
    try {
        const result = await sheetService.triggerDebugSnapshot();
        if (result.success) {
            setResultModal({ isOpen: true, type: 'success', message: 'Đã tạo dữ liệu giả thành công! Hệ thống đang tải lại...' });
            setTimeout(() => loadData(false), 1500);
        } else setResultModal({ isOpen: true, type: 'error', message: result.error || 'Lỗi API.' });
    } catch (e) { setResultModal({ isOpen: true, type: 'error', message: 'Lỗi kết nối.' }); } finally { setIsDebugLoading(false); }
  };

  const handleAddStore = async () => {
    if (!newStoreData.name) return;
    await sheetService.addStore(newStoreData);
    setIsModalOpen(false);
    setNewStoreData({ name: '', url: '', region: '' });
    loadData(false); 
  };

  const onRequestDelete = (e: React.MouseEvent, store: Store) => {
    e.stopPropagation();
    setConfirmModal({ isOpen: true, storeId: store.id, storeName: store.name });
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal.storeId) return;
    const idToDelete = confirmModal.storeId;
    setConfirmModal({ ...confirmModal, isOpen: false });
    setDeletingId(idToDelete);
    try {
      const result = await sheetService.deleteStore(idToDelete);
      if (result && result.success) {
        setStores(stores.filter(store => store.id !== idToDelete));
        setResultModal({ isOpen: true, type: 'success', message: 'Đã xóa Store thành công!' });
      } else setResultModal({ isOpen: true, type: 'error', message: result.error || "Lỗi xóa." });
    } catch (error) { setResultModal({ isOpen: true, type: 'error', message: "Lỗi kết nối." }); } finally { setDeletingId(null); }
  };

  const formatNumber = (val: string | number) => {
    const num = Number(String(val).replace(/,/g, ''));
    return isNaN(num) ? val : num.toLocaleString('vi-VN');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full flex-col gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      <p className="text-gray-500 text-sm">Đang tải dữ liệu từ Google Sheets...</p>
    </div>
  );

  if (!metrics) return (
    <div className="p-6 text-center">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex flex-col items-center">
          <AlertTriangle className="text-yellow-500 mb-4" size={48} />
          <h3 className="text-lg font-bold text-gray-800">Chưa kết nối Google Sheet</h3>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in bg-gray-50/50">
      {/* --- TOP STATS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Doanh số tổng" 
          value={`${(metrics.revenue || 0).toLocaleString('vi-VN')} đ`}
          subValue="Tháng hiện tại"
          bgColor="bg-blue-600"
          icon={<ShoppingCart size={32} />}
        />
        <StatCard 
          title="Lợi nhuận" 
          value={`${(metrics.netIncome || 0).toLocaleString('vi-VN')} đ`}
          subValue="Sau khi trừ chi phí"
          bgColor="bg-emerald-600"
          icon={<DollarSign size={32} />}
        />
        <StatCard 
          title="Tổng Store" 
          value={`${stores.length}`}
          subValue={
            <div className="flex items-center gap-2 mt-1">
              <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-50 text-[10px] font-bold">LIVE: {liveCount}</span>
              <span className="bg-rose-500/30 px-1.5 py-0.5 rounded border border-rose-400/30 text-rose-50 text-[10px] font-bold">SUSPENDED: {suspendedCount}</span>
            </div>
          }
          bgColor="bg-indigo-600"
          icon={<StoreIcon size={32} />}
        />
        <StatCard 
          title="Nhân sự" 
          value={`${users.length}`}
          subValue="Thành viên hệ thống"
          bgColor="bg-orange-600"
          icon={<Users size={32} />}
        />
      </div>

      {/* Main Content: Store Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <StoreIcon className="text-indigo-600" size={20} />
                Danh sách Store
                </h2>
                <button 
                    onClick={handleManualRefresh}
                    className={`p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-all ${isRefreshing ? 'animate-spin text-indigo-500 bg-indigo-50' : ''}`}
                    title="Làm mới dữ liệu"
                >
                    <RefreshCw size={16} />
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Quản lý và theo dõi trạng thái Listing/Sale từng cửa hàng.</p>
          </div>
          {user.role === 'admin' && (
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95">
                <Plus size={18} /><span>Thêm Store</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-[11px] uppercase text-gray-400 font-bold tracking-wider">
                <th className="px-6 py-4 w-1/12">ID</th>
                <th className="px-6 py-4 w-3/12">Tên Store</th>
                <th className="px-6 py-4 w-2/12">Region</th>
                <th className="px-6 py-4 w-2/12 text-center">Trạng Thái</th>
                <th className="px-6 py-4 w-1/12 text-right">Listing</th>
                <th className="px-6 py-4 w-1/12 text-right">Sale</th>
                <th className="px-6 py-4 w-1/12 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stores.map((store) => {
                  const status = (store.status || '').toUpperCase().trim();
                  const isLive = status === 'LIVE';
                  const isSuspended = status === 'SUSPENDED';
                  return (
                    <tr key={store.id} className="hover:bg-indigo-50/30 transition-colors cursor-pointer group" onClick={() => onSelectStore(store)}>
                      <td className="px-6 py-4 font-mono text-gray-400 text-xs">{store.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{store.name}</div>
                        {store.url && (
                          <a href={store.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <LinkIcon size={10} /> {store.url.length > 40 ? store.url.substring(0, 40) + '...' : store.url}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{store.region}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                            isLive ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                            isSuspended ? 'bg-rose-100 text-rose-700 border-rose-200' : 
                            'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {store.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-gray-700">{formatNumber(store.listing)}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">{formatNumber(store.sale)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); onSelectStore(store); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-indigo-100 transition-all"><Eye size={16} /></button>
                            {user.role === 'admin' && (
                                <button onClick={(e) => onRequestDelete(e, store)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-100 transition-all"><Trash2 size={16} /></button>
                            )}
                        </div>
                      </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
          {stores.length === 0 && <div className="p-12 text-center text-gray-400 italic">Không tìm thấy dữ liệu cửa hàng.</div>}
        </div>
      </div>

      {/* Grid: Growth & History (Expanded without Personnel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Growth Card */}
        <div className="lg:col-span-4 space-y-4">
             <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} /></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-6 opacity-90"><TrendingUp size={20} /><h3 className="font-bold text-base uppercase tracking-wider">Biến động hôm nay</h3></div>
                    <div className="space-y-6">
                        <div>
                            <p className="text-[10px] opacity-70 uppercase font-bold tracking-[0.2em]">Sale mới</p>
                            <div className="flex items-end gap-2"><span className="text-4xl font-black">{todayGrowth.sale > 0 ? '+' : ''}{todayGrowth.sale.toLocaleString('vi-VN')}</span></div>
                        </div>
                        <div className="w-full h-px bg-white/10"></div>
                        <div>
                            <p className="text-[10px] opacity-70 uppercase font-bold tracking-[0.2em]">Listing mới</p>
                            <div className="flex items-end gap-2"><span className="text-3xl font-black">{todayGrowth.listing > 0 ? '+' : ''}{todayGrowth.listing.toLocaleString('vi-VN')}</span></div>
                        </div>
                    </div>
                </div>
             </div>
             <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                <h4 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-3 text-xs uppercase tracking-wider flex items-center gap-2"><Zap size={14} className="text-orange-500"/> Tổng kết hệ thống</h4>
                <div className="space-y-3">
                    <div className="flex justify-between items-center"><span className="text-sm text-gray-500">Tổng Listing All</span><span className="font-mono font-bold text-indigo-600">{todayGrowth.totalListingNow.toLocaleString('vi-VN')}</span></div>
                    <div className="flex justify-between items-center"><span className="text-sm text-gray-500">Tổng Sale All</span><span className="font-mono font-bold text-emerald-600">{todayGrowth.totalSaleNow.toLocaleString('vi-VN')}</span></div>
                </div>
             </div>
        </div>

        {/* History Table (Takes more space now) */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                 <div className="flex items-center gap-2"><History size={18} className="text-gray-500"/><h3 className="font-bold text-gray-800">Lịch sử hệ thống (Snapshot 23h hàng ngày)</h3></div>
                 {user.role === 'admin' && <button onClick={handleDebugSnapshot} disabled={isDebugLoading} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all font-bold">SNAPSHOT MANUAL</button>}
             </div>
             <div className="overflow-auto max-h-[460px] custom-scrollbar">
                <table className="w-full text-left text-xs">
                    <thead className="bg-white sticky top-0 shadow-sm z-10"><tr className="text-gray-400 font-bold uppercase tracking-wider text-[10px]"><th className="px-6 py-4 border-b">Ngày chốt số</th><th className="px-6 py-4 border-b text-right">Tổng Listing</th><th className="px-6 py-4 border-b text-right">Tổng Sale</th><th className="px-6 py-4 border-b text-center">Tăng trưởng Sale</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {dailyStats.map((stat, idx) => {
                            const prev = dailyStats[idx + 1];
                            const diff = prev ? stat.totalSale - prev.totalSale : 0;
                            return (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-600 whitespace-nowrap">{formatDateFull(stat.date)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-gray-500">{stat.totalListing.toLocaleString('vi-VN')}</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">{stat.totalSale.toLocaleString('vi-VN')}</td>
                                    <td className="px-6 py-4 text-center">
                                        {prev ? <span className={`px-3 py-1 rounded-md font-bold text-[10px] shadow-sm ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{diff >= 0 ? '+' : ''}{diff}</span> : '---'}
                                    </td>
                                </tr>
                            );
                        })}
                        {dailyStats.length === 0 && (
                            <tr><td colSpan={4} className="py-20 text-center text-gray-400 italic">Chưa có lịch sử snapshot.</td></tr>
                        )}
                    </tbody>
                </table>
             </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in border border-gray-100">
            <div className="p-8 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 mb-6 text-rose-600 shadow-inner"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-bold text-gray-800">Xác nhận xóa</h3>
              <p className="text-sm text-gray-500 mt-3 leading-relaxed">Bạn có chắc chắn muốn xóa vĩnh viễn Store <span className="font-bold text-gray-800 underline decoration-rose-500 decoration-2">{confirmModal.storeName}</span>? Thao tác này không thể hoàn tác.</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-3 border-t border-gray-100">
              <button className="px-6 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 active:scale-95" onClick={handleConfirmDelete}>Xóa ngay</button>
              <button className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-100 transition-all" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {resultModal.isOpen && (
        <div className="fixed bottom-8 right-8 z-50 animate-slide-in">
          <div className={`p-5 rounded-2xl shadow-2xl border flex items-center gap-4 min-w-[320px] ${resultModal.type === 'success' ? 'bg-white border-emerald-100' : 'bg-white border-rose-100'}`}>
            <div className={`p-2 rounded-full ${resultModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {resultModal.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
            </div>
            <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-800">{resultModal.type === 'success' ? 'Thành công' : 'Thất bại'}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{resultModal.message}</p>
            </div>
            <button onClick={() => setResultModal({ ...resultModal, isOpen: false })} className="p-1 rounded-lg text-gray-300 hover:text-gray-500 transition-colors"><X size={18} /></button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><StoreIcon size={20} className="text-indigo-600"/> Thêm Store Mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-5">
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Tên Store</label><input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-gray-50" value={newStoreData.name} onChange={(e) => setNewStoreData({...newStoreData, name: e.target.value})} placeholder="Ví dụ: Etsy Shop A" /></div>
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">URL (Link cửa hàng)</label><input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-gray-50" value={newStoreData.url} onChange={(e) => setNewStoreData({...newStoreData, url: e.target.value})} placeholder="https://..." /></div>
              <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Khu Vực (Region)</label><input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-gray-50" value={newStoreData.region} onChange={(e) => setNewStoreData({...newStoreData, region: e.target.value})} placeholder="VN, US, UK..." /></div>
            </div>
            <div className="px-6 py-5 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm text-gray-500 font-bold hover:bg-gray-200 rounded-lg transition-colors">Hủy</button>
                <button onClick={handleAddStore} className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">Lưu Store</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
