
import React, { useState } from 'react';
import { User } from '../types';
import { sheetService } from '../services/sheetService';
import { Lock, User as UserIcon, Loader2, AlertCircle, ShoppingBag } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await sheetService.login(username, password);
      if (response.success && response.user) {
        onLogin(response.user);
      } else {
        setError(response.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
      }
    } catch (err) {
      setError('Lỗi kết nối đến hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Image - POD Theme */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          // Hình ảnh quần áo/thời trang hiện đại, phù hợp chủ đề POD
          backgroundImage: "url('https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=2670&auto=format&fit=crop')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Dark Overlay & Blur Effect */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-900/90 via-black/70 to-gray-900/90 backdrop-blur-[3px]"></div>

      {/* Decorative Circles (Optional for aesthetic) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-500/20 rounded-full blur-3xl z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl z-0"></div>

      {/* Login Card */}
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden relative z-10 border border-white/20 animate-[fadeIn_0.5s_ease-out]">
        
        {/* Header Section */}
        <div className="bg-[#1e293b] p-8 text-center relative overflow-hidden">
          {/* Decorative pattern inside header */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <div className="relative z-10 flex flex-col items-center">
             <div className="w-16 h-16 bg-gradient-to-tr from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-lg mb-4">
                <ShoppingBag className="text-white" size={32} />
             </div>
             <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">Team 3T</h2>
             <p className="text-gray-300 text-sm font-light">Hệ thống Quản lý Order Online</p>
          </div>
        </div>
        
        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-[shake_0.5s_ease-in-out]">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2 group">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block group-focus-within:text-orange-600 transition-colors">
              Tên đăng nhập
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon size={18} className="text-gray-400 group-focus-within:text-orange-500 transition-colors" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium placeholder-gray-400"
                placeholder="Nhập username..."
              />
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block group-focus-within:text-orange-600 transition-colors">
              Mật khẩu
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400 group-focus-within:text-orange-500 transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium placeholder-gray-400"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-orange-500/30 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Đang xác thực...
              </div>
            ) : (
              'ĐĂNG NHẬP HỆ THỐNG'
            )}
          </button>
        </form>
        
        {/* Footer Section */}
        <div className="bg-gray-50/50 px-8 py-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            TH Version 5.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
