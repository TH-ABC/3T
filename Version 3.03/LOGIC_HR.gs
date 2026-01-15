
/**
 * ==========================================
 * LOGIC_HR.GS: QUẢN LÝ NHÂN SỰ & ĐIỂM DANH V18.0
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
    // Tự động khởi tạo headers nếu bảng trống (Quan trọng: Sửa lỗi Admin phải bấm trước)
    if (s.getLastRow() === 0) {
        s.appendRow(['Date', 'Username', 'Name', 'CheckIn', 'CheckOut', 'TotalHours']);
        s.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f8f9fa");
        s.setFrozenRows(1);
    }
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

// --- TIMEKEEPING MANUAL ---
function getOrCreateTimekeepingFile(monthStr) {
    const masterSS = SpreadsheetApp.getActiveSpreadsheet();
    let indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX);
    if (!indexSheet) {
        indexSheet = masterSS.insertSheet(SHEET_FILE_INDEX);
        indexSheet.appendRow(['Month', 'FileID', 'FileName', 'CreatedDate']);
    }
    const data = indexSheet.getDataRange().getValues();
    const searchKey = "TIMEKEEPING_" + monthStr;
    for (let i = 1; i < data.length; i++) if (String(data[i][0]) === searchKey || String(data[i][0]) === monthStr) return data[i][1];
    const fileName = `OMS_Timekeeping_${monthStr}`;
    const newSS = SpreadsheetApp.create(fileName);
    const fileId = newSS.getId();
    const s = newSS.getSheets()[0];
    s.setName("Summary_Report");
    s.appendRow(['Username', 'Name', 'Role', 'Days...']);
    s.setFrozenRows(1);
    indexSheet.appendRow([searchKey, fileId, fileName, new Date()]);
    return fileId;
}

function getManualTimekeeping(monthStr) {
    try {
        const fid = getOrCreateTimekeepingFile(monthStr);
        const ss = SpreadsheetApp.openById(fid);
        let s = ss.getSheetByName("Raw_Logs") || ss.insertSheet("Raw_Logs");
        if (s.getLastRow() === 0) s.appendRow(['Username', 'Day', 'Value', 'Timestamp']);
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
    } catch(e) { return {}; }
}

function saveManualTimekeeping(month, username, day, value) {
    try {
        const fid = getOrCreateTimekeepingFile(month);
        const ss = SpreadsheetApp.openById(fid);
        let s = ss.getSheetByName("Raw_Logs") || ss.insertSheet("Raw_Logs");
        if (s.getLastRow() === 0) s.appendRow(['Username', 'Day', 'Value', 'Timestamp']);
        const d = s.getDataRange().getValues();
        for (let i = 1; i < d.length; i++) {
            if (String(d[i][0]) === String(username) && Number(d[i][1]) === Number(day)) {
                s.getRange(i + 1, 3).setValue(value);
                s.getRange(i + 1, 4).setValue(new Date());
                return { success: true };
            }
        }
        s.appendRow([username, day, value, new Date()]);
        return { success: true };
    } catch(e) { return { success: false, error: e.toString() }; }
}

function saveFullMonthlyTable(monthStr, matrix) {
    try {
        const fid = getOrCreateTimekeepingFile(monthStr);
        const ss = SpreadsheetApp.openById(fid);
        let s = ss.getSheetByName("Summary_Report") || ss.getSheets()[0];
        s.clear();
        const header = ["Nhân Sự", "Username", "Vai Trò"];
        for(let d=1; d<=31; d++) header.push(d.toString());
        s.appendRow(header);
        s.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("white");
        const rows = matrix.map(item => {
            const row = [item.name, item.username, item.role];
            for(let d=1; d<=31; d++) row.push(item.data[d] || "");
            return row;
        });
        if (rows.length > 0) s.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        return { success: true };
    } catch (e) { return { success: false, error: e.toString() }; }
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
        return { date: formatDate(r[0]), username: r[1], name: r[2], checkIn: String(cIn || ""), checkOut: String(cOut || ""), totalHours: Number(r[5]) || 0, type: r[6] };
    });
}

function getHolidays(monthStr) {
    const s = getSheet(SHEET_HOLIDAYS);
    const d = s.getDataRange().getValues();
    if (d.length <= 1) return [];
    d.shift();
    return d.map(r => r[0] instanceof Date ? Utilities.formatDate(r[0], "GMT+7", "yyyy-MM-dd") : String(r[0]).split(' ')[0]).filter(str => str.startsWith(monthStr));
}

function toggleHoliday(dateStr) {
    const s = getSheet(SHEET_HOLIDAYS);
    const d = s.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
        let rowDate = d[i][0] instanceof Date ? Utilities.formatDate(d[i][0], "GMT+7", "yyyy-MM-dd") : String(d[i][0]).split(' ')[0];
        if (rowDate === dateStr) { s.deleteRow(i + 1); return { success: true, isHoliday: false }; }
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
    // Tự động khởi tạo headers nếu bảng trống
    if (s.getLastRow() === 0) {
        s.appendRow(['Date', 'Username', 'Name', 'CheckIn', 'CheckOut', 'TotalHours', 'Type']);
        s.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#fff3e0");
        s.setFrozenRows(1);
    }
    const nowFull = new Date();
    const today = Utilities.formatDate(nowFull, "GMT+7", "yyyy-MM-dd");
    const nowTime = Utilities.formatDate(nowFull, "GMT+7", "HH:mm:ss");
    let otType = determineOTType(nowFull);
    const data = s.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
        const rowDate = data[i][0] instanceof Date ? Utilities.formatDate(data[i][0], "GMT+7", "yyyy-MM-dd") : String(data[i][0]).split(' ')[0];
        if(String(data[i][1]) === String(username) && rowDate === today && !data[i][4]) return { success: false, error: 'Bạn đang có một ca OT chưa kết thúc.' };
    }
    s.appendRow([nowFull, username, name, "'" + nowTime, '', '', otType]);
    return { success: true };
}

function checkOutOT(username, name) {
    const s = getSheet(SHEET_OT_ATTENDANCE);
    const nowFull = new Date(); 
    const data = s.getDataRange().getValues();
    for(let i=data.length - 1; i>=1; i--) {
        if(String(data[i][1]) === String(username) && !data[i][4]) {
            const nowTime = Utilities.formatDate(nowFull, "GMT+7", "HH:mm:ss");
            let inStr = data[i][3]; 
            if (inStr instanceof Date) inStr = Utilities.formatDate(inStr, "GMT+7", "HH:mm:ss");
            
            const partsIn = String(inStr).split(':').map(Number); 
            const partsOut = String(nowTime).split(':').map(Number);
            const startSec = partsIn[0] * 3600 + partsIn[1] * 60 + (partsIn[2] || 0); 
            const endSec = partsOut[0] * 3600 + partsOut[1] * 60 + (partsOut[2] || 0);
            
            let diff = endSec - startSec; 
            if (diff < 0) diff += 86400; 
            
            s.getRange(i+1, 5).setValue("'" + nowTime); 
            s.getRange(i+1, 6).setValue(Math.round((diff / 3600) * 100) / 100);
            return { success: true };
        }
    }
    return { success: false, error: 'Không tìm thấy ca OT đang chạy.' };
}
