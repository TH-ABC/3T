
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Users, Settings, 
  Wallet, X, LogOut, ChevronLeft, ChevronRight, 
  Palette, Key, PenTool, UserCheck, Home, FileText,
  CalendarDays, ClipboardList, Bell, Clock, ArrowRight,
  CheckCircle, Zap, History, Megaphone, BarChart3, Landmark
} from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User, UserPermissions, HandoverItem, NewsItem } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: User;
  onLogout: () => void;
  onChangePassword: () => void;
  isDesktopCollapsed: boolean;
  setIsDesktopCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, setIsOpen, currentTab, setCurrentTab, user, onLogout, onChangePassword,
  isDesktopCollapsed, setIsDesktopCollapsed 
}) => {
  const [allTasks, setAllTasks] = useState<HandoverItem[]>([]);
  const [unreadNews, setUnreadNews] = useState<NewsItem[]>([]);
  const [notifTab, setNotifTab] = useState<'new' | 'history'>('new');
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const [handoverRes, newsRes] = await Promise.all([
        sheetService.getHandover("", user.fullName, user.role),
        sheetService.getNews(user.username)
      ]);
      
      if (Array.isArray(handoverRes)) {
        setAllTasks(handoverRes);
      }
      
      if (newsRes && newsRes.news) {
        const unread = newsRes.news.filter(n => {
          const postTime = new Date(n.timestamp).getTime();
          return postTime > (newsRes.lastReadTime || 0);
        });
        setUnreadNews(unread);
      }
    } catch (e) {
      console.error("Notif Error:", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user.fullName, user.username]);

  const currentFullName = user.fullName.toLowerCase();
  const newTasks = allTasks.filter(item => 
    !item.isSeen && 
    item.status === 'Pending' && 
    item.assignee.toLowerCase() === currentFullName
  );
  
  const historyTasks = allTasks.filter(item => 
    (item.isSeen || item.status !== 'Pending') && 
    item.assignee.toLowerCase() === currentFullName
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
  
  const totalUnreadCount = newTasks.length + unreadNews.length;

  const hasAccess = (module: string): boolean => {
      if (user.role === 'admin') return true;
      if (module === 'home') return true;
      const perms = user.permissions;
      if (!perms) return true;
      const p = perms[module as keyof UserPermissions];
      return p !== 'none';
  };

  const isAdmin = user.role.toLowerCase() === 'admin';

  const menuGroups = [
    {
      title: 'NGHIỆP VỤ',
      items: [
        { id: 'dashboard', label: 'Quản Lý', icon: <LayoutDashboard size={20} />, visible: hasAccess('dashboard') },
        { id: 'orders', label: 'Quản lý Đơn hàng', icon: <ShoppingCart size={20} />, visible: hasAccess('orders') },
        { id: 'handover', label: 'Daily Handover', icon: <ClipboardList size={20} />, visible: hasAccess('handover') },
        { id: 'designer_online', label: 'Designer Online', icon: <Palette size={20} />, visible: hasAccess('designerOnline') },
        { id: 'designer', label: 'Designer', icon: <PenTool size={20} />, visible: hasAccess('designer') },
      ]
    },
    {
      title: 'TÀI CHÍNH',
      items: [
        { id: 'finance', label: 'Thống kê', icon: <BarChart3 size={20} />, visible: hasAccess('finance') },
      ]
    },
    {
      title: 'HỆ THỐNG',
      items: [
        { id: 'schedule', label: 'Điểm danh ca trực', icon: <CalendarDays size={20} />, visible: true },
        { id: 'users', label: 'Nhân Sự', icon: <UserCheck size={20} />, visible: user.role === 'admin' },
        { id: 'settings', label: 'Cấu hình', icon: <Settings size={20} />, visible: user.role === 'admin' },
      ]
    }
  ];

  const handleNotifClick = async (item: HandoverItem | NewsItem) => {
    setShowNotif(false);
    if ('task' in item) {
      setCurrentTab('handover');
      setAllTasks(prev => prev.map(t => t.id === item.id ? { ...t, isSeen: true } : t));
      try {
        await sheetService.markHandoverAsSeen(item.id);
      } catch (e) {
        console.error("Error marking handover as seen:", e);
      }
    } else {
      setCurrentTab('home');
      setUnreadNews(prev => prev.filter(n => n.id !== item.id));
      try {
        await sheetService.updateLastReadTime(user.username);
      } catch (e) {
        console.error("Error updating news read time:", e);
      }
    }
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-[90] lg:hidden" onClick={() => setIsOpen(false)} />}

      <div className={`fixed top-0 left-0 h-full bg-[#1e293b] text-white z-[100] transition-all duration-300 flex flex-col border-r border-gray-700 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${isDesktopCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`h-16 flex items-center ${isDesktopCollapsed ? 'justify-center' : 'justify-between px-4'} bg-[#0f172a] border-b border-gray-700 relative`}>
          {!isDesktopCollapsed && <div className="font-bold text-lg text-orange-500 uppercase tracking-tighter">Team 3T OMS</div>}
          
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setShowNotif(!showNotif)}
              className={`p-2 rounded-xl transition-all relative ${totalUnreadCount > 0 ? 'notif-bell-pulse' : 'text-gray-500 hover:text-white'}`}
            >
              <Bell size={isDesktopCollapsed ? 22 : 18} />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-md animate-bounce">
                  {totalUnreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div 
                className="fixed w-80 bg-white rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.4)] border-2 border-orange-500 p-5 z-[9999] animate-slide-in"
                style={{ 
                  left: isDesktopCollapsed ? '5.5rem' : '16.5rem', 
                  top: '0.75rem' 
                }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                     <Zap size={16} className="text-orange-600 fill-orange-600" />
                     <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Thông báo</span>
                  </div>
                  <button onClick={() => setShowNotif(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={16} className="text-slate-400" /></button>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                   <button 
                     onClick={() => setNotifTab('new')}
                     className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${notifTab === 'new' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                   >
                     Mới ({totalUnreadCount})
                   </button>
                   <button 
                     onClick={() => setNotifTab('history')}
                     className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${notifTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                   >
                     Lịch sử
                   </button>
                </div>
                
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-3">
                  {notifTab === 'new' ? (
                    <>
                      {unreadNews.map(news => (
                        <div key={news.id} onClick={() => handleNotifClick(news)} className="p-4 bg-blue-50/50 rounded-2xl border-2 border-blue-100 hover:border-blue-400 hover:bg-blue-100 transition-all cursor-pointer group shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2 text-blue-600">
                               <Megaphone size={12} />
                               <span className="text-[10px] font-black uppercase">Tin mới</span>
                             </div>
                             <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase">HOT</span>
                          </div>
                          <p className="text-sm font-black text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-900 mb-1">{news.title}</p>
                          <div className="pt-2 border-t border-blue-200/50 flex items-center justify-between">
                             <span className="text-[9px] font-bold text-slate-400 uppercase italic">Tác giả: {news.author}</span>
                             <ArrowRight size={14} className="text-blue-500" />
                          </div>
                        </div>
                      ))}

                      {newTasks.map(task => (
                        <div key={task.id} onClick={() => handleNotifClick(task)} className="p-4 bg-orange-50/50 rounded-2xl border-2 border-orange-100 hover:border-orange-400 hover:bg-orange-100 transition-all cursor-pointer group shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2 text-orange-600">
                               <Clock size={12} />
                               <span className="text-[10px] font-black uppercase">Hạn: {task.deadlineAt.includes('T') ? task.deadlineAt.split('T')[1].substring(0,5) : '---'}</span>
                             </div>
                             <span className="bg-orange-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">Cần Nhận</span>
                          </div>
                          <p className="text-sm font-black text-slate-800 line-clamp-2 leading-snug group-hover:text-orange-900 mb-1">{task.task}</p>
                          <div className="pt-2 border-t border-orange-200/50 flex items-center justify-between">
                             <span className="text-[9px] font-bold text-indigo-600 uppercase italic">Từ: {task.createdBy.split(' (')[0]}</span>
                             <ArrowRight size={14} className="text-orange-500" />
                          </div>
                        </div>
                      ))}

                      {totalUnreadCount === 0 && (
                        <div className="py-14 text-center">
                          <CheckCircle size={32} className="mx-auto text-emerald-500 mb-3 opacity-30" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Tuyệt vời! Bạn không còn việc nào mới.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {historyTasks.length === 0 ? (
                        <div className="py-14 text-center">
                          <History size={32} className="mx-auto text-slate-300 mb-3 opacity-30" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Chưa có lịch sử thông báo.</p>
                        </div>
                      ) : (
                        historyTasks.map(task => (
                          <div key={task.id} onClick={() => handleNotifClick(task)} className="p-4 bg-slate-50 border-2 border-slate-100 hover:border-slate-300 rounded-2xl transition-all cursor-pointer group shadow-sm">
                            <div className="flex items-center justify-between mb-1 opacity-60">
                               <span className="text-[9px] font-black text-slate-500 uppercase">{task.status} - {task.date.split(' ')[0]}</span>
                               <CheckCircle size={12} className="text-emerald-500" />
                            </div>
                            <p className="text-xs font-bold text-slate-500 line-clamp-1 italic">{task.task}</p>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
                
                <button 
                  onClick={() => {setCurrentTab('handover'); setShowNotif(false);}} 
                  className="w-full mt-4 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <ClipboardList size={14} /> Đi đến Bàn Giao
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)} className="hidden lg:flex absolute -right-3 top-5 bg-slate-700 rounded-full p-1 border border-gray-600 shadow-lg z-50">
            {isDesktopCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          <div className="px-3 mb-6">
            <button
              onClick={() => setCurrentTab('home')}
              className={`w-full flex items-center py-3 rounded-xl transition-all font-bold ${currentTab === 'home' ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-400 hover:bg-slate-800 hover:text-white'} ${isDesktopCollapsed ? 'justify-center' : 'px-4'}`}
            >
              <Home size={22} className={isDesktopCollapsed ? '' : 'mr-3'} />
              {!isDesktopCollapsed && <span className="uppercase tracking-widest text-sm">Trang chủ</span>}
            </button>
          </div>

          {menuGroups.map((group, idx) => (
            <div key={idx} className="mb-6">
              {!isDesktopCollapsed && <h3 className="px-6 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">{group.title}</h3>}
              <div className="px-3 space-y-1">
                {group.items.filter(i => i.visible).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`w-full flex items-center py-2.5 rounded-lg transition-colors text-sm ${currentTab === item.id ? 'bg-slate-700 text-orange-500 font-bold' : 'text-gray-400 hover:bg-slate-800 hover:text-white'} ${isDesktopCollapsed ? 'justify-center' : 'px-4'}`}
                  >
                    <span className={isDesktopCollapsed ? '' : 'mr-3'}>{item.icon}</span>
                    {!isDesktopCollapsed && <span>{item.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-[#0f172a] border-t border-gray-700 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center font-black ${isAdmin ? 'admin-logo-pulse text-[8px] uppercase border-2 border-red-400 shadow-lg' : 'text-xs bg-orange-600'}`}>
                {isAdmin ? 'ADMIN' : user.username.charAt(0).toUpperCase()}
              </div>
              {!isDesktopCollapsed && <div className={`text-xs font-bold truncate w-24 ${isAdmin ? 'admin-red-gradient' : ''}`}>{user.fullName}</div>}
           </div>
           <button onClick={onLogout} title="Đăng xuất" className="text-gray-500 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
