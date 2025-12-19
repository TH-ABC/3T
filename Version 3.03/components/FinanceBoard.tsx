import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Calendar, Search, Loader2, Save, X, DollarSign, Users, Tag, Calculator, FileText, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { FinanceTransaction, FinanceMeta } from '../types';

export const FinanceBoard: React.FC = () => {
  const [currentYear, setCurrentYear] = useState<string>(String(new Date().getFullYear()));
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [meta, setMeta] = useState<FinanceMeta>({ categories: [], payers: ['Hoàng', 'A Tâm'] });
  const [loading, setLoading] = useState(true);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddMetaOpen, setIsAddMetaOpen] = useState<{ type: 'category' | 'payer' | null, value: string }>({ type: null, value: '' });
  
  // Form Data
  const [formData, setFormData] = useState<Partial<FinanceTransaction>>({
    date: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    category: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    payer: 'Hoàng',
    note: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setCurrentFileId(null);
    try {
      const [transResult, metaData] = await Promise.all([
        sheetService.getFinance(currentYear),
        sheetService.getFinanceMeta()
      ]);
      
      const transList = transResult.transactions || [];
      const fileId = transResult.fileId;

      setTransactions(Array.isArray(transList) ? transList : []);
      setCurrentFileId(fileId);
      
      const safePayers = (metaData.payers && metaData.payers.length > 0) ? metaData.payers : ['Hoàng', 'A Tâm'];
      setMeta({
        categories: metaData.categories || [],
        payers: safePayers
      });
      
      if (metaData.categories && metaData.categories.length > 0 && !formData.category) {
          setFormData(prev => ({ ...prev, category: metaData.categories[0] }));
      }
    } catch (e) {
      console.error("Load Finance Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentYear]);

  const handleCreateFile = async () => {
      setIsCreatingFile(true);
      try {
          const result = await sheetService.createFinanceFile(currentYear);
          if (result && result.success) {
              await loadData();
              alert(`Đã tạo file Sổ Quỹ năm ${currentYear} thành công!`);
          } else {
              alert(result.error || "Lỗi tạo file.");
          }
      } catch (e) {
          alert("Lỗi kết nối.");
      } finally {
          setIsCreatingFile(false);
      }
  };

  const handleAddMeta = async () => {
    if (!isAddMetaOpen.type || !isAddMetaOpen.value.trim()) return;
    const type = isAddMetaOpen.type;
    const value = isAddMetaOpen.value.trim();
    
    if (type === 'category') {
        setMeta(prev => ({ ...prev, categories: [...prev.categories, value] }));
        setFormData(prev => ({ ...prev, category: value })); 
    } else {
        setMeta(prev => ({ ...prev, payers: [...prev.payers, value] }));
        setFormData(prev => ({ ...prev, payer: value }));
    }
    
    setIsAddMetaOpen({ type: null, value: '' });

    try {
        await sheetService.addFinanceMeta(type, value);
    } catch (e) {
        console.error("Add Meta Error", e);
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFileId) {
        alert("Chưa có file lưu trữ cho năm này. Vui lòng tạo file trước.");
        return;
    }
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
            setFormData({
                date: new Date().toISOString().slice(0, 16),
                category: meta.categories[0] || '',
                description: '',
                quantity: 1,
                unitPrice: 0,
                payer: meta.payers[0] || 'Hoàng',
                note: ''
            });
        } else {
            alert(res.error || 'Lỗi lưu giao dịch');
        }
    } catch (e) {
        alert('Lỗi kết nối');
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.payer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const safeToLocaleString = (val: any) => {
    if (val === undefined || val === null) return "0";
    const n = Number(String(val).replace(/,/g, ''));
    return isNaN(n) ? "0" : n.toLocaleString('vi-VN');
  };

  const inputLabelClass = "block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide";
  const inputFieldClass = "w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-sm placeholder-gray-400";

  return (
    <div className="p-6 h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-xl shadow-md">
                <Wallet size={24} />
            </div>
            <div>
                <h2 className="text-xl font-bold text-gray-800">Sổ Quỹ (Thu - Chi)</h2>
                <p className="text-xs text-gray-500 font-medium">Quản lý dòng tiền chi tiết</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm hover:border-emerald-400 transition-colors">
                <Calendar size={16} className="text-emerald-600 mr-2" />
                <select 
                    value={currentYear} 
                    onChange={(e) => setCurrentYear(e.target.value)}
                    className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer text-sm"
                >
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>Năm {y}</option>
                    ))}
                </select>
            </div>
            
            {currentFileId ? (
                <>
                    <a 
                        href={`https://docs.google.com/spreadsheets/d/${currentFileId}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 bg-white border border-green-600 text-green-700 px-4 py-2.5 rounded-lg font-bold text-sm shadow-sm hover:bg-green-50 transition-colors whitespace-nowrap"
                        title="Mở Google Sheet"
                    >
                        <FileSpreadsheet size={18} /> <span className="hidden sm:inline">Mở Sheet</span>
                    </a>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={18} strokeWidth={3} /> Thêm Giao Dịch
                    </button>
                </>
            ) : (
                <button 
                    onClick={handleCreateFile}
                    disabled={isCreatingFile || loading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all active:scale-95 whitespace-nowrap"
                >
                    {isCreatingFile ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} 
                    Tạo File Năm {currentYear}
                </button>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
         <div className="p-4 border-b border-gray-100 flex justify-between items-center gap-4 bg-gray-50/30">
            <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Tìm kiếm danh mục, nội dung, người chi..." 
                    className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200">
                Tổng dòng: <span className="text-gray-900 font-bold">{filteredTransactions.length}</span>
            </div>
         </div>

         <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 z-10 shadow-sm text-xs uppercase tracking-wider">
                    <tr>
                        <th className="px-4 py-3 border-b text-center w-12">STT</th>
                        <th className="px-4 py-3 border-b w-36">Danh Mục</th>
                        <th className="px-4 py-3 border-b">Mô Tả / Nội Dung</th>
                        <th className="px-4 py-3 border-b w-36">Ngày giờ</th>
                        <th className="px-4 py-3 border-b text-right w-20">SL</th>
                        <th className="px-4 py-3 border-b text-right w-32">Đơn Giá</th>
                        <th className="px-4 py-3 border-b text-right w-36 text-emerald-700">Thành Tiền</th>
                        <th className="px-4 py-3 border-b text-center w-28">Người Chi</th>
                        <th className="px-4 py-3 border-b w-48">Ghi Chú</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {loading ? (
                        <tr><td colSpan={9} className="py-20 text-center text-gray-500 flex flex-col items-center justify-center gap-2"><Loader2 className="animate-spin text-emerald-500" /> Đang tải dữ liệu...</td></tr>
                    ) : !currentFileId ? (
                        <tr><td colSpan={9} className="py-20 text-center text-gray-500 flex flex-col items-center justify-center">
                            <p className="mb-2 text-lg font-medium text-gray-700">Chưa có File dữ liệu cho năm {currentYear}</p>
                            <button onClick={handleCreateFile} className="text-blue-600 hover:underline flex items-center gap-1"><Plus size={16}/> Tạo file ngay</button>
                        </td></tr>
                    ) : filteredTransactions.length === 0 ? (
                        <tr><td colSpan={9} className="py-20 text-center text-gray-400 italic">Chưa có dữ liệu giao dịch cho năm {currentYear}.</td></tr>
                    ) : (
                        filteredTransactions.map((t, idx) => (
                            <tr key={t.id || idx} className="hover:bg-emerald-50/40 transition-colors group">
                                <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                                <td className="px-4 py-3">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                        {t.category}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-gray-800 font-medium">{t.description}</td>
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap font-mono">{t.date}</td>
                                <td className="px-4 py-3 text-right text-gray-600 font-mono">{t.quantity}</td>
                                <td className="px-4 py-3 text-right text-gray-600 font-mono">{safeToLocaleString(t.unitPrice)}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono bg-gray-50 group-hover:bg-emerald-100/50 transition-colors">{safeToLocaleString(t.totalAmount)}</td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm">
                                        <Users size={12} className="text-emerald-500" /> {t.payer}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-xs italic truncate max-w-[200px]">{t.note}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                            <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600">
                                <Plus size={20} strokeWidth={3} />
                            </div>
                            Thêm Giao Dịch Mới
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 ml-10">Nhập thông tin chi tiết khoản thu/chi</p>
                    </div>
                    <button onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting} className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-12 md:col-span-5">
                            <label className={inputLabelClass}>Ngày Giờ Giao Dịch</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    type="datetime-local" 
                                    className={`${inputFieldClass} pl-10 font-mono`}
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="col-span-12 md:col-span-7">
                            <label className={inputLabelClass}>Danh Mục (Loại Chi)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <select 
                                        className={`${inputFieldClass} pl-10 appearance-none cursor-pointer`}
                                        value={formData.category}
                                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                                    >
                                        <option value="" className="text-gray-400">-- Chọn Danh Mục --</option>
                                        {meta.categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <button 
                                    onClick={() => setIsAddMetaOpen({ type: 'category', value: '' })}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 rounded-lg px-3 flex items-center justify-center transition-colors"
                                    title="Thêm danh mục mới"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="col-span-12">
                            <label className={inputLabelClass}>Mô Tả / Nội Dung Chi Tiết</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 text-gray-400" size={16} />
                                <textarea 
                                    rows={2}
                                    className={`${inputFieldClass} pl-10 resize-none`}
                                    placeholder="Ví dụ: Mua văn phòng phẩm..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="col-span-12 bg-emerald-50/50 border border-emerald-100 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                                <Calculator size={14} /> Tính Toán Giá Trị
                            </div>
                            <div className="grid grid-cols-12 gap-4 items-end">
                                <div className="col-span-3">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Số Lượng</label>
                                    <input 
                                        type="number" 
                                        className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-right font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                                    />
                                </div>
                                <div className="col-span-1 flex justify-center pb-2 text-gray-400">×</div>
                                <div className="col-span-4">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Đơn Giá (VNĐ)</label>
                                    <input 
                                        type="number" 
                                        className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-right font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                        value={formData.unitPrice}
                                        onChange={(e) => setFormData({...formData, unitPrice: Number(e.target.value)})}
                                    />
                                </div>
                                <div className="col-span-1 flex justify-center pb-2 text-gray-400">=</div>
                                <div className="col-span-3">
                                    <label className="block text-xs font-bold text-emerald-700 mb-1">THÀNH TIỀN</label>
                                    <div className="w-full border-2 border-dashed border-emerald-200 bg-white rounded-lg px-3 py-2 text-right font-bold text-emerald-700 font-mono shadow-sm">
                                        {safeToLocaleString((formData.quantity || 0) * (formData.unitPrice || 0))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-12 md:col-span-6">
                            <label className={inputLabelClass}>Người Thực Hiện (Pay)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <select 
                                        className={`${inputFieldClass} pl-10 appearance-none cursor-pointer`}
                                        value={formData.payer}
                                        onChange={(e) => setFormData({...formData, payer: e.target.value})}
                                    >
                                        {meta.payers.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <button 
                                    onClick={() => setIsAddMetaOpen({ type: 'payer', value: '' })}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 rounded-lg px-3 flex items-center justify-center transition-colors"
                                    title="Thêm người mới"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="col-span-12 md:col-span-6">
                            <label className={inputLabelClass}>Ghi Chú Thêm</label>
                            <input 
                                type="text" 
                                className={inputFieldClass}
                                placeholder="..."
                                value={formData.note}
                                onChange={(e) => setFormData({...formData, note: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-4">
                    <button onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting} className="px-6 py-2.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-semibold transition-colors">
                        Hủy Bỏ
                    </button>
                    <button onClick={handleSaveTransaction} disabled={isSubmitting} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-70 disabled:scale-100">
                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        <span>Lưu Giao Dịch</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {isAddMetaOpen.type && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 border border-gray-200 transform transition-all scale-100">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                      <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600">
                        <Plus size={20} />
                      </div>
                      Thêm {isAddMetaOpen.type === 'category' ? 'Danh Mục' : 'Người Chi'}
                  </h4>
                  <div className="mb-5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Tên {isAddMetaOpen.type === 'category' ? 'Danh Mục' : 'Người Chi'} Mới
                    </label>
                    <input 
                        type="text" 
                        className={inputFieldClass}
                        placeholder={`Nhập tên...`}
                        value={isAddMetaOpen.value}
                        onChange={(e) => setIsAddMetaOpen(prev => ({ ...prev, value: e.target.value }))}
                        autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                      <button onClick={() => setIsAddMetaOpen({type: null, value: ''})} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">Hủy</button>
                      <button onClick={handleAddMeta} className="px-5 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-bold shadow-md transition-all active:scale-95">Xác Nhận Thêm</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};