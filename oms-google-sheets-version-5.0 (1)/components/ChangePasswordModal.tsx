import React, { useState } from 'react';
import { Lock, Save, Loader2, Key, AlertCircle, CheckCircle } from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User } from '../types';

interface ChangePasswordModalProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, onClose, onSuccess }) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass || !confirmPass) {
      setStatus({ type: 'error', message: 'Vui lòng nhập đầy đủ thông tin.' });
      return;
    }
    if (newPass !== confirmPass) {
      setStatus({ type: 'error', message: 'Mật khẩu mới không khớp.' });
      return;
    }
    if (newPass.length < 6) {
      setStatus({ type: 'error', message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await sheetService.changePassword(user.username, oldPass, newPass);
      if (response.success) {
        setStatus({ type: 'success', message: 'Đổi mật khẩu thành công!' });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setStatus({ type: 'error', message: response.error || 'Mật khẩu cũ không đúng.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Lỗi kết nối hệ thống.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <Key className="text-orange-500" size={20} />
            Đổi Mật Khẩu
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {status.message && (
            <div className={`p-3 rounded-md flex items-center gap-2 text-sm ${
              status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span>{status.message}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mật khẩu cũ</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="password" 
                value={oldPass} 
                onChange={(e) => setOldPass(e.target.value)} 
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm" 
                placeholder="••••••" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mật khẩu mới</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="password" 
                value={newPass} 
                onChange={(e) => setNewPass(e.target.value)} 
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm" 
                placeholder="••••••" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nhập lại mật khẩu mới</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="password" 
                value={confirmPass} 
                onChange={(e) => setConfirmPass(e.target.value)} 
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm" 
                placeholder="••••••" 
                required 
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm transition-colors">Hủy</button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors shadow-sm disabled:opacity-70">
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              <span>Lưu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;