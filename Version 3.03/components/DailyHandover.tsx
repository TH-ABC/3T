import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardList, Send, CheckCircle, Clock, 
  Plus, X, Loader2, Link as LinkIcon, 
  AlertCircle, FileText, User, Calendar,
  ArrowRight, Save, StickyNote, Filter, 
  ChevronDown, ChevronRight, MessageSquare, Image as ImageIcon,
  CheckSquare, Square, Trash2, Maximize2, ExternalLink,
  History, Download, FileCheck, BarChart3, TrendingUp,
  UserCheck, AlertTriangle, Edit2, ShieldCheck, Sun, Sunset,
  Activity, AlertOctagon, Eye
} from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User as UserType, HandoverItem, UserNote, DailyNoteItem } from '../types';

interface DailyHandoverProps {
  user: UserType;
}

const DailyHandover: React.FC<DailyHandoverProps> = ({ user }) => {
  const [handovers, setHandovers] = useState<HandoverItem[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Note State (Todo List)
  const [noteItems, setNoteItems] = useState<DailyNoteItem[]>([]);
  const [newNoteInput, setNewNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<string | null>(null);
  const [isViewReportOpen, setIsViewReportOpen] = useState<HandoverItem | null>(null);
  const [isStatsDetailOpen, setIsStatsDetailOpen] = useState<'all' | 'completed' | 'incomplete' | 'overdue' | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // State for Full Task Content Modal
  const [viewFullTask, setViewFullTask] = useState<HandoverItem | null>(null);

  // Form States
  const [newHandover, setNewHandover] = useState({ 
    task: '', 
    assignee: '', 
    deadlineAt: '', 
    imageLink: '',
    fileLink: '' 
  });
  const [reportForm, setReportForm] = useState({ report: '', fileLink: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'leader';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [handoverRes, usersRes, noteRes] = await Promise.all([
        sheetService.getHandover(selectedDate, user.fullName, user.role),
        sheetService.getUsers(),
        sheetService.getUserNote(user.username, selectedDate)
      ]);
      setHandovers(Array.isArray(handoverRes) ? handoverRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setNoteItems(noteRes?.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // --- STATS LOGIC ---
  const totalTasks = handovers.length;
  const completedTasks = handovers.filter(h => h.status === 'Completed').length;
  const incompleteTasks = handovers.filter(h => h.status === 'Pending' || h.status === 'Processing').length;
  const overdueTasks = handovers.filter(h => h.status === 'Overdue').length;

  const getTaskTimeliness = (item: HandoverItem) => {
    if (item.status !== 'Completed' || !item.endTime || !item.deadlineAt) return null;
    const end = new Date(item.endTime).getTime();
    const deadline = new Date(item.deadlineAt).getTime();
    return end <= deadline ? 'Sớm/Đúng hạn' : 'Trễ hạn';
  };

  const getAvatarChar = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    const lastWord = parts[parts.length - 1];
    return lastWord ? lastWord.charAt(0).toUpperCase() : fullName.charAt(0).toUpperCase();
  };

  // --- PLANNER ACTIONS ---
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

  const autoSaveNote = async (items: DailyNoteItem[]) => {
    setSavingNote(true);
    try {
      await sheetService.saveUserNote({
        username: user.username,
        date: selectedDate,
        items: items
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
        alert(res?.error || "Lỗi xóa dữ liệu từ máy chủ.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối. Không thể xóa nhiệm vụ vào lúc này.");
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
          date: selectedDate,
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
        ...reportForm,
        status: 'Completed',
        endTime: new Date().toISOString()
      });
      setIsReportModalOpen(null);
      setReportForm({ report: '', fileLink: '' });
      fetchData();
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending': return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase">Chưa nhận</span>;
      case 'Processing': return <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase flex items-center gap-1.5"><Clock size={10} className="animate-spin" /> Đang xử lý</span>;
      case 'Completed': return <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase flex items-center gap-1.5"><CheckCircle size={10} /> Hoàn thành</span>;
      case 'Overdue': return <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black uppercase flex items-center gap-1.5"><AlertCircle size={10} /> Quá hạn</span>;
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

  const getRowStyle = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-blue-50/60';
      case 'Completed': return 'bg-sky-50';
      case 'Overdue': return 'bg-rose-50 border-l-4 border-l-rose-500';
      default: return '';
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-[#f8fafc] min-h-screen flex flex-col lg:flex-row gap-8">
      {/* --- LEFT: DAILY PLANNER (Moved to Left) --- */}
      <aside className="w-full lg:w-96 space-y-6">
         <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-200/60 h-fit sticky top-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                    <StickyNote size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase leading-none">Daily Planner</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kế hoạch cá nhân</p>
                  </div>
               </div>
               {savingNote && <Loader2 size={16} className="animate-spin text-indigo-500" />}
            </div>

            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={newNoteInput}
                onChange={(e) => setNewNoteInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNoteItem()}
                placeholder="Việc cần làm hôm nay..."
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
              <button 
                onClick={handleAddNoteItem}
                className="bg-amber-500 text-white p-2.5 rounded-xl hover:bg-amber-600 transition-all shadow-md shadow-amber-100"
              >
                <Plus size={18} strokeWidth={3} />
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {noteItems.length === 0 ? (
                <div className="py-10 text-center flex flex-col items-center gap-3 opacity-30">
                  <ClipboardList size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed px-10">Danh sách trống. Hãy bắt đầu lên kế hoạch ngay!</p>
                </div>
              ) : (
                noteItems.map((item) => (
                  <div key={item.id} className="group flex items-start gap-3 p-3 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 rounded-2xl transition-all">
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
      </aside>

      {/* --- RIGHT: HANDOVER LIST (Moved to Right) --- */}
      <div className="flex-1 space-y-6">
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200/60">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white rounded-2xl shadow-lg shadow-indigo-100">
                <ClipboardList size={26} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent uppercase tracking-tighter">BÀN GIAO CÔNG VIỆC</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Xử lý nhiệm vụ & Kiểm soát hiệu suất thời gian thực</p>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <div className="relative group">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none z-10" size={14} />
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-inner appearance-none"
                />
              </div>
              {isAdmin && (
                <button onClick={() => { setEditingId(null); setNewHandover({task:'', assignee:'', deadlineAt:'', imageLink:'', fileLink: ''}); setIsAddModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                  <Plus size={14} /> Giao việc mới
                </button>
              )}
           </div>
        </header>

        {/* --- STATS BAR --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <button 
             onClick={() => setIsStatsDetailOpen('all')}
             className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-slate-200/50 flex items-center justify-between hover:border-indigo-200 transition-all group"
           >
              <div className="flex items-center gap-3">
                 <div className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all"><BarChart3 size={18}/></div>
                 <div className="text-left">
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Đã giao</p>
                    <p className="text-lg sm:text-xl font-black text-slate-900">{totalTasks}</p>
                 </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
           </button>
           <button 
             onClick={() => setIsStatsDetailOpen('completed')}
             className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-slate-200/50 flex items-center justify-between hover:border-emerald-200 transition-all group"
           >
              <div className="flex items-center gap-3">
                 <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all"><UserCheck size={18}/></div>
                 <div className="text-left">
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Xong</p>
                    <p className="text-lg sm:text-xl font-black text-emerald-600">{completedTasks}</p>
                 </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
           </button>
           <button 
             onClick={() => setIsStatsDetailOpen('incomplete')}
             className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-slate-200/50 flex items-center justify-between hover:border-amber-200 transition-all group"
           >
              <div className="flex items-center gap-3">
                 <div className="p-2 sm:p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all"><Activity size={18}/></div>
                 <div className="text-left">
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Đang chạy</p>
                    <p className="text-lg sm:text-xl font-black text-amber-600">{incompleteTasks}</p>
                 </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
           </button>
           <button 
             onClick={() => setIsStatsDetailOpen('overdue')}
             className="bg-white p-4 sm:p-5 rounded-[1.5rem] shadow-sm border border-slate-200/50 flex items-center justify-between hover:border-rose-200 transition-all group"
           >
              <div className="flex items-center gap-3">
                 <div className="p-2 sm:p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-all"><AlertOctagon size={18}/></div>
                 <div className="text-left">
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Quá hạn</p>
                    <p className="text-lg sm:text-xl font-black text-rose-600">{overdueTasks}</p>
                 </div>
              </div>
              <ChevronRight size={16} className="text-slate-300" />
           </button>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/50 overflow-hidden">
           <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm">
                 <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-[10px] uppercase text-slate-400 font-black tracking-widest">
                       <th className="px-6 py-5">Người giao</th>
                       <th className="px-6 py-5">Công việc</th>
                       <th className="px-6 py-5 text-center">Hình ảnh</th>
                       <th className="px-6 py-5">Người nhận</th>
                       <th className="px-6 py-5 text-center">Hạn hoàn thành</th>
                       <th className="px-6 py-5 text-center">Trạng thái</th>
                       <th className="px-6 py-5 text-center">Thao tác</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={32} /></td></tr>
                    ) : handovers.length === 0 ? (
                      <tr><td colSpan={7} className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] italic tracking-widest">Chưa có công việc nào được bàn giao</td></tr>
                    ) : (
                      handovers.map((item) => {
                        const [nameOnly, rolePart] = (item.createdBy || '').split(' (');
                        const cleanRole = rolePart ? rolePart.replace(')', '') : '';
                        const isGiverAdmin = cleanRole.toLowerCase().includes('admin') || cleanRole.toLowerCase().includes('ceo');

                        return (
                        <tr key={item.id} className={`hover:bg-slate-100/40 transition-colors group ${getRowStyle(item.status)}`}>
                           <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black flex-shrink-0 ${isGiverAdmin ? 'bg-red-600 admin-logo-pulse text-white shadow-lg shadow-red-200/50 text-[7px] border-2 border-red-400' : 'bg-slate-900 text-white text-xs'}`}>
                                  {isGiverAdmin ? 'ADMIN' : (item.createdBy?.charAt(0) || 'A')}
                                </div>
                                <div className="flex flex-col">
                                  {isGiverAdmin && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-0.5">Admin</span>}
                                  <span className={`font-bold whitespace-nowrap leading-none ${isGiverAdmin ? 'admin-red-gradient text-sm' : 'text-slate-700 text-xs'}`}>
                                    {nameOnly || item.createdBy}
                                  </span>
                                </div>
                              </div>
                           </td>
                           <td className="px-6 py-5 cursor-pointer" onClick={() => handleViewTaskDetail(item)}>
                              <div className="flex flex-col">
                                <span className="font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">{item.task}</span>
                                {item.fileLink && (
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <a href={item.fileLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] text-blue-500 hover:text-blue-700 font-black uppercase flex items-center gap-1" title="Xem Driver">
                                      <LinkIcon size={10} /> Link Tài liệu
                                    </a>
                                    <span className="text-[10px] text-slate-300 font-bold uppercase flex items-center gap-1"><Eye size={10}/> Nhấn để xem full</span>
                                  </div>
                                )}
                              </div>
                           </td>
                           <td className="px-6 py-5 text-center">
                              {item.imageLink ? (
                                <div onClick={(e) => { e.stopPropagation(); setViewImage(item.imageLink!); }} className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden cursor-zoom-in border border-slate-200 relative group/img shadow-sm">
                                   <img src={item.imageLink} className="w-full h-full object-cover" />
                                   <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white"><Maximize2 size={12}/></div>
                                </div>
                              ) : (
                                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Không ảnh</span>
                              )}
                           </td>
                           <td className="px-6 py-5">
                              <div className="flex items-center gap-2.5">
                                 <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase border border-indigo-100">
                                   {getAvatarChar(item.assignee)}
                                 </div>
                                 <span className="font-bold text-slate-700 whitespace-nowrap">{item.assignee}</span>
                              </div>
                           </td>
                           <td className="px-6 py-5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                 <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                                   {formatDeadline(item.deadlineAt)}
                                 </span>
                                 {item.startTime && <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Nhận lúc: {formatDeadline(item.startTime).split(' ')[1]}</span>}
                              </div>
                           </td>
                           <td className="px-6 py-5 text-center">
                              {getStatusBadge(item.status)}
                           </td>
                           <td className="px-6 py-5 text-center">
                              <div className="flex justify-center items-center gap-2">
                                {isAdmin && (
                                  <>
                                    <button onClick={(e) => handleEditClick(e, item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Sửa nhiệm vụ"><Edit2 size={16}/></button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id); }} 
                                      disabled={processingId === item.id} 
                                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" 
                                      title="Xóa nhiệm vụ"
                                    >
                                      {processingId === item.id ? <Loader2 size={16} className="animate-spin text-rose-500" /> : <Trash2 size={16}/>}
                                    </button>
                                  </>
                                )}
                                
                                {item.assignee.toLowerCase() === user.fullName.toLowerCase() || isAdmin ? (
                                  <>
                                    {item.status === 'Pending' && (
                                      <button 
                                        onClick={(e) => handleAcceptTask(e, item.id)}
                                        disabled={processingId === item.id}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-md"
                                      >
                                        {processingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />} Nhận việc
                                      </button>
                                    )}
                                    {item.status === 'Processing' && (
                                      <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setReportForm({ report: '', fileLink: '' });
                                            setIsReportModalOpen(item.id);
                                        }}
                                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-md"
                                      >
                                        <CheckCircle size={12} /> Hoàn thành
                                      </button>
                                    )}
                                    {(item.status === 'Completed' || item.status === 'Overdue') && (
                                      <div className="flex gap-2">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setIsViewReportOpen(item); }}
                                          className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl border border-indigo-100 transition-all active:scale-90" 
                                          title="Xem báo cáo"
                                        >
                                          <History size={18} />
                                        </button>
                                        {item.fileLink && (
                                          <a href={item.fileLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-xl border border-emerald-100 transition-all active:scale-90" title="File đính kèm">
                                            <LinkIcon size={18} />
                                          </a>
                                        )}
                                      </div>
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
        </div>
      </div>

      {/* --- MODAL VIEW FULL TASK CONTENT --- */}
      {viewFullTask && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setViewFullTask(null)}></div>
           <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-2xl relative animate-slide-in overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                 <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                       <FileText size={22} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-slate-900 uppercase">Chi tiết công việc</h3>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mã NV: {viewFullTask.id}</p>
                    </div>
                 </div>
                 <button onClick={() => setViewFullTask(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-900"><X size={20}/></button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-4 space-y-6">
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Nội dung bàn giao đầy đủ</label>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                       {viewFullTask.task}
                    </p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Người giao</label>
                       <p className="text-xs font-black text-slate-900 uppercase">{viewFullTask.createdBy}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Hạn hoàn thành</label>
                       <p className="text-xs font-black text-indigo-600 uppercase">{formatDeadline(viewFullTask.deadlineAt)}</p>
                    </div>
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex gap-3">
                 {viewFullTask.fileLink && (
                   <a href={viewFullTask.fileLink} target="_blank" rel="noreferrer" className="flex-1 h-14 bg-blue-50 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all">
                     <LinkIcon size={14}/> Mở tài liệu đính kèm
                   </a>
                 )}
                 <button onClick={() => setViewFullTask(null)} className="flex-1 h-14 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 active:scale-95 transition-all">Đóng nội dung</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL ADD/EDIT TASK --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsAddModalOpen(false)}></div>
           <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-slide-in">
              <div className="p-8">
                 <h3 className="text-xl font-black text-slate-900 uppercase mb-8 flex items-center gap-3">
                   <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                      {editingId ? <Edit2 size={24} /> : <Plus size={24} />}
                   </div>
                   {editingId ? 'Cập nhật nhiệm vụ' : 'Bàn giao công việc'}
                 </h3>
                 <form onSubmit={handleAddHandover} className="space-y-6">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Nội dung công việc</label>
                       <textarea 
                         value={newHandover.task}
                         onChange={(e) => setNewHandover({...newHandover, task: e.target.value})}
                         className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all"
                         placeholder="Nhập chi tiết việc cần bàn giao..."
                         required
                       />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Người nhận việc</label>
                          <select 
                            value={newHandover.assignee}
                            onChange={(e) => setNewHandover({...newHandover, assignee: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            required
                          >
                            <option value="">-- Chọn nhân viên --</option>
                            {users.map(u => <option key={u.username} value={u.fullName}>{u.fullName} ({u.role})</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Hạn hoàn thành</label>
                          <div className="space-y-2">
                            <input 
                              type="datetime-local" 
                              value={newHandover.deadlineAt}
                              onChange={(e) => setNewHandover({...newHandover, deadlineAt: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                              required
                            />
                            <div className="flex gap-2">
                              <button 
                                type="button" 
                                onClick={() => setQuickDeadline('morning')}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase border border-amber-200 hover:bg-amber-100 transition-all shadow-sm"
                              >
                                <Sun size={12} /> Today: 12:00
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setQuickDeadline('afternoon')}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase border border-indigo-200 hover:bg-indigo-100 transition-all shadow-sm"
                              >
                                <Sunset size={12} /> Today: 17:30
                              </button>
                            </div>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Link Driver / Tài liệu</label>
                           <div className="relative">
                              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                              <input 
                                type="url" 
                                value={newHandover.fileLink}
                                onChange={(e) => setNewHandover({...newHandover, fileLink: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                placeholder="Dán link Google Drive..."
                              />
                           </div>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Hình ảnh minh họa</label>
                           <div className="flex flex-col gap-2">
                              <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()} 
                                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 border-dashed rounded-2xl hover:bg-indigo-100 transition-all shadow-sm font-black text-[10px] uppercase tracking-widest"
                              >
                                 <ImageIcon size={18} /> {newHandover.imageLink ? 'Đã chọn ảnh - Thay đổi' : 'Tải lên hình ảnh'}
                              </button>
                              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                              {newHandover.imageLink && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl">
                                  <CheckCircle size={14} />
                                  <span className="text-[10px] font-bold">File ảnh đã được sẵn sàng</span>
                                </div>
                              )}
                           </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                       <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest">Hủy</button>
                       <button 
                         type="submit" 
                         disabled={processingId === 'creating'}
                         className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                       >
                         {processingId === 'creating' ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16}/> {editingId ? 'Cập nhật ngay' : 'Xác nhận bàn giao'}</>}
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL REPORT TASK --- */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsReportModalOpen(null)}></div>
           <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-slide-in">
              <div className="p-8">
                 <h3 className="text-xl font-black text-slate-900 uppercase mb-8 flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg"><CheckCircle size={24} /></div>
                   Báo cáo hoàn thành
                 </h3>
                 <form onSubmit={handleCompleteTask} className="space-y-5">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Nội dung kết quả xử lý</label>
                       <textarea 
                         value={reportForm.report}
                         onChange={(e) => setReportForm({...reportForm, report: e.target.value})}
                         className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none transition-all"
                         placeholder="Mô tả kết quả công việc đã hoàn thành..."
                         required
                       />
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5 block">Link file kết quả (nếu có)</label>
                       <div className="relative">
                          <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="url"
                            value={reportForm.fileLink}
                            onChange={(e) => setReportForm({...reportForm, fileLink: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            placeholder="https://drive.google.com/..."
                          />
                       </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                       <button type="button" onClick={() => setIsReportModalOpen(null)} className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest">Hủy</button>
                       <button 
                         type="submit" 
                         disabled={processingId === 'reporting'}
                         className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                       >
                         {processingId === 'reporting' ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16}/> Gửi báo cáo</>}
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
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-slide-in flex flex-col">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
                 <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg">
                       <FileCheck size={20} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-slate-900 uppercase">Kết quả công việc</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chi tiết phản hồi từ nhân viên</p>
                    </div>
                 </div>
                 <button onClick={() => setIsViewReportOpen(null)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-xl transition-all"><X size={20}/></button>
              </div>
              
              <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 max-h-[70vh]">
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nội dung báo cáo</label>
                    <p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">
                       {isViewReportOpen.report || "Nhân viên chưa cập nhật nội dung văn bản."}
                    </p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Hoàn thành lúc</label>
                       <p className="text-xs font-black text-indigo-600 uppercase">
                          {formatDeadline(isViewReportOpen.endTime)}
                       </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Người báo cáo</label>
                       <p className="text-xs font-black text-slate-800 uppercase">{isViewReportOpen.assignee}</p>
                    </div>
                 </div>

                 {isViewReportOpen.fileLink && (
                    <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 flex items-center justify-between group">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg"><LinkIcon size={18}/></div>
                          <div>
                             <p className="text-xs font-black text-emerald-800 uppercase">Tệp tin đính kèm</p>
                             <p className="text-[9px] font-bold text-emerald-600/60 uppercase">Nhấn để truy cập kết quả</p>
                          </div>
                       </div>
                       <a href={isViewReportOpen.fileLink} target="_blank" rel="noreferrer" className="p-3 bg-white text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90"><ExternalLink size={18}/></a>
                    </div>
                 )}

                 {isViewReportOpen.imageLink && (
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ảnh minh họa ban đầu</label>
                       <div onClick={() => setViewImage(isViewReportOpen.imageLink!)} className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in group/repimg relative">
                          <img src={isViewReportOpen.imageLink} className="w-full aspect-video object-cover transition-transform group-hover/repimg:scale-105 duration-500" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/repimg:opacity-100 transition-opacity flex items-center justify-center text-white"><Maximize2 size={24}/></div>
                       </div>
                    </div>
                 )}
              </div>
              
              <div className="p-8 bg-gray-50 border-t border-slate-100">
                 <button onClick={() => setIsViewReportOpen(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all">Đóng chi tiết</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL STATS DETAIL --- */}
      {isStatsDetailOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setIsStatsDetailOpen(null)}></div>
           <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-slide-in flex flex-col max-h-[85vh]">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 relative z-30">
                 <div className="flex items-center gap-4">
                    <div className={`p-3 text-white rounded-2xl shadow-lg ${isStatsDetailOpen === 'overdue' ? 'bg-rose-600' : isStatsDetailOpen === 'incomplete' ? 'bg-amber-500' : 'bg-slate-900'}`}>
                       {isStatsDetailOpen === 'overdue' ? <AlertOctagon size={24} /> : isStatsDetailOpen === 'incomplete' ? <Activity size={24} /> : <TrendingUp size={24} />}
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                          {isStatsDetailOpen === 'all' ? 'Đã giao' 
                            : isStatsDetailOpen === 'completed' ? 'Xong'
                            : isStatsDetailOpen === 'incomplete' ? 'Đang chạy'
                            : 'Quá hạn'}
                       </h3>
                    </div>
                 </div>
                 <button onClick={() => setIsStatsDetailOpen(null)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-xl transition-all hover:bg-slate-50"><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                 <table className="w-full text-left border-collapse relative">
                    <thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgba(226,232,240,1)] bg-white">
                       <tr className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                          <th className="px-8 py-5">Nhân viên</th>
                          <th className="px-6 py-5">Nội dung công việc</th>
                          <th className="px-6 py-5 text-center whitespace-nowrap">Hiệu suất / Hạn</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {(isStatsDetailOpen === 'completed' 
                          ? handovers.filter(h => h.status === 'Completed') 
                          : isStatsDetailOpen === 'incomplete'
                          ? handovers.filter(h => h.status === 'Pending' || h.status === 'Processing')
                          : isStatsDetailOpen === 'overdue'
                          ? handovers.filter(h => h.status === 'Overdue')
                          : handovers
                       ).map((item, idx) => {
                          const timeliness = getTaskTimeliness(item);
                          return (
                             <tr key={idx} className="hover:bg-slate-50/40 transition-colors group">
                                <td className="px-8 py-5">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 border border-indigo-100">
                                         {getAvatarChar(item.assignee)}
                                      </div>
                                      <span className="text-xs font-black text-slate-800">{item.assignee}</span>
                                   </div>
                                </td>
                                <td className="px-6 py-5">
                                   <p className="text-xs font-bold text-slate-600 line-clamp-1 group-hover:text-indigo-600">{item.task}</p>
                                   <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Hạn: {formatDeadline(item.deadlineAt)}</p>
                                </td>
                                <td className="px-6 py-5 text-center min-w-[140px]">
                                   {timeliness ? (
                                      <span className={`inline-flex items-center justify-center px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap leading-relaxed transition-all shadow-sm ${timeliness === 'Sớm/Đúng hạn' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                                         {timeliness}
                                      </span>
                                   ) : item.status === 'Overdue' ? (
                                      <span className="inline-flex items-center justify-center px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap bg-rose-50 text-rose-600 border border-rose-100">Quá hạn</span>
                                   ) : (
                                      <span className="text-[9px] font-black text-slate-300 uppercase italic">Chưa hoàn thành</span>
                                   )}
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>

              <div className="p-8 bg-gray-50 border-t border-slate-100 relative z-30">
                 <button onClick={() => setIsStatsDetailOpen(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all">Đóng báo cáo</button>
              </div>
           </div>
        </div>
      )}

      {/* --- CUSTOM CONFIRM DELETE MODAL --- */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}></div>
           <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-sm relative animate-slide-in">
              <div className="flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-rose-100">
                    <AlertTriangle size={32} />
                 </div>
                 <h3 className="text-lg font-black text-slate-900 uppercase mb-2 tracking-tight">Xác nhận xóa?</h3>
                 <p className="text-xs font-bold text-slate-500 leading-relaxed mb-8">
                    Nhiệm vụ này sẽ bị xóa vĩnh viễn khỏi hệ thống Google Sheets. Bạn chắc chắn chứ?
                 </p>
                 <div className="flex w-full gap-3">
                    <button 
                       onClick={() => setConfirmDeleteId(null)} 
                       className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                       Hủy bỏ
                    </button>
                    <button 
                       onClick={() => executeDeleteHandover(confirmDeleteId)} 
                       className="flex-1 py-3.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 active:scale-95 transition-all"
                    >
                       Đồng ý xóa
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- IMAGE VIEWER MODAL --- */}
      {viewImage && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={() => setViewImage(null)}>
           <img src={viewImage} className="max-w-full max-h-full rounded-2xl shadow-2xl animate-slide-in" />
           <button className="absolute top-8 right-8 text-white bg-white/10 hover:bg-white/20 p-4 rounded-full backdrop-blur-md transition-all"><X size={32}/></button>
        </div>
      )}
    </div>
  );
};

export default DailyHandover;