
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wallet, Plus, Calendar, Search, Loader2, Save, X, DollarSign, Users, Tag, Calculator, FileText, FileSpreadsheet, ExternalLink, TrendingUp, TrendingDown, RefreshCw, Layers, Globe, Store, CreditCard, Landmark, ArrowRightLeft, UserCheck, PieChart, Info, Upload, FileUp, AlertTriangle, CheckCircle, Clock, BarChart3, ShoppingBag, Edit2, ArrowUp, ArrowDown, HelpCircle, Check, MapPin, HandCoins, Box, User as UserIcon } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { FinanceTransaction, FinanceMeta, PaymentRecord, User, PrintwayRecord, EbayRecord, GKERecord, StaffSalarySummary, Store as StoreType } from '../types';
import * as XLSX from 'xlsx';

interface FinanceBoardProps {
  user: User;
}

type FinanceTab = 'transactions' | 'payments' | 'printway' | 'ebay' | 'salary' | 'gke';

export const FinanceBoard: React.FC<FinanceBoardProps> = ({ user }) => {
  const isAdmin = user.role.toLowerCase() === 'admin';
  const canViewSummary = isAdmin || user.permissions?.canViewFinanceSummary === true;
  const financeScope = user.permissions?.finance || 'all';

  const hasAccess = (tab: FinanceTab) => {
      if (isAdmin || financeScope === 'all') return true;
      const allowed = financeScope.split(',');
      if (tab === 'transactions') return allowed.includes('funds');
      if (tab === 'payments') return allowed.includes('payment');
      if (tab === 'printway') return allowed.includes('printway');
      if (tab === 'ebay') return allowed.includes('ebay');
      if (tab === 'salary') return allowed.includes('funds');
      if (tab === 'gke') return allowed.includes('printway');
      return false;
  };

  const [activeTab, setActiveTab] = useState<FinanceTab>(() => {
      const tabs: FinanceTab[] = ['transactions', 'payments', 'printway', 'ebay', 'salary', 'gke'];
      const firstAllowed = tabs.find(t => hasAccess(t));
      return firstAllowed || 'transactions';
  });

  const [currentYear, setCurrentYear] = useState<string>(new Date().getFullYear().toString());
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [printwayRecords, setPrintwayRecords] = useState<PrintwayRecord[]>([]);
  const [ebayRecords, setEbayRecords] = useState<EbayRecord[]>([]);
  const [gkeRecords, setGkeRecords] = useState<GKERecord[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<StaffSalarySummary[]>([]);
  const [allSystemStores, setAllSystemStores] = useState<StoreType[]>([]);
  
  const [meta, setMeta] = useState<FinanceMeta>({ 
    categories: ['Thu Tiền', 'Chi Tiền'], 
    subCategories: [], 
    payers: ['Hoàng'],
    stores: [],
    regions: ['Us', 'Au', 'VN']
  });
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rates, setRates] = useState<{ VND: number, AUD: number }>({ VND: 25450, AUD: 1.54 });
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isPrintwayUploadOpen, setIsPrintwayUploadOpen] = useState(false);
  const [isEbayUploadOpen, setIsEbayUploadOpen] = useState(false); 
  const [isGKEUploadOpen, setIsGKEUploadOpen] = useState(false); 
  const [isPayerStatsOpen, setIsPayerStatsOpen] = useState(false);
  
  const [quickAddMeta, setQuickAddMeta] = useState<{ type: 'subCategory' | 'store' | 'region', label: string } | null>(null);
  const [metaInput, setMetaInput] = useState('');

  const [calculationDetail, setCalculationDetail] = useState<{ title: string, items: { label: string, value: string, icon?: any }[], formula: string } | null>(null);
  
  const [isDraggingGKE, setIsDraggingGKE] = useState(false);
  const [isDraggingPrintway, setIsDraggingPrintway] = useState(false);
  const [isDraggingEbay, setIsDraggingEbay] = useState(false);

  const printwayFileInputRef = useRef<HTMLInputElement>(null);
  const ebayFileInputRef = useRef<HTMLInputElement>(null);
  const gkeFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadData, setUploadData] = useState<PrintwayRecord[]>([]);
  const [ebayUploadData, setEbayUploadData] = useState<EbayRecord[]>([]);
  const [gkeUploadData, setGkeUploadData] = useState<GKERecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState<Partial<FinanceTransaction>>({
    date: new Date().toISOString().slice(0, 16),
    category: 'Chi Tiền',
    subCategory: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    payer: 'Hoàng',
    note: ''
  });

  const [paymentData, setPaymentData] = useState<Partial<PaymentRecord>>({
    storeName: '',
    amount: 0,
    region: 'Us',
    date: new Date().toISOString().split('T')[0]
  });

  const robustParseNumber = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace(/[^\d,.-]/g, '');
    if (str.includes(',') && !str.includes('.')) {
        const parts = str.split(',');
        if (parts[parts.length - 1].length <= 2) str = str.replace(',', '.');
        else str = str.replace(/,/g, '');
    } else if (str.includes(',') && str.includes('.')) str = str.replace(/,/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [transResult, metaData, salaryResult, storeList] = await Promise.all([
        sheetService.getFinance(currentYear),
        sheetService.getFinanceMeta(),
        sheetService.getStaffSalarySummary(currentYear),
        sheetService.getStores()
      ]);
      
      setTransactions(Array.isArray(transResult.transactions) ? transResult.transactions : []);
      setPayments(Array.isArray(transResult.payments) ? transResult.payments : []);
      setPrintwayRecords(Array.isArray(transResult.printway) ? transResult.printway : []);
      setEbayRecords(Array.isArray(transResult.ebay) ? transResult.ebay : []);
      setGkeRecords(Array.isArray(transResult.gke) ? transResult.gke : []);
      setSalaryRecords(Array.isArray(salaryResult) ? salaryResult : []);
      setAllSystemStores(Array.isArray(storeList) ? storeList.filter(s => s.name && s.name.trim() !== "") : []);
      
      setMeta({
        categories: metaData.categories || ['Thu Tiền', 'Chi Tiền'],
        subCategories: metaData.subCategories || [],
        payers: metaData.payers || ['Hoàng'],
        stores: metaData.stores || [],
        regions: metaData.regions || ['Us', 'Au', 'VN']
      });

      try {
        const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const rateJson = await rateRes.json();
        if (rateJson && rateJson.rates) {
            setRates({ VND: rateJson.rates.VND || 25450, AUD: rateJson.rates.AUD || 1.54 });
        }
      } catch (e) {}
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [currentYear]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const summary = useMemo(() => {
    let fundIncomeUsd = 0, fundExpenseUsd = 0;
    transactions.forEach(t => {
      const amount = robustParseNumber(t.totalAmount) / (rates.VND || 25450);
      if (t.category === 'Thu Tiền') fundIncomeUsd += amount; 
      if (t.category === 'Chi Tiền') fundExpenseUsd += amount; 
    });

    let paymentTotalUsd = 0;
    let partnerFeesUsd = 0;
    payments.forEach(p => { 
        const convUsd = robustParseNumber(p.convertedUsd);
        paymentTotalUsd += convUsd; 
        const feeRate = (p.region === 'Us' || p.region === 'Au') ? 0.05 : 0.03;
        partnerFeesUsd += convUsd * feeRate;
    });
    
    let printwayOutUsd = 0;
    let printwayRefundUsd = 0;
    printwayRecords.forEach(pw => {
      const typeNorm = (pw.type || '').toLowerCase().trim();
      if (typeNorm.includes('topup') || typeNorm.includes('top-up')) return;

      const amt = robustParseNumber(pw.totalAmount);
      const loaiNorm = (pw.loai || '').toLowerCase();
      if (loaiNorm.includes('thu')) printwayRefundUsd += amt;
      else printwayOutUsd += amt;
    });

    let ebayOutUsd = 0;
    ebayRecords.forEach(e => { if (robustParseNumber(e.amount) < 0) ebayOutUsd += Math.abs(robustParseNumber(e.amount)); });

    let salaryOutUsd = 0;
    salaryRecords.forEach(sr => { salaryOutUsd += robustParseNumber(sr.amountUsd); });

    const totalIncomeUsd = fundIncomeUsd + paymentTotalUsd + printwayRefundUsd;
    const totalExpenseUsd = fundExpenseUsd + printwayOutUsd + ebayOutUsd + salaryOutUsd + partnerFeesUsd;
    
    return { 
        totalIncomeUsd, totalExpenseUsd, balanceUsd: totalIncomeUsd - totalExpenseUsd, 
        paymentTotalUsd, fundIncomeUsd, fundExpenseUsd, printwayOutUsd, printwayRefundUsd, 
        salaryOutUsd, ebayOutUsd, partnerFeesUsd,
        storeNetFlowUsd: paymentTotalUsd - partnerFeesUsd - printwayOutUsd - ebayOutUsd 
    };
  }, [transactions, payments, printwayRecords, ebayRecords, salaryRecords, rates]);

  const payerStats = useMemo(() => {
    const stats: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.category === 'Chi Tiền') {
        const payer = t.payer || 'Hoàng';
        stats[payer] = (stats[payer] || 0) + robustParseNumber(t.totalAmount);
      }
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const gkeSummary = useMemo(() => {
    let totalTopupUsd = 0;
    let totalPaymentVnd = 0;
    gkeRecords.forEach(g => {
      totalTopupUsd += robustParseNumber(g.topupAmount);
      totalPaymentVnd += robustParseNumber(g.paymentAmount);
    });
    const totalPaymentUsd = (rates.VND || 25450) > 0 ? totalPaymentVnd / (rates.VND || 25450) : 0;
    return { topup: totalTopupUsd, payment: totalPaymentUsd, remaining: totalTopupUsd - totalPaymentUsd };
  }, [gkeRecords, rates.VND]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const totalAmount = (formData.quantity || 1) * (formData.unitPrice || 0);
      const res = await sheetService.addFinance(currentYear, { ...formData, totalAmount });
      if (res && res.success) { setIsAddModalOpen(false); loadData(); }
    } finally { setIsUploading(false); }
  };

  const handleTriggerQuickAdd = (type: 'subCategory' | 'store' | 'region') => {
    const labels = { subCategory: 'Phân loại chi phí', store: 'Tên Store', region: 'Vùng (Region)' };
    setQuickAddMeta({ type, label: labels[type] });
    setMetaInput('');
  };

  const handleSaveQuickMeta = async () => {
    if (!quickAddMeta || !metaInput.trim()) return;
    setIsUploading(true);
    try {
      const val = metaInput.trim();
      const res = await sheetService.addFinanceMeta(quickAddMeta.type, val);
      if (res.success) {
        const updatedMeta = await sheetService.getFinanceMeta();
        setMeta(updatedMeta);
        if (quickAddMeta.type === 'subCategory') setFormData(prev => ({ ...prev, subCategory: val }));
        if (quickAddMeta.type === 'store') setPaymentData(prev => ({ ...prev, storeName: val }));
        if (quickAddMeta.type === 'region') setPaymentData(prev => ({ ...prev, region: val as any }));
        setQuickAddMeta(null);
      }
    } catch (e) {
      alert("Lỗi khi cập nhật Metadata!");
    } finally { setIsUploading(false); }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.storeName || !paymentData.region) return;
    setIsUploading(true);
    try {
      let convertedUsd = 0;
      const amount = robustParseNumber(paymentData.amount);
      if (paymentData.region === 'Us') convertedUsd = amount;
      else if (paymentData.region === 'Au') convertedUsd = amount / (rates.AUD || 1.54); 
      else if (paymentData.region === 'VN') convertedUsd = amount / (rates.VND || 25450);
      else convertedUsd = amount; 
      
      const res = await sheetService.addPayment(currentYear, { ...paymentData, convertedUsd });
      if (res && res.success) { setIsAddPaymentOpen(false); loadData(); }
    } finally { setIsUploading(false); }
  };

  const handleStoreSelectChange = (val: string) => {
    // TÌM STORE TRONG HỆ THỐNG ĐỂ LẤY REGION TỰ ĐỘNG
    const matchedStore = allSystemStores.find(s => String(s.name || '').trim().toLowerCase() === val.trim().toLowerCase());
    
    if (matchedStore) {
        // TỰ ĐỘNG CẬP NHẬT CẢ TÊN VÀ VÙNG (REGION)
        setPaymentData(prev => ({ 
          ...prev, 
          storeName: matchedStore.name, 
          region: (matchedStore.region || 'Us') as any 
        }));
    } else {
        // NẾU LÀ STORE TRONG LỊCH SỬ PAYMENT (KHÔNG CÓ TRONG TAB STORES)
        const historicalMatch = payments.find(p => String(p.storeName || '').trim().toLowerCase() === val.trim().toLowerCase());
        if (historicalMatch) {
            setPaymentData(prev => ({
                ...prev,
                storeName: historicalMatch.storeName,
                region: (historicalMatch.region || 'Us') as any
            }));
        } else {
            setPaymentData(prev => ({ ...prev, storeName: val }));
        }
    }
  };

  const processPrintwayFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binaryData, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        let rawParsed: PrintwayRecord[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const cols = jsonData[i];
          if (!cols || !cols[0]) continue; 
          rawParsed.push({
            invoiceId: String(cols[0] || '').trim(), 
            type: String(cols[1] || 'Payment').trim(), 
            loai: String(cols[1] || 'Payment').trim(), 
            status: String(cols[2] || 'Completed').trim(),    
            date: cols[3] instanceof Date ? cols[3].toLocaleString('vi-VN') : String(cols[3] || ''), 
            method: String(cols[4] || 'Wallet').trim(), 
            amountUsd: robustParseNumber(cols[5]),   
            fee: robustParseNumber(cols[6]),
            totalAmount: robustParseNumber(cols[7] || cols[5]), 
            note: String(cols[8] || '').trim(),
          });
        }
        setUploadData(rawParsed);
      } catch (err) { alert("Lỗi xử lý file Excel!"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadPrintway = async () => {
    if (uploadData.length === 0) return;
    setIsUploading(true);
    try {
      const res = await sheetService.addPrintwayBatch(currentYear, uploadData);
      if (res && res.success) { alert(`Đã đồng bộ ${res.count} dòng mới.`); setIsPrintwayUploadOpen(false); setUploadData([]); loadData(); }
    } finally { setIsUploading(false); }
  };

  const processEbayFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binaryData, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        let rawParsed: EbayRecord[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const cols = jsonData[i];
          if (!cols || !cols[0]) continue;
          rawParsed.push({
            recordId: String(cols[0]),
            accountingTime: cols[1] instanceof Date ? cols[1].toLocaleString('vi-VN') : String(cols[1]),
            type: String(cols[2] || ''),
            amount: robustParseNumber(cols[3]),
            cardRemark: String(cols[4] || '')
          });
        }
        setEbayUploadData(rawParsed);
      } catch (err) { alert("Lỗi xử lý file!"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadEbay = async () => {
    if (ebayUploadData.length === 0) return;
    setIsUploading(true);
    try {
      const res = await sheetService.addEbayBatch(currentYear, ebayUploadData);
      if (res && res.success) { alert(`Đã lưu ${res.count} dòng Ebay.`); setIsEbayUploadOpen(false); setEbayUploadData([]); loadData(); }
    } finally { setIsUploading(false); }
  };

  const processGKEFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binaryData, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        let rawParsed: GKERecord[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const cols = jsonData[i];
          if (!cols) continue;
          const payVnd = robustParseNumber(cols[3]);
          const topupVnd = robustParseNumber(cols[4]);
          const orderNum = String(cols[1] || '').trim();
          const tracking = String(cols[2] || '').trim();
          const noteStr = String(cols[5] || '').trim();
          if (!orderNum && !tracking && topupVnd === 0) continue;
          const topupUsd = (rates.VND || 25450) > 0 ? topupVnd / (rates.VND || 25450) : 0;
          rawParsed.push({
            date: cols[0] instanceof Date ? cols[0].toLocaleString('vi-VN') : String(cols[0] || ''),
            orderNumber: orderNum, trackingNumber: tracking, paymentAmount: payVnd, topupAmount: topupUsd, note: noteStr
          });
        }
        setGkeUploadData(rawParsed);
      } catch (err) { alert("Lỗi xử lý file Excel GKE!"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadGKE = async () => {
    if (gkeUploadData.length === 0) return;
    setIsUploading(true);
    try {
      const res = await sheetService.addGKEBatch(currentYear, gkeUploadData);
      if (res && res.success) { alert(`Đã đồng bộ ${res.count} dòng GKE mới.`); setIsGKEUploadOpen(false); setGkeUploadData([]); loadData(); }
    } finally { setIsUploading(false); }
  };

  const showDetailModal = (type: 'income' | 'expense') => {
    if (type === 'income') {
      setCalculationDetail({
        title: "Chi tiết Tổng Thu Hệ Thống", formula: "Quỹ Công Ty + Funds (100%) + PW Refund (Loại bỏ Topup)",
        items: [
          { label: "Nguồn Quỹ Công Ty (USD)", value: formatCurrency(summary.fundIncomeUsd ?? 0), icon: Wallet },
          { label: "Gross Store Funds (USD)", value: formatCurrency(summary.paymentTotalUsd ?? 0), icon: Landmark },
          { label: "Printway Refund (USD)", value: formatCurrency(summary.printwayRefundUsd ?? 0), icon: RefreshCw }
        ]
      });
    } else {
      setCalculationDetail({
        title: "Chi tiết Tổng Chi Vận Hành", formula: "Chi Quỹ + PW + Ebay + Lương + Phí Partner (Loại bỏ Topup)",
        items: [
          { label: "Chi Phí Vận Hành (USD)", value: formatCurrency(summary.fundExpenseUsd ?? 0), icon: Wallet },
          { label: "Printway Payment (USD)", value: formatCurrency(summary.printwayOutUsd ?? 0), icon: FileSpreadsheet },
          { label: "Chi Phí Ebay (USD)", value: formatCurrency(summary.ebayOutUsd ?? 0), icon: ShoppingBag },
          { label: "Lương Nhân Sự (USD)", value: formatCurrency(summary.salaryOutUsd ?? 0), icon: HandCoins },
          { label: "Phí Partner 3-5% (USD)", value: formatCurrency(summary.partnerFeesUsd ?? 0), icon: Users }
        ]
      });
    }
  };

  // TỔNG HỢP DANH SÁCH STORE DUY NHẤT VÀ LỌC TRỐNG
  const combinedStoreOptions = useMemo(() => {
      const storesFromSystem = allSystemStores.map(s => String(s.name || '').trim());
      const storesFromHistory = payments.map(p => String(p.storeName || '').trim());
      const storesFromMeta = (meta.stores || []).map(name => String(name || '').trim());
      
      const all = [...storesFromSystem, ...storesFromHistory, ...storesFromMeta];
      return Array.from(new Set(all.filter(name => name !== ""))).sort();
  }, [allSystemStores, payments, meta.stores]);

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col bg-gray-100 gap-6 overflow-x-hidden pb-20 font-sans text-gray-800">
      {canViewSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <div onClick={() => showDetailModal('income')} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-emerald-200 cursor-pointer group transition-all">
                <div className="flex justify-between items-start"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">Tổng Thu <HelpCircle size={10}/></span></div>
                <div className="mt-4"><p className="text-2xl font-black text-emerald-600">{formatCurrency(summary.totalIncomeUsd ?? 0)}</p></div>
            </div>
            <div onClick={() => showDetailModal('expense')} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-rose-200 cursor-pointer group transition-all">
                <div className="flex justify-between items-start"><div className="p-3 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform"><TrendingDown size={24}/></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">Tổng Chi <HelpCircle size={10}/></span></div>
                <div className="mt-4"><p className="text-2xl font-black text-rose-600">{formatCurrency(summary.totalExpenseUsd ?? 0)}</p></div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start"><div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><DollarSign size={24}/></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dư Quỹ (USD)</span></div>
                <div className="mt-4"><p className={`text-2xl font-black ${(summary.balanceUsd ?? 0) >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(summary.balanceUsd ?? 0)}</p></div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start"><div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><ArrowRightLeft size={24}/></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dòng Tiền Net Store</span></div>
                <div className="mt-4"><p className={`text-2xl font-black ${(summary.storeNetFlowUsd ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(summary.storeNetFlowUsd ?? 0)}</p></div>
            </div>
        </div>
      )}

      <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 w-full md:w-auto overflow-x-auto">
          {[
            { id: 'transactions', label: 'Chi phí', icon: <Wallet size={16}/> },
            { id: 'payments', label: 'Funds', icon: <Landmark size={16}/> },
            { id: 'printway', label: 'Printway', icon: <FileSpreadsheet size={16}/> },
            { id: 'ebay', label: 'Ebay', icon: <ShoppingBag size={16}/> },
            { id: 'salary', label: 'Lương', icon: <HandCoins size={16}/> },
            { id: 'gke', label: 'GKE', icon: <Box size={16}/> }
          ].filter(t => hasAccess(t.id as FinanceTab)).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as FinanceTab)} className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
            {activeTab === 'transactions' && (
              <button onClick={() => setIsPayerStatsOpen(true)} className="px-5 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 flex items-center gap-2 border border-indigo-100 shadow-sm">
                 <BarChart3 size={16}/> Thống kê
              </button>
            )}
            <select value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} className="px-4 py-2.5 bg-slate-100 border rounded-xl text-xs font-black">
               {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y.toString()}>Năm {y}</option>)}
            </select>
            <button onClick={() => { 
                if (activeTab === 'transactions') setIsAddModalOpen(true); 
                else if (activeTab === 'payments') setIsAddPaymentOpen(true); 
                else if (activeTab === 'printway') setIsPrintwayUploadOpen(true); 
                else if (activeTab === 'ebay') setIsEbayUploadOpen(true); 
                else if (activeTab === 'gke') setIsGKEUploadOpen(true);
            }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-white shadow-lg ${['printway', 'ebay', 'gke', 'salary'].includes(activeTab) ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              <Plus size={18} /> {['printway', 'ebay', 'gke'].includes(activeTab) ? 'Tải Excel' : 'Thêm mới'}
            </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[500px]">
         <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/30">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm kiếm..." className="pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-full outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            {activeTab === 'gke' && (
              <div className="flex items-center gap-4 px-4 py-2 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                 <div className="flex flex-col items-center px-3 border-r border-indigo-200">
                    <span className="text-[8px] font-black text-indigo-400 uppercase">Tổng nạp</span>
                    <span className="text-xs font-black text-emerald-600">{formatCurrency(gkeSummary.topup ?? 0)}</span>
                 </div>
                 <div className="flex flex-col items-center px-3 border-r border-indigo-200">
                    <span className="text-[8px] font-black text-indigo-400 uppercase">Đã dùng</span>
                    <span className="text-xs font-black text-rose-600">{formatCurrency(gkeSummary.payment ?? 0)}</span>
                 </div>
                 <div className="flex flex-col items-center px-3">
                    <span className="text-[8px] font-black text-indigo-400 uppercase">Còn lại</span>
                    <span className="text-xs font-black text-indigo-600">{formatCurrency(gkeSummary.remaining ?? 0)}</span>
                 </div>
              </div>
            )}

            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50/50 rounded-2xl border border-slate-100/50">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate VND:</span>
                 <span className="text-xs font-black text-slate-700">{(rates.VND ?? 0).toLocaleString()}</span>
               </div>
            </div>
         </div>
         <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? <div className="py-20 text-center animate-pulse text-slate-400 uppercase font-black text-xs">Đang nạp dữ liệu...</div> : (
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10 text-[10px] font-black uppercase text-slate-600">
                    <tr>
                        <th className="px-6 py-5 w-12 text-center">STT</th>
                        {activeTab === 'gke' ? (
                           <>
                             <th className="px-6 py-5">Ngày GD</th>
                             <th className="px-6 py-5">Order #</th>
                             <th className="px-6 py-5">Tracking #</th>
                             <th className="px-6 py-5 text-right">Thanh toán (VND)</th>
                             <th className="px-6 py-5 text-right text-indigo-600">Nạp tiền (USD)</th>
                             <th className="px-6 py-5">Ghi chú</th>
                           </>
                        ) : activeTab === 'salary' ? (
                           <>
                             <th className="px-6 py-5">Tháng</th>
                             <th className="px-6 py-5 text-right">VNĐ (Ô D3)</th>
                             <th className="px-6 py-5 text-right text-indigo-600">Quy đổi USD</th>
                             <th className="px-6 py-5 text-center">Nguồn</th>
                           </>
                        ) : activeTab === 'payments' ? (
                          <>
                            <th className="px-6 py-5">Store</th>
                            <th className="px-6 py-5 text-center">Vùng</th>
                            <th className="px-6 py-5 text-right">Gốc</th>
                            <th className="px-6 py-5 text-right text-indigo-600">USD</th>
                            <th className="px-6 py-5 text-center">Ngày</th>
                          </>
                        ) : activeTab === 'printway' ? (
                          <>
                            <th className="px-6 py-5">InvoiceID</th>
                            <th className="px-6 py-5 text-right">AmountUSD</th>
                            <th className="px-6 py-5 text-center">Phí Fee</th>
                            <th className="px-6 py-5">Loại</th>
                            <th className="px-6 py-5 text-center">Ngày</th>
                          </>
                        ) : activeTab === 'ebay' ? (
                          <>
                             <th className="px-6 py-5">RecordID</th>
                             <th className="px-6 py-5">Accounting Time</th>
                             <th className="px-6 py-5">Type</th>
                             <th className="px-6 py-5 text-right">Amount</th>
                             <th className="px-6 py-5">Remark</th>
                          </>
                        ) : (
                          <>
                            <th className="px-6 py-5">Nội dung</th>
                            <th className="px-6 py-5 text-[10px]">Phân loại</th>
                            <th className="px-6 py-5 text-right">Tổng (VNĐ)</th>
                            <th className="px-6 py-5 text-center">Người chi</th>
                            <th className="px-6 py-5 text-center">Ngày</th>
                          </>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {activeTab === 'ebay' && ebayRecords.filter(e => (e.recordId || '').toLowerCase().includes(searchTerm.toLowerCase())).map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-black text-slate-700">{e.recordId}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{e.accountingTime}</td>
                        <td className="px-6 py-4 text-[10px] font-black uppercase text-indigo-500">{e.type}</td>
                        <td className={`px-6 py-4 text-right font-black ${robustParseNumber(e.amount) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{(e.amount ?? 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-[10px] text-slate-400 italic">{e.cardRemark}</td>
                      </tr>
                    ))}
                    {activeTab === 'gke' && gkeRecords.filter(g => (g.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || (g.trackingNumber || '').toLowerCase().includes(searchTerm.toLowerCase())).map((g, i) => (
                       <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{g.date}</td>
                        <td className="px-6 py-4 font-black text-slate-700">{g.orderNumber || '---'}</td>
                        <td className="px-6 py-4 font-bold text-blue-600 text-xs">{g.trackingNumber || '---'}</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600">{(g.paymentAmount ?? 0).toLocaleString()} đ</td>
                        <td className="px-6 py-4 text-right font-black text-indigo-600">{formatCurrency(g.topupAmount ?? 0)}</td>
                        <td className="px-6 py-4 text-[10px] text-slate-400 italic">{g.note}</td>
                      </tr>
                    ))}
                    {activeTab === 'transactions' && transactions.filter(t => (t.description || '').toLowerCase().includes(searchTerm.toLowerCase())).map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{t.description}</td>
                        <td className="px-6 py-4 text-[10px] font-black text-indigo-500 uppercase">{t.subCategory}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-800">{(t.totalAmount ?? 0).toLocaleString()} đ</td>
                        <td className="px-6 py-4 text-center text-slate-500 font-black uppercase text-[10px]">{t.payer}</td>
                        <td className="px-6 py-4 text-center text-slate-500 text-[10px] font-bold">{(t.date || '').split(' ')[0]}</td>
                      </tr>
                    ))}
                    {activeTab === 'payments' && payments.filter(p => (p.storeName || '').toLowerCase().includes(searchTerm.toLowerCase())).map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-black uppercase text-slate-700">{p.storeName}</td>
                        <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-black text-[9px] uppercase">{p.region}</span></td>
                        <td className="px-6 py-4 text-right font-bold text-slate-600">{(p.amount ?? 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-indigo-600">{formatCurrency(p.convertedUsd ?? 0)}</td>
                        <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-500">{p.date}</td>
                      </tr>
                    ))}
                    {activeTab === 'printway' && printwayRecords.filter(p => (p.invoiceId || '').toLowerCase().includes(searchTerm.toLowerCase())).map((p, i) => (
                       <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-black text-slate-700">{p.invoiceId}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-800">{formatCurrency(p.totalAmount ?? 0)}</td>
                        <td className="px-6 py-4 text-center text-slate-400 font-bold text-xs">{formatCurrency(p.fee ?? 0)}</td>
                        <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-black border ${(p.loai || '').includes('Thu') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{p.loai}</span></td>
                        <td className="px-6 py-4 text-center text-slate-500 text-[10px] font-bold">{p.date}</td>
                      </tr>
                    ))}
                    {activeTab === 'salary' && salaryRecords.map((sr, i) => (
                       <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-black text-slate-700">Tháng {sr.month}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">{(sr.amountVnd ?? 0).toLocaleString()} đ</td>
                        <td className="px-6 py-4 text-right font-black text-indigo-600">{formatCurrency(sr.amountUsd ?? 0)}</td>
                        <td className="px-6 py-4 text-center text-[9px] text-slate-500 font-black uppercase">Sheet Chấm công</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
         </div>
      </div>

      {/* EBAY MODAL */}
      {isEbayUploadOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải Ebay Excel</h3>
                 <button onClick={() => setIsEbayUploadOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><X size={24}/></button>
              </div>
              <div className="p-8">
                 <div 
                   onDragOver={(e) => { e.preventDefault(); setIsDraggingEbay(true); }}
                   onDragLeave={() => setIsDraggingEbay(false)}
                   onDrop={(e) => { e.preventDefault(); setIsDraggingEbay(false); if(e.dataTransfer.files[0]) processEbayFile(e.dataTransfer.files[0]); }}
                   onClick={() => ebayFileInputRef.current?.click()}
                   className={`border-2 border-dashed rounded-[2rem] h-48 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${isDraggingEbay ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                 >
                    <ShoppingBag className={`w-12 h-12 ${isDraggingEbay ? 'text-indigo-600' : 'text-slate-300'}`} />
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Kéo thả file Ebay.xlsx vào đây</p>
                    <input type="file" ref={ebayFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && processEbayFile(e.target.files[0])} />
                 </div>
                 {ebayUploadData.length > 0 && (
                   <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700">Đã nạp {ebayUploadData.length} dòng Ebay.</span>
                      <button onClick={handleUploadEbay} disabled={isUploading} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md flex items-center justify-center gap-2">
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14}/>} Lưu vào Sheet
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* PRINTWAY MODAL */}
      {isPrintwayUploadOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải Printway Excel</h3>
                 <button onClick={() => setIsPrintwayUploadOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><X size={24}/></button>
              </div>
              <div className="p-8">
                 <div 
                   onDragOver={(e) => { e.preventDefault(); setIsDraggingPrintway(true); }}
                   onDragLeave={() => setIsDraggingPrintway(false)}
                   onDrop={(e) => { e.preventDefault(); setIsDraggingPrintway(false); if(e.dataTransfer.files[0]) processPrintwayFile(e.dataTransfer.files[0]); }}
                   onClick={() => printwayFileInputRef.current?.click()}
                   className={`border-2 border-dashed rounded-[2rem] h-48 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${isDraggingPrintway ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                 >
                    <FileSpreadsheet className={`w-12 h-12 ${isDraggingPrintway ? 'text-indigo-600' : 'text-slate-300'}`} />
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Kéo thả file Printway.xlsx vào đây</p>
                    <input type="file" ref={printwayFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && processPrintwayFile(e.target.files[0])} />
                 </div>
                 {uploadData.length > 0 && (
                   <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700">Đã nạp {uploadData.length} dòng dữ liệu.</span>
                      <button onClick={handleUploadPrintway} disabled={isUploading} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md flex items-center justify-center gap-2">
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14}/>} Đồng bộ ngay
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* GKE UPLOAD MODAL */}
      {isGKEUploadOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải GKE Excel</h3>
                 <button onClick={() => setIsGKEUploadOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><X size={24}/></button>
              </div>
              <div className="p-8">
                 <div 
                   onDragOver={(e) => { e.preventDefault(); setIsDraggingGKE(true); }}
                   onDragLeave={() => setIsDraggingGKE(false)}
                   onDrop={(e) => { e.preventDefault(); setIsDraggingGKE(false); if(e.dataTransfer.files[0]) processGKEFile(e.dataTransfer.files[0]); }}
                   onClick={() => gkeFileInputRef.current?.click()}
                   className={`border-2 border-dashed rounded-[2rem] h-48 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${isDraggingGKE ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                 >
                    <Box className={`w-12 h-12 ${isDraggingGKE ? 'text-indigo-600' : 'text-slate-300'}`} />
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Kéo thả file GKE.xlsx vào đây</p>
                    <input type="file" ref={gkeFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && processGKEFile(e.target.files[0])} />
                 </div>
                 {gkeUploadData.length > 0 && (
                   <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700">Đã nạp {gkeUploadData.length} dòng GKE.</span>
                      <button onClick={handleUploadGKE} disabled={isUploading} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md flex items-center justify-center gap-2">
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14}/>} Lưu vào Sheet
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* ADD TRANSACTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-slide-in border border-white/20">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thêm Chi Phí Mới</h3>
                 <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><X size={24}/></button>
              </div>
              <form onSubmit={handleAddTransaction} className="p-8 space-y-5">
                 <div className="grid grid-cols-2 gap-5">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Nhóm thu chi</label>
                       <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
                          {(meta.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Phân loại chi phí</label>
                       <div className="flex gap-2">
                          <select value={formData.subCategory} onChange={e => setFormData({...formData, subCategory: e.target.value})} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
                              <option value="">-- Chọn --</option>
                              {(meta.subCategories || []).map(sc => <option key={sc} value={sc}>{sc}</option>)}
                          </select>
                          <button type="button" onClick={() => handleTriggerQuickAdd('subCategory')} className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                             <Plus size={18}/>
                          </button>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-5">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Ngày thực hiện</label>
                       <div className="relative">
                          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="datetime-local" 
                            value={formData.date} 
                            onChange={e => setFormData({...formData, date: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          />
                       </div>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Người chi (Payer)</label>
                       <select value={formData.payer} onChange={e => setFormData({...formData, payer: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all">
                          {(meta.payers || []).map(p => <option key={p} value={p}>{p}</option>)}
                       </select>
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Nội dung diễn giải chi tiết</label>
                    <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" required placeholder="Ví dụ: Thanh toán tiền điện tháng 5..." />
                 </div>

                 <div className="grid grid-cols-3 gap-5">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Số lượng</label>
                       <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none" />
                    </div>
                    <div className="col-span-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block ml-1">Đơn giá (VNĐ)</label>
                       <div className="relative">
                          <input type="number" value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pr-12 text-sm font-bold outline-none" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">VND</span>
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 flex gap-4 border-t border-slate-100">
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">Hủy</button>
                    <button type="submit" disabled={isUploading} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                       {isUploading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18}/> Lưu Chi Phí</>}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* QUICK ADD META MODAL */}
      {quickAddMeta && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[400] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-slide-in border border-white/20">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Thêm {quickAddMeta.label} mới</h4>
                 <button onClick={() => setQuickAddMeta(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><X size={20}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Giá trị mới</label>
                    <input 
                      type="text" 
                      value={metaInput} 
                      onChange={e => setMetaInput(e.target.value)}
                      autoFocus
                      placeholder={`Nhập ${quickAddMeta.label.toLowerCase()}...`}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-inner outline-none transition-all"
                    />
                 </div>
                 <div className="flex gap-3">
                    <button onClick={() => setQuickAddMeta(null)} className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-700 transition-colors">Hủy</button>
                    <button onClick={handleSaveQuickMeta} disabled={isUploading} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 flex items-center justify-center gap-2">
                       {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12}/>} Lưu Lại
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* ADD PAYMENT MODAL - HIỂN THỊ DANH SÁCH STORE CÓ SẴN KÈM REGION TỰ ĐỘNG */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-in border border-white/20">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thêm Store Funds</h3>
                 <button onClick={() => setIsAddPaymentOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><X size={24}/></button>
              </div>
              <form onSubmit={handleAddPayment} className="p-8 space-y-5">
                 <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Chọn Store</label>
                    <div className="flex gap-2">
                        <select 
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm outline-none cursor-pointer" 
                            required 
                            value={paymentData.storeName} 
                            onChange={e => handleStoreSelectChange(e.target.value)}
                        >
                            <option value="">-- Chọn Store --</option>
                            {combinedStoreOptions.map(name => {
                                const systemStore = allSystemStores.find(s => s.name.toLowerCase() === name.toLowerCase());
                                return (
                                    <option key={name} value={name}>
                                        {name} {systemStore ? `(${systemStore.region})` : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <button type="button" onClick={() => handleTriggerQuickAdd('store')} className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Thêm store mới">
                            <Plus size={18}/>
                        </button>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Vùng (Region)</label>
                       <div className="flex gap-2">
                           <select 
                             value={paymentData.region} 
                             onChange={e => setPaymentData({...paymentData, region: e.target.value as any})} 
                             className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm outline-none cursor-pointer"
                           >
                              {meta.regions.map(r => <option key={r} value={r}>{r}</option>)}
                           </select>
                           <button type="button" onClick={() => handleTriggerQuickAdd('region')} className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Thêm vùng mới">
                                <Plus size={18}/>
                           </button>
                       </div>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Số tiền gốc</label>
                       <input type="number" value={paymentData.amount === 0 ? '' : paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm outline-none" required />
                    </div>
                 </div>
                 <div className="pt-6 flex gap-4 border-t border-slate-100">
                    <button type="button" onClick={() => setIsAddPaymentOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Hủy</button>
                    <button type="submit" disabled={isUploading} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                       {isUploading ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16}/> Xác nhận Fund</>}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL THỐNG KÊ NGƯỜI CHI */}
      {isPayerStatsOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[400] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in border border-white/20">
              <div className="px-8 py-8 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thống kê Người Chi</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Dữ liệu chi phí năm {currentYear}</p>
                 </div>
                 <button onClick={() => setIsPayerStatsOpen(false)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:shadow-md"><X size={20}/></button>
              </div>
              <div className="p-8">
                 <div className="space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                    {payerStats.length === 0 ? (
                       <div className="py-14 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest opacity-30">Chưa có dữ liệu chi phí</div>
                    ) : payerStats.map(([name, amount], idx) => (
                       <div key={idx} className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] group hover:bg-white hover:shadow-lg transition-all duration-300">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-sm shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                {name.charAt(0)}
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Giao dịch chi tiền mặt</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-lg font-black text-rose-600">{(amount ?? 0).toLocaleString()} đ</p>
                          </div>
                       </div>
                    ))}
                 </div>
                 <div className="mt-8 pt-8 border-t border-dashed border-slate-200 flex justify-between items-center px-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Tổng chi toàn hệ thống</span>
                    <span className="text-xl font-black text-indigo-600 bg-indigo-50 px-5 py-2 rounded-2xl">
                       {payerStats.reduce((sum, item) => sum + item[1], 0).toLocaleString()} đ
                    </span>
                 </div>
                 <button onClick={() => setIsPayerStatsOpen(false)} className="w-full mt-10 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-black active:scale-95 transition-all">Đóng thống kê</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL CHI TIẾT CÁCH TÍNH */}
      {calculationDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[400] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in border border-white/20">
              <div className="px-8 py-8 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{calculationDetail.title}</h3>
                   <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-indigo-100">Công thức: {calculationDetail.formula}</span>
                   </div>
                 </div>
                 <button onClick={() => setCalculationDetail(null)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:bg-slate-50"><X size={20}/></button>
              </div>
              <div className="p-8 space-y-4">
                 {calculationDetail.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all group">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm"><item.icon size={18}/></div>
                          <span className="text-xs font-black text-slate-600 uppercase tracking-wide">{item.label}</span>
                       </div>
                       <span className="text-sm font-black text-slate-900">{item.value}</span>
                    </div>
                 ))}
                 <div className="mt-8 pt-8 border-t border-dashed border-slate-100 flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng kết quy đổi</span>
                    <span className="text-2xl font-black text-indigo-600">
                        {calculationDetail.title.includes('Thu') ? formatCurrency(summary.totalIncomeUsd ?? 0) : formatCurrency(summary.totalExpenseUsd ?? 0)}
                    </span>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
