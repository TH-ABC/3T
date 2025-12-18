
import React, { useState, useEffect } from 'react';
import { sheetService } from '../services/sheetService';
import { User, Role, UserPermissions, ViewScope } from '../types';
import { 
  UserPlus, Plus, Save, CheckCircle, AlertCircle, Loader2, 
  Mail, Phone, User as UserIcon, Lock, Shield, List, 
  Settings, Eye, Check, X, UserCog, Key, Briefcase, Info 
} from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // Default permissions
  const defaultPermissions: UserPermissions = {
      canManageSku: false,
      dashboard: 'all',
      orders: 'none',
      designer: 'none',
      designerOnline: 'none',
      customers: 'none',
      finance: 'none',
      system: 'none'
  };

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'support',
    permissions: { ...defaultPermissions }
  });

  const [editPerms, setEditPerms] = useState<UserPermissions>({ ...defaultPermissions });
  const [newRoleData, setNewRoleData] = useState({ name: '', level: 5 });

  const loadData = async () => {
    setLoading(true);
    try {
        const [userData, roleData] = await Promise.all([
            sheetService.getUsers(),
            sheetService.getRoles()
        ]);
        setUsers(Array.isArray(userData) ? userData : []);
        setRoles(Array.isArray(roleData) ? roleData : []);
    } catch (e) {
        console.error("Failed to load data", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleCreatePermChange = (key: keyof UserPermissions, value: any) => {
      setFormData(prev => ({
          ...prev,
          permissions: { ...prev.permissions, [key]: value }
      }));
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.fullName) {
      setStatus({ type: 'error', message: 'Vui lòng điền các trường bắt buộc (*).' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await sheetService.createUser({
          ...formData,
          permissions: formData.permissions
      });

      if (response.success) {
        setStatus({ type: 'success', message: 'Tạo tài khoản thành công!' });
        setFormData({ 
            username: '', password: '', fullName: '', email: '', phone: '', role: 'support', 
            permissions: { ...defaultPermissions } 
        });
        loadData();
        setTimeout(() => {
            setIsCreateModalOpen(false);
            setStatus({ type: null, message: '' });
        }, 1500);
      } else {
        setStatus({ type: 'error', message: response.error || 'Có lỗi xảy ra.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Lỗi kết nối hệ thống.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRole = async () => {
      if (!newRoleData.name) return;
      setIsSubmitting(true);
      try {
          await sheetService.addRole(newRoleData.name, newRoleData.level);
          setNewRoleData({ name: '', level: 5 });
          const roleData = await sheetService.getRoles();
          setRoles(roleData);
      } catch (e) {
          alert('Lỗi thêm Role');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleUpdateRole = async (username: string, newRole: string) => {
      const updatedUsers = users.map(u => u.username === username ? { ...u, role: newRole } : u);
      setUsers(updatedUsers);
      try { await sheetService.updateUser(username, newRole, undefined); } catch (e) { loadData(); }
  };

  const handleUpdateStatus = async (username: string, newStatus: string) => {
      const updatedUsers = users.map(u => u.username === username ? { ...u, status: newStatus } : u);
      setUsers(updatedUsers);
      try { await sheetService.updateUser(username, undefined, newStatus); } catch (e) { loadData(); }
  };

  const openPermModal = (user: User) => {
      setSelectedUser(user);
      setEditPerms({
          canManageSku: user.permissions?.canManageSku || false,
          dashboard: user.permissions?.dashboard || 'none',
          orders: user.permissions?.orders || 'none',
          designer: user.permissions?.designer || 'none',
          designerOnline: user.permissions?.designerOnline || 'none',
          customers: user.permissions?.customers || 'none',
          finance: user.permissions?.finance || 'none',
          system: user.permissions?.system || 'none',
      });
      setIsPermModalOpen(true);
  };

  const handleSavePerms = async () => {
      if (!selectedUser) return;
      setIsSubmitting(true);
      try {
          await sheetService.updateUser(selectedUser.username, undefined, undefined, editPerms);
          setUsers(prev => prev.map(u => u.username === selectedUser.username ? { ...u, permissions: editPerms } : u));
          setIsPermModalOpen(false);
      } catch (e) {
          alert("Lỗi cập nhật quyền hạn.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const permissionGroups = [
      { key: 'dashboard', label: 'Trang Chủ' },
      { key: 'orders', label: 'Đơn Hàng' },
      { key: 'designerOnline', label: 'Design Online' },
      { key: 'designer', label: 'Designer' },
      { key: 'customers', label: 'Khách Hàng' },
      { key: 'finance', label: 'Tài Chính' },
      { key: 'system', label: 'Hệ Thống' }
  ];

  // Fixed input class: White background, Dark text (text-gray-900), Gray-400 placeholder
  const inputClass = "w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all bg-white text-gray-900 placeholder-gray-400 shadow-sm outline-none";
  const selectClass = "w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm bg-white text-gray-900 cursor-pointer transition-all shadow-sm outline-none";

  return (
    <div className="p-6 bg-gray-50/50 min-h-full">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header with Tabs */}
        <div className="border-b border-gray-100 bg-gray-50 flex justify-between items-center px-6 pt-4">
            <div className="flex space-x-6">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'users' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                    <List size={18} /> Danh Sách Nhân Sự
                </button>
                <button 
                    onClick={() => setActiveTab('roles')}
                    className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'roles' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                    <Settings size={18} /> Cấu Hình Role
                </button>
            </div>
            
            {activeTab === 'users' && (
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mb-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95 hover:shadow-indigo-500/20"
                >
                    <UserPlus size={18} />
                    <span>Cấp Tài Khoản</span>
                </button>
            )}
        </div>

        {/* --- USERS TAB --- */}
        {activeTab === 'users' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b border-gray-200 text-[11px] uppercase text-gray-400 font-bold tracking-wider">
                            <th className="px-6 py-4">Username</th>
                            <th className="px-6 py-4">Họ và tên</th>
                            <th className="px-6 py-4">Vai trò</th>
                            <th className="px-6 py-4 text-center">Trạng thái</th>
                            <th className="px-6 py-4 text-center">Phân Quyền</th>
                            <th className="px-6 py-4">Liên hệ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading ? (
                            <tr><td colSpan={6} className="p-12 text-center text-gray-400 italic">Đang tải danh sách nhân sự...</td></tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.username} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-mono font-bold text-indigo-600">{user.username}</td>
                                    <td className="px-6 py-4 text-gray-700 font-medium">{user.fullName}</td>
                                    <td className="px-6 py-4">
                                        <select 
                                            className="bg-white border border-gray-200 text-gray-600 text-xs rounded-md px-2 py-1 outline-none cursor-pointer focus:border-indigo-400"
                                            value={user.role}
                                            onChange={(e) => handleUpdateRole(user.username, e.target.value)}
                                        >
                                            {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <select
                                            className={`text-[10px] font-bold px-2 py-1 rounded-full border cursor-pointer outline-none appearance-none text-center ${
                                                user.status === 'Active' 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}
                                            value={user.status || 'Active'}
                                            onChange={(e) => handleUpdateStatus(user.username, e.target.value)}
                                        >
                                            <option value="Active">Hoạt động</option>
                                            <option value="Inactive">Khóa</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => openPermModal(user)} 
                                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors mx-auto text-xs font-bold border border-indigo-100"
                                        >
                                            <Shield size={14} /> Cấu hình
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-[11px] text-gray-500">
                                        <div className="font-medium">{user.email || '---'}</div>
                                        <div>{user.phone || '---'}</div>
                                    </td>
                                </tr>
                            ))
                        )}
                        {!loading && users.length === 0 && (
                            <tr><td colSpan={6} className="p-12 text-center text-gray-400 italic">Chưa có nhân sự nào được tạo.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {/* --- ROLES TAB --- */}
        {activeTab === 'roles' && (
            <div className="p-6">
                <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex gap-6 items-end shadow-sm">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-2 tracking-widest">Tên Vai Trò Mới</label>
                        <input type="text" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" placeholder="Ví dụ: Marketing, Accountant..." value={newRoleData.name} onChange={(e) => setNewRoleData({...newRoleData, name: e.target.value})} />
                    </div>
                    <div className="w-40">
                        <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-2 tracking-widest">Cấp Độ (1-5)</label>
                        <select className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm cursor-pointer outline-none focus:border-indigo-500 transition-all bg-white" value={newRoleData.level} onChange={(e) => setNewRoleData({...newRoleData, level: Number(e.target.value)})}>
                            <option value={1}>1 (Quản trị cao)</option>
                            <option value={2}>2 (Quản lý)</option>
                            <option value={3}>3 (Điều hành)</option>
                            <option value={4}>4 (Nhân viên)</option>
                            <option value={5}>5 (Hợp tác viên)</option>
                        </select>
                    </div>
                    <button onClick={handleAddRole} disabled={isSubmitting} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 h-[44px] flex items-center gap-2 active:scale-95 disabled:opacity-50">
                        <Plus size={18} /> Thêm Vai Trò
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5].map(level => {
                        const levelRoles = roles.filter(r => Number(r.level) === level);
                        return (
                            <div key={level} className="bg-gray-50/50 border border-gray-200 rounded-xl p-5 hover:border-indigo-200 transition-all group">
                                <h4 className="font-bold text-gray-700 border-b border-gray-100 pb-3 mb-4 flex justify-between items-center">
                                    <span className="text-xs uppercase tracking-wider">Cấp Độ {level}</span>
                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{levelRoles.length} roles</span>
                                </h4>
                                <div className="space-y-2">
                                    {levelRoles.map(role => (
                                        <div key={role.name} className="bg-white p-3 rounded-lg border border-gray-100 text-xs font-bold text-gray-600 shadow-sm group-hover:shadow transition-all flex items-center justify-between">
                                            {role.name}
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                        </div>
                                    ))}
                                    {levelRoles.length === 0 && <p className="text-[10px] text-gray-400 italic text-center py-2">Chưa có vai trò nào.</p>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}
      </div>

      {/* MODAL CONFIG PERMISSIONS */}
      {isPermModalOpen && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <div>
                          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                              <Shield className="text-indigo-600" size={20} />
                              Cấu Hình Quyền: <span className="text-indigo-600">{selectedUser.username}</span>
                          </h3>
                          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Kiểm soát phạm vi truy cập dữ liệu theo từng Module</p>
                      </div>
                      <button onClick={() => setIsPermModalOpen(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"><X size={22} /></button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                        {permissionGroups.map((item) => (
                            <div key={item.key} className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className={`cursor-pointer border rounded-lg px-2 py-2 text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1.5 ${editPerms[item.key as keyof UserPermissions] === 'all' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                                        <input type="radio" name={item.key} className="hidden" checked={editPerms[item.key as keyof UserPermissions] === 'all'} onChange={() => setEditPerms({...editPerms, [item.key]: 'all'})} />
                                        Tất cả
                                    </label>
                                    <label className={`cursor-pointer border rounded-lg px-2 py-2 text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1.5 ${editPerms[item.key as keyof UserPermissions] === 'own' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-300'}`}>
                                        <input type="radio" name={item.key} className="hidden" checked={editPerms[item.key as keyof UserPermissions] === 'own'} onChange={() => setEditPerms({...editPerms, [item.key]: 'own'})} />
                                        Cá nhân
                                    </label>
                                    <label className={`cursor-pointer border rounded-lg px-2 py-2 text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1.5 ${editPerms[item.key as keyof UserPermissions] === 'none' ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-gray-500 border-gray-200 hover:border-rose-300'}`}>
                                        <input type="radio" name={item.key} className="hidden" checked={editPerms[item.key as keyof UserPermissions] === 'none' || !editPerms[item.key as keyof UserPermissions]} onChange={() => setEditPerms({...editPerms, [item.key]: 'none'})} />
                                        Khóa
                                    </label>
                                </div>
                            </div>
                        ))}
                      </div>

                      <div className="mt-8 pt-6 border-t border-gray-100">
                          <label className="flex items-center gap-4 cursor-pointer group w-fit">
                              <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${editPerms.canManageSku ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-gray-50 border-gray-200'}`}>
                                  {editPerms.canManageSku && <Check size={16} strokeWidth={3} />}
                              </div>
                              <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={editPerms.canManageSku} 
                                  onChange={() => setEditPerms({...editPerms, canManageSku: !editPerms.canManageSku})} 
                              />
                              <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Quyền Quản lý SKU / Phân loại giá</span>
                          </label>
                      </div>
                  </div>

                  <div className="bg-gray-50/80 px-6 py-5 flex justify-end gap-3 border-t border-gray-100">
                      <button onClick={() => setIsPermModalOpen(false)} disabled={isSubmitting} className="px-6 py-2.5 text-gray-500 hover:text-gray-700 font-bold text-xs uppercase tracking-wider transition-all">Hủy</button>
                      <button onClick={handleSavePerms} disabled={isSubmitting} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                          {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                          Lưu Cấu Hình
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL CREATE USER - IMPROVED UI AND VISIBILITY */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-gray-100">
                
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                            <UserPlus size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-800 tracking-tight">Cấp Tài Khoản Mới</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Khởi tạo quyền truy cập hệ thống OMS 3T</p>
                        </div>
                    </div>
                    <button 
                      onClick={() => setIsCreateModalOpen(false)} 
                      className="p-2.5 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                    >
                      <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmitUser} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                        {status.message && (
                            <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold mb-8 animate-slide-in ${
                                status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                                {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                                <span>{status.message}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            {/* Left Side: Account Info */}
                            <div className="lg:col-span-5 space-y-8">
                                <section className="space-y-5">
                                    <div className="flex items-center gap-2 border-l-4 border-indigo-500 pl-3">
                                      <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Đăng nhập</h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-[11px] font-bold text-gray-500 ml-1 uppercase">Username *</label>
                                            <div className="relative group">
                                                <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                                <input 
                                                  type="text" 
                                                  name="username" 
                                                  value={formData.username} 
                                                  onChange={handleChange} 
                                                  className={inputClass} 
                                                  placeholder="Nhập tên đăng nhập..." 
                                                  required 
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[11px] font-bold text-gray-500 ml-1 uppercase">Mật khẩu *</label>
                                            <div className="relative group">
                                                <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                                <input 
                                                  type="password" 
                                                  name="password" 
                                                  value={formData.password} 
                                                  onChange={handleChange} 
                                                  className={inputClass} 
                                                  placeholder="Nhập mật khẩu..." 
                                                  required 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-[11px] font-bold text-gray-500 ml-1 uppercase">Vai trò chính (Role)</label>
                                        <div className="relative group">
                                            <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                            <select name="role" value={formData.role} onChange={handleChange} className={selectClass}>
                                                {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </section>
                                
                                <section className="space-y-5">
                                    <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
                                      <h4 className="text-[11px] font-black text-orange-600 uppercase tracking-widest">Liên hệ</h4>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-[11px] font-bold text-gray-500 ml-1 uppercase">Họ và Tên đầy đủ *</label>
                                        <div className="relative group">
                                            <UserCog size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input 
                                              type="text" 
                                              name="fullName" 
                                              value={formData.fullName} 
                                              onChange={handleChange} 
                                              className={inputClass} 
                                              placeholder="Nhập họ và tên..." 
                                              required 
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-[11px] font-bold text-gray-500 ml-1 uppercase">Email</label>
                                            <div className="relative group">
                                                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input 
                                                  type="email" 
                                                  name="email" 
                                                  value={formData.email} 
                                                  onChange={handleChange} 
                                                  className={inputClass} 
                                                  placeholder="email@3t.com" 
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[11px] font-bold text-gray-500 ml-1 uppercase">Số điện thoại</label>
                                            <div className="relative group">
                                                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input 
                                                  type="tel" 
                                                  name="phone" 
                                                  value={formData.phone} 
                                                  onChange={handleChange} 
                                                  className={inputClass} 
                                                  placeholder="0912..." 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Right Side: Permissions Grid */}
                            <div className="lg:col-span-7 space-y-6">
                                <div className="flex items-center gap-2 border-l-4 border-indigo-500 pl-3 mb-4">
                                  <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Phân quyền module</h4>
                                </div>
                                
                                <div className="bg-gray-50/80 border border-gray-200 rounded-3xl p-7 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                                    {permissionGroups.map((item) => (
                                        <div key={item.key} className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{item.label}</label>
                                            <select 
                                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-xs bg-white font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer shadow-sm"
                                                value={formData.permissions[item.key as keyof UserPermissions] as string}
                                                onChange={(e) => handleCreatePermChange(item.key as keyof UserPermissions, e.target.value)}
                                            >
                                                <option value="none" className="text-gray-400">--- Khóa ---</option>
                                                <option value="own">Chỉ cá nhân</option>
                                                <option value="all">Toàn team</option>
                                            </select>
                                        </div>
                                    ))}
                                    
                                    <div className="sm:col-span-2 pt-6 mt-2 border-t border-gray-200">
                                        <label className="flex items-center gap-4 cursor-pointer group w-fit">
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.permissions.canManageSku ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-300'}`}>
                                                {formData.permissions.canManageSku && <Check size={14} strokeWidth={4} />}
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                className="hidden" 
                                                checked={formData.permissions.canManageSku} 
                                                onChange={() => handleCreatePermChange('canManageSku', !formData.permissions.canManageSku)}
                                            />
                                            <span className="text-xs font-black text-gray-700 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">Cấp quyền Quản lý SKU / Bảng Giá</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-3 p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <Info className="text-blue-500 flex-shrink-0" size={20} />
                                    <p className="text-[11px] text-blue-700 font-medium leading-relaxed italic">
                                        Lưu ý: Quyền "Chỉ cá nhân" giới hạn người dùng chỉ thấy các đơn hàng họ trực tiếp xử lý hoặc được gán trách nhiệm.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-4 sticky bottom-0">
                        <button 
                          type="button" 
                          onClick={() => setIsCreateModalOpen(false)} 
                          className="px-6 py-3 text-gray-500 hover:text-gray-800 font-black text-xs uppercase tracking-widest transition-all"
                        >
                          Hủy bỏ
                        </button>
                        <button 
                          type="submit" 
                          disabled={isSubmitting} 
                          className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all shadow-xl shadow-indigo-600/30 active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            <span>Lưu Tài Khoản</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
