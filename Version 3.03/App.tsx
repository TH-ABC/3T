
import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
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
  // Khởi tạo user từ localStorage nếu có
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('oms_user_session');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      return null;
    }
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false); // New state for desktop collapse
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  
  // State tracking background processes (to block navigation)
  const [pendingUpdates, setPendingUpdates] = useState(0);

  // State for Change Password Modal
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Auto redirect logic for restricted roles on load/login
  useEffect(() => {
    if (user) {
      const role = (user.role || '').toLowerCase();
      // Only redirect if no specific permissions set AND role is restricted
      // If permissions exist, let Sidebar handle visibility and user choose
      const hasSpecificPermissions = user.permissions && Object.keys(user.permissions).length > 0;
      
      if (!hasSpecificPermissions) {
          if (role === 'designer online') {
            setCurrentTab('designer_online');
          } else if (role === 'designer') {
            setCurrentTab('designer');
          }
      } else {
          // If has permission but current tab is dashboard (default), verify if they can access it
          // Check if dashboard is forbidden
          if (user.permissions?.dashboard === 'none') {
              // Find first available tab
              if(user.permissions?.orders !== 'none') setCurrentTab('orders');
              else if(user.permissions?.designerOnline !== 'none') setCurrentTab('designer_online');
              else if(user.permissions?.designer !== 'none') setCurrentTab('designer');
              else if(user.permissions?.customers !== 'none') setCurrentTab('customers');
              else if(user.permissions?.finance !== 'none') setCurrentTab('finance');
          }
      }
    }
  }, [user]);

  // Prevent closing tab if updates are pending
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingUpdates > 0) {
        // Standard way to trigger browser confirmation dialog
        e.preventDefault();
        e.returnValue = ''; 
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pendingUpdates]);

  // Hàm xử lý đăng nhập thành công
  const handleLogin = (userData: User) => {
    // Lưu vào localStorage
    localStorage.setItem('oms_user_session', JSON.stringify(userData));
    setUser(userData);
    
    // Auto redirect logic handled by useEffect above
    setCurrentTab('dashboard');
  };

  // Hàm xử lý đăng xuất
  const handleLogout = () => {
    if (pendingUpdates > 0) {
        alert("Đang có dữ liệu đang được cập nhật. Vui lòng chờ hoàn tất trước khi đăng xuất.");
        return;
    }
    // Xóa khỏi localStorage
    localStorage.removeItem('oms_user_session');
    setUser(null);
    setCurrentTab('dashboard');
    setSelectedStore(null);
  };

  // Nếu chưa đăng nhập, hiển thị màn hình Login
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const handleTabChange = (tab: string) => {
    if (pendingUpdates > 0) {
        alert("Hệ thống đang đồng bộ dữ liệu (Update). Vui lòng chờ biểu tượng xoay hoàn tất trước khi chuyển trang.");
        return;
    }
    setCurrentTab(tab);
    setSelectedStore(null); // Reset store detail when changing tabs
  };

  // Helpers for child components to register/unregister background tasks
  const handleProcessStart = () => setPendingUpdates(prev => prev + 1);
  const handleProcessEnd = () => setPendingUpdates(prev => Math.max(0, prev - 1));

  // Determine Access based on Permissions
  const canAccess = (module: keyof UserPermissions | 'users') => {
      if (user.role === 'admin') return true;
      if (module === 'users') return false; // Admin only

      const perm = user.permissions?.[module as keyof UserPermissions];
      if (perm) return perm !== 'none';
      
      // Fallback
      const role = (user.role || '').toLowerCase();
      if (module === 'dashboard') return true;
      if (module === 'orders') return role !== 'designer' && role !== 'designer online';
      if (module === 'designer') return role === 'designer' || role === 'leader';
      if (module === 'designerOnline') return role === 'designer online' || role === 'leader';
      if (module === 'customers') return true;
      if (module === 'finance') return role === 'leader';
      if (module === 'system') return role === 'admin'; // Fallback for settings
      return false;
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        if (!canAccess('dashboard')) return <div className="p-6">Bạn không có quyền truy cập Trang chủ.</div>;
        if (selectedStore) {
            return <StoreDetail store={selectedStore} onBack={() => setSelectedStore(null)} />;
        }
        return <Dashboard user={user} onSelectStore={setSelectedStore} />;
      case 'orders':
        if (!canAccess('orders')) return <div className="p-6">Bạn không có quyền truy cập.</div>;
        return <OrderList 
            user={user} 
            onProcessStart={handleProcessStart} 
            onProcessEnd={handleProcessEnd} 
        />;
      case 'designer_online':
        if (!canAccess('designerOnline')) return <div className="p-6">Bạn không có quyền truy cập.</div>;
        return <DesignerOnlineList 
            user={user}
            onProcessStart={handleProcessStart}
            onProcessEnd={handleProcessEnd}
        />;
      case 'designer':
        if (!canAccess('designer')) return <div className="p-6">Bạn không có quyền truy cập.</div>;
        return <DesignerList 
            user={user}
            onProcessStart={handleProcessStart}
            onProcessEnd={handleProcessEnd}
        />;
      case 'customers':
        if (!canAccess('customers')) return <div className="p-6">Bạn không có quyền truy cập.</div>;
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg font-medium">Quản lý Khách Hàng</p>
            <p className="text-sm">Chức năng đang phát triển.</p>
          </div>
        );
      case 'finance':
        if (!canAccess('finance')) return <div className="p-6">Bạn không có quyền truy cập Tài chính.</div>;
        return <FinanceBoard />;
      case 'reports':
        if (!canAccess('finance')) return <div className="p-6">Bạn không có quyền truy cập Báo cáo.</div>;
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg font-medium">Báo Cáo Lãi Lỗ</p>
            <p className="text-sm">Chức năng đang phát triển.</p>
          </div>
        );
      case 'settings':
        if (!canAccess('system')) return <div className="p-6">Bạn không có quyền truy cập Cấu hình.</div>;
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg font-medium">Cấu hình Hệ thống</p>
            <p className="text-sm">Chức năng đang phát triển.</p>
          </div>
        );
      case 'users':
        return user.role === 'admin' ? <UserManagement /> : <div className="p-6">Bạn không có quyền truy cập.</div>;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-lg font-medium">404 - Không tìm thấy trang</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex text-gray-800 font-sans">
      {/* Sidebar */}
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

      {/* Main Content Wrapper */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isDesktopCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        
        {/* Top Navbar for Mobile */}
        <div className="bg-white h-16 shadow-sm flex items-center justify-between px-4 lg:hidden sticky top-0 z-10">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-gray-700">OMS Dashboard</span>
          <div className="w-8"></div> {/* Spacer for center alignment visually */}
        </div>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {renderContent()}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-500">
          <p>© TH </p>
        </footer>
      </div>

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <ChangePasswordModal 
          user={user} 
          onClose={() => setIsChangePasswordOpen(false)} 
          onSuccess={() => {
            // Optional: Logout user after password change or just show success
            // setIsChangePasswordOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
