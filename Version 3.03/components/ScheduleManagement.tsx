
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Users, Plus, Trash2, Save, Loader2, 
  CheckCircle, Clock, UserCheck, Timer, LogOut, Search,
  ChevronLeft, ChevronRight, User as UserIcon, Coffee,
  CalendarDays, Zap, MoreHorizontal, ChevronDown, Sparkles,
  Award, Star, Moon, Sun, Flag, ClipboardCheck, LayoutList, X, MousePointer2,
  Check, AlertTriangle, Edit2, FileSpreadsheet
} from 'lucide-react';
import { sheetService } from '../services/sheetService';
import { User, ScheduleStaff, AttendanceRecord, OTRecord } from '../types';

interface ScheduleManagementProps {
  user: User;
}

type MainTab = 'attendance' | 'timekeeping';

const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ user }) => {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('attendance');
  const [staffList, setStaffList] = useState<ScheduleStaff[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [otAttendance, setOtAttendance] = useState<OTRecord[]>([]);
  const [manualTimekeeping, setManualTimekeeping] = useState<Record<string, Record<number, string>>>({});
  const [holidays, setHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTableSyncing, setIsTableSyncing] = useState(false);
  
  // Modal States
  const [manualInputModal, setManualInputModal] = useState<{ isOpen: boolean, username: string, day: number, currentVal: string } | null>(null);
  const [tempInputVal, setTempInputVal] = useState("");
  const [deleteStaffConfirm, setDeleteStaffConfirm] = useState<{ username: string, name: string } | null>(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [systemUsers, setSystemUsers] = useState<User[]>([]);

  const isAdmin = user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'leader';

  const getSelectedMonthStr = () => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const getTodayGMT7 = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Ho_Chi_Minh", year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Intl.DateTimeFormat('en-CA', options).format(now);
  };

  const days = useMemo(() => {
    const date = new Date(selectedYear, selectedMonth, 0);
    return Array.from({ length: date.getDate() }, (_, i) => i + 1);
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStr = getSelectedMonthStr();
      const [staffRes, attRes, otRes, holiRes, usersRes, manualRes] = await Promise.all([
        sheetService.getScheduleStaff(),
        sheetService.getAttendance(monthStr),
        sheetService.getOTAttendance(monthStr),
        sheetService.getHolidays(monthStr),
        sheetService.getUsers(),
        sheetService.getManualTimekeeping(monthStr)
      ]);
      setStaffList(Array.isArray(staffRes) ? staffRes : []);
      setAttendance(Array.isArray(attRes) ? attRes : []);
      setOtAttendance(Array.isArray(otRes) ? otRes : []);
      setHolidays(Array.isArray(holiRes) ? holiRes : []);
      setSystemUsers(Array.isArray(usersRes) ? usersRes : []);
      setManualTimekeeping(manualRes || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedMonth, selectedYear]);

  const filteredStaffList = useMemo(() => {
    if (isAdmin) return staffList;
    return staffList.filter(s => s.username === user.username || s.name === user.fullName);
  }, [staffList, isAdmin, user]);

  const handleAddStaff = () => setStaffList([...staffList, { name: '', role: '', username: '' }]);
  
  const handleRemoveStaffMember = (username: string, name: string) => {
    setDeleteStaffConfirm({ username, name });
  };

  const executeActualRemove = async () => {
    if (!deleteStaffConfirm) return;
    const { username, name } = deleteStaffConfirm;
    setIsSaving(true);
    try {
        const res = await (sheetService as any).deleteScheduleStaffMember(username, name);
        if (res.success) {
            setStaffList(prev => prev.filter(s => s.username !== username && s.name !== name));
            setDeleteStaffConfirm(null);
        }
    } finally { setIsSaving(false); }
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

  // --- CHẤM CÔNG LOGIC V32.0 ---
  const getTimekeepingValue = (staff: ScheduleStaff, day: number) => {
    const username = staff.username || staff.name;
    if (manualTimekeeping[username] && manualTimekeeping[username][day]) {
        return manualTimekeeping[username][day];
    }
    const dayStr = day.toString().padStart(2, '0');
    const fullDateStr = `${getSelectedMonthStr()}-${dayStr}`;
    const dateObj = new Date(selectedYear, selectedMonth - 1, day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dateObj > today) return "";
    const att = attendance.find(r => (r.username === username || r.name === username) && r.date.startsWith(fullDateStr));
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) return "RC";
    if (!att || !att.checkIn) return "RC";
    const timeToMinutes = (timeStr: string) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };
    const inMin = timeToMinutes(att.checkIn);
    const outMin = att.checkOut ? timeToMinutes(att.checkOut) : null;
    if (inMin === null) return "RC";
    if (inMin <= (8 * 60 + 15) && outMin && outMin >= (17 * 60 + 30)) return "HC";
    if (inMin <= (8 * 60 + 15)) return "S";
    if (inMin >= (12 * 60) && inMin <= (13 * 60 + 45) && outMin && outMin >= (17 * 60 + 30)) return "C";
    return "RC";
  };

  // --- HÀM LƯU TOÀN BỘ BẢNG CÔNG VỀ GOOGLE SHEET V32.0 ---
  const handleSaveFullTable = async (showSuccess = true) => {
    if (isTableSyncing) return;
    setIsTableSyncing(true);
    try {
        const monthStr = getSelectedMonthStr();
        const matrix: any[] = staffList.map(staff => {
            const rowData: Record<number, string> = {};
            days.forEach(d => {
                rowData[d] = getTimekeepingValue(staff, d);
            });
            return {
                name: staff.name,
                username: staff.username,
                role: staff.role,
                data: rowData
            };
        });

        const res = await (sheetService as any).saveFullMonthlyTable(monthStr, matrix);
        if (res.success && showSuccess) {
            alert("Đã đồng bộ hóa dữ liệu hiển thị về Google Sheet thành công!");
        }
    } catch (e) {
        console.error("Sync Error:", e);
    } finally {
        setIsTableSyncing(false);
    }
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
          // Tự động lưu bảng sau khi điểm danh thành công
          handleSaveFullTable(false);
      }
      else alert(res?.error || "Lỗi xử lý điểm danh");
    } catch (e) { alert("Lỗi kết nối điểm danh!"); } finally { setIsSaving(false); }
  };

  const handleOpenManualModal = (username: string, day: number, currentVal: string) => {
    if (!isAdmin) return;
    setManualInputModal({ isOpen: true, username, day, currentVal });
    setTempInputVal(currentVal);
  };

  const handleSaveManualTime = async () => {
    if (!manualInputModal) return;
    const { username, day } = manualInputModal;
    const monthStr = getSelectedMonthStr();
    const newVal = tempInputVal.toUpperCase();
    
    setIsSaving(true);
    try {
        const res = await sheetService.saveManualTimekeeping(monthStr, username, day, newVal);
        if (res.success) {
            setManualTimekeeping(prev => ({
                ...prev,
                [username]: { ...(prev[username] || {}), [day]: newVal }
            }));
            setManualInputModal(null);
            // Tự động lưu lại toàn bộ bảng sau khi chỉnh sửa thủ công
            setTimeout(() => handleSaveFullTable(false), 500);
        }
    } finally { setIsSaving(false); }
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
    return {
        ...records[0],
        totalHours: records.reduce((sum, r) => sum + (r.totalHours || 0), 0)
    };
  };

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
    return { normal: Math.round(normal * 100) / 100, weekend: Math.round(weekend * 100) / 100, holiday: Math.round(holiday * 100) / 100 };
  };

  const todayStr = getTodayGMT7();
  const todayRecord = attendance.find(r => String(r.username) === String(user.username) && String(r.date).startsWith(todayStr));
  const todayOTRecord = otAttendance.find(r => String(r.username) === String(user.username) && String(r.date).startsWith(todayStr) && !r.checkOut);

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20 flex-col gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <CalendarDays className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
      </div>
      <p className="text-gray-400 font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">Đang nạp dữ liệu máy chủ...</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 bg-[#f8fafc] min-h-screen space-y-8 animate-fade-in pb-24 overflow-x-hidden">
      
      {/* HEADER */}
      <div className="relative bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-6">
                <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl"><Calendar size={30} strokeWidth={2.5} /></div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">Điểm danh ca trực & OT</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Attendance v32.0</p>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-50/80 p-2.5 rounded-[2rem] border border-slate-100">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-sm font-black text-slate-700 outline-none uppercase tracking-tighter">
                        {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                    </select>
                    <div className="w-px h-4 bg-slate-200 mx-2"></div>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-sm font-black text-slate-700 outline-none tracking-tighter">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    {!todayRecord || !todayRecord.checkIn ? (
                        <button onClick={() => handleAttendance('in')} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
                           {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Timer size={14} />} Bắt đầu ca
                        </button>
                    ) : !todayRecord.checkOut ? (
                        <button onClick={() => handleAttendance('out')} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase animate-pulse shadow-lg hover:bg-rose-700 active:scale-95 transition-all">
                           {isSaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Kết thúc ca
                        </button>
                    ) : (
                        <div className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm">
                            <CheckCircle size={14} className="text-emerald-400" /> Done {todayRecord.totalHours?.toFixed(2)}h
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    {!todayOTRecord || !todayOTRecord.checkIn ? (
                        <button onClick={() => handleAttendance('in', true)} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-amber-600 active:scale-95 transition-all">
                           {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />} Bắt đầu OT
                        </button>
                    ) : !todayOTRecord.checkOut ? (
                        <button onClick={() => handleAttendance('out', true)} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase animate-pulse shadow-lg hover:bg-orange-700 active:scale-95 transition-all">
                           {isSaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Kết thúc OT
                        </button>
                    ) : (
                        <div className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm">
                            <CheckCircle size={14} className="text-amber-400" /> OT {todayOTRecord.totalHours?.toFixed(2)}h
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-200 w-fit mx-auto sm:mx-0">
          <button onClick={() => setActiveMainTab('attendance')} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeMainTab === 'attendance' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><LayoutList size={16}/> Điểm Danh</button>
          <button onClick={() => setActiveMainTab('timekeeping')} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeMainTab === 'timekeeping' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><ClipboardCheck size={16}/> Chấm Công</button>
      </div>

      {activeMainTab === 'attendance' ? (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Bảng chi tiết điểm danh {isAdmin && "(Admin View)"}</h3>
                    </div>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <button onClick={handleAddStaff} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Plus size={20}/></button>
                            <button onClick={handleSaveSchedule} disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 active:scale-95 shadow-lg">
                                {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Lưu Nhân Sự
                            </button>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto w-full custom-scrollbar">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
                        <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-5 w-64 sticky left-0 bg-white z-20 border-r border-slate-100 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.08)]">Nhân sự</th>
                                {days.map(d => (
                                    <th key={d} className="py-5 text-center border-l border-slate-50 w-24 font-black">{d}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredStaffList.map((staff, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/10 transition-colors group">
                                    <td className="px-8 py-4 sticky left-0 bg-white z-20 border-r border-slate-100 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.08)]">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                {isAdmin ? (
                                                    <input className="w-full text-xs font-black text-slate-800 outline-none border-b border-transparent focus:border-indigo-400 bg-transparent" value={staff.name} onChange={(e) => handleUpdateStaff(idx, 'name', e.target.value)} />
                                                ) : <p className="text-xs font-black text-slate-800">{staff.name}</p>}
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">{staff.role}</p>
                                            </div>
                                            {isAdmin && (
                                                <button onClick={() => handleRemoveStaffMember(staff.username || '', staff.name)} className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><X size={14}/></button>
                                            )}
                                        </div>
                                    </td>
                                    {days.map(d => {
                                        const data = getAttendanceData(staff.username || staff.name, d);
                                        const ot = getOTData(staff.username || staff.name, d);
                                        return (
                                            <td key={d} className="p-1.5 text-center border-l border-slate-50">
                                                <div className="flex flex-col gap-1">
                                                    {data && <div className={`p-1 rounded-lg border text-[8px] font-black ${data.checkOut ? 'bg-indigo-50/50 border-indigo-100 text-indigo-700' : 'bg-amber-50 border-amber-200 animate-pulse text-amber-700'}`}>{data.checkIn?.slice(0,5)} - {data.checkOut?.slice(0,5) || "..."}</div>}
                                                    {ot && <div className="p-1 rounded-lg border bg-orange-50 border-orange-100 text-orange-700 text-[8px] font-black">OT: {ot.totalHours?.toFixed(2)}h</div>}
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

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Tổng kết giờ OT trong tháng</h3>
                </div>
                <div className="p-6">
                    <table className="w-full text-left text-xs">
                        <thead><tr className="text-[10px] text-slate-400 font-black uppercase border-b border-slate-100"><th className="py-4">Nhân sự</th><th className="text-center">Thường</th><th className="text-center">Cuối tuần</th><th className="text-center">Lễ</th><th className="text-center font-black text-slate-800">Tổng OT</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredStaffList.map(staff => {
                                const summary = calculateOTSummary(staff.username || staff.name);
                                const total = Math.round((summary.normal + summary.weekend + summary.holiday) * 100) / 100;
                                return (
                                    <tr key={staff.username || staff.name} className="hover:bg-slate-50 transition-colors font-bold text-slate-700">
                                        <td className="py-4">{staff.name}</td>
                                        <td className="text-center">{summary.normal}h</td><td className="text-center text-orange-600">{summary.weekend}h</td><td className="text-center text-rose-600">{summary.holiday}h</td>
                                        <td className="text-center font-black text-indigo-600">{total}h</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      ) : (
        /* TAB CHẤM CÔNG V32.0 */
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200/50 overflow-hidden animate-fade-in">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-[0.2em]">Bảng chấm công ký hiệu (S / C / HC / RC)</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                   {isAdmin && (
                      <button 
                        onClick={() => handleSaveFullTable()} 
                        disabled={isTableSyncing}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all mr-4"
                      >
                         {isTableSyncing ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Lưu Bảng Công
                      </button>
                   )}
                   <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500"></span><span className="text-[10px] font-black uppercase text-slate-400">S: Sáng</span></div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-[10px] font-black uppercase text-slate-400">C: Chiều</span></div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-[10px] font-black uppercase text-slate-400">HC: Hành chính</span></div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span><span className="text-[10px] font-black uppercase text-slate-400">RC: Ra ca</span></div>
                   </div>
                </div>
             </div>
             
             <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100">
                        <tr>
                            <th className="px-8 py-5 w-64 sticky left-0 bg-white z-20 border-r border-slate-100 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.08)]">Nhân sự</th>
                            {days.map(d => (
                                <th key={d} className="py-5 text-center border-l border-slate-50 w-12 font-black">{d}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredStaffList.map((staff, idx) => (
                            <tr key={idx} className="hover:bg-indigo-50/10 transition-colors group">
                                <td className="px-8 py-6 sticky left-0 bg-white z-20 border-r border-slate-100 shadow-[10px_0_15px_-10px_rgba(0,0,0,0.08)]">
                                    <p className="text-xs font-black text-slate-800">{staff.name}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{staff.role}</p>
                                </td>
                                {days.map(d => {
                                    const val = getTimekeepingValue(staff, d);
                                    const isManual = manualTimekeeping[staff.username || staff.name]?.[d];
                                    const dateObj = new Date(selectedYear, selectedMonth - 1, d);
                                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                    const isHoli = holidays.includes(`${getSelectedMonthStr()}-${d.toString().padStart(2, '0')}`);
                                    return (
                                        <td 
                                          key={d} 
                                          onDoubleClick={() => handleOpenManualModal(staff.username || staff.name || '', d, val)}
                                          className={`py-6 text-center border-l border-slate-50 font-black text-xs transition-all ${isAdmin ? 'cursor-pointer hover:bg-indigo-50/50' : ''} ${isWeekend ? 'bg-orange-50/10' : ''} ${isHoli ? 'bg-rose-50' : ''}`}
                                          title={isAdmin ? "Bấm đúp để chấm thủ công" : ""}
                                        >
                                            <span className={`${
                                              val === 'HC' ? 'text-emerald-600' : 
                                              val === 'S' ? 'text-indigo-600' : 
                                              val === 'C' ? 'text-blue-600' : 
                                              val === 'RC' ? 'text-orange-500 opacity-60' : 
                                              'text-slate-200'} ${isManual ? 'underline decoration-indigo-400 decoration-2 underline-offset-4 font-black text-indigo-900' : ''}`}>
                                                {val || (isHoli ? "L" : "")}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 font-bold italic">
                   <p className="flex items-center gap-1 text-indigo-600"><MousePointer2 size={12}/> Admin: Bấm đúp vào ô để nhập đè dữ liệu</p>
                   <p className="flex items-center gap-1 text-emerald-600"><FileSpreadsheet size={12}/> Nút "Lưu Bảng Công" sẽ ghi ma trận này vào Google Sheet tháng.</p>
                </div>
                <div className="flex items-center gap-2">
                   <span className="w-2.5 h-2.5 bg-orange-100 border border-orange-300 rounded shadow-sm"></span>
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">Dữ liệu sẽ tự động đồng bộ khi có điểm danh mới trong ngày.</span>
                </div>
             </div>
        </div>
      )}

      {/* --- MANUAL INPUT MODAL --- */}
      {manualInputModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 animate-slide-in">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 text-sm"><Edit2 size={16} className="text-indigo-600"/> Chấm công thủ công</h3>
                 <button onClick={() => setManualInputModal(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-all"><X size={20}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Nhân sự: {manualInputModal.username} - Ngày {manualInputModal.day}</p>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                       {['HC', 'S', 'C', 'RC'].map(code => (
                          <button key={code} onClick={() => setTempInputVal(code)} className={`py-3 rounded-xl text-xs font-black transition-all border-2 ${tempInputVal === code ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-indigo-200'}`}>{code}</button>
                       ))}
                    </div>
                    <div className="flex items-center gap-3">
                       <input type="text" value={tempInputVal} onChange={(e) => setTempInputVal(e.target.value.toUpperCase())} placeholder="Nhập mã khác..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                       <button onClick={() => setTempInputVal("")} className="p-3 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                 </div>
              </div>
              <div className="px-8 py-6 bg-gray-50 border-t border-slate-100 flex gap-3">
                 <button onClick={() => setManualInputModal(null)} className="flex-1 py-3.5 text-slate-400 font-black text-[10px] uppercase tracking-widest">Hủy</button>
                 <button onClick={handleSaveManualTime} disabled={isSaving} className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 flex items-center justify-center gap-2">
                   {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14} strokeWidth={3}/>} Lưu kết quả
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- CONFIRM DELETE STAFF MODAL --- */}
      {deleteStaffConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 animate-slide-in">
              <div className="p-8 text-center">
                 <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-rose-100"><AlertTriangle size={32} /></div>
                 <h3 className="text-xl font-black text-slate-900 uppercase mb-2 tracking-tight">Xác nhận xóa?</h3>
                 <p className="text-xs font-bold text-slate-500 leading-relaxed mb-8">Bạn có chắc chắn muốn xóa nhân sự <span className="text-rose-600 font-black">{deleteStaffConfirm.name}</span> khỏi bảng ca trực?</p>
                 <div className="flex gap-3">
                    <button onClick={() => setDeleteStaffConfirm(null)} className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">Hủy</button>
                    <button onClick={executeActualRemove} disabled={isSaving} className="flex-1 py-3.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2">
                       {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>} Xóa ngay
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagement;
