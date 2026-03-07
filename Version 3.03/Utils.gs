/**
 * ==========================================
 * UTILS.GS: CÔNG CỤ HỖ TRỢ LÕI V8.7 (STABLE)
 * ==========================================
 */

function getSheet(n) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName(n);
    if (!s) {
        s = ss.insertSheet(n);
        if (n === SHEET_STORES) s.appendRow(['ID','Name','URL','Region','Status','Listing','Sale']);
        else if (n === SHEET_USERS) s.appendRow(['Username','Password','FullName','Role','Email','Phone','Status','Permissions']);
        else if (n === SHEET_NEWS) s.appendRow(['ID','Title','Content','ImageUrl','Author','Timestamp','IsLocked']);
        else if (n === SHEET_NEWS_COMMENTS) s.appendRow(['ID','NewsID','Username','Comment','Timestamp']);
        else if (n === SHEET_NEWS_LIKES) s.appendRow(['NewsID','Username']);
        else if (n === SHEET_FILE_INDEX) s.appendRow(['Month','FileID','FileName','CreatedDate']);
        else if (n === SHEET_PL_SKU) s.appendRow(['STT', 'SKU', 'Phân Loại']);
        else if (n === SHEET_PRICES) s.appendRow(['Category', 'Price']);
        else if (n === SHEET_USER_READ_STATUS) s.appendRow(['Username', 'LastReadTimestamp']);
        else if (n === SHEET_SCHEDULE_STAFF) s.appendRow(['Name', 'Role', 'Username']);
        else if (n === SHEET_ATTENDANCE) s.appendRow(['Date', 'Username', 'Name', 'CheckIn', 'CheckOut', 'TotalHours']);
        else if (n === SHEET_OT_ATTENDANCE) s.appendRow(['Date', 'Username', 'Name', 'CheckIn', 'CheckOut', 'TotalHours', 'Type']);
        else if (n === SHEET_HOLIDAYS) s.appendRow(['Date']);
        else if (n === SHEET_HANDOVER) s.appendRow(['ID', 'Date', 'Task', 'Assignee', 'DeadlineAt', 'Priority', 'Status', 'StartTime', 'EndTime', 'Report', 'FileLink', 'ImageLink', 'CreatedBy', 'ResultLink', 'Progress']);
        else if (n === SHEET_USER_NOTES) s.appendRow(['Username', 'Date', 'ItemsJSON']);
        else if (n === SHEET_AI_INSIGHTS) 
            s.appendRow(['Key', 'Content', 'UpdatedDate']); // Key = YYYY-MM
        else if (n === SHEET_FINANCE_META) {
            s.appendRow(['Categories', 'Payers', 'SubCategories']);
            s.appendRow(['Chi Tiền', 'Công Ty', 'Sinh hoạt']);
            s.appendRow(['Thu Tiền', 'A Tâm', 'Đơn hàng']);
            s.appendRow(['', 'Hoàng', 'Lương']);
        }
        s.getRange(1, 1, 1, s.getLastColumn()).setFontWeight("bold").setBackground("#f8f9fa");
        s.setFrozenRows(1);
    }
    return s;
}

/**
 * Logic tìm kiếm File ID thông minh v8.5+
 * Hỗ trợ đa định dạng: yyyy-MM, MM/yyyy, T01-yyyy...
 * @param {string} month - Tháng cần tìm
 * @param {string} type - Loại file (Orders, Timekeeping, Finance)
 */
