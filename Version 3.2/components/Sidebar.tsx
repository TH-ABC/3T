
import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Settings, 
  FileText, 
  Wallet,
  X,
  LogOut,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Palette
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  currentTab: string;
  setCurrentTab: (t: string) => void;
  user: User;
  onLogout: () => void;
  isDesktopCollapsed: boolean;
  setIsDesktopCollapsed: (v: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, setIsOpen, currentTab, setCurrentTab, user, onLogout,
  isDesktopCollapsed, setIsDesktopCollapsed 
}) => {
  const menuGroups = [
    {
      title: 'NGHIỆP VỤ',
      items: [
        { id: 'dashboard', label: 'Trang chủ', icon: <LayoutDashboard size={20} /> },
        { id: 'orders', label: 'Quản lý Đơn hàng', icon: <ShoppingCart size={20} /> },
        { id: 'designer_online', label: 'Designer Online', icon: <Palette size={20} /> },
        { id: 'customers', label: 'Khách hàng', icon: <Users size={20} /> },
      ]
    },
    {
      title: 'TÀI CHÍNH',
      items: [
        { id: 'finance', label: 'Sổ Quỹ (Thu - Chi)', icon: <Wallet size={20} /> },
        { id: 'reports', label: 'Báo Cáo Lãi Lỗ', icon: <FileText size={20} /> },
      ]
    },
    {
      title: 'HỆ THỐNG',
      items: [
        ...(user.role === 'admin' ? [
          { id: 'users', label: 'Quản lý Tài khoản', icon: <UserCog size={20} /> }
        ] : []),
        { id: 'settings', label: 'Cấu hình Google Sheet', icon: <Settings size={20} /> },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 h-full bg-[#1e293b] text-white z-30 transition-all duration-300 ease-in-out flex flex-col border-r border-gray-700
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 
        ${isDesktopCollapsed ? 'w-20' : 'w-64'}
      `}>
        {/* Header */}
        <div className={`h-16 flex items-center ${isDesktopCollapsed ? 'justify-center' : 'justify-between px-4'} bg-[#0f172a] border-b border-gray-700 transition-all relative`}>
          {!isDesktopCollapsed && (
            <div className="font-bold text-lg leading-tight whitespace-nowrap overflow-hidden">
              QUẢN LÝ <br/> <span className="text-orange-500">ORDER ONLINE</span>
            </div>
          )}
          {isDesktopCollapsed && (
             <span className="font-bold text-xl text-orange-500">3T</span>
          )}
          
          {/* Desktop Toggle Button */}
          <button 
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)} 
            className="hidden lg:flex items-center justify-center w-6 h-6 bg-slate-700 rounded-full text-gray-400 hover:text-white hover:bg-slate-600 transition-colors absolute -right-3 border border-gray-600 top-5 z-40 shadow-sm"
          >
            {isDesktopCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Mobile Close Button */}
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar overflow-x-hidden">
          {menuGroups.map((group, idx) => (
            <div key={idx} className="mb-6">
              {!isDesktopCollapsed ? (
                <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 transition-opacity duration-300 whitespace-nowrap">
                  {group.title}
                </h3>
              ) : (
                <div className="h-px bg-gray-700 mx-4 mb-4 mt-2"></div>
              )}
              <ul>
                {group.items.map((item) => (
                  <li key={item.id} className="relative group">
                    <button
                      onClick={() => {
                        setCurrentTab(item.id);
                        if (window.innerWidth < 1024) setIsOpen(false);
                      }}
                      className={`
                        w-full flex items-center py-3 text-sm font-medium transition-colors border-l-4
                        ${isDesktopCollapsed ? 'justify-center px-0' : 'px-4'}
                        ${currentTab === item.id 
                          ? 'bg-slate-700 border-orange-500 text-white' 
                          : 'border-transparent text-gray-400 hover:bg-slate-800 hover:text-white'}
                      `}
                      title={isDesktopCollapsed ? item.label : ''}
                    >
                      <span className={`${isDesktopCollapsed ? '' : 'mr-3'}`}>{item.icon}</span>
                      {!isDesktopCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                    </button>
                    {/* Tooltip for collapsed state */}
                    {isDesktopCollapsed && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity shadow-lg border border-gray-700">
                        {item.label}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* User Profile / Footer */}
        <div className={`bg-[#0f172a] border-t border-gray-700 ${isDesktopCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center flex-col gap-3' : 'justify-between'}`}>
            <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold uppercase flex-shrink-0 cursor-default">
                {user.username.charAt(0)}
              </div>
              {!isDesktopCollapsed && (
                <div className="ml-3 overflow-hidden">
                  <p className="text-sm font-medium truncate w-32" title={user.fullName}>{user.fullName}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              )}
            </div>
            <button 
              onClick={onLogout}
              className={`text-gray-400 hover:text-white p-2 rounded-md hover:bg-slate-800 transition-colors ${isDesktopCollapsed ? '' : ''}`}
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
