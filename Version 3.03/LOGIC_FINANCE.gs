
/**
 * ==========================================
 * LOGIC_FINANCE.GS: TÀI CHÍNH & MAPPINGS V80.0
 * BẢO TOÀN 100% LOGIC V74.0 - KHÔNG RÚT GỌN
 * ==========================================
 */

/**
 * Tìm File ID của năm tài chính từ Sheet FileIndex (Logic linh hoạt V74.0)
 */
function getFinanceFileId(year) {
    return getFileIdForMonth(year, "Finance");
}

// AI INSIGHT HANDLERS - Fix triệt để lỗi Google Sheet auto-format YYYY-MM thành Date
function handleGetAiInsight(monthKey, year) {
  const s = getSheet(SHEET_AI_INSIGHTS);
  const data = s.getDataRange().getValues();

  // monthKey dự kiến "01".."12", year "2026"
  const searchKey = `${year}-${monthKey}`; // "2026-01"

  for (let i = 1; i < data.length; i++) {
    const rowValue = data[i][0];
    let rowKeyString = "";

    if (rowValue instanceof Date) {
      // Nếu bị auto-convert Date => ép về yyyy-MM để so khớp
      rowKeyString = Utilities.formatDate(rowValue, "GMT+7", "yyyy-MM");
    } else {
      rowKeyString = String(rowValue).trim();
      // Nếu sheet lưu kiểu "'2026-01" (text forced) => normalize bỏ dấu '
      if (rowKeyString.startsWith("'")) rowKeyString = rowKeyString.slice(1).trim();
    }

    if (rowKeyString === searchKey) {
      return {
        success: true,
        content: data[i][1],
        updatedDate: formatDate(data[i][2])
      };
    }
  }

  return { success: true, content: null };
}

function handleSaveAiInsight(monthKey, year, content) {
  const s = getSheet(SHEET_AI_INSIGHTS);
  const data = s.getDataRange().getValues();
  const searchKey = `${year}-${monthKey}`; // "2026-01"
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const rowValue = data[i][0];
    let rowKeyString = "";

    if (rowValue instanceof Date) {
      rowKeyString = Utilities.formatDate(rowValue, "GMT+7", "yyyy-MM");
    } else {
      rowKeyString = String(rowValue).trim();
      if (rowKeyString.startsWith("'")) rowKeyString = rowKeyString.slice(1).trim();
    }

    if (rowKeyString === searchKey) {
      s.getRange(i + 1, 2).setValue(content);
      s.getRange(i + 1, 3).setValue(now);
      return { success: true };
    }
  }

  // Lưu mới: ép Text bằng dấu nháy đơn để tránh auto-format thành Date
  s.appendRow(["'" + searchKey, content, now]);
  return { success: true };
}


/**
 * Hàm lấy Last Row thực tế dựa trên 1 cột (Bảo toàn V74.0)
 * Trả về 1 nếu bảng trống để tránh lỗi range
 */
function getActualLastRow(sheet, colIndex) {
  const lastR = sheet.getLastRow() || 1;
  const data = sheet.getRange(1, colIndex, lastR, 1).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][0]).trim() !== "") return i + 1;
  }
  return 1;
}

/**
 * Lấy Index cột theo tên (Khôi phục V74.0)
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
 * Chuẩn hóa số (Bảo toàn V74.0)
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
 * Tạo File Tài Chính mới (Khôi phục V74.0 styling)
 */
