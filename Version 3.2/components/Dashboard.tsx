
import React, { useEffect, useState } from 'react';
import { ShoppingCart, DollarSign, Store as StoreIcon, Users, Plus, X, Link as LinkIcon, ExternalLink, Trash2, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, MapPin, TrendingUp, History, Eye, Zap } from 'lucide-react';
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
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // Trạng thái refresh thủ công
  const [isDebugLoading, setIsDebugLoading] = useState(false); // Trạng thái nút Test
  
  // State cho Modal thêm Store
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ name: '', url: '', region: '' });

  // State xử lý loading khi xóa
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // State cho Popup xác nhận và thông báo
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, storeId: string | null, storeName: string }>({
    isOpen: false, storeId: null, storeName: ''
  });
  const [resultModal, setResultModal] = useState<{ isOpen: boolean, type: 'success' | 'error', message: string }>({
    isOpen: false, type: 'success', message: ''
  });

  // Derived Stats cho Hiệu suất hôm nay
  const [todayGrowth, setTodayGrowth] = useState({ listing: 0, sale: 0, totalListingNow: 0, totalSaleNow: 0 });

  const loadData = async (showMainLoading = true) => {
    if (showMainLoading) setLoading(true);
    else setIsRefreshing(true);
    
    try {
      // Load song song các dữ liệu
      const [stats, storeData, historyStats] = await Promise.all([
         sheetService.getDashboardStats(),
         sheetService.getStores(),
         sheetService.getDailyStats()
      ]);

      setMetrics(stats);
      setStores(storeData);
      setDailyStats(historyStats.reverse()); // Đảo ngược để hiện ngày mới nhất lên đầu

      // --- TÍNH TOÁN HIỆU SUẤT TĂNG TRƯỞNG ---
      // 1. Tính tổng hiện tại (Real-time)
      let currentTotalListing = 0;
      let currentTotalSale = 0;
      storeData.forEach(s => {
         currentTotalListing += Number(s.listing.replace(/,/g,'')) || 0;
         currentTotalSale += Number(s.sale.replace(/,/g,'')) || 0;
      });

      // 2. Tìm mốc chốt sổ gần nhất (Hôm qua hoặc hôm nay nếu đã chốt)
      const lastRecord = historyStats.length > 0 ? historyStats[0] : null; 
      
      let growthListing = 0;
      let growthSale = 0;

      if (lastRecord) {
         growthListing = currentTotalListing - lastRecord.totalListing;
         growthSale = currentTotalSale - lastRecord.totalSale;
      } else {
         // Chưa có lịch sử -> Tăng trưởng chính là tổng hiện tại
         growthListing = currentTotalListing;
         growthSale = currentTotalSale;
      }

      setTodayGrowth({
        listing: growthListing,
        sale: growthSale,
        totalListingNow: currentTotalListing,
        totalSaleNow: currentTotalSale
      });

    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Load lần đầu
    loadData(true);

    // Thiết lập tự động refresh mỗi 2 phút (120,000 ms)
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing data...");
      loadData(false);
    }, 120000);

    // Cleanup khi unmount
    return () => clearInterval(intervalId);
  }, []);

  // Hàm xử lý khi bấm nút refresh thủ công
  const handleManualRefresh = () => {
    loadData(false);
  };

  // Hàm xử lý nút Test giả lập
  const handleDebugSnapshot = async () => {
    setIsDebugLoading(true);
    try {
        const result = await sheetService.triggerDebugSnapshot();
        if (result.success) {
            setResultModal({ 
                isOpen: true, 
                type: 'success', 
                message: 'Đã tạo dữ liệu giả thành công! Hệ thống đang tải lại...' 
            });
            // Reload data sau khi tạo giả lập
            setTimeout(() => loadData(false), 1500);
        } else {
            setResultModal({ isOpen: true, type: 'error', message: result.error || 'Lỗi khi gọi API giả lập.' });
        }
    } catch (e) {
        setResultModal({ isOpen: true, type: 'error', message: 'Lỗi kết nối hệ thống.' });
    } finally {
        setIsDebugLoading(false);
    }
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
    setConfirmModal({
      isOpen: true,
      storeId: store.id,
      storeName: store.name
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal.storeId) return;

    const idToDelete = confirmModal.storeId;
    setConfirmModal({ ...confirmModal, isOpen: false });
    setDeletingId(idToDelete);

    try {
      const result = await sheetService.deleteStore(idToDelete);
      if (result && result.success) {
        const updatedStores = stores.filter(store => store.id !== idToDelete);
        setStores(updatedStores);
        setResultModal({ isOpen: true, type: 'success', message: 'Đã xóa Store thành công!' });
      } else {
        setResultModal({ isOpen: true, type: 'error', message: result.error || "Có lỗi xảy ra khi xóa." });
        loadData(false);
      }
    } catch (error) {
      setResultModal({ isOpen: true, type: 'error', message: "Lỗi kết nối mạng hoặc lỗi hệ thống." });
    } finally {
      setDeletingId(null);
    }
  };

  const formatNumber = (val: string | number) => {
    if (!val) return '0';
    const num = Number(val);
    if (isNaN(num)) return val;
    return num.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        <p className="text-gray-500 text-sm">Đang tải dữ liệu từ Google Sheets...</p>
      </div>
    );
  }

  if (!metrics) {
      return (
          <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 flex flex-col items-center text-center">
                  <AlertTriangle className="text-yellow-500 mb-4" size={48} />
                  <h3 className="text-lg font-bold text-gray-800">Chưa kết nối Google Sheet</h3>
                  <p className="text-gray-600 mt-2 max-w-md">
                      Vui lòng Deploy Google Apps Script và dán URL Web App vào file <code>services/sheetService.ts</code> để bắt đầu sử dụng.
                  </p>
              </div>
          </div>
      )
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Doanh số tổng" 
          value={`${metrics.revenue.toLocaleString('vi-VN')} đ`}
          subValue="Tháng này"
          bgColor="bg-blue-600"
          icon={<ShoppingCart size={40} />}
        />
        <StatCard 
          title="Lợi nhuận" 
          value={`${metrics.netIncome.toLocaleString('vi-VN')} đ`}
          bgColor="bg-emerald-500"
          icon={<DollarSign size={40} />}
        />
        <StatCard 
          title="Số lượng Store" 
          value={`${stores.length}`}
          subValue="Đang hoạt động"
          bgColor="bg-indigo-600"
          icon={<StoreIcon size={40} />}
        />
        <StatCard 
          title="Nhân sự" 
          value="12"
          subValue="Listing & Sale Team"
          bgColor="bg-orange-500"
          icon={<Users size={40} />}
        />
      </div>

      {/* Main Content: Store Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <StoreIcon className="text-orange-500" size={20} />
                Quản Lý Store
                </h2>
                <button 
                    onClick={handleManualRefresh}
                    className={`p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-all ${isRefreshing ? 'animate-spin text-orange-500 bg-orange-50' : ''}`}
                    title="Làm mới dữ liệu ngay lập tức"
                >
                    <RefreshCw size={16} />
                </button>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-500">
                    {isRefreshing ? 'Đang cập nhật...' : 'Danh sách cửa hàng từ Google Sheet. Tự động cập nhật mỗi 2 phút.'}
                </p>
            </div>
          </div>
          
          {user.role === 'admin' && (
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
                <Plus size={18} />
                <span>Thêm Store Mới</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                <th className="px-6 py-4 w-1/12">ID</th>
                <th className="px-6 py-4 w-3/12">Tên Store / Link</th>
                <th className="px-6 py-4 w-2/12">Region</th>
                <th className="px-6 py-4 w-2/12 text-center">Trạng Thái</th>
                <th className="px-6 py-4 w-1/12 bg-blue-50/50 text-blue-800">Listing</th>
                <th className="px-6 py-4 w-1/12 bg-green-50/50 text-green-800">Sale</th>
                <th className="px-6 py-4 w-1/12 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {stores.map((store) => {
                  const statusText = store.status ? store.status.toUpperCase() : '';
                  const isLive = statusText === 'LIVE' || statusText === 'ACTIVE';
                  
                  return (
                    <tr 
                        key={store.id} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => onSelectStore(store)}
                    >
                      <td className="px-6 py-4 font-medium text-gray-400">{store.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800 hover:text-orange-500 transition-colors">{store.name}</div>
                        {store.url && (
                          <a href={store.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1 w-fit">
                            <LinkIcon size={10} /> {store.url.replace(/^https?:\/\//, '')} <ExternalLink size={10} />
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {store.region ? (
                            <div className="flex items-center gap-1">
                                <MapPin size={14} className="text-gray-400"/>
                                <span className="font-medium">{store.region}</span>
                            </div>
                        ) : (
                             <span className="text-gray-300 text-xs italic">---</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            isLive 
                                ? 'bg-green-100 text-green-700 border border-green-200' 
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {store.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 bg-blue-50/30 font-medium text-gray-700">
                        {formatNumber(store.listing)}
                      </td>
                      <td className="px-6 py-4 bg-green-50/30 font-medium text-gray-700">
                        {formatNumber(store.sale)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                             <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectStore(store);
                                }}
                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all"
                                title="Xem chi tiết"
                            >
                                <Eye size={16} />
                            </button>
                            {user.role === 'admin' && (
                                <button 
                                onClick={(e) => onRequestDelete(e, store)}
                                disabled={deletingId === store.id}
                                className={`relative z-10 p-2 rounded-full transition-all ${
                                    deletingId === store.id 
                                    ? 'text-red-300 cursor-not-allowed bg-red-50'
                                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                }`}
                                title="Xóa Store"
                                >
                                {deletingId === store.id ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                                ) : (
                                    <Trash2 size={16} />
                                )}
                                </button>
                            )}
                        </div>
                      </td>
                    </tr>
                );
              })}
            </tbody>
          </table>
          {stores.length === 0 && (
             <div className="p-8 text-center text-gray-500">Chưa có Store nào hoặc chưa tải được dữ liệu.</div>
          )}
        </div>
      </div>

      {/* --- PHẦN MỚI: HIỆU SUẤT TĂNG TRƯỞNG (DAILY GROWTH) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột 1: Tóm tắt hiệu suất hôm nay */}
        <div className="lg:col-span-1 space-y-4">
             <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm p-5 text-white">
                <div className="flex items-center gap-2 mb-4 opacity-90">
                    <TrendingUp size={24} />
                    <h3 className="font-bold text-lg">Hiệu Suất Hôm Nay</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <p className="text-sm opacity-80 uppercase tracking-wide">Tăng Trưởng Sale</p>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold">
                                {todayGrowth.sale > 0 ? '+' : ''}{todayGrowth.sale.toLocaleString('vi-VN')}
                            </span>
                            <span className="text-sm mb-1 opacity-80">so với hôm qua</span>
                        </div>
                    </div>
                    <div className="w-full h-px bg-white/20"></div>
                    <div>
                        <p className="text-sm opacity-80 uppercase tracking-wide">Tăng Trưởng Listing</p>
                        <div className="flex items-end gap-2">
                            <span className="text-2xl font-bold">
                                {todayGrowth.listing > 0 ? '+' : ''}{todayGrowth.listing.toLocaleString('vi-VN')}
                            </span>
                             <span className="text-sm mb-1 opacity-80">item mới</span>
                        </div>
                    </div>
                </div>
             </div>

             <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
                <h4 className="font-semibold text-gray-700 mb-2">Tổng Kết Hiện Tại</h4>
                <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Tổng Listing All Stores</span>
                    <span className="font-bold text-blue-600">{todayGrowth.totalListingNow.toLocaleString('vi-VN')}</span>
                </div>
                <div className="flex justify-between py-2">
                    <span className="text-gray-500">Tổng Sale All Stores</span>
                    <span className="font-bold text-green-600">{todayGrowth.totalSaleNow.toLocaleString('vi-VN')}</span>
                </div>
             </div>
        </div>

        {/* Cột 2 & 3: Bảng lịch sử */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                 <div className="flex items-center gap-2">
                    <History className="text-gray-500" size={20} />
                    <h3 className="font-bold text-gray-800">Lịch Sử Chốt Sổ (23h Hàng Ngày)</h3>
                 </div>
                 {user.role === 'admin' && (
                    <button 
                        onClick={handleDebugSnapshot}
                        disabled={isDebugLoading}
                        className="flex items-center gap-1.5 text-xs font-medium bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200 transition-colors border border-purple-200"
                        title="Tạo dữ liệu giả ngày hôm qua để kiểm tra tính toán tăng trưởng"
                    >
                        <Zap size={14} className={isDebugLoading ? "animate-pulse" : ""} />
                        {isDebugLoading ? "Đang tạo..." : "Test Giả Lập"}
                    </button>
                 )}
             </div>
             <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                <table className="w-full text-left">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                        <tr className="text-xs uppercase text-gray-500 font-semibold tracking-wider">
                            <th className="px-6 py-3 border-b">Ngày</th>
                            <th className="px-6 py-3 border-b text-right">Tổng Listing</th>
                            <th className="px-6 py-3 border-b text-right">Tổng Sale</th>
                            <th className="px-6 py-3 border-b text-center">Biến động ngày</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {dailyStats.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                                    Chưa có dữ liệu lịch sử. <br/>Dữ liệu sẽ được tự động ghi nhận vào 23:00 tối nay.
                                </td>
                            </tr>
                        ) : (
                            dailyStats.map((stat, index) => {
                                // Tính biến động so với ngày trước đó (trong mảng đã reverse thì là phần tử kế tiếp)
                                const prevStat = dailyStats[index + 1];
                                const diffSale = prevStat ? stat.totalSale - prevStat.totalSale : 0;
                                
                                return (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 font-medium text-gray-700">{stat.date}</td>
                                        <td className="px-6 py-3 text-right text-gray-600">{stat.totalListing.toLocaleString('vi-VN')}</td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-800">{stat.totalSale.toLocaleString('vi-VN')}</td>
                                        <td className="px-6 py-3 text-center">
                                            {prevStat ? (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${diffSale >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {diffSale >= 0 ? '+' : ''}{diffSale.toLocaleString('vi-VN')} Sale
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">---</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
             </div>
        </div>
      </div>

      {/* --- CONFIRM DELETE MODAL --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa</h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Bạn có chắc chắn muốn xóa store <span className="font-bold text-gray-800">"{confirmModal.storeName}"</span>?
                </p>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 flex flex-row-reverse gap-2">
              <button
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:w-auto sm:text-sm"
                onClick={handleConfirmDelete}
              >
                Xóa ngay
              </button>
              <button
                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RESULT MODAL --- */}
      {resultModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-6 pointer-events-none sm:p-6 sm:items-start sm:justify-end">
          <div className="max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden animate-slide-in">
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {resultModal.type === 'success' ? <CheckCircle className="h-6 w-6 text-green-400" /> : <AlertCircle className="h-6 w-6 text-red-400" />}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-900">{resultModal.type === 'success' ? 'Thành công' : 'Thất bại'}</p>
                  <p className="mt-1 text-sm text-gray-500">{resultModal.message}</p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500" onClick={() => setResultModal({ ...resultModal, isOpen: false })}>
                    <span className="sr-only">Close</span>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD STORE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Thêm Store Mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Store</label>
                <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={newStoreData.name} onChange={(e) => setNewStoreData({...newStoreData, name: e.target.value})} placeholder="Ví dụ: Giày Store HCM" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link (URL)</label>
                <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={newStoreData.url} onChange={(e) => setNewStoreData({...newStoreData, url: e.target.value})} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={newStoreData.region} onChange={(e) => setNewStoreData({...newStoreData, region: e.target.value})} placeholder="VN, US..." />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-md">Hủy</button>
              <button onClick={handleAddStore} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-md">Lưu Store</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
