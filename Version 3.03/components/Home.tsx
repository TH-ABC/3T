import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { 
  Bell, Heart, MessageSquare, Send, Plus, 
  ImageIcon, Loader2, User, 
  ChevronRight, Sparkles, X, CheckCircle,
  Image as ImageIcon2, Trash2, Megaphone,
  Calendar, RefreshCw, Maximize2,
  TrendingUp, Award, Clock, Edit2, Lock, Unlock,
  ChevronLeft, Share2, Check, AlertCircle,
  Type, AlignLeft, Layout, Bold, Underline, Palette, Type as TypeIcon,
  CornerDownRight, List, Info, MousePointer2, ChevronDown, ChevronUp,
  Eye, Monitor, AlertTriangle
} from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User as UserType, NewsItem, NewsComment } from '../types';

// Lazy load ReactQuill to prevent React 19 suspension errors
const ReactQuill = lazy(() => import('react-quill'));

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
  
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cấu hình Toolbar cho Quill chuyên nghiệp
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['clean']
    ],
  };

  const quillFormats = [
    'header', 'bold', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet', 'align'
  ];

  const toggleExpandPost = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let currentWidth = maxWidth;
          let currentHeight = maxHeight;
          let quality = 0.7;
          let base64 = "";
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const attemptResize = (w: number, h: number, q: number) => {
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > w) { height *= w / width; width = w; } } 
            else { if (height > h) { width *= h / height; height = h; } }
            
            canvas.width = width;
            canvas.height = height;
            ctx?.clearRect(0, 0, width, height);
            ctx?.drawImage(img, 0, 0, width, height);
            return canvas.toDataURL('image/jpeg', q);
          };

          base64 = attemptResize(currentWidth, currentHeight, quality);
          while (base64.length > 45000 && (currentWidth > 200 || quality > 0.2)) {
            if (quality > 0.3) quality -= 0.1;
            else {
               currentWidth -= 100;
               currentHeight -= 100;
            }
            base64 = attemptResize(currentWidth, currentHeight, quality);
          }
          resolve(base64);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const isContentEmpty = (html: string) => {
    if (!html) return true;
    const clean = html.replace(/<[^>]*>?/gm, '').trim();
    return clean === '' && !html.includes('<img');
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    
    const isRich = text.trim().startsWith('<') || 
                   text.trim().startsWith('{') || 
                   text.trim().startsWith('[') ||
                   text.includes('</');

    if (isRich) {
      const cleanText = text.replace(/<span class="ql-cursor">.*?<\/span>/g, '');
      return (
        <div 
          className="quill-content-render ql-editor ql-snow" 
          dangerouslySetInnerHTML={{ __html: cleanText }} 
        />
      );
    }

    const lines = text.split('\n');
    return lines.map((line, lIdx) => (
      <div key={lIdx} className="mb-0 min-h-[1.4em]">{line}</div>
    ));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [newsRes, usersRes] = await Promise.all([
        sheetService.getNews(user.username),
        sheetService.getUsers()
      ]);
      setNews(newsRes.news);
      setSystemUsers(Array.isArray(usersRes) ? usersRes : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event: MouseEvent) => {
      // Đóng modal xác nhận xóa nếu click ra ngoài
      if (confirmDeleteId && !(event.target as HTMLElement).closest('.delete-modal-content')) {
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [confirmDeleteId]);

  const handleLike = async (newsId: string) => {
    setNews(prev => prev.map(n => n.id === newsId ? { 
      ...n, isLiked: !n.isLiked, likesCount: n.isLiked ? n.likesCount - 1 : n.likesCount + 1 
    } : n));
    
    if (selectedNews && selectedNews.id === newsId) {
        setSelectedNews(prev => prev ? {
            ...prev,
            isLiked: !prev.isLiked,
            likesCount: prev.isLiked ? prev.likesCount - 1 : prev.likesCount + 1
        } : null);
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
        setSelectedNews(prev => prev ? {
            ...prev,
            comments: [...(prev.comments || []), newComment]
        } : null);
    }
    
    const textToSave = commentText;
    setCommentText('');
    await sheetService.addComment({ newsId, username: user.username, text: textToSave });
  };

  const handleDeleteNews = (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeActualDelete = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await sheetService.deleteNews(id);
      if (res.success) {
        setNews(prev => prev.filter(n => n.id !== id));
        setConfirmDeleteId(null);
      } else {
        alert(res.error || "Lỗi xóa bài");
      }
    } catch (err) {
      alert("Lỗi kết nối khi xóa bài tin.");
    } finally { 
      setActionLoadingId(null); 
    }
  };

  const handleToggleLock = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await sheetService.toggleLockNews(id);
      if (res.success) {
          setNews(prev => prev.map(n => n.id === id ? { ...n, isLocked: !n.isLocked } : n));
          if (selectedNews && selectedNews.id === id) {
              setSelectedNews(prev => prev ? { ...prev, isLocked: !prev.isLocked } : null);
          }
      }
    } finally { setActionLoadingId(null); }
  };

  const handleOpenEdit = (item: NewsItem) => {
    setNewPost({ id: item.id, title: item.title, content: item.content, imageUrl: item.imageUrl || '' });
    setIsEditing(true);
    setIsPostModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const resized = await resizeImage(file, 800, 800);
      setNewPost(prev => ({ ...prev, imageUrl: resized }));
    }
  };

  const handleCreateOrUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;
    setPosting(true);
    try {
      let res;
      if (isEditing) res = await sheetService.updateNews({ ...newPost });
      else res = await sheetService.addNews({ ...newPost, author: user.fullName });
      
      if (res && (res.success === true || String(res.success).toUpperCase() === "TRUE")) {
        setIsPostModalOpen(false);
        setIsEditing(false);
        setNewPost({ id: '', title: '', content: '', imageUrl: '' });
        await fetchData();
      } else {
        alert(res?.error || "Cập nhật thất bại. Vui lòng thử lại.");
      }
    } catch (err) { 
        alert("Lỗi kết nối hệ thống: " + err);
    } finally { setPosting(false); }
  };

  const isAdminSession = user.role.toLowerCase() === 'admin';
  const getIsAdminByName = (name: string) => {
    const foundUser = systemUsers.find(u => u.fullName === name || u.username === name);
    return foundUser?.role.toLowerCase() === 'admin' || name.toLowerCase().includes('admin');
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex flex-col overflow-hidden font-sans selection:bg-indigo-100">
      <header className="h-20 sm:h-24 flex-shrink-0 z-50 flex items-center border-b border-slate-200 bg-white px-4 sm:px-8">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"><Megaphone size={22} /></div>
             <div>
               <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-none">Bản Tin Nội Bộ</h1>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Hệ thống thông tin Team 3T</p>
             </div>
          </div>

          <div className="flex items-center gap-3">
            {(isAdminSession || user.permissions?.canPostNews) && (
              <button onClick={() => { setIsEditing(false); setNewPost({id:'', title:'', content:'', imageUrl:''}); setIsPostModalOpen(true); }} className="h-10 px-4 sm:px-6 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center gap-2">
                <Plus size={14} /> <span>Đăng tin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-12">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-indigo-500" size={32} /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải tin tức...</p></div>
          ) : (
            news.map((item) => {
              const isItemAdmin = getIsAdminByName(item.author);
              const isOwnPost = item.author === user.fullName;
              const isLoadingThis = actionLoadingId === item.id;
              const isExpanded = expandedPosts.has(item.id);
              const showExpandButton = item.content.length > 400 || item.content.split('\n').length > 6;

              return (
                <article key={item.id} className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-slate-200/60 overflow-hidden animate-slide-in group">
                  <div className="p-6 sm:p-10">
                    <div className="flex items-start justify-between mb-1">
                       <div className="flex items-center gap-3 sm:gap-4">
                          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-white shadow-lg ${isItemAdmin ? 'bg-red-600 admin-logo-pulse text-[8px]' : 'bg-slate-900 text-base'}`}>{isItemAdmin ? 'ADMIN' : item.author.charAt(0)}</div>
                          <div>
                            <p className={`text-sm sm:text-base font-black ${isItemAdmin ? 'admin-red-gradient' : 'text-slate-900'}`}>{item.author}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5 mt-0.5"><Clock size={10}/> {item.timestamp}</p>
                          </div>
                       </div>
                       <div className="flex gap-1">
                         {(isAdminSession || isOwnPost) && <button onClick={() => handleOpenEdit(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Sửa bài"><Edit2 size={16}/></button>}
                         {isAdminSession && (
                           <>
                            <button onClick={() => handleToggleLock(item.id)} className={`p-2 rounded-xl transition-all ${item.isLocked ? 'text-orange-600 bg-orange-50 shadow-sm' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50'}`} title={item.isLocked ? "Mở khóa bình luận" : "Khóa bình luận"}>
                                {item.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                            </button>
                            <button onClick={() => handleDeleteNews(item.id)} className={`p-2 rounded-xl transition-all hover:bg-rose-50 text-slate-400 hover:text-rose-600`} title="Xóa bài">
                                {isLoadingThis ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                            </button>
                           </>
                         )}
                       </div>
                    </div>

                    {!isContentEmpty(item.title) && (
                      <div className="text-xl sm:text-2xl font-black text-slate-900 mb-0 leading-tight group-hover:text-indigo-600 transition-colors">
                          {renderFormattedText(item.title)}
                      </div>
                    )}
                    
                    <div className={`text-slate-600 text-sm sm:text-base leading-relaxed relative transition-all duration-500 ${!isExpanded && showExpandButton ? 'max-h-60 overflow-hidden' : 'max-h-none'}`}>
                      {renderFormattedText(item.content)}
                      {!isExpanded && showExpandButton && <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent"></div>}
                    </div>

                    {showExpandButton && (
                      <button onClick={(e) => toggleExpandPost(e, item.id)} className="mt-4 flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] hover:text-indigo-800">
                        {isExpanded ? <><ChevronUp size={14}/> Thu gọn</> : <><ChevronDown size={14}/> Xem thêm nội dung</>}
                      </button>
                    )}

                    {item.imageUrl && (
                      <div onClick={() => setSelectedNews(item)} className="mt-8 rounded-[2rem] overflow-hidden aspect-video shadow-inner bg-slate-100 cursor-pointer relative group/img border border-slate-200">
                        <img src={item.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover/img:scale-105" alt="" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                           <div className="bg-white/20 backdrop-blur-md p-4 rounded-full text-white"><Maximize2 size={32} /></div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-6 sm:gap-10 mt-10 pt-6 border-t border-slate-100">
                       <button onClick={() => handleLike(item.id)} className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${item.isLiked ? 'text-rose-500' : 'text-slate-400'}`}>
                         <div className={`p-3 rounded-xl transition-all ${item.isLiked ? 'bg-rose-50' : 'bg-slate-50 group-hover:bg-slate-100'}`}><Heart size={18} fill={item.isLiked ? 'currentColor' : 'none'}/></div>
                         {item.likesCount} Thích
                       </button>
                       <button onClick={() => !item.isLocked && setCommentingId(commentingId === item.id ? null : item.id)} className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${item.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400'}`}>
                         <div className="p-3 bg-slate-50 group-hover:bg-slate-100 rounded-xl transition-all"><MessageSquare size={18}/></div>
                         {item.comments?.length || 0} Phản hồi {item.isLocked && <span className="ml-1 opacity-50">(Khóa)</span>}
                       </button>
                    </div>

                    {commentingId === item.id && !item.isLocked && (
                      <div className="mt-6 pt-6 border-t border-slate-100 animate-fade-in space-y-4">
                         <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                            {item.comments?.map(cmt => (
                              <div key={cmt.id} className="flex gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-indigo-100 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase">{cmt.username.charAt(0)}</div>
                                 <div className="flex-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-black text-slate-900 uppercase">{cmt.username}</span><span className="text-[8px] font-bold text-slate-300">{cmt.timestamp}</span></div>
                                    <p className="text-xs text-slate-600 font-medium">{cmt.text}</p>
                                 </div>
                              </div>
                            ))}
                         </div>
                         <div className="flex gap-2 p-1.5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm focus-within:border-indigo-200 transition-all">
                            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(item.id)} className="flex-1 px-4 text-xs font-bold outline-none placeholder:text-slate-300" placeholder="Viết phản hồi..." />
                            <button onClick={() => handleAddComment(item.id)} className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"><Send size={14}/></button>
                         </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>

      {/* --- MODAL BẢN TIN CHI TIẾT --- */}
      {selectedNews && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedNews(null)}></div>
          <div className="bg-white w-full max-w-6xl h-full sm:h-[90vh] sm:rounded-[3rem] shadow-2xl overflow-hidden relative animate-slide-in flex flex-col md:flex-row">
             <div className="flex-[1.5] bg-black relative flex items-center justify-center group overflow-hidden border-b md:border-b-0 md:border-r border-slate-100">
                {selectedNews.imageUrl ? (
                  <img src={selectedNews.imageUrl} className="w-full h-full object-contain" alt="" />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-slate-600">
                     <ImageIcon2 size={64} className="opacity-20" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em]">Không có hình ảnh</span>
                  </div>
                )}
                <button onClick={() => setSelectedNews(null)} className="md:hidden absolute top-4 right-4 w-10 h-10 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all hover:bg-black/60"><X size={20}/></button>
             </div>

             <div className="flex-1 flex flex-col h-full bg-white relative">
                <button onClick={() => setSelectedNews(null)} className="hidden md:flex absolute top-6 right-6 w-10 h-10 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full items-center justify-center transition-all z-10"><X size={20}/></button>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10">
                   <div className="flex items-center gap-4 mb-1">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-md ${getIsAdminByName(selectedNews.author) ? 'bg-red-600 admin-logo-pulse text-[8px]' : 'bg-slate-900 text-sm'}`}>
                         {getIsAdminByName(selectedNews.author) ? 'ADMIN' : selectedNews.author.charAt(0)}
                      </div>
                      <div>
                         <h4 className={`text-sm font-black uppercase tracking-wider ${getIsAdminByName(selectedNews.author) ? 'admin-red-gradient' : 'text-slate-900'}`}>{selectedNews.author}</h4>
                         <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5 mt-0.5"><Clock size={10}/> {selectedNews.timestamp}</p>
                      </div>
                   </div>

                   {!isContentEmpty(selectedNews.title) && (
                     <div className="text-xl sm:text-2xl font-black text-slate-900 mb-0 leading-tight">
                          {renderFormattedText(selectedNews.title)}
                     </div>
                   )}
                   
                   <div className="text-slate-600 text-sm sm:text-base leading-relaxed mb-10 border-l-4 border-indigo-100 pl-6 py-2">
                      {renderFormattedText(selectedNews.content)}
                   </div>

                   <div className="flex items-center gap-6 mb-10 pb-10 border-b border-slate-50">
                      <button onClick={() => handleLike(selectedNews.id)} className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest ${selectedNews.isLiked ? 'text-rose-500' : 'text-slate-400'}`}>
                        <div className={`p-3.5 rounded-2xl transition-all ${selectedNews.isLiked ? 'bg-rose-50 shadow-inner' : 'bg-slate-50 hover:bg-slate-100'}`}>
                           <Heart size={20} fill={selectedNews.isLiked ? 'currentColor' : 'none'}/>
                        </div>
                        {selectedNews.likesCount} Thích
                      </button>
                      <div className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                         <div className="p-3.5 bg-slate-50 rounded-2xl">
                            <MessageSquare size={20}/>
                         </div>
                         {selectedNews.comments?.length || 0} Phản hồi
                      </div>
                   </div>

                   <div className="space-y-6">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Danh sách thảo luận</h5>
                      {selectedNews.comments && selectedNews.comments.length > 0 ? (
                        selectedNews.comments.map(cmt => (
                           <div key={cmt.id} className="flex gap-4 group animate-fade-in">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase">
                                 {cmt.username.charAt(0)}
                              </div>
                              <div className="flex-1 bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 group-hover:bg-white group-hover:shadow-md transition-all">
                                 <div className="flex justify-between items-center mb-1.5">
                                    <span className={`text-[10px] font-black uppercase ${getIsAdminByName(cmt.username) ? 'admin-red-gradient' : 'text-indigo-600'}`}>{cmt.username}</span>
                                    <span className="text-[8px] font-bold text-slate-300">{cmt.timestamp}</span>
                                 </div>
                                 <p className="text-xs text-slate-600 font-medium leading-relaxed">{cmt.text}</p>
                              </div>
                           </div>
                        ))
                      ) : (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-30">
                           <MessageSquare size={32} />
                           <p className="text-[10px] font-black uppercase tracking-widest">Chưa có bình luận nào</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="p-6 sm:p-10 border-t border-slate-100 bg-white/50 backdrop-blur-md">
                   {!selectedNews.isLocked ? (
                      <div className="flex gap-3 p-1.5 bg-white border-2 border-slate-100 rounded-2xl shadow-sm focus-within:border-indigo-200 focus-within:shadow-indigo-50 transition-all">
                         <input 
                           value={commentText} 
                           onChange={e => setCommentText(e.target.value)} 
                           onKeyDown={e => e.key === 'Enter' && handleAddComment(selectedNews!.id)} 
                           className="flex-1 px-5 text-sm font-bold outline-none placeholder:text-slate-300 bg-transparent" 
                           placeholder="Tham gia thảo luận..." 
                         />
                         <button 
                           onClick={() => handleAddComment(selectedNews!.id)} 
                           className="p-3.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"
                         >
                           <Send size={18}/>
                         </button>
                      </div>
                   ) : (
                     <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-center gap-3 text-orange-600">
                        <Lock size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Bản tin này đã khóa bình luận bởi Admin</span>
                     </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- MODAL ĐĂNG/SỬA TIN RICH TEXT EDITOR --- */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 sm:p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !posting && setIsPostModalOpen(false)}></div>
           <div className="bg-white w-full max-w-5xl h-full sm:h-[90vh] sm:rounded-[3rem] shadow-2xl overflow-hidden relative animate-slide-in flex flex-col md:flex-row">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 border-r border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-100">
                      {isEditing ? <Edit2 size={20} /> : <Megaphone size={20} />}
                    </div>
                    {isEditing ? 'Chỉnh Sửa Tin' : 'Phát Hành Bản Tin'}
                  </h3>
                  <button type="button" onClick={() => setIsPostModalOpen(false)} className="md:hidden w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500"><X size={20}/></button>
                </div>

                <form onSubmit={handleCreateOrUpdatePost} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">Tiêu đề bản tin</label>
                    <input 
                      type="text"
                      value={newPost.title}
                      onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                      placeholder="Tiêu đề bắt mắt..."
                      className="w-full h-12 px-5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">Nội dung chi tiết</label>
                    <Suspense fallback={<div className="h-40 animate-pulse bg-slate-50 border border-slate-100 rounded-xl"></div>}>
                      <ReactQuill 
                        theme="snow"
                        value={newPost.content}
                        onChange={(val) => setNewPost({...newPost, content: val})}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Hãy kể một câu chuyện thú vị..."
                        className="bg-white rounded-2xl quill-editor-modal"
                      />
                    </Suspense>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={12} className="text-orange-500"/> Hình ảnh minh họa</label>
                    <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all overflow-hidden group/upload">
                       <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                       {newPost.imageUrl ? (
                         <div className="relative w-full h-full"><img src={newPost.imageUrl} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/upload:opacity-100 transition-opacity"><div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white text-[10px] font-black uppercase">Đổi ảnh khác</div></div></div>
                       ) : (
                         <>
                           <div className="w-12 h-12 bg-white rounded-2xl shadow-md text-slate-300 flex items-center justify-center group-hover/upload:text-indigo-500 transition-colors"><ImageIcon size={24} /></div>
                           <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tải ảnh lên hệ thống</p>
                         </>
                       )}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setIsPostModalOpen(false)} className="flex-1 h-14 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all">Hủy</button>
                    <button type="submit" disabled={posting} className="flex-[2] h-14 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                      {posting ? <Loader2 size={18} className="animate-spin" /> : (isEditing ? <><CheckCircle size={18}/> Cập Nhật</> : <><Send size={18}/> Phát hành ngay</>)}
                    </button>
                  </div>
                </form>
              </div>

              <div className="hidden md:flex md:w-[400px] bg-[#fdfdfd] flex-col p-10 overflow-y-auto custom-scrollbar">
                <div className="mb-6 flex items-center justify-between">
                   <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2"><Eye size={14}/> Preview Live</h4>
                   <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400"></div><div className="w-2 h-2 rounded-full bg-amber-400"></div><div className="w-2 h-2 rounded-full bg-emerald-400"></div></div>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl p-6 relative overflow-hidden pointer-events-none scale-90 origin-top">
                   <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-black">{user.fullName.charAt(0)}</div>
                      <div><p className="text-[11px] font-black text-slate-900">{user.fullName}</p><p className="text-[8px] font-bold text-slate-300 uppercase">Vừa xong</p></div>
                   </div>
                   {!isContentEmpty(newPost.title) && (
                     <div className="text-sm font-black text-slate-900 mb-0 leading-tight">
                          {renderFormattedText(newPost.title || "Tiêu đề mẫu")}
                     </div>
                   )}
                   <div className="text-[11px] text-slate-600 leading-relaxed mb-6">
                        {renderFormattedText(newPost.content || "Nội dung mẫu sẽ hiển thị tại đây khi bạn bắt đầu gõ...")}
                   </div>
                   {newPost.imageUrl && <div className="rounded-2xl overflow-hidden aspect-video border border-slate-100 mb-6"><img src={newPost.imageUrl} className="w-full h-full object-cover" alt="" /></div>}
                   <div className="flex gap-4 pt-4 border-t border-slate-50 opacity-40"><Heart size={14}/><MessageSquare size={14}/></div>
                </div>
                <div className="mt-8 text-center"><p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Giao diện này phản ánh kết quả sau khi đăng</p></div>
              </div>
           </div>
        </div>
      )}

      {/* --- CUSTOM DELETE CONFIRMATION MODAL --- */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
           <div className="delete-modal-content bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm relative animate-slide-in">
              <div className="flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-rose-100">
                    <AlertTriangle size={32} />
                 </div>
                 <h3 className="text-lg font-black text-slate-900 uppercase mb-2 tracking-tight">Xác nhận xóa bài?</h3>
                 <p className="text-xs font-bold text-slate-500 leading-relaxed mb-8">
                    Bản tin này sẽ bị xóa vĩnh viễn khỏi hệ thống và không thể khôi phục lại. Bạn chắc chắn chứ?
                 </p>
                 <div className="flex w-full gap-3">
                    <button 
                       onClick={() => setConfirmDeleteId(null)} 
                       className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                       Hủy bỏ
                    </button>
                    <button 
                       onClick={() => executeActualDelete(confirmDeleteId)} 
                       disabled={actionLoadingId === confirmDeleteId}
                       className="flex-1 py-3.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       {actionLoadingId === confirmDeleteId ? <Loader2 size={14} className="animate-spin" /> : "Xác nhận xóa"}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Home;