function createFinanceFile(year) {
  const masterSS = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Kiểm tra xem đã có file chưa để tránh tạo trùng
  const existingId = getFinanceFileId(year);
  if (existingId) return { success: true, fileId: existingId, message: "File đã tồn tại" };

  let indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX);
  if (!indexSheet) {
    indexSheet = masterSS.insertSheet(SHEET_FILE_INDEX);
    const h = ['Month', 'FileID', 'FileName', 'CreatedDate'];
    indexSheet.appendRow(h);
    indexSheet.getRange(1,1,1,h.length).setFontWeight("bold").setBackground("#f8f9fa");
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
 * Khởi tạo cấu trúc các sheet (Có đầy đủ styling V74.0)
 */
function initFinanceStructure(ss) {
  // 1. Transactions
  let sTrans = ss.getSheetByName("Transactions") || ss.getSheets()[0];
  if (sTrans.getName() !== "Transactions") sTrans.setName("Transactions");
  if (sTrans.getLastRow() === 0) {
    const h = ['ID', 'Category', 'SubCategory', 'Description', 'Date', 'Qty', 'UnitPrice', 'Total', 'Payer', 'Note', 'Timestamp'];
    sTrans.appendRow(h);
    sTrans.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("white");
    sTrans.setFrozenRows(1);
  }
  
  // 2. Payments
  let sPay = ss.getSheetByName("Payments") || ss.insertSheet("Payments");
  if (sPay.getLastRow() === 0) {
    const h = ['ID', 'StoreName', 'Amount', 'Region', 'ConvertedUSD', 'Date', 'Timestamp'];
    sPay.appendRow(h);
    sPay.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#fff3e0");
    sPay.setFrozenRows(1); 
  }

  // 3. Printway
  let sPW = ss.getSheetByName("Printway") || ss.insertSheet("Printway");
  if (sPW.getLastRow() === 0) {
    const h = ['InvoiceID', 'Type', 'Status', 'Date', 'Method', 'AmountUSD', 'Paymentgatewayfee', 'Totalamount', 'Note', 'Loại', 'Tháng'];
    sPW.appendRow(h);
    sPW.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#e8f5e9");
    sPW.setFrozenRows(1);
  }

  // 4. Ebay
  let sEbay = ss.getSheetByName("Ebay") || ss.insertSheet("Ebay");
  if (sEbay.getLastRow() === 0) {
    const h = ['RecordID', 'AccountingTime', 'Type', 'Amount', 'CardRemark', 'Timestamp'];
    sEbay.appendRow(h);
    sEbay.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#fffde7");
    sEbay.setFrozenRows(1);
  }

  // 5. GKE (Schema 7 cột: Date, Order#, Tracking#, PayVND, TopupVND, Note, TS)
  let sGKE = ss.getSheetByName("GKE") || ss.insertSheet("GKE");
  if (sGKE.getLastRow() === 0 || sGKE.getLastColumn() !== 7) {
    sGKE.clear();
    const h = ['Date', 'OrderNumber', 'TrackingNumber', 'PaymentAmount', 'TopupAmount', 'Note', 'Timestamp'];
    sGKE.appendRow(h);
    sGKE.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#e3f2fd");
    sGKE.setFrozenRows(1);
  }
    // 6. Hold (NEW)
  let sHold = ss.getSheetByName("Hold") || ss.insertSheet("Hold");
  if (sHold.getLastRow() === 0) {
    const h = ['ID', 'StoreName', 'Amount', 'Region', 'Date', 'Timestamp'];
    sHold.appendRow(h);
    sHold.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#fce4ec");
    sHold.setFrozenRows(1);
  }

}

/**
 * Lấy toàn bộ dữ liệu tài chính (Bảo toàn V74.0 mapping qua getColIndex)
 */
function getFinance(year) {
    const fid = getFinanceFileId(year);
    if (!fid) return { transactions: [], payments: [], printway: [], ebay: [], gke: [], hold: [], fileId: null };
    
    try {
        const ss = SpreadsheetApp.openById(fid);
        initFinanceStructure(ss);

        // 1. Transactions
        let transactions = [];
        const sTrans = ss.getSheetByName("Transactions");
        const dataTrans = sTrans.getDataRange().getValues();
        if (dataTrans.length > 1) {
            const h = dataTrans[0];
            const idx = {
              id: getColIndex(h, 'ID'), cat: getColIndex(h, 'Category'), sub: getColIndex(h, 'SubCategory'),
              desc: getColIndex(h, 'Description'), date: getColIndex(h, 'Date'), qty: getColIndex(h, 'Qty'),
              price: getColIndex(h, 'UnitPrice'), total: getColIndex(h, 'Total'), payer: getColIndex(h, 'Payer'), note: getColIndex(h, 'Note')
            };
            dataTrans.shift();
            // Filter linh hoạt V74.0: Chấp nhận dòng có mô tả dù không có ID
            transactions = dataTrans.filter(r => String(r[idx.id]).trim() || String(r[idx.desc]).trim()).map(r => ({
              id: String(r[idx.id]), category: String(r[idx.cat] || "Chi Tiền"), subCategory: String(r[idx.sub] || ""), description: String(r[idx.desc] || ""),
              date: formatDate(r[idx.date]), quantity: parseSheetNumber(r[idx.qty]), unitPrice: parseSheetNumber(r[idx.price]), totalAmount: parseSheetNumber(r[idx.total]),
              payer: String(r[idx.payer] || "Hoàng"), note: String(r[idx.note] || "")
            })).reverse();
        }

        // 2. Payments
        let payments = [];
        const sPay = ss.getSheetByName("Payments");
        const dataPay = sPay.getDataRange().getValues();
        if (dataPay.length > 1) {
            const h = dataPay[0];
            const idx = { id: getColIndex(h, 'ID'), name: getColIndex(h, 'StoreName'), amt: getColIndex(h, 'Amount'), reg: getColIndex(h, 'Region'), usd: getColIndex(h, 'ConvertedUSD'), date: getColIndex(h, 'Date'), ts: getColIndex(h, 'Timestamp') };
            dataPay.shift();
            payments = dataPay.filter(r => r[idx.id]).map(r => ({
                id: String(r[idx.id]), storeName: String(r[idx.name]), amount: parseSheetNumber(r[idx.amt]), region: String(r[idx.reg] || "Us"),
                convertedUsd: parseSheetNumber(r[idx.usd]), date: formatDate(r[idx.date]).split(' ')[0], timestamp: formatDate(r[idx.ts])
            })).reverse();
        }

        // 3. Printway
        let printway = [];
        const sPW = ss.getSheetByName("Printway");
        const dataPW = sPW.getDataRange().getValues();
        if (dataPW.length > 1) {
            const h = dataPW[0];
            const idx = { 
              inv: getColIndex(h, 'InvoiceID'), type: getColIndex(h, 'Type'), status: getColIndex(h, 'Status'),
              total: getColIndex(h, 'Totalamount'), loai: getColIndex(h, 'Loại'),
              date: getColIndex(h, 'Date'), method: getColIndex(h, 'Method'),
              amtUsd: getColIndex(h, 'AmountUSD'), fee: getColIndex(h, 'Paymentgatewayfee'), note: getColIndex(h, 'Note')
            };
            dataPW.shift();
            printway = dataPW.filter(r => r[idx.inv]).map(r => {
                const typeRaw = String(r[idx.type] || "");
                const isRefund = typeRaw.toLowerCase().includes('refund');
                const isTopup = typeRaw.toLowerCase().includes('top-up');
                return {
                    invoiceId: String(r[idx.inv]), type: typeRaw, status: String(r[idx.status] || "Completed"), date: formatDate(r[idx.date]), 
                    totalAmount: parseSheetNumber(r[idx.total]), 
                    loai: isRefund ? "Thu Tiền" : (isTopup ? "Nạp Tiền" : (String(r[idx.loai] || "Chi Tiền"))),
                    method: String(r[idx.method] || ""), amountUsd: parseSheetNumber(r[idx.amtUsd]), 
                    fee: parseSheetNumber(r[idx.fee]), note: String(r[idx.note] || "")
                };
            }).reverse();
        }

        // 4. Ebay
          let ebay = [];
          const sEbay = ss.getSheetByName("Ebay");
          const dataEbay = sEbay.getDataRange().getValues();
          if (dataEbay.length > 1) {
          const h = dataEbay[0];
          const idx = { rid: getColIndex(h, 'RecordID'), time: getColIndex(h, 'AccountingTime'), type: getColIndex(h, 'Type'), amt: getColIndex(h, 'Amount'), remark: getColIndex(h, 'CardRemark') };
          dataEbay.shift();
          ebay = dataEbay.filter(r => r[idx.rid]).map(r => ({
        recordId: String(r[idx.rid]),
        accountingTime: formatDate(r[idx.time]),
        type: String(r[idx.type]),
        amount: parseSheetNumber(r[idx.amt]),
        cardRemark: String(r[idx.remark]),
        timestamp: formatDate(r[5])
    })).reverse();
}


        // 5. GKE (7 cột: Date, Order#, Tracking#, PayVND, TopupUSD, Note, TS)
        let gke = [];
        const sGKE = ss.getSheetByName("GKE");
        const dataGKE = sGKE.getDataRange().getValues();
        if (dataGKE.length > 1) {
            dataGKE.shift();
            gke = dataGKE.filter(r => r[0] || r[1] || r[2] || r[3] || r[4]).map(r => ({
                date: formatDate(r[0]).split(' ')[0], 
                orderNumber: String(r[1] || ""), 
                trackingNumber: String(r[2] || ""),
                paymentAmount: parseSheetNumber(r[3]), 
                topupAmount: parseSheetNumber(r[4]), 
                note: String(r[5] || "")
            })).reverse();
        }


        // 6. Hold (NEW)
        let hold = [];
        const sHold = ss.getSheetByName("Hold");
        if (sHold) {
            const dataHold = sHold.getDataRange().getValues();
            if (dataHold.length > 1) {
                dataHold.shift();
                hold = dataHold.filter(r => r[0]).map(r => ({
                    id: String(r[0]),
                    storeName: String(r[1]),
                    amount: parseSheetNumber(r[2]),
                    region: String(r[3] || "Us"),
                    date: formatDate(r[4]).split(' ')[0]
                })).reverse();
            }
        }

        return { fileId: fid, transactions, payments, printway, ebay, gke, hold };
    } catch (e) {
        return { error: e.toString() };
    }
}

/**
 * Cập nhật Field (Khôi phục V74.0 output)
 */
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

/**
 * Thêm Batch GKE (Chống trùng V74.0 logic - Quét cột OrderNumber)
 */
function addGKEBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    const sGKE = ss.getSheetByName("GKE");
    
    // Quét cột B (OrderNumber) để chống trùng
    const lastRow = getActualLastRow(sGKE, 2); 
    let existingIds = new Set();
    if (lastRow > 1) {
        sGKE.getRange(2, 2, lastRow - 1, 1).getValues().forEach(r => { 
            const id = String(r[0]).trim();
            if(id) existingIds.add(id); 
        });
    }

    const filtered = list.filter(item => {
        const id = String(item.orderNumber || "").trim();
        // Nếu không có OrderNumber (như dòng Topup) thì cho phép nạp luôn, không check Set
        if (!id) return true; 
        return !existingIds.has(id);
    });

    if (filtered.length === 0) return { success: true, count: 0, message: "Dữ liệu đã tồn tại" };

    const rows = filtered.map(item => [
      item.date || new Date(), item.orderNumber || "", item.trackingNumber || "",
      item.paymentAmount || 0, item.topupAmount || 0, item.note || "", new Date()
    ]);
    sGKE.getRange(sGKE.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
    return { success: true, count: rows.length };
}

/**
 * Batch Printway (Chống trùng + Logic Topup V74.0)
 */
function addPrintwayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    let sPW = ss.getSheetByName("Printway");
    if (!sPW) {
        initFinanceStructure(ss);
        sPW = ss.getSheetByName("Printway");
    }
    
    const lastRow = getActualLastRow(sPW, 1);
    let existingIds = new Set();
    if (lastRow > 1) {
        // Lấy dữ liệu cột A (InvoiceID) để check trùng
        const data = sPW.getRange(2, 1, lastRow - 1, 1).getValues();
        data.forEach(r => { 
            const id = String(r[0] || "").trim().toLowerCase();
            if (id) existingIds.add(id); 
        });
    }

    // Lọc trùng trong chính danh sách tải lên và so với dữ liệu đã có
    let seenInBatch = new Set();
    const filtered = list.filter(item => {
        const id = String(item.invoiceId || "").trim().toLowerCase();
        if (!id || existingIds.has(id) || seenInBatch.has(id)) {
            return false;
        }
        seenInBatch.add(id);
        return true;
    });

    if (filtered.length === 0) return { success: true, count: 0, message: "Dữ liệu đã tồn tại hoặc không có dữ liệu mới" };

    const rows = filtered.map(item => {
      const typeStr = String(item.type || "");
      const isRefund = typeStr.toLowerCase().includes("refund");
      const isTopup = typeStr.toLowerCase().includes("top-up");
      
      // Xác định mã tháng (T1, T2...) dựa trên date nếu có
      let monthCode = "";
      try {
        if (item.date) {
          const d = new Date(item.date);
          if (!isNaN(d.getTime())) {
            monthCode = "T" + (d.getMonth() + 1);
          }
        }
      } catch(e) {}

      return [
        String(item.invoiceId).trim(), 
        typeStr, 
        item.status || "Completed", 
        item.date || new Date(), 
        item.method || "Wallet", 
        item.amountUsd || 0, 
        item.fee || 0, 
        item.totalAmount || 0, 
        item.note || "", 
        isRefund ? "Thu Tiền" : (isTopup ? "Nạp Tiền" : "Chi Tiền"),
        monthCode
      ];
    });
    
    // Tìm dòng cuối thực tế để append tránh tạo khoảng trống
    const appendRow = getActualLastRow(sPW, 1) + 1;
    sPW.getRange(appendRow, 1, rows.length, 11).setValues(rows);
    return { success: true, count: rows.length };
}

