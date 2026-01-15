
/**
 * ==========================================
 * LOGIC_FINANCE.GS: TÀI CHÍNH & MAPPINGS V71.0
 * QUẢN LÝ STORE/REGION REGISTRY & AUTO-MAPPING
 * ==========================================
 */

/**
 * Hàm tìm dòng cuối thực tế dựa trên một cột
 */
function getActualLastRow(sheet, colIndex) {
  const values = sheet.getRange(1, colIndex, sheet.getLastRow() || 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0] && String(values[i][0]).trim() !== "") return i + 1;
  }
  return 1;
}

/**
 * 1. Tìm File ID của năm tài chính từ Sheet FileIndex
 */
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
    
    const targetFinanceKey = "FINANCE_" + targetYear;
    for (let i = 1; i < data.length; i++) {
        let val = data[i][0];
        if (!val) continue;
        let rowKey = (val instanceof Date) ? Utilities.formatDate(val, "GMT+7", "yyyy") : String(val).trim();
        let fileName = String(data[i][2] || "").toUpperCase();
        if ((rowKey === targetYear || rowKey === targetFinanceKey || rowKey.includes(targetYear)) && fileName.includes("FINANCE")) {
            return data[i][1];
        }
    }
    return null;
}

/**
 * 2. Tạo File Tài Chính mới
 */
function createFinanceFile(year) {
  const masterSS = SpreadsheetApp.getActiveSpreadsheet();
  let indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX);
  if (!indexSheet) {
    indexSheet = masterSS.insertSheet(SHEET_FILE_INDEX);
    indexSheet.appendRow(['Month', 'FileID', 'FileName', 'CreatedDate']);
    indexSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f8f9fa");
    indexSheet.setFrozenRows(1);
  }

  const fileName = `OMS_Finance_${year}`;
  const newSS = SpreadsheetApp.create(fileName);
  const fileId = newSS.getId();
  initFinanceStructure(newSS);
  indexSheet.appendRow([String(year), fileId, fileName, new Date()]);
  return { success: true, fileId: fileId };
}

/**
 * 3. Chuẩn hóa số
 */
function parseSheetNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim().replace(/[^\d,.-]/g, '');
  if (str.includes(',') && !str.includes('.')) {
      const parts = str.split(',');
      if (parts[parts.length - 1].length <= 2) str = str.replace(',', '.');
      else str = str.replace(/,/g, '');
  } else if (str.includes(',') && str.includes('.')) str = str.replace(/,/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * 4. Lấy Index cột
 */
function getColIndex(headers, target) {
  if (!headers || !target) return -1;
  const t = target.toLowerCase().replace(/\s/g,'').replace(/,/g,'').replace(/_/g,'').replace(/[.,]/g,'');
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).toLowerCase().replace(/\s/g,'').replace(/,/g,'').replace(/_/g,'').replace(/[.,]/g,'');
    if (h === t) return i;
  }
  return -1;
}

/**
 * 5. Khởi tạo cấu trúc file Finance
 */
function initFinanceStructure(ss) {
  let sTrans = ss.getSheetByName("Transactions") || ss.getSheets()[0];
  if (sTrans.getName() !== "Transactions") sTrans.setName("Transactions");
  if (sTrans.getLastRow() === 0) {
    const h = ['ID', 'Category', 'SubCategory', 'Description', 'Date', 'Qty', 'UnitPrice', 'Total', 'Payer', 'Note', 'Timestamp'];
    sTrans.appendRow(h);
    sTrans.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("white").setFrozenRows(1);
  }
  
  let sPay = ss.getSheetByName("Payments") || ss.insertSheet("Payments");
  if (sPay.getLastRow() === 0) {
    const h = ['ID', 'StoreName', 'Amount', 'Region', 'ConvertedUSD', 'Date', 'Timestamp'];
    sPay.appendRow(h);
    sPay.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#fff3e0").setFrozenRows(1); 
  }

  let sPW = ss.getSheetByName("Printway") || ss.insertSheet("Printway");
  if (sPW.getLastRow() === 0) {
    const h = ['InvoiceID', 'Type', 'Status', 'Date', 'Method', 'AmountUSD', 'Paymentgatewayfee', 'Totalamount', 'Note', 'Loại'];
    sPW.appendRow(h);
    sPW.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#e8f5e9").setFrozenRows(1);
  }

  let sEbay = ss.getSheetByName("Ebay") || ss.insertSheet("Ebay");
  if (sEbay.getLastRow() === 0) {
    const h = ['RecordID', 'AccountingTime', 'Type', 'Amount', 'CardRemark', 'Timestamp'];
    sEbay.appendRow(h);
    sEbay.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#fffde7").setFrozenRows(1);
  }
}

