
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Plus, Trash2, Save, Loader2, 
  CheckCircle, Clock, UserCheck, Timer, LogOut, Search,
  ChevronLeft, ChevronRight, User as UserIcon, Coffee,
  CalendarDays, Zap, MoreHorizontal, ChevronDown, Sparkles,
  Award, Star, Moon, Sun, Flag
} from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User, ScheduleStaff, AttendanceRecord, OTRecord } from '../types';

interface ScheduleManagementProps {
  user: User;
}

const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ user }) => {
  const [staffList, setStaffList] = useState<ScheduleStaff[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [otAttendance, setOtAttendance] = useState<OTRecord[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [systemUsers, setSystemUsers] = useState<User[]>([]);

  const isAdmin = user.role.toLowerCase() === 'admin';

  const getSelectedMonthStr = () => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const getTodayGMT7 = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Ho_Chi_Minh", year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Intl.DateTimeFormat('en-CA', options).format(now);
  };

  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr || timeStr === '..' || timeStr === '') return '--:--';
    if (timeStr.includes('T')) {
        const parts = timeStr.split('T');
        if (parts.length > 1) return parts[1].substring(0, 5);
    }
    return timeStr.substring(0, 5);
  };

  const getDaysInMonth = (m: number, y: number) => {
    const date = new Date(y, m, 0);
    return Array.from({ length: date.getDate() }, (_, i) => i + 1);
  };

  const days = getDaysInMonth(selectedMonth, selectedYear);

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStr = getSelectedMonthStr();
      const [staffRes, attRes, otRes, holiRes, usersRes] = await Promise.all([
        sheetService.getScheduleStaff(),
        sheetService.getAttendance(monthStr),
        sheetService.getOTAttendance(monthStr),
        sheetService.getHolidays(monthStr),
        sheetService.getUsers()
      ]);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
      setAttendance(Array.isArray(attRes) ? attRes : []);
      setOtAttendance(Array.isArray(otRes) ? otRes : []);
      setHolidays(Array.isArray(holiRes) ? holiRes : []);
      setSystemUsers(Array.isArray(usersRes) ? usersRes : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear]);

  const handleAddStaff = () => setStaffList([...staffList, { name: '', role: '', username: '' }]);
  const handleRemoveStaff = (index: number) => {
    const newList = [...staffList]; newList.splice(index, 1); setStaffList(newList);
  };

  const handleUpdateStaff = (index: number, field: keyof ScheduleStaff, value: string) => {
    const newList = [...staffList];
    newList[index] = { ...newList[index], [field]: value };
    if (field === 'name') {
      const matchedUser = systemUsers.find(u => u.fullName.toLowerCase() === value.toLowerCase());
      if (matchedUser) {
        newList[index].username = matchedUser.username;
        if (!newList[index].role) newList[index].role = matchedUser.role;
      }
    }
    setStaffList(newList);
  };

  const handleSaveSchedule = async () => {
    setIsSaving(true);
    try {
      const res = await sheetService.saveScheduleStaff(staffList);
      if (res && res.success) alert("Lưu danh sách nhân sự thành công!");
      else alert("Lỗi: " + (res?.error || "Không thể lưu"));
    } catch (e) { alert("Lỗi khi lưu!"); } finally { setIsSaving(false); }
  };

  const handleAttendance = async (type: 'in' | 'out', isOT: boolean = false) => {
    setIsSaving(true);
    try {
      let res;
      if (isOT) {
        res = type === 'in' ? await sheetService.checkInOT(user.username, user.fullName) : await sheetService.checkOutOT(user.username, user.fullName);
      } else {
        res = type === 'in' ? await sheetService.checkIn(user.username, user.fullName) : await sheetService.checkOut(user.username, user.fullName);
      }
      if (res && res.success) {
          if (res.message) alert(res.message); 
          await fetchData();
      }
      else alert(res?.error || "Lỗi xử lý điểm danh");
    } catch (e) { alert("Lỗi kết nối điểm danh!"); } finally { setIsSaving(false); }
  };

  const toggleHoliday = async (day: number) => {
    if (!isAdmin) return;
    const dateStr = `${getSelectedMonthStr()}-${day.toString().padStart(2, '0')}`;
    try {
        const res = await sheetService.toggleHoliday(dateStr);
        if (res.success) {
            setHolidays(prev => res.isHoliday ? [...prev, dateStr] : prev.filter(d => d !== dateStr));
        }
    } catch (e) { alert("Lỗi cập nhật ngày lễ"); }
  };

  const getAttendanceData = (nameOrUsername: string, day: number) => {
    const dayStr = day.toString().padStart(2, '0');
    const fullDate = `${getSelectedMonthStr()}-${dayStr}`;
    return attendance.find(r => (r.username === nameOrUsername || r.name === nameOrUsername) && r.date.startsWith(fullDate));
  };

  const getOTData = (nameOrUsername: string, day: number) => {
    const dayStr = day.toString().padStart(2, '0');
    const fullDate = `${getSelectedMonthStr()}-${dayStr}`;
    const records = otAttendance.filter(r => (r.username === nameOrUsername || r.name === nameOrUsername) && r.date.startsWith(fullDate));
    if (records.length === 0) return null;

    const isHoli = holidays.includes(fullDate);
    const dateObj = new Date(selectedYear, selectedMonth - 1, day);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    return {
        ...records[0],
        totalHours: records.reduce((sum, r) => sum + (r.totalHours || 0), 0),
        checkOut: records.every(r => !!r.checkOut) ? records[records.length-1].checkOut : undefined,
        type: isHoli ? 'Holiday' : isWeekend ? 'Weekend' : 'Normal'
    };
  };

  const todayStr = getTodayGMT7();
  const todayRecord = attendance.find(r => String(r.username) === String(user.username) && String(r.date).startsWith(todayStr));
  const todayOTRecord = otAttendance.find(r => String(r.username) === String(user.username) && String(r.date).startsWith(todayStr) && !r.checkOut);

  const calculateOTSummary = (nameOrUsername: string) => {
    const records = otAttendance.filter(r => (r.username === nameOrUsername || r.name === nameOrUsername) && r.checkOut);
    let normal = 0, weekend = 0, holiday = 0;
    
    records.forEach(r => {
        const dateOnly = r.date.split(' ')[0];
        const isHoli = holidays.includes(dateOnly);
        const dateObj = new Date(dateOnly.replace(/-/g, '/'));
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        
        if (isHoli) holiday += (r.totalHours || 0);
        else if (isWeekend) weekend += (r.totalHours || 0);
        else normal += (r.totalHours || 0);
    });

    return {
        normal: Math.round(normal * 100) / 100,
        weekend: Math.round(weekend * 100) / 100,
        holiday: Math.round(holiday * 100) / 100
    };
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20 flex-col gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <CalendarDays className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
      </div>
      <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">Đang nạp dữ liệu lịch trực...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 bg-[#f8fafc] min-h-full space-y-8 animate-fade-in pb-24 overflow-x-hidden">
      {/* --- HEADER CARD --- */}
      <div className="relative bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-6">
                <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl">
                    <Calendar size={30} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                        Lịch trực & OT <Sparkles size={18} className="text-amber-400 animate-bounce" />
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hệ thống ghi nhận thời gian thực
                    </p>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-50/80 p-2.5 rounded-[2rem] border border-slate-100">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-sm font-black text-slate-700 outline-none uppercase tracking-tighter">
                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                    </select>
                    <div className="w-px h-4 bg-slate-200 mx-2"></div>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-sm font-black text-slate-700 outline-none tracking-tighter">
                        {Array.from({length: 5}, (_, i) => <option key={i} value={2023 + i}>{2023 + i}</option>)}
                    </select>
                </div>

                {/* ATTENDANCE SECTION */}
                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase mr-2">Ca chính:</span>
                    {!todayRecord || !todayRecord.checkIn ? (
                        <button onClick={() => handleAttendance('in')} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">
                           {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Timer size={14} />} Bắt đầu ca
                        </button>
                    ) : !todayRecord.checkOut ? (
                        <button onClick={() => handleAttendance('out')} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase animate-pulse shadow-lg active:scale-95 transition-all">
                           {isSaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Kết thúc ca
                        </button>
                    ) : (
                        <div className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                            <CheckCircle size={14} className="text-emerald-400" /> {todayRecord.totalHours?.toFixed(2)}h
                        </div>
                    )}
                </div>

                {/* OT SECTION - Same Style as Attendance */}
                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase mr-2">Tăng ca:</span>
                    {!todayOTRecord || !todayOTRecord.checkIn ? (
                        <button onClick={() => handleAttendance('in', true)} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">
                           {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />} Bắt đầu OT
                        </button>
                    ) : !todayOTRecord.checkOut ? (
                        <button onClick={() => handleAttendance('out', true)} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase animate-pulse shadow-lg active:scale-95 transition-all">
                           {isSaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Kết thúc OT
                        </button>
                    ) : (
                        <div className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                            <CheckCircle size={14} className="text-amber-400" /> {todayOTRecord.totalHours?.toFixed(2)}h
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* --- MAIN TABLE --- */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/30">
           <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Bảng phân ca chi tiết</h3>
           </div>
           {isAdmin && (
             <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm">
                <button onClick={handleAddStaff} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Plus size={18} /></button>
                <button onClick={handleSaveSchedule} disabled={isSaving} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-[10px] font-black uppercase shadow-md active:scale-95">
                  {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Lưu Lịch
                </button>
             </div>
           )}
        </div>

        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                <th className="px-6 py-5 w-60 sticky left-0 bg-white z-20 border-r border-slate-100 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.08)]">Nhân sự & Vai trò</th>
                {days.map(d => {
                  const dateStr = `${getSelectedMonthStr()}-${d.toString().padStart(2, '0')}`;
                  const isHoli = holidays.includes(dateStr);
                  const dateObj = new Date(selectedYear, selectedMonth - 1, d);
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                  return (
                    <th key={d} onClick={() => toggleHoliday(d)} className={`py-5 text-center border-l border-slate-50 cursor-pointer transition-colors ${isHoli ? 'bg-rose-50 text-rose-500' : isWeekend ? 'bg-slate-50/50' : ''}`}>
                      <div className="flex flex-col items-center gap-1">
                        <span className="block text-[11px] font-black">{d}</span>
                        {isHoli && <Flag size={8} fill="currentColor" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {staffList.map((staff, idx) => (
                <tr key={idx} className="hover:bg-slate-50/20 transition-colors group">
                  <td className="px-6 py-4 sticky left-0 bg-white z-20 border-r border-slate-100 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.08)]">
                    {isAdmin ? (
                      <div className="flex flex-col">
                        <input className="text-xs font-black text-slate-800 outline-none border-b-2 border-transparent focus:border-indigo-400 bg-transparent" value={staff.name} onChange={(e) => handleUpdateStaff(idx, 'name', e.target.value)} />
                        <input className="text-[9px] text-slate-400 font-bold uppercase outline-none bg-transparent mt-0.5" value={staff.role} onChange={(e) => handleUpdateStaff(idx, 'role', e.target.value)} />
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-800 truncate">{staff.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase truncate">{staff.role}</p>
                      </div>
                    )}
                  </td>
                  
                  {days.map(d => {
                    const data = getAttendanceData(staff.username || staff.name, d);
                    const ot = getOTData(staff.username || staff.name, d);
                    return (
                      <td key={d} className={`p-1.5 text-center border-l border-slate-50 ${d % 2 === 0 ? 'bg-slate-50/5' : ''}`}>
                        <div className="flex flex-col gap-1">
                            {data ? (
                              <div className={`p-1 rounded-lg border-2 text-[8px] font-black transition-all ${data.checkOut ? 'bg-indigo-50/50 border-indigo-100 text-indigo-700' : 'bg-amber-50 border-amber-200 animate-pulse text-amber-700'}`}>
                                {formatTime(data.checkIn)} - {data.checkOut ? formatTime(data.checkOut) : '--:--'}
                                {data.checkOut && <div className="mt-0.5 text-[7px] opacity-60">Ca: {data.totalHours?.toFixed(2)}h</div>}
                              </div>
                            ) : null}
                            
                            {ot ? (
                              <div className={`p-1 rounded-lg border-2 text-[8px] font-black ${ot.checkOut ? (ot.type === 'Holiday' ? 'bg-rose-100 border-rose-200 text-rose-700' : 'bg-orange-100 border-orange-200 text-orange-700') : 'bg-amber-100 border-amber-200 animate-pulse text-amber-700'}`}>
                                OT: {ot.totalHours?.toFixed(2) || '...'}h
                                {ot.type === 'Holiday' && <span className="ml-1">🎉</span>}
                              </div>
                            ) : null}

                            {!data && !ot && <div className="w-1.5 h-1.5 rounded-full bg-slate-100 mx-auto"></div>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- OT SUMMARY TABLE --- */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
           <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
           <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Tổng kết giờ OT trong tháng</h3>
        </div>
        <div className="p-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                        <th className="py-4">Nhân sự</th>
                        <th className="py-4 text-center">OT Ngày thường</th>
                        <th className="py-4 text-center">OT Ngày nghỉ (T7,CN)</th>
                        <th className="py-4 text-center">OT Ngày lễ</th>
                        <th className="py-4 text-center font-black text-slate-800">Tổng OT tháng</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {staffList.map(staff => {
                        const summary = calculateOTSummary(staff.username || staff.name);
                        const total = Math.round((summary.normal + summary.weekend + summary.holiday) * 100) / 100;
                        return (
                            <tr key={staff.username || staff.name} className="hover:bg-slate-50/50 transition-colors font-bold">
                                <td className="py-4 text-slate-800">{staff.name}</td>
                                <td className="py-4 text-center text-slate-600">{summary.normal.toFixed(2)}h</td>
                                <td className="py-4 text-center text-orange-600">{summary.weekend.toFixed(2)}h</td>
                                <td className="py-4 text-center text-rose-600">{summary.holiday.toFixed(2)}h</td>
                                <td className="py-4 text-center font-black text-indigo-600">{total.toFixed(2)}h</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
      
      {/* --- LEGEND --- */}
      <div className="flex flex-wrap items-center justify-center gap-8 py-4 opacity-50">
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-rose-100 border border-rose-200"></div><span className="text-[10px] font-black uppercase text-slate-500">Ngày lễ (Holiday)</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-orange-100 border border-orange-200"></div><span className="text-[10px] font-black uppercase text-slate-500">Tăng ca (OT)</span></div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-md bg-indigo-50 border border-indigo-100"></div><span className="text-[10px] font-black uppercase text-slate-500">Ca chính</span></div>
      </div>
    </div>
  );
};

export default ScheduleManagement;
