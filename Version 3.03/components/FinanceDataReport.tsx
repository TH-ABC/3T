
import React, { useMemo, useState, useEffect } from 'react';
import { 
  PieChart, Activity, TrendingUp, TrendingDown, 
  ChevronRight, Zap, Info, RefreshCw, ShoppingBag, 
  HandCoins, Users, AlertTriangle, Sparkles, BrainCircuit, 
  Lightbulb, Wallet, Landmark, FileText, Loader2, Clock,
  ArrowLeftRight, Check, RotateCcw, Save
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { sheetService } from '../services/sheetService';
import { 
  FinanceTransaction, PaymentRecord, PrintwayRecord, 
  EbayRecord, StaffSalarySummary 
} from '../types';

const FinanceDataReport: React.FC = () => {
  const [currentYear, setCurrentYear] = useState<string>(new Date().getFullYear().toString());
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [printwayRecords, setPrintwayRecords] = useState<PrintwayRecord[]>([]);
  const [ebayRecords, setEbayRecords] = useState<EbayRecord[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<StaffSalarySummary[]>([]);
  const [rates, setRates] = useState<{ VND: number, AUD: number }>({ VND: 25450, AUD: 1.54 });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  
  // AI States
  const [cachedAiContent, setCachedAiContent] = useState<string>('');
  const [newAiContent, setNewAiContent] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingCache, setIsFetchingCache] = useState(false);
  const [lastUpdateAi, setLastUpdateAi] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [transResult, salaryResult] = await Promise.all([
        sheetService.getFinance(currentYear),
        sheetService.getStaffSalarySummary(currentYear)
      ]);
      
      setTransactions(Array.isArray(transResult?.transactions) ? transResult.transactions : []);
      setPayments(Array.isArray(transResult?.payments) ? transResult.payments : []);
      setPrintwayRecords(Array.isArray(transResult?.printway) ? transResult.printway : []);
      setEbayRecords(Array.isArray(transResult?.ebay) ? transResult.ebay : []);
      
      let finalSalaries: StaffSalarySummary[] = [];
      if (Array.isArray(salaryResult)) {
          finalSalaries = salaryResult;
      } else if (salaryResult && Array.isArray((salaryResult as any).data)) {
          finalSalaries = (salaryResult as any).data;
      }
      setSalaryRecords(finalSalaries);

      try {
        const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const rateJson = await rateRes.json();
        if (rateJson?.rates) setRates({ VND: rateJson.rates.VND || 25450, AUD: rateJson.rates.AUD || 1.54 });
      } catch (e) {}
    } catch (e) { 
      console.error("Finance Data Report Load Error:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [currentYear]);

  const getMonthAndYear = (dateStr: any) => {
    if (!dateStr) return null;
    const str = String(dateStr).trim();
    const vnPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const vnMatch = str.match(vnPattern);
    if (vnMatch) return { year: vnMatch[3], month: vnMatch[2].padStart(2, '0') };
    const isoPattern = /(\d{4})-(\d{1,2})-(\d{1,2})/;
    const isoMatch = str.match(isoPattern);
    if (isoMatch) return { year: isoMatch[1], month: isoMatch[2].padStart(2, '0') };
    return null;
  };

  const robustParseNumber = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace(/[^\d,.-]/g, '');
    if (str.includes(',') && !str.includes('.')) str = str.replace(',', '.');
    else if (str.includes(',') && str.includes('.')) str = str.replace(/,/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const monthlyData = useMemo(() => {
    const data: Record<string, { 
        income: number; expense: number; profit: number;
        breakdown: {
            income: { label: string, value: number, icon: any }[],
            expense: { label: string, value: number, icon: any }[]
        }
    }> = {};

    for (let i = 1; i <= 12; i++) {
      const key = String(i).padStart(2, '0');
      data[key] = { income: 0, expense: 0, profit: 0, breakdown: { income: [], expense: [] } };
    }

    Object.keys(data).forEach(mKey => {
        let qIncome = 0, qExpense = 0, fIncome = 0, fFees = 0, pPay = 0, pRef = 0, ePay = 0, eRef = 0, salary = 0;
        
        transactions.forEach(t => {
            const parsed = getMonthAndYear(t.date);
            if (parsed && String(parsed.year) === String(currentYear) && parsed.month === mKey) {
                const amt = robustParseNumber(t.totalAmount) / (rates.VND || 25450);
                if (t.category === 'Thu Tiền') qIncome += amt;
                else qExpense += amt;
            }
        });

        payments.forEach(p => {
            const parsed = getMonthAndYear(p.date);
            if (parsed && String(parsed.year) === String(currentYear) && parsed.month === mKey) {
                const convUsd = robustParseNumber(p.convertedUsd);
                fIncome += convUsd;
                fFees += convUsd * ((p.region === 'Us' || p.region === 'Au') ? 0.05 : 0.03);
            }
        });

        printwayRecords.forEach(pw => {
            const parsed = getMonthAndYear(pw.date);
            if (parsed && String(parsed.year) === String(currentYear) && parsed.month === mKey) {
                const amt = robustParseNumber(pw.totalAmount);
                const typeNorm = (pw.type || '').toLowerCase().trim();
                const loaiNorm = (pw.loai || '').toLowerCase().trim();
                
                if (typeNorm.includes('topup') || typeNorm.includes('top-up')) return;
                
                if (loaiNorm.includes('thu')) pRef += amt;
                else pPay += amt;
            }
        });

        ebayRecords.forEach(e => {
            const dateStr = e.timestamp && String(e.timestamp).trim() !== "" ? e.timestamp : e.accountingTime;
            const parsed = getMonthAndYear(dateStr);
            if (parsed && String(parsed.year) === String(currentYear) && parsed.month === mKey) {
                const amt = robustParseNumber(e.amount);
                const typeNorm = (e.type || '').toLowerCase();
                if (typeNorm.includes('refund')) eRef += amt;
                else if (amt < 0) ePay += Math.abs(amt);
            }
        });

        const sRecord = salaryRecords.find(sr => {
            const monthVal = String(sr.month || '').padStart(2, '0');
            return monthVal === mKey;
        });
        if (sRecord) salary = robustParseNumber(sRecord.amountUsd);

        // Net Calculations (Trừ hoàn trực tiếp vào chi)
        const netPPay = pPay - pRef;
        const netEPay = ePay - eRef;

        const totalInc = qIncome + fIncome;
        const totalExp = qExpense + fFees + netPPay + netEPay + salary;
        
        data[mKey] = {
            income: totalInc, expense: totalExp, profit: totalInc - totalExp,
            breakdown: {
                income: [
                    { label: "Quỹ công ty", value: qIncome, icon: Wallet },
                    { label: "Gross Store Funds", value: fIncome, icon: Landmark }
                ],
                expense: [
                    { label: "Chi phí vận hành", value: qExpense, icon: Wallet },
                    { label: "Phí Partner 3-5%", value: fFees, icon: Users },
                    { label: "Printway Payment (Net)", value: netPPay, icon: FileText },
                    { label: "Ebay Fulfillment (Net)", value: netEPay, icon: ShoppingBag },
                    { label: "Lương nhân sự", value: salary, icon: HandCoins }
                ]
            }
        };
    });
    return data;
  }, [transactions, payments, printwayRecords, ebayRecords, salaryRecords, rates, currentYear]);

  // AI CORE LOGIC
  const fetchCachedAnalysis = async (monthKey: string) => {
    setIsFetchingCache(true);
    setCachedAiContent('');
    setNewAiContent('');
    setShowPreview(false);
    setLastUpdateAi(null);
    
    try {
      const cached = await sheetService.getAiInsight(monthKey, currentYear);
      if (cached && cached.success && cached.content) {
        setCachedAiContent(cached.content);
        setLastUpdateAi(cached.updatedDate);
      }
    } catch (e) { 
      console.error("Cache Error:", e); 
    } finally { 
      setIsFetchingCache(false); 
    }
  };

  const handleRunAiAnalysis = async () => {
    if (!selectedMonth) return;
    const data = monthlyData[selectedMonth];
    if (!data) return;

    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        BỐI CẢNH: Bạn là chuyên gia phân tích tài chính Ecommerce Team 3T.
        DỮ LIỆU THÁNG ${parseInt(selectedMonth)} NĂM ${currentYear}:
        - Doanh thu: ${formatCurrency(data.income)}
        - Chi phí: ${formatCurrency(data.expense)}
        - Lợi nhuận: ${formatCurrency(data.profit)}
        - Margin: ${data.income > 0 ? ((data.profit / data.income) * 100).toFixed(1) : '0'}%
        
        CHI TIẾT FULFILLMENT (NET):
        Ebay: ${formatCurrency(data.breakdown.expense.find(i=>i.label.includes('Ebay'))?.value || 0)}
        Printway: ${formatCurrency(data.breakdown.expense.find(i=>i.label.includes('Printway'))?.value || 0)}
        Chi phí khác: Phí Partner, Lương, Chi vận hành.

        YÊU CẦU TRÌNH BÀY:
        1. Sử dụng Tiêu đề La Mã (I, II, III) rõ ràng.
        2. Mỗi phần trình bày trong các đoạn văn (Paragraph) mạch lạc.
        3. Phân tích sâu: Lỗ hay lãi do đâu? (Tập trung vào tỉ lệ Net Fulfillment so với Doanh thu).
        4. Đưa ra 3 chiến lược hành động cụ thể cho Team.
        
        Phong cách: Chuyên nghiệp, Tiếng Việt, súc tích.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });

      setNewAiContent(response.text || 'Không có phản hồi.');
      setShowPreview(true);
    } catch (error) {
      alert('Lỗi hệ thống AI. Vui lòng thử lại sau.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyNewAnalysis = async () => {
    if (!selectedMonth || !newAiContent) return;
    setIsAnalyzing(true);
    try {
        await sheetService.saveAiInsight(selectedMonth, currentYear, newAiContent);
        setCachedAiContent(newAiContent);
        setNewAiContent('');
        setShowPreview(false);
        setLastUpdateAi(new Date().toLocaleString('vi-VN'));
    } finally { setIsAnalyzing(false); }
  };

  useEffect(() => {
    if (selectedMonth) {
        fetchCachedAnalysis(selectedMonth);
    }
  }, [selectedMonth, currentYear]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-100 flex-col gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tính toán dữ liệu Fulfillment...</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* LEFT PANEL: FIXED TABLE */}
      <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden">
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/60 overflow-hidden flex flex-col h-full">
            <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/30">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><PieChart size={26} /></div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Dữ liệu Data chi tiết</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Báo cáo tổng hợp {currentYear}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-inner">
                    <span className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Năm tài chính</span>
                    <select value={currentYear} onChange={(e) => { setCurrentYear(e.target.value); setSelectedMonth(null); }} className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black outline-none cursor-pointer">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-slate-50/50 sticky top-0 z-10">
                        <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                            <th className="py-5 px-8">Tháng</th>
                            <th className="py-5 px-4 text-right">Thu (USD)</th>
                            <th className="py-5 px-4 text-right">Chi (USD)</th>
                            <th className="py-5 px-4 text-right">Lợi Nhuận</th>
                            <th className="py-5 px-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {Object.keys(monthlyData).sort().map((m) => {
                            const val = monthlyData[m];
                            return (
                                <tr key={m} className={`hover:bg-indigo-50/30 transition-all cursor-pointer group ${selectedMonth === m ? 'bg-indigo-50/50 ring-1 ring-inset ring-indigo-100' : ''}`} onClick={() => setSelectedMonth(m === selectedMonth ? null : m)}>
                                    <td className="py-6 px-8"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${selectedMonth === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{parseInt(m)}</div><span className="font-black text-slate-700 uppercase text-xs tracking-wider">Tháng {parseInt(m)}</span></div></td>
                                    <td className="py-6 px-4 text-right font-black text-emerald-600">{formatCurrency(val.income)}</td>
                                    <td className="py-6 px-4 text-right font-black text-rose-600">{formatCurrency(val.expense)}</td>
                                    <td className={`py-6 px-4 text-right font-black ${val.profit >= 0 ? 'text-indigo-600' : 'text-rose-700'}`}>{formatCurrency(val.profit)}</td>
                                    <td className="py-6 px-8 text-center"><ChevronRight size={18} className={`text-slate-300 transition-transform ${selectedMonth === m ? 'rotate-90 text-indigo-600' : ''}`} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* RIGHT PANEL: INDEPENDENT SCROLL EVALUATION */}
      <div className="w-full lg:w-[500px] border-l border-slate-200 bg-white flex flex-col h-screen">
        {selectedMonth ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-8 pb-32">
            <div className="animate-slide-in">
              <div className="flex justify-between items-center mb-8">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Zap size={18} className="text-orange-500 fill-orange-500" /> Đánh giá Tháng {parseInt(selectedMonth)}
                  </h4>
                  <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border-2 ${monthlyData[selectedMonth].profit >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                      {monthlyData[selectedMonth].profit >= 0 ? 'Dòng tiền Dương' : 'Cần rà soát'}
                  </div>
              </div>

              <div className="space-y-8">
                  <div>
                      <div className="flex items-end justify-between mb-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tỉ suất lợi nhuận ròng</p>
                          <span className={`text-4xl font-black ${monthlyData[selectedMonth].profit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                            {monthlyData[selectedMonth].income > 0 ? ((monthlyData[selectedMonth].profit / monthlyData[selectedMonth].income) * 100).toFixed(1) : '0'}%
                          </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min(Math.max((monthlyData[selectedMonth].profit / monthlyData[selectedMonth].income) * 100, 0), 100)}%` }}></div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <h5 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] border-b pb-2">Nguồn thu hệ thống</h5>
                      {monthlyData[selectedMonth].breakdown.income.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl">
                              <div className="flex items-center gap-3"><item.icon size={14} className="text-slate-400"/><span className="text-xs font-bold text-slate-600 uppercase">{item.label}</span></div>
                              <span className="text-xs font-black">{formatCurrency(item.value)}</span>
                          </div>
                      ))}
                  </div>

                  <div className="space-y-4">
                      <h5 className="text-[11px] font-black text-rose-600 uppercase tracking-[0.2em] border-b pb-2">Chi phí Fulfillment (Net) & Khác</h5>
                      {monthlyData[selectedMonth].breakdown.expense.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl">
                              <div className="flex items-center gap-3"><item.icon size={14} className="text-slate-400"/><span className="text-xs font-bold text-slate-600 uppercase">{item.label}</span></div>
                              <span className="text-xs font-black">{formatCurrency(item.value)}</span>
                          </div>
                      ))}
                  </div>
              </div>

              {/* AI ANALYSIS SECTION */}
              <div className="mt-10 pt-8 border-t border-dashed border-slate-200">
                  <div className={`p-6 rounded-[2rem] border flex flex-col gap-4 relative overflow-hidden transition-all bg-indigo-50 border-indigo-100`}>
                      <div className="flex items-center justify-between">
                          <h6 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-indigo-600">
                              <BrainCircuit size={16} /> Phân tích hệ thống
                          </h6>
                          <div className="flex gap-2">
                             {cachedAiContent && !showPreview && !isFetchingCache && (
                                <button onClick={handleRunAiAnalysis} disabled={isAnalyzing} className="p-2 bg-white rounded-xl text-indigo-600 hover:shadow-md transition-all flex items-center gap-2 text-[10px] font-black uppercase">
                                   {isAnalyzing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12} />} Phân tích lại
                                </button>
                             )}
                             {!cachedAiContent && !showPreview && !isFetchingCache && (
                                <button onClick={handleRunAiAnalysis} disabled={isAnalyzing} className="px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                   {isAnalyzing ? <Loader2 size={12} className="animate-spin"/> : <Zap size={12} />} Yêu cầu phân tích
                                </button>
                             )}
                          </div>
                      </div>

                      {isAnalyzing ? (
                        <div className="py-12 flex flex-col items-center gap-4">
                           <Sparkles className="text-indigo-600 animate-bounce" size={32}/>
                           <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">AI đang quét dữ liệu Net Fulfillment...</p>
                        </div>
                      ) : isFetchingCache ? (
                        <div className="py-12 flex flex-col items-center gap-4">
                           <Loader2 className="text-indigo-600 animate-spin" size={24}/>
                           <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Đang truy xuất bản lưu...</p>
                        </div>
                      ) : showPreview ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-3">
                                <Info size={16} className="text-amber-600" />
                                <span className="text-[10px] font-bold text-amber-800">Bạn đang xem BẢN PHÂN TÍCH MỚI. Hãy chọn lưu hoặc quay lại bản cũ.</span>
                            </div>
                            <div className="text-[12.5px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap ai-content-box">
                                {newAiContent}
                            </div>
                            <div className="flex gap-2 pt-4 border-t border-indigo-100">
                                <button onClick={handleApplyNewAnalysis} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"><Check size={14}/> Sử dụng bản này</button>
                                <button onClick={() => setShowPreview(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><RotateCcw size={14}/> Giữ bản cũ</button>
                            </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                            <div className="text-[12.5px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap ai-content-box">
                                {cachedAiContent || "Chưa có dữ liệu phân tích cho tháng này. Nhấn nút để yêu cầu AI thực hiện."}
                            </div>
                            {lastUpdateAi && (
                              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 border-t border-indigo-50 pt-4">
                                <Clock size={10}/> Bản ghi gần nhất: {lastUpdateAi}
                              </div>
                            )}
                        </div>
                      )}
                  </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
            <Activity size={80} className="text-slate-400 mb-8" />
            <h4 className="text-sm font-black text-slate-600 uppercase tracking-[0.4em]">Chọn tháng</h4>
            <p className="text-xs font-bold text-slate-400 mt-4 leading-relaxed max-w-[240px]">Dữ liệu Ebay/Printway đã được cấn trừ Refund để phân tích Net Fulfillment chính xác.</p>
          </div>
        )}
      </div>

      <style>{`
        .ai-content-box I, .ai-content-box II, .ai-content-box III {
          display: block;
          font-weight: 900;
          text-transform: uppercase;
          font-size: 13px;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #1e293b;
          border-left: 3px solid #6366f1;
          padding-left: 10px;
        }
        .ai-content-box p {
          margin-bottom: 1rem;
          text-align: justify;
        }
      `}</style>
    </div>
  );
};

export default FinanceDataReport;
