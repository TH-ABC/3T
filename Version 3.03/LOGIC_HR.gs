
/**
 * ==========================================
 * LOGIC_HR.GS: QUẢN LÝ NHÂN SỰ & ĐIỂM DANH V15.0
 * ==========================================
 */

// --- QUẢN LÝ LỊCH TRỰC ---
function getScheduleStaff() {
    const s = getSheet(SHEET_SCHEDULE_STAFF);
    const d = s.getDataRange().getValues();
    if (d.length <= 1) return [];
    d.shift();
    return d.map(r => ({ name: r[0], role: r[1], username: r[2] }));
}

function saveScheduleStaff(data) {
    const s = getSheet(SHEET_SCHEDULE_STAFF);
    s.clear();
    s.appendRow(['Name', 'Role', 'Username']);
    s.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f8f9fa");
    if (data.staffList && Array.isArray(data.staffList)) {
        data.staffList.forEach(item => {
            s.appendRow([item.name, item.role, item.username || '']);
        });
    }
    return { success: true };
}

function deleteScheduleStaffMember(username, name) {
    const s = getSheet(SHEET_SCHEDULE_STAFF);
    const d = s.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
        if (String(d[i][2]) === String(username) || String(d[i][0]) === String(name)) {
            s.deleteRow(i + 1);
            return { success: true };
        }
    }
    return { success: false, error: "Không tìm thấy nhân sự" };
}

// --- QUẢN LÝ ĐIỂM DANH (ATTENDANCE) ---
function getAttendance(monthStr) {
    const s = getSheet(SHEET_ATTENDANCE);
    const d = s.getDataRange().getValues();
    if (d.length <= 1) return [];
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

// --- TIMEKEEPING MANUAL V15.0 (Monthly Storage Logic) ---

/**
 * Lấy File ID của bảng chấm công tháng từ Index, tự tạo nếu chưa có
 */
function getOrCreateTimekeepingFile(monthStr) {
    const masterSS = SpreadsheetApp.getActiveSpreadsheet();
    let indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX);
    if (!indexSheet) {
        indexSheet = masterSS.insertSheet(SHEET_FILE_INDEX);
        indexSheet.appendRow(['Month', 'FileID', 'FileName', 'CreatedDate']);
        indexSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f8f9fa");
    }

    const data = indexSheet.getDataRange().getValues();
    const searchKey = "TIMEKEEPING_" + monthStr;
    
    for (let i = 1; i < data.length; i++) {
        const rowVal = String(data[i][0]);
        if (rowVal === searchKey || rowVal === monthStr) return data[i][1];
    }

    // Nếu chưa có, tạo mới file
    const fileName = `OMS_Timekeeping_${monthStr}`;
    const newSS = SpreadsheetApp.create(fileName);
    const fileId = newSS.getId();
    const s = newSS.getSheets()[0];
    s.setName("Summary_Report");
    s.appendRow(['Username', 'Name', 'Role', 'Days...']);
    s.getRange(1, 1, 1, 35).setFontWeight("bold").setBackground("#1e293b").setFontColor("white");
    s.setFrozenRows(1);

    indexSheet.appendRow([searchKey, fileId, fileName, new Date()]);
    return fileId;
}

function getManualTimekeeping(monthStr) {
    try {
        const fid = getOrCreateTimekeepingFile(monthStr);
        const ss = SpreadsheetApp.openById(fid);
        let s = ss.getSheetByName("Raw_Logs");
        if (!s) {
            s = ss.insertSheet("Raw_Logs");
            s.appendRow(['Username', 'Day', 'Value', 'Timestamp']);
        }
        const d = s.getDataRange().getValues();
        const map = {};
        for (let i = 1; i < d.length; i++) {
            const username = String(d[i][0]);
            const day = Number(d[i][1]);
            const value = String(d[i][2]);
            if (!map[username]) map[username] = {};
            map[username][day] = value;
        }
        return map;
    } catch(e) {
        return {};
    }
}

