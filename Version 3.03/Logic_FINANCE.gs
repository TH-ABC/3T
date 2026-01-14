
/**
 * ==========================================
 * LOGIC_FINANCE.GS: TÀI CHÍNH & MAPPINGS V26.0
 * BẢO TOÀN HÀM - FIX LỖI NHẬN DIỆN TRÙNG ID
 * ==========================================
 */

/**
 * Tìm File ID của năm tài chính từ Sheet FileIndex
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
        if ((rowKey === targetYear || rowKey === targetFinanceKey) && fileName.includes("FINANCE")) return data[i][1];
    }
    return null;
}

/**
 * Chuẩn hóa số xử lý triệt để dấu phẩy/chấm
 */
function parseSheetNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).trim();
  str = str.replace(/[^\d,.-]/g, '');
  
  if (str.includes(',') && !str.includes('.')) {
      const parts = str.split(',');
      if (parts[parts.length - 1].length <= 2) {
          str = str.replace(',', '.');
      } else {
          str = str.replace(/,/g, ''); 
      }
  } else if (str.includes(',') && str.includes('.')) {
      str = str.replace(/,/g, '');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Lấy Index cột theo tên
 */
function getColIndex(headers, target) {
  if (!headers || !target) return -1;
  const t = target.toLowerCase().replace(/\s/g, '').replace(/,/g, '').replace(/_/g, '').replace(/[.,]/g, '');
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).toLowerCase().replace(/\s/g, '').replace(/,/g, '').replace(/_/g, '').replace(/[.,]/g, '');
    if (h === t) return i;
  }
  return -1;
}

/**
 * Tạo File Tài Chính mới
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
 * Khởi tạo cấu trúc các sheet
 */
function initFinanceStructure(ss) {
  let sTrans = ss.getSheetByName("Transactions") || ss.getSheets()[0];
  if (sTrans.getName() !== "Transactions") sTrans.setName("Transactions");
  if (sTrans.getLastRow() === 0) {
    const h = ['ID', 'Category', 'SubCategory', 'Description', 'Date', 'Qty', 'UnitPrice', 'Total', 'Payer', 'Note', 'Timestamp'];
    sTrans.appendRow(h);
    sTrans.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("white");
    sTrans.setFrozenRows(1);
  }
  
  let sPay = ss.getSheetByName("Payments") || ss.insertSheet("Payments");
  if (sPay.getLastRow() === 0) {
    const h = ['ID', 'StoreName', 'Amount', 'Region', 'ConvertedUSD', 'Date', 'Timestamp'];
    sPay.appendRow(h);
    sPay.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#fff3e0");
    sPay.setFrozenRows(1); 
  }

  let sPW = ss.getSheetByName("Printway") || ss.insertSheet("Printway");
  if (sPW.getLastRow() === 0) {
    const h = ['InvoiceID', 'Type', 'Status', 'Date', 'Method', 'AmountUSD', 'Paymentgatewayfee', 'Totalamount', 'Note', 'Loại'];
    sPW.appendRow(h);
    sPW.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#e8f5e9");
    sPW.setFrozenRows(1);
  }

  let sEbay = ss.getSheetByName("Ebay") || ss.insertSheet("Ebay");
  if (sEbay.getLastRow() === 0) {
    const h = ['RecordID', 'AccountingTime', 'Type', 'Amount', 'CardRemark', 'Timestamp'];
    sEbay.appendRow(h);
    sEbay.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#fffde7");
    sEbay.setFrozenRows(1);
  }
}

/**
 * Lấy toàn bộ dữ liệu tài chính
 */
