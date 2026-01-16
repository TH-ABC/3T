
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wallet, Plus, Calendar, Search, Loader2, Save, X, DollarSign, Users, Tag, Calculator, FileText, FileSpreadsheet, ExternalLink, TrendingUp, TrendingDown, RefreshCw, Layers, Globe, Store, CreditCard, Landmark, ArrowRightLeft, UserCheck, PieChart, Info, Upload, FileUp, AlertTriangle, CheckCircle, Clock, BarChart3, ShoppingBag, Edit2, ArrowUp, ArrowDown, HelpCircle, Check, MapPin, HandCoins, Box } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { FinanceTransaction, FinanceMeta, PaymentRecord, User, PrintwayRecord, EbayRecord, GKERecord, StaffSalarySummary } from '../types';
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
  const [calculationDetail, setCalculationDetail] = useState<{ title: string, items: { label: string, value: string, icon?: any }[], formula: string } | null>(null);
  
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isDraggingPrintway, setIsDraggingPrintway] = useState(false);
  const [isDraggingEbay, setIsDraggingEbay] = useState(false);
  const [isDraggingGKE, setIsDraggingGKE] = useState(false);

  // Inline editing state
  const [editingPayerId, setEditingPayerId] = useState<string | null>(null);
  const [updatingPayerIds, setUpdatingPayerIds] = useState<Set<string>>(new Set());

  // Funds Modal mechanism
  const [isNewStoreMode, setIsNewStoreMode] = useState(false);
  const [isNewRegionMode, setIsNewRegionMode] = useState(false);

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [transResult, metaData, salaryResult] = await Promise.all([
        sheetService.getFinance(currentYear),
        sheetService.getFinanceMeta(),
        sheetService.getStaffSalarySummary(currentYear)
      ]);
      setTransactions(Array.isArray(transResult.transactions) ? transResult.transactions : []);
      setPayments(Array.isArray(transResult.payments) ? transResult.payments : []);
      setPrintwayRecords(Array.isArray(transResult.printway) ? transResult.printway : []);
      setEbayRecords(Array.isArray(transResult.ebay) ? transResult.ebay : []);
      setGkeRecords(Array.isArray(transResult.gke) ? transResult.gke : []);
      setSalaryRecords(Array.isArray(salaryResult) ? salaryResult : []);
      
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
      } catch (e) { console.warn("Failed to fetch online rates."); }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [currentYear]);

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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const summary = useMemo(() => {
    let fundIncomeVnd = 0, fundExpenseVnd = 0;
    transactions.forEach(t => {
      const amount = robustParseNumber(t.totalAmount);
      if (t.category === 'Thu Tiền') fundIncomeVnd += amount; 
      if (t.category === 'Chi Tiền') fundExpenseVnd += amount; 
    });
    const fundIncomeUsd = fundIncomeVnd / rates.VND;
    const fundExpenseUsd = fundExpenseVnd / rates.VND;

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
      const amt = robustParseNumber(pw.amountUsd || pw.totalAmount);
      const typeNorm = (pw.type || '').toLowerCase();
      if (typeNorm.includes('top-up')) return; 
      if ((pw.loai || '').includes('Thu')) printwayRefundUsd += amt;
      else printwayOutUsd += amt;
    });

    let ebayOutUsd = 0;
    ebayRecords.forEach(e => { if (robustParseNumber(e.amount) < 0) ebayOutUsd += Math.abs(robustParseNumber(e.amount)); });

    let gkeOutUsd = 0;
    gkeRecords.forEach(g => { gkeOutUsd += robustParseNumber(g.cost); });

    let salaryOutUsd = 0;
    salaryRecords.forEach(sr => { salaryOutUsd += robustParseNumber(sr.amountUsd); });

    const totalIncomeUsd = fundIncomeUsd + paymentTotalUsd + printwayRefundUsd;
    const totalExpenseUsd = fundExpenseUsd + printwayOutUsd + ebayOutUsd + salaryOutUsd + partnerFeesUsd + gkeOutUsd;
    
    return { 
        totalIncomeUsd, totalExpenseUsd, balanceUsd: totalIncomeUsd - totalExpenseUsd, 
        paymentTotalUsd, fundIncomeUsd, fundExpenseUsd, printwayOutUsd, printwayRefundUsd, 
        salaryOutUsd, ebayOutUsd, partnerFeesUsd, gkeOutUsd,
        storeNetFlowUsd: paymentTotalUsd - partnerFeesUsd - printwayOutUsd - ebayOutUsd - gkeOutUsd 
    };
  }, [transactions, payments, printwayRecords, ebayRecords, gkeRecords, salaryRecords, rates]);

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0;
      return dateB - dateA;
    });
  }, [payments]);

  const payerStats = useMemo(() => {
      const stats: Record<string, number> = {};
      transactions.forEach(t => {
          if (t.category === 'Chi Tiền') {
              const p = t.payer || "Hoàng";
              stats[p] = (stats[p] || 0) + robustParseNumber(t.totalAmount);
          }
      });
      return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const availableStores = useMemo(() => {
      const registryStores = meta.stores || [];
      const paymentStores = payments.map(p => p.storeName).filter(Boolean);
      return Array.from(new Set([...registryStores, ...paymentStores])).sort();
  }, [meta.stores, payments]);

  const storeRegionMap = useMemo(() => {
    const map: Record<string, string> = {};
    payments.forEach(p => {
        if (p.storeName && p.region && !map[p.storeName]) {
            map[p.storeName] = p.region;
        }
    });
    return map;
  }, [payments]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const totalAmount = (formData.quantity || 1) * (formData.unitPrice || 0);
      const res = await sheetService.addFinance(currentYear, { ...formData, totalAmount });
      if (res && res.success) { setIsAddModalOpen(false); loadData(); }
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
      else if (paymentData.region === 'Au') convertedUsd = amount / rates.AUD; 
      else if (paymentData.region === 'VN') convertedUsd = amount / rates.VND;
      else convertedUsd = amount; 
      
      if (isNewStoreMode && paymentData.storeName) await sheetService.addFinanceMeta('store', paymentData.storeName);
      if (isNewRegionMode && paymentData.region) await sheetService.addFinanceMeta('region', paymentData.region);

      const res = await sheetService.addPayment(currentYear, { ...paymentData, convertedUsd });
      if (res && res.success) {
        setIsAddPaymentOpen(false);
        setIsNewStoreMode(false);
        setIsNewRegionMode(false);
        loadData();
      }
    } finally { setIsUploading(false); }
  };

  const handleStoreSelect = (storeName: string) => {
    const matchedRegion = storeRegionMap[storeName] || 'Us';
    setPaymentData({ ...paymentData, storeName, region: matchedRegion as any });
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
      else alert("Lỗi: " + (res?.error || "Lỗi lưu"));
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
          if (!cols || (!cols[0] && !cols[1])) continue;
          
          // YÊU CẦU: TỰ QUY ĐỔI COST TỪ VNĐ SANG USD (CỘT COST Ở CHỈ SỐ 13)
          const costVnd = robustParseNumber(cols[13]);
          const costUsd = rates.VND > 0 ? costVnd / rates.VND : 0;

          rawParsed.push({
            orderNumber: String(cols[0] || '').trim(),
            trackingNumber: String(cols[1] || '').trim(),
            country: String(cols[2] || '').trim(),
            consigneeName: String(cols[3] || '').trim(),
            state: String(cols[4] || '').trim(),
            city: String(cols[5] || '').trim(),
            address: String(cols[6] || '').trim(),
            postcode: String(cols[7] || '').trim(),
            productName: String(cols[8] || '').trim(),
            value: robustParseNumber(cols[9]),
            quantity: robustParseNumber(cols[10]),
            weightCustomer: robustParseNumber(cols[11]),
            weightGKE: robustParseNumber(cols[12]),
            cost: costUsd, // Đã quy đổi thành USD
            creative: String(cols[14] || '').trim(),
            dateReceived: cols[15] instanceof Date ? cols[15].toLocaleString('vi-VN') : String(cols[15] || ''),
            status: String(cols[16] || '').trim(),
            linkLabel: String(cols[17] || '').trim(),
            linkQR: String(cols[18] || '').trim()
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
      if (res && res.success) { 
        alert(`Đã đồng bộ ${res.count} dòng GKE mới.`); 
        setIsGKEUploadOpen(false); 
        setGkeUploadData([]); 
        loadData(); 
      }
    } finally { setIsUploading(false); }
  };

  const showDetailModal = (type: 'income' | 'expense') => {
    if (type === 'income') {
      setCalculationDetail({
        title: "Chi tiết Tổng Thu Hệ Thống",
        formula: "Quỹ Công Ty + Funds (100%) + PW Refund",
        items: [
          { label: "Nguồn Quỹ Công Ty (USD)", value: formatCurrency(summary.fundIncomeUsd), icon: Wallet },
          { label: "Gross Store Funds (USD)", value: formatCurrency(summary.paymentTotalUsd), icon: Landmark },
          { label: "Printway Refund (USD)", value: formatCurrency(summary.printwayRefundUsd), icon: RefreshCw }
        ]
      });
    } else {
      setCalculationDetail({
        title: "Chi tiết Tổng Chi Vận Hành",
        formula: "Chi Quỹ + PW + Ebay + Lương + Phí Partner + GKE",
        items: [
          { label: "Chi Phí Vận Hành (USD)", value: formatCurrency(summary.fundExpenseUsd), icon: Wallet },
          { label: "Printway Payment (USD)", value: formatCurrency(summary.printwayOutUsd), icon: FileSpreadsheet },
          { label: "Chi Phí Ebay (USD)", value: formatCurrency(summary.ebayOutUsd), icon: ShoppingBag },
          { label: "Lương Nhân Sự (USD)", value: formatCurrency(summary.salaryOutUsd), icon: HandCoins },
          { label: "Phí Partner 3-5% (USD)", value: formatCurrency(summary.partnerFeesUsd), icon: Users },
          { label: "Chi phí GKE (USD)", value: formatCurrency(summary.gkeOutUsd), icon: Box }
        ]
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col bg-gray-100 gap-6 overflow-x-hidden pb-20 font-sans text-gray-800">
      {canViewSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <div onClick={() => showDetailModal('income')} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-emerald-200 cursor-pointer group transition-all">
                <div className="flex justify-between items-start"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">Tổng Thu <HelpCircle size={10}/></span></div>
                <div className="mt-4"><p className="text-2xl font-black text-emerald-600">{formatCurrency(summary.totalIncomeUsd)}</p></div>
            </div>
            <div onClick={() => showDetailModal('expense')} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-rose-200 cursor-pointer group transition-all">
                <div className="flex justify-between items-start"><div className="p-3 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform"><TrendingDown size={24}/></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">Tổng Chi <HelpCircle size={10}/></span></div>
                <div className="mt-4"><p className="text-2xl font-black text-rose-600">{formatCurrency(summary.totalExpenseUsd)}</p></div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start"><div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><DollarSign size={24}/></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dư Quỹ (USD)</span></div>
                <div className="mt-4"><p className={`text-2xl font-black ${summary.balanceUsd >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(summary.balanceUsd)}</p></div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start"><div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><ArrowRightLeft size={24}/></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dòng Tiền Net Store</span></div>
                <div className="mt-4"><p className={`text-2xl font-black ${summary.storeNetFlowUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(summary.storeNetFlowUsd)}</p></div>
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
            <select value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} className="px-4 py-2.5 bg-slate-100 border rounded-xl text-xs font-black">
               {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y.toString()}>Năm {y}</option>)}
            </select>
            <button onClick={() => { 
                if (activeTab === 'transactions') setIsAddModalOpen(true); 
                else if (activeTab === 'payments') setIsAddPaymentOpen(true); 
                else if (activeTab === 'printway') setIsPrintwayUploadOpen(true); 
                else if (activeTab === 'ebay') setIsEbayUploadOpen(true); 
                else if (activeTab === 'gke') setIsGKEUploadOpen(true);
            }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-white shadow-lg ${['printway', 'ebay', 'gke'].includes(activeTab) ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
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
            <div className="flex items-center gap-4 px-4 py-2 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Rate VND:</span>
                 <span className="text-xs font-black text-indigo-700">{rates.VND.toLocaleString()}</span>
               </div>
               <div className="w-px h-3 bg-indigo-200"></div>
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Rate AUD:</span>
                 <span className="text-xs font-black text-indigo-700">{rates.AUD.toFixed(2)}</span>
               </div>
            </div>
         </div>
         <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? <div className="py-20 text-center animate-pulse text-slate-400 uppercase font-black text-xs">Đang nạp dữ liệu...</div> : (
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10 text-[10px] font-black uppercase text-slate-600">
                    <tr>
                        <th className="px-6 py-5 w-12 text-center">STT</th>
                        {activeTab === 'printway' ? (
                          <>
                            <th className="px-6 py-5">InvoiceID</th>
                            <th className="px-6 py-5">Type</th>
                            <th className="px-6 py-5">Loại</th>
                            <th className="px-6 py-5 text-right">AmountUSD</th>
                            <th className="px-6 py-5 text-center">Date</th>
                          </>
                        ) : activeTab === 'payments' ? (
                          <>
                            <th className="px-6 py-5">Store</th>
                            <th className="px-6 py-5 text-center">Vùng</th>
                            <th className="px-6 py-5 text-right">Gốc</th>
                            <th className="px-6 py-5 text-right text-indigo-600">USD</th>
                            <th className="px-6 py-5 text-center">Ngày</th>
                          </>
                        ) : activeTab === 'ebay' ? (
                           <>
                             <th className="px-6 py-5">RecordID</th>
                             <th className="px-6 py-5">Type</th>
                             <th className="px-6 py-5 text-right">Amount</th>
                             <th className="px-6 py-5">Card Remark</th>
                             <th className="px-6 py-5 text-center">Time</th>
                           </>
                        ) : activeTab === 'salary' ? (
                           <>
                             <th className="px-6 py-5">Tháng</th>
                             <th className="px-6 py-5 text-right">VNĐ (Ô D3)</th>
                             <th className="px-6 py-5 text-right text-indigo-600">Quy đổi USD</th>
                             <th className="px-6 py-5 text-center">Nguồn</th>
                           </>
                        ) : activeTab === 'gke' ? (
                           <>
                             <th className="px-6 py-5">Order #</th>
                             <th className="px-6 py-5">Tracking #</th>
                             <th className="px-6 py-5">Country</th>
                             <th className="px-6 py-5 text-right">Value</th>
                             <th className="px-6 py-5 text-right">Weight GKE</th>
                             <th className="px-6 py-5 text-right text-indigo-600">COST (USD)</th>
                             <th className="px-6 py-5">Status</th>
                           </>
                        ) : (
                          <>
                            <th className="px-6 py-5">Nội dung</th>
                            <th className="px-6 py-5">Phân loại</th>
                            <th className="px-6 py-5 text-right">Tổng (VNĐ)</th>
                            <th className="px-6 py-5 text-center">Người chi</th>
                            <th className="px-6 py-5 text-center">Ngày</th>
                          </>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {activeTab === 'gke' && gkeRecords.filter(g => g.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())).map((g, i) => (
                       <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-black text-slate-700">{g.orderNumber}</td>
                        <td className="px-6 py-4 font-bold text-blue-600 text-xs">{g.trackingNumber}</td>
                        <td className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500">{g.country}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-600">{formatCurrency(g.value)}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-600">{g.weightGKE} kg</td>
                        <td className="px-6 py-4 text-right font-black text-indigo-600">{formatCurrency(g.cost)}</td>
                        <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-black uppercase">{g.status}</span></td>
                      </tr>
                    ))}
                    {activeTab === 'transactions' && transactions.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase())).map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{t.description}</td>
                        <td className="px-6 py-4 text-[10px] font-black text-indigo-500 uppercase">{t.subCategory}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-800">{t.totalAmount.toLocaleString()} đ</td>
                        <td className="px-6 py-4 text-center align-middle">
                             <button onClick={() => setEditingPayerId(t.id)} className="px-3 py-1 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:bg-indigo-50 transition-all flex items-center justify-center gap-1 mx-auto">
                               {t.payer}
                             </button>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500 text-[10px] font-bold">{t.date.split(' ')[0]}</td>
                      </tr>
                    ))}
                    {activeTab === 'payments' && sortedPayments.filter(p => p.storeName.toLowerCase().includes(searchTerm.toLowerCase())).map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-black uppercase text-slate-700">{p.storeName}</td>
                        <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-black text-[9px] uppercase">{p.region}</span></td>
                        <td className="px-6 py-4 text-right font-bold text-slate-600">{p.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-indigo-600">{formatCurrency(p.convertedUsd)}</td>
                        <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-500">{p.date}</td>
                      </tr>
                    ))}
                    {activeTab === 'printway' && printwayRecords.filter(p => p.invoiceId.toLowerCase().includes(searchTerm.toLowerCase())).map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-black text-slate-700">{p.invoiceId}</td>
                        <td className="px-6 py-4 text-[10px] uppercase font-bold text-slate-500">{p.type}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[9px] font-black border ${(p.loai || '').includes('Thu') ? 'bg-emerald-50 text-emerald-700' : (p.loai || '').includes('Nạp') ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-rose-50 text-rose-700'}`}>{p.loai}</span></td>
                        <td className="px-6 py-4 text-right font-black text-slate-800">{formatCurrency(p.amountUsd || p.totalAmount)}</td>
                        <td className="px-6 py-4 text-center text-slate-500 text-[10px] font-bold">{p.date.split(' ')[0]}</td>
                      </tr>
                    ))}
                    {activeTab === 'ebay' && ebayRecords.filter(e => e.recordId.toLowerCase().includes(searchTerm.toLowerCase())).map((e, i) => (
                       <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{i+1}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{e.recordId}</td>
                        <td className="px-6 py-4"><span className="px-2 py-0.5 bg-gray-100 rounded text-[9px] font-black uppercase text-slate-600">{e.type}</span></td>
                        <td className={`px-6 py-4 text-right font-black ${Number(e.amount) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(Number(e.amount))}</td>
                        <td className="px-6 py-4 text-[10px] italic text-slate-400">{e.cardRemark}</td>
                        <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-500">{e.accountingTime}</td>
                      </tr>
                    ))}
                    {activeTab === 'salary' && salaryRecords.map((sr, i) => (
                       <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-black text-slate-700">Tháng {sr.month}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">{sr.amountVnd.toLocaleString()} đ</td>
                        <td className="px-6 py-4 text-right font-black text-indigo-600">{formatCurrency(sr.amountUsd)}</td>
                        <td className="px-6 py-4 text-center text-[9px] text-slate-500 font-black uppercase">Sheet Chấm công</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
         </div>
      </div>

      {/* PRINTWAY UPLOAD MODAL */}
      {isPrintwayUploadOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải Printway Excel</h3>
                 <button onClick={() => setIsPrintwayUploadOpen(false)} className="p-2 text-slate-400 hover:text-slate-900"><X size={24}/></button>
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
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kéo thả file Printway.xlsx vào đây</p>
                    <input type="file" ref={printwayFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && processPrintwayFile(e.target.files[0])} />
                 </div>
                 {uploadData.length > 0 && (
                   <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700">Đã nạp {uploadData.length} dòng dữ liệu.</span>
                      <button onClick={handleUploadPrintway} disabled={isUploading} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md">
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : "Đồng bộ ngay"}
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* EBAY UPLOAD MODAL */}
      {isEbayUploadOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-in">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải Ebay Excel</h3>
                 <button onClick={() => setIsEbayUploadOpen(false)} className="p-2 text-slate-400 hover:text-slate-900"><X size={24}/></button>
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
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kéo thả file Ebay.xlsx vào đây</p>
                    <input type="file" ref={ebayFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && processEbayFile(e.target.files[0])} />
                 </div>
                 {ebayUploadData.length > 0 && (
                   <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700">Đã nạp {ebayUploadData.length} dòng Ebay.</span>
                      <button onClick={handleUploadEbay} disabled={isUploading} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md">
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : "Lưu vào Sheet"}
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
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải Dữ Liệu GKE</h3>
                 <button onClick={() => setIsGKEUploadOpen(false)} className="p-2 text-slate-400 hover:text-slate-900"><X size={24}/></button>
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
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kéo thả file Excel GKE vào đây</p>
                    <input type="file" ref={gkeFileInputRef} className="hidden" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && processGKEFile(e.target.files[0])} />
                 </div>
                 {gkeUploadData.length > 0 && (
                   <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-emerald-700">
                         <CheckCircle size={20}/>
                         <span className="text-xs font-bold">Đã phân tích {gkeUploadData.length} dòng GKE.</span>
                      </div>
                      <button onClick={handleUploadGKE} disabled={isUploading} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md flex items-center gap-2">
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : "Lưu vào Sheet"}
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* CALCULATION DETAIL MODAL */}
      {calculationDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slide-in">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{calculationDetail.title}</h3>
                 <button onClick={() => setCalculationDetail(null)} className="p-2 text-slate-400 hover:text-slate-900"><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Công thức tính</p>
                    <p className="text-xs font-bold text-indigo-700">{calculationDetail.formula}</p>
                 </div>
                 <div className="space-y-4">
                    {calculationDetail.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600"><item.icon size={18}/></div>
                            <span className="text-xs font-bold text-slate-600">{item.label}</span>
                         </div>
                         <span className="text-sm font-black text-slate-900">{item.value}</span>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="p-8 bg-gray-50 border-t border-slate-100 text-center">
                 <button onClick={() => setCalculationDetail(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Đã hiểu</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
