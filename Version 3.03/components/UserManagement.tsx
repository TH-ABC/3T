
import React, { useState, useEffect } from 'react';
import { sheetService } from '../services/sheetService';
import { User, Role, UserPermissions, ViewScope, FinanceScope } from '../types';
import { 
  UserPlus, Plus, Save, CheckCircle, AlertCircle, Loader2, 
  Mail, Phone, User as UserIcon, Lock, Shield, List, 
  Settings, Eye, EyeOff, Check, X, UserCog, Key, Briefcase, Info,
  Sparkles, Trash2, DollarSign
} from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const defaultPermissions: UserPermissions = {
      canManageSku: false,
      canPostNews: false,
      canViewFinanceSummary: false,
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
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const togglePasswordVisibility = (username: string) => {
    setVisiblePasswords(prev => ({ ...prev, [username]: !prev[username] }));
  };

  const handleRoleChange = async (username: string, newRole: string) => {
    try {
        await sheetService.updateUser(username, newRole);
        setUsers(prev => prev.map(u => u.username === username ? { ...u, role: newRole } : u));
    } catch (e) {
        alert("Lỗi khi cập nhật vai trò.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.fullName) {
      setStatus({ type: 'error', message: 'Vui lòng điền các trường bắt buộc (*).' });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await sheetService.createUser({ ...formData });
      if (response.success) {
        setStatus({ type: 'success', message: 'Tạo tài khoản thành công!' });
        setFormData({ username: '', password: '', fullName: '', email: '', phone: '', role: 'support', permissions: { ...defaultPermissions } });
        loadData();
        setTimeout(() => {
            setIsCreateModalOpen(false);
            setStatus({ type: null, message: '' });
        }, 1500);
      } else setStatus({ type: 'error', message: response.error || 'Có lỗi xảy ra.' });
    } catch (error) { setStatus({ type: 'error', message: 'Lỗi kết nối.' }); } 
    finally { setIsSubmitting(false); }
  };

  const handleAddRole = async () => {
    if (!newRoleData.name) return;
    setIsSubmitting(true);
    try {
        await sheetService.addRole(newRoleData.name, newRoleData.level);
        await loadData();
        setIsAddRoleModalOpen(false);
        setNewRoleData({ name: '', level: 5 });
    } catch (e) { alert("Lỗi khi thêm role."); }
    finally { setIsSubmitting(false); }
  };

  const openPermModal = (user: User) => {
      setSelectedUser(user);
      setEditPerms({
          canManageSku: user.permissions?.canManageSku || false,
          canPostNews: user.permissions?.canPostNews || false,
          canViewFinanceSummary: user.permissions?.canViewFinanceSummary || false,
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
      } catch (e) { alert("Lỗi cập nhật quyền."); } 
      finally { setIsSubmitting(false); }
  };

  const toggleFinanceScope = (scopeId: string) => {
      let current = editPerms.finance || 'none';
      
      if (scopeId === 'all') {
          setEditPerms({...editPerms, finance: 'all'});
          return;
      }
      if (scopeId === 'none') {
          setEditPerms({...editPerms, finance: 'none'});
          return;
      }

      if (current === 'all' || current === 'none') {
          setEditPerms({...editPerms, finance: scopeId});
      } else {
          let parts = current.split(',').filter(p => p.trim() !== '');
          if (parts.includes(scopeId)) {
              parts = parts.filter(p => p !== scopeId);
              setEditPerms({...editPerms, finance: parts.length > 0 ? parts.join(',') : 'none'});
          } else {
              parts.push(scopeId);
              setEditPerms({...editPerms, finance: parts.join(',')});
          }
      }
  };

  const isFinanceScopeChecked = (scopeId: string) => {
      let current = editPerms.finance || 'none';
      if (scopeId === 'all') return current === 'all';
      if (scopeId === 'none') return current === 'none';
      if (current === 'all') return true;
      return current.split(',').includes(scopeId);
  };

  const permissionGroups = [
      { key: 'dashboard', label: 'Quản Lý (Dashboard)' },
      { key: 'orders', label: 'Đơn Hàng' },
      { key: 'designerOnline', label: 'Design Online' },
      { key: 'designer', label: 'Designer' },
      { key: 'customers', label: 'Khách Hàng' },
      { key: 'system', label: 'Hệ Thống' }
  ];

  const roleOptions = [
    { value: 'admin', label: 'Admin', color: 'admin-red-gradient' },
    { value: 'CEO', label: 'CEO', color: 'text-orange-600' },
    { value: 'leader', label: 'Leader', color: 'text-blue-600' },
    { value: 'support', label: 'Support', color: 'text-gray-700' },
    { value: 'designer', label: 'Designer', color: 'text-indigo-600' },
    { value: 'designer online', label: 'Designer Online', color: 'text-teal-600' }
  ];

  return (
    <div className="p-6 bg-gray-100 min-h-full">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 flex justify-between items-center px-8 pt-4">
            <div className="flex space-x-8">
                <button onClick={() => setActiveTab('users')} className={`pb-4 px-2 text-sm font-black flex items-center gap-2 border-b-2 transition-all uppercase tracking-widest ${activeTab === 'users' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                    <List size={18} /> Danh Sách Nhân Sự
                </button>
                <button onClick={() => setActiveTab('roles')} className={`pb-4 px-2 text-sm font-black flex items-center gap-2 border-b-2 transition-all uppercase tracking-widest ${activeTab === 'roles' ? 'text-indigo-600 border-indigo-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                    <Settings size={18} /> Cấu Hình Role
                </button>
            </div>
            {activeTab === 'users' && (
                <button onClick={() => { setIsCreateModalOpen(true); setStatus({type: null, message: ''}); }} className="mb-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">
                    <UserPlus size={18} /> Cấp Tài Khoản
                </button>
            )}
        </div>

        {activeTab === 'users' && (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                        <tr className="bg-white border-b border-gray-200 text-[10px] uppercase text-gray-400 font-black tracking-widest">
                            <th className="px-8 py-5">Username</th>
                            <th className="px-8 py-5">Password</th>
                            <th className="px-8 py-5">Họ và tên</th>
                            <th className="px-8 py-5">Vai trò</th>
                            <th className="px-8 py-5 text-center">Trạng thái</th>
                            <th className="px-8 py-5 text-center">Phân Quyền</th>
                            <th className="px-8 py-5">Liên hệ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading ? (
                            <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">Đang tải...</td></tr>
                        ) : (
                            users.map((u) => (
                                <tr key={u.username} className="hover:bg-indigo-50/20 transition-colors">
                                    <td className="px-8 py-5 font-mono font-bold text-indigo-600">{u.username}</td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 group">
                                            <span className="font-mono text-gray-500 min-w-[80px]">
                                                {visiblePasswords[u.username] ? u.password : '••••••••'}
                                            </span>
                                            <button 
                                                onClick={() => togglePasswordVisibility(u.username)}
                                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            >
                                                {visiblePasswords[u.username] ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-gray-700 font-bold">{u.fullName}</td>
                                    <td className="px-8 py-5">
                                        <select 
                                            value={u.role.toLowerCase()}
                                            onChange={(e) => handleRoleChange(u.username, e.target.value)}
                                            className={`bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer ${
                                                u.role.toLowerCase() === 'admin' ? 'admin-red-gradient border-red-100' : 
                                                u.role.toUpperCase() === 'CEO' ? 'text-orange-600' : 'text-gray-700'
                                            }`}
                                        >
                                            {roleOptions.map(opt => (
                                                <option key={opt.value} value={opt.value} className="text-gray-900 font-bold">{opt.label}</option>
                                            ))}
                                            {!roleOptions.some(o => o.value === u.role.toLowerCase()) && <option value={u.role.toLowerCase()}>{u.role}</option>}
                                        </select>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${u.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                            {u.status || 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <button onClick={() => openPermModal(u)} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white text-indigo-600 hover:bg-indigo-700 hover:text-white transition-all mx-auto text-[10px] font-black uppercase tracking-widest border-2 border-indigo-100">
                                            <Shield size={14} /> Cấu hình
                                        </button>
                                    </td>
                                    <td className="px-8 py-5 text-[11px] text-gray-500 font-bold">{u.email || '---'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'roles' && (
            <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Cấu hình vai trò & Cấp độ</h3>
                    <button onClick={() => setIsAddRoleModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-emerald-700 transition-all shadow-md">
                        <Plus size={16} /> Thêm Role
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roles.map((r, idx) => (
                        <div key={idx} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex justify-between items-center">
                            <div>
                                <h4 className={`text-sm font-black uppercase ${r.name.toLowerCase() === 'admin' ? 'admin-red-gradient' : 'text-gray-800'}`}>{r.name}</h4>
                                <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">Cấp độ: {r.level}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center font-black text-indigo-600 shadow-sm">
                                {r.level}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-8 bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-blue-700">
                    <Info size={20} className="flex-shrink-0" />
                    <div className="text-xs leading-relaxed">
                        <strong>Lưu ý về cấp độ:</strong> Cấp độ càng thấp (1 là cao nhất) thể hiện quyền hạn càng cao trong hệ thống.
                        Ví dụ: 1 (Admin/CEO), 2 (Leader), 3 (Support), 4 (Designer).
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
                  <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-black text-gray-900 text-lg flex items-center gap-3">
                          <UserPlus className="text-indigo-600" size={24} />
                          Cấp Tài Khoản Nhân Sự
                      </h3>
                      <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-900 transition-all"><X size={24} /></button>
                  </div>
                  
                  <form onSubmit={handleSubmitUser} className="p-8 space-y-4">
                      {status.message && (
                          <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                              {status.message}
                          </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Tên đăng nhập *</label>
                              <input name="username" type="text" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" value={formData.username} onChange={handleChange} />
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Mật khẩu *</label>
                              <input name="password" type="text" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" value={formData.password} onChange={handleChange} />
                          </div>
                      </div>

                      <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Họ và tên *</label>
                          <input name="fullName" type="text" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" value={formData.fullName} onChange={handleChange} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Email</label>
                              <input name="email" type="email" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" value={formData.email} onChange={handleChange} />
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Vai trò ban đầu</label>
                              <select name="role" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" value={formData.role} onChange={handleChange}>
                                  <option value="CEO">CEO</option>
                                  <option value="admin">Admin</option>
                                  <option value="leader">Leader</option>
                                  <option value="support">Support</option>
                                  <option value="designer">Designer</option>
                                  <option value="designer online">Designer Online</option>
                              </select>
                          </div>
                      </div>

                      <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-6 py-3 text-gray-400 font-black text-xs uppercase tracking-widest">Hủy</button>
                          <button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 flex items-center gap-2">
                              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                              Tạo Tài Khoản
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* PERMISSIONS MODAL */}
      {isPermModalOpen && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
                  <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                      <div>
                          <h3 className="font-black text-gray-900 text-lg flex items-center gap-3">
                              <Shield className="text-indigo-600" size={24} />
                              Quyền Truy Cập: <span className="text-orange-600 underline decoration-2">{selectedUser.username}</span>
                          </h3>
                      </div>
                      <button onClick={() => setIsPermModalOpen(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-900 transition-all"><X size={24} /></button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                      <div className="bg-orange-50 border border-orange-100 rounded-3xl p-6 space-y-6">
                        <h4 className="text-[11px] font-black text-orange-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                           <Sparkles size={14} /> Đặc quyền bổ sung
                        </h4>
                        
                        <div className="space-y-4">
                            <label className="flex items-center gap-4 cursor-pointer group">
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editPerms.canPostNews ? 'bg-orange-600 border-orange-600 text-white shadow-lg' : 'bg-white border-gray-300'}`}>
                                    {editPerms.canPostNews && <Check size={14} strokeWidth={4} />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={editPerms.canPostNews} 
                                    onChange={() => setEditPerms({...editPerms, canPostNews: !editPerms.canPostNews})} 
                                />
                                <span className="text-sm font-black text-gray-800 uppercase tracking-widest">Đăng tin tức trang chủ</span>
                            </label>

                            <label className="flex items-center gap-4 cursor-pointer group">
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editPerms.canViewFinanceSummary ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-300'}`}>
                                    {editPerms.canViewFinanceSummary && <Check size={14} strokeWidth={4} />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={editPerms.canViewFinanceSummary} 
                                    onChange={() => setEditPerms({...editPerms, canViewFinanceSummary: !editPerms.canViewFinanceSummary})} 
                                />
                                <span className="text-sm font-black text-gray-800 uppercase tracking-widest">Xem 4 bảng tổng hợp tài chính</span>
                            </label>
                            
                            <label className="flex items-center gap-4 cursor-pointer group">
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editPerms.canManageSku ? 'bg-slate-800 border-slate-800 text-white shadow-lg' : 'bg-white border-gray-300'}`}>
                                    {editPerms.canManageSku && <Check size={14} strokeWidth={4} />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={editPerms.canManageSku} 
                                    onChange={() => setEditPerms({...editPerms, canManageSku: !editPerms.canManageSku})} 
                                />
                                <span className="text-sm font-black text-gray-800 uppercase tracking-widest">Quản lý SKU & Bảng Giá</span>
                            </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                        {permissionGroups.map((item) => (
                            <div key={item.key} className="flex flex-col gap-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">{item.label}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['all', 'own', 'none'].map((scope) => (
                                        <label key={scope} className={`cursor-pointer border-2 rounded-xl px-2 py-2.5 text-[10px] font-black uppercase tracking-widest text-center transition-all flex items-center justify-center ${editPerms[item.key as keyof UserPermissions] === scope ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'}`}>
                                            <input type="radio" className="hidden" checked={editPerms[item.key as keyof UserPermissions] === scope} onChange={() => setEditPerms({...editPerms, [item.key]: scope})} />
                                            {scope === 'all' ? 'Toàn bộ' : scope === 'own' ? 'Cá nhân' : 'Khóa'}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <div className="flex flex-col gap-2 col-span-1 md:col-span-2 mt-4 pt-4 border-t border-slate-100">
                            <label className="text-[11px] font-black text-indigo-600 uppercase tracking-widest ml-1">Module Tài Chính (Được chọn nhiều)</label>
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                                {[
                                    { id: 'all', label: 'Toàn bộ' },
                                    { id: 'payment', label: 'Payment' },
                                    { id: 'funds', label: 'Sổ Quỹ' },
                                    { id: 'printway', label: 'Printway' },
                                    { id: 'ebay', label: 'Ebay' },
                                    { id: 'none', label: 'Khóa' }
                                ].map((scope) => (
                                    <label key={scope.id} className={`cursor-pointer border-2 rounded-xl px-2 py-3 text-[10px] font-black uppercase tracking-widest text-center transition-all flex items-center justify-center ${isFinanceScopeChecked(scope.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'}`}>
                                        <input type="checkbox" className="hidden" checked={isFinanceScopeChecked(scope.id)} onChange={() => toggleFinanceScope(scope.id)} />
                                        {scope.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                      </div>
                  </div>

                  <div className="bg-gray-50/80 px-8 py-6 flex justify-end gap-4 border-t border-gray-100">
                      <button onClick={() => setIsPermModalOpen(false)} disabled={isSubmitting} className="px-6 py-3 text-gray-500 hover:text-gray-800 font-black text-xs uppercase tracking-widest transition-all">Hủy</button>
                      <button onClick={handleSavePerms} disabled={isSubmitting} className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/30 active:scale-95 disabled:opacity-50">
                          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                          Lưu Quyền Hạn
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default UserManagement;