function getFinance(year) {
    const fid = getFinanceFileId(year);
    if (!fid) return { transactions: [], payments: [], printway: [], ebay: [], fileId: null, error: "Không tìm thấy dữ liệu File cho năm " + year };
    
    try {
        const ss = SpreadsheetApp.openById(fid);
        const checkSheet = ss.getSheetByName("Transactions");
        if (!checkSheet) return { transactions: [], payments: [], printway: [], ebay: [], fileId: fid, error: "LỖI: File không phải file Tài Chính." };

        initFinanceStructure(ss);

        // 1. Transactions (Chi phí công ty)
        let transactions = [];
        const dataTrans = checkSheet.getDataRange().getValues();
        if (dataTrans.length > 1) {
            const h = dataTrans[0];
            const idx = {
              id: getColIndex(h, 'ID'), cat: getColIndex(h, 'Category'), sub: getColIndex(h, 'SubCategory'),
              desc: getColIndex(h, 'Description'), date: getColIndex(h, 'Date'), qty: getColIndex(h, 'Qty'),
              price: getColIndex(h, 'UnitPrice'), total: getColIndex(h, 'Total'), payer: getColIndex(h, 'Payer'), note: getColIndex(h, 'Note')
            };
            dataTrans.shift();
            transactions = dataTrans.filter(r => String(r[idx.id]||"").trim() || String(r[idx.desc]||"").trim()).map(r => ({
              id: String(r[idx.id] || ""), category: String(r[idx.cat] || "Chi Tiền"), subCategory: String(r[idx.sub] || ""), description: String(r[idx.desc] || ""),
              date: formatDate(r[idx.date]), quantity: parseSheetNumber(r[idx.qty]), unitPrice: parseSheetNumber(r[idx.price]), totalAmount: parseSheetNumber(r[idx.total]),
              payer: String(r[idx.payer] || "Hoàng"), note: String(r[idx.note] || "")
            })).reverse();
        }

        // 2. Payments (Tiền Store về)
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

        // 3. Printway
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
                  method: getColIndex(h, 'Method'), amtUsd: getColIndex(h, 'AmountUSD'), 
                  fee: getColIndex(h, 'Paymentgatewayfee'), note: getColIndex(h, 'Note')
                };
                dataPW.shift();
                printway = dataPW.filter(r => r[idx.inv]).map(r => ({
                    invoiceId: String(r[idx.inv]), type: String(r[idx.type] || ""), status: String(r[idx.status] || ""), 
                    date: formatDate(r[idx.date]), totalAmount: parseSheetNumber(r[idx.total]), loai: String(r[idx.loai] || ""),
                    method: String(r[idx.method] || ""), amountUsd: parseSheetNumber(r[idx.amtUsd]), 
                    fee: parseSheetNumber(r[idx.fee]), note: String(r[idx.note] || "")
                })).reverse();
            }
        }

        // 4. Ebay
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
        return { transactions: [], payments: [], printway: [], ebay: [], fileId: fid, error: "Lỗi truy cập File: " + e.toString() };
    }
}

/**
 * Thêm giao dịch (Chi phí công ty)
 */
function addFinance(year, t) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const id = "F-" + Utilities.getUuid().substring(0,8);
    const row = [id, t.category, t.subCategory || "", t.description, t.date || new Date(), t.quantity || 1, t.unitPrice || 0, t.totalAmount || 0, t.payer || "Hoàng", t.note || "", new Date()];
    SpreadsheetApp.openById(fid).getSheetByName("Transactions").appendRow(row);
    return { success: true, transaction: { id: id, ...t } };
}

/**
 * Thêm Tiền Store (Funds)
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
 * Batch Printway: CẬP NHẬT V26.0 FIX LỖI NHẬN DIỆN TRÙNG
 */
function addPrintwayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    
    initFinanceStructure(ss);
    let sPW = ss.getSheetByName("Printway");
    
    const lastRow = sPW.getLastRow();
    let existingIds = new Set();
    
    if (lastRow > 1) {
        const idsData = sPW.getRange(2, 1, lastRow - 1, 1).getValues();
        idsData.forEach(r => {
            if (r[0]) existingIds.add(String(r[0]).trim());
        });
    }
    
    const filteredList = list.filter(item => {
        const id = String(item.invoiceId || '').trim();
        return id !== '' && !existingIds.has(id);
    });
    
    if (filteredList.length === 0) return { success: true, count: 0, message: "Không có dữ liệu mới" };
    
    const rows = filteredList.map(item => [
      String(item.invoiceId).trim(), 
      item.type || "Payment", 
      item.status || "Completed", 
      item.date || new Date(), 
      item.method || "Wallet", 
      item.amountUsd || 0, 
      item.fee || 0, 
      item.totalAmount || 0, 
      item.note || "", 
      item.loai || "Khác"
    ]);
    
    sPW.getRange(sPW.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
    return { success: true, count: rows.length };
}

/**
 * Batch Ebay
 */
function addEbayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    let sEbay = ss.getSheetByName("Ebay") || ss.insertSheet("Ebay");
    const lastRow = sEbay.getLastRow();
    let existingIds = new Set();
    if (lastRow > 1) {
        const idsData = sEbay.getRange(2, 1, lastRow - 1, 1).getValues();
        idsData.forEach(r => existingIds.add(String(r[0]).trim()));
    }
    const filteredList = list.filter(item => {
        const id = String(item.recordId || '').trim();
        return id !== '' && !existingIds.has(id);
    });
    if (filteredList.length === 0) return { success: true, count: 0 };
    const rows = filteredList.map(item => [item.recordId, item.accountingTime, item.type, item.amount, item.cardRemark, new Date()]);
    sEbay.getRange(sEbay.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
    return { success: true, count: rows.length };
}

