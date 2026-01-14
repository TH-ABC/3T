
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wallet, Plus, Calendar, Search, Loader2, Save, X, DollarSign, Users, Tag, Calculator, FileText, FileSpreadsheet, ExternalLink, TrendingUp, TrendingDown, RefreshCw, Layers, Globe, Store, CreditCard, Landmark, ArrowRightLeft, UserCheck, PieChart, Info, Upload, FileUp, AlertTriangle, CheckCircle, Clock, BarChart3, ShoppingBag, Edit2, ArrowUp, ArrowDown, HelpCircle, Check, MapPin, HandCoins } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { FinanceTransaction, FinanceMeta, PaymentRecord, User, PrintwayRecord, EbayRecord, StaffSalarySummary } from '../types';
import * as XLSX from 'xlsx';

interface FinanceBoardProps {
  user: User;
}

type FinanceTab = 'transactions' | 'payments' | 'printway' | 'ebay' | 'salary';

export const FinanceBoard: React.FC<FinanceBoardProps> = ({ user }) => {
  const [currentYear, setCurrentYear] = useState<string>("2026");
  const [activeTab, setActiveTab] = useState<FinanceTab>('transactions');
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [printwayRecords, setPrintwayRecords] = useState<PrintwayRecord[]>([]);
  const [ebayRecords, setEbayRecords] = useState<EbayRecord[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<StaffSalarySummary[]>([]);
  const [meta, setMeta] = useState<FinanceMeta>({ categories: ['Thu Tiền', 'Chi Tiền'], subCategories: [], payers: ['Hoàng'] });
  const [loading, setLoading] = useState(true);
  const [isSalaryLoading, setIsSalaryLoading] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [rates, setRates] = useState<{ VND: number, AUD: number }>({ VND: 25450, AUD: 1.54 });
  const [isRateLoading, setIsRateLoading] = useState(false);

  // States cho SORT
  const [paymentSortConfig, setPaymentSortConfig] = useState<{ key: keyof PaymentRecord; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [ebaySortConfig, setEbaySortConfig] = useState<{ key: keyof EbayRecord; direction: 'asc' | 'desc' }>({ key: 'accountingTime', direction: 'desc' });
  
  // States cho EDIT Payment
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentData, setEditPaymentData] = useState<Partial<PaymentRecord>>({});
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isNewStore, setIsNewStore] = useState(false); 

  const [isPrintwayUploadOpen, setIsPrintwayUploadOpen] = useState(false);
  const [isEbayUploadOpen, setIsEbayUploadOpen] = useState(false);
  const [isPayerStatsOpen, setIsPayerStatsOpen] = useState(false);
  const [calculationDetail, setCalculationDetail] = useState<{ title: string, items: { label: string, value: string, icon?: any }[], formula: string } | null>(null);
  
  const ebayFileInputRef = useRef<HTMLInputElement>(null);
  const printwayFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadData, setUploadData] = useState<PrintwayRecord[]>([]);
  const [ebayUploadData, setEbayUploadData] = useState<EbayRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [isAddingSubCat, setIsAddingSubCat] = useState(false);
  const [newSubCatValue, setNewSubCatValue] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = user.role.toLowerCase() === 'admin';
  const canViewSummary = isAdmin || user.permissions?.canViewFinanceSummary === true;
  const financeScope = user.permissions?.finance || 'all';

  const hasAccess = (tab: FinanceTab) => {
      if (isAdmin || financeScope === 'all') return true;
      const allowed = financeScope.split(',');
      if (tab === 'transactions') return allowed.includes('funds');
      if (tab === 'payments') return allowed.includes('payment');
      if (tab === 'printway') return allowed.includes('printway');
      if (tab === 'ebay') return allowed.includes('printway');
      if (tab === 'salary') return allowed.includes('funds');
      return false;
  };

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
      const [transResult, metaData, salaryResult] = await Promise.all([
        sheetService.getFinance(currentYear),
        sheetService.getFinanceMeta(),
        sheetService.getStaffSalarySummary(currentYear)
      ]);
      setTransactions(Array.isArray(transResult.transactions) ? transResult.transactions : []);
      setPayments(Array.isArray(transResult.payments) ? transResult.payments : []);
      setPrintwayRecords(Array.isArray(transResult.printway) ? transResult.printway : []);
      setEbayRecords(Array.isArray(transResult.ebay) ? transResult.ebay : []);
      setSalaryRecords(Array.isArray(salaryResult) ? salaryResult : []);
      setCurrentFileId(transResult.fileId);
      setMeta({
        categories: metaData.categories || ['Thu Tiền', 'Chi Tiền'],
        subCategories: metaData.subCategories || [],
        payers: metaData.payers || ['Hoàng']
      });
    } catch (e) { console.error("Load Finance Error:", e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchOnlineRates();
    loadData(); 
  }, [currentYear]);

  const storeRegionMap = useMemo(() => {
    const map: Record<string, 'Au' | 'Us' | 'VN'> = {};
    [...payments].reverse().forEach(p => {
        if (p.storeName && !map[p.storeName]) {
            map[p.storeName] = p.region;
        }
    });
    return map;
  }, [payments]);

  const existingStoreNames = useMemo(() => Object.keys(storeRegionMap).sort(), [storeRegionMap]);

  useEffect(() => {
      if (isAddPaymentOpen) {
          setIsNewStore(existingStoreNames.length === 0);
          if (existingStoreNames.length > 0) {
              const firstStore = existingStoreNames[0];
              setPaymentData(prev => ({ 
                  ...prev, 
                  storeName: firstStore, 
                  region: storeRegionMap[firstStore] || 'Us',
                  amount: 0
              }));
          }
      }
  }, [isAddPaymentOpen, existingStoreNames]);

  const robustParseNumber = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    let str = String(val).replace(/[^\d,.-]/g, '');
    if (str.includes(',') && !str.includes('.')) {
        const parts = str.split(',');
        if (parts[parts.length - 1].length <= 2) str = str.replace(',', '.');
        else str = str.replace(/,/g, '');
    } else if (str.includes(',') && str.includes('.')) {
        str = str.replace(/,/g, '');
    }
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  };

  const formatAsUsd = (vndValue: any) => {
    const numVnd = robustParseNumber(vndValue);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numVnd / rates.VND);
  };

  const formatAsVnd = (value: any) => {
    const num = robustParseNumber(value);
    return num.toLocaleString('vi-VN') + " đ";
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const summary = useMemo(() => {
    let fundIncomeVnd = 0, fundExpenseVnd = 0;
    const payerMap: Record<string, { in: number, out: number }> = {};
    
    transactions.forEach(t => {
      const amount = robustParseNumber(t.totalAmount);
      const pName = t.payer || 'Hoàng';
      if (!payerMap[pName]) payerMap[pName] = { in: 0, out: 0 };
      if (t.category === 'Thu Tiền') { fundIncomeVnd += amount; payerMap[pName].in += amount; }
      if (t.category === 'Chi Tiền') { fundExpenseVnd += amount; payerMap[pName].out += amount; }
    });

    let paymentTotalUsd = 0;
    payments.forEach(p => { paymentTotalUsd += robustParseNumber(p.convertedUsd); });
    
    let printwayOutUsd = 0;
    printwayRecords.forEach(pw => {
      const amt = robustParseNumber(pw.totalAmount);
      if ((pw.type || '').toLowerCase() === 'payment') printwayOutUsd += amt;
    });

    let ebayOutUsd = 0;
    ebayRecords.forEach(eb => {
      if (eb.type !== 'Account Top-up') {
        ebayOutUsd -= robustParseNumber(eb.amount); 
      }
    });

    let salaryOutUsd = 0;
    salaryRecords.forEach(sr => {
        salaryOutUsd += robustParseNumber(sr.amountUsd);
    });

    const fundIncomeUsd = fundIncomeVnd / rates.VND;
    const fundExpenseUsd = fundExpenseVnd / rates.VND;

    const totalIncomeUsd = fundIncomeUsd + paymentTotalUsd;
    const totalExpenseUsd = fundExpenseUsd + printwayOutUsd + ebayOutUsd + salaryOutUsd;
    const storeNetFlowUsd = paymentTotalUsd - printwayOutUsd - ebayOutUsd;
    
    return { 
      totalIncomeUsd, totalExpenseUsd, balanceUsd: totalIncomeUsd - totalExpenseUsd, 
      paymentTotalUsd, fundIncomeUsd, fundExpenseUsd, printwayOutUsd, ebayOutUsd, salaryOutUsd, storeNetFlowUsd,
      payerStats: Object.entries(payerMap).sort((a, b) => b[1].out - a[1].out) 
    };
  }, [transactions, payments, printwayRecords, ebayRecords, salaryRecords, rates]);

  // LOGIC SORT PAYMENT
  const handlePaymentSort = (key: keyof PaymentRecord) => {
    setPaymentSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedPayments = useMemo(() => {
    const data = payments.filter(p => (p.storeName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return [...data].sort((a, b) => {
        const { key, direction } = paymentSortConfig;
        const valA = a[key] ?? '';
        const valB = b[key] ?? '';
        if (valA === valB) return 0;
        const result = valA > valB ? 1 : -1;
        return direction === 'asc' ? result : -result;
    });
  }, [payments, searchTerm, paymentSortConfig]);

  // LOGIC SORT EBAY
  const handleEbaySort = (key: keyof EbayRecord) => {
    setEbaySortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedEbay = useMemo(() => {
    const data = ebayRecords.filter(e => 
      (e.recordId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.cardRemark || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...data].sort((a, b) => {
        const { key, direction } = ebaySortConfig;
        const valA = a[key] ?? '';
        const valB = b[key] ?? '';
        if (valA === valB) return 0;
        const result = valA > valB ? 1 : -1;
        return direction === 'asc' ? result : -result;
    });
  }, [ebayRecords, searchTerm, ebaySortConfig]);

  const handleStartEditPayment = (p: PaymentRecord) => {
    setEditingPaymentId(p.id);
    setEditPaymentData({ ...p });
  };

  const handleSaveEditPayment = async (id: string) => {
    if (!currentFileId) return;
    setIsUpdatingPayment(true);
    try {
        let newAmount = robustParseNumber(editPaymentData.amount);
        let newRegion = editPaymentData.region || 'Us';
        let newConverted = newAmount;
        if (newRegion === 'Au') newConverted = newAmount / rates.AUD;
        else if (newRegion === 'VN') newConverted = newAmount / rates.VND;
        const updatedData = { ...editPaymentData, convertedUsd: newConverted };
        const fields = ['StoreName', 'Amount', 'Region', 'ConvertedUSD', 'Date'];
        const values = [updatedData.storeName, updatedData.amount, updatedData.region, updatedData.convertedUsd, updatedData.date];
        for (let i = 0; i < fields.length; i++) {
            const res = await sheetService.updatePaymentField(currentYear, id, fields[i], values[i]);
            if (!res.success) throw new Error(res.error || "Update failed");
        }
        setPayments(prev => prev.map(p => p.id === id ? (updatedData as PaymentRecord) : p));
        setEditingPaymentId(null);
    } catch (e: any) { alert("Lỗi khi lưu cập nhật Payment: " + e.message); } 
    finally { setIsUpdatingPayment(false); }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFileId) return;
    setIsSubmitting(true);
    const totalAmount = robustParseNumber(formData.quantity || 1) * robustParseNumber(formData.unitPrice || 0);
    try {
      const res = await sheetService.addFinance(currentYear, { ...formData, totalAmount, date: formData.date?.replace('T', ' ') });
      if (res.success) { 
        setTransactions(prev => [res.transaction, ...prev]); 
        setIsAddModalOpen(false); 
        setFormData({ ...formData, description: '', unitPrice: 0, date: new Date().toISOString().slice(0, 16) }); 
      }
    } finally { setIsSubmitting(false); }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFileId) return;
    setIsSubmitting(true);
    let converted = robustParseNumber(paymentData.amount);
    if (paymentData.region === 'Au') converted = converted / rates.AUD;
    else if (paymentData.region === 'VN') converted = converted / rates.VND;
    try {
      const res = await sheetService.addPayment(currentYear, { ...paymentData, convertedUsd: converted });
      if (res.success) { 
        setPayments(prev => [res.payment, ...prev]); 
        setIsAddPaymentOpen(false); 
        setPaymentData({ storeName: '', amount: 0, region: 'Us', date: new Date().toISOString().split('T')[0] }); 
      }
    } finally { setIsSubmitting(false); }
  };

  const handleAddNewSubCat = async () => {
    if (!newSubCatValue.trim()) return;
    setIsSavingMeta(true);
    try {
        const res = await sheetService.addFinanceMeta('subCategory', newSubCatValue.trim());
        if (res.success) {
            setMeta(prev => ({ ...prev, subCategories: [...prev.subCategories, newSubCatValue.trim()] }));
            setFormData(prev => ({ ...prev, subCategory: newSubCatValue.trim() }));
            setNewSubCatValue('');
            setIsAddingSubCat(false);
        }
    } catch (e) {
        alert("Lỗi khi thêm phân loại mới.");
    } finally {
        setIsSavingMeta(false);
    }
  };

  const processPrintwayFile = (file: File) => {
    const reader = new FileReader();
    const existingIds = new Set(printwayRecords.map(r => String(r.invoiceId).trim()));
    reader.onload = (event) => {
      try {
        const binaryData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binaryData, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            alert("File Excel không có dữ liệu.");
            return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        let rawParsed: PrintwayRecord[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const cols = jsonData[i];
          if (!cols || cols.length < 4 || !cols[0]) continue;
          const invoiceId = String(cols[0]).trim();
          if (existingIds.has(invoiceId)) continue;
          const type = String(cols[1] || '').trim();
          const amountUsd = robustParseNumber(cols[5]);
          const fee = robustParseNumber(cols[6]);
          let totalAmount = robustParseNumber(cols[7]);
          if (totalAmount === 0 && (amountUsd !== 0 || fee !== 0)) totalAmount = amountUsd + fee;
          const isExpenseType = type.toLowerCase() === 'payment';
          rawParsed.push({
            invoiceId: invoiceId, type: type, status: String(cols[2] || 'Completed'),
            date: cols[3] instanceof Date ? cols[3].toLocaleString('vi-VN') : String(cols[3]),
            method: String(cols[4] || 'Wallet'), amountUsd: amountUsd, fee: fee, totalAmount: totalAmount,
            note: String(cols[8] || ''), loai: isExpenseType ? 'Chi Tiền' : 'Khác'
          });
        }
        setUploadData(rawParsed);
      } catch (err) { alert("Lỗi xử lý file Excel Printway."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadPrintway = async () => {
    if (uploadData.length === 0 || !currentFileId) return;
    setIsUploading(true);
    try {
      const res = await sheetService.addPrintwayBatch(currentYear, uploadData);
      if (res.success) { setIsPrintwayUploadOpen(false); setUploadData([]); loadData(); }
    } finally { setIsUploading(false); }
  };

  const processEbayFile = (file: File) => {
    const reader = new FileReader();
    const existingIds = new Set(ebayRecords.map(r => String(r.recordId).trim()));
    reader.onload = (event) => {
      try {
        const binaryData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binaryData, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        let rawParsed: EbayRecord[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const cols = jsonData[i];
          if (!cols || cols.length < 4 || !cols[0]) continue;
          const recordId = String(cols[0]).trim();
          if (existingIds.has(recordId)) continue;
          rawParsed.push({
            recordId: recordId, accountingTime: cols[1] instanceof Date ? cols[1].toLocaleString('vi-VN') : String(cols[1]),
            type: String(cols[2] || '').trim(), amount: robustParseNumber(cols[3]), cardRemark: String(cols[21] || '').trim()
          });
        }
        setEbayUploadData(rawParsed);
      } catch (err) { alert("Lỗi định dạng file Ebay."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadEbay = async () => {
    if (ebayUploadData.length === 0 || !currentFileId) return;
    setIsUploading(true);
    try {
      const res = await sheetService.addEbayBatch(currentYear, ebayUploadData);
      if (res.success) { setIsEbayUploadOpen(false); setEbayUploadData([]); loadData(); }
    } finally { setIsUploading(false); }
  };

  const filteredTransactions = transactions.filter(t => (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) || (t.subCategory || '').toLowerCase().includes(searchTerm.toLowerCase()) || (t.payer || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredPrintway = printwayRecords.filter(pw => (pw.invoiceId || '').toLowerCase().includes(searchTerm.toLowerCase()) || (pw.note || '').toLowerCase().includes(searchTerm.toLowerCase()) || (pw.type || '').toLowerCase().includes(searchTerm.toLowerCase()));

  const showDetailModal = (type: 'income' | 'expense' | 'balance' | 'store') => {
      if (type === 'income') {
          setCalculationDetail({
              title: "Cách tính Tổng Thu Hệ Thống",
              formula: "Tổng Thu = (Tổng Thu nhập từ Chi phí công ty / Tỷ giá) + Tổng Funds Received (USD)",
              items: [
                  { label: "Thu từ Chi phí công ty (VND)", value: formatAsVnd(summary.fundIncomeUsd * rates.VND), icon: Wallet },
                  { label: "Thu từ Chi phí công ty (Quy đổi USD)", value: formatCurrency(summary.fundIncomeUsd), icon: DollarSign },
                  { label: "Tiền từ Funds Received (USD)", value: formatCurrency(summary.paymentTotalUsd), icon: Landmark },
              ]
          });
      } else if (type === 'expense') {
          setCalculationDetail({
              title: "Cách tính Tổng Chi Vận Hành",
              formula: "Tổng Chi = (Chi phí C.ty / Tỷ giá) + Lương NV (USD) + Chi Printway (Payment) + Chi Ebay (USD)",
              items: [
                  { label: "Chi phí công ty (VND)", value: formatAsVnd(summary.fundExpenseUsd * rates.VND), icon: Wallet },
                  { label: "Lương Nhân Viên (USD)", value: formatCurrency(summary.salaryOutUsd), icon: HandCoins },
                  { label: "Chi phí Printway (Payment)", value: formatCurrency(summary.printwayOutUsd), icon: FileSpreadsheet },
                  { label: "Chi phí Ebay (USD)", value: formatCurrency(summary.ebayOutUsd), icon: ShoppingBag },
              ]
          });
      } else if (type === 'balance') {
          setCalculationDetail({
              title: "Cách tính Dư Quỹ Tổng",
              formula: "Dư Quỹ = Tổng Thu Hệ Thống - Tổng Chi Vận Hành",
              items: [
                  { label: "Tổng Thu Hệ Thống (USD)", value: formatCurrency(summary.totalIncomeUsd), icon: TrendingUp },
                  { label: "Tổng Chi Vận Hành (USD)", value: formatCurrency(summary.totalExpenseUsd), icon: TrendingDown },
              ]
          });
      } else if (type === 'store') {
          setCalculationDetail({
              title: "Cách tính Dòng Tiền Store",
              formula: "Dòng Tiền Store = Tiền Funds Received - Chi Printway (Payment) - Chi Ebay",
              items: [
                  { label: "Tiền Funds Received (USD)", value: formatCurrency(summary.paymentTotalUsd), icon: Landmark },
                  { label: "Chi Printway (Payment)", value: formatCurrency(summary.printwayOutUsd), icon: FileSpreadsheet },
                  { label: "Chi Ebay (USD)", value: formatCurrency(summary.ebayOutUsd), icon: ShoppingBag },
              ]
          });
      }
  };

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col bg-gray-100 gap-6 overflow-x-hidden pb-20 font-sans text-gray-800">
      
      {/* DASHBOARD STATS */}
      {canViewSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <div onClick={() => showDetailModal('income')} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-emerald-200 transition-all flex flex-col justify-between cursor-pointer group">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right leading-tight flex items-center gap-1">Tổng Thu Hệ Thống <HelpCircle size={10}/></span>
                </div>
                <div className="mt-4">
                    <p className="text-2xl font-black text-emerald-600 leading-none">{formatCurrency(summary.totalIncomeUsd)}</p>
                    <div className="mt-2 flex flex-col gap-0.5 opacity-60">
                        <span className="text-[9px] font-bold">C.Ty: {formatCurrency(summary.fundIncomeUsd)}</span>
                        <span className="text-[9px] font-bold">Funds: {formatCurrency(summary.paymentTotalUsd)}</span>
                    </div>
                </div>
            </div>
            <div onClick={() => showDetailModal('expense')} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-rose-200 transition-all flex flex-col justify-between cursor-pointer group">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform"><TrendingDown size={24}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right leading-tight flex items-center gap-1">Tổng Chi Vận Hành <HelpCircle size={10}/></span>
                </div>
                <div className="mt-4">
                    <p className="text-2xl font-black text-rose-600 leading-none">{formatCurrency(summary.totalExpenseUsd)}</p>
                    <div className="mt-2 flex flex-col gap-0.5 opacity-60">
                        <span className="text-[9px] font-bold">Lương NV: {formatCurrency(summary.salaryOutUsd)}</span>
                        <span className="text-[9px] font-bold">PW/Ebay: {formatCurrency(summary.printwayOutUsd + summary.ebayOutUsd)}</span>
                    </div>
                </div>
            </div>
            <div onClick={() => showDetailModal('balance')} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-indigo-200 transition-all flex flex-col justify-between cursor-pointer group">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform"><DollarSign size={24}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right leading-tight flex items-center gap-1">Dư Quỹ (USD) <HelpCircle size={10}/></span>
                </div>
                <div className="mt-4"><p className={`text-2xl font-black leading-none ${summary.balanceUsd >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatCurrency(summary.balanceUsd)}</p></div>
            </div>
            <div onClick={() => showDetailModal('store')} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-amber-200 transition-all flex flex-col justify-between cursor-pointer group">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-inner group-hover:scale-110 transition-transform"><ArrowRightLeft size={24}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right leading-tight flex items-center gap-1">Dòng Tiền Store <HelpCircle size={10}/></span>
                </div>
                <div className="mt-4"><p className={`text-2xl font-black leading-none ${summary.storeNetFlowUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(summary.storeNetFlowUsd)}</p></div>
            </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4 text-slate-400 shadow-sm"><Info size={20} /><span className="text-xs font-black uppercase tracking-widest">Bảng tóm tắt tài chính đang được khóa</span></div>
      )}

      {/* NAVIGATION */}
      <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 w-full md:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'transactions', label: 'Chi phí công ty', icon: <Wallet size={16}/> },
            { id: 'payments', label: 'Funds', icon: <Landmark size={16}/> },
            { id: 'printway', label: 'Printway', icon: <FileSpreadsheet size={16}/> },
            { id: 'ebay', label: 'Ebay', icon: <ShoppingBag size={16}/> },
            { id: 'salary', label: 'Lương NV', icon: <HandCoins size={16}/> }
          ].filter(t => hasAccess(t.id as FinanceTab)).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as FinanceTab)} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-800'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 px-2 w-full md:w-auto">
            <select value={currentYear} onChange={(e) => setCurrentYear(e.target.value)} className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/20">
               {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y.toString()}>Năm {y}</option>)}
            </select>
            {activeTab === 'transactions' && (
              <button onClick={() => setIsPayerStatsOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-all active:scale-95 shadow-sm">
                <BarChart3 size={16} /> Thống kê người chi
              </button>
            )}
            {activeTab !== 'salary' && (
                <button onClick={() => {
                if (activeTab === 'transactions') setIsAddModalOpen(true);
                else if (activeTab === 'payments') setIsAddPaymentOpen(true);
                else if (activeTab === 'printway') setIsPrintwayUploadOpen(true);
                else if (activeTab === 'ebay') setIsEbayUploadOpen(true);
                }} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all text-white ${activeTab === 'printway' || activeTab === 'ebay' ? 'bg-emerald-600 hover:bg-emerald-700' : activeTab === 'payments' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                <Plus size={18} /> {activeTab === 'printway' || activeTab === 'ebay' ? `Tải ${activeTab.toUpperCase()}` : activeTab === 'payments' ? 'Nhập Funds' : 'Ghi Chi Phí'}
                </button>
            )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[500px]">
         <div className="p-5 border-b border-slate-100 flex justify-between items-center gap-4 bg-slate-50/30">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Tìm kiếm..." className="pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-full outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
               {activeTab === 'salary' ? `Tổng 12 tháng` : activeTab === 'ebay' ? `Tổng: ${ebayRecords.length} dòng` : activeTab === 'payments' ? `Tổng: ${payments.length} bản ghi` : activeTab === 'transactions' ? `Tổng: ${transactions.length} dòng` : `Tổng: ${printwayRecords.length} dòng`}
            </div>
         </div>

         <div className="flex-1 overflow-auto custom-scrollbar relative">
            {activeTab === 'salary' ? (
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm text-[10px]">
                        <tr>
                            <th className="px-8 py-5 border-b">Tháng (Năm {currentYear})</th>
                            <th className="px-8 py-5 border-b text-right">Tổng Lương (VNĐ)</th>
                            <th className="px-8 py-5 border-b text-right text-indigo-600">Quy đổi (USD)</th>
                            <th className="px-8 py-5 border-b text-center">Nguồn dữ liệu</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={4} className="py-32 text-center text-slate-300 animate-pulse">Đang nạp bảng lương...</td></tr>
                        ) : salaryRecords.length === 0 ? (
                            <tr><td colSpan={4} className="py-20 text-center text-slate-300 italic font-bold">Chưa có dữ liệu lương năm {currentYear}</td></tr>
                        ) : (
                            salaryRecords.map((sr, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-8 py-5 font-black text-slate-700 uppercase tracking-widest text-xs">Tháng {sr.month}</td>
                                    <td className="px-8 py-5 text-right font-black text-slate-900">{formatAsVnd(sr.amountVnd)}</td>
                                    <td className="px-8 py-5 text-right font-black text-indigo-600 text-base">{formatCurrency(sr.amountUsd)}</td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase border border-slate-200">Sheet: Chấm công (D3)</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {!loading && salaryRecords.length > 0 && (
                        <tfoot className="bg-slate-900 text-white font-black">
                            <tr>
                                <td className="px-8 py-6 uppercase tracking-[0.2em] text-xs">Tổng Lương Cả Năm</td>
                                <td className="px-8 py-6 text-right text-emerald-400 text-lg">{formatAsVnd(salaryRecords.reduce((sum, r) => sum + r.amountVnd, 0))}</td>
                                <td className="px-8 py-6 text-right text-emerald-400 text-lg">{formatCurrency(salaryRecords.reduce((sum, r) => sum + r.amountUsd, 0))}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            ) : activeTab === 'payments' ? (
              <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm text-[10px]">
                      <tr>
                          <th className="px-6 py-5 border-b w-12 text-center">STT</th>
                          <th className="px-6 py-5 border-b cursor-pointer group" onClick={() => handlePaymentSort('storeName')}>
                             <div className="flex items-center gap-1">Tên Store {paymentSortConfig.key === 'storeName' && (paymentSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b text-center cursor-pointer" onClick={() => handlePaymentSort('region')}>
                             <div className="flex items-center justify-center gap-1">Vùng {paymentSortConfig.key === 'region' && (paymentSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b text-right cursor-pointer" onClick={() => handlePaymentSort('amount')}>
                             <div className="flex items-center justify-end gap-1">Số tiền {paymentSortConfig.key === 'amount' && (paymentSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b text-right text-orange-600 font-black cursor-pointer" onClick={() => handlePaymentSort('convertedUsd')}>
                             <div className="flex items-center justify-end gap-1">USD {paymentSortConfig.key === 'convertedUsd' && (paymentSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b text-center cursor-pointer" onClick={() => handlePaymentSort('date')}>
                             <div className="flex items-center justify-center gap-1">Ngày nhận {paymentSortConfig.key === 'date' && (paymentSortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b text-center w-24">Sửa</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {loading ? (
                        <tr><td colSpan={7} className="py-32 text-center text-slate-300 animate-pulse">Đang nạp dữ liệu năm {currentYear}...</td></tr>
                      ) : sortedPayments.length === 0 ? (
                        <tr><td colSpan={7} className="py-20 text-center text-slate-300 italic font-bold">Trống</td></tr>
                      ) : (
                        sortedPayments.map((p, idx) => {
                          const isEditing = editingPaymentId === p.id;
                          return (
                            <tr key={p.id || idx} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-indigo-50/30' : ''}`}>
                                <td className="px-6 py-5 text-center text-slate-300 font-mono text-xs">{idx + 1}</td>
                                <td className="px-6 py-5 font-black text-slate-800 uppercase tracking-tight">
                                    {isEditing ? (
                                        <input type="text" className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-sm outline-none" value={editPaymentData.storeName} onChange={(e) => setEditPaymentData({...editPaymentData, storeName: e.target.value})} />
                                    ) : p.storeName}
                                </td>
                                <td className="px-6 py-5 text-center">
                                    {isEditing ? (
                                        <select className="bg-white border border-indigo-200 rounded px-2 py-1 text-xs outline-none" value={editPaymentData.region} onChange={(e) => setEditPaymentData({...editPaymentData, region: e.target.value as any})}>
                                            <option value="Us">Us</option><option value="Au">Au</option><option value="VN">VN</option>
                                        </select>
                                    ) : (
                                        <span className={`px-4 py-1 rounded-xl text-[10px] font-black uppercase border ${p.region === 'Us' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>{p.region}</span>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-right font-bold text-slate-500">
                                    {isEditing ? (
                                        <input type="number" className="w-24 bg-white border border-indigo-200 rounded px-2 py-1 text-right text-sm outline-none" value={editPaymentData.amount} onChange={(e) => setEditPaymentData({...editPaymentData, amount: Number(e.target.value)})} />
                                    ) : (
                                        <>{p.amount.toLocaleString()} {p.region === 'VN' ? 'đ' : p.region}</>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-right font-black text-orange-600 text-base">
                                    {isEditing ? (
                                        <span className="opacity-40 italic text-xs">Auto calc...</span>
                                    ) : formatCurrency(p.convertedUsd)}
                                </td>
                                <td className="px-6 py-5 text-center text-slate-400 text-[10px] font-bold">
                                    {isEditing ? (
                                        <input type="date" className="bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] outline-none" value={editPaymentData.date} onChange={(e) => setEditPaymentData({...editPaymentData, date: e.target.value})} />
                                    ) : p.date}
                                </td>
                                <td className="px-6 py-5 text-center">
                                    {isEditing ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => handleSaveEditPayment(p.id)} disabled={isUpdatingPayment} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50">
                                                {isUpdatingPayment ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            </button>
                                            <button onClick={() => setEditingPaymentId(null)} className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => handleStartEditPayment(p)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                          );
                        })
                      )}
                  </tbody>
              </table>
            ) : activeTab === 'ebay' ? (
              <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm text-[10px]">
                      <tr>
                          <th className="px-6 py-5 border-b w-12 text-center">STT</th>
                          <th className="px-6 py-5 border-b cursor-pointer" onClick={() => handleEbaySort('recordId')}>
                             <div className="flex items-center gap-1">Record ID {ebaySortConfig.key === 'recordId' && (ebaySortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b cursor-pointer" onClick={() => handleEbaySort('accountingTime')}>
                             <div className="flex items-center gap-1">Accounting Time {ebaySortConfig.key === 'accountingTime' && (ebaySortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b cursor-pointer text-center" onClick={() => handleEbaySort('type')}>
                             <div className="flex items-center justify-center gap-1">Type {ebaySortConfig.key === 'type' && (ebaySortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b text-center">Loại tiền</th>
                          <th className="px-6 py-5 border-b text-right cursor-pointer" onClick={() => handleEbaySort('amount')}>
                             <div className="flex items-center justify-end gap-1">Amount (USD) {ebaySortConfig.key === 'amount' && (ebaySortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                          </th>
                          <th className="px-6 py-5 border-b">Card Remark</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {loading ? (
                        <tr><td colSpan={7} className="py-32 text-center text-slate-300 animate-pulse">Đang nạp dữ liệu năm {currentYear}...</td></tr>
                      ) : sortedEbay.length === 0 ? (
                        <tr><td colSpan={7} className="py-20 text-center text-slate-300 italic font-bold">Trống</td></tr>
                      ) : (
                        sortedEbay.map((e, idx) => {
                          const isTopup = e.type === 'Account Top-up';
                          return (
                            <tr key={e.recordId || idx} className={`hover:bg-slate-50/50 transition-colors ${isTopup ? 'bg-slate-50/30' : ''}`}>
                                <td className="px-6 py-4 text-center text-slate-300 font-mono text-xs">{idx + 1}</td>
                                <td className="px-6 py-4 font-black text-slate-800 tracking-tight">{e.recordId}</td>
                                <td className="px-6 py-4 text-xs font-bold text-slate-400">{e.accountingTime}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${isTopup ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                    {e.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {!isTopup ? (
                                        <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black uppercase shadow-sm">Chi Tiền</span>
                                    ) : <span className="text-slate-300">---</span>}
                                </td>
                                <td className={`px-6 py-4 text-right font-black text-base ${isTopup ? 'text-slate-300' : robustParseNumber(e.amount) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {isTopup ? "$0.00" : formatCurrency(robustParseNumber(e.amount))}
                                </td>
                                <td className="px-6 py-4 text-[10px] text-slate-500 italic max-w-xs truncate">{e.cardRemark || '---'}</td>
                            </tr>
                          );
                        })
                      )}
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
                        {loading ? <tr><td colSpan={7} className="py-32 text-center text-slate-300 animate-pulse">Đang tải...</td></tr> : filteredTransactions.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-6 py-5 text-center text-slate-300 font-mono text-xs">{idx + 1}</td>
                                <td className="px-6 py-5"><span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${t.category === 'Thu Tiền' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{t.category}</span></td>
                                <td className="px-6 py-5 font-bold text-slate-700">{t.description}</td>
                                <td className="px-6 py-5 text-right font-black text-slate-900">{formatAsVnd(t.totalAmount)}</td>
                                <td className="px-6 py-5 text-right font-black text-indigo-600">{formatAsUsd(t.totalAmount)}</td>
                                <td className="px-6 py-5 text-center text-[10px] font-black uppercase text-slate-500">{t.payer}</td>
                                <td className="px-6 py-5 text-slate-400 text-[10px] font-bold">{t.date.split(' ')[0]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
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
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <tr><td colSpan={7} className="py-32 text-center text-slate-300 animate-pulse">Trống...</td></tr> : filteredPrintway.map((pw, idx) => {
                            const isExpense = (pw.type || '').toLowerCase() === 'payment';
                            return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-5 text-center text-slate-300 font-mono text-xs">{idx + 1}</td>
                                    <td className="px-6 py-5 font-bold text-slate-700">{pw.invoiceId}</td>
                                    <td className="px-6 py-5 text-[10px] font-bold text-slate-500 uppercase">{pw.type}</td>
                                    <td className="px-6 py-5"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${isExpense ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{pw.loai || pw.type}</span></td>
                                    <td className={`px-6 py-5 text-right font-black text-base ${isExpense ? 'text-rose-600' : 'text-slate-400'}`}>{formatCurrency(robustParseNumber(pw.totalAmount))}</td>
                                    <td className="px-6 py-5 text-center text-[10px] font-black uppercase text-slate-400 bg-slate-50 rounded-lg">{pw.method}</td>
                                    <td className="px-6 py-5 text-slate-400 font-mono text-[10px] font-bold">{pw.date}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
         </div>
      </div>

      {/* --- MODALS --- */}
      {calculationDetail && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setCalculationDetail(null)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden relative animate-slide-in border border-white/20">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{calculationDetail.title}</h3>
                 <button onClick={() => setCalculationDetail(null)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm transition-all"><X size={20}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="bg-slate-900 rounded-2xl p-6 text-indigo-400 font-mono text-xs leading-relaxed shadow-inner">
                    <div className="text-indigo-200 mb-2 opacity-60 uppercase tracking-widest text-[9px]">Công thức:</div>
                    {calculationDetail.formula}
                 </div>
                 <div className="space-y-4">
                    {calculationDetail.items.map((item, idx) => (
                       <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-3">
                             {item.icon && <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm"><item.icon size={16}/></div>}
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                          </div>
                          <span className="text-sm font-black text-slate-800">{item.value}</span>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-slate-100 text-center">
                 <p className="text-[9px] text-slate-400 font-bold uppercase mb-4">Mọi dữ liệu được lấy từ file Finance {currentYear}</p>
                 <button onClick={() => setCalculationDetail(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Đã hiểu</button>
              </div>
           </div>
        </div>
      )}

      {isPayerStatsOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsPayerStatsOpen(false)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden relative flex flex-col border border-white/20">
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
                            <tr><th>Cá nhân / Đơn vị</th><th className="text-right">Tổng Thu</th><th className="text-right">Tổng Chi</th><th className="text-right">Số dư</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {summary.payerStats.map(([name, stats]) => (
                                <tr key={name} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-4 font-black text-slate-700">{name}</td>
                                    <td className="px-4 py-4 text-right font-bold text-emerald-600">{stats.in.toLocaleString()} đ</td>
                                    <td className="px-4 py-4 text-right font-bold text-rose-600">{stats.out.toLocaleString()} đ</td>
                                    <td className={`px-4 py-4 text-right font-black ${stats.in - stats.out >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{(stats.in - stats.out).toLocaleString()} đ</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* EBAY UPLOAD MODAL */}
      {isEbayUploadOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isUploading && setIsEbayUploadOpen(false)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden relative flex flex-col border border-white/20">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-yellow-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-600 text-white rounded-2xl shadow-xl shadow-yellow-100"><ShoppingBag size={24}/></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải dữ liệu Ebay</h3>
                 </div>
                 <button onClick={() => setIsEbayUploadOpen(false)} disabled={isUploading} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm"><X size={20}/></button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                {ebayUploadData.length === 0 ? (
                  <div 
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }} 
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }} 
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processEbayFile(f); }} 
                    className={`py-20 flex flex-col items-center justify-center border-4 border-dashed rounded-[3rem] transition-all cursor-pointer ${isDragging ? 'bg-yellow-100 border-yellow-500' : 'bg-slate-50/50 border-slate-100'}`} 
                    onClick={() => ebayFileInputRef.current?.click()}
                  >
                    <input type="file" accept=".xlsx,.xls" ref={ebayFileInputRef} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processEbayFile(f); }} />
                    <Upload size={40} className="text-slate-200 mb-6"/>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-center px-4">Kéo thả file Ebay Excel tại đây để xử lý</p>
                    <p className="text-[10px] text-slate-300 font-bold mt-2 italic text-center px-8">(Tự động loại bỏ trùng lặp Record ID)</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-2xl flex items-center justify-between">
                       <span className="text-sm font-black text-yellow-700 uppercase">Phát hiện {ebayUploadData.length} giao dịch Ebay mới.</span>
                       <button onClick={() => setEbayUploadData([])} className="text-rose-600 text-[10px] font-black uppercase underline">Hủy</button>
                    </div>
                    <table className="w-full text-[10px] text-left border-collapse">
                        <thead><tr className="text-slate-400 font-black uppercase border-b"><th>Record ID</th><th>Time</th><th>Type</th><th className="text-right">Amount</th></tr></thead>
                        <tbody>{ebayUploadData.slice(0, 10).map((r, i) => (
                          <tr key={i} className="border-b"><td className="py-2">{r.recordId}</td><td>{r.accountingTime}</td><td>{r.type}</td><td className="text-right font-bold">{r.amount}</td></tr>
                        ))}</tbody>
                    </table>
                    {ebayUploadData.length > 10 && <p className="text-center text-[10px] text-slate-400 italic">Và {ebayUploadData.length - 10} dòng khác...</p>}
                  </div>
                )}
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                 <button onClick={handleUploadEbay} disabled={isUploading || ebayUploadData.length === 0} className="px-12 py-4 bg-yellow-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl flex items-center gap-2 transition-all active:scale-95">
                    {isUploading ? <Loader2 size={16} className="animate-spin"/> : 'Xác nhận Lưu Ebay'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* PRINTWAY UPLOAD MODAL */}
      {isPrintwayUploadOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isUploading && setIsPrintwayUploadOpen(false)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden relative animate-slide-in flex flex-col border border-white/20">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-100"><FileSpreadsheet size={24}/></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tải dữ liệu Printway</h3>
                 </div>
                 <button onClick={() => setIsPrintwayUploadOpen(false)} disabled={isUploading} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm"><X size={20}/></button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                {uploadData.length === 0 ? (
                  <div 
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }} 
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processPrintwayFile(f); }} 
                    className={`py-20 flex flex-col items-center justify-center border-4 border-dashed rounded-[3rem] transition-all cursor-pointer ${isDragging ? 'bg-emerald-100 border-emerald-500' : 'bg-slate-50/50 border-slate-100'}`} 
                    onClick={() => printwayFileInputRef.current?.click()}
                  >
                    <input type="file" accept=".xlsx,.xls" ref={printwayFileInputRef} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processPrintwayFile(f); }} />
                    <Upload size={40} className="text-slate-200 mb-6"/>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-center px-4">Kéo thả file Excel Printway tại đây để xử lý</p>
                    <p className="text-[10px] text-slate-300 font-bold mt-2 italic text-center px-8">(Hệ thống tự động loại bỏ Invoice ID trùng lặp)</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between shadow-inner">
                       <span className="text-sm font-black text-emerald-700 uppercase">Phát hiện {uploadData.length} hóa đơn Printway mới hợp lệ.</span>
                       <button onClick={() => setUploadData([])} className="text-rose-600 text-[10px] font-black uppercase underline">Hủy & Chọn lại</button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                      <table className="w-full text-[10px] text-left border-collapse">
                          <thead className="bg-slate-50 text-slate-400 font-black uppercase border-b">
                            <tr>
                              <th className="px-3 py-2">Invoice ID</th>
                              <th className="px-3 py-2 text-center">Type</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2 text-right">Amount (USD)</th>
                              <th className="px-3 py-2 text-right">Total (USD)</th>
                              <th className="px-3 py-2">Hạch toán</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {uploadData.slice(0, 15).map((r, i) => {
                              const isExpense = r.type.toLowerCase() === 'payment';
                              return (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-2 font-bold text-slate-700">{r.invoiceId}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${isExpense ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{r.type}</span>
                                  </td>
                                  <td className="px-3 py-2 text-slate-400 font-mono">{r.date}</td>
                                  <td className="px-3 py-2 text-right font-bold text-slate-500">{r.amountUsd.toLocaleString()}</td>
                                  <td className={`px-3 py-2 text-right font-black ${isExpense ? 'text-rose-600' : 'text-slate-900'}`}>{r.totalAmount.toLocaleString()}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter ${isExpense ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-400'}`}>{r.loai}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                 <button onClick={handleUploadPrintway} disabled={isUploading || uploadData.length === 0} className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                    {isUploading ? <Loader2 size={16} className="animate-spin"/> : <><FileUp size={16}/> Xác nhận Lưu về Sheet</>}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* TRANSACTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/20">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-black text-slate-900 text-2xl uppercase tracking-tighter">Ghi Chi phí công ty</h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-slate-900 shadow-sm"><X size={20} /></button>
                </div>
                <form onSubmit={handleSaveTransaction} className="p-10 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Loại giao dịch</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Thu Tiền', 'Chi Tiền'].map(cat => (
                                    <button key={cat} type="button" onClick={() => setFormData({...formData, category: cat})} className={`py-3 rounded-2xl text-[10px] font-black uppercase border-2 ${formData.category === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>{cat}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Ngày phát sinh</label>
                            <input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex justify-between items-center">
                           <span>Phân loại</span>
                           {!isAddingSubCat ? (
                             <button type="button" onClick={() => setIsAddingSubCat(true)} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 transition-all"><Plus size={10}/> Thêm loại mới</button>
                           ) : (
                             <button type="button" onClick={() => { setIsAddingSubCat(false); setNewSubCatValue(''); }} className="text-rose-600 hover:text-rose-800 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 transition-all"><X size={10}/> Hủy</button>
                           )}
                        </label>
                        
                        {!isAddingSubCat ? (
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black outline-none appearance-none cursor-pointer" value={formData.subCategory} onChange={(e) => setFormData({...formData, subCategory: e.target.value})} required>
                                <option value="">-- Chọn Phân Loại --</option>
                                {meta.subCategories.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        ) : (
                            <div className="flex gap-2 animate-fade-in">
                                <input type="text" placeholder="Nhập tên loại chi phí mới..." className="flex-1 bg-white border-2 border-indigo-200 rounded-2xl px-4 py-3 text-xs font-black outline-none focus:ring-4 focus:ring-indigo-100" value={newSubCatValue} onChange={(e) => setNewSubCatValue(e.target.value)} autoFocus />
                                <button type="button" onClick={handleAddNewSubCat} disabled={isSavingMeta || !newSubCatValue.trim()} className="bg-indigo-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg disabled:opacity-50">
                                    {isSavingMeta ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                                </button>
                            </div>
                        )}
                    </div>

                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nội dung chi tiết</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required /></div>
                    
                    <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Số tiền (VNĐ)</label><input type="number" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-indigo-600 outline-none" value={formData.unitPrice} onChange={(e) => setFormData({...formData, unitPrice: Number(e.target.value)})} /></div>
                            <div className="text-right"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Quy đổi tương đương</label><p className="text-3xl font-black text-slate-900 leading-none">{formatAsUsd(formData.unitPrice)}</p></div>
                        </div>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all">{isSubmitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Xác nhận ghi chi phí'}</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL NHẬP FUNDS */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-slide-in">
                <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
                    <h3 className="font-black text-orange-900 text-2xl uppercase tracking-tighter flex items-center gap-3"><Landmark size={28}/> Nhập Funds về</h3>
                    <button onClick={() => setIsAddPaymentOpen(false)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 shadow-sm rounded-2xl transition-all"><X size={20} /></button>
                </div>
                <form onSubmit={handleSavePayment} className="p-10 space-y-6">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tên Store</label>
                            <button type="button" onClick={() => setIsNewStore(!isNewStore)} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1 bg-white border border-indigo-100 px-3 py-1 rounded-xl shadow-sm hover:bg-indigo-50 active:scale-95 transition-all">
                                {isNewStore ? <><Users size={12}/> Chọn store có sẵn</> : <><Plus size={12}/> Thêm mới store</>}
                            </button>
                        </div>
                        
                        {!isNewStore ? (
                           <select 
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black outline-none appearance-none cursor-pointer focus:border-orange-500 transition-all"
                             value={paymentData.storeName}
                             onChange={(e) => {
                                 const name = e.target.value;
                                 const reg = storeRegionMap[name] || 'Us';
                                 setPaymentData(prev => ({ ...prev, storeName: name, region: reg }));
                             }}
                             required
                           >
                               {existingStoreNames.map(name => (
                                   <option key={name} value={name}>{name}</option>
                               ))}
                           </select>
                        ) : (
                           <div className="relative">
                              <Store size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input 
                                type="text" 
                                className="w-full bg-white border-2 border-orange-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-black outline-none focus:ring-4 focus:ring-orange-100 transition-all" 
                                value={paymentData.storeName} 
                                onChange={(e) => setPaymentData({...paymentData, storeName: e.target.value})} 
                                placeholder="Nhập tên store mới..."
                                required 
                              />
                           </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Vùng (Region)</label>
                            <div className="relative">
                                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select 
                                    className={`w-full bg-slate-50 border-2 rounded-2xl py-4 pl-12 pr-4 text-sm font-black outline-none appearance-none ${!isNewStore ? 'cursor-not-allowed opacity-60 border-slate-100' : 'cursor-pointer border-slate-200'}`}
                                    value={paymentData.region} 
                                    onChange={(e) => setPaymentData({...paymentData, region: e.target.value as any})} 
                                    disabled={!isNewStore}
                                    required
                                >
                                    <option value="Us">Us</option>
                                    <option value="Au">Au</option>
                                    <option value="VN">VN</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Ngày nhận</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-[11px] font-black outline-none" value={paymentData.date} onChange={(e) => setPaymentData({...paymentData, date: e.target.value})} required />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-orange-50 p-8 rounded-[2.5rem] border-2 border-orange-100 shadow-inner">
                        <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-2 block flex items-center gap-2">
                           <DollarSign size={12}/> Nhập số tiền ({paymentData.region})
                        </label>
                        <input 
                            type="number" 
                            className="w-full bg-white border-2 border-orange-200 rounded-2xl px-5 py-4 text-3xl font-black text-orange-600 outline-none focus:ring-4 focus:ring-orange-200 shadow-sm" 
                            value={paymentData.amount === 0 ? '' : paymentData.amount} 
                            onChange={(e) => setPaymentData({...paymentData, amount: Number(e.target.value)})} 
                            placeholder="0"
                            required 
                        />
                        <div className="mt-4 flex justify-between items-center px-2">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">Tương đương USD:</span>
                           <span className="text-sm font-black text-slate-700 italic">
                               {formatCurrency(
                                   paymentData.region === 'VN' ? (Number(paymentData.amount) / rates.VND) : 
                                   paymentData.region === 'Au' ? (Number(paymentData.amount) / rates.AUD) : 
                                   Number(paymentData.amount)
                               )}
                           </span>
                        </div>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-orange-600 text-white rounded-[1.8rem] text-[12px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-orange-200 hover:bg-orange-700 transition-all active:scale-95 flex items-center justify-center gap-3">
                        {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <><Check size={20} strokeWidth={3}/> Xác nhận nhập Funds</>}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
