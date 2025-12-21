
/**
 * ==========================================
 * LOGIC_HR.GS: QUẢN LÝ NHÂN SỰ & HỆ THỐNG
 * ==========================================
 */

// --- QUẢN LÝ LỊCH TRỰC ---
function getScheduleStaff() {
    const s = getSheet(SHEET_SCHEDULE_STAFF);
    const d = s.getDataRange().getValues();
    d.shift();
    return d.map(r => ({ name: r[0], role: r[1], username: r[2] }));
}

function saveScheduleStaff(data) {
    const s = getSheet(SHEET_SCHEDULE_STAFF);
    s.clear();
    s.appendRow(['Name', 'Role', 'Username']);
    if (data.staffList && Array.isArray(data.staffList)) {
        data.staffList.forEach(item => {
            s.appendRow([item.name, item.role, item.username || '']);
        });
    }
    return { success: true };
}

// --- QUẢN LÝ ĐIỂM DANH (ATTENDANCE) ---
function getAttendance(monthStr) {
    const s = getSheet(SHEET_ATTENDANCE);
    const d = s.getDataRange().getValues();
    d.shift();
    return d.filter(r => formatDate(r[0]).startsWith(monthStr)).map(r => {
        var cIn = r[3]; var cOut = r[4];
        if (cIn instanceof Date) cIn = Utilities.formatDate(cIn, "GMT+7", "HH:mm:ss");
        if (cOut instanceof Date) cOut = Utilities.formatDate(cOut, "GMT+7", "HH:mm:ss");
        return {
            date: formatDate(r[0]), username: r[1], name: r[2],
            checkIn: String(cIn || ""), checkOut: String(cOut || ""),
            totalHours: Number(r[5]) || 0
        };
    });
}

function checkIn(username, name) {
    const s = getSheet(SHEET_ATTENDANCE);
    const nowFull = new Date();
    const today = Utilities.formatDate(nowFull, "GMT+7", "yyyy-MM-dd");
    const nowTime = Utilities.formatDate(nowFull, "GMT+7", "HH:mm:ss"); 
    const data = s.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
        const rowDate = data[i][0] instanceof Date ? Utilities.formatDate(data[i][0], "GMT+7", "yyyy-MM-dd") : String(data[i][0]).split(' ')[0];
        if(String(data[i][1]) === String(username) && rowDate === today) return { success: false, error: 'Bạn đã điểm danh vào ca hôm nay rồi.' };
    }
    s.appendRow([nowFull, username, name, "'" + nowTime, '', '']);
    return { success: true };
}

function checkOut(username, name) {
    const s = getSheet(SHEET_ATTENDANCE);
    const nowFull = new Date();
    const today = Utilities.formatDate(nowFull, "GMT+7", "yyyy-MM-dd");
    const nowTime = Utilities.formatDate(nowFull, "GMT+7", "HH:mm:ss");
    const data = s.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
        const rowDate = data[i][0] instanceof Date ? Utilities.formatDate(data[i][0], "GMT+7", "yyyy-MM-dd") : String(data[i][0]).split(' ')[0];
        if(String(data[i][1]) === String(username) && rowDate === today) {
            let checkInTimeStr = data[i][3];
            let hours = 0;
            if(checkInTimeStr) {
                try {
                    if (checkInTimeStr instanceof Date) checkInTimeStr = Utilities.formatDate(checkInTimeStr, "GMT+7", "HH:mm:ss");
                    const partsIn = String(checkInTimeStr).split(':').map(Number);
                    const partsOut = String(nowTime).split(':').map(Number);
                    const startTotalSec = partsIn[0] * 3600 + partsIn[1] * 60 + (partsIn[2] || 0);
                    const endTotalSec = partsOut[0] * 3600 + partsOut[1] * 60 + (partsOut[2] || 0);
                    let diffSec = endTotalSec - startTotalSec;
                    if (diffSec < 0) diffSec += 86400;
                    hours = Math.round((diffSec / 3600) * 100) / 100;
                } catch(e) { hours = 0; }
            }
            s.getRange(i+1, 5).setValue("'" + nowTime);
            s.getRange(i+1, 6).setValue(hours);
            return { success: true };
        }
    }
    return { success: false, error: 'Không tìm thấy dữ liệu Bắt đầu ca hôm nay.' };
}

