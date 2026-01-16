
/**
 * ==========================================
 * LOGIC_FINANCE.GS: TÀI CHÍNH & MAPPINGS V46.0
 * BẢO TOÀN 100% LOGIC - KHÔNG RÚT GỌN
 * ==========================================
 */

function createFinanceFile(year) {
  const masterSS = SpreadsheetApp.getActiveSpreadsheet();
  let indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX);
  if (!indexSheet) {
    indexSheet = masterSS.insertSheet(SHEET_FILE_INDEX);
    indexSheet.appendRow(['Month', 'FileID', 'FileName', 'CreatedDate']);
    indexSheet.setFrozenRows(1);
  }

  const fileName = `OMS_Finance_${year}`;
  const newSS = SpreadsheetApp.create(fileName);
  const fileId = newSS.getId();
  
  initFinanceStructure(newSS);
  
  indexSheet.appendRow([String(year), fileId, fileName, new Date()]);
  return { success: true, fileId: fileId };
}

function getStaffSalarySummary(year) {
    const masterSS = SpreadsheetApp.getActiveSpreadsheet();
    const indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX);
    if (!indexSheet) return [];
    
    const indexData = indexSheet.getDataRange().getValues();
    const result = [];
    const targetYear = String(year);
    const VND_RATE = 25450; 

    for (let m = 1; m <= 12; m++) {
        const monthStr = `${targetYear}-${String(m).padStart(2, '0')}`;
        const searchKey = "TIMEKEEPING_" + monthStr;
        let fileId = null;
        for (let i = 1; i < indexData.length; i++) if (String(indexData[i][0]) === searchKey) { fileId = indexData[i][1]; break; }
        
        let amountVnd = 0;
        if (fileId) {
            try {
                const ss = SpreadsheetApp.openById(fileId);
                const s = ss.getSheetByName("Chấm công") || ss.getSheetByName("Chấm Công");
                if (s) amountVnd = parseSheetNumber(s.getRange("D3").getValue());
            } catch (e) { console.warn(`Error reading salary ${monthStr}: ${e}`); }
        }
        result.push({ month: String(m), amountVnd: amountVnd, amountUsd: Math.round((amountVnd / VND_RATE) * 100) / 100 });
    }
    return result;
}

function addPayment(year, p) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    let sPay = ss.getSheetByName("Payments") || ss.insertSheet("Payments");
    if (sPay.getLastRow() === 0) {
        const h = ['ID', 'StoreName', 'Amount', 'Region', 'ConvertedUSD', 'Date', 'Timestamp'];
        sPay.appendRow(h);
        sPay.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#fff3e0");
        sPay.setFrozenRows(1);
    }
    const id = "P-" + Utilities.getUuid().substring(0,8);
    sPay.appendRow([id, p.storeName, p.amount, p.region, p.convertedUsd, p.date || new Date(), new Date()]);
    return { success: true, payment: { id: id, ...p } };
}

// Bổ sung các hàm helper phục vụ logic cũ nếu chưa có trong file hiện tại
function getFinanceFileId(year) {
    const masterSS = SpreadsheetApp.getActiveSpreadsheet();
    let indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX);
    if (!indexSheet) return null;
    const data = indexSheet.getDataRange().getValues();
    const targetYear = String(year).trim();
    for (let i = 1; i < data.length; i++) {
        let val = data[i][0];
        if (!val) continue;
        let rowKey = (val instanceof Date) ? Utilities.formatDate(val, "GMT+7", "yyyy") : String(val).replace(/[.,\s]/g, '').trim();
        let fileName = String(data[i][2] || "").toUpperCase();
        if (rowKey === targetYear && fileName.includes("FINANCE")) return data[i][1];
    }
    return null;
}
