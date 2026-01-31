
/**
 * ==========================================
 * UTILS.GS: SHEET CORE & HELPERS V2.1
 * ==========================================
 */

function getSheet(n) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName(n);
    if(!s){
        s = ss.insertSheet(n);
        if(n === SHEET_STORES) s.appendRow(['ID','Name','URL','Region','Status','Listing','Sale']);
        else if(n === SHEET_USERS) s.appendRow(['Username','Password','FullName','Role','Email','Phone','Status','Permissions']);
        else if(n === SHEET_NEWS) s.appendRow(['ID','Title','Content','ImageUrl','Author','Timestamp', 'IsLocked']);
        else if(n === SHEET_NEWS_COMMENTS) s.appendRow(['ID','NewsID','Username','Comment','Timestamp']);
        else if(n === SHEET_NEWS_LIKES) s.appendRow(['NewsID','Username']);
        else if(n === SHEET_DAILY) s.appendRow(['Date','TotalListing','TotalSale']);
        else if(n === SHEET_STORE_HISTORY) s.appendRow(['Date','StoreID','Listing','Sale']);
        else if(n === SHEET_FILE_INDEX) s.appendRow(['Month','FileID','FileName','CreatedDate']);
        else if(n === SHEET_PL_SKU) s.appendRow(['STT', 'SKU', 'Phân Loại']);
        else if(n === SHEET_PRICES) s.appendRow(['Category', 'Price']);
        else if(n === SHEET_ATTENDANCE) s.appendRow(['Date', 'Username', 'Name', 'CheckIn', 'CheckOut', 'TotalHours']);
        else if(n === SHEET_OT_ATTENDANCE) s.appendRow(['Date', 'Username', 'Name', 'CheckIn', 'CheckOut', 'TotalHours', 'Type']);
        else if(n === SHEET_SCHEDULE_STAFF) s.appendRow(['Name', 'Role', 'Username']);
        else if(n === SHEET_HANDOVER) s.appendRow(['ID', 'Date', 'Task', 'Assignee', 'DeadlineAt', 'IsSeen', 'Status', 'StartTime', 'EndTime', 'Report', 'FileLink', 'ImageLink', 'CreatedBy', 'ResultLink']);
        else if(n === SHEET_USER_NOTES) s.appendRow(['Username', 'Date', 'Notes']);
        else if(n === SHEET_AI_INSIGHTS) s.appendRow(['Key', 'Content', 'UpdatedDate']); // Key dạng YYYY-MM
        else if(n === SHEET_FINANCE_META) {
            s.appendRow(['Categories', 'Payers', 'SubCategories', 'Stores', 'Regions']);
            s.appendRow(['Thu Tiền', 'Hoàng', 'Lương', 'Etsy Shop 1', 'Us']);
            s.appendRow(['Chi Tiền', 'Minh', 'Cố định', 'Shopify A', 'VN']);
        }
        
        s.getRange(1, 1, 1, s.getLastColumn() || 1).setFontWeight("bold").setBackground("#f8f9fa");
        if (s.getLastColumn() > 0) s.setFrozenRows(1);
    }
    return s;
}

function getFileIdForMonth(month) { 
    const masterSS = SpreadsheetApp.getActiveSpreadsheet();
    let indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX); 
    if (!indexSheet) {
        indexSheet = masterSS.insertSheet(SHEET_FILE_INDEX);
        indexSheet.appendRow(['Month', 'FileID', 'FileName', 'CreatedDate']);
        return null;
    }
    const data = indexSheet.getDataRange().getValues(); 
    for (let i = 1; i < data.length; i++) { 
        let rowMonth = data[i][0]; 
        if (rowMonth instanceof Date) rowMonth = Utilities.formatDate(rowMonth, "GMT+7", 'yyyy-MM'); 
        if (String(rowMonth) === String(month)) return data[i][1]; 
    } 
    return null; 
}

function formatDate(d) { 
    if (!d) return "";
    try { 
        return Utilities.formatDate(new Date(d), "GMT+7", 'yyyy-MM-dd HH:mm:ss'); 
    } catch(e) { return String(d); } 
}

function getData(n) {
    const s = getSheet(n);
    const d = s.getDataRange().getValues();
    const headers = d.shift(); 
    return d.map(function(r) {
        if(n === SHEET_STORES) return {id:r[0], name:r[1], url:r[2], region:r[3], status:r[4], listing:r[5]||0, sale:r[6]||0};
        if(n === SHEET_DAILY) return {date: formatDate(r[0]), totalListing: r[1]||0, totalSale: r[2]||0};
        if(n === SHEET_ROLES) return {name:r[0], level:r[1]};
        let obj = {};
        headers.forEach(function(h, i) { obj[h.toLowerCase()] = r[i]; });
        return obj;
    });
}
