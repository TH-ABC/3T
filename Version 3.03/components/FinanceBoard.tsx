
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wallet, Plus, Calendar, Search, Loader2, Save, X, DollarSign, Users, Tag, Calculator, FileText, FileSpreadsheet, ExternalLink, TrendingUp, TrendingDown, RefreshCw, Layers, Globe, Store, CreditCard, Landmark, ArrowRightLeft, UserCheck, PieChart, Info, Upload, FileUp, AlertTriangle, CheckCircle, Clock, BarChart3 } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { FinanceTransaction, FinanceMeta, PaymentRecord, User, PrintwayRecord } from '../types';
import * as XLSX from 'xlsx';

interface FinanceBoardProps {
  user: User;
}

type FinanceTab = 'transactions' | 'payments' | 'printway';

export const FinanceBoard: React.FC<FinanceBoardProps> = ({ user }) => {
  // Ưu tiên năm 2026 theo thực tế dữ liệu của người dùng
  const [currentYear, setCurrentYear] = useState<string>("2026");
  const [activeTab, setActiveTab] = useState<FinanceTab>('transactions');
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [printwayRecords, setPrintwayRecords] = useState<PrintwayRecord[]>([]);
  const [meta, setMeta] = useState<FinanceMeta>({ categories: ['Thu Tiền', 'Chi Tiền'], subCategories: [], payers: ['Công Ty'] });
  const [loading, setLoading] = useState(true);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [rates, setRates] = useState<{ VND: number, AUD: number }>({ VND: 25450, AUD: 1.54 });
  const [isRateLoading, setIsRateLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isPrintwayUploadOpen, setIsPrintwayUploadOpen] = useState(false);
  const [isAddMetaOpen, setIsAddMetaOpen] = useState<{ type: 'category' | 'payer' | 'subCategory' | null, value: string }>({ type: null, value: '' });
  const [isPayerStatsOpen, setIsPayerStatsOpen] = useState(false);
  const [editingPayerId, setEditingPayerId] = useState<string | null>(null);
  const [updatingPayerId, setUpdatingPayerId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadData, setUploadData] = useState<PrintwayRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  const [paymentData, setPaymentData] = useState<Partial<PaymentRecord>>({
    storeName: '',
    amount: 0,
    region: 'Us',
    date: new Date().toISOString().split('T')[0]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = user.role.toLowerCase() === 'admin';
  const canViewSummary = isAdmin || user.permissions?.canViewFinanceSummary === true;
  const financeScope = user.permissions?.finance || 'all';

  // Helper kiểm tra quyền truy cập tab
  const hasAccess = (tab: FinanceTab) => {
      if (isAdmin || financeScope === 'all') return true;
      const allowed = financeScope.split(',');
      if (tab === 'transactions') return allowed.includes('funds');
      if (tab === 'payments') return allowed.includes('payment');
      if (tab === 'printway') return allowed.includes('printway');
      return false;
  };

  const formatPrintwayDate = (dateInput: any) => {
    if (!dateInput) return '---';
    try {
      let date: Date;
      if (dateInput instanceof Date) {
        date = dateInput;
      } else {
        const str = String(dateInput).trim();
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
            return str;
        }
        date = new Date(str.replace(' ', 'T'));
      }
      if (isNaN(date.getTime())) return String(dateInput);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    } catch (e) {
      return String(dateInput);
    }
  };

  useEffect(() => {
    // Thiết lập tab mặc định dựa trên phân quyền đầu tiên tìm thấy
    if (hasAccess('transactions')) setActiveTab('transactions');
    else if (hasAccess('payments')) setActiveTab('payments');
    else if (hasAccess('printway')) setActiveTab('printway');
  }, [financeScope]);

  const fetchOnlineRates = async () => {
    setIsRateLoading(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await response.json();
      if (data && data.rates) {
        setRates({ VND: data.rates.VND || 25450, AUD: data.rates.AUD || 1.54 });
      }
    } catch (e) { console.error(e); } finally { setIsRateLoading(false); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [transResult, metaData] = await Promise.all([
        sheetService.getFinance(currentYear),
        sheetService.getFinanceMeta()
      ]);
      setTransactions(Array.isArray(transResult.transactions) ? transResult.transactions : []);
      setPayments(Array.isArray(transResult.payments) ? transResult.payments : []);
      setPrintwayRecords(Array.isArray(transResult.printway) ? transResult.printway : []);
      setCurrentFileId(transResult.fileId);
      setMeta({
        categories: metaData.categories || ['Thu Tiền', 'Chi Tiền'],
        subCategories: metaData.subCategories || [],
        payers: metaData.payers || ['Công Ty']
      });
    } catch (e) { console.error("Load Finance Error:", e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchOnlineRates();
    loadData(); 
  }, [currentYear]);

  const formatAsUsd = (vndValue: any) => {
    const numVnd = Number(String(vndValue).replace(/,/g, ''));
    if (isNaN(numVnd)) return "$0.00";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numVnd / rates.VND);
  };

  const formatAsVnd = (value: any) => {
    const num = Number(String(value).replace(/,/g, ''));
    return isNaN(num) ? "0" : num.toLocaleString('vi-VN') + " đ";
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const latestPrintwayDate = useMemo(() => {
    if (!printwayRecords || printwayRecords.length === 0) return null;
    const sorted = [...printwayRecords].sort((a, b) => {
        return new Date(b.date.replace(' ', 'T')).getTime() - new Date(a.date.replace(' ', 'T')).getTime();
    });
    return sorted[0].date;
  }, [printwayRecords]);

  // LOGIC TỔNG HỢP TÀI CHÍNH
  const summary = useMemo(() => {
    let transInVnd = 0, transOutVnd = 0;
    const payerMap: Record<string, { in: number, out: number }> = {};
    
    transactions.forEach(t => {
      const amount = Number(t.totalAmount) || 0;
      const pName = t.payer || 'Công Ty';
      if (!payerMap[pName]) payerMap[pName] = { in: 0, out: 0 };
      if (t.category === 'Thu Tiền') { 
        transInVnd += amount; 
        payerMap[pName].in += amount; 
      }
      if (t.category === 'Chi Tiền') { 
        transOutVnd += amount; 
        payerMap[pName].out += amount; 
      }
    });

    let paymentTotalUsd = 0;
    payments.forEach(p => { paymentTotalUsd += (Number(p.convertedUsd) || 0); });

    let printwayOutUsd = 0;
    printwayRecords.forEach(pw => {
      const amt = Number(pw.totalAmount) || 0;
      const typeLower = (pw.type || '').toLowerCase();
      const loaiLower = (pw.loai || '').toLowerCase();
      if (loaiLower === 'chi tiền' || typeLower === 'payment') {
        printwayOutUsd += amt;
      }
    });

    const totalIncomeUsd = (transInVnd / rates.VND) + paymentTotalUsd;
    const totalExpenseUsd = (transOutVnd / rates.VND) + printwayOutUsd;

    return { 
      totalIncomeUsd, totalExpenseUsd, balanceUsd: totalIncomeUsd - totalExpenseUsd,
      paymentTotalUsd, payerStats: Object.entries(payerMap).sort((a, b) => b[1].out - a[1].out)
    };
  }, [transactions, payments, printwayRecords, rates]);

  const handlePayerChange = async (transId: string, newValue: string) => {
    const oldPayer = transactions.find(t => t.id === transId)?.payer;
    if (oldPayer === newValue) {
      setEditingPayerId(null);
      return;
    }
    
    setEditingPayerId(null);
    setUpdatingPayerId(transId);
    try {
      const res = await sheetService.updateFinanceField(currentYear, transId, 'Payer', newValue);
      if (res.success) {
        setTransactions(prev => prev.map(t => t.id === transId ? { ...t, payer: newValue } : t));
      } else {
        alert("Lỗi cập nhật người chi: " + (res.error || ""));
      }
    } catch (e) {
      alert("Lỗi kết nối máy chủ");
    } finally {
      setUpdatingPayerId(null);
    }
  };

  const processFile = (file: File) => {
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    const reader = new FileReader();
    const existingIds = new Set(printwayRecords.map(r => String(r.invoiceId).trim()));

    reader.onload = (event) => {
      let rawParsed: PrintwayRecord[] = [];
      if (isExcel) {
        const binaryData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binaryData, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        for (let i = 1; i < jsonData.length; i++) {
          const cols = jsonData[i];
          if (!cols || cols.length < 5 || !cols[0]) continue;
          const typeRaw = String(cols[1] || '').trim();
          const amountValue = Number(cols[5]) || 0; 
          const loaiMapped = typeRaw.toLowerCase() === 'payment' ? 'Chi Tiền' : typeRaw;
          rawParsed.push({
            invoiceId: String(cols[0]).trim(),
            type: typeRaw,
            status: String(cols[2] || '').trim(),
            date: formatPrintwayDate(cols[3]),
            method: String(cols[4] || '').trim(),
            amountUsd: amountValue,
            fee: Number(cols[6]) || 0,
            totalAmount: amountValue,
            note: String(cols[8] || '').trim(),
            loai: loaiMapped
          });
        }
      } else {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split('\t');
          if (cols.length < 5 || !cols[0]) continue;
          const typeRaw = cols[1]?.trim() || '';
          const amountValue = Number(cols[5]) || 0;
          const loaiMapped = typeRaw.toLowerCase() === 'payment' ? 'Chi Tiền' : typeRaw;
          rawParsed.push({
            invoiceId: cols[0].trim(),
            type: typeRaw,
            status: cols[2]?.trim() || '',
            date: formatPrintwayDate(cols[3]),
            method: cols[4]?.trim() || '',
            amountUsd: amountValue,
            fee: Number(cols[6]) || 0,
            totalAmount: amountValue,
            note: cols[8]?.trim() || '',
            loai: loaiMapped
          });
        }
      }
      setUploadData(rawParsed.filter(item => item.invoiceId && !existingIds.has(item.invoiceId)));
    };
    if (isExcel) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  };

  const handleUploadPrintway = async () => {
    if (uploadData.length === 0 || !currentFileId) return;
    setIsUploading(true);
    try {
      const res = await sheetService.addPrintwayBatch(currentYear, uploadData);
      if (res.success) {
        setIsPrintwayUploadOpen(false); setUploadData([]); loadData();
        alert(`Đã tải thành công ${uploadData.length} dòng dữ liệu.`);
      }
    } finally { setIsUploading(false); }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFileId) return;
    setIsSubmitting(true);
    const totalAmount = (formData.quantity || 0) * (formData.unitPrice || 0);
    try {
      const res = await sheetService.addFinance(currentYear, { ...formData, totalAmount, date: formData.date?.replace('T', ' ') });
      if (res.success) {
        setTransactions(prev => [res.transaction, ...prev]);
        setIsAddModalOpen(false);
        setFormData({ ...formData, description: '', unitPrice: 0 });
      } else {
        alert("Lỗi ghi quỹ: " + (res.error || "Vui lòng kiểm tra lại thông tin."));
      }
    } catch (err) {
      alert("Lỗi kết nối. Vui lòng thử lại.");
    } finally { setIsSubmitting(false); }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFileId) return;
    setIsSubmitting(true);
    let converted = Number(paymentData.amount) || 0;
    if (paymentData.region === 'Au') converted = converted / rates.AUD;
    else if (paymentData.region === 'VN') converted = converted / rates.VND;
    try {
      const res = await sheetService.addPayment(currentYear, { ...paymentData, convertedUsd: converted });
      if (res.success) {
        setPayments(prev => [res.payment, ...prev]);
        setIsAddPaymentOpen(false);
        setPaymentData({ storeName: '', amount: 0, region: 'Us', date: new Date().toISOString().split('T')[0] });
      } else {
        alert("Lỗi nhập payment: " + (res.error || "Vui lòng nhập lại."));
      }
    } catch (err) {
      alert("Lỗi kết nối.");
    } finally { setIsSubmitting(false); }
  };

  const handleAddMeta = async (type: 'category' | 'payer' | 'subCategory', value: string) => {
      if (!value.trim()) return;
      setIsSubmitting(true);
      try {
          const res = await sheetService.addFinanceMeta(type, value);
          if (res.success) {
              setMeta(prev => ({ ...prev, [type === 'payer' ? 'payers' : 'subCategories']: [...new Set([...(prev[type === 'payer' ? 'payers' : 'subCategories'] as string[]), value])] }));
              setIsAddMetaOpen({ type: null, value: '' });
          }
      } finally { setIsSubmitting(false); }
  };

  const filteredTransactions = transactions.filter(t => 
    (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.subCategory || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.payer || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayments = payments.filter(p => (p.storeName || '').toLowerCase().includes(searchTerm.toLowerCase()));
  
  const filteredPrintway = printwayRecords.filter(pw => 
    (pw.invoiceId || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (pw.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (pw.type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col bg-gray-100 gap-6 overflow-x-hidden pb-20 font-sans text-gray-800">
      
      {/* DASHBOARD STATS */}
      {canViewSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-emerald-200 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner"><TrendingUp size={24}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tổng Thu Hệ Thống<br/><span className="text-[8px]">(Không tính Printway)</span></span>
                </div>
                <div className="mt-4">
                    <p className="text-2xl font-black text-emerald-600 leading-none">{formatCurrency(summary.totalIncomeUsd)}</p>
                </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-rose-200 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-inner"><TrendingDown size={24}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng Chi (USD)</span>
                </div>
                <div className="mt-4"><p className="text-2xl font-black text-rose-600 leading-none">{formatCurrency(summary.totalExpenseUsd)}</p></div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-indigo-200 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner"><DollarSign size={24}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dư Quỹ (USD)</span>
                </div>
                <div className="mt-4"><p className={`text-2xl font-black leading-none ${summary.balanceUsd >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(summary.balanceUsd)}</p></div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-amber-200 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-inner"><CreditCard size={24}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Store Paid</span>
                </div>
                <div className="mt-4"><p className="text-2xl font-black text-amber-600 leading-none">{formatCurrency(summary.paymentTotalUsd)}</p></div>
            </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4 text-slate-400 shadow-sm"><Info size={20} /><span className="text-xs font-black uppercase tracking-widest">Bảng tóm tắt tài chính đang được khóa</span></div>
      )}

      {/* NAVIGATION */}
      <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 w-full md:w-auto">
          {[
            { id: 'transactions', label: 'Sổ Quỹ', icon: <Wallet size={16}/> },
            { id: 'payments', label: 'Payment', icon: <Landmark size={16}/> },
            { id: 'printway', label: 'Printway', icon: <FileSpreadsheet size={16}/> }
          ].filter(t => hasAccess(t.id as FinanceTab)).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as FinanceTab)} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 px-2 w-full md:w-auto">
            {activeTab === 'transactions' && (
              <button onClick={() => setIsPayerStatsOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-all active:scale-95 shadow-sm">
                <BarChart3 size={16} /> Thống kê người chi
              </button>
            )}
            {activeTab === 'printway' && latestPrintwayDate && (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700">
                    <Clock size={14} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase">Dữ liệu mới nhất: <span className="font-mono text-[11px]">{latestPrintwayDate}</span></span>
                </div>
            )}
            <button onClick={() => {
              if (activeTab === 'transactions') setIsAddModalOpen(true);
              else if (activeTab === 'payments') setIsAddPaymentOpen(true);
              else setIsPrintwayUploadOpen(true);
            }} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all text-white ${activeTab === 'printway' ? 'bg-emerald-600 hover:bg-emerald-700' : activeTab === 'payments' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              <Plus size={18} /> {activeTab === 'printway' ? 'Tải lên Printway' : activeTab === 'payments' ? 'Nhập Payment' : 'Ghi Quỹ'}
            </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[500px]">
         <div className="p-5 border-b border-slate-100 flex justify-between items-center gap-4 bg-slate-50/30">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm kiếm..." className="pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-full outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
         </div>

         <div className="flex-1 overflow-auto custom-scrollbar">
            {activeTab === 'printway' ? (
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm text-[10px]">
                        <tr>
                            <th className="px-6 py-5 border-b w-12 text-center">STT</th>
                            <th className="px-6 py-5 border-b">Invoice ID</th>
                            <th className="px-6 py-5 border-b">Type</th>
                            <th className="px-6 py-5 border-b">Loại thu/chi</th>
                            <th className="px-6 py-5 border-b text-right font-black text-emerald-600">Total (USD)</th>
                            <th className="px-6 py-5 border-b text-center">Method</th>
                            <th className="px-6 py-5 border-b">Ngày giao dịch</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? <tr><td colSpan={7} className="py-32 text-center text-slate-300 animate-pulse">Đang tải dữ liệu...</td></tr> : filteredPrintway.length === 0 ? <tr><td colSpan={7} className="py-20 text-center text-slate-300 italic">Trống</td></tr> : filteredPrintway.map((pw, idx) => {
                            const isExpense = (pw.loai || '').toLowerCase().includes('chi') || (pw.type || '').toLowerCase() === 'payment';
                            const isNotCounted = !isExpense; 
                            
                            return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-5 text-center text-slate-300 font-mono text-xs">{idx + 1}</td>
                                    <td className="px-6 py-5 font-bold text-slate-700">{pw.invoiceId}</td>
                                    <td className="px-6 py-5 text-[10px] font-bold text-slate-500 uppercase">{pw.type}</td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${isExpense ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                              {pw.loai || pw.type}
                                          </span>
                                          {isNotCounted && (
                                            <span className="text-[8px] text-slate-400 font-bold italic">(Chỉ hiển thị)</span>
                                          )}
                                        </div>
                                    </td>
                                    <td className={`px-6 py-5 text-right font-black text-base ${isExpense ? 'text-rose-600' : 'text-slate-400'}`}>
                                        {formatCurrency(pw.totalAmount)}
                                    </td>
                                    <td className="px-6 py-5 text-center text-[10px] font-black uppercase text-slate-400 bg-slate-50 rounded-lg">{pw.method}</td>
                                    <td className="px-6 py-5 text-slate-400 font-mono text-[10px] font-bold">{pw.date}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : activeTab === 'payments' ? (
              <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm text-[10px]">
                      <tr>
                          <th className="px-6 py-5 border-b w-12 text-center">STT</th>
                          <th className="px-6 py-5 border-b">Tên Store</th>
                          <th className="px-6 py-5 border-b text-center">Vùng</th>
                          <th className="px-6 py-5 border-b text-right">Số tiền nhập</th>
                          <th className="px-6 py-5 border-b text-right text-orange-600 font-black">Quy đổi USD</th>
                          <th className="px-6 py-5 border-b text-center">Ngày nhận</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {loading ? <tr><td colSpan={6} className="py-32 text-center text-slate-300 animate-pulse">Đang tải...</td></tr> : filteredPayments.length === 0 ? <tr><td colSpan={6} className="py-20 text-center text-slate-300 italic font-bold">Chưa có dữ liệu thanh toán nào được ghi nhận.</td></tr> : filteredPayments.map((p, idx) => (
                          <tr key={p.id || idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-5 text-center text-slate-300 font-mono text-xs">{idx + 1}</td>
                              <td className="px-6 py-5 font-black text-slate-800 uppercase tracking-tight">{p.storeName}</td>
                              <td className="px-6 py-5 text-center"><span className={`px-4 py-1 rounded-xl text-[10px] font-black uppercase border ${p.region === 'Us' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>{p.region}</span></td>
                              <td className="px-6 py-5 text-right font-bold text-slate-500">{p.amount.toLocaleString()} {p.region === 'VN' ? 'đ' : p.region}</td>
                              <td className="px-6 py-5 text-right font-black text-orange-600 text-base">{formatCurrency(p.convertedUsd)}</td>
                              <td className="px-6 py-5 text-center text-slate-400 text-[10px] font-bold">{p.date}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            ) : activeTab === 'transactions' ? (
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm text-[10px]">
                        <tr>
                            <th className="px-6 py-5 border-b w-12 text-center">STT</th>
                            <th className="px-6 py-5 border-b w-32">Loại</th>
                            <th className="px-6 py-5 border-b">Nội Dung</th>
                            <th className="px-6 py-5 border-b text-right">Giá Trị (VNĐ)</th>
                            <th className="px-6 py-5 border-b text-right text-indigo-500">USD</th>
                            <th className="px-6 py-5 border-b text-center">Người chi</th>
                            <th className="px-6 py-5 border-b">Ngày</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? <tr><td colSpan={7} className="py-32 text-center">Đang tải...</td></tr> : filteredTransactions.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-6 py-5 text-center text-slate-300 font-mono text-xs">{idx + 1}</td>
                                <td className="px-6 py-5"><span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${t.category === 'Thu Tiền' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{t.category}</span></td>
                                <td className="px-6 py-5 font-bold text-slate-700">{t.description}</td>
                                <td className="px-6 py-5 text-right font-black">{formatAsVnd(t.totalAmount)}</td>
                                <td className="px-6 py-5 text-right font-black text-indigo-600">{formatAsUsd(t.totalAmount)}</td>
                                <td className="px-6 py-5 text-center">
                                    {updatingPayerId === t.id ? (
                                        <div className="flex justify-center items-center py-1">
                                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                                        </div>
                                    ) : editingPayerId === t.id ? (
                                        <select 
                                            autoFocus
                                            onBlur={() => setEditingPayerId(null)}
                                            onChange={(e) => handlePayerChange(t.id, e.target.value)}
                                            className="bg-white border border-indigo-300 rounded px-2 py-1 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500/20 w-full"
                                            value={t.payer}
                                        >
                                            {meta.payers.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    ) : (
                                        <span 
                                            onClick={() => setEditingPayerId(t.id)}
                                            className="cursor-pointer hover:bg-indigo-50 px-3 py-1 rounded-lg transition-colors font-black uppercase text-[10px] text-slate-500 border border-transparent hover:border-indigo-100 whitespace-nowrap block text-center"
                                            title="Bấm để đổi người chi"
                                        >
                                            {t.payer}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-slate-400 text-[10px] font-bold">{t.date.split(' ')[0]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : null}
         </div>
      </div>

      {/* MODAL PRINTWAY UPLOAD */}
      {isPrintwayUploadOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isUploading && setIsPrintwayUploadOpen(false)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden relative flex flex-col border border-white/20">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-100"><FileUp size={24}/></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải dữ liệu Printway</h3>
                 </div>
                 <button onClick={() => setIsPrintwayUploadOpen(false)} disabled={isUploading} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm"><X size={20}/></button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                {uploadData.length === 0 ? (
                  <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }} className={`py-20 flex flex-col items-center justify-center border-4 border-dashed rounded-[3rem] transition-all cursor-pointer ${isDragging ? 'bg-emerald-100 border-emerald-500' : 'bg-slate-50/50 border-slate-100'}`} onClick={() => fileInputRef.current?.click()}>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
                    <Upload size={40} className="text-slate-200 mb-6"/>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Kéo thả file Printway để xử lý</p>
                    <p className="text-[10px] text-slate-300 font-bold mt-2 italic">(Tự động lọc trùng ID và phân loại 'payment' là Chi Tiền)</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                       <span className="text-sm font-black text-emerald-700 uppercase">Hệ thống đã sẵn sàng nạp {uploadData.length} dòng dữ liệu mới.</span>
                       <button onClick={() => setUploadData([])} className="text-rose-600 text-[10px] font-black uppercase underline">Hủy</button>
                    </div>
                    <table className="w-full text-left text-[10px]">
                        <thead><tr className="text-slate-400 font-black uppercase"><th>ID</th><th>Type</th><th>Ngày</th><th>Phân loại</th><th className="text-right">Total (USD)</th></tr></thead>
                        <tbody>{uploadData.slice(0, 10).map((r, i) => (
                            <tr key={i}>
                              <td className="py-2">{r.invoiceId}</td>
                              <td>{r.type}</td>
                              <td>{r.date}</td>
                              <td><span className={`px-2 py-0.5 rounded font-black uppercase ${r.loai === 'Chi Tiền' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{r.loai}</span></td>
                              <td className="text-right font-black text-slate-800">${r.totalAmount.toFixed(2)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                 <button onClick={handleUploadPrintway} disabled={isUploading || uploadData.length === 0} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl flex items-center gap-2">
                    {isUploading ? <Loader2 size={16} className="animate-spin"/> : 'Xác nhận Lưu dữ liệu'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL PAYER STATISTICS --- */}
      {isPayerStatsOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsPayerStatsOpen(false)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden relative animate-slide-in flex flex-col border border-white/20">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-100"><BarChart3 size={24}/></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thống kê theo người chi</h3>
                 </div>
                 <button onClick={() => setIsPayerStatsOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm"><X size={20}/></button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                            <tr>
                                <th className="px-4 py-3 rounded-l-xl">Cá nhân / Đơn vị</th>
                                <th className="px-4 py-3 text-right">Tổng Thu (VNĐ)</th>
                                <th className="px-4 py-3 text-right">Tổng Chi (VNĐ)</th>
                                <th className="px-4 py-3 text-right rounded-r-xl">Số dư</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {summary.payerStats.map(([name, stats]) => (
                                <tr key={name} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-4 font-black text-slate-700">{name}</td>
                                    <td className="px-4 py-4 text-right font-bold text-emerald-600">{stats.in.toLocaleString('vi-VN')} đ</td>
                                    <td className="px-4 py-4 text-right font-bold text-rose-600">{stats.out.toLocaleString('vi-VN')} đ</td>
                                    <td className={`px-4 py-4 text-right font-black ${stats.in - stats.out >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        {(stats.in - stats.out).toLocaleString('vi-VN')} đ
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 text-center">
                 <button onClick={() => setIsPayerStatsOpen(false)} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl active:scale-95 transition-all">Đóng thống kê</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL ADD TRANSACTION --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/20">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter">Ghi Chép Sổ Quỹ</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-slate-900 transition-all"><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveTransaction} className="p-10 space-y-8 overflow-y-auto max-h-[70vh]">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Loại giao dịch</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Thu Tiền', 'Chi Tiền'].map(cat => (
                                    <button key={cat} type="button" onClick={() => setFormData({...formData, category: cat})} className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 ${formData.category === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>{cat}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Phân loại</label>
                            <div className="flex gap-2">
                                <select className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" value={formData.subCategory} onChange={(e) => setFormData({...formData, subCategory: e.target.value})} required>
                                    <option value="">-- Chọn --</option>
                                    {meta.subCategories.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button type="button" onClick={() => setIsAddMetaOpen({ type: 'subCategory', value: '' })} className="bg-slate-900 text-white p-3 rounded-2xl hover:bg-black transition-all"><Plus size={20}/></button>
                            </div>
                        </div>
                    </div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nội dung chi tiết</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required /></div>
                    <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100">
                        <div className="grid grid-cols-2 gap-8 items-end">
                            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Số tiền (VNĐ)</label><input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-indigo-600 outline-none" value={formData.unitPrice} onChange={(e) => setFormData({...formData, unitPrice: Number(e.target.value)})} /></div>
                            <div className="text-right"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Quy đổi tương đương</label><p className="text-3xl font-black text-slate-900">{formatAsUsd(formData.unitPrice)}</p></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Người thực hiện</label><div className="flex gap-2"><select className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" value={formData.payer} onChange={(e) => setFormData({...formData, payer: e.target.value})} required>{meta.payers.map(p => <option key={p} value={p}>{p}</option>)}</select><button type="button" onClick={() => setIsAddMetaOpen({ type: 'payer', value: '' })} className="bg-slate-900 text-white p-3 rounded-2xl transition-all"><Plus size={20}/></button></div></div>
                        <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Thời gian</label><input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
                    </div>
                    <div className="pt-4 flex gap-4"><button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-900 transition-colors">Hủy bỏ</button><button type="submit" disabled={isSubmitting} className="flex-[2] py-5 bg-indigo-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95">{isSubmitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Xác nhận ghi quỹ'}</button></div>
                </form>
            </div>
        </div>
      )}

      {/* --- MODAL ADD PAYMENT --- */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
                    <h3 className="font-black text-orange-900 text-2xl uppercase tracking-tighter flex items-center gap-3"><Landmark size={28}/> Nhập Tiền Store</h3>
                    <button onClick={() => setIsAddPaymentOpen(false)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900"><X size={20} /></button>
                </div>
                <form onSubmit={handleSavePayment} className="p-10 space-y-6">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tên Store</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black outline-none" value={paymentData.storeName} onChange={(e) => setPaymentData({...paymentData, storeName: e.target.value})} placeholder="Shop name..." required /></div>
                    <div className="grid grid-cols-2 gap-6">
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Vùng</label><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black outline-none" value={paymentData.region} onChange={(e) => setPaymentData({...paymentData, region: e.target.value as any})} required><option value="Au">Au</option><option value="Us">Us</option><option value="VN">VN</option></select></div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Ngày nhận</label><input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black outline-none" value={paymentData.date} onChange={(e) => setPaymentData({...paymentData, date: e.target.value})} required /></div>
                    </div>
                    <div className="bg-orange-50 p-8 rounded-[2rem] border border-orange-100">
                        <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2 block">Số tiền ({paymentData.region})</label>
                        <div className="relative"><input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-2xl font-black text-orange-600 outline-none pr-12" value={paymentData.amount} onChange={(e) => setPaymentData({...paymentData, amount: Number(e.target.value)})} required /><span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">{paymentData.region === 'VN' ? 'đ' : '$'}</span></div>
                    </div>
                    <div className="pt-4 flex gap-4"><button type="button" onClick={() => setIsAddPaymentOpen(false)} className="flex-1 py-5 text-slate-400 font-black text-xs uppercase tracking-widest">Hủy</button><button type="submit" disabled={isSubmitting} className="flex-[2] py-5 bg-orange-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-orange-100">{isSubmitting ? <Loader2 className="animate-spin mx-auto" size={18}/> : 'Xác nhận nhập tiền'}</button></div>
                </form>
            </div>
        </div>
      )}

      {/* --- MODAL ADD META (Category/Payer) --- */}
      {isAddMetaOpen.type && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest">
                          Thêm {isAddMetaOpen.type === 'payer' ? 'Người chi' : 'Phân loại'} mới
                      </h3>
                      <button onClick={() => setIsAddMetaOpen({ type: null, value: '' })} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <input 
                          type="text" 
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none bg-gray-50" 
                          value={isAddMetaOpen.value} 
                          onChange={(e) => setIsAddMetaOpen({...isAddMetaOpen, value: e.target.value})} 
                          placeholder="Nhập tên..." 
                          autoFocus
                      />
                      <div className="flex gap-3">
                          <button onClick={() => setIsAddMetaOpen({ type: null, value: '' })} className="flex-1 py-3 text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all">Hủy</button>
                          <button onClick={() => isAddMetaOpen.type && handleAddMeta(isAddMetaOpen.type, isAddMetaOpen.value)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Lưu Lại</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
