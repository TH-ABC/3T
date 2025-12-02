
import React, { useState, useEffect, useMemo } from 'react';
import { Store, StoreHistoryItem } from '../types';
import { ArrowLeft, Globe, MapPin, Activity, Package, TrendingUp, Calendar, ExternalLink } from 'lucide-react';
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

    // Ensure sorted by date ascending
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sortedHistory.map((item, index) => {
        if (index === 0) {
            // Ngày đầu tiên trong lịch sử, coi như tăng trưởng = 0 để tránh cột quá cao làm lệch biểu đồ
            return {
                ...item,
                dailySale: 0,
                dailyListing: 0,
                originalDate: item.date // Keep for formatting
            };
        }

        const prev = sortedHistory[index - 1];
        const saleGrowth = item.sale - prev.sale;
        const listingGrowth = item.listing - prev.listing;

        return {
            ...item,
            dailySale: saleGrowth > 0 ? saleGrowth : 0, // Chỉ hiện số dương
            dailyListing: listingGrowth > 0 ? listingGrowth : 0,
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
        {/* Mock Data cho các chỉ số khác để giao diện đẹp hơn */}
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
            <span>Biểu Đồ Tăng Trưởng (Hàng Ngày)</span>
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
                    <p className="text-xs mt-1">Dữ liệu sẽ được tạo khi hệ thống chốt sổ (23h) hoặc bạn chạy Test Giả Lập.</p>
                </div>
            ) : (
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                                dataKey="date" 
                                tick={{fontSize: 12, fill: '#6b7280'}} 
                                tickLine={false}
                                axisLine={{stroke: '#e5e7eb'}}
                                tickFormatter={(str) => {
                                    const date = new Date(str);
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
                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                labelStyle={{fontWeight: 'bold', color: '#374151', marginBottom: '0.5rem'}}
                                cursor={{fill: '#f3f4f6'}}
                                formatter={(value: number, name: string) => [
                                    `+${value.toLocaleString('vi-VN')}`, 
                                    name === 'Listing' ? 'Listing mới' : 'Sale mới'
                                ]}
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
