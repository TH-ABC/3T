
/**
 * ==========================================
 * LOGIC_FINANCE.GS: TÀI CHÍNH V87.0
 * ==========================================
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
        if ((rowKey === targetYear || rowKey === targetFinanceKey || rowKey.includes(targetYear)) && fileName.includes("FINANCE")) return data[i][1];
    }
    return null;
}

function getActualLastRow(sheet, colIndex) {
  const lastR = sheet.getLastRow() || 1;
  const data = sheet.getRange(1, colIndex, lastR, 1).getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][0]).trim() !== "") return i + 1;
  }
  return 1;
}

function getColIndex(headers, target) {
  if (!headers || !target) return -1;
  const t = target.toLowerCase().replace(/\s/g, '').replace(/,/g, '').replace(/_/g, '').replace(/[.,]/g, '');
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).toLowerCase().replace(/\s/g, '').replace(/,/g, '').replace(/_/g, '').replace(/[.,]/g, '');
    if (h === t) return i;
  }
  return -1;
}

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

function createFinanceFile(year) {
  const masterSS = SpreadsheetApp.getActiveSpreadsheet();
  let indexSheet = masterSS.getSheetByName(SHEET_FILE_INDEX);
  if (!indexSheet) {
    indexSheet = masterSS.insertSheet(SHEET_FILE_INDEX);
    indexSheet.appendRow(['Month', 'FileID', 'FileName', 'CreatedDate']);
  }
  const fileName = `OMS_Finance_${year}`;
  const newSS = SpreadsheetApp.create(fileName);
  const fileId = newSS.getId();
  initFinanceStructure(newSS);
  indexSheet.appendRow([String(year), fileId, fileName, new Date()]);
  return { success: true, fileId: fileId };
}

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
  let sGKE = ss.getSheetByName("GKE") || ss.insertSheet("GKE");
  if (sGKE.getLastRow() === 0 || sGKE.getLastColumn() !== 7) {
    sGKE.clear();
    const h = ['Date', 'OrderNumber', 'TrackingNumber', 'PaymentAmount', 'TopupAmount', 'Note', 'Timestamp'];
    sGKE.appendRow(h);
    sGKE.getRange(1, 1, 1, h.length).setFontWeight("bold").setBackground("#e3f2fd");
    sGKE.setFrozenRows(1);
  }
}

function getFinance(year) {
    const fid = getFinanceFileId(year);
    if (!fid) return { transactions: [], payments: [], printway: [], ebay: [], gke: [], fileId: null };
    try {
        const ss = SpreadsheetApp.openById(fid);
        initFinanceStructure(ss);

        // 1. Transactions
        let transactions = [];
        const sTrans = ss.getSheetByName("Transactions");
        const dataTrans = sTrans.getDataRange().getValues();
        if (dataTrans.length > 1) {
            const h = dataTrans[0];
            const idx = { id: 0, cat: 1, sub: 2, desc: 3, date: 4, qty: 5, price: 6, total: 7, payer: 8, note: 9 };
            dataTrans.shift();
            transactions = dataTrans.filter(r => r[idx.id] || r[idx.desc]).map(r => ({
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
            dataPay.shift();
            payments = dataPay.filter(r => r[0]).map(r => ({
                id: String(r[0]), storeName: String(r[1]), amount: parseSheetNumber(r[2]), region: String(r[3] || "Us"),
                convertedUsd: parseSheetNumber(r[4]), date: formatDate(r[5]).split(' ')[0]
            })).reverse();
        }

        // 3. Printway
        let printway = [];
        const sPW = ss.getSheetByName("Printway");
        const dataPW = sPW.getDataRange().getValues();
        if (dataPW.length > 1) {
            const h = dataPW[0];
            const idx = { 
                inv: getColIndex(h, 'InvoiceID'), 
                type: getColIndex(h, 'Type'), // Quan trọng: cột B là Type của Printway
                status: getColIndex(h, 'Status'), 
                date: getColIndex(h, 'Date'), 
                total: getColIndex(h, 'Totalamount'), 
                fee: getColIndex(h, 'Paymentgatewayfee'), 
                loai: getColIndex(h, 'Loại') 
            };
            dataPW.shift();
            printway = dataPW.filter(r => r[idx.inv]).map(r => ({
                invoiceId: String(r[idx.inv]), 
                type: String(r[idx.type] || "Payment"), // Lấy type từ sheet
                status: String(r[idx.status]), 
                date: formatDate(r[idx.date]), 
                totalAmount: parseSheetNumber(r[idx.total]), 
                fee: parseSheetNumber(r[idx.fee]), 
                loai: String(r[idx.loai] || "Chi Tiền")
            })).reverse();
        }

        // 4. Ebay
        let ebay = [];
        const sEbay = ss.getSheetByName("Ebay");
        const dataEbay = sEbay.getDataRange().getValues();
        if (dataEbay.length > 1) {
            dataEbay.shift();
            ebay = dataEbay.filter(r => r[0]).map(r => ({
                recordId: String(r[0]), accountingTime: formatDate(r[1]), type: String(r[2]), 
                amount: parseSheetNumber(r[3]), cardRemark: String(r[4])
            })).reverse();
        }

        // 5. GKE
        let gke = [];
        const sGKE = ss.getSheetByName("GKE");
        const dataGKE = sGKE.getDataRange().getValues();
        if (dataGKE.length > 1) {
            dataGKE.shift();
            gke = dataGKE.filter(r => r[0] || r[1] || r[2] || r[3] || r[4]).map(r => ({
                date: formatDate(r[0]).split(' ')[0], orderNumber: String(r[1] || ""), trackingNumber: String(r[2] || ""),
                paymentAmount: parseSheetNumber(r[3]), topupAmount: parseSheetNumber(r[4]), note: String(r[5] || "")
            })).reverse();
        }

        return { fileId: fid, transactions, payments, printway, ebay, gke };
    } catch (e) {
        return { error: e.toString() };
    }
}

function updateFinanceField(year, id, field, value) {
  const fid = getFinanceFileId(year);
  if (!fid) return { success: false };
  const ss = SpreadsheetApp.openById(fid);
  const sheet = ss.getSheetByName("Transactions");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = getColIndex(headers, field);
  if (colIdx === -1) return { success: false };
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, colIdx + 1).setValue(value);
      return { success: true };
    }
  }
  return { success: false };
}

function addGKEBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const sGKE = SpreadsheetApp.openById(fid).getSheetByName("GKE");
    const rows = list.map(item => [item.date || new Date(), item.orderNumber || "", item.trackingNumber || "", item.paymentAmount || 0, item.topupAmount || 0, item.note || "", new Date()]);
    sGKE.getRange(sGKE.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
    return { success: true, count: rows.length };
}

function addPrintwayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const sPW = SpreadsheetApp.openById(fid).getSheetByName("Printway");
    const rows = list.map(item => [item.invoiceId, item.type, item.status, item.date, item.method, item.amountUsd, item.fee || 0, item.totalAmount, item.note, item.loai]);
    sPW.getRange(sPW.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
    return { success: true, count: rows.length };
}

function addEbayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const sEbay = SpreadsheetApp.openById(fid).getSheetByName("Ebay");
    const rows = list.map(item => [item.recordId, item.accountingTime, item.type, item.amount, item.cardRemark, new Date()]);
    sEbay.getRange(sEbay.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
    return { success: true, count: rows.length };
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
        for (let i = 1; i < indexData.length; i++) {
          if (String(indexData[i][0]) === searchKey || String(indexData[i][2]).includes(searchKey)) {
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
                for (let i=0; i<sheets.length; i++) {
                  let n = sheets[i].getName().toLowerCase().replace(/\s/g, '');
                  if (n.includes("chấmcông")) { s = sheets[i]; break; }
                }
                if (s) amountVnd = parseSheetNumber(s.getRange("D3").getValue());
            } catch (e) {}
        }
        result.push({ month: String(m), amountVnd: amountVnd, amountUsd: Math.round((amountVnd / VND_RATE) * 100) / 100 });
    }
    return result;
}

function addFinanceMeta(type, value) {
    const s = getSheet(SHEET_FINANCE_META);
    // Cột: 1-Cat, 2-Payer, 3-SubCat, 4-Store, 5-Region
    let col = (type === 'payer') ? 2 : (type === 'subCategory' ? 3 : (type === 'store' ? 4 : (type === 'region' ? 5 : 1)));
    const maxR = s.getMaxRows();
    const data = s.getRange(1, col, maxR, 1).getValues();
    for (let i = 0; i < data.length; i++) {
        const cellVal = String(data[i][0]).trim();
        if (cellVal.toLowerCase() === String(value).trim().toLowerCase()) return { success: true };
        if (cellVal === "" && i > 0) { 
            s.getRange(i + 1, col).setValue(value);
            return { success: true };
        }
    }
    s.getRange(s.getLastRow() + 1, col).setValue(value);
    return { success: true };
}

function getFinanceMeta() {
    const s = getSheet(SHEET_FINANCE_META);
    const d = s.getDataRange().getValues();
    const c = []; const p = ["Hoàng"]; const sc = []; const st = []; const rg = ["Us", "Au", "VN"];
    for (let i = 1; i < d.length; i++) { 
        if (d[i][0]) c.push(d[i][0]); 
        if (d[i][1] && String(d[i][1]).trim() !== "Hoàng") p.push(d[i][1]); 
        if (d[i][2]) sc.push(d[i][2]); 
        if (d[i][3]) st.push(d[i][3]);
        if (d[i][4]) rg.push(d[i][4]);
    }
    return { categories: [...new Set(c)], payers: [...new Set(p)], subCategories: [...new Set(sc)], stores: [...new Set(st.filter(Boolean))], regions: [...new Set(rg.filter(Boolean))] };
}

function addFinance(year, t) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    initFinanceStructure(ss);
    const id = "F-" + Utilities.getUuid().substring(0,8);
    const transDate = t.date ? new Date(t.date) : new Date();
    const row = [id, t.category, t.subCategory || "", t.description, transDate, t.quantity || 1, t.unitPrice || 0, t.totalAmount || 0, t.payer || "Hoàng", t.note || "", new Date()];
    ss.getSheetByName("Transactions").appendRow(row);
    return { success: true, transaction: { id, ...t } };
}

function addPayment(year, p) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    initFinanceStructure(ss);
    const id = "P-" + Utilities.getUuid().substring(0,8);
    const row = [id, p.storeName, p.amount, p.region, p.convertedUsd, p.date || new Date(), new Date()];
    ss.getSheetByName("Payments").appendRow(row);
    return { success: true, payment: { id, ...p } };
}
