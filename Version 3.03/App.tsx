
import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import { OrderList } from './components/OrderList';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import StoreDetail from './components/StoreDetail';
import { DesignerOnlineList } from './components/DesignerOnlineList';
import { DesignerList } from './components/DesignerList';
import { FinanceBoard } from './components/FinanceBoard';
import FinanceDataReport from './components/FinanceDataReport';
import ChangePasswordModal from './components/ChangePasswordModal';
import ScheduleManagement from './components/ScheduleManagement';
import DailyHandover from './components/DailyHandover';
import { User, Store, UserPermissions, HandoverItem } from './types';
import { sheetService } from './services/sheetService';

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
  const [unreadTaskCount, setUnreadTaskCount] = useState(0);

  // --- LOGIC THÔNG BÁO NGOÀI ICON WEB (FAVICON BADGE) ---
  useEffect(() => {
    if (!user) {
      document.title = "Hệ Thống Quản Lý Order";
      return;
    }

    const updateWebIconNotification = async () => {
      try {
        // Lấy toàn bộ task để kiểm tra task mới chưa xem
        const handoverRes = await sheetService.getHandover("", user.fullName, user.role);
        if (Array.isArray(handoverRes)) {
          const newTasks = handoverRes.filter(item => 
            !item.isSeen && 
            item.status === 'Pending' && 
            item.assignee.toLowerCase() === user.fullName.toLowerCase()
          );
          
          const count = newTasks.length;
          setUnreadTaskCount(count);

          // Cập nhật Tiêu đề trang
          if (count > 0) {
            document.title = `(${count}) Công việc mới - OMS Team 3T`;
            drawFaviconBadge(count);
          } else {
            document.title = "OMS Team 3T";
            restoreFavicon();
          }
        }
      } catch (e) {
        console.error("Favicon update error:", e);
      }
    };

    const drawFaviconBadge = (count: number) => {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement || document.createElement('link');
      favicon.rel = 'icon';
      
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      // Sử dụng favicon mặc định hoặc icon hệ thống
      img.src = '/favicon.ico'; 
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 32, 32);
        
        // Vẽ vòng tròn đỏ
        ctx.beginPath();
        ctx.arc(24, 8, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        
        // Vẽ số lượng
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count > 9 ? '9+' : count.toString(), 24, 8);
        
        favicon.href = canvas.toDataURL('image/png');
        if (!document.querySelector('link[rel="icon"]')) {
          document.head.appendChild(favicon);
        }
      };
    };

    const restoreFavicon = () => {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) favicon.href = '/favicon.ico';
    };

    // Kiểm tra ngay khi login và mỗi 60 giây
    updateWebIconNotification();
    const interval = setInterval(updateWebIconNotification, 60000);

    return () => {
      clearInterval(interval);
      restoreFavicon();
    };
  }, [user]);

  // --- AUTOMATIC LOGOUT LOGIC (8 HOURS IDLE) ---
  useEffect(() => {
    if (!user) return;

    // Điều chỉnh: 8 giờ = 8 * 60 * 60 * 1000ms
    const IDLE_TIMEOUT = 8 * 60 * 60 * 1000; 
    let idleTimer: any;

    const resetTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        handleAutoLogout();
      }, IDLE_TIMEOUT);
    };

    const handleAutoLogout = async () => {
      try {
        await sheetService.logout(user.username, 'LOGOUT_INACTIVE_8H');
      } catch (e) {
        console.error("Logout log error:", e);
      }
      
      handleLogout();
      alert("Phiên làm việc đã hết hạn do bạn không tương tác trong 8 giờ. Vui lòng đăng nhập lại.");
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]);

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

  const canAccess = (module: keyof UserPermissions | 'users' | 'home' | 'schedule' | 'handover') => {
      if (module === 'home') return true;
      if (module === 'schedule') return true;
      if (user.role === 'admin') return true;
      if (module === 'users') return false; 
      const perm = user.permissions?.[module as keyof UserPermissions];
      if (perm) return perm !== 'none';
      const role = (user.role || '').toLowerCase();
      if (module === 'dashboard') return true;
      if (module === 'orders') return !role.includes('designer');
      if (module === 'handover') return true; 
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
      case 'handover':
        return <DailyHandover user={user} />;
      case 'designer_online':
        if (!canAccess('designerOnline')) return <div className="p-6">Không có quyền truy cập.</div>;
        return <DesignerOnlineList user={user} onProcessStart={handleProcessStart} onProcessEnd={handleProcessEnd} />;
      case 'designer':
        if (!canAccess('designer')) return <div className="p-6">Không có quyền truy cập.</div>;
        return <DesignerList user={user} onProcessStart={handleProcessStart} onProcessEnd={handleProcessEnd} />;
      case 'finance':
        if (!canAccess('finance')) return <div className="p-6">Không có quyền truy cập.</div>;
        return <FinanceBoard user={user} />;
      case 'finance_data':
        if (!canAccess('finance')) return <div className="p-6">Không có quyền truy cập.</div>;
        return <FinanceDataReport />;
      case 'schedule':
        return <ScheduleManagement user={user} />;
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