/**
 * Cập nhật field Transactions
 */
function updateFinanceField(year, id, field, value) {
    const fid = getFinanceFileId(year);
    if (!fid) return { success: false, error: "Không tìm thấy file" };
    const s = SpreadsheetApp.openById(fid).getSheetByName("Transactions");
    const data = s.getDataRange().getValues();
    const colIdx = getColIndex(data[0], field);
    if (colIdx === -1) return { success: false, error: "Cột không tồn tại" };
    for(let i=1; i<data.length; i++) {
        if(String(data[i][0]).trim() === String(id).trim()) {
            s.getRange(i+1, colIdx + 1).setValue(value);
            return { success: true };
        }
    }
    return { success: false, error: "ID không tồn tại" };
}

/**
 * Cập nhật field Payments
 */
function updatePaymentField(year, id, field, value) {
    const fid = getFinanceFileId(year);
    if (!fid) return { success: false, error: "Không tìm thấy file" };
    const s = SpreadsheetApp.openById(fid).getSheetByName("Payments");
    const data = s.getDataRange().getValues();
    const colIdx = getColIndex(data[0], field);
    if (colIdx === -1) return { success: false, error: "Cột không tồn tại" };
    for(let i=1; i<data.length; i++) {
        if(String(data[i][0]).trim() === String(id).trim()) {
            s.getRange(i+1, colIdx + 1).setValue(value);
            return { success: true };
        }
    }
    return { success: false, error: "ID không tồn tại" };
}

function getFinanceMeta() {
    const s = getSheet(SHEET_FINANCE_META);
    const d = s.getDataRange().getValues();
    const c = []; const p = ["Hoàng"]; const sc = [];
    for (let i = 1; i < d.length; i++) { 
        if (d[i][0]) c.push(d[i][0]); 
        if (d[i][1] && String(d[i][1]).trim() !== "Hoàng") p.push(d[i][1]); 
        if (d[i][2]) sc.push(d[i][2]);
    }
    return { categories: [...new Set(c)], payers: [...new Set(p)], subCategories: sc };
}

function addFinanceMeta(type, value) {
    const s = getSheet(SHEET_FINANCE_META);
    let col = (type === 'payer') ? 2 : (type === 'subCategory' ? 3 : 1);
    const lastRow = s.getLastRow();
    const data = s.getDataRange().getValues();
    for (let i=1; i<data.length; i++) if (String(data[i][col-1]).trim() === String(value).trim()) return { success: true };
    let targetRow = 2;
    while(targetRow <= lastRow && s.getRange(targetRow, col).getValue() !== "") targetRow++;
    s.getRange(targetRow, col).setValue(value);
    return { success: true };
}

function getSkuMappings() {
  const s = getSheet(SHEET_PL_SKU);
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return [];
  d.shift();
  return d.map(r => ({ sku: r[1], category: r[2] }));
}

function handleUpdateSkuCategory(sku, category) {
  const s = getSheet(SHEET_PL_SKU);
  const d = s.getDataRange().getValues();
  const skuLower = sku ? String(sku).toLowerCase().trim() : '';
  if (!skuLower) return { success: false };
  for(let i = 1; i < d.length; i++){
    const rowSku = d[i][1] ? String(d[i][1]).toLowerCase().trim() : '';
    if(rowSku === skuLower){ s.getRange(i + 1, 3).setValue(category); return { success: true }; }
  }
  s.appendRow([d.length, sku, category]); return { success: true };
}

function getPriceMappings() {
  const s = getSheet(SHEET_PRICES);
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return [];
  d.shift();
  return d.map(r => ({ category: r[0], price: r[1] }));
}

function handleUpdateCategoryPrice(category, price) {
  const s = getSheet(SHEET_PRICES);
  const d = s.getDataRange().getValues();
  const catLower = category ? String(category).toLowerCase().trim() : '';
  if (!catLower) return { success: false };
  for(let i = 1; i < d.length; i++){
    const rowCat = d[i][0] ? String(d[i][0]).toLowerCase().trim() : '';
    if(rowCat === catLower){ s.getRange(i + 1, 2).setValue(price); return { success: true }; }
  }
  s.appendRow([category, price]); return { success: true };
}

