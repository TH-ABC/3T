import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Plus, Calendar, Search, Loader2, Save, X, DollarSign, Users, Tag, Calculator, FileText, FileSpreadsheet, ExternalLink, TrendingUp, TrendingDown, RefreshCcw, Layers, Globe } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { FinanceTransaction, FinanceMeta } from '../types';

export const FinanceBoard: React.FC = () => {
  const [currentYear, setCurrentYear] = useState<string>(String(new Date().getFullYear()));
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [meta, setMeta] = useState<FinanceMeta>({ categories: ['Thu Tiền', 'Chi Tiền'], subCategories: [], payers: ['Công Ty'] });
  const [loading, setLoading] = useState(true);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [usdRate, setUsdRate] = useState<number>(25450); 
  const [isRateLoading, setIsRateLoading] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddMetaOpen, setIsAddMetaOpen] = useState<{ type: 'category' | 'payer' | 'subCategory' | null, value: string }>({ type: null, value: '' });
  
  // Inline edit state
  const [editingPayerId, setEditingPayerId] = useState<string | null>(null);

  // Form Data
  const [formData, setFormData] = useState<Partial<FinanceTransaction>>({
    date: new Date().toISOString().slice(0, 16),
    category: 'Chi Tiền',
    subCategory: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    payer: 'Công Ty',
    note: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FETCH USD RATE ONLINE ---
  const fetchUsdRate = async () => {
    setIsRateLoading(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await response.json();
      if (data && data.rates && data.rates.VND) {
        setUsdRate(data.rates.VND);
      }
    } catch (e) {
      console.error("Lỗi lấy tỷ giá USD:", e);
    } finally {
      setIsRateLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setCurrentFileId(null);
    try {
      const [transResult, metaData] = await Promise.all([
        sheetService.getFinance(currentYear),
        sheetService.getFinanceMeta()
      ]);
      
      setTransactions(Array.isArray(transResult.transactions) ? transResult.transactions : []);
      setCurrentFileId(transResult.fileId);
      
      const serverPayers = metaData.payers || [];
      // Đảm bảo Công Ty luôn ở đầu mảng
      const updatedPayers = serverPayers.includes('Công Ty') 
        ? ['Công Ty', ...serverPayers.filter(p => p !== 'Công Ty')] 
        : ['Công Ty', ...serverPayers];

      setMeta({
        categories: metaData.categories && metaData.categories.length > 0 ? metaData.categories : ['Thu Tiền', 'Chi Tiền'],
        subCategories: metaData.subCategories || [],
        payers: updatedPayers
      });
      
    } catch (e) {
      console.error("Load Finance Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchUsdRate();
    loadData(); 
  }, [currentYear]);

  // --- CURRENCY CONVERTER HELPERS ---
  const formatAsUsd = (vndValue: any) => {
    if (vndValue === undefined || vndValue === null) return "$0.00";
    const numVnd = Number(String(vndValue).replace(/,/g, ''));
    if (isNaN(numVnd)) return "$0.00";
    const usdValue = numVnd / usdRate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(usdValue);
  };

  const formatAsVnd = (value: any) => {
    const num = Number(String(value).replace(/,/g, ''));
    return isNaN(num) ? "0" : num.toLocaleString('vi-VN') + " đ";
  };

  // --- SUMMARY LOGIC (TOP BOARD) ---
  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    const payerStats: Record<string, { in: number, out: number }> = {};

    payerStats['Công Ty'] = { in: 0, out: 0 };

    transactions.forEach(t => {
      const amount = Number(t.totalAmount) || 0;
      const cat = String(t.category).trim();
      const isIncome = cat === 'Thu Tiền';
      const isExpense = cat === 'Chi Tiền';

      if (isIncome) totalIn += amount;
      if (isExpense) totalOut += amount;

      const pName = t.payer || 'Công Ty';
      if (!payerStats[pName]) payerStats[pName] = { in: 0, out: 0 };
      if (isIncome) payerStats[pName].in += amount;
      if (isExpense) payerStats[pName].out += amount;
    });

    return { totalIn, totalOut, balance: totalIn - totalOut, payerStats };
  }, [transactions]);

  const handleUpdatePayer = async (id: string, newPayer: string) => {
    setEditingPayerId(null);
    const oldTransactions = [...transactions];
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, payer: newPayer } : t));
    try {
        const res = await sheetService.updateFinanceField(currentYear, id, 'Payer', newPayer);
        if (!res.success) {
            setTransactions(oldTransactions);
            alert("Lỗi cập nhật: " + res.error);
        }
    } catch (e) {
        setTransactions(oldTransactions);
    }
  };

  const handleAddMeta = async () => {
    if (!isAddMetaOpen.type || !isAddMetaOpen.value.trim()) return;
    const type = isAddMetaOpen.type;
    const value = isAddMetaOpen.value.trim();
    if (type === 'subCategory') {
        setMeta(prev => ({ ...prev, subCategories: [...prev.subCategories, value] }));
        setFormData(prev => ({ ...prev, subCategory: value }));
    } else if (type === 'payer') {
        setMeta(prev => ({ ...prev, payers: [...prev.payers, value] }));
        setFormData(prev => ({ ...prev, payer: value }));
    }
    setIsAddMetaOpen({ type: null, value: '' });
    try { await sheetService.addFinanceMeta(type, value); } catch (e) { console.error(e); }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFileId) { alert("Chưa có file lưu trữ."); return; }
    setIsSubmitting(true);
    const totalAmount = (formData.quantity || 0) * (formData.unitPrice || 0);
    const payload = {
        ...formData,
        totalAmount,
        date: formData.date ? formData.date.replace('T', ' ') : ''
    };
    try {
        const res = await sheetService.addFinance(currentYear, payload);
        if (res.success) {
            setTransactions(prev => [res.transaction, ...prev]);
            setIsAddModalOpen(false);
            setFormData(prev => ({ ...prev, subCategory: '', description: '', quantity: 1, unitPrice: 0, note: '', payer: 'Công Ty' }));
        }
    } finally { setIsSubmitting(false); }
  };

  const filteredTransactions = transactions.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.payer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col bg-gray-100 gap-6 overflow-x-hidden">
      
      {/* SUMMARY BOARD: QUY ĐỔI GIÁ TRỊ TỔNG */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between group hover:border-emerald-200 transition-all">
            <div className="flex justify-between items-start">
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><TrendingUp size={24}/></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Thu (Quy đổi)</span>
            </div>
            <div className="mt-4">
               <p className="text-2xl font-black text-slate-900 leading-none">{formatAsUsd(summary.totalIn)}</p>
               <p className="text-[10px] font-bold text-slate-400 mt-2 italic">Gốc: {formatAsVnd(summary.totalIn)}</p>
            </div>
         </div>

         <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between group hover:border-rose-200 transition-all">
            <div className="flex justify-between items-start">
               <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-inner"><TrendingDown size={24}/></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Chi (Quy đổi)</span>
            </div>
            <div className="mt-4">
               <p className="text-2xl font-black text-slate-900 leading-none">{formatAsUsd(summary.totalOut)}</p>
               <p className="text-[10px] font-bold text-slate-400 mt-2 italic">Gốc: {formatAsVnd(summary.totalOut)}</p>
            </div>
         </div>

         <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between group hover:border-indigo-200 transition-all">
            <div className="flex justify-between items-start">
               <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner"><DollarSign size={24}/></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số dư Quỹ (Quy đổi)</span>
            </div>
            <div className="mt-4">
               <p className={`text-2xl font-black leading-none ${summary.balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatAsUsd(summary.balance)}</p>
               <p className="text-[10px] font-bold text-slate-400 mt-2 italic">Gốc: {formatAsVnd(summary.balance)}</p>
            </div>
         </div>

         <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col overflow-hidden max-h-[140px]">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={12}/> Chi tiết Người chi / Công Ty</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {(Object.entries(summary.payerStats) as [string, { in: number, out: number }][]).map(([name, stats]) => (
                    <div key={name} className="flex justify-between items-center text-[11px] font-bold border-b border-slate-50 pb-1">
                        <span className={`truncate max-w-[80px] ${name === 'Công Ty' ? 'text-indigo-600 font-black' : 'text-slate-600'}`}>{name}</span>
                        <div className="flex gap-2 text-[10px]">
                            <span className="text-emerald-600">+{formatAsVnd(stats.in)}</span>
                            <span className="text-rose-600">-{formatAsVnd(stats.out)}</span>
                        </div>
                    </div>
                ))}
            </div>
         </div>
      </div>

      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3.5 bg-slate-900 text-white rounded-[1.25rem] shadow-xl"><Wallet size={26} strokeWidth={2.5} /></div>
            <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sổ Quỹ Nội Bộ</h2>
                <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-lg">
                        <Globe size={10} className="text-blue-600" />
                        <span className="text-[9px] font-black text-blue-700 uppercase">Tỷ giá: 1 USD ≈ {usdRate.toLocaleString('vi-VN')} VND</span>
                        {isRateLoading && <Loader2 size={10} className="animate-spin text-blue-600" />}
                    </div>
                </div>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2.5 shadow-inner">
                <Calendar size={16} className="text-indigo-600 mr-2" />
                <select value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} className="bg-transparent font-black text-slate-700 outline-none cursor-pointer text-sm">
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>Năm {y}</option>)}
                </select>
            </div>
            {currentFileId && (
                <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                    <Plus size={18} strokeWidth={3} /> Thêm Giao Dịch
                </button>
            )}
        </div>
      </div>

      {/* DANH SÁCH GIAO DỊCH DÙNG TIỀN VIỆT */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[500px]">
         <div className="p-5 border-b border-slate-100 flex justify-between items-center gap-4 bg-slate-50/30">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm theo nội dung, danh mục, người chi..." className="pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-full outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
         </div>

         <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm text-[10px]">
                    <tr>
                        <th className="px-6 py-5 border-b w-12 text-center">STT</th>
                        <th className="px-6 py-5 border-b w-32">Loại</th>
                        <th className="px-6 py-5 border-b w-44">Danh mục</th>
                        <th className="px-6 py-5 border-b">Nội Dung</th>
                        <th className="px-6 py-5 border-b text-right w-44 text-indigo-700">Giá Trị (VNĐ)</th>
                        <th className="px-6 py-5 border-b text-center w-44">Người Thực Hiện</th>
                        <th className="px-6 py-5 border-b w-36">Ngày</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {loading ? (
                        <tr><td colSpan={7} className="py-32 text-center font-black uppercase text-slate-300 tracking-widest animate-pulse">Đang nạp dữ liệu tài chính...</td></tr>
                    ) : filteredTransactions.length === 0 ? (
                        <tr><td colSpan={7} className="py-20 text-center text-slate-300 italic font-bold">Không có bản ghi</td></tr>
                    ) : (
                        filteredTransactions.map((t, idx) => (
                            <tr key={t.id || idx} className="hover:bg-slate-50/50 transition-all group">
                                <td className="px-6 py-5 text-center text-slate-300 font-mono text-xs">{idx + 1}</td>
                                <td className="px-6 py-5">
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border shadow-sm ${String(t.category).trim() === 'Thu Tiền' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                        {t.category}
                                    </span>
                                </td>
                                <td className="px-6 py-5">
                                    <span className="text-[11px] font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl shadow-inner border border-slate-200">
                                        {t.subCategory || '(Trống)'}
                                    </span>
                                </td>
                                <td className="px-6 py-5">
                                    <p className="text-xs font-bold text-slate-700 leading-tight truncate max-w-xs">{t.description}</p>
                                </td>
                                <td className="px-6 py-5 text-right font-black text-slate-900 text-sm">
                                    {formatAsVnd(t.totalAmount)}
                                </td>
                                <td className="px-6 py-5 text-center">
                                    {editingPayerId === t.id ? (
                                        <select 
                                            autoFocus
                                            className="text-[10px] font-black uppercase bg-white border-2 border-indigo-500 rounded-xl px-3 py-1 outline-none shadow-xl"
                                            value={t.payer}
                                            onChange={(e) => handleUpdatePayer(t.id, e.target.value)}
                                            onBlur={() => setEditingPayerId(null)}
                                        >
                                            {meta.payers.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    ) : (
                                        <button 
                                            onClick={() => setEditingPayerId(t.id)}
                                            className={`flex items-center justify-center gap-1.5 text-[10px] font-black uppercase px-4 py-1.5 rounded-full transition-all mx-auto ${t.payer === 'Công Ty' ? 'text-indigo-700 bg-indigo-50 border border-indigo-200' : 'text-slate-600 bg-slate-50 border border-slate-200'} hover:bg-indigo-600 hover:text-white`}
                                        >
                                            <Users size={10} /> {t.payer}
                                        </button>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-slate-400 text-[10px] font-bold whitespace-nowrap">{t.date.split(' ')[0]}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {/* ADD TRANSACTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/20">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter">Ghi Chép Tài Chính (VNĐ)</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-slate-900 transition-all"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSaveTransaction} className="p-10 space-y-8 overflow-y-auto max-h-[70vh]">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Loại hình giao dịch</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Thu Tiền', 'Chi Tiền'].map(cat => (
                                    <button 
                                        key={cat} type="button"
                                        onClick={() => setFormData({...formData, category: cat})}
                                        className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 ${formData.category === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Danh mục phân loại</label>
                            <div className="flex gap-2">
                                <select 
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/10"
                                    value={formData.subCategory}
                                    onChange={(e) => setFormData({...formData, subCategory: e.target.value})}
                                    required
                                >
                                    <option value="">-- Chọn danh mục --</option>
                                    {meta.subCategories.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button type="button" onClick={() => setIsAddMetaOpen({ type: 'subCategory', value: '' })} className="bg-slate-900 text-white p-3 rounded-2xl hover:bg-black transition-all"><Plus size={20}/></button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Diễn giải nội dung</label>
                        <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required placeholder="Ví dụ: Thanh toán tiền điện tháng 10..." />
                    </div>

                    <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100">
                        <div className="grid grid-cols-2 gap-8 items-end">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Số tiền giao dịch (VNĐ)</label>
                                <input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-indigo-600 outline-none" value={formData.unitPrice} onChange={(e) => setFormData({...formData, unitPrice: Number(e.target.value)})} />
                            </div>
                            <div className="text-right">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Quy đổi USD tương ứng</label>
                                <p className="text-3xl font-black text-slate-900">{formatAsUsd(formData.unitPrice)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Người chi / Người thu</label>
                            <div className="flex gap-2">
                                <select className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/10" value={formData.payer} onChange={(e) => setFormData({...formData, payer: e.target.value})} required>
                                    {meta.payers.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <button type="button" onClick={() => setIsAddMetaOpen({ type: 'payer', value: '' })} className="bg-slate-900 text-white p-3 rounded-2xl transition-all"><Plus size={20}/></button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Thời gian ghi nhận</label>
                            <input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none focus:ring-4 focus:ring-indigo-500/10" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 text-slate-400 font-black text-xs uppercase tracking-widest">Hủy bỏ</button>
                        <button type="submit" disabled={isSubmitting} className="flex-[2] py-5 bg-indigo-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all">
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Lưu vào Sổ Quỹ'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* META MODAL */}
      {isAddMetaOpen.type && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8">
                  <h4 className="font-black text-slate-900 uppercase mb-6 flex items-center gap-3 text-lg">Thêm {isAddMetaOpen.type === 'subCategory' ? 'Danh mục' : 'Người thực hiện'}</h4>
                  <div className="space-y-6">
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black outline-none" placeholder="Nhập tên mới..." value={isAddMetaOpen.value} onChange={(e) => setIsAddMetaOpen(prev => ({ ...prev, value: e.target.value }))} autoFocus />
                    <div className="flex gap-3">
                        <button onClick={() => setIsAddMetaOpen({type: null, value: ''})} className="flex-1 py-3 text-xs font-black uppercase text-slate-400">Hủy</button>
                        <button onClick={handleAddMeta} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Xác Nhận</button>
                    </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
