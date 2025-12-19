import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Heart, MessageSquare, Send, Plus, 
  ImageIcon, Loader2, User, 
  ChevronRight, Sparkles, X, CheckCircle,
  Image as ImageIcon2, Trash2, Megaphone,
  Calendar, RefreshCw, Maximize2,
  TrendingUp, Award, Clock, Edit2, Lock, Unlock,
  ChevronLeft, Share2, Check, AlertCircle,
  Type, AlignLeft, Layout, Bold, Underline, Palette, Type as TypeIcon,
  CornerDownRight, List, Info, MousePointer2
} from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User as UserType, NewsItem, NewsComment } from '../types';

interface HomeProps {
  user: UserType;
  onTabChange: (tab: string) => void;
}

const Home: React.FC<HomeProps> = ({ user, onTabChange }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  
  const [newPost, setNewPost] = useState({ id: '', title: '', content: '', imageUrl: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [posting, setPosting] = useState(false);
  
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [lastReadTime, setLastReadTime] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  // --- HÀM NÉN ẢNH ĐỂ TRÁNH LỖI CELL LIMIT CỦA GOOGLE SHEETS ---
  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // --- THUẬT TOÁN ĐỆ QUY XỬ LÝ LỒNG THẺ (Bold + Color + Size) ---
  const parseBBCode = (text: string): React.ReactNode => {
    if (!text) return "";
    
    // Regex tìm các cặp thẻ [tag]content[/tag]
    const regex = /\[(b|u|c|s)(?:=([^\]]+))?\]([\s\S]*?)\[\/\1\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Thêm đoạn text thuần trước thẻ
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const tag = match[1];
      const value = match[2];
      const content = match[3];

      // ĐỆ QUY: Phân tích tiếp nội dung bên trong thẻ này
      const children = parseBBCode(content);

      if (tag === 'b') parts.push(<strong key={match.index} className="font-black text-slate-900">{children}</strong>);
      else if (tag === 'u') parts.push(<u key={match.index} className="decoration-indigo-400/50 underline-offset-2">{children}</u>);
      else if (tag === 'c') parts.push(<span key={match.index} style={{ color: value }}>{children}</span>);
      else if (tag === 's') parts.push(<span key={match.index} style={{ fontSize: `${value}px`, lineHeight: '1.4' }}>{children}</span>);

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    
    return lines.map((line, lIdx) => {
      const iconMatch = line.match(/^([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|•)\s*(.*)/);
      let mainText = line;
      let leadingIcon = null;
      if (iconMatch) {
        leadingIcon = iconMatch[1];
        mainText = iconMatch[2];
      }

      const parsedLine = parseBBCode(mainText);

      if (leadingIcon) {
        return (
          <div key={lIdx} className="flex gap-3 mb-1.5 items-start">
            <span className="flex-shrink-0 text-lg leading-none mt-0.5">{leadingIcon}</span>
            <div className="flex-1 min-w-0">{parsedLine}</div>
          </div>
        );
      }
      return <div key={lIdx} className="mb-1 min-h-[1.4em]">{parsedLine}</div>;
    });
  };

  const applyFormatting = (field: 'title' | 'content', tag: string, value?: string) => {
    const input = field === 'title' ? titleInputRef.current : contentInputRef.current;
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentVal = field === 'title' ? newPost.title : newPost.content;
    const selected = currentVal.substring(start, end);
    let wrap = '';
    if (tag === 'icon') wrap = value + ' ';
    else if (value) wrap = `[${tag}=${value}]${selected}[/${tag}]`;
    else wrap = `[${tag}]${selected}[/${tag}]`;
    const newVal = currentVal.substring(0, start) + wrap + currentVal.substring(end);
    setNewPost(prev => ({ ...prev, [field]: newVal }));
    setTimeout(() => {
      input.focus();
      const pos = start + wrap.length;
      input.setSelectionRange(pos, pos);
    }, 10);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [newsRes, usersRes] = await Promise.all([
        sheetService.getNews(user.username),
        sheetService.getUsers()
      ]);
      setNews(newsRes.news);
      setLastReadTime(newsRes.lastReadTime || 0);
      setSystemUsers(Array.isArray(usersRes) ? usersRes : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
      setConfirmDeleteId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadNews = news.filter(n => new Date(n.timestamp).getTime() > lastReadTime);

  const handleMarkAsRead = async () => {
    const now = Date.now();
    setLastReadTime(now);
    setShowNotifDropdown(false);
    await sheetService.updateLastReadTime(user.username);
  };

  const handleLike = async (newsId: string) => {
    setNews(prev => prev.map(n => n.id === newsId ? { 
      ...n, isLiked: !n.isLiked, likesCount: n.isLiked ? n.likesCount - 1 : n.likesCount + 1 
    } : n));
    if (selectedNews && selectedNews.id === newsId) {
      setSelectedNews(prev => prev ? { ...prev, isLiked: !prev.isLiked, likesCount: prev.isLiked ? prev.likesCount - 1 : prev.likesCount + 1 } : null);
    }
    await sheetService.toggleLike(newsId, user.username);
  };

  const handleAddComment = async (newsId: string) => {
    if (!commentText.trim()) return;
    const newComment: NewsComment = {
      id: 'temp-' + Date.now(),
      newsId, username: user.username,
      text: commentText, timestamp: new Date().toLocaleString('vi-VN')
    };
    setNews(prev => prev.map(n => n.id === newsId ? { ...n, comments: [...(n.comments || []), newComment] } : n));
    if (selectedNews && selectedNews.id === newsId) {
      setSelectedNews(prev => prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : null);
    }
    const textToSave = commentText;
    setCommentText('');
    await sheetService.addComment({ newsId, username: user.username, text: textToSave });
  };

  const handleDeleteNews = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000);
      return;
    }
    setActionLoadingId(id);
    setConfirmDeleteId(null);
    try {
      const res = await sheetService.deleteNews(id);
      if (res.success) {
        setNews(prev => prev.filter(n => n.id !== id));
        if (selectedNews?.id === id) setSelectedNews(null);
      } else alert(res.error || "Lỗi khi xóa bài");
    } catch (e) { alert("Lỗi kết nối hệ thống"); }
    finally { setActionLoadingId(null); }
  };

  const handleToggleLock = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await sheetService.toggleLockNews(id);
      if (res.success) {
        setNews(prev => prev.map(n => n.id === id ? { ...n, isLocked: !n.isLocked } : n));
        if (selectedNews?.id === id) setSelectedNews(prev => prev ? { ...prev, isLocked: !prev.isLocked } : null);
      } else alert(res.error || "Lỗi khi thay đổi trạng thái khóa");
    } catch (e) { alert("Lỗi kết nối hệ thống"); }
    finally { setActionLoadingId(null); }
  };

  const handleOpenEdit = (item: NewsItem) => {
    setNewPost({ id: item.id, title: item.title, content: item.content, imageUrl: item.imageUrl || '' });
    setIsEditing(true);
    setIsPostModalOpen(true);
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Vui lòng chọn tệp hình ảnh!");
      return;
    }
    try {
      const resizedDataUrl = await resizeImage(file, 1000, 1000);
      setNewPost(prev => ({ ...prev, imageUrl: resizedDataUrl }));
    } catch (err) {
      console.error("Lỗi xử lý ảnh:", err);
      alert("Không thể xử lý hình ảnh này.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); };

  const handleCreateOrUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;
    setPosting(true);
    try {
      let res;
      if (isEditing) {
        res = await sheetService.updateNews({ ...newPost });
      } else {
        res = await sheetService.addNews({ ...newPost, author: user.fullName });
      }
      
      // SỬA LỖI: Kiểm tra kết quả và buộc đóng Modal
      if (res && (res.success === true || res.success === "true")) {
        setIsPostModalOpen(false);
        setIsEditing(false);
        setNewPost({ id: '', title: '', content: '', imageUrl: '' });
        await fetchData();
      } else {
        alert(res?.error || "Máy chủ phản hồi không thành công.");
      }
    } catch (err) { 
      console.error("News Operation Error:", err);
      alert("Lỗi kết nối hệ thống. Bản tin có thể quá lớn."); 
    }
    finally { setPosting(false); }
  };

  const isAdminSession = user.role.toLowerCase() === 'admin';
  const getIsAdminByName = (name: string) => {
    if (!name) return false;
    const foundUser = systemUsers.find(u => u.fullName === name || u.username === name);
    if (foundUser) return foundUser.role.toLowerCase() === 'admin';
    return name.toLowerCase().includes('admin');
  };

  const ProToolbar = ({ field, label }: { field: 'title' | 'content', label: string }) => (
    <div className="space-y-2 mb-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
           {label}
        </label>
        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-[9px] font-black text-indigo-600 uppercase tracking-widest border border-indigo-100">
           <MousePointer2 size={10} /> {((field === 'title' ? newPost.title : newPost.content).length)} ký tự
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-inner">
        <div className="flex items-center bg-white rounded-xl p-1 shadow-sm border border-slate-100">
          <button type="button" onClick={() => applyFormatting(field, 'b')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-700 transition-all hover:text-indigo-600 active:scale-95" title="In đậm (Bold)"><Bold size={16}/></button>
          <button type="button" onClick={() => applyFormatting(field, 'u')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-700 transition-all hover:text-indigo-600 active:scale-95" title="Gạch dưới (Underline)"><Underline size={16}/></button>
        </div>
        <div className="w-px h-6 bg-slate-200 mx-1"></div>
        <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-1 shadow-sm border border-slate-100">
          {['#ef4444', '#10b981', '#3b82f6', '#f59e0b'].map(c => (
            <button key={c} type="button" onClick={() => applyFormatting(field, 'c', c)} className="w-5 h-5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200 hover:ring-indigo-400 hover:scale-125 transition-all" style={{ backgroundColor: c }} title={`Màu ${c}`}></button>
          ))}
        </div>
        <div className="w-px h-6 bg-slate-200 mx-1"></div>
        <div className="flex items-center bg-white rounded-xl p-1 shadow-sm border border-slate-100">
          <button type="button" onClick={() => applyFormatting(field, 's', '24')} className="px-2 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 transition-all hover:text-indigo-600 flex items-center gap-1" title="Cỡ chữ Rất lớn">
            <TypeIcon size={14}/><span className="text-[10px] font-black uppercase">XL</span>
          </button>
          <button type="button" onClick={() => applyFormatting(field, 's', '18')} className="px-2 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 transition-all hover:text-indigo-600 flex items-center gap-1" title="Cỡ chữ Lớn">
            <TypeIcon size={14}/><span className="text-[10px] font-black uppercase">LG</span>
          </button>
          <button type="button" onClick={() => applyFormatting(field, 's', '12')} className="px-2 py-1.5 hover:bg-slate-50 rounded-lg text-slate-700 transition-all hover:text-indigo-600 flex items-center gap-1" title="Cỡ chữ Nhỏ">
            <TypeIcon size={12}/><span className="text-[10px] font-black uppercase">SM</span>
          </button>
        </div>
        <div className="w-px h-6 bg-slate-200 mx-1"></div>
        <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto custom-scrollbar max-w-[220px]">
          {['📌', '🚀', '📢', '💡', '✅', '⭐', '🔥', '💎'].map(i => (
            <button key={i} type="button" onClick={() => applyFormatting(field, 'icon', i)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-lg text-base transition-all hover:scale-110 active:scale-95" title={`Chèn ${i}`}>{i}</button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden font-sans selection:bg-indigo-100">
      <header className="h-28 relative flex-shrink-0 z-[60] flex items-center border-b border-black/5 px-8">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img src="https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop" className="w-full h-full object-cover opacity-10" alt="" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-indigo-50/50 backdrop-blur-sm"></div>
        </div>
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center relative z-10">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-indigo-500/10">
              <Sparkles size={10} /> Powered by Team 3T
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Chào mừng trở lại, <span className={isAdminSession ? "admin-red-gradient" : ""}>{user.fullName}</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative z-[70] ${unreadNews.length > 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white text-slate-400 hover:text-slate-900 border border-slate-200'}`}>
                <Bell size={20} className={unreadNews.length > 0 ? 'animate-swing' : ''} />
                {unreadNews.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">{unreadNews.length}</span>}
              </button>
              {showNotifDropdown && (
                <div className="absolute right-0 mt-4 w-96 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-[100] animate-fade-in flex flex-col max-h-[80vh]">
                  <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><Bell size={16} className="text-orange-500" /> Thông báo mới</h3>
                    {unreadNews.length > 0 && <button onClick={handleMarkAsRead} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Đánh dấu đã đọc</button>}
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {news.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-4 opacity-30 grayscale"><Megaphone size={48} /><p className="text-[10px] font-black uppercase tracking-widest">Không có bản tin nào</p></div>
                    ) : (
                      <div className="space-y-1">
                        {news.map((item) => {
                          const isUnread = new Date(item.timestamp).getTime() > lastReadTime;
                          const isItemAdmin = getIsAdminByName(item.author);
                          return (
                            <div key={item.id} onClick={() => { setSelectedNews(item); setShowNotifDropdown(false); }} className={`p-4 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 group flex items-start gap-3 ${isUnread ? 'bg-indigo-50/30' : ''}`}>
                              <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-white ${isItemAdmin ? 'bg-red-600 shadow-sm admin-logo-pulse text-[8px] uppercase' : 'bg-slate-900 text-xs'}`}>{isItemAdmin ? 'Admin' : item.author.charAt(0)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                  <p className={`text-[10px] font-black uppercase tracking-widest truncate max-w-[150px] ${isItemAdmin ? 'admin-red-gradient' : 'text-slate-400'}`}>{item.author}</p>
                                  <span className="text-[8px] text-slate-300 font-bold whitespace-nowrap">{item.timestamp}</span>
                                </div>
                                <h4 className={`text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors ${isUnread ? 'font-black' : ''}`}>{renderFormattedText(item.title)}</h4>
                              </div>
                              {isUnread && <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-2 shadow-lg shadow-indigo-200"></div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-center flex-shrink-0"><button onClick={() => setShowNotifDropdown(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Đóng thông báo</button></div>
                </div>
              )}
            </div>
            {(isAdminSession || user.permissions?.canPostNews) && (
              <button onClick={() => { setIsEditing(false); setNewPost({id:'', title:'', content:'', imageUrl:''}); setIsPostModalOpen(true); }} className="h-12 px-6 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center gap-2 border border-white/10"><Plus size={16} /> Đăng tin</button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-orange-500 rounded-full blur-[100px]"></div>
        </div>
        <div className="max-w-7xl mx-auto px-8 h-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full pt-10">
            <div className="lg:col-span-8 flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-8 px-4 flex-shrink-0"><h2 className="text-xl font-black text-slate-900 flex items-center gap-3"><div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>Bản tin nội bộ</h2><button onClick={fetchData} className="text-slate-400 hover:text-indigo-600 transition-colors bg-white p-2 rounded-xl border border-slate-200 shadow-sm"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 pr-4 space-y-10">
                {loading ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-indigo-500" size={32} /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang kết nối...</p></div>
                ) : (
                  news.map((item) => {
                    const isItemAdmin = getIsAdminByName(item.author);
                    const isOwnPost = item.author === user.fullName;
                    const isLoadingThis = actionLoadingId === item.id;
                    const isConfirmingDelete = confirmDeleteId === item.id;
                    return (
                      <div key={item.id} onClick={() => setSelectedNews(item)} className="bg-white rounded-[2.5rem] p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)] border border-slate-100/80 group animate-slide-in relative cursor-pointer hover:shadow-xl hover:border-indigo-100 transition-all">
                        <div className="flex items-center justify-between mb-6">
                           <div className="flex items-center gap-3">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white ${isItemAdmin ? 'admin-logo-pulse bg-red-600 shadow-lg text-[10px] uppercase' : 'bg-slate-900 text-base'}`}>{isItemAdmin ? 'Admin' : item.author.charAt(0)}</div>
                              <div><p className={`text-sm font-black ${isItemAdmin ? 'admin-red-gradient' : 'text-slate-900'}`}>{item.author}</p><p className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1"><Calendar size={10}/> {item.timestamp}</p></div>
                           </div>
                           <div className="flex gap-2 relative">
                             {(isAdminSession || isOwnPost) && <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all" title="Chỉnh sửa"><Edit2 size={16}/></button>}
                             {isAdminSession && (
                               <>
                                 <button onClick={(e) => { e.stopPropagation(); handleDeleteNews(item.id); }} disabled={isLoadingThis} className={`p-2 rounded-xl transition-all min-w-[40px] flex items-center justify-center ${isConfirmingDelete ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-red-500'}`} title={isConfirmingDelete ? "Bấm lại để xác nhận XÓA" : "Xóa bài"}>{isLoadingThis ? <Loader2 size={16} className="animate-spin" /> : (isConfirmingDelete ? <AlertCircle size={16} /> : <Trash2 size={16}/>)}</button>
                                 <button onClick={(e) => { e.stopPropagation(); handleToggleLock(item.id); }} disabled={isLoadingThis} className="p-2 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-xl transition-all disabled:opacity-50 min-w-[40px] flex items-center justify-center" title={item.isLocked ? "Mở khóa bình luận" : "Khóa bình luận"}>{isLoadingThis ? <Loader2 size={16} className="animate-spin" /> : (item.isLocked ? <Lock size={16} /> : <Unlock size={16} />)}</button>
                               </>
                             )}
                           </div>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors leading-tight">{renderFormattedText(item.title)}</h3>
                        <div className="text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-line">{renderFormattedText(item.content)}</div>
                        {item.imageUrl && <div className="mb-6 rounded-[2rem] overflow-hidden relative aspect-video shadow-inner bg-slate-50"><img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" /><div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Maximize2 className="text-white" size={32}/></div></div>}
                        <div className="flex gap-8 pt-4 border-t border-slate-50">
                           <button onClick={(e) => { e.stopPropagation(); handleLike(item.id); }} className={`flex items-center gap-2 text-[10px] font-black transition-colors ${item.isLiked ? 'text-rose-500' : 'text-slate-400'}`}><div className={`p-2.5 rounded-xl ${item.isLiked ? 'bg-rose-50' : 'bg-slate-50'}`}><Heart size={18} fill={item.isLiked ? 'currentColor' : 'none'}/></div> {item.likesCount} Thích</button>
                           <button onClick={(e) => { e.stopPropagation(); !item.isLocked && setCommentingId(commentingId === item.id ? null : item.id); }} className={`flex items-center gap-2 text-[10px] font-black transition-colors ${item.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600'}`}><div className="p-2.5 rounded-xl bg-slate-50"><MessageSquare size={18}/></div> {item.comments?.length || 0} Thảo luận {item.isLocked && "(Đã khóa)"}</button>
                        </div>
                        {commentingId === item.id && !item.isLocked && (
                          <div className="mt-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                             <div className="bg-slate-50 rounded-2xl p-4 max-h-40 overflow-y-auto custom-scrollbar space-y-3">
                                {item.comments?.map(cmt => {
                                  const isCommentAdmin = getIsAdminByName(cmt.username);
                                  return (
                                    <div key={cmt.id} className="flex flex-col gap-1 border-b border-white/50 pb-2 last:border-0">
                                       <div className="flex justify-between items-center"><span className={`text-[10px] font-black ${isCommentAdmin ? 'admin-red-gradient' : 'text-indigo-600'}`}>{cmt.username}</span><span className="text-[8px] text-slate-400 font-bold flex items-center gap-1"><Clock size={8}/> {cmt.timestamp}</span></div>
                                       <div className="text-xs text-slate-700">{cmt.text}</div>
                                    </div>
                                  )
                                })}
                             </div>
                             <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-xl shadow-sm"><input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(item.id)} className="flex-1 px-4 text-xs font-bold outline-none" placeholder="Viết gì đó..." /><button onClick={() => handleAddComment(item.id)} className="p-2.5 bg-slate-900 text-white rounded-lg"><Send size={14}/></button></div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div className="lg:col-span-4 h-full">
              <div className="space-y-8 sticky top-0">
                <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
                   <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center font-black mb-6 shadow-2xl border-[6px] border-white z-10 ${isAdminSession ? 'admin-logo-pulse bg-red-600 text-sm uppercase' : 'bg-slate-900 text-4xl'} text-white`}>{isAdminSession ? 'Admin' : user.username.charAt(0).toUpperCase()}</div>
                   <h3 className={`text-2xl font-black tracking-tight z-10 ${isAdminSession ? 'admin-red-gradient' : 'text-slate-900'}`}>{user.fullName}</h3>
                   <div className="mt-2 px-6 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200 z-10">{user.role}</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                   <TrendingUp className="absolute -bottom-6 -right-6 text-white/10 w-40 h-40 group-hover:scale-110 transition-transform duration-1000" /><h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-4">Lối tắt nhanh</h4><p className="text-xl font-bold leading-tight mb-8">Bạn có đơn hàng mới đang chờ xử lý!</p><button onClick={() => onTabChange('orders')} className="w-full h-14 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all">Mở đơn hàng <ChevronRight size={16}/></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {selectedNews && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedNews(null)}></div>
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden relative flex flex-col lg:flex-row animate-slide-in border border-white/20">
            <div className="lg:w-2/3 bg-black relative flex items-center justify-center group overflow-hidden">
               {selectedNews.imageUrl ? <img src={selectedNews.imageUrl} className="max-w-full max-h-full object-contain" alt={selectedNews.title} /> : <div className="flex flex-col items-center gap-4 text-slate-500"><ImageIcon size={64} className="opacity-20" /><p className="text-xs font-black uppercase tracking-widest">Không có hình ảnh</p></div>}
               <button onClick={() => setSelectedNews(null)} className="absolute top-6 left-6 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-lg text-white rounded-full flex items-center justify-center transition-all"><ChevronLeft size={24} /></button>
            </div>
            <div className="lg:w-1/3 flex flex-col h-full bg-white">
               <div className="p-8 border-b border-slate-50 flex-shrink-0">
                  <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${getIsAdminByName(selectedNews.author) ? 'bg-red-600 admin-logo-pulse text-[8px] uppercase' : 'bg-slate-900 text-xs'}`}>{getIsAdminByName(selectedNews.author) ? 'Admin' : selectedNews.author.charAt(0)}</div><div><p className={`text-xs font-black ${getIsAdminByName(selectedNews.author) ? 'admin-red-gradient' : 'text-slate-900'}`}>{selectedNews.author}</p><p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{selectedNews.timestamp}</p></div></div><button onClick={() => setSelectedNews(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={20}/></button></div>
                  <h2 className="text-xl font-black text-slate-900 mb-4 leading-tight">{renderFormattedText(selectedNews.title)}</h2>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar"><div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{renderFormattedText(selectedNews.content)}</div></div>
               </div>
               <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                     <div className="flex gap-6">
                        <button onClick={() => handleLike(selectedNews!.id)} className={`flex items-center gap-2 text-[10px] font-black ${selectedNews.isLiked ? 'text-rose-500' : 'text-slate-400'}`}><Heart size={20} fill={selectedNews.isLiked ? 'currentColor' : 'none'} className={selectedNews.isLiked ? 'text-rose-500' : ''} /> {selectedNews.likesCount}</button>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400"><MessageSquare size={20} /> {selectedNews.comments?.length || 0}</div>
                     </div>
                     <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Share2 size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
                     {selectedNews.comments && selectedNews.comments.length > 0 ? (
                        selectedNews.comments.map(cmt => {
                           const isCommentAdmin = getIsAdminByName(cmt.username);
                           return (
                             <div key={cmt.id} className="flex flex-col gap-2">
                                <div className="flex items-center justify-between"><span className={`text-[10px] font-black ${isCommentAdmin ? 'admin-red-gradient' : 'text-indigo-600'}`}>{cmt.username}</span><span className="text-[8px] text-slate-300 font-bold">{cmt.timestamp}</span></div>
                                <div className="text-xs text-slate-600 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm leading-relaxed">{cmt.text}</div>
                             </div>
                           )
                        })
                     ) : <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30 grayscale"><MessageSquare size={48} className="text-slate-200" /><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Chưa có bình luận</p></div>}
                  </div>
                  {!selectedNews.isLocked ? (
                    <div className="p-8 bg-white border-t border-slate-100 flex-shrink-0"><div className="flex gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 ring-indigo-500/10 transition-all"><input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(selectedNews.id)} className="flex-1 px-4 text-xs font-bold bg-transparent outline-none" placeholder="Tham gia thảo luận..." /><button onClick={() => handleAddComment(selectedNews.id)} className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"><Send size={16}/></button></div></div>
                  ) : (
                    <div className="p-8 bg-slate-100 border-t border-slate-200 flex-shrink-0 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2"><Lock size={12} /> Bình luận đã bị khóa cho bản tin này</p></div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {isPostModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !posting && setIsPostModalOpen(false)}></div>
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.3)] overflow-hidden relative animate-slide-in border border-white/20">
              <form onSubmit={handleCreateOrUpdatePost} className="p-10 space-y-8">
                 <div className="flex items-center justify-between border-b border-slate-100 pb-8 relative">
                    <div className="flex items-center gap-5">
                       <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-2xl transform -rotate-6 transition-transform hover:rotate-0 ${isEditing ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-blue-200' : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-orange-200'}`}>
                          {isEditing ? <Edit2 size={28} /> : <Megaphone size={28} />} 
                       </div>
                       <div>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5">{isEditing ? 'Chỉnh sửa' : 'Đăng bản tin'}</h3>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                             <Layout size={10} className="text-indigo-500" /> Bản tin nội bộ chuyên nghiệp
                          </span>
                       </div>
                    </div>
                    <button type="button" onClick={() => setIsPostModalOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl flex items-center justify-center transition-all group">
                       <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                 </div>

                 <div className="space-y-10 max-h-[60vh] overflow-y-auto custom-scrollbar pr-4">
                    <div>
                       <ProToolbar field="title" label="Tiêu đề thông báo" />
                       <div className="relative group">
                          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                             <Type size={20} />
                          </div>
                          <input 
                            ref={titleInputRef}
                            type="text" 
                            required
                            className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 focus:bg-white transition-all outline-none text-base font-bold text-slate-800 placeholder:text-slate-300 shadow-sm"
                            placeholder="Nhập tiêu đề tại đây..."
                            value={newPost.title}
                            onChange={e => setNewPost({...newPost, title: e.target.value})}
                          />
                       </div>
                    </div>

                    <div>
                       <ProToolbar field="content" label="Nội dung truyền tải" />
                       <div className="relative group">
                          <div className="absolute left-6 top-6 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                             <AlignLeft size={20} />
                          </div>
                          <textarea 
                            ref={contentInputRef}
                            required
                            rows={6}
                            className="w-full pl-16 pr-8 py-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 focus:bg-white transition-all outline-none text-base font-bold text-slate-800 placeholder:text-slate-300 resize-none shadow-sm leading-relaxed"
                            placeholder="Mô tả chi tiết nội dung muốn thông báo..."
                            value={newPost.content}
                            onChange={e => setNewPost({...newPost, content: e.target.value})}
                          ></textarea>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <ImageIcon2 size={12} className="text-indigo-500" /> Phương tiện đính kèm
                       </label>
                       <div className="relative group/upload">
                          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                          <div 
                             onClick={() => fileInputRef.current?.click()}
                             onDragOver={handleDragOver}
                             onDragLeave={handleDragLeave}
                             onDrop={handleDrop}
                             className={`w-full h-48 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[0.98]' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 hover:border-indigo-300'} shadow-inner overflow-hidden`}
                          >
                             {newPost.imageUrl ? (
                               <div className="w-full h-full p-4 relative group/img animate-fade-in">
                                  <img src={newPost.imageUrl} className="w-full h-full object-cover rounded-[1.5rem] shadow-xl" alt="" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-[1.5rem]">
                                     <div className="bg-white/20 backdrop-blur-md px-6 py-2.5 rounded-full text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                        <RefreshCw size={14} /> Thay đổi ảnh
                                     </div>
                                  </div>
                               </div>
                             ) : (
                               <>
                                  <div className={`w-16 h-16 bg-white rounded-3xl shadow-lg text-slate-400 flex items-center justify-center transition-all ${isDragging ? 'scale-110 text-indigo-600 rotate-12' : 'group-hover/upload:text-indigo-600 group-hover/upload:-translate-y-2'}`}>
                                     <ImageIcon2 size={28} />
                                  </div>
                                  <div className="text-center">
                                     <p className={`text-xs font-black uppercase tracking-[0.2em] transition-all ${isDragging ? 'text-indigo-600' : 'text-slate-500'}`}>
                                       {isDragging ? 'Thả để đăng tải' : 'Kéo thả hoặc Chọn ảnh'}
                                     </p>
                                     <p className="text-[10px] font-bold text-slate-300 mt-1 uppercase tracking-tighter">Định dạng hỗ trợ: JPG, PNG, WEBP (Nén tự động)</p>
                                  </div>
                               </>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 flex gap-5 border-t border-slate-50">
                    <button 
                      type="button" 
                      onClick={() => setIsPostModalOpen(false)}
                      className="flex-1 h-16 bg-slate-50 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100 active:scale-95"
                    >
                      Hủy bỏ
                    </button>
                    <button 
                      type="submit"
                      disabled={posting}
                      className={`flex-[2] h-16 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-3 ${isEditing ? 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 shadow-blue-200' : 'bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 shadow-indigo-200'} disabled:opacity-50 active:scale-[0.98] group`}
                    >
                       {posting ? <Loader2 size={20} className="animate-spin" /> : (
                         <>
                           {isEditing ? <CheckCircle size={20} /> : <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                           {isEditing ? 'Cập nhật bản tin' : 'Phát hành ngay'}
                         </>
                       )}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Home;