// --- OT FUNCTIONS ---
function getOTAttendance(monthStr) {
    const s = getSheet(SHEET_OT_ATTENDANCE);
    const d = s.getDataRange().getValues();
    d.shift();
    return d.filter(r => formatDate(r[0]).startsWith(monthStr)).map(r => {
        var cIn = r[3]; var cOut = r[4];
        if (cIn instanceof Date) cIn = Utilities.formatDate(cIn, "GMT+7", "HH:mm:ss");
        if (cOut instanceof Date) cOut = Utilities.formatDate(cOut, "GMT+7", "HH:mm:ss");
        return {
            date: formatDate(r[0]), username: r[1], name: r[2],
            checkIn: String(cIn || ""), checkOut: String(cOut || ""),
            totalHours: Number(r[5]) || 0, type: r[6]
        };
    });
}

function getHolidays(monthStr) {
    const s = getSheet(SHEET_HOLIDAYS);
    const d = s.getDataRange().getValues();
    d.shift();
    return d.map(r => {
        if (r[0] instanceof Date) return Utilities.formatDate(r[0], "GMT+7", "yyyy-MM-dd");
        return String(r[0]).split(' ')[0];
    }).filter(str => str.startsWith(monthStr));
}

function toggleHoliday(dateStr) {
    const s = getSheet(SHEET_HOLIDAYS);
    const d = s.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
        let rowDate = "";
        if (d[i][0] instanceof Date) rowDate = Utilities.formatDate(d[i][0], "GMT+7", "yyyy-MM-dd");
        else rowDate = String(d[i][0]).split(' ')[0];
        
        if (rowDate === dateStr) {
            s.deleteRow(i + 1);
            return { success: true, isHoliday: false };
        }
    }
    s.appendRow([new Date(dateStr.replace(/-/g, '/'))]); 
    return { success: true, isHoliday: true };
}

function determineOTType(date) {
    const dateStr = Utilities.formatDate(date, "GMT+7", "yyyy-MM-dd");
    const holidays = getHolidays(dateStr.substring(0, 7));
    if (holidays.includes(dateStr)) return 'Holiday';
    const dayOfWeek = date.getDay(); // 0: CN, 6: T7
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'Weekend';
    return 'Normal';
}

function checkInOT(username, name) {
    const s = getSheet(SHEET_OT_ATTENDANCE);
    const nowFull = new Date();
    const today = Utilities.formatDate(nowFull, "GMT+7", "yyyy-MM-dd");
    const nowTime = Utilities.formatDate(nowFull, "GMT+7", "HH:mm:ss");
    
    let otType = determineOTType(nowFull);

    const data = s.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
        const rowDate = data[i][0] instanceof Date ? Utilities.formatDate(data[i][0], "GMT+7", "yyyy-MM-dd") : String(data[i][0]).split(' ')[0];
        if(String(data[i][1]) === String(username) && rowDate === today && !data[i][4]) {
            return { success: false, error: 'Bạn đang có một ca OT chưa kết thúc.' };
        }
    }
    s.appendRow([nowFull, username, name, "'" + nowTime, '', '', otType]);
    return { success: true };
}

function checkOutOT(username, name) {
    const s = getSheet(SHEET_OT_ATTENDANCE);
    const nowFull = new Date(); 
    const todayDateStr = Utilities.formatDate(nowFull, "GMT+7", "yyyy-MM-dd");
    
    const data = s.getDataRange().getValues();
    for(let i=data.length - 1; i>=1; i--) {
        if(String(data[i][1]) === String(username) && !data[i][4]) {
            const checkInFullDate = new Date(data[i][0]);
            const checkInDateStr = Utilities.formatDate(checkInFullDate, "GMT+7", "yyyy-MM-dd");
            
            if (checkInDateStr === todayDateStr) {
                const nowTime = Utilities.formatDate(nowFull, "GMT+7", "HH:mm:ss");
                let checkInTimeStr = data[i][3];
                if (checkInTimeStr instanceof Date) checkInTimeStr = Utilities.formatDate(checkInTimeStr, "GMT+7", "HH:mm:ss");
                const partsIn = String(checkInTimeStr).split(':').map(Number);
                const partsOut = String(nowTime).split(':').map(Number);
                const startSec = partsIn[0] * 3600 + partsIn[1] * 60 + (partsIn[2] || 0);
                const endSec = partsOut[0] * 3600 + partsOut[1] * 60 + (partsOut[2] || 0);
                const hours = Math.round(((endSec - startSec) / 3600) * 100) / 100;
                s.getRange(i+1, 5).setValue("'" + nowTime);
                s.getRange(i+1, 6).setValue(hours);
                return { success: true };
            } else {
                // Xuyên đêm
                const endOfPrevDayTime = "23:59:59";
                let checkInTimeStr = data[i][3];
                if (checkInTimeStr instanceof Date) checkInTimeStr = Utilities.formatDate(checkInTimeStr, "GMT+7", "HH:mm:ss");
                const partsIn = String(checkInTimeStr).split(':').map(Number);
                const startSec = partsIn[0] * 3600 + partsIn[1] * 60 + (partsIn[2] || 0);
                const midnightSec = 23 * 3600 + 59 * 60 + 59;
                const hoursPrev = Math.round(((midnightSec - startSec + 1) / 3600) * 100) / 100;
                s.getRange(i+1, 5).setValue("'" + endOfPrevDayTime);
                s.getRange(i+1, 6).setValue(hoursPrev);
                
                const startOfTodayTime = "00:00:00";
                const nowTime = Utilities.formatDate(nowFull, "GMT+7", "HH:mm:ss");
                const partsOut = String(nowTime).split(':').map(Number);
                const endSecToday = partsOut[0] * 3600 + partsOut[1] * 60 + (partsOut[2] || 0);
                const hoursToday = Math.round((endSecToday / 3600) * 100) / 100;
                const otTypeToday = determineOTType(nowFull);
                s.appendRow([nowFull, username, name, "'" + startOfTodayTime, "'" + nowTime, hoursToday, otTypeToday]);
                return { success: true, message: "Đã tách ca xuyên đêm để tính giờ chính xác." };
            }
        }
    }
    return { success: false, error: 'Không tìm thấy ca OT đang chạy.' };
}