function saveManualTimekeeping(month, username, day, value) {
    try {
        const fid = getOrCreateTimekeepingFile(month);
        const ss = SpreadsheetApp.openById(fid);
        let s = ss.getSheetByName("Raw_Logs") || ss.insertSheet("Raw_Logs");
        if (s.getLastRow() === 0) s.appendRow(['Username', 'Day', 'Value', 'Timestamp']);

        const d = s.getDataRange().getValues();
        const searchUser = String(username);
        const searchDay = Number(day);

        for (let i = 1; i < d.length; i++) {
            if (String(d[i][0]) === searchUser && Number(d[i][1]) === searchDay) {
                s.getRange(i + 1, 3).setValue(value);
                s.getRange(i + 1, 4).setValue(new Date());
                return { success: true };
            }
        }
        s.appendRow([searchUser, searchDay, value, new Date()]);
        return { success: true };
    } catch(e) {
        return { success: false, error: e.toString() };
    }
}

/**
 * LƯU TOÀN BỘ MA TRẬN BẢNG CÔNG HIỂN THỊ VÀO GOOGLE SHEET (V32.0)
 */
function saveFullMonthlyTable(monthStr, matrix) {
    try {
        const fid = getOrCreateTimekeepingFile(monthStr);
        const ss = SpreadsheetApp.openById(fid);
        let s = ss.getSheetByName("Summary_Report") || ss.getSheets()[0];
        s.clear();
        
        // Header: [Name, Username, Role, 1, 2, ..., 31]
        const header = ["Nhân Sự", "Username", "Vai Trò"];
        for(let d=1; d<=31; d++) header.push(d.toString());
        s.appendRow(header);
        s.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("white");

        const rows = matrix.map(item => {
            const row = [item.name, item.username, item.role];
            for(let d=1; d<=31; d++) {
                row.push(item.data[d] || "");
            }
            return row;
        });

        if (rows.length > 0) {
            s.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
            // Định dạng màu sắc dựa trên nội dung (S, C, HC, RC)
            const range = s.getRange(2, 4, rows.length, 31);
            const rules = [
                SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("HC").setBackground("#dcfce7").setFontColor("#166534").build(),
                SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("S").setBackground("#e0e7ff").setFontColor("#3730a3").build(),
                SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("C").setBackground("#dbeafe").setFontColor("#1e40af").build(),
                SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("RC").setBackground("#fff7ed").setFontColor("#9a3412").build()
            ];
            s.setConditionalFormatRules(rules);
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: e.toString() };
    }
}

// --- OT FUNCTIONS ---
function getOTAttendance(monthStr) {
    const s = getSheet(SHEET_OT_ATTENDANCE);
    const d = s.getDataRange().getValues();
    if (d.length <= 1) return [];
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
    if (d.length <= 1) return [];
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
    const dayOfWeek = date.getDay(); 
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
                let diff = endSec - startSec;
                if (diff < 0) diff += 86400;
                const hours = Math.round((diff / 3600) * 100) / 100;
                s.getRange(i+1, 5).setValue("'" + nowTime);
                s.getRange(i+1, 6).setValue(hours);
                return { success: true };
            } else {
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

// --- QUẢN LÝ TÀI KHOẢN ---
function getUsers() {
    const d = getSheet(SHEET_USERS).getDataRange().getValues(); 
    if (d.length <= 1) return [];
    d.shift();
    return d.map(r => ({ 
        username: r[0], password: r[1], fullName: r[2], role: r[3], 
        email: r[4], phone: r[5], status: r[6], 
        permissions: JSON.parse(r[7] || '{}') 
    }));
}

function getRoles() {
    const d = getSheet(SHEET_ROLES).getDataRange().getValues(); 
    if (d.length <= 1) return [{name: 'Admin', level: 1}, {name: 'CEO', level: 1}, {name: 'Leader', level: 2}, {name: 'Support', level: 3}, {name: 'Designer', level: 4}, {name: 'Designer Online', level: 4}];
    d.shift();
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
function handleLogout(username, type) {
    getSheet(SHEET_LOGS).appendRow([new Date(), username, type || 'LOGOUT', '']);
    return { success: true };
}