/**
 * Batch Ebay (V74.0)
 */
function addEbayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    const sEbay = ss.getSheetByName("Ebay");
    const lastRow = getActualLastRow(sEbay, 1);
    let existingIds = new Set();
    if (lastRow > 1) {
        sEbay.getRange(2, 1, lastRow - 1, 1).getValues().forEach(r => { if(r[0]) existingIds.add(String(r[0]).trim()); });
    }
    const filtered = list.filter(item => {
        const id = String(item.recordId || "").trim();
        return id && !existingIds.has(id);
    });
    if (filtered.length === 0) return { success: true, count: 0, message: "Không có dữ liệu mới" };
    const rows = filtered.map(item => [item.recordId, item.accountingTime, item.type, item.amount, item.cardRemark, new Date()]);
    sEbay.getRange(sEbay.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
    return { success: true, count: rows.length };
}

/**
 * Lấy lương nhân viên 12 tháng (Dò sheet thông minh V74.0: tìm "chấmcông")
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
        let fileId = getFileIdForMonth(monthStr, "Timekeeping");
        
        let amountVnd = 0;
        if (fileId) {
            try {
                const ss = SpreadsheetApp.openById(fileId);
                const sheets = ss.getSheets();
                let s = null;
                for (let i=0; i<sheets.length; i++) {
                  let sn = sheets[i].getName().toLowerCase().replace(/\s/g, '');
                  if (sn.includes("chấmcông")) { s = sheets[i]; break; }
                }
                if (s) amountVnd = parseSheetNumber(s.getRange("D3").getValue());
            } catch (e) { console.warn(e); }
        }
        result.push({ month: String(m), amountVnd: amountVnd, amountUsd: Math.round((amountVnd / VND_RATE) * 100) / 100 });
    }
    return result;
}

/**
 * Các hàm Metadata (Khôi phục V74.0: Điền vào ô trống đầu tiên trong cột)
 */
