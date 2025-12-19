import React, { useState, useEffect } from 'react';
import { sheetService } from '../services/sheetService';
import { User, Role, UserPermissions, ViewScope } from '../types';
// Fixed: Added missing Sparkles icon to the lucide-react import list.
import { 
  UserPlus, Plus, Save, CheckCircle, AlertCircle, Loader2, 
  Mail, Phone, User as UserIcon, Lock, Shield, List, 
  Settings, Eye, Check, X, UserCog, Key, Briefcase, Info,
  Sparkles
} from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const defaultPermissions: UserPermissions = {
      canManageSku: false,
      canPostNews: false,
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
    try {
      const response = await sheetService.createUser({ ...formData, permissions: formData.permissions });
      if (response.success) {
        setStatus({ type: 'success', message: 'Tạo tài khoản thành công!' });
        setFormData({ username: '', password: '', fullName: '', email: '', phone: '', role: 'support', permissions: { ...defaultPermissions } });
        loadData();
        setTimeout(() => setIsCreateModalOpen(false), 1500);
      } else setStatus({ type: 'error', message: response.error || 'Có lỗi xảy ra.' });
    } catch (error) { setStatus({ type: 'error', message: 'Lỗi kết nối.' }); } 
    finally { setIsSubmitting(false); }
  };

  const openPermModal = (user: User) => {
      setSelectedUser(user);
      setEditPerms({
          canManageSku: user.permissions?.canManageSku || false,
          canPostNews: user.permissions?.canPostNews || false,
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

  const permissionGroups = [
      { key: 'dashboard', label: 'Quản Lý (Dashboard)' },
      { key: 'orders', label: 'Đơn Hàng' },
      { key: 'designerOnline', label: 'Design Online' },
      { key: 'designer', label: 'Designer' },
      { key: 'customers', label: 'Khách Hàng' },
      { key: 'finance', label: 'Tài Chính' },
      { key: 'system', label: 'Hệ Thống' }
  ];

  return (
    <div className="p-6 bg-gray-50/50 min-h-full">
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
                <button onClick={() => setIsCreateModalOpen(true)} className="mb-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">
                    <UserPlus size={18} /> Cấp Tài Khoản
                </button>
            )}
        </div>

        {activeTab === 'users' && (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b border-gray-200 text-[10px] uppercase text-gray-400 font-black tracking-widest">
                            <th className="px-8 py-5">Username</th>
                            <th className="px-8 py-5">Họ và tên</th>
                            <th className="px-8 py-5">Vai trò</th>
                            <th className="px-8 py-5 text-center">Trạng thái</th>
                            <th className="px-8 py-5 text-center">Phân Quyền</th>
                            <th className="px-8 py-5">Liên hệ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading ? (
                            <tr><td colSpan={6} className="p-12 text-center text-gray-400 italic">Đang tải...</td></tr>
                        ) : (
                            users.map((u) => (
                                <tr key={u.username} className="hover:bg-indigo-50/20 transition-colors">
                                    <td className="px-8 py-5 font-mono font-bold text-indigo-600">{u.username}</td>
                                    <td className="px-8 py-5 text-gray-700 font-bold">{u.fullName}</td>
                                    <td className="px-8 py-5"><span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">{u.role}</span></td>
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
      </div>

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
                      {/* Section: News Rights */}
                      <div className="bg-orange-50 border border-orange-100 rounded-3xl p-6">
                        <h4 className="text-[11px] font-black text-orange-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                           <Sparkles size={14} /> Đặc quyền tin tức
                        </h4>
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
                            <span className="text-sm font-black text-gray-800 uppercase tracking-widest">Cho phép đăng tin tức lên trang chủ</span>
                        </label>
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
                      </div>

                      <div className="pt-6 border-t border-gray-100">
                          <label className="flex items-center gap-4 cursor-pointer group">
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editPerms.canManageSku ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-gray-300'}`}>
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

                  <div className="bg-gray-50/80 px-8 py-6 flex justify-end gap-4 border-t border-gray-100">
                      <button onClick={() => setIsPermModalOpen(false)} disabled={isSubmitting} className="px-6 py-3 text-gray-500 hover:text-gray-800 font-black text-xs uppercase tracking-widest transition-all">Hủy</button>
                      <button onClick={handleSavePerms} disabled={isSubmitting} className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/30 active:scale-95 disabled:opacity-50">
                          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
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