function handleBatchUpdateOrder(data) {
    const s = SpreadsheetApp.openById(data.fileId).getSheets()[0];
    const v = s.getDataRange().getValues();
    const ids = new Set(data.orderIds.map(String));
    const col = data.field === 'isChecked' ? 13 : 28;
    const list = [];
    for (let r = 1; r < v.length; r++) if (ids.has(String(v[r][1]))) list.push(s.getRange(r+1, col).getA1Notation());
    if (list.length > 0) s.getRangeList(list).setValue(data.value ? "TRUE" : "FALSE");
    return { success: true };
}

function handleBatchUpdateDesigner(data) {
    const ss = SpreadsheetApp.openById(data.fileId);
    const ids = new Set(data.orderIds.map(String));
    const val = data.value ? "TRUE" : "FALSE";
    const s0 = ss.getSheets()[0];
    const d0 = s0.getDataRange().getValues();
    const list0 = [];
    for(let r=1; r<d0.length; r++) if(ids.has(String(d0[r][1]))) list0.push(s0.getRange(r+1, 14).getA1Notation());
    if(list0.length > 0) s0.getRangeList(list0).setValue(val);
    ["Designer", "Designer Online"].forEach(name => {
        const s = ss.getSheetByName(name); if (!s) return;
        const d = s.getDataRange().getValues();
        const listSub = [];
        for(let r=1; r<d.length; r++) if(ids.has(String(d[r][2]))) listSub.push(s.getRange(r+1, 10).getA1Notation());
        if(listSub.length > 0) s.getRangeList(listSub).setValue(val);
    });
    return { success: true };
}

function handleSyncPW(fid) {
  try {
    const ss = SpreadsheetApp.openById(fid);
    const mS = ss.getSheets()[0]; const pS = ss.getSheetByName("PW");
    if (!pS) return { success: false };
    const mD = mS.getDataRange().getValues(); const pD = pS.getDataRange().getValues();
    let map = {};
    for (let i = 1; i < pD.length; i++) { const orderName = String(pD[i][3]).trim() || String(pD[i][4]).trim(); if (orderName) map[orderName] = pD[i][5]; }
    let c = 0;
    for (let r = 1; r < mD.length; r++) {
      const orderId = String(mD[r][1]).trim();
      if (map[orderId]) { mS.getRange(r+1, 9).setValue(map[orderId]); mS.getRange(r+1, 28).setValue("TRUE"); c++; }
    }
    return { success: true, updatedCount: c };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function handleSyncFF(fid) {
  try {
    const ss = SpreadsheetApp.openById(fid);
    const mS = ss.getSheets()[0]; const fS = ss.getSheetByName("Fulfillment_Export");
    if (!fS) return { success: false };
    const mD = mS.getDataRange().getValues(); const fD = fS.getDataRange().getValues();
    let set = new Set();
    for (let i = 1; i < fD.length; i++) { const id = String(fD[i][0]).trim(); if (id) set.add(id); }
    let c = 0;
    for (let r = 1; r < mD.length; r++) {
      const orderId = String(mD[r][1]).trim();
      if (set.has(orderId)) { mS.getRange(r+1, 9).setValue("Fulfilled"); mS.getRange(r+1, 28).setValue("TRUE"); c++; }
    }
    return { success: true, updatedCount: c };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function handleSyncFulfillment(fid) { 
  const resPW = handleSyncPW(fid); const resFF = handleSyncFF(fid); 
  return { success: resPW.success || resFF.success, updatedCount: (resPW.updatedCount || 0) + (resFF.updatedCount || 0) }; 
}

function getStoreHistory(id) { const d = getSheet(SHEET_STORE_HISTORY).getDataRange().getValues(); d.shift(); return d.filter(r => String(r[1]) == String(id)).map(r => ({ date: formatDate(r[0]), listing: r[2], sale: r[3] })); }

function autoRecordDailyStats(isDebug) {
  const st = getSheet(SHEET_STORES).getDataRange().getValues(); st.shift(); 
  let tL = 0; let tS = 0; 
  let date = new Date(); if (isDebug) date.setDate(date.getDate() - 1); 
  const dStr = Utilities.formatDate(date, "GMT+7", 'yyyy-MM-dd');
  st.forEach(r => { tL += parseSheetNumber(r[5]); tS += parseSheetNumber(r[6]); getSheet(SHEET_STORE_HISTORY).appendRow([dStr, r[0], r[5], r[6]]); });
  getSheet(SHEET_DAILY).appendRow([dStr, tL, tS]);
}
