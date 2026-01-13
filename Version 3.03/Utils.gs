/**
 * ==========================================
 * UTILS.GS: CÔNG CỤ HỖ TRỢ LÕI V8.7 (STABLE)
 * ==========================================
 */

function getSheet(n) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName(n);
    if(!s){
        s = ss.insertSheet(n);
        if(n === SHEET_STORES) s.appendRow(['ID','Name','URL','Region','Status','Listing','Sale']);
        else if(n === SHEET_USERS) s.appendRow(['Username','Password','FullName','Role','Email','Phone','Status','Permissions']);
        else if(n === SHEET_NEWS) s.appendRow(['ID','Title','Content','ImageUrl','Author','Timestamp','IsLocked']);
        else if(n === SHEET_NEWS_COMMENTS) s.appendRow(['ID','NewsID','Username','Comment','Timestamp']);
        else if(n === SHEET_NEWS_LIKES) s.appendRow(['NewsID','Username']);
        else if(n === SHEET_FILE_INDEX) s.appendRow(['Month','FileID','FileName','CreatedDate']);
        else if(n === SHEET_PL_SKU) s.appendRow(['STT', 'SKU', 'Phân Loại']);
        else if(n === SHEET_PRICES) s.appendRow(['Category', 'Price']);
        else if(n === SHEET_USER_READ_STATUS) s.appendRow(['Username', 'LastReadTimestamp']); 
        else if(n === SHEET_SCHEDULE_STAFF) s.appendRow(['Name', 'Role', 'Username']);
        else if(n === SHEET_ATTENDANCE) s.appendRow(['Date', 'Username', 'Name', 'CheckIn', 'CheckOut', 'TotalHours']);
        else if(n === SHEET_OT_ATTENDANCE) s.appendRow(['Date', 'Username', 'Name', 'CheckIn', 'CheckOut', 'TotalHours', 'Type']);
        else if(n === SHEET_HOLIDAYS) s.appendRow(['Date']);
        else if(n === SHEET_HANDOVER) s.appendRow(['ID', 'Date', 'Task', 'Assignee', 'DeadlineAt', 'Priority', 'Status', 'StartTime', 'EndTime', 'Report', 'FileLink', 'ImageLink', 'CreatedBy', 'ResultLink', 'Progress']);
        else if(n === SHEET_USER_NOTES) s.appendRow(['Username', 'Date', 'ItemsJSON']);
        else if(n === SHEET_FINANCE_META) { 
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
 * Logic tìm kiếm File ID thông minh v8.4+
 * Hỗ trợ đa định dạng: yyyy-MM, MM/yyyy, T01-yyyy...
 */
function getFileIdForMonth(month) { 
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = ss.getSheetByName(SHEET_FILE_INDEX);
    if (!indexSheet) return null;
    
    const d = indexSheet.getDataRange().getValues(); 
    const targetMonth = String(month).trim(); // Expected: yyyy-MM
    const targetFileName = "OMS_Orders_" + targetMonth;

    for (let i = 1; i < d.length; i++) { 
        let cellA = d[i][0]; // Cột Month
        let fileId = d[i][1]; // Cột FileID
        let cellC = String(d[i][2] || "").trim(); // Cột FileName

        // 1. Ưu tiên: Khớp tên file chính xác hoặc chứa chuỗi tháng
        if (cellC === targetFileName || cellC.indexOf(targetMonth) !== -1) return fileId;

        // 2. Chuẩn hóa giá trị ô ngày tháng (Cell A)
        let mStr = "";
        if (cellA instanceof Date) {
            mStr = Utilities.formatDate(cellA, "GMT+7", 'yyyy-MM');
        } else {
            mStr = String(cellA).trim();
        }

        // Nếu khớp trực tiếp yyyy-MM
        if (mStr === targetMonth) return fileId;

        // 3. Logic so khớp nâng cao cho các định dạng đặc biệt
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
            // Trường hợp: yyyy-M
            if (mStr.indexOf('-') !== -1) {
                let p = mStr.split('-');
                if (p.length === 2 && p[0].length === 4) {
                    let y = p[0];
                    let m = p[1].padStart(2, '0');
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
                }
            }
        } catch (e) {
            // Bỏ qua lỗi parse để tiếp tục vòng lặp
        }
    } 
    return null; 
}

function createNewMonthFile(month) {
  const name = `OMS_Orders_${month}`;
  const ss = SpreadsheetApp.create(name);
  const headers = ['Date', 'OrderID', 'Store', 'DonVi', 'SKU', 'Quantity', 'Tracking', 'Link', 'Status', 'Note', 'Handler', 'ActionRole', 'Checked', 'Design Done', 'F.Name', 'L.Name', 'Address1', 'Address2', 'City', 'State', 'Zip', 'Country', 'Phone', 'Product Name', 'Item SKU', 'URL Mockup', 'Mockup Type', 'Is Fulfilled', 'URL Artwork Front', 'URL Artwork Back'];
  ss.getSheets()[0].appendRow(headers);
  ss.getSheets()[0].getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a4019").setFontColor("white");
  ss.getSheets()[0].setFrozenRows(1);
  getSheet(SHEET_FILE_INDEX).appendRow([month, ss.getId(), name, new Date()]);
  return ss.getId();
}

function getFinanceFileId(year) {
    const d = getSheet(SHEET_FILE_INDEX).getDataRange().getValues();
    const t = "OMS_Finance_" + year;
    for (let i = 1; i < d.length; i++) if (String(d[i][2]) === t) return d[i][1];
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
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, "GMT+7", 'yyyy-MM-dd HH:mm:ss');
    return String(d); 
  } catch(e) { return String(d); } 
}

function getData(n) { const s = getSheet(n); const d = s.getDataRange().getValues(); const h = d.shift(); return d.map(r => { let o = {}; h.forEach((k, i) => { o[k.toLowerCase()] = r[i]; }); return o; }); }
function addRow(n, r) { getSheet(n).appendRow(r); return { success: true }; }
function deleteRow(n, id) { const s = getSheet(n); const d = s.getDataRange().getValues(); for(let i = d.length - 1; i >= 1; i--) if(String(d[i][0]) == String(id)) { s.deleteRow(i + 1); return { success: true }; } return { error: 'Not found' }; }