import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Heart, MessageSquare, Send, Plus, 
  ImageIcon, Loader2, User, 
  ChevronRight, Sparkles, X, CheckCircle,
  Image as ImageIcon2, Trash2, Megaphone,
  Calendar, RefreshCw, Maximize2,
  TrendingUp, Award, Clock, Edit2, Lock, Unlock,
  ChevronLeft, Share2, Check, AlertCircle
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
      } else {
        alert(res.error || "Lỗi khi xóa bài");
      }
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
      } else {
        alert("Lỗi khi thay đổi trạng thái khóa");
      }
    } catch (e) { alert("Lỗi kết nối hệ thống"); }
    finally { setActionLoadingId(null); }
  };

  const handleOpenEdit = (item: NewsItem) => {
    setNewPost({ id: item.id, title: item.title, content: item.content, imageUrl: item.imageUrl || '' });
    setIsEditing(true);
    setIsPostModalOpen(true);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Vui lòng chọn tệp hình ảnh!");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setNewPost(prev => ({ ...prev, imageUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

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
      
      if (res.success) {
        setIsPostModalOpen(false);
        setIsEditing(false);
        setNewPost({ id: '', title: '', content: '', imageUrl: '' });
        fetchData();
      } else {
        alert(res.error || "Lỗi thao tác");
      }
    } catch (e) { alert("Lỗi hệ thống"); }
    finally { setPosting(false); }
  };

  const isAdminSession = user.role.toLowerCase() === 'admin';
  
  const getIsAdminByName = (name: string) => {
    if (!name) return false;
    const foundUser = systemUsers.find(u => u.fullName === name || u.username === name);
    if (foundUser) return foundUser.role.toLowerCase() === 'admin';
    return name.toLowerCase().includes('admin');
  };

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden font-sans selection:bg-indigo-100">
      <header className="h-28 relative flex-shrink-0 z-[60] flex items-center border-b border-black/5 px-8">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img 
            src="https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop" 
            className="w-full h-full object-cover opacity-10"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-indigo-50/50 backdrop-blur-sm"></div>
        </div>

        <div className="max-w-7xl mx-auto w-full flex justify-between items-center relative z-10">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-indigo-500/10">
              <Sparkles size={10} /> Powered by Team 3T
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Chào mừng trở lại, <span className={isAdminSession ? "admin-red-gradient" : ""}>{user.fullName}</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative z-[70] ${unreadNews.length > 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white text-slate-400 hover:text-slate-900 border border-slate-200'}`}
              >
                <Bell size={20} className={unreadNews.length > 0 ? 'animate-swing' : ''} />
                {unreadNews.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                    {unreadNews.length}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-4 w-96 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-[100] animate-fade-in flex flex-col max-h-[80vh]">
                  <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Bell size={16} className="text-orange-500" /> Thông báo mới
                    </h3>
                    {unreadNews.length > 0 && (
                      <button 
                        onClick={handleMarkAsRead}
                        className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {news.length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-4 opacity-30 grayscale">
                        <Megaphone size={48} />
                        <p className="text-[10px] font-black uppercase tracking-widest">Không có bản tin nào</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {news.map((item) => {
                          const isUnread = new Date(item.timestamp).getTime() > lastReadTime;
                          const isItemAdmin = getIsAdminByName(item.author);
                          return (
                            <div 
                              key={item.id} 
                              onClick={() => { setSelectedNews(item); setShowNotifDropdown(false); }}
                              className={`p-4 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 group flex items-start gap-3 ${isUnread ? 'bg-indigo-50/30' : ''}`}
                            >
                              <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-white ${isItemAdmin ? 'bg-red-600 shadow-sm admin-logo-pulse text-[8px] uppercase' : 'bg-slate-900 text-xs'}`}>
                                {isItemAdmin ? 'Admin' : item.author.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                  <p className={`text-[10px] font-black uppercase tracking-widest truncate max-w-[150px] ${isItemAdmin ? 'admin-red-gradient' : 'text-slate-400'}`}>{item.author}</p>
                                  <span className="text-[8px] text-slate-300 font-bold whitespace-nowrap">{item.timestamp}</span>
                                </div>
                                <h4 className={`text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors ${isUnread ? 'font-black' : ''}`}>{item.title}</h4>
                                <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{item.content}</p>
                              </div>
                              {isUnread && <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-2 shadow-lg shadow-indigo-200"></div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-center flex-shrink-0">
                    <button 
                      onClick={() => setShowNotifDropdown(false)}
                      className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                    >
                      Đóng thông báo
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {(isAdminSession || user.permissions?.canPostNews) && (
              <button onClick={() => { setIsEditing(false); setNewPost({id:'', title:'', content:'', imageUrl:''}); setIsPostModalOpen(true); }} className="h-12 px-6 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center gap-2 border border-white/10">
                <Plus size={16} /> Đăng tin
              </button>
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
              <div className="flex items-center justify-between mb-8 px-4 flex-shrink-0">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                   <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                   Bản tin nội bộ
                </h2>
                <button onClick={fetchData} className="text-slate-400 hover:text-indigo-600 transition-colors bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 pr-4 space-y-10">
                {loading ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang kết nối...</p>
                  </div>
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
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white ${isItemAdmin ? 'admin-logo-pulse bg-red-600 shadow-lg text-[10px] uppercase' : 'bg-slate-900 text-base'}`}>
                                {isItemAdmin ? 'Admin' : item.author.charAt(0)}
                              </div>
                              <div>
                                <p className={`text-sm font-black ${isItemAdmin ? 'admin-red-gradient' : 'text-slate-900'}`}>{item.author}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1"><Calendar size={10}/> {item.timestamp}</p>
                              </div>
                           </div>
                           <div className="flex gap-2 relative">
                             {(isAdminSession || isOwnPost) && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}
                                 className="p-2 bg-slate-50 text-slate-400 hover:text-blue-500 rounded-xl transition-all" 
                                 title="Chỉnh sửa"
                               >
                                 <Edit2 size={16}/>
                               </button>
                             )}
                             {isAdminSession && (
                               <>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handleDeleteNews(item.id); }} 
                                   disabled={isLoadingThis}
                                   className={`p-2 rounded-xl transition-all min-w-[40px] flex items-center justify-center ${isConfirmingDelete ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-red-500'}`} 
                                   title={isConfirmingDelete ? "Bấm lại để xác nhận XÓA" : "Xóa bài"}
                                 >
                                   {isLoadingThis ? <Loader2 size={16} className="animate-spin" /> : (isConfirmingDelete ? <AlertCircle size={16} /> : <Trash2 size={16}/>)}
                                 </button>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); handleToggleLock(item.id); }} 
                                   disabled={isLoadingThis}
                                   className="p-2 bg-slate-50 text-slate-400 hover:text-amber-500 rounded-xl transition-all disabled:opacity-50 min-w-[40px] flex items-center justify-center" 
                                   title={item.isLocked ? "Mở khóa bình luận" : "Khóa bình luận"}
                                 >
                                   {isLoadingThis ? <Loader2 size={16} className="animate-spin" /> : (item.isLocked ? <Lock size={16} /> : <Unlock size={16} />)}
                                 </button>
                               </>
                             )}
                           </div>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-line">{item.content}</p>
                        {item.imageUrl && (
                          <div className="mb-6 rounded-[2rem] overflow-hidden relative aspect-video shadow-inner bg-slate-50">
                            <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Maximize2 className="text-white" size={32}/></div>
                          </div>
                        )}
                        <div className="flex gap-8 pt-4 border-t border-slate-50">
                           <button onClick={(e) => { e.stopPropagation(); handleLike(item.id); }} className={`flex items-center gap-2 text-[10px] font-black transition-colors ${item.isLiked ? 'text-rose-500' : 'text-slate-400'}`}>
                             <div className={`p-2.5 rounded-xl ${item.isLiked ? 'bg-rose-50' : 'bg-slate-50'}`}><Heart size={18} fill={item.isLiked ? 'currentColor' : 'none'}/></div> {item.likesCount} Thích
                           </button>
                           <button onClick={(e) => { e.stopPropagation(); !item.isLocked && setCommentingId(commentingId === item.id ? null : item.id); }} className={`flex items-center gap-2 text-[10px] font-black transition-colors ${item.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600'}`}>
                             <div className="p-2.5 rounded-xl bg-slate-50"><MessageSquare size={18}/></div> {item.comments?.length || 0} Thảo luận {item.isLocked && "(Đã khóa)"}
                           </button>
                        </div>
                        {commentingId === item.id && !item.isLocked && (
                          <div className="mt-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                             <div className="bg-slate-50 rounded-2xl p-4 max-h-40 overflow-y-auto custom-scrollbar space-y-3">
                                {item.comments?.map(cmt => {
                                  const isCommentAdmin = getIsAdminByName(cmt.username);
                                  return (
                                    <div key={cmt.id} className="flex flex-col gap-1 border-b border-white/50 pb-2 last:border-0">
                                       <div className="flex justify-between items-center">
                                         <span className={`text-[10px] font-black ${isCommentAdmin ? 'admin-red-gradient' : 'text-indigo-600'}`}>{cmt.username}</span>
                                         <span className="text-[8px] text-slate-400 font-bold flex items-center gap-1"><Clock size={8}/> {cmt.timestamp}</span>
                                       </div>
                                       <div className="text-xs text-slate-700">{cmt.text}</div>
                                    </div>
                                  )
                                })}
                             </div>
                             <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(item.id)} className="flex-1 px-4 text-xs font-bold outline-none" placeholder="Viết gì đó..." />
                                <button onClick={() => handleAddComment(item.id)} className="p-2.5 bg-slate-900 text-white rounded-lg"><Send size={14}/></button>
                             </div>
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
                   <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center font-black mb-6 shadow-2xl border-[6px] border-white z-10 ${isAdminSession ? 'admin-logo-pulse bg-red-600 text-sm uppercase' : 'bg-slate-900 text-4xl'} text-white`}>
                     {isAdminSession ? 'Admin' : user.username.charAt(0).toUpperCase()}
                   </div>
                   <h3 className={`text-2xl font-black tracking-tight z-10 ${isAdminSession ? 'admin-red-gradient' : 'text-slate-900'}`}>{user.fullName}</h3>
                   <div className="mt-2 px-6 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200 z-10">{user.role}</div>
                   <div className="grid grid-cols-2 gap-4 w-full mt-12 z-10">
                      <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Điểm số</p>
                         <p className="text-2xl font-black text-slate-300">---</p>
                      </div>
                      <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Rank</p>
                         <p className="text-2xl font-black text-slate-300">---</p>
                      </div>
                   </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                   <TrendingUp className="absolute -bottom-6 -right-6 text-white/10 w-40 h-40 group-hover:scale-110 transition-transform duration-1000" />
                   <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-4">Lối tắt nhanh</h4>
                   <p className="text-xl font-bold leading-tight mb-8">Bạn có đơn hàng mới đang chờ xử lý!</p>
                   <button onClick={() => onTabChange('orders')} className="w-full h-14 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all">
                     Mở đơn hàng <ChevronRight size={16}/>
                   </button>
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
               {selectedNews.imageUrl ? (
                 <img src={selectedNews.imageUrl} className="max-w-full max-h-full object-contain" alt={selectedNews.title} />
               ) : (
                 <div className="flex flex-col items-center gap-4 text-slate-500">
                    <ImageIcon size={64} className="opacity-20" />
                    <p className="text-xs font-black uppercase tracking-widest">Không có hình ảnh</p>
                 </div>
               )}
               <button onClick={() => setSelectedNews(null)} className="absolute top-6 left-6 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-lg text-white rounded-full flex items-center justify-center transition-all">
                 <ChevronLeft size={24} />
               </button>
            </div>
            <div className="lg:w-1/3 flex flex-col h-full bg-white">
               <div className="p-8 border-b border-slate-50 flex-shrink-0">
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${getIsAdminByName(selectedNews.author) ? 'bg-red-600 admin-logo-pulse text-[8px] uppercase' : 'bg-slate-900 text-xs'}`}>
                          {getIsAdminByName(selectedNews.author) ? 'Admin' : selectedNews.author.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-xs font-black ${getIsAdminByName(selectedNews.author) ? 'admin-red-gradient' : 'text-slate-900'}`}>{selectedNews.author}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">{selectedNews.timestamp}</p>
                        </div>
                     </div>
                     <button onClick={() => setSelectedNews(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={20}/></button>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-4 leading-tight">{selectedNews.title}</h2>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar">
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{selectedNews.content}</p>
                  </div>
               </div>
               <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                     <div className="flex gap-6">
                        <button onClick={() => handleLike(selectedNews!.id)} className={`flex items-center gap-2 text-[10px] font-black ${selectedNews.isLiked ? 'text-rose-500' : 'text-slate-400'}`}>
                           <Heart size={20} fill={selectedNews.isLiked ? 'currentColor' : 'none'} className={selectedNews.isLiked ? 'text-rose-500' : ''} /> {selectedNews.likesCount}
                        </button>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                           <MessageSquare size={20} /> {selectedNews.comments?.length || 0}
                        </div>
                     </div>
                     <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Share2 size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
                     {selectedNews.comments && selectedNews.comments.length > 0 ? (
                        selectedNews.comments.map(cmt => {
                           const isCommentAdmin = getIsAdminByName(cmt.username);
                           return (
                             <div key={cmt.id} className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                   <span className={`text-[10px] font-black ${isCommentAdmin ? 'admin-red-gradient' : 'text-indigo-600'}`}>{cmt.username}</span>
                                   <span className="text-[8px] text-slate-300 font-bold">{cmt.timestamp}</span>
                                </div>
                                <div className="text-xs text-slate-600 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm leading-relaxed">{cmt.text}</div>
                             </div>
                           )
                        })
                     ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30 grayscale">
                           <MessageSquare size={48} className="text-slate-200" />
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Chưa có bình luận</p>
                        </div>
                     )}
                  </div>
                  {!selectedNews.isLocked ? (
                    <div className="p-8 bg-white border-t border-slate-100 flex-shrink-0">
                      <div className="flex gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 ring-indigo-500/10 transition-all">
                        <input 
                          value={commentText} 
                          onChange={e => setCommentText(e.target.value)} 
                          onKeyDown={e => e.key === 'Enter' && handleAddComment(selectedNews.id)}
                          className="flex-1 px-4 text-xs font-bold bg-transparent outline-none" 
                          placeholder="Tham gia thảo luận..." 
                        />
                        <button onClick={() => handleAddComment(selectedNews.id)} className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                           <Send size={16}/>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-100 border-t border-slate-200 flex-shrink-0 text-center">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
                          <Lock size={12} /> Bình luận đã bị khóa cho bản tin này
                       </p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {isPostModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !posting && setIsPostModalOpen(false)}></div>
           <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-slide-in">
              <form onSubmit={handleCreateOrUpdatePost} className="p-10 space-y-8">
                 <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                       {isEditing ? <Edit2 className="text-blue-500" /> : <Megaphone className="text-orange-500" />} 
                       {isEditing ? 'Chỉnh sửa bản tin' : 'Đăng tin nội bộ'}
                    </h3>
                    <button type="button" onClick={() => setIsPostModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                 </div>
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tiêu đề bản tin</label>
                       <input 
                         type="text" 
                         required
                         className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 ring-indigo-500/10 outline-none text-sm font-bold"
                         placeholder="Ví dụ: Thông báo lịch nghỉ lễ..."
                         value={newPost.title}
                         onChange={e => setNewPost({...newPost, title: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung chi tiết</label>
                       <textarea 
                         required
                         rows={5}
                         className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 ring-indigo-500/10 outline-none text-sm font-bold resize-none"
                         placeholder="Nhập nội dung muốn truyền tải..."
                         value={newPost.content}
                         onChange={e => setNewPost({...newPost, content: e.target.value})}
                       ></textarea>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hình ảnh đính kèm (Có thể kéo thả)</label>
                       <div className="relative group">
                          <input 
                            type="file" 
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                          />
                          <div 
                             onClick={() => fileInputRef.current?.click()}
                             onDragOver={handleDragOver}
                             onDragLeave={handleDragLeave}
                             onDrop={handleDrop}
                             className={`w-full h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${isDragging ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/50'} hover:border-indigo-400`}
                          >
                             {newPost.imageUrl ? (
                               <div className="w-full h-full p-2 relative">
                                  <img src={newPost.imageUrl} className="w-full h-full object-cover rounded-xl" alt="" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                     <RefreshCw size={24} className="text-white" />
                                  </div>
                               </div>
                             ) : (
                               <>
                                  <div className={`p-4 bg-white rounded-2xl shadow-sm text-slate-400 transition-all ${isDragging ? 'scale-110 text-indigo-600' : 'group-hover:text-indigo-600 group-hover:scale-110'}`}>
                                     <ImageIcon2 size={32} />
                                  </div>
                                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {isDragging ? 'Thả để tải lên' : 'Kéo thả ảnh hoặc Bấm để chọn'}
                                  </p>
                               </>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="pt-4 flex gap-4">
                    <button 
                      type="button" 
                      onClick={() => setIsPostModalOpen(false)}
                      className="flex-1 h-14 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Hủy bỏ
                    </button>
                    <button 
                      type="submit"
                      disabled={posting}
                      className={`flex-1 h-14 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${isEditing ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'} disabled:opacity-50`}
                    >
                       {posting ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> {isEditing ? 'Cập nhật ngay' : 'Đăng tin ngay'}</>}
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