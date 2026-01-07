
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
  Activity, AlertOctagon, Eye, ChevronLeft, Layers, EyeOff,
  Search, CalendarDays, Bookmark, RefreshCw, RefreshCcw, MoreHorizontal,
  Upload, File, Trash, GripVertical, Check
} from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User as UserType, HandoverItem, UserNote, DailyNoteItem } from '../types';

interface DailyHandoverProps {
  user: UserType;
}

interface KanbanColumn {
  id: string;
  title: string;
}

interface KanbanItem {
  id: string;
  text: string;
  columnId: string;
  completed: boolean;
  createdAt: string;
}

const DailyHandover: React.FC<DailyHandoverProps> = ({ user }) => {
  const [handovers, setHandovers] = useState<HandoverItem[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterMode, setFilterMode] = useState<'day' | 'month' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- KANBAN PLANNER STATE ---
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([
    { id: 'todo', title: 'Cần làm' },
    { id: 'doing', title: 'Đang làm' },
    { id: 'done', title: 'Hoàn thành' }
  ]);
  const [kanbanItems, setKanbanItems] = useState<KanbanItem[]>([]);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState<{ [colId: string]: string }>({});
  const [savingNote, setSavingNote] = useState(false);
  const [plannerPos, setPlannerPos] = useState({ x: window.innerWidth / 2 - 450, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null);
  
  // New column state
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<string | null>(null);
  const [viewFullTask, setViewFullTask] = useState<HandoverItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  // Multi-link States
  const [handoverLinks, setHandoverLinks] = useState<string[]>(['']);
  const [reportLinks, setReportLinks] = useState<string[]>(['']);

  // Form States
  const [newHandover, setNewHandover] = useState({ 
    task: '', assignee: '', deadlineAt: ''
  });
  const [reportForm, setReportForm] = useState({ report: '' });
  
  const isAdmin = user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'leader' || user.role.toLowerCase() === 'ceo';

  // --- DRAGGABLE PLANNER LOGIC ---
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.planner-content') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: plannerPos.x,
        initialY: plannerPos.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPlannerPos({
            x: Math.max(10, Math.min(window.innerWidth - 300, dragRef.current.initialX + dx)),
            y: Math.max(10, Math.min(window.innerHeight - 300, dragRef.current.initialY + dy))
        });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let dateParam = filterMode === 'day' ? selectedDate : filterMode === 'month' ? selectedMonth : "all";
      const [handoverRes, usersRes, noteRes] = await Promise.all([
        sheetService.getHandover(dateParam, user.fullName, user.role),
        sheetService.getUsers(),
        sheetService.getUserNote(user.username, "PLANNER_BOARD")
      ]);
      setHandovers(Array.isArray(handoverRes) ? handoverRes : []);
      setUsers(Array.isArray(usersRes) ? usersRes : []);
      
      if (noteRes && noteRes.items) {
        const items = noteRes.items.map((it: any) => ({
          ...it,
          columnId: it.columnId || (it.completed ? 'done' : 'todo'),
          createdAt: it.createdAt || new Date().toLocaleDateString('vi-VN')
        }));
        setKanbanItems(items);
        if (noteRes.columns && Array.isArray(noteRes.columns) && noteRes.columns.length > 0) {
          setKanbanColumns(noteRes.columns);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDate, selectedMonth, filterMode]);

  const stats = useMemo(() => ({
    total: handovers.length,
    pending: handovers.filter(h => h.status === 'Pending').length,
    processing: handovers.filter(h => h.status === 'Processing').length,
    completed: handovers.filter(h => h.status === 'Completed').length,
    overdue: handovers.filter(h => h.status === 'Overdue').length
  }), [handovers]);

  const filteredHandovers = useMemo(() => {
    return handovers.filter(h => 
      h.task.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.assignee.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.createdBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.id.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [handovers, searchTerm]);

  const handleQuickTime = (hours: number, minutes: number) => {
    const now = new Date();
    now.setHours(hours, minutes, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(hours)}:${pad(minutes)}`;
    setNewHandover(prev => ({ ...prev, deadlineAt: formatted }));
  };

  const handleAcceptTask = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProcessingId(id);
    try {
      await sheetService.updateHandover(id, { status: 'Processing', startTime: new Date().toISOString() });
      await fetchData();
    } finally { setProcessingId(null); }
  };

  // --- KANBAN LOGIC ---
  const saveKanbanState = async (newItems: KanbanItem[], newCols: KanbanColumn[]) => {
    setSavingNote(true);
    try {
      await sheetService.saveUserNote({
        username: user.username,
        date: "PLANNER_BOARD",
        items: newItems as any,
        columns: newCols as any
      } as any);
    } finally {
      setSavingNote(false);
    }
  };

  const addKanbanItem = (colId: string) => {
    const text = newNoteInput[colId];
    if (!text?.trim()) return;
    const newItem: KanbanItem = {
      id: 'k-' + Date.now(),
      text: text.trim(),
      columnId: colId,
      completed: colId === 'done',
      createdAt: new Date().toLocaleDateString('vi-VN')
    };
    const updated = [...kanbanItems, newItem];
    setKanbanItems(updated);
    setNewNoteInput({ ...newNoteInput, [colId]: '' });
    saveKanbanState(updated, kanbanColumns);
  };

  const deleteKanbanItem = (id: string) => {
    const updated = kanbanItems.filter(i => i.id !== id);
    setKanbanItems(updated);
    saveKanbanState(updated, kanbanColumns);
  };

  const handleConfirmAddColumn = () => {
    if (!newColumnTitle.trim()) return;
    const newCol = { id: 'col-' + Date.now(), title: newColumnTitle.trim() };
    const updatedCols = [...kanbanColumns, newCol];
    setKanbanColumns(updatedCols);
    saveKanbanState(kanbanItems, updatedCols);
    setNewColumnTitle('');
    setIsAddingColumn(false);
  };

  const deleteColumn = (colId: string) => {
    if (kanbanItems.some(i => i.columnId === colId)) {
      alert("Không thể xóa cột đang có ghi chú. Vui lòng chuyển hoặc xóa ghi chú trước.");
      return;
    }
    const updatedCols = kanbanColumns.filter(c => c.id !== colId);
    setKanbanColumns(updatedCols);
    saveKanbanState(kanbanItems, updatedCols);
  };

  const onDragItemStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('itemId', id);
  };

  const onDropItem = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId) return;
    const updated = kanbanItems.map(item => 
      item.id === itemId ? { ...item, columnId: targetColId, completed: targetColId === 'done' } : item
    );
    setKanbanItems(updated);
    saveKanbanState(updated, kanbanColumns);
  };

  // --- FILE UPLOAD LOGIC ---
  const uploadFiles = async (files: FileList | null, target: 'add' | 'report') => {
    if (!files || files.length === 0) return;
    setUploadingCount(prev => prev + files.length);
    for (const file of Array.from(files)) {
      try {
        const reader = new FileReader();
        const uploadPromise = new Promise<{success: boolean, url?: string}>((resolve) => {
          reader.onload = async (e) => {
            const base64 = (e.target?.result as string).split(',')[1];
            const res = await sheetService.uploadHandoverFile(base64, file.name);
            resolve(res);
          };
          reader.readAsDataURL(file);
        });
        const result = await uploadPromise;
        if (result.success && result.url) {
          if (target === 'add') {
            setHandoverLinks(prev => {
              const filtered = prev.filter(l => l.trim() !== '');
              return [...filtered, result.url!];
            });
          } else {
            setReportLinks(prev => {
              const filtered = prev.filter(l => l.trim() !== '');
              return [...filtered, result.url!];
            });
          }
        }
      } catch (err) { console.error("Upload error:", err); }
      finally { setUploadingCount(prev => Math.max(0, prev - 1)); }
    }
  };

  const handleDrop = (e: React.DragEvent, target: 'add' | 'report') => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files, target);
  };

  const updateLink = (index: number, val: string, target: 'add' | 'report') => {
    if (target === 'add') {
      const next = [...handoverLinks]; next[index] = val; setHandoverLinks(next);
    } else {
      const next = [...reportLinks]; next[index] = val; setReportLinks(next);
    }
  };

  const addLinkField = (target: 'add' | 'report') => {
    if (target === 'add') setHandoverLinks([...handoverLinks, '']);
    else setReportLinks([...reportLinks, '']);
  };

  const removeLinkField = (index: number, target: 'add' | 'report') => {
    if (target === 'add') {
      const next = handoverLinks.filter((_, i) => i !== index);
      setHandoverLinks(next.length === 0 ? [''] : next);
    } else {
      const next = reportLinks.filter((_, i) => i !== index);
      setReportLinks(next.length === 0 ? [''] : next);
    }
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReportModalOpen) return;
    setProcessingId('reporting');
    try {
      const finalLinks = reportLinks.filter(l => l.trim() !== '').join(', ');
      await sheetService.updateHandover(isReportModalOpen, {
        report: reportForm.report,
        resultLink: finalLinks,
        status: 'Completed',
        endTime: new Date().toISOString(),
        progress: 100
      });
      setIsReportModalOpen(null);
      setReportForm({ report: '' });
      setReportLinks(['']);
      await fetchData();
    } finally { setProcessingId(null); }
  };

  const handleAddHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHandover.task || !newHandover.assignee || !newHandover.deadlineAt) return;
    setProcessingId('creating');
    try {
      const finalLinks = handoverLinks.filter(l => l.trim() !== '').join(', ');
      let res;
      if (editingId) res = await sheetService.updateHandover(editingId, { ...newHandover, fileLink: finalLinks });
      else res = await sheetService.addHandover({ 
        ...newHandover, 
        fileLink: finalLinks,
        date: new Date().toISOString().split('T')[0], 
        createdBy: `${user.fullName} (${user.role})` 
      });
      if (res.success) {
        setIsAddModalOpen(false);
        setEditingId(null);
        setNewHandover({ task: '', assignee: '', deadlineAt: '' });
        setHandoverLinks(['']);
        await fetchData();
      }
    } finally { setProcessingId(null); }
  };

  const handleEditClick = (e: React.MouseEvent, item: HandoverItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setNewHandover({ task: item.task, assignee: item.assignee, deadlineAt: item.deadlineAt || '' });
    const links = item.fileLink ? item.fileLink.split(',').map(l => l.trim()) : [''];
    setHandoverLinks(links);
    setIsAddModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col relative font-sans selection:bg-indigo-100">
      {/* Floating Planner Button */}
      <div 
        className="fixed z-[999] shadow-2xl transition-transform active:scale-95"
        style={{ right: '30px', bottom: '100px' }}
      >
        <button 
            onClick={() => setIsPlannerOpen(!isPlannerOpen)}
            className="w-14 h-14 bg-gradient-to-tr from-amber-400 to-orange-600 rounded-full flex items-center justify-center text-white shadow-xl hover:shadow-orange-200 transition-all border-4 border-white"
        >
            <StickyNote size={24} />
            {kanbanItems.filter(i => i.columnId !== 'done').length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-md">{kanbanItems.filter(i => i.columnId !== 'done').length}</span>
            )}
        </button>
      </div>

      {/* --- KANBAN PLANNER POPUP --- */}
      {isPlannerOpen && (
        <div 
            className="fixed z-[1000] w-[90vw] max-w-5xl bg-white rounded-[2.5rem] shadow-[0_40px_120px_rgba(0,0,0,0.3)] border border-slate-200 overflow-hidden flex flex-col animate-slide-in"
            style={{ left: plannerPos.x, top: plannerPos.y }}
        >
            <div 
                className="p-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex justify-between items-center cursor-move"
                onMouseDown={handleDragStart}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner"><StickyNote size={20} /></div>
                    <div>
                        <span className="text-xs font-black uppercase tracking-widest block">Daily Planner Board</span>
                        <span className="text-[9px] font-bold text-orange-100 uppercase">Kéo thả ghi chú để sắp xếp công việc</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsAddingColumn(true)} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10">
                        <Plus size={14} /> Thêm cột
                    </button>
                    <button onClick={() => setIsPlannerOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition-all"><X size={20} /></button>
                </div>
            </div>

            <div className="planner-content p-6 flex gap-6 overflow-x-auto custom-scrollbar bg-[#fffaf5] min-h-[500px]">
                {kanbanColumns.map((col) => (
                    <div 
                        key={col.id} 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDropItem(e, col.id)}
                        className="flex-shrink-0 w-80 flex flex-col gap-4"
                    >
                        <div className="flex justify-between items-center px-4 py-2 bg-white/40 rounded-2xl border border-orange-50">
                           <div className="flex items-center gap-2">
                               <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]"></span>
                               <h4 className="text-xs font-black uppercase text-slate-700 tracking-widest">{col.title}</h4>
                               <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                                   {kanbanItems.filter(i => i.columnId === col.id).length}
                               </span>
                           </div>
                           <button onClick={() => deleteColumn(col.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                        </div>

                        <div className="bg-white/60 rounded-3xl p-4 flex-1 flex flex-col gap-3 border border-orange-100/50 shadow-inner">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newNoteInput[col.id] || ''} 
                                    onChange={(e) => setNewNoteInput({ ...newNoteInput, [col.id]: e.target.value })} 
                                    onKeyDown={(e) => e.key === 'Enter' && addKanbanItem(col.id)}
                                    placeholder="Thêm ghi chú..."
                                    className="flex-1 bg-white border border-orange-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-slate-300"
                                />
                                <button onClick={() => addKanbanItem(col.id)} className="bg-orange-500 text-white p-2.5 rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 active:scale-90"><Plus size={18} /></button>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[350px] custom-scrollbar pr-1">
                                {kanbanItems.filter(i => i.columnId === col.id).map((item) => (
                                    <div 
                                        key={item.id} 
                                        draggable 
                                        onDragStart={(e) => onDragItemStart(e, item.id)}
                                        className="group p-4 bg-white rounded-2xl border border-slate-100 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-500/5 transition-all cursor-grab active:cursor-grabbing"
                                    >
                                        <div className="flex items-start gap-3">
                                            <GripVertical size={14} className="text-slate-300 mt-1 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className={`text-xs font-bold leading-relaxed text-slate-700 ${item.completed ? 'line-through text-slate-400 opacity-60' : ''}`}>{item.text}</p>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{item.createdAt}</span>
                                                    <button onClick={() => deleteKanbanItem(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"><Trash size={12}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {kanbanItems.filter(i => i.columnId === col.id).length === 0 && (
                                    <div className="py-10 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-30">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Square size={14} /></div>
                                        <span className="text-[8px] font-black uppercase tracking-widest">Trống</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                
                {/* INLINE ADD COLUMN INPUT */}
                {isAddingColumn ? (
                  <div className="flex-shrink-0 w-80 flex flex-col gap-4 animate-fade-in">
                      <div className="px-4 py-2 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-2">
                          <Plus size={14} className="text-amber-600" />
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Tên cột mới..."
                            className="bg-transparent text-xs font-black uppercase text-amber-900 outline-none w-full"
                            value={newColumnTitle}
                            onChange={(e) => setNewColumnTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmAddColumn();
                                if (e.key === 'Escape') setIsAddingColumn(false);
                            }}
                          />
                          <button onClick={handleConfirmAddColumn} className="text-emerald-500 hover:text-emerald-700"><Check size={18} strokeWidth={3} /></button>
                          <button onClick={() => setIsAddingColumn(false)} className="text-rose-400 hover:text-rose-600"><X size={18} /></button>
                      </div>
                      <div className="flex-1 border-2 border-dashed border-amber-100 rounded-3xl"></div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsAddingColumn(true)}
                    className="flex-shrink-0 w-20 border-2 border-dashed border-orange-100 rounded-[2.5rem] flex flex-col items-center justify-center text-orange-200 hover:text-orange-400 hover:border-orange-300 hover:bg-orange-50/30 transition-all group"
                  >
                    <Plus size={24} className="group-hover:scale-125 transition-transform" />
                  </button>
                )}
            </div>
            
            {savingNote && (
                <div className="absolute bottom-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl animate-pulse">
                    <Loader2 size={12} className="animate-spin text-orange-400" /> Đang đồng bộ...
                </div>
            )}
        </div>
      )}

      {/* --- MAIN DASHBOARD --- */}
      <main className="p-4 sm:p-8 flex flex-col gap-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           {[
             { label: 'CHƯA BẮT ĐẦU', val: stats.pending, color: 'border-slate-300', text: 'text-slate-400' },
             { label: 'ĐANG THỰC HIỆN', val: stats.processing, color: 'border-blue-500', text: 'text-blue-600' },
             { label: 'HOÀN THÀNH', val: stats.completed, color: 'border-emerald-500', text: 'text-emerald-600' },
             { label: 'TẠM DỪNG', val: stats.overdue, color: 'border-amber-500', text: 'text-amber-500' }
           ].map((s, idx) => (
             <div key={idx} className={`bg-white p-6 rounded-2xl shadow-sm border-t-4 ${s.color} flex flex-col items-center justify-center gap-2 transition-all hover:shadow-md`}>
                <p className={`text-3xl font-black ${s.text}`}>{s.val}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{s.label}</p>
             </div>
           ))}
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden min-h-[400px] flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm nhiệm vụ, nhân sự..." className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold outline-none" />
                </div>
                <div className="flex gap-3">
                    <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as any)} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none shadow-sm cursor-pointer">
                        <option value="all">Tất cả</option>
                        <option value="day">Theo ngày</option>
                        <option value="month">Theo tháng</option>
                    </select>
                    {isAdmin && (
                        <button onClick={() => { setEditingId(null); setHandoverLinks(['']); setIsAddModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl transition-all">
                            <Plus size={18} strokeWidth={3} /> Tạo mới
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-x-auto custom-scrollbar relative">
                {loading ? (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3 z-10">
                        <Loader2 className="animate-spin text-indigo-600" size={40} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Đang đồng bộ dữ liệu...</span>
                    </div>
                ) : null}
                
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/30 border-b border-slate-100">
                        <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            <th className="px-8 py-5">Nhiệm vụ</th>
                            <th className="px-6 py-5">Nhân viên</th>
                            <th className="px-6 py-5 text-center whitespace-nowrap">Trạng thái</th>
                            <th className="px-6 py-5 text-center whitespace-nowrap">Hạn chót</th>
                            <th className="px-8 py-5 text-center whitespace-nowrap">Tác vụ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredHandovers.map((item) => {
                            const isAssignedToMe = item.assignee.toLowerCase() === user.fullName.toLowerCase();
                            const isActionLoading = processingId === item.id;
                            return (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => setViewFullTask(item)}>
                                    <td className="px-8 py-6 min-w-[350px]">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-black text-slate-800 leading-snug line-clamp-2">{item.task}</span>
                                            <span className="text-[9px] font-bold text-slate-400 font-mono uppercase">{item.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-indigo-600 text-[10px]">{item.assignee.charAt(0)}</div>
                                            <span className="text-xs font-bold text-slate-600">{item.assignee}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                            item.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                                            item.status === 'Processing' ? 'bg-blue-50 text-blue-600' :
                                            item.status === 'Overdue' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {item.status === 'Pending' ? 'Chưa bắt đầu' : 
                                             item.status === 'Processing' ? 'Đang thực hiện' :
                                             item.status === 'Completed' ? 'Hoàn thành' : 'Tạm dừng'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-6 text-center whitespace-nowrap">
                                        <span className={`text-[10px] font-black ${item.status === 'Overdue' ? 'text-rose-500' : 'text-slate-400'}`}>
                                            {item.deadlineAt ? new Date(item.deadlineAt).toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '---'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center whitespace-nowrap min-w-[150px]">
                                        <div className="flex items-center justify-center gap-4">
                                            {item.status === 'Pending' && isAssignedToMe && (
                                                <button 
                                                    onClick={(e) => handleAcceptTask(e, item.id)} 
                                                    disabled={!!processingId}
                                                    className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 underline decoration-2 underline-offset-4 flex items-center gap-1"
                                                >
                                                    {isActionLoading && <Loader2 size={12} className="animate-spin"/>}
                                                    Nhận việc
                                                </button>
                                            )}
                                            {item.status === 'Processing' && isAssignedToMe && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setReportLinks(['']); setIsReportModalOpen(item.id); }} 
                                                    disabled={!!processingId}
                                                    className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-800 underline decoration-2 underline-offset-4 flex items-center gap-1"
                                                >
                                                    {processingId === 'reporting' && isActionLoading && <Loader2 size={12} className="animate-spin"/>}
                                                    Báo cáo
                                                </button>
                                            )}
                                            {isAdmin && (
                                                <button onClick={(e) => { e.stopPropagation(); handleEditClick(e, item); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-all"><Edit2 size={14}/></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      </main>

      {/* --- ADD MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !processingId && uploadingCount === 0 && setIsAddModalOpen(false)}></div>
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden relative animate-slide-in border border-white/20 flex flex-col max-h-[90vh]">
              <div className="p-10 overflow-y-auto custom-scrollbar flex-1">
                 <h3 className="text-2xl font-black text-slate-900 uppercase mb-8 flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl">
                        {editingId ? <Edit2 size={28} /> : <Plus size={28} strokeWidth={3} />}
                    </div>
                    <span>{editingId ? 'Sửa nhiệm vụ' : 'Giao nhiệm vụ mới'}</span>
                 </h3>
                 <form onSubmit={handleAddHandover} className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nội dung nhiệm vụ *</label>
                        <textarea value={newHandover.task} onChange={(e) => setNewHandover({...newHandover, task: e.target.value})} className="w-full h-32 bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-bold outline-none resize-none focus:ring-4 focus:ring-indigo-500/10" required />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nhân sự phụ trách *</label>
                        <select value={newHandover.assignee} onChange={(e) => setNewHandover({...newHandover, assignee: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none cursor-pointer" required>
                            <option value="">-- Chọn nhân sự --</option>
                            {users.map(u => <option key={u.username} value={u.fullName}>{u.fullName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Thời hạn hoàn thành *</label>
                        <div className="flex gap-2 mb-3">
                            <button type="button" onClick={() => handleQuickTime(12, 0)} className="flex-1 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm">12:00 Hôm nay</button>
                            <button type="button" onClick={() => handleQuickTime(17, 30)} className="flex-1 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm">17:30 Hôm nay</button>
                        </div>
                        <input type="datetime-local" value={newHandover.deadlineAt} onChange={(e) => setNewHandover({...newHandover, deadlineAt: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none" required />
                    </div>
                    <div 
                      onDragOver={(e) => e.preventDefault()} 
                      onDrop={(e) => handleDrop(e, 'add')}
                      className="border-2 border-dashed border-indigo-200 rounded-[2rem] p-8 flex flex-col items-center justify-center bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-400 transition-all group"
                    >
                        {uploadingCount > 0 ? (
                           <div className="flex flex-col items-center gap-2">
                              <Loader2 className="animate-spin text-indigo-600" size={32} />
                              <span className="text-[10px] font-black text-indigo-600 uppercase">Đang tải {uploadingCount} tệp...</span>
                           </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-3 group-hover:scale-110 transition-transform"><Upload size={24}/></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed">Kéo & thả tài liệu vào đây để tự động thêm link</p>
                          </>
                        )}
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Danh sách link tài liệu</label>
                        {handoverLinks.map((link, idx) => (
                           <div key={idx} className="flex gap-2 animate-fade-in">
                              <div className="relative flex-1">
                                 <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                 <input 
                                   type="url" 
                                   value={link} 
                                   onChange={(e) => updateLink(idx, e.target.value, 'add')}
                                   placeholder="https://..."
                                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                                 />
                              </div>
                              <button type="button" onClick={() => removeLinkField(idx, 'add')} className="p-3 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                           </div>
                        ))}
                        <button type="button" onClick={() => addLinkField('add')} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                           <Plus size={14}/> Thêm ô dán link
                        </button>
                    </div>
                 </form>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                 <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-900 transition-colors">Hủy</button>
                 <button onClick={handleAddHandover} disabled={!!processingId || uploadingCount > 0} className="flex-[2] py-4 bg-indigo-600 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2">
                   {processingId === 'creating' ? <Loader2 className="animate-spin" size={18}/> : editingId ? 'Cập nhật' : 'Xác nhận giao'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- REPORT MODAL --- */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !processingId && uploadingCount === 0 && setIsReportModalOpen(null)}></div>
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden relative animate-slide-in border border-white/20 flex flex-col max-h-[90vh]">
              <div className="p-10 overflow-y-auto custom-scrollbar flex-1">
                 <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl mx-auto mb-6"><CheckCircle size={32} /></div>
                    <h3 className="text-xl font-black text-slate-900 uppercase">Báo cáo hoàn thành</h3>
                 </div>
                 <form onSubmit={handleCompleteTask} className="space-y-6 text-left">
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nội dung đã xử lý *</label>
                       <textarea value={reportForm.report} onChange={(e) => setReportForm({...reportForm, report: e.target.value})} className="w-full h-32 bg-slate-50 border border-slate-200 rounded-3xl p-5 text-sm font-bold outline-none resize-none focus:ring-4 focus:ring-emerald-500/10" placeholder="Mô tả kết quả công việc..." required />
                    </div>
                    <div 
                      onDragOver={(e) => e.preventDefault()} 
                      onDrop={(e) => handleDrop(e, 'report')}
                      className="border-2 border-dashed border-emerald-200 rounded-[2rem] p-6 flex flex-col items-center justify-center bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-400 transition-all group"
                    >
                        {uploadingCount > 0 ? (
                           <div className="flex flex-col items-center gap-2">
                              <Loader2 className="animate-spin text-emerald-600" size={28} />
                              <span className="text-[10px] font-black text-emerald-600 uppercase">Đang tải {uploadingCount} tệp...</span>
                           </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm mb-3 group-hover:scale-110 transition-transform"><Upload size={20}/></div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed px-4">Thả file kết quả vào đây</p>
                          </>
                        )}
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Link kết quả báo cáo</label>
                        {reportLinks.map((link, idx) => (
                           <div key={idx} className="flex gap-2 animate-fade-in">
                              <div className="relative flex-1">
                                 <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                 <input 
                                   type="url" 
                                   value={link} 
                                   onChange={(e) => updateLink(idx, e.target.value, 'report')}
                                   placeholder="https://..."
                                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                                 />
                              </div>
                              <button type="button" onClick={() => removeLinkField(idx, 'report')} className="p-3 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                           </div>
                        ))}
                        <button type="button" onClick={() => addLinkField('report')} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-emerald-200 hover:text-emerald-600 transition-all flex items-center justify-center gap-2">
                           <Plus size={14}/> Thêm link kết quả
                        </button>
                    </div>
                 </form>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                 <button type="button" onClick={() => setIsReportModalOpen(null)} className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-900 transition-colors">Hủy</button>
                 <button onClick={handleCompleteTask} disabled={!!processingId || uploadingCount > 0} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 flex items-center justify-center gap-2">
                   {processingId === 'reporting' ? <Loader2 className="animate-spin" size={18}/> : 'Gửi hoàn thành'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- VIEW DETAIL MODAL --- */}
      {viewFullTask && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setViewFullTask(null)}></div>
           <div className="bg-white w-full max-w-2xl rounded-none sm:rounded-[3rem] shadow-2xl overflow-hidden relative animate-slide-in flex flex-col max-h-[90vh] border border-white/20">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><FileText size={24} /></div>
                    <div>
                       <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Chi tiết nhiệm vụ</h3>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {viewFullTask.id}</p>
                    </div>
                 </div>
                 <button onClick={() => setViewFullTask(null)} className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-2xl transition-all hover:bg-slate-50"><X size={20}/></button>
              </div>

              <div className="p-10 overflow-y-auto custom-scrollbar space-y-10 flex-1">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">Nội dung nhiệm vụ</label>
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                        <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{viewFullTask.task}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                       <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><User size={20}/></div>
                       <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Người giao</label>
                          <span className="text-xs font-black text-slate-800 uppercase">{viewFullTask.createdBy.split(' (')[0]}</span>
                       </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                       <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><UserCheck size={20}/></div>
                       <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Người đảm nhận</label>
                          <span className="text-xs font-black text-indigo-600 uppercase">{viewFullTask.assignee}</span>
                       </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                       <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600"><Clock size={20}/></div>
                       <div>
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Hạn hoàn thành</label>
                          <span className="text-xs font-black text-rose-500">{viewFullTask.deadlineAt ? new Date(viewFullTask.deadlineAt).toLocaleString('vi-VN') : '---'}</span>
                       </div>
                    </div>
                 </div>

                 {viewFullTask.fileLink && (
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">Danh sách tài liệu đính kèm</label>
                        <div className="flex flex-wrap gap-3">
                            {viewFullTask.fileLink.split(',').filter(link => link.trim()).map((link, lIdx) => (
                                <a key={lIdx} href={link.trim()} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-slate-900 px-5 py-3 rounded-2xl text-white hover:bg-black transition-all group shadow-sm">
                                    <File size={16} className="text-indigo-400"/>
                                    <span className="text-[10px] font-black uppercase flex items-center gap-1">File {lIdx + 1} <ExternalLink size={10}/></span>
                                </a>
                            ))}
                        </div>
                    </div>
                 )}

                 {(viewFullTask.report || viewFullTask.resultLink) && (
                    <div className="bg-emerald-50/50 border-2 border-emerald-100 rounded-[2.5rem] p-8 space-y-6">
                        <div className="flex items-center gap-3 text-emerald-700">
                           <FileCheck size={20} />
                           <h4 className="text-xs font-black uppercase tracking-widest">Báo cáo từ nhân sự</h4>
                        </div>
                        {viewFullTask.report && (
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest block">Mô tả công việc</label>
                              <p className="text-sm font-bold text-slate-700 leading-relaxed italic">{viewFullTask.report}</p>
                           </div>
                        )}
                        {viewFullTask.resultLink && (
                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest block">Tệp kết quả đã tải lên</label>
                              <div className="flex flex-wrap gap-2">
                                  {viewFullTask.resultLink.split(',').filter(link => link.trim()).map((link, rIdx) => (
                                      <a key={rIdx} href={link.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-white border border-emerald-200 px-4 py-2.5 rounded-xl text-[10px] font-black text-emerald-700 hover:bg-emerald-700 hover:text-white transition-all shadow-sm">
                                         <LinkIcon size={12}/> Kết quả {rIdx + 1} <ExternalLink size={12}/>
                                      </a>
                                  ))}
                              </div>
                           </div>
                        )}
                    </div>
                 )}
              </div>
              <div className="p-8 bg-gray-50 border-t border-slate-100">
                 <button onClick={() => setViewFullTask(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">Đóng thông tin</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DailyHandover;