/**
 * 6. Lấy dữ liệu tài chính
 */
function getFinance(year) {
    const fid = getFinanceFileId(year);
    if (!fid) return { transactions: [], payments: [], printway: [], ebay: [], fileId: null, error: "Không tìm thấy file " + year };
    try {
        const ss = SpreadsheetApp.openById(fid);
        initFinanceStructure(ss);
        
        let transactions = [];
        const sTrans = ss.getSheetByName("Transactions");
        if (sTrans) {
          const dataTrans = sTrans.getDataRange().getValues();
          if (dataTrans.length > 1) {
              const h = dataTrans[0];
              const idx = { id: getColIndex(h, 'ID'), cat: getColIndex(h, 'Category'), sub: getColIndex(h, 'SubCategory'), desc: getColIndex(h, 'Description'), date: getColIndex(h, 'Date'), qty: getColIndex(h, 'Qty'), price: getColIndex(h, 'UnitPrice'), total: getColIndex(h, 'Total'), payer: getColIndex(h, 'Payer'), note: getColIndex(h, 'Note') };
              dataTrans.shift();
              transactions = dataTrans.filter(r => String(r[idx.id]||"").trim() || String(r[idx.desc]||"").trim()).map(r => ({
                id: String(r[idx.id] || ""), category: String(r[idx.cat] || "Chi Tiền"), subCategory: String(r[idx.sub] || ""), description: String(r[idx.desc] || ""),
                date: formatDate(r[idx.date]), quantity: parseSheetNumber(r[idx.qty]), unitPrice: parseSheetNumber(r[idx.price]), totalAmount: parseSheetNumber(r[idx.total]),
                payer: String(r[idx.payer] || "Hoàng"), note: String(r[idx.note] || "")
              })).reverse();
          }
        }

        let payments = [];
        const sPay = ss.getSheetByName("Payments");
        if (sPay) {
            const dataPay = sPay.getDataRange().getValues();
            if (dataPay.length > 1) {
                const h = dataPay[0];
                const idx = { id: getColIndex(h, 'ID'), name: getColIndex(h, 'StoreName'), amt: getColIndex(h, 'Amount'), reg: getColIndex(h, 'Region'), usd: getColIndex(h, 'ConvertedUSD'), date: getColIndex(h, 'Date'), ts: getColIndex(h, 'Timestamp') };
                dataPay.shift();
                payments = dataPay.filter(r => String(r[idx.id]||"").trim()).map(r => ({
                    id: String(r[idx.id] || ""), storeName: String(r[idx.name] || ""), amount: parseSheetNumber(r[idx.amt]), region: String(r[idx.reg] || "Us"),
                    convertedUsd: parseSheetNumber(r[idx.usd]), date: formatDate(r[idx.date]).split(' ')[0], timestamp: formatDate(r[idx.ts])
                })).reverse();
            }
        }

        let printway = [];
        const sPW = ss.getSheetByName("Printway");
        if (sPW) {
            const dataPW = sPW.getDataRange().getValues();
            if (dataPW.length > 1) {
                const h = dataPW[0];
                const idx = { 
                  inv: getColIndex(h, 'InvoiceID'), type: getColIndex(h, 'Type'), 
                  status: getColIndex(h, 'Status'), date: getColIndex(h, 'Date'), 
                  total: getColIndex(h, 'Totalamount'), loai: getColIndex(h, 'Loại'), 
                  method: getColIndex(h, 'Method'), amountUsd: getColIndex(h, 'AmountUSD'), 
                  fee: getColIndex(h, 'Paymentgatewayfee'), note: getColIndex(h, 'Note') 
                };
                dataPW.shift();
                printway = dataPW.filter(r => String(r[idx.inv]).trim()).map(r => {
                    const typeStr = String(r[idx.type] || "");
                    const isRefund = typeStr.toLowerCase().includes('refund');
                    return {
                        invoiceId: String(r[idx.inv]), type: typeStr, status: String(r[idx.status] || ""), 
                        date: formatDate(r[idx.date]), totalAmount: parseSheetNumber(r[idx.total]), 
                        loai: isRefund ? "Thu Tiền" : (String(r[idx.loai] || "Chi Tiền")), 
                        method: String(r[idx.method] || ""), amountUsd: parseSheetNumber(r[idx.amountUsd]), 
                        fee: parseSheetNumber(r[idx.fee]), note: String(r[idx.note] || "")
                    };
                }).reverse();
            }
        }

        let ebay = [];
        const sEbay = ss.getSheetByName("Ebay");
        if (sEbay) {
          const dataEbay = sEbay.getDataRange().getValues();
          if (dataEbay.length > 1) {
            const h = dataEbay[0];
            const idx = { rid: getColIndex(h, 'RecordID'), time: getColIndex(h, 'AccountingTime'), type: getColIndex(h, 'Type'), amt: getColIndex(h, 'Amount'), remark: getColIndex(h, 'CardRemark') };
            dataEbay.shift();
            ebay = dataEbay.filter(r => r[idx.rid]).map(r => ({
              recordId: String(r[idx.rid]), accountingTime: formatDate(r[idx.time]), type: String(r[idx.type] || ""), amount: parseSheetNumber(r[idx.amt]), cardRemark: String(r[idx.remark] || "")
            })).reverse();
          }
        }

        return { fileId: fid, transactions, payments, printway, ebay };
    } catch (e) {
        return { transactions: [], payments: [], printway: [], ebay: [], fileId: fid, error: "Lỗi: " + e.toString() };
    }
}