function getFileIdForMonth(month, type) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName(SHEET_FILE_INDEX);
    if (!indexSheet) return null;
    const d = indexSheet.getDataRange().getValues();

    // FIX: Chuẩn hoá month đầu vào về yyyy-MM để tránh trả nhầm file
    // Đối với Finance, nếu month chỉ là năm (4 chữ số), ta không bắt buộc normalize về yyyy-MM
    let targetMonth = normalizeMonthYYYYMM(month);
    let isYearOnly = false;
    if (!targetMonth && type === "Finance" && /^\d{4}$/.test(String(month).trim())) {
        targetMonth = String(month).trim();
        isYearOnly = true;
    }
    
    if (!targetMonth) return null;

    const [targetY, targetM] = isYearOnly ? [targetMonth, ""] : targetMonth.split('-');
    const prefix = type === "Timekeeping" ? "OMS_Timekeeping_" : (type === "Finance" ? "OMS_Finance_" : "OMS_Orders_");
    const targetFileName = isYearOnly ? prefix + targetMonth : prefix + targetMonth;
    const shortTName = "T" + targetM; // T03
    const shortTNameNoZero = "T" + parseInt(targetM); // T3

    // Duyệt ngược từ dưới lên để lấy file mới nhất nếu trùng tên/tháng
    for (let i = d.length - 1; i >= 1; i--) {
        let cellA = d[i][0]; // Cột Month
        let fileId = d[i][1]; // Cột FileID
        let cellC = String(d[i][2] || "").trim(); // Cột FileName
        let cellCUpper = cellC.toUpperCase();

        // 1. Khớp tên file chính xác (Ưu tiên cao nhất)
        if (cellC === targetFileName) return fileId;

        // Nếu có type, chỉ xét các file có prefix tương ứng hoặc chứa type trong tên
        if (type && !cellCUpper.includes(type.toUpperCase()) && !cellCUpper.startsWith("OMS_" + type.toUpperCase())) {
            // Nếu không khớp prefix nhưng cellA khớp month thì vẫn có thể là file cũ/đổi tên
            // Tuy nhiên nếu cellC có prefix loại khác (vd: đang tìm Orders mà gặp Timekeeping) thì bỏ qua
            if (type === "Orders" && cellCUpper.includes("TIMEKEEPING")) continue;
            if (type === "Timekeeping" && cellCUpper.includes("ORDERS")) continue;
        }

        // 2. Chuẩn hóa giá trị ô ngày tháng (Cell A)
        let mStr = "";
        if (cellA instanceof Date) {
            mStr = Utilities.formatDate(cellA, "GMT+7", 'yyyy-MM');
        } else {
            mStr = normalizeMonthYYYYMM(cellA) || String(cellA).trim();
        }

        // Nếu khớp trực tiếp yyyy-MM (vd: 2026-03)
        if (mStr === targetMonth) return fileId;

        // 3. Khớp tên file ngắn (vd: T03) - Cần check thêm năm ở mStr nếu có
        if (cellCUpper === shortTName || cellCUpper === shortTNameNoZero) {
            if (mStr && mStr.startsWith(targetY)) return fileId;
            if (!mStr || mStr.length < 4) return fileId; // Fallback nếu không có thông tin năm
        }
        
        if (cellCUpper.includes(targetMonth)) return fileId;

        // 4. Logic so khớp nâng cao cho các định dạng đặc biệt trong mStr
        try {
            // Trường hợp: MM/yyyy hoặc M/yyyy
            if (mStr.indexOf('/') !== -1) {
                let p = mStr.split('/');
                if (p.length === 2) {
                    let m = p[0].padStart(2, '0');
                    let y = p[1];
                    if (`${y}-${m}` === targetMonth) return fileId;
                }
            }

            // Trường hợp: T01-2024 hoặc T1-2024
            if (mStr.toUpperCase().startsWith('T')) {
                let p = mStr.split('-');
                if (p.length === 2) {
                    let m = p[0].substring(1).padStart(2, '0');
                    let y = p[1];
                    if (`${y}-${m}` === targetMonth) return fileId;
                } else if (p.length === 1) {
                    let m = mStr.substring(1).padStart(2, '0');
                    if (m === targetM) return fileId;
                }
            }
        } catch (e) {}
    }
    return null;
}

function createNewMonthFile(month) {
    // FIX: Chuẩn hoá month để tạo file đúng chuẩn OMS_Orders_yyyy-MM
    const m = normalizeMonthYYYYMM(month);
    const name = `OMS_Orders_${m}`;
    const ss = SpreadsheetApp.create(name);
    const headers = ['Date', 'OrderID', 'Store', 'DonVi', 'SKU', 'Quantity', 'Tracking', 'Link', 'Status', 'Note', 'Handler', 'ActionRole', 'Checked', 'Design Done', 'F.Name', 'L.Name', 'Address1', 'Address2', 'City', 'State', 'Zip', 'Country', 'Phone', 'Product Name', 'Item SKU', 'URL Mockup', 'Mockup Type', 'Is Fulfilled', 'URL Artwork Front', 'URL Artwork Back'];
    ss.getSheets()[0].appendRow(headers);
    ss.getSheets()[0].getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a4019").setFontColor("white");
    ss.getSheets()[0].setFrozenRows(1);
    getSheet(SHEET_FILE_INDEX).appendRow([m, ss.getId(), name, new Date()]);
    return ss.getId();
}

function getFinanceFileId(year) {
    const d = getSheet(SHEET_FILE_INDEX).getDataRange().getValues();
    const t = "OMS_Finance_" + year;
    for (let i = 1; i < d.length; i++)
        if (String(d[i][2]) === t) return d[i][1];
    return null;
}

function createFinanceFile(year) {
    const n = "OMS_Finance_" + year;
    const ss = SpreadsheetApp.create(n);

    const s1 = ss.getSheets()[0];
    s1.setName("Transactions");
    s1.appendRow(['ID', 'Category', 'SubCategory', 'Description', 'Date', 'Qty', 'UnitPrice', 'Total', 'Payer', 'Note', 'Timestamp']);
    s1.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#e0f2f1");
    s1.setFrozenRows(1);

    const s2 = ss.insertSheet("Payments");
    s2.appendRow(['ID', 'Store Name', 'Amount', 'Region', 'Converted USD', 'Date', 'Timestamp']);
    s2.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#fff3e0");
    s2.setFrozenRows(1);

    const s3 = ss.insertSheet("Printway");
    s3.appendRow(['Invoice ID', 'Type', 'Status', 'Date', 'Method', 'Amount, USD', 'Payment gateway fee', 'Total amount', 'Note', 'Loại']);
    s3.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#e8f5e9");
    s3.setFrozenRows(1);

    getSheet(SHEET_FILE_INDEX).appendRow([year, ss.getId(), n, new Date()]);
    return { success: true, fileId: ss.getId() };
}

