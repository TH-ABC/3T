
import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Home from './components/Home'; // NEW
import Dashboard from './components/Dashboard';
import { OrderList } from './components/OrderList';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import StoreDetail from './components/StoreDetail';
import { DesignerOnlineList } from './components/DesignerOnlineList';
import { DesignerList } from './components/DesignerList';
import { FinanceBoard } from './components/FinanceBoard';
import ChangePasswordModal from './components/ChangePasswordModal';
import { User, Store, UserPermissions } from './types';

function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('oms_user_session');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) { return null; }
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false); 
  const [currentTab, setCurrentTab] = useState('home'); 
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingUpdates > 0) {
        e.preventDefault();
        e.returnValue = ''; 
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingUpdates]);

  const handleLogin = (userData: User) => {
    localStorage.setItem('oms_user_session', JSON.stringify(userData));
    setUser(userData);
    setCurrentTab('home');
  };

  const handleLogout = () => {
    if (pendingUpdates > 0) {
        alert("Vui lòng chờ hoàn tất cập nhật trước khi đăng xuất.");
        return;
    }
    localStorage.removeItem('oms_user_session');
    setUser(null);
    setCurrentTab('home');
    setSelectedStore(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  const handleTabChange = (tab: string) => {
    if (pendingUpdates > 0) {
        alert("Đang đồng bộ dữ liệu. Vui lòng chờ...");
        return;
    }
    setCurrentTab(tab);
    setSelectedStore(null);
  };

  const handleProcessStart = () => setPendingUpdates(prev => prev + 1);
  const handleProcessEnd = () => setPendingUpdates(prev => Math.max(0, prev - 1));

  const canAccess = (module: keyof UserPermissions | 'users' | 'home') => {
      if (module === 'home') return true;
      if (user.role === 'admin') return true;
      if (module === 'users') return false; 
      const perm = user.permissions?.[module as keyof UserPermissions];
      if (perm) return perm !== 'none';
      const role = (user.role || '').toLowerCase();
      if (module === 'dashboard') return true;
      if (module === 'orders') return !role.includes('designer');
      if (module === 'designer') return role.includes('designer') || role === 'leader';
      if (module === 'designerOnline') return role === 'designer online' || role === 'leader';
      if (module === 'customers') return true;
      if (module === 'finance') return role === 'leader';
      if (module === 'system') return role === 'admin'; 
      return false;
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'home':
        return <Home user={user} onTabChange={handleTabChange} />;
      case 'dashboard':
        if (!canAccess('dashboard')) return <div className="p-6">Không có quyền truy cập.</div>;
        if (selectedStore) return <StoreDetail store={selectedStore} onBack={() => setSelectedStore(null)} />;
        return <Dashboard user={user} onSelectStore={setSelectedStore} />;
      case 'orders':
        if (!canAccess('orders')) return <div className="p-6">Không có quyền truy cập.</div>;
        return <OrderList user={user} onProcessStart={handleProcessStart} onProcessEnd={handleProcessEnd} />;
      case 'designer_online':
        if (!canAccess('designerOnline')) return <div className="p-6">Không có quyền truy cập.</div>;
        return <DesignerOnlineList user={user} onProcessStart={handleProcessStart} onProcessEnd={handleProcessEnd} />;
      case 'designer':
        if (!canAccess('designer')) return <div className="p-6">Không có quyền truy cập.</div>;
        return <DesignerList user={user} onProcessStart={handleProcessStart} onProcessEnd={handleProcessEnd} />;
      case 'finance':
        if (!canAccess('finance')) return <div className="p-6">Không có quyền truy cập.</div>;
        return <FinanceBoard />;
      case 'users':
        return user.role === 'admin' ? <UserManagement /> : <div className="p-6">Không có quyền truy cập.</div>;
      default:
        return <div className="flex items-center justify-center h-full text-gray-400 text-lg">Trang đang phát triển.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex text-gray-800 font-sans">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        currentTab={currentTab}
        setCurrentTab={handleTabChange}
        user={user}
        onLogout={handleLogout}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        isDesktopCollapsed={isDesktopCollapsed}
        setIsDesktopCollapsed={setIsDesktopCollapsed}
      />
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isDesktopCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="bg-white h-16 shadow-sm flex items-center justify-between px-4 lg:hidden sticky top-0 z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-md hover:bg-gray-100 text-gray-600"><Menu size={24} /></button>
          <span className="font-bold text-gray-700 uppercase tracking-wider">OMS Team 3T</span>
          <div className="w-8"></div>
        </div>
        <main className="flex-1 overflow-y-auto custom-scrollbar">{renderContent()}</main>
        <footer className="bg-white border-t border-gray-200 py-4 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">© OMS v5.0 | Team 3T</footer>
      </div>
      {isChangePasswordOpen && <ChangePasswordModal user={user} onClose={() => setIsChangePasswordOpen(false)} onSuccess={() => {}} />}
    </div>
  );
}

export default App;
