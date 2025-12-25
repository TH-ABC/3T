
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ClipboardList, Send, CheckCircle, Clock, 
  Plus, X, Loader2, Link as LinkIcon, 
  AlertCircle, FileText, User, Calendar,
  ArrowRight, Save, StickyNote, Filter, 
  ChevronDown, ChevronRight, MessageSquare, Image as ImageIcon,
  CheckSquare, Square, Trash2, Maximize2, ExternalLink,
  History, Download, FileCheck, BarChart3, TrendingUp,
  UserCheck, AlertTriangle, Edit2, ShieldCheck, Sun, Sunset,
  Activity, AlertOctagon, Eye, ChevronLeft, Layers, EyeOff
} from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User as UserType, HandoverItem, UserNote, DailyNoteItem } from '../types';

interface DailyHandoverProps {
  user: UserType;
}

type ViewFilterMode = 'day' | 'month' | 'all';

const DailyHandover: React.FC<DailyHandoverProps> = ({ user }) => {
  const [handovers, setHandovers] = useState<HandoverItem[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [filterMode, setFilterMode] = useState<ViewFilterMode>('day');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  // Note State (Todo List)
  const [noteItems, setNoteItems] = useState<DailyNoteItem[]>([]);
  const [showPlanner, setShowPlanner] = useState(true); // Trạng thái ẩn hiện Planner
  const [newNoteInput, setNewNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<string | null>(null);
  const [isViewReportOpen, setIsViewReportOpen] = useState<HandoverItem | null>(null);
  const [isStatsDetailOpen, setIsStatsDetailOpen] = useState<'Pending' | 'Processing' | 'Completed' | 'Overdue' | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewFullTask, setViewFullTask] = useState<HandoverItem | null>(null);

  // Form States
  const [newHandover, setNewHandover] = useState({ 
    task: '', 
    assignee: '', 
    deadlineAt: '', 
    imageLink: '',
    fileLink: '' 
  });
  const [reportForm, setReportForm] = useState({ report: '', resultLink: '' }); // Sửa fileLink thành resultLink
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'leader' || user.role.toLowerCase() === 'ceo';

  const fetchData = async () => {
    setLoading(true);
    try {
      let dateParam = "";
      if (filterMode === 'day') dateParam = selectedDate;
      else if (filterMode === 'month') dateParam = selectedMonth;
      else dateParam = "all";

      const [handoverRes, usersRes, noteRes] = await Promise.all([
        sheetService.getHandover(dateParam, user.fullName, user.role),
        sheetService.getUsers(),
        sheetService.getUserNote(user.username, new Date().toISOString().split('T')[0])
      ]);
      setHandovers(Array.isArray(handoverRes) ? handoverRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setNoteItems(noteRes?.items || []);
      setShowPlanner(noteRes?.showPlanner !== undefined ? noteRes.showPlanner : true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setCurrentPage(1);
  }, [selectedDate, selectedMonth, filterMode]);

  const sortedAndPaginatedData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const sorted = [...handovers].sort((a, b) => {
      const dateA = a.date.split(' ')[0];
      const dateB = b.date.split(' ')[0];
      if (dateA === today && dateB !== today) return -1;
      if (dateB === today && dateA !== today) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return {
      totalItems: sorted.length,
      totalPages: Math.ceil(sorted.length / itemsPerPage),
      currentItems: sorted.slice(indexOfFirstItem, indexOfLastItem)
    };
  }, [handovers, currentPage, itemsPerPage]);

  const statsTasks = useMemo(() => {
    return {
        total: handovers.length,
        pending: handovers.filter(h => h.status === 'Pending').length,
        processing: handovers.filter(h => h.status === 'Processing').length,
        completed: handovers.filter(h => h.status === 'Completed').length,
        overdue: handovers.filter(h => h.status === 'Overdue').length
    };
  }, [handovers]);

  const filteredStatsList = useMemo(() => {
    if (!isStatsDetailOpen) return [];
    return handovers.filter(h => h.status === isStatsDetailOpen);
  }, [handovers, isStatsDetailOpen]);

  const getAvatarChar = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    const lastWord = parts[parts.length - 1];
    return lastWord ? lastWord.charAt(0).toUpperCase() : fullName.charAt(0).toUpperCase();
  };

  // --- PLANNER ACTIONS ---
  const handleTogglePlanner = async () => {
    const nextState = !showPlanner;
    setShowPlanner(nextState);
    // Lưu trạng thái này xuống BE
    await autoSaveNote(noteItems, nextState);
  };

  const handleAddNoteItem = async () => {
    if (!newNoteInput.trim()) return;
    const newItem: DailyNoteItem = {
      id: 'n-' + Date.now(),
      text: newNoteInput.trim(),
      completed: false
    };
    const updatedItems = [...noteItems, newItem];
    setNoteItems(updatedItems);
    setNewNoteInput('');
    await autoSaveNote(updatedItems);
  };

  const toggleNoteItem = async (id: string) => {
    const updatedItems = noteItems.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setNoteItems(updatedItems);
    await autoSaveNote(updatedItems);
  };

  const deleteNoteItem = async (id: string) => {
    const updatedItems = noteItems.filter(item => item.id !== id);
    setNoteItems(updatedItems);
    await autoSaveNote(updatedItems);
  };

  const autoSaveNote = async (items: DailyNoteItem[], currentShowState: boolean = showPlanner) => {
    setSavingNote(true);
    try {
      await sheetService.saveUserNote({
        username: user.username,
        date: new Date().toISOString().split('T')[0],
        items: items,
        showPlanner: currentShowState
      });
    } finally {
      setSavingNote(false);
    }
  };

  // --- HANDOVER ACTIONS ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewHandover(prev => ({ ...prev, imageLink: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const setQuickDeadline = (type: 'morning' | 'afternoon') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = type === 'morning' ? '12:00' : '17:30';
    setNewHandover(prev => ({ ...prev, deadlineAt: `${year}-${month}-${day}T${time}` }));
  };

  const handleEditClick = (e: React.MouseEvent, item: HandoverItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setNewHandover({
      task: item.task,
      assignee: item.assignee,
      deadlineAt: item.deadlineAt ? item.deadlineAt.replace(' ', 'T').slice(0, 16) : '',
      imageLink: item.imageLink || '',
      fileLink: item.fileLink || ''
    });
    setIsAddModalOpen(true);
  };

  const handleViewTaskDetail = async (item: HandoverItem) => {
    setViewFullTask(item);
    if (!item.isSeen) {
      try {
        await sheetService.markHandoverAsSeen(item.id);
        setHandovers(prev => prev.map(h => h.id === item.id ? { ...h, isSeen: true } : h));
      } catch (err) {
        console.error("Mark as seen error:", err);
      }
    }
  };

  const executeDeleteHandover = async (id: string) => {
    setProcessingId(id);
    setConfirmDeleteId(null);
    try {
      const res = await sheetService.deleteHandover(id);
      if (res && res.success) {
        setHandovers(prev => prev.filter(h => h.id !== id));
      } else {
        alert(res?.error || "Lỗi xóa dữ liệu.");
      }
    } catch (err) {
      alert("Lỗi kết nối.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHandover.task || !newHandover.assignee || !newHandover.deadlineAt) return;
    setProcessingId('creating');
    try {
      let res;
      if (editingId) {
        res = await sheetService.updateHandover(editingId, { ...newHandover });
      } else {
        res = await sheetService.addHandover({
          ...newHandover,
          date: new Date().toISOString().split('T')[0],
          createdBy: `${user.fullName} (${user.role})`
        });
      }
      
      if (res.success) {
        setIsAddModalOpen(false);
        setEditingId(null);
        setNewHandover({ task: '', assignee: '', deadlineAt: '', imageLink: '', fileLink: '' });
        fetchData();
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptTask = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProcessingId(id);
    sheetService.updateHandover(id, { 
      status: 'Processing',
      startTime: new Date().toISOString()
    }).then(() => {
      fetchData();
    }).finally(() => {
      setProcessingId(null);
    });
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReportModalOpen) return;
    setProcessingId('reporting');
    try {
      await sheetService.updateHandover(isReportModalOpen, {
        report: reportForm.report,
        resultLink: reportForm.resultLink, // Lưu vào resultLink (mới)
        status: 'Completed',
        endTime: new Date().toISOString()
      });
      setIsReportModalOpen(null);
      setReportForm({ report: '', resultLink: '' });
      fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending': return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase shadow-sm">Chưa nhận</span>;
      case 'Processing': return <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm"><Clock size={10} className="animate-spin" /> Đang xử lý</span>;
      case 'Completed': return <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm"><CheckCircle size={10} /> Hoàn thành</span>;
      case 'Overdue': return <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm border border-rose-100"><AlertCircle size={10} /> Quá hạn</span>;
      default: return null;
    }
  };

  const formatDeadline = (iso: string) => {
      if (!iso) return '---';
      try {
          const d = new Date(iso);
          if (isNaN(d.getTime())) return iso;
          return d.toLocaleString('vi-VN', { 
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          });
      } catch (e) { return iso; }
  };

  const getRowStyle = (item: HandoverItem) => {
    const today = new Date().toISOString().split('T')[0];
    const isToday = item.date.startsWith(today);
    if (item.status === 'Overdue') return 'bg-rose-50/70 border-l-4 border-l-rose-500';
    if (item.status === 'Completed') return 'bg-sky-50/40 opacity-80';
    if (isToday) return 'bg-indigo-50/50 border-l-4 border-l-indigo-600';
    return '';
  };

  return (
    <div className="p-4 sm:p-8 bg-[#f8fafc] min-h-screen flex flex-col lg:flex-row gap-8 animate-fade-in">
      {/* --- LEFT: DAILY PLANNER --- */}
      <aside className={`${showPlanner ? 'w-full lg:w-80' : 'w-full lg:w-16'} transition-all duration-500 space-y-6`}>
         <div className="bg-white rounded-[2.5rem] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-slate-200/60 h-fit sticky top-8 overflow-hidden">
            <div className={`flex items-center justify-between ${showPlanner ? 'mb-6 pb-4 border-b border-slate-100' : ''}`}>
               <div className={`flex items-center gap-3 ${!showPlanner ? 'hidden' : ''}`}>
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shadow-sm">
                    <StickyNote size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase leading-none">Planner</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ghi chú cá nhân</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-2">
                 {showPlanner && savingNote && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                 <button 
                  onClick={handleTogglePlanner}
                  title={showPlanner ? "Thu gọn" : "Mở rộng Planner"}
                  className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                 >
                   {showPlanner ? <EyeOff size={18} /> : <StickyNote size={18} />}
                 </button>
               </div>
            </div>

            {showPlanner && (
              <div className="animate-fade-in">
                <div className="flex gap-2 mb-6">
                  <input 
                    type="text" 
                    value={newNoteInput}
                    onChange={(e) => setNewNoteInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNoteItem()}
                    placeholder="Ghi chú nhanh..."
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 transition-all shadow-inner"
                  />
                  <button 
                    onClick={handleAddNoteItem}
                    className="bg-amber-500 text-white p-2.5 rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200"
                  >
                    <Plus size={18} strokeWidth={3} />
                  </button>
                </div>

                <div className="space-y-2 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                  {noteItems.length === 0 ? (
                    <div className="py-10 text-center flex flex-col items-center gap-3 opacity-20">
                      <ClipboardList size={32} />
                      <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed">Chưa có kế hoạch</p>
                    </div>
                  ) : (
                    noteItems.map((item) => (
                      <div key={item.id} className="group flex items-start gap-3 p-3 bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-100 rounded-2xl transition-all shadow-sm">
                        <button 
                          onClick={() => toggleNoteItem(item.id)}
                          className={`mt-0.5 transition-colors ${item.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
                        >
                          {item.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <span className={`flex-1 text-xs font-bold leading-relaxed ${item.completed ? 'text-slate-300 line-through italic' : 'text-slate-700'}`}>
                          {item.text}
                        </span>
                        <button 
                          onClick={() => deleteNoteItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
         </div>
      </aside>

      {/* --- RIGHT: ALL HANDOVER LIST --- */}
      <div className="flex-1 space-y-6">
        <header className="flex flex-col xl:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-slate-200/60">
           <div className="flex items-center gap-4">
              <div className="p-3.5 bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white rounded-2xl shadow-xl shadow-indigo-100/50">
                <ClipboardList size={26} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent uppercase tracking-tighter">Bàn Giao Công Việc</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                   <Layers size={12} className="text-indigo-500" /> Hệ thống kiểm soát nhiệm vụ
                </p>
              </div>
           </div>
           
           <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                <button 
                  onClick={() => setFilterMode('day')} 
                  className={`px-4 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${filterMode === 'day' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                >Ngày</button>
                <button 
                  onClick={() => setFilterMode('month')} 
                  className={`px-4 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${filterMode === 'month' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                >Tháng</button>
                <button 
                  onClick={() => setFilterMode('all')} 
                  className={`px-4 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${filterMode === 'all' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                >Tất cả</button>
              </div>

              {filterMode === 'day' && (
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500" size={16} />
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                  />
                </div>
              )}

              {filterMode === 'month' && (
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500" size={16} />
                  <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                  />
                </div>
              )}

              {isAdmin && (
                <button onClick={() => { setEditingId(null); setNewHandover({task:'', assignee:'', deadlineAt:'', imageLink:'', fileLink: ''}); setIsAddModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
                  <Plus size={16} strokeWidth={3} /> Giao việc
                </button>
              )}
           </div>
        </header>

        {/* --- STATS SUMMARY --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200/60 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner"><BarChart3 size={20}/></div>
                 <div className="text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tổng cộng</p>
                    <p className="text-2xl font-black text-slate-900">{statsTasks.total}</p>
                 </div>
              </div>
           </div>
           
           <div onClick={() => setIsStatsDetailOpen('Processing')} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200/60 flex items-center justify-between hover:border-amber-200 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner"><Activity size={20}/></div>
                 <div className="text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Đang xử lý</p>
                    <p className="text-2xl font-black text-amber-600">{statsTasks.processing}</p>
                 </div>
              </div>
              <ChevronRight size={16} className="text-slate-200 group-hover:text-amber-400 transition-colors" />
           </div>

           <div onClick={() => setIsStatsDetailOpen('Overdue')} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200/60 flex items-center justify-between hover:border-rose-200 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-all shadow-inner"><AlertOctagon size={20}/></div>
                 <div className="text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trễ hạn</p>
                    <p className="text-2xl font-black text-rose-600">{statsTasks.overdue}</p>
                 </div>
              </div>
              <ChevronRight size={16} className="text-slate-200 group-hover:text-rose-400 transition-colors" />
           </div>

           <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200/60 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-inner"><UserCheck size={20}/></div>
                 <div className="text-left">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hoàn tất</p>
                    <p className="text-2xl font-black text-emerald-600">{statsTasks.completed}</p>
                 </div>
              </div>
           </div>
        </div>

        {/* --- MAIN PAGINATED TABLE --- */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/50 overflow-hidden flex flex-col min-h-[600px]">
           <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse text-sm">
                 <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                    <tr className="text-[10px] uppercase text-slate-400 font-black tracking-widest">
                       <th className="px-6 py-5 w-44">Nhân sự & Ngày</th>
                       <th className="px-6 py-5">Nội dung công việc</th>
                       <th className="px-6 py-5 text-center">Tư liệu</th>
                       <th className="px-6 py-5 text-center">Hạn định</th>
                       <th className="px-6 py-5 text-center">Trạng thái</th>
                       <th className="px-6 py-5 text-center">Xử lý</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr><td colSpan={6} className="py-32 text-center flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Đang đồng bộ máy chủ...</span>
                      </td></tr>
                    ) : sortedAndPaginatedData.currentItems.length === 0 ? (
                      <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] italic tracking-widest opacity-30">Không tìm thấy dữ liệu trong thời gian này</td></tr>
                    ) : (
                      sortedAndPaginatedData.currentItems.map((item) => {
                        const [nameOnly, rolePart] = (item.createdBy || '').split(' (');
                        const isToday = item.date.split(' ')[0] === new Date().toISOString().split('T')[0];

                        return (
                        <tr key={item.id} className={`hover:bg-slate-100/30 transition-all group ${getRowStyle(item)}`}>
                           <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 border-2 ${isToday ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                  {getAvatarChar(item.assignee)}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                  <span className="font-black text-slate-800 text-xs truncate max-w-[120px]">{item.assignee}</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                    <Calendar size={8}/> {item.date.split(' ')[0]} {isToday && <span className="text-indigo-600 font-black">• TODAY</span>}
                                  </span>
                                </div>
                              </div>
                           </td>
                           <td className="px-6 py-5 cursor-pointer" onClick={() => handleViewTaskDetail(item)}>
                              <div className="flex flex-col">
                                <span className={`font-bold text-sm leading-tight transition-colors line-clamp-2 ${item.isSeen ? 'text-slate-600' : 'text-slate-900 font-black group-hover:text-indigo-600 underline decoration-indigo-200 decoration-2 underline-offset-4'}`}>{item.task}</span>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><User size={10} className="text-slate-300"/> Giao bởi: {nameOnly}</span>
                                    {!item.isSeen && <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black uppercase animate-pulse">Mới</span>}
                                </div>
                              </div>
                           </td>
                           <td className="px-6 py-5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {item.imageLink ? (
                                  <div onClick={(e) => { e.stopPropagation(); setViewImage(item.imageLink!); }} className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden cursor-zoom-in border border-slate-200 relative group/img shadow-sm hover:border-indigo-400 transition-colors">
                                     <img src={item.imageLink} className="w-full h-full object-cover" />
                                     <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white"><Maximize2 size={12}/></div>
                                  </div>
                                ) : null}
                                
                                {item.fileLink ? (
                                  <a href={item.fileLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Link giao việc">
                                    <LinkIcon size={16} />
                                  </a>
                                ) : null}

                                {item.resultLink ? (
                                  <a href={item.resultLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="Link kết quả">
                                    <FileCheck size={16} />
                                  </a>
                                ) : null}

                                {!item.imageLink && !item.fileLink && !item.resultLink && <span className="text-[8px] text-slate-300 font-bold uppercase tracking-widest italic">Trống</span>}
                              </div>
                           </td>
                           <td className="px-6 py-5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                 <span className={`font-mono font-black px-3 py-1 rounded-lg text-xs whitespace-nowrap border ${item.status === 'Overdue' ? 'bg-rose-100 border-rose-200 text-rose-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                                   {formatDeadline(item.deadlineAt)}
                                 </span>
                              </div>
                           </td>
                           <td className="px-6 py-5 text-center">
                              {getStatusBadge(item.status)}
                           </td>
                           <td className="px-6 py-5 text-center">
                              <div className="flex justify-center items-center gap-2">
                                {isAdmin && (
                                  <button onClick={(e) => handleEditClick(e, item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Chỉnh sửa"><Edit2 size={16}/></button>
                                )}
                                
                                {item.assignee.toLowerCase() === user.fullName.toLowerCase() || isAdmin ? (
                                  <>
                                    {item.status === 'Pending' && (
                                      <button 
                                        onClick={(e) => handleAcceptTask(e, item.id)}
                                        disabled={processingId === item.id}
                                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                                      >
                                        {processingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={14} />} Nhận
                                      </button>
                                    )}
                                    {item.status === 'Processing' && (
                                      <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setReportForm({ report: '', resultLink: '' });
                                            setIsReportModalOpen(item.id);
                                        }}
                                        className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                                      >
                                        <CheckCircle size={14} /> Xong
                                      </button>
                                    )}
                                    {(item.status === 'Completed' || item.status === 'Overdue') && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setIsViewReportOpen(item); }}
                                        className="text-indigo-600 hover:bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 transition-all active:scale-90 shadow-sm" 
                                        title="Báo cáo"
                                      >
                                        <FileCheck size={18} />
                                      </button>
                                    )}
                                  </>
                                ) : null}
                              </div>
                           </td>
                        </tr>
                        );
                      })
                    )}
                 </tbody>
              </table>
           </div>

           {/* --- PAGINATION CONTROLS --- */}
           {!loading && sortedAndPaginatedData.totalPages > 1 && (
              <div className="px-10 py-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Hiển thị {sortedAndPaginatedData.currentItems.length} / {sortedAndPaginatedData.totalItems} nhiệm vụ
                 </div>
                 <div className="flex items-center gap-2">
                    <button 
                       onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                       disabled={currentPage === 1}
                       className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                    >
                       <ChevronLeft size={20} />
                    </button>
                    <div className="flex gap-1.5">
                       {Array.from({length: sortedAndPaginatedData.totalPages}, (_, i) => i + 1).map(page => (
                          <button 
                             key={page}
                             onClick={() => setCurrentPage(page)}
                             className={`w-10 h-10 rounded-xl text-[11px] font-black transition-all border ${currentPage === page ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600 shadow-sm'}`}
                          >
                             {page}
                          </button>
                       ))}
                    </div>
                    <button 
                       onClick={() => setCurrentPage(prev => Math.min(sortedAndPaginatedData.totalPages, prev + 1))}
                       disabled={currentPage === sortedAndPaginatedData.totalPages}
                       className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                    >
                       <ChevronRight size={20} />
                    </button>
                 </div>
              </div>
           )}
        </div>
      </div>

      {/* --- MODAL STATS DETAIL (NEW) --- */}
      {isStatsDetailOpen && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsStatsDetailOpen(null)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden relative animate-slide-in flex flex-col border border-white/20">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl shadow-lg ${isStatsDetailOpen === 'Overdue' ? 'bg-rose-600 text-white' : 'bg-amber-50 text-white'}`}>
                       {isStatsDetailOpen === 'Overdue' ? <AlertOctagon size={24} /> : <Activity size={24} />}
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                         {isStatsDetailOpen === 'Overdue' ? 'Danh sách Trễ hạn' : 'Nhiệm vụ Đang xử lý'}
                       </h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tìm thấy {filteredStatsList.length} nhiệm vụ</p>
                    </div>
                 </div>
                 <button onClick={() => setIsStatsDetailOpen(null)} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:bg-slate-50"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                 {filteredStatsList.length === 0 ? (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                       <CheckCircle size={48} />
                       <p className="text-xs font-black uppercase tracking-[0.2em]">Tuyệt vời! Không có nhiệm vụ nào</p>
                    </div>
                 ) : (
                    <div className="space-y-4">
                       {filteredStatsList.map(item => (
                          <div key={item.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
                             <div className="flex items-center gap-4 flex-1">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-indigo-600 text-xs shadow-sm">
                                   {getAvatarChar(item.assignee)}
                                </div>
                                <div className="flex-1">
                                   <p className="text-sm font-black text-slate-800 leading-tight mb-1">{item.task}</p>
                                   <div className="flex items-center gap-3">
                                      <span className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1"><UserCheck size={10}/> {item.assignee}</span>
                                      <span className="text-[10px] font-bold text-rose-500 uppercase flex items-center gap-1"><Clock size={10}/> {formatDeadline(item.deadlineAt)}</span>
                                   </div>
                                </div>
                             </div>
                             <button onClick={() => { setIsStatsDetailOpen(null); handleViewTaskDetail(item); }} className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm transition-all">
                                <Eye size={18} />
                             </button>
                          </div>
                       ))}
                    </div>
                 )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 text-center">
                 <button onClick={() => setIsStatsDetailOpen(null)} className="px-10 py-4 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">Quay lại</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL VIEW FULL TASK CONTENT --- */}
      {viewFullTask && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-md" onClick={() => setViewFullTask(null)}></div>
           <div className="bg-white rounded-[3rem] shadow-2xl p-8 w-full max-w-2xl relative animate-slide-in overflow-hidden flex flex-col border border-white/20">
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100">
                       <FileText size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thông tin chi tiết</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Nhiệm vụ: {viewFullTask.id}</p>
                    </div>
                 </div>
                 <button onClick={() => setViewFullTask(null)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900 shadow-sm"><X size={20}/></button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-4 space-y-8">
                 <div className="bg-slate-50/80 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Nội dung bàn giao đầy đủ</label>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                       {viewFullTask.task}
                    </p>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Phụ trách bởi</label>
                       <p className="text-sm font-black text-indigo-600 uppercase flex items-center gap-2">
                          <UserCheck size={14}/> {viewFullTask.assignee}
                       </p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Hạn hoàn thành</label>
                       <p className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                          <Clock size={14} className="text-rose-500"/> {formatDeadline(viewFullTask.deadlineAt)}
                       </p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewFullTask.fileLink && (
                       <a href={viewFullTask.fileLink} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl group hover:bg-blue-100 transition-all">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm"><LinkIcon size={16}/></div>
                             <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Tài liệu giao việc</span>
                          </div>
                          <ExternalLink size={14} className="text-blue-400 group-hover:text-blue-600"/>
                       </a>
                    )}
                    {viewFullTask.resultLink && (
                       <a href={viewFullTask.resultLink} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl group hover:bg-emerald-100 transition-all">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm"><FileCheck size={16}/></div>
                             <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Tài liệu kết quả</span>
                          </div>
                          <ExternalLink size={14} className="text-emerald-400 group-hover:text-emerald-600"/>
                       </a>
                    )}
                 </div>

                 {viewFullTask.imageLink && (
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Hình ảnh đính kèm</label>
                       <div className="rounded-[2rem] overflow-hidden border border-slate-100 shadow-md">
                          <img src={viewFullTask.imageLink} className="w-full object-contain" />
                       </div>
                    </div>
                 )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex gap-4">
                 {isAdmin && (
                   <button 
                     onClick={(e) => { setViewFullTask(null); setConfirmDeleteId(viewFullTask.id); }}
                     className="px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all active:scale-95"
                   >
                     Xóa nhiệm vụ
                   </button>
                 )}
                 <button onClick={() => setViewFullTask(null)} className="flex-1 h-16 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 active:scale-95 transition-all">Đóng chi tiết</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL ADD/EDIT TASK --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !processingId && setIsAddModalOpen(false)}></div>
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden relative animate-slide-in border border-white/20">
              <div className="p-10">
                 <h3 className="text-2xl font-black text-slate-900 uppercase mb-8 flex items-center gap-4">
                   <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100">
                      {editingId ? <Edit2 size={28} /> : <Plus size={28} strokeWidth={3} />}
                   </div>
                   {editingId ? 'Sửa nhiệm vụ' : 'Giao việc'}
                 </h3>
                 <form onSubmit={handleAddHandover} className="space-y-6">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nội dung công việc bàn giao</label>
                       <textarea 
                         value={newHandover.task}
                         onChange={(e) => setNewHandover({...newHandover, task: e.target.value})}
                         className="w-full h-32 bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-none transition-all shadow-inner"
                         placeholder="Nhập chi tiết việc cần thực hiện..."
                         required
                       />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nhân sự phụ trách</label>
                          <select 
                            value={newHandover.assignee}
                            onChange={(e) => setNewHandover({...newHandover, assignee: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm cursor-pointer appearance-none"
                            required
                          >
                            <option value="">-- Chọn --</option>
                            {users.map(u => <option key={u.username} value={u.fullName}>{u.fullName}</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Hạn hoàn thành</label>
                          <div className="space-y-2">
                            <input 
                              type="datetime-local" 
                              value={newHandover.deadlineAt}
                              onChange={(e) => setNewHandover({...newHandover, deadlineAt: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                              required
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setQuickDeadline('morning')} className="flex-1 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-[9px] font-black uppercase border border-amber-200 hover:bg-amber-100 transition-all shadow-sm">12:00 Hôm nay</button>
                              <button type="button" onClick={() => setQuickDeadline('afternoon')} className="flex-1 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-[9px] font-black uppercase border border-indigo-200 hover:bg-indigo-100 transition-all shadow-sm">17:30 Hôm nay</button>
                            </div>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Link Driver / Tài liệu giao việc</label>
                           <div className="relative">
                              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input 
                                type="url" 
                                value={newHandover.fileLink}
                                onChange={(e) => setNewHandover({...newHandover, fileLink: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                placeholder="Dán URL link Drive..."
                              />
                           </div>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Ảnh minh họa</label>
                           <div className="flex flex-col gap-2">
                              <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()} 
                                className="w-full h-[52px] flex items-center justify-center gap-2 bg-white border-2 border-indigo-100 border-dashed rounded-2xl hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm font-black text-[10px] uppercase text-indigo-600 tracking-widest"
                              >
                                 <ImageIcon size={20} /> {newHandover.imageLink ? 'Thay đổi ảnh' : 'Tải ảnh lên'}
                              </button>
                              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                              {newHandover.imageLink && (
                                <div className="flex items-center justify-center gap-2 p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[9px] font-black uppercase">
                                  <CheckCircle size={12} /> Đã sẵn sàng
                                </div>
                              )}
                           </div>
                        </div>
                    </div>

                    <div className="pt-6 flex gap-4 border-t border-slate-100">
                       <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-900 transition-colors">Hủy bỏ</button>
                       <button 
                         type="submit" 
                         disabled={processingId === 'creating'}
                         className="flex-[2] py-5 bg-indigo-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                       >
                         {processingId === 'creating' ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} strokeWidth={3}/> {editingId ? 'Cập nhật ngay' : 'Xác nhận giao việc'}</>}
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL REPORT TASK --- */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsReportModalOpen(null)}></div>
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden relative animate-slide-in border border-white/20">
              <div className="p-10">
                 <h3 className="text-xl font-black text-slate-900 uppercase mb-8 flex items-center gap-4 text-center justify-center">
                   <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-100"><CheckCircle size={32} strokeWidth={2.5} /></div>
                   <span>Báo cáo Kết quả</span>
                 </h3>
                 <form onSubmit={handleCompleteTask} className="space-y-6">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Chi tiết kết quả xử lý</label>
                       <textarea 
                         value={reportForm.report}
                         onChange={(e) => setReportForm({...reportForm, report: e.target.value})}
                         className="w-full h-40 bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none resize-none transition-all shadow-inner"
                         placeholder="Mô tả ngắn gọn công việc bạn đã hoàn thành..."
                         required
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">URL file kết quả / Báo cáo</label>
                       <div className="relative">
                          <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="url"
                            value={reportForm.resultLink}
                            onChange={(e) => setReportForm({...reportForm, resultLink: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-14 pr-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm"
                            placeholder="Link Driver, Sheets báo cáo..."
                          />
                       </div>
                    </div>
                    <div className="pt-6 flex gap-4 border-t border-slate-100">
                       <button type="button" onClick={() => setIsReportModalOpen(null)} className="flex-1 py-5 text-slate-400 font-black text-xs uppercase tracking-widest">Hủy</button>
                       <button 
                         type="submit" 
                         disabled={processingId === 'reporting'}
                         className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-3"
                       >
                         {processingId === 'reporting' ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} strokeWidth={3}/> Hoàn tất báo cáo</>}
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL VIEW REPORT DETAILS --- */}
      {isViewReportOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsViewReportOpen(null)}></div>
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden relative animate-slide-in flex flex-col border border-white/20">
              <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-emerald-50/20">
                 <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100">
                       <FileCheck size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Kết quả nhiệm vụ</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mã NV: {isViewReportOpen.id}</p>
                    </div>
                 </div>
                 <button onClick={() => setIsViewReportOpen(null)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-sm"><X size={20}/></button>
              </div>
              
              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1 max-h-[70vh]">
                 <div className="bg-slate-50/80 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Nội dung báo cáo</label>
                    <p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
                       {isViewReportOpen.report || "Nội dung trống."}
                    </p>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Xác nhận lúc</label>
                       <p className="text-xs font-black text-indigo-600 uppercase">
                          {formatDeadline(isViewReportOpen.endTime)}
                       </p>
                    </div>
                    <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Phụ trách bởi</label>
                       <p className="text-xs font-black text-slate-800 uppercase tracking-wider">{isViewReportOpen.assignee}</p>
                    </div>
                 </div>

                 {isViewReportOpen.resultLink && (
                    <a href={isViewReportOpen.resultLink} target="_blank" rel="noreferrer" className="bg-emerald-600 p-6 rounded-[1.5rem] shadow-xl shadow-emerald-100 flex items-center justify-between group transition-all active:scale-95">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white"><LinkIcon size={20} strokeWidth={3}/></div>
                          <div>
                             <p className="text-xs font-black text-white uppercase tracking-widest">Xem tài liệu kết quả</p>
                             <p className="text-[9px] font-bold text-white/60 uppercase">Link kết quả báo cáo</p>
                          </div>
                       </div>
                       <ExternalLink size={20} className="text-white opacity-40 group-hover:opacity-100 transition-opacity" />
                    </a>
                 )}
              </div>
              
              <div className="p-10 bg-gray-50 border-t border-slate-100">
                 <button onClick={() => setIsViewReportOpen(null)} className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-black active:scale-95 transition-all">Đóng kết quả</button>
              </div>
           </div>
        </div>
      )}

      {/* --- IMAGE VIEWER --- */}
      {viewImage && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-4 animate-fade-in" onClick={() => setViewImage(null)}>
           <img src={viewImage} className="max-w-full max-h-full rounded-3xl shadow-2xl animate-slide-in border-4 border-white/10" />
           <button className="absolute top-10 right-10 text-white bg-white/10 hover:bg-white/20 p-5 rounded-full backdrop-blur-md transition-all shadow-2xl"><X size={32} strokeWidth={3}/></button>
        </div>
      )}

      {/* --- DELETE CONFIRM --- */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 w-full max-w-sm relative animate-slide-in text-center border border-rose-100">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-sm border border-rose-100">
                 <AlertTriangle size={48} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase mb-3 tracking-tighter">Xác nhận xóa?</h3>
              <p className="text-xs font-bold text-slate-500 leading-relaxed mb-10 px-4">
                 Công việc này sẽ bị loại bỏ vĩnh viễn khỏi hệ thống quản lý. Thao tác này không thể hoàn tác.
              </p>
              <div className="flex gap-4">
                 <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Hủy</button>
                 <button onClick={() => executeDeleteHandover(confirmDeleteId)} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 active:scale-95 transition-all">Đồng ý xóa</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DailyHandover;