/**
 * 7. Lấy lương nhân viên: Dò FileIndex (OMS_Timekeeping_YYYY-MM) -> Sheet Chấm công -> Ô D3
 */
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
        const searchKey = "OMS_Timekeeping_" + monthStr;
        let fileId = null;
        
        for (let i = 1; i < indexData.length; i++) {
            let fileName = String(indexData[i][2] || ""); 
            let monthCol = String(indexData[i][0] || ""); 
            if (fileName.includes(searchKey) || monthCol.includes(monthStr)) { 
                fileId = indexData[i][1]; 
                break; 
            }
        }
        
        let amountVnd = 0;
        if (fileId) {
            try {
                const ss = SpreadsheetApp.openById(fileId);
                const sheets = ss.getSheets();
                let s = null;
                for (let j=0; j<sheets.length; j++) {
                    let sn = sheets[j].getName().toLowerCase().replace(/\s/g, '');
                    if (sn.includes("chấmcông")) { s = sheets[j]; break; }
                }
                if (s) amountVnd = parseSheetNumber(s.getRange("D3").getValue());
            } catch (e) { console.warn("Salary error for " + monthStr + ": " + e); }
        }
        
        result.push({ 
            month: String(m), 
            amountVnd, 
            amountUsd: Math.round((amountVnd / VND_RATE) * 100) / 100 
        });
    }
    return result;
}

/**
 * 8. Thêm giao dịch (Chi phí)
 */
function addFinance(year, t) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    initFinanceStructure(ss);
    const id = "F-" + Utilities.getUuid().substring(0,8);
    const row = [id, t.category, t.subCategory || "", t.description, t.date || new Date(), t.quantity || 1, t.unitPrice || 0, t.totalAmount || 0, t.payer || "Hoàng", t.note || "", new Date()];
    ss.getSheetByName("Transactions").appendRow(row);
    return { success: true, transaction: { id: id, ...t } };
}

/**
 * 9. Thêm Tiền Store (Funds)
 */
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

/**
 * 12. Batch Printway (Phí từ input + tích hợp top-up)
 */
function addPrintwayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    initFinanceStructure(ss);
    let sPW = ss.getSheetByName("Printway");
    const realLastRow = getActualLastRow(sPW, 1);
    
    let existingIds = new Set();
    if (realLastRow > 1) {
        const idsData = sPW.getRange(2, 1, realLastRow - 1, 1).getValues();
        idsData.forEach(r => { if (String(r[0]).trim()) existingIds.add(String(r[0]).trim()); });
    }
    
    const filteredList = list.filter(item => {
        const id = String(item.invoiceId || '').trim();
        return id !== '' && !existingIds.has(id);
    });
    
    if (filteredList.length === 0) return { success: true, count: 0, message: "Dữ liệu đã tồn tại" };
    
    const rows = filteredList.map(item => {
      const typeStr = String(item.type || "").toLowerCase();
      const isRefund = typeStr.includes("refund");
      const isTopUp = typeStr.includes("top-up");
      
      let loai = "Chi Tiền";
      if (isRefund) loai = "Thu Tiền";
      else if (isTopUp) loai = "Nạp Tiền"; 
      
      return [
        String(item.invoiceId).trim(), item.type || "Payment", item.status || "Completed", item.date || new Date(), item.method || "Wallet", 
        item.amountUsd || 0, item.fee || 0, item.totalAmount || 0, item.note || "", loai 
      ];
    });
    
    sPW.getRange(realLastRow + 1, 1, rows.length, 10).setValues(rows);
    return { success: true, count: rows.length };
}

