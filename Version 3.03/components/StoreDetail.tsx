
import React, { useState, useEffect, useMemo } from 'react';
import { Store, StoreHistoryItem } from '../types';
import { ArrowLeft, Globe, MapPin, Activity, Package, TrendingUp, Calendar, ExternalLink, Info } from 'lucide-react';
import StatCard from './StatCard';
import { sheetService } from '../services/sheetService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StoreDetailProps {
  store: Store;
  onBack: () => void;
}

const StoreDetail: React.FC<StoreDetailProps> = ({ store, onBack }) => {
  const [history, setHistory] = useState<StoreHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Helper Parse Date an toàn (Hỗ trợ YYYY-MM-DD và DD/MM/YYYY)
  const parseSafeDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    const str = String(dateStr).trim();
    
    // 1. ISO Format YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return new Date(
            parseInt(isoMatch[1], 10), 
            parseInt(isoMatch[2], 10) - 1, 
            parseInt(isoMatch[3], 10)
        ).getTime();
    }

    // 2. VN Format DD/MM/YYYY
    const vnMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (vnMatch) {
        return new Date(
            parseInt(vnMatch[3], 10), 
            parseInt(vnMatch[2], 10) - 1, 
            parseInt(vnMatch[1], 10)
        ).getTime();
    }
    
    return 0;
  };

  useEffect(() => {
    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await sheetService.getStoreHistory(store.id);
            setHistory(data);
        } catch (error) {
            console.error("Failed to load store history", error);
        } finally {
            setLoadingHistory(false);
        }
    };
    loadHistory();
  }, [store.id]);

  // --- CALCULATE DAILY GROWTH (DELTA) ---
  const chartData = useMemo(() => {
    if (history.length === 0) return [];

    // 1. Deduplicate & Aggregate by Date
    // Lấy MAX value của từng ngày để tránh trường hợp data lỗi bị sụt giảm trong cùng 1 ngày
    const uniqueMap = new Map<string, { item: StoreHistoryItem, ts: number, saleVal: number, listVal: number }>();
    
    history.forEach(item => {
        const ts = parseSafeDate(item.date);
        if (ts === 0) return;
        
        const d = new Date(ts);
        const dateKey = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
        
        const currentSale = Number(String(item.sale).replace(/,/g, '')) || 0;
        const currentListing = Number(String(item.listing).replace(/,/g, '')) || 0;
        
        const existing = uniqueMap.get(dateKey);
        
        if (!existing) {
            uniqueMap.set(dateKey, { item, ts, saleVal: currentSale, listVal: currentListing });
        } else {
            uniqueMap.set(dateKey, { 
                item: item, 
                ts, 
                saleVal: Math.max(currentSale, existing.saleVal),
                listVal: Math.max(currentListing, existing.listVal)
            });
        }
    });

    // 2. Sort Ascending
    const sortedHistory = Array.from(uniqueMap.values()).sort((a, b) => a.ts - b.ts);

    // 3. Calculate Delta
    return sortedHistory.map((entry, index) => {
        const { item, saleVal: currentSale, listVal: currentListing } = entry;

        if (index === 0) {
            return {
                ...item,
                dailySale: 0,
                dailyListing: 0,
                totalSale: currentSale,
                totalListing: currentListing,
                originalDate: item.date
            };
        }

        const prev = sortedHistory[index - 1];
        const prevSale = prev.saleVal;
        const prevListing = prev.listVal;

        const saleGrowth = currentSale - prevSale;
        const listingGrowth = currentListing - prevListing;

        return {
            ...item,
            // Nếu tăng trưởng âm (do hoàn đơn hoặc xóa listing), hiển thị 0 trên biểu đồ cột
            dailySale: saleGrowth > 0 ? saleGrowth : 0, 
            dailyListing: listingGrowth > 0 ? listingGrowth : 0,
            // Lưu giá trị thực tế để hiển thị tooltip
            realSaleGrowth: saleGrowth,
            realListingGrowth: listingGrowth,
            totalSale: currentSale,
            totalListing: currentListing,
            originalDate: item.date
        };
    });
  }, [history]);

  const statusColor = (store.status?.toUpperCase() === 'LIVE' || store.status?.toUpperCase() === 'ACTIVE') 
    ? 'text-green-600 bg-green-100 border-green-200' 
    : 'text-gray-600 bg-gray-100 border-gray-200';

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            {store.name}
            <span className={`text-xs px-3 py-1 rounded-full border ${statusColor}`}>
              {store.status}
            </span>
          </h2>
          <p className="text-sm text-gray-500">Chi tiết hoạt động cửa hàng</p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Tổng Listing" 
          value={Number(store.listing).toLocaleString('vi-VN')}
          bgColor="bg-blue-600"
          icon={<Package size={40} />}
        />
        <StatCard 
          title="Tổng Sale" 
          value={Number(store.sale).toLocaleString('vi-VN')}
          bgColor="bg-green-600"
          icon={<TrendingUp size={40} />}
        />
        <StatCard 
          title="Tỉ lệ chuyển đổi" 
          value="1.2%"
          subValue="Ước tính"
          bgColor="bg-purple-600"
          icon={<Activity size={40} />}
        />
        <StatCard 
          title="Tuổi Store" 
          value="3 Tháng"
          bgColor="bg-orange-500"
          icon={<Calendar size={40} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Store Info Column */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700">
            Thông Tin Chung
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Hệ Thống</label>
              <p className="font-mono text-gray-800 bg-gray-100 p-2 rounded mt-1 border border-gray-200">{store.id}</p>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Liên kết Store (URL)</label>
              <a 
                href={store.url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-2 break-all"
              >
                <Globe size={16} className="mt-1 flex-shrink-0" />
                {store.url}
                <ExternalLink size={14} className="mt-1 flex-shrink-0" />
              </a>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Khu Vực (Region)</label>
              <div className="flex items-center gap-2 text-gray-800">
                <MapPin size={18} className="text-red-500" />
                <span className="font-medium">{store.region || 'Chưa xác định'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Store Performance Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col min-h-[400px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <span>Biểu Đồ Tăng Trưởng</span>
                <div className="group relative">
                    <Info size={14} className="text-gray-400 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded hidden group-hover:block z-50">
                        Biểu đồ hiển thị số lượng tăng thêm hàng ngày. Rê chuột vào cột để xem Tổng số tích lũy.
                    </div>
                </div>
            </div>
            <div className="text-xs text-gray-500 font-normal">
                {history.length > 0 ? `${history.length} ngày gần nhất` : 'Chưa có dữ liệu'}
            </div>
          </div>
          <div className="p-6 flex-1">
            {loadingHistory ? (
                <div className="h-full flex items-center justify-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        <span className="text-xs">Đang tải lịch sử...</span>
                    </div>
                </div>
            ) : chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 flex-col">
                    <Activity size={48} className="opacity-20 mb-2" />
                    <p>Chưa có dữ liệu lịch sử cho Store này.</p>
                </div>
            ) : (
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                                dataKey="originalDate" 
                                tick={{fontSize: 12, fill: '#6b7280'}} 
                                tickLine={false}
                                axisLine={{stroke: '#e5e7eb'}}
                                tickFormatter={(str) => {
                                    const ts = parseSafeDate(str);
                                    if (ts === 0) return str;
                                    const date = new Date(ts);
                                    return `${date.getDate()}/${date.getMonth() + 1}`;
                                }}
                            />
                            <YAxis 
                                yAxisId="left"
                                tick={{fontSize: 12, fill: '#6b7280'}} 
                                tickLine={false}
                                axisLine={false}
                                label={{ value: 'Listing Mới', angle: -90, position: 'insideLeft', style: { fill: '#2563eb', fontSize: 10 } }}
                            />
                            <YAxis 
                                yAxisId="right" 
                                orientation="right" 
                                tick={{fontSize: 12, fill: '#6b7280'}} 
                                tickLine={false}
                                axisLine={false}
                                label={{ value: 'Sale Mới', angle: 90, position: 'insideRight', style: { fill: '#16a34a', fontSize: 10 } }}
                            />
                            <Tooltip 
                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                                labelStyle={{fontWeight: 'bold', color: '#374151', marginBottom: '0.5rem'}}
                                cursor={{fill: '#f3f4f6'}}
                                labelFormatter={(str) => {
                                    const ts = parseSafeDate(str);
                                    if (ts === 0) return str;
                                    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts));
                                }}
                                formatter={(value: number, name: string, props: any) => {
                                    const isListing = name === 'Listing';
                                    const total = isListing ? props.payload.totalListing : props.payload.totalSale;
                                    const realGrowth = isListing ? props.payload.realListingGrowth : props.payload.realSaleGrowth;
                                    
                                    // Hiển thị context rõ ràng: Tăng trưởng + (Tổng tích lũy)
                                    let growthText = `+${value.toLocaleString('vi-VN')}`;
                                    if (realGrowth < 0) {
                                        growthText = `${realGrowth.toLocaleString('vi-VN')}`;
                                    }

                                    return [
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold">{growthText} (Mới)</span>
                                            <span className="text-gray-500 font-normal border-t border-dashed border-gray-200 pt-1 mt-1">Tổng: {total.toLocaleString('vi-VN')}</span>
                                        </div>, 
                                        name === 'Listing' ? 'Listing' : 'Sale'
                                    ];
                                }}
                            />
                            <Legend wrapperStyle={{paddingTop: '20px'}} />
                            <Bar 
                                yAxisId="right"
                                dataKey="dailySale" 
                                name="Sale" 
                                fill="#16a34a" 
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />
                            <Bar 
                                yAxisId="left"
                                dataKey="dailyListing" 
                                name="Listing" 
                                fill="#2563eb" 
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreDetail;