function formatDate(d) {
    if (!d) return "";
    try {
        if (d instanceof Date) return Utilities.formatDate(d, "GMT+7", 'yyyy-MM-dd HH:mm:ss');
        
        // Nếu là string, kiểm tra xem có phải định dạng ngày VN không (dd/mm/yyyy)
        // Tránh dùng new Date() trực tiếp trên string vì Apps Script parse không ổn định (nhầm tháng/ngày)
        const s = String(d).trim();
        if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(s)) return s;
        if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(s)) return s;

        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, "GMT+7", 'yyyy-MM-dd HH:mm:ss');
        return s;
    } catch(e) {
        return String(d);
    }
}

function getData(n) {
    const s = getSheet(n);
    const d = s.getDataRange().getValues();
    const h = d.shift();
    return d.map(r => {
        let o = {};
        h.forEach((k, i) => { o[k.toLowerCase()] = r[i]; });
        return o;
    });
}

function addRow(n, r) {
    getSheet(n).appendRow(r);
    return { success: true };
}

function deleteRow(n, id) {
    const s = getSheet(n);
    const d = s.getDataRange().getValues();
    for (let i = d.length - 1; i >= 1; i--)
        if (String(d[i][0]) == String(id)) {
            s.deleteRow(i + 1);
            return { success: true };
        }
    return { error: 'Not found' };
}


/**
 * Chuẩn hoá month về "YYYY-MM"
 * Input hỗ trợ:
 * - "YYYY-MM" / "YYYY-M"
 * - "MM/YYYY" / "M/YYYY"
 * - "T01-2024" / "T1-2024"
 * Return: "YYYY-MM" hoặc null nếu sai
 */
function normalizeMonthYYYYMM(month) {
    if (month === null || month === undefined) return null;

    // Nếu là Date
    if (month instanceof Date) {
        return Utilities.formatDate(month, "GMT+7", "yyyy-MM");
    }

    let mStr = String(month).trim();
    if (!mStr) return null;

    // Case: TIMEKEEPING_2026-03 -> 2026-03
    if (mStr.toUpperCase().includes("TIMEKEEPING_")) {
        mStr = mStr.toUpperCase().replace("TIMEKEEPING_", "");
    }

    // Case: YYYY-MM or YYYY-M
    if (mStr.indexOf("-") !== -1 && mStr.length >= 6) {
        let p = mStr.split("-");
        if (p.length === 2 && p[0].length === 4) {
            let y = p[0];
            let m = String(p[1]).padStart(2, "0");
            if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m)) {
                let mm = parseInt(m, 10);
                if (mm >= 1 && mm <= 12) return `${y}-${m}`;
            }
        }
    }

    // Case: MM/YYYY or M/YYYY
    if (mStr.indexOf("/") !== -1) {
        let p = mStr.split("/");
        if (p.length === 2) {
            let m = String(p[0]).padStart(2, "0");
            let y = String(p[1]).trim();
            if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m)) {
                let mm = parseInt(m, 10);
                if (mm >= 1 && mm <= 12) return `${y}-${m}`;
            }
        }
    }

    // Case: T01-2024 or T1-2024
    if (mStr.toUpperCase().startsWith("T")) {
        let p = mStr.split("-");
        if (p.length === 2) {
            let m = String(p[0].substring(1)).padStart(2, "0");
            let y = String(p[1]).trim();
            if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m)) {
                let mm = parseInt(m, 10);
                if (mm >= 1 && mm <= 12) return `${y}-${m}`;
            }
        }
    }

    return null;
}

/**
 * STRICT helper: lấy đúng sheet Orders theo tháng.
 * - ss: Spreadsheet object
 * - monthInput: 'YYYY-MM' hoặc 'MM/YYYY'
 * - Trả về { sheet, sheetName, month, error }
 */
function getOrdersSheetStrict(ss, monthInput) {
  const month = normalizeMonthYYYYMM(monthInput);
  if (!month) return { sheet: null, error: "Sai month. Cần 'YYYY-MM' hoặc 'MM/YYYY' (vd: 2026-02 hoặc 02/2026)." };

  const name = `OMS_Orders_${month}`;
  const sheet = ss.getSheetByName(name);
  
  // Nếu không tìm thấy sheet theo tên chuẩn, fallback lấy sheet đầu tiên
  if (!sheet) {
    const firstSheet = ss.getSheets()[0];
    if (firstSheet) return { sheet: firstSheet, sheetName: firstSheet.getName(), month: month };
    return { sheet: null, error: `Không tìm thấy sheet ${name} và file không có sheet nào.` };
  }

  return { sheet: sheet, sheetName: name, month: month };
}