// --- QUẢN LÝ TÀI KHOẢN (USER MANAGEMENT) ---
function getUsers() {
    const d = getSheet(SHEET_USERS).getDataRange().getValues(); 
    d.shift();
    return d.map(r => ({ 
        username: r[0], password: r[1], fullName: r[2], role: r[3], 
        email: r[4], phone: r[5], status: r[6], 
        permissions: JSON.parse(r[7] || '{}') 
    }));
}

function getRoles() {
    const d = getSheet(SHEET_ROLES).getDataRange().getValues(); 
    d.shift();
    const defaultRoles = [{name: 'Admin', level: 1}, {name: 'CEO', level: 1}, {name: 'Leader', level: 2}, {name: 'Support', level: 3}, {name: 'Designer', level: 4}, {name: 'Designer Online', level: 4}];
    if (d.length === 0) return defaultRoles;
    return d.map(r => ({ name: r[0], level: r[1] }));
}

function addRole(name, level) { getSheet(SHEET_ROLES).appendRow([name, level]); return { success: true }; }
function createUser(u, p, f, r, e, ph, perms) {
    const s = getSheet(SHEET_USERS); const d = s.getDataRange().getValues();
    for(let i = 1; i < d.length; i++) if(String(d[i][0]) == u) return { success: false, error: 'Tài khoản này đã tồn tại.' };
    s.appendRow([u, p, f, r, e, ph, 'Active', JSON.stringify(perms || {})]);
    return { success: true };
}
function updateUser(u, r, st, perms) {
    const s = getSheet(SHEET_USERS); const d = s.getDataRange().getValues();
    for(let i = 1; i < d.length; i++) if(String(d[i][0]) == u) { if(r) s.getRange(i+1, 4).setValue(r); if(st) s.getRange(i+1, 7).setValue(st); if(perms) s.getRange(i+1, 8).setValue(JSON.stringify(perms)); return { success: true }; }
    return { success: false };
}
function handleChangePassword(u, o, n) {
    const s = getSheet(SHEET_USERS); const d = s.getDataRange().getValues();
    for(let i = 1; i < d.length; i++) if(String(d[i][0]) == u && String(d[i][1]) == o) { s.getRange(i+1, 2).setValue(n); return { success: true }; }
    return { success: false, error: "Mật khẩu cũ không chính xác." };
}
function handleLogin(u, p, ip) {
    const d = getSheet(SHEET_USERS).getDataRange().getValues();
    for(let i = 1; i < d.length; i++) if(String(d[i][0]) == String(u) && String(d[i][1]) == String(p)) {
        if(d[i][6] !== 'Active') return { success: false, error: 'Tài khoản đang bị khóa.' };
        getSheet(SHEET_LOGS).appendRow([new Date(), u, 'LOGIN', ip]);
        return { success: true, user: { username: d[i][0], fullName: d[i][2], role: d[i][3], permissions: JSON.parse(d[i][7] || '{}') } };
    }
    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
}
