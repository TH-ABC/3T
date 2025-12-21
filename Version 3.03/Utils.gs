
/**
 * ==========================================
 * UTILS.GS: CÔNG CỤ HỖ TRỢ LÕI
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
        else if(n === SHEET_FINANCE_META) { s.appendRow(['Categories', 'Payers']); s.appendRow(['Chi Tiền', 'Hoàng']); s.appendRow(['Thu Tiền', 'A Tâm']); }
        s.getRange(1, 1, 1, s.getLastColumn()).setFontWeight("bold").setBackground("#f8f9fa");
        s.setFrozenRows(1);
    }
    return s;
}

function getFileIdForMonth(month) { 
    const d = getSheet(SHEET_FILE_INDEX).getDataRange().getValues(); 
    for (let i = 1; i < d.length; i++) { 
        let m = d[i][0]; if (m instanceof Date) m = Utilities.formatDate(m, "GMT+7", 'yyyy-MM'); 
        if (String(m) === String(month)) return d[i][1]; 
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
    ss.getSheets()[0].appendRow(['ID', 'Category', 'Description', 'Date', 'Qty', 'UnitPrice', 'Total', 'Payer', 'Note', 'Timestamp']);
    ss.getSheets()[0].getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#e0f2f1");
    getSheet(SHEET_FILE_INDEX).appendRow([year, ss.getId(), n, new Date()]);
    return { success: true, fileId: ss.getId() };
}

function formatDate(d) { if (!d) return ""; try { return Utilities.formatDate(new Date(d), "GMT+7", 'yyyy-MM-dd HH:mm:ss'); } catch(e) { 
  if (typeof d === 'string') return d.split(' ')[0];
  return String(d); 
} }
function getData(n) { const s = getSheet(n); const d = s.getDataRange().getValues(); const h = d.shift(); return d.map(r => { let o = {}; h.forEach((k, i) => { o[k.toLowerCase()] = r[i]; }); return o; }); }
function addRow(n, r) { getSheet(n).appendRow(r); return { success: true }; }
function deleteRow(n, id) { const s = getSheet(n); const d = s.getDataRange().getValues(); for(let i = d.length - 1; i >= 1; i--) if(String(d[i][0]) == String(id)) { s.deleteRow(i + 1); return { success: true }; } return { error: 'Not found' }; }
