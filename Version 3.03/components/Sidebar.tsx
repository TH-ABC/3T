
import React from 'react';
import { 
  LayoutDashboard, ShoppingCart, Users, Settings, 
  Wallet, X, LogOut, ChevronLeft, ChevronRight, 
  Palette, Key, PenTool, UserCheck, Home, FileText,
  CalendarDays
} from 'lucide-react';
import { User, UserPermissions } from '../types';

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
        { id: 'designer_online', label: 'Designer Online', icon: <Palette size={20} />, visible: hasAccess('designerOnline') },
        { id: 'designer', label: 'Designer', icon: <PenTool size={20} />, visible: hasAccess('designer') },
      ]
    },
    {
      title: 'TÀI CHÍNH',
      items: [
        { id: 'finance', label: 'Sổ Quỹ', icon: <Wallet size={20} />, visible: hasAccess('finance') },
      ]
    },
    {
      title: 'HỆ THỐNG',
      items: [
        { id: 'schedule', label: 'Lịch trực', icon: <CalendarDays size={20} />, visible: true },
        { id: 'users', label: 'Nhân Sự', icon: <UserCheck size={20} />, visible: user.role === 'admin' },
        { id: 'settings', label: 'Cấu hình', icon: <Settings size={20} />, visible: user.role === 'admin' },
      ]
    }
  ];

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

      <div className={`fixed top-0 left-0 h-full bg-[#1e293b] text-white z-50 transition-all duration-300 flex flex-col border-r border-gray-700 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${isDesktopCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`h-16 flex items-center ${isDesktopCollapsed ? 'justify-center' : 'justify-between px-4'} bg-[#0f172a] border-b border-gray-700 relative`}>
          {!isDesktopCollapsed && <div className="font-bold text-lg text-orange-500 uppercase tracking-tighter">Team 3T OMS</div>}
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

        <div className="p-4 bg-[#0f172a] border-t border-gray-700 flex items-center justify-between">
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