function addFinanceMeta(type, value) {
    const s = getSheet(SHEET_FINANCE_META);
    let col = (type === 'payer') ? 2 : (type === 'subCategory' ? 3 : (type === 'store' ? 4 : (type === 'region' ? 5 : 1)));
    
    // Scan tìm ô trống đầu tiên trong cột (Logic V74.0)
    const data = s.getRange(1, col, s.getMaxRows(), 1).getValues();
    for (let i = 0; i < data.length; i++) {
        const cellVal = String(data[i][0]).trim();
        if (cellVal.toLowerCase() === String(value).trim().toLowerCase()) return { success: true };
        if (cellVal === "" && i > 0) { // i > 0 để bỏ qua header
            s.getRange(i + 1, col).setValue(value);
            return { success: true };
        }
    }
    // Nếu toàn bộ cột đầy (hiếm), append xuống cuối
    s.getRange(s.getLastRow() + 1, col).setValue(value);
    return { success: true };
}

function getFinanceMeta() {
    const s = getSheet(SHEET_FINANCE_META);
    const d = s.getDataRange().getValues();
    const c = []; const p = ["Hoàng"]; const sc = [];
    const st = []; const rg = ["Us", "Au", "VN"];
    for (let i = 1; i < d.length; i++) { 
        if (d[i][0]) c.push(d[i][0]); 
        if (d[i][1] && String(d[i][1]).trim() !== "Hoàng") p.push(d[i][1]); 
        if (d[i][2]) sc.push(d[i][2]); 
        if (d[i][3]) st.push(d[i][3]);
        if (d[i][4]) rg.push(d[i][4]);
    }
    return { categories: [...new Set(c)], payers: [...new Set(p)], subCategories: [...new Set(sc)], stores: [...new Set(st.filter(Boolean))], regions: [...new Set(rg.filter(Boolean))] };
}

