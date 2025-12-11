
import React, { useState, useEffect } from 'react';
import { sheetService } from '../services/sheetService';
import { User, Role, UserPermissions, ViewScope } from '../types';
import { UserPlus, Save, CheckCircle, AlertCircle, Loader2, Mail, Phone, User as UserIcon, Lock, Shield, List, Settings, Eye, Check, X } from 'lucide-react';

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
      dashboard: 'all', // Default open for Dashboard
      orders: 'none',
      designer: 'none',
      designerOnline: 'none',
      customers: 'none',
      finance: 'none',
      system: 'none'
  };

  // Form data for creating new user
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    role: 'support',
    permissions: { ...defaultPermissions }
  });

  // State for editing permissions
  const [editPerms, setEditPerms] = useState<UserPermissions>({ ...defaultPermissions });

  // Form data for adding new role
  const [newRoleData, setNewRoleData] = useState({ name: '', level: 5 });

  const loadData = async () => {
    setLoading(true);
    try {
        const [userData, roleData] = await Promise.all([
            sheetService.getUsers(),
            sheetService.getRoles()
        ]);
        setUsers(userData);
        setRoles(roleData);
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

  // Handle permission change in Create Form
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
        setTimeout(() => setIsCreateModalOpen(false), 1500);
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
          
          // Optimistic update
          setUsers(prev => prev.map(u => u.username === selectedUser.username ? { ...u, permissions: editPerms } : u));
          
          setIsPermModalOpen(false);
      } catch (e) {
          alert("Lỗi cập nhật quyền hạn.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // Define Permission Config Groups
  const permissionGroups = [
      { key: 'dashboard', label: 'Trang Chủ / Dashboard' },
      { key: 'orders', label: 'Quản Lý Đơn Hàng' },
      { key: 'designerOnline', label: 'Designer Online' },
      { key: 'designer', label: 'Designer' },
      { key: 'customers', label: 'Khách Hàng' },
      { key: 'finance', label: 'Tài Chính (Sổ Quỹ)' },
      { key: 'system', label: 'Cấu Hình Hệ Thống' }
  ];

  const inputClass = "w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm";
  const selectClass = "w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm bg-white";

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header with Tabs */}
        <div className="border-b border-gray-100 bg-gray-50 flex justify-between items-center px-5 pt-4">
            <div className="flex space-x-4">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'text-orange-600 border-orange-500' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                >
                    <List size={18} /> Danh Sách User
                </button>
                <button 
                    onClick={() => setActiveTab('roles')}
                    className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'roles' ? 'text-orange-600 border-orange-500' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                >
                    <Settings size={18} /> Cấu Hình Role
                </button>
            </div>
            
            {activeTab === 'users' && (
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mb-2 flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                    <UserPlus size={16} />
                    <span>Thêm User</span>
                </button>
            )}
        </div>

        {/* --- USERS TAB --- */}
        {activeTab === 'users' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                            <th className="px-6 py-4">Username</th>
                            <th className="px-6 py-4">Họ và tên</th>
                            <th className="px-6 py-4">Vai trò (Role)</th>
                            <th className="px-6 py-4 text-center">Trạng thái</th>
                            <th className="px-6 py-4 text-center">Phân Quyền</th>
                            <th className="px-6 py-4">Liên hệ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-500">Đang tải danh sách...</td></tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.username} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-bold text-gray-800">{user.username}</td>
                                    <td className="px-6 py-4 text-gray-700">{user.fullName}</td>
                                    <td className="px-6 py-4">
                                        <select 
                                            className="bg-white border border-gray-300 text-gray-700 text-xs rounded-md px-2 py-1 focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                                            value={user.role}
                                            onChange={(e) => handleUpdateRole(user.username, e.target.value)}
                                        >
                                            {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <select
                                            className={`text-xs font-bold px-2 py-1 rounded-full border cursor-pointer outline-none appearance-none text-center ${
                                                user.status === 'Active' 
                                                ? 'bg-green-100 text-green-700 border-green-200' 
                                                : 'bg-red-100 text-red-700 border-red-200'
                                            }`}
                                            value={user.status || 'Active'}
                                            onChange={(e) => handleUpdateStatus(user.username, e.target.value)}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Locked</option>
                                        </select>
                                    </td>
                                    {/* Config Permission Column */}
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => openPermModal(user)} 
                                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors mx-auto text-xs font-medium border border-blue-200"
                                        >
                                            <Shield size={14} /> Cấu hình
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        <div>{user.email}</div>
                                        <div>{user.phone}</div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {/* --- ROLES TAB --- */}
        {activeTab === 'roles' && (
            <div className="p-6">
                <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên Role Mới</label>
                        <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Ví dụ: Marketing..." value={newRoleData.name} onChange={(e) => setNewRoleData({...newRoleData, name: e.target.value})} />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cấp Độ (1-5)</label>
                        <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm" value={newRoleData.level} onChange={(e) => setNewRoleData({...newRoleData, level: Number(e.target.value)})}>
                            <option value={1}>1 (Cao nhất)</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                            <option value={5}>5 (Thấp nhất)</option>
                        </select>
                    </div>
                    <button onClick={handleAddRole} disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-blue-700 transition-colors h-[38px]">
                        Thêm Role
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5].map(level => {
                        const levelRoles = roles.filter(r => Number(r.level) === level);
                        return (
                            <div key={level} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <h4 className="font-bold text-gray-700 border-b border-gray-200 pb-2 mb-3 flex justify-between">
                                    Cấp Độ {level}
                                    <span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{levelRoles.length} roles</span>
                                </h4>
                                <div className="space-y-2">
                                    {levelRoles.map(role => (
                                        <div key={role.name} className="bg-white p-2 rounded border border-gray-100 text-sm font-medium text-gray-600 shadow-sm">
                                            {role.name}
                                        </div>
                                    ))}
                                    {levelRoles.length === 0 && <p className="text-xs text-gray-400 italic">Chưa có role nào.</p>}
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
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                          <Shield className="text-blue-600" size={20} />
                          Phân Quyền: {selectedUser.username}
                      </h3>
                      <button onClick={() => setIsPermModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  <div className="p-6 space-y-6">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Permission Groups */}
                        {permissionGroups.map((item) => (
                            <div key={item.key} className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-gray-700">{item.label}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className={`cursor-pointer border rounded px-2 py-2 text-[11px] font-medium text-center transition-colors flex items-center justify-center gap-1 ${editPerms[item.key as keyof UserPermissions] === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                        <input type="radio" name={item.key} className="hidden" checked={editPerms[item.key as keyof UserPermissions] === 'all'} onChange={() => setEditPerms({...editPerms, [item.key]: 'all'})} />
                                        <Eye size={12} /> Tất cả
                                    </label>
                                    <label className={`cursor-pointer border rounded px-2 py-2 text-[11px] font-medium text-center transition-colors flex items-center justify-center gap-1 ${editPerms[item.key as keyof UserPermissions] === 'own' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                        <input type="radio" name={item.key} className="hidden" checked={editPerms[item.key as keyof UserPermissions] === 'own'} onChange={() => setEditPerms({...editPerms, [item.key]: 'own'})} />
                                        <UserIcon size={12} /> Cá nhân
                                    </label>
                                    <label className={`cursor-pointer border rounded px-2 py-2 text-[11px] font-medium text-center transition-colors flex items-center justify-center gap-1 ${editPerms[item.key as keyof UserPermissions] === 'none' ? 'bg-gray-200 text-gray-500 border-gray-200' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                        <input type="radio" name={item.key} className="hidden" checked={editPerms[item.key as keyof UserPermissions] === 'none' || !editPerms[item.key as keyof UserPermissions]} onChange={() => setEditPerms({...editPerms, [item.key]: 'none'})} />
                                        <X size={12} /> Không
                                    </label>
                                </div>
                            </div>
                        ))}
                      </div>

                      {/* Extra Toggles */}
                      <div className="pt-4 border-t border-gray-100">
                          <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${editPerms.canManageSku ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-gray-300'}`}>
                                  {editPerms.canManageSku && <Check size={14} />}
                              </div>
                              <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={editPerms.canManageSku} 
                                  onChange={() => setEditPerms({...editPerms, canManageSku: !editPerms.canManageSku})} 
                              />
                              <span className="text-sm font-medium text-gray-700">Cho phép quản lý SKU / Giá tiền</span>
                          </label>
                      </div>

                  </div>
                  <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                      <button onClick={() => setIsPermModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded text-sm transition-colors">Hủy</button>
                      <button onClick={handleSavePerms} disabled={isSubmitting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-bold transition-colors shadow-sm disabled:opacity-70">
                          {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                          <span>Lưu Cấu Hình</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL CREATE USER */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <UserPlus className="text-orange-500" size={20} />
                        Cấp Tài Khoản Mới
                    </h3>
                    <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <form onSubmit={handleSubmitUser} className="p-6 space-y-6">
                    {status.message && (
                        <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${
                        status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <span>{status.message}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* LEFT COL: Account Info */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-600 text-xs uppercase tracking-wider border-b pb-1">Đăng nhập</h4>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Username <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input type="text" name="username" value={formData.username} onChange={handleChange} className={inputClass} placeholder="user123" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Password <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input type="password" name="password" value={formData.password} onChange={handleChange} className={inputClass} placeholder="••••••" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                                <div className="relative">
                                    <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <select name="role" value={formData.role} onChange={handleChange} className={selectClass}>
                                        {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="pt-2">
                                <h4 className="font-semibold text-gray-600 text-xs uppercase tracking-wider border-b pb-1 mb-2">Thông tin</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Full Name <span className="text-red-500">*</span></label>
                                        <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className={inputClass.replace('pl-10', 'pl-3')} placeholder="Nguyễn Văn A" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                                        <div className="relative">
                                            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="email@example.com" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                                        <div className="relative">
                                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} placeholder="0912..." />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COL: Permissions */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-600 text-xs uppercase tracking-wider border-b pb-1">Phân Quyền Ban Đầu</h4>
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-100 max-h-[400px] overflow-y-auto">
                                {/* Permission Groups */}
                                {permissionGroups.map((item) => (
                                    <div key={item.key} className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-gray-700">{item.label}</label>
                                        <select 
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-orange-500"
                                            value={formData.permissions[item.key as keyof UserPermissions] as string}
                                            onChange={(e) => handleCreatePermChange(item.key as keyof UserPermissions, e.target.value)}
                                        >
                                            <option value="none">Không truy cập</option>
                                            <option value="own">Chỉ xem cá nhân</option>
                                            <option value="all">Xem tất cả</option>
                                        </select>
                                    </div>
                                ))}

                                <div className="pt-2 border-t border-gray-200 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.permissions.canManageSku} 
                                            onChange={() => handleCreatePermChange('canManageSku', !formData.permissions.canManageSku)}
                                            className="rounded text-orange-600 focus:ring-orange-500"
                                        />
                                        <span className="text-xs font-medium text-gray-600">Quyền quản lý SKU / Giá tiền</span>
                                    </label>
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400 italic">
                                * Nếu chọn "Chỉ xem cá nhân", user chỉ thấy đơn hàng được giao cho họ hoặc do họ tạo.
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm transition-colors">Hủy</button>
                        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-70">
                            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            <span>Lưu User</span>
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