/**
 * 13. Batch Ebay (Chống trùng ID)
 */
function addEbayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    initFinanceStructure(ss);
    let sEbay = ss.getSheetByName("Ebay");
    const realLastRow = getActualLastRow(sEbay, 1);

    let existingIds = new Set();
    if (realLastRow > 1) {
        const idsData = sEbay.getRange(2, 1, realLastRow - 1, 1).getValues();
        idsData.forEach(r => { if (r[0]) existingIds.add(String(r[0]).trim()); });
    }

    const filteredList = list.filter(item => {
        const id = String(item.recordId || '').trim();
        return id !== '' && !existingIds.has(id);
    });

    if (filteredList.length === 0) return { success: true, count: 0 };

    const rows = filteredList.map(item => [item.recordId, item.accountingTime, item.type, item.amount, item.cardRemark, new Date()]);
    sEbay.getRange(realLastRow + 1, 1, rows.length, 6).setValues(rows);
    return { success: true, count: rows.length };
}

function updateFinanceField(year, id, field, value) {
    const fid = getFinanceFileId(year);
    if (!fid) return { success: false, error: "Không tìm thấy file" };
    const s = SpreadsheetApp.openById(fid).getSheetByName("Transactions");
    const data = s.getDataRange().getValues();
    const colIdx = getColIndex(data[0], field);
    if (colIdx === -1) return { success: false, error: "Cột không tồn tại" };
    for(let i=1; i<data.length; i++) if(String(data[i][0]).trim() === String(id).trim()) { s.getRange(i+1, colIdx + 1).setValue(value); return { success: true }; }
    return { success: false, error: "ID không tồn tại" };
}

function updatePaymentField(year, id, field, value) {
    const fid = getFinanceFileId(year);
    if (!fid) return { success: false, error: "Không tìm thấy file" };
    const s = SpreadsheetApp.openById(fid).getSheetByName("Payments");
    const data = s.getDataRange().getValues();
    const colIdx = getColIndex(data[0], field);
    if (colIdx === -1) return { success: false, error: "Cột không tồn tại" };
    for(let i=1; i<data.length; i++) if(String(data[i][0]).trim() === String(id).trim()) { s.getRange(i+1, colIdx + 1).setValue(value); return { success: true }; }
    return { success: false, error: "ID không tồn tại" };
}

/**
 * Lấy Meta: Mở rộng quét cả Stores & Regions Registry
 */
function getFinanceMeta() {
    const s = getSheet(SHEET_FINANCE_META);
    const d = s.getDataRange().getValues();
    const c = []; const p = ["Hoàng"]; const sc = [];
    const st = []; const rg = ["Us", "Au", "VN"];

    for (let i = 1; i < d.length; i++) { 
        if (d[i][0]) c.push(d[i][0]); 
        if (d[i][1] && String(d[i][1]).trim() !== "Hoàng") p.push(d[i][1]); 
        if (d[i][2]) sc.push(d[i][2]); 
        if (d[i][3]) st.push(d[i][3]); // Cột 4: Stores Registry
        if (d[i][4]) rg.push(d[i][4]); // Cột 5: Regions Registry
    }
    return { 
      categories: [...new Set(c)], 
      payers: [...new Set(p)], 
      subCategories: sc,
      stores: [...new Set(st.filter(Boolean))],
      regions: [...new Set(rg.filter(Boolean))]
    };
}

function addFinanceMeta(type, value) {
    const s = getSheet(SHEET_FINANCE_META);
    let col = 1;
    if (type === 'payer') col = 2;
    else if (type === 'subCategory') col = 3;
    else if (type === 'store') col = 4;
    else if (type === 'region') col = 5;

    const lastRow = s.getLastRow();
    const data = s.getDataRange().getValues();
    for (let i=1; i<data.length; i++) if (String(data[i][col-1]).trim().toLowerCase() === String(value).trim().toLowerCase()) return { success: true };
    
    // Tìm dòng trống đầu tiên trong cột đó
    let targetRow = 2;
    const colValues = s.getRange(2, col, lastRow || 2, 1).getValues();
    for(let j=0; j<colValues.length; j++) {
        if(colValues[j][0] === "") { targetRow = j + 2; break; }
        if(j === colValues.length - 1) targetRow = colValues.length + 2;
    }
    
    s.getRange(targetRow, col).setValue(value);
    return { success: true };
}