/**
 * Thêm giao dịch (Khôi phục Output V74.0)
 */
function addFinance(year, t) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const id = "F-" + Utilities.getUuid().substring(0,8);
    const row = [id, t.category, t.subCategory || "", t.description, t.date || new Date(), t.quantity || 1, t.unitPrice || 0, t.totalAmount || 0, t.payer || "Hoàng", t.note || "", new Date()];
    SpreadsheetApp.openById(fid).getSheetByName("Transactions").appendRow(row);
    return { success: true, transaction: { id, ...t } };
}

function addPayment(year, p) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const id = "P-" + Utilities.getUuid().substring(0,8);
    const row = [id, p.storeName, p.amount, p.region, p.convertedUsd, p.date || new Date(), new Date()];
    SpreadsheetApp.openById(fid).getSheetByName("Payments").appendRow(row);
    return { success: true, payment: { id, ...p } };
}

/**
 * addHold UPSERT (NEW):
 * 1 StoreName chỉ có duy nhất 1 dòng trong sheet Hold
 * - Nếu đã có store => update Amount/Region/Date/Timestamp
 * - Nếu chưa có => appendRow mới
 */
function addHold(year, h) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    initFinanceStructure(ss);

    const sHold = ss.getSheetByName("Hold");
    const data = sHold.getDataRange().getValues();

    const targetStore = String(h.storeName || "").trim().toLowerCase();
    const now = new Date();

    // Nếu storeName rỗng vẫn cho thêm mới như append (tránh lỗi upsert)
    if (!targetStore) {
        const id = "H-" + Utilities.getUuid().substring(0,8);
        const holdDate = h.date ? new Date(h.date) : now;
        const row = [id, h.storeName || "", h.amount || 0, h.region || "", holdDate, now];
        sHold.appendRow(row);
        return { success: true, mode: 'added' };
    }

    // Dò cột B (StoreName) để upsert
    for (let i = 1; i < data.length; i++) {
        const storeCell = String(data[i][1] || "").trim().toLowerCase();
        if (storeCell === targetStore) {
            // Update C->F: Amount, Region, Date, Timestamp
            sHold.getRange(i + 1, 3).setValue(h.amount || 0);
            sHold.getRange(i + 1, 4).setValue(h.region || "");
            const holdDate = h.date ? new Date(h.date) : now;
            sHold.getRange(i + 1, 5).setValue(holdDate);
            sHold.getRange(i + 1, 6).setValue(now);
            return { success: true, mode: 'updated' };
        }
    }

    // Chưa có store => add mới
    const id = "H-" + Utilities.getUuid().substring(0,8);
    const holdDate = h.date ? new Date(h.date) : now;
    const row = [id, h.storeName, h.amount || 0, h.region || "", holdDate, now];
    sHold.appendRow(row);
    return { success: true, mode: 'added' };
}



