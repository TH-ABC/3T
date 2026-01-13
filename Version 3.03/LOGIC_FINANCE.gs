/**
 * ==========================================
 * LOGIC_FINANCE.GS: TÀI CHÍNH & MAPPINGS V8.0
 * ==========================================
 */

// --- QUẢN LÝ SỔ QUỸ (FINANCE) ---
function getFinance(year) {
    const fid = getFinanceFileId(year);
    if (!fid) return { transactions: [], fileId: null };
    const s = SpreadsheetApp.openById(fid).getSheets()[0];
    const data = s.getDataRange().getValues();
    const headers = data[0];
    data.shift();

    const colMap = {};
    headers.forEach((h, i) => colMap[h.toLowerCase()] = i);

    return { 
        fileId: fid, 
        transactions: data.map(r => ({ 
            id: r[colMap['id']], 
            category: r[colMap['category']], 
            subCategory: r[colMap['subcategory']] || "", 
            description: r[colMap['description']], 
            date: formatDate(r[colMap['date']]), 
            quantity: r[colMap['qty']], 
            unitPrice: r[colMap['unitprice']], 
            totalAmount: r[colMap['total']], 
            payer: r[colMap['payer']] || "Công Ty", 
            note: r[colMap['note']] 
        })).reverse() 
    };
}

function addFinance(year, t) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const id = "F-" + Utilities.getUuid().substring(0,8);
    const row = [
        id, 
        t.category, 
        t.subCategory || "", 
        t.description, 
        t.date || new Date(), 
        t.quantity || 1, 
        t.unitPrice || 0, 
        t.totalAmount || 0, 
        t.payer || "Công Ty", 
        t.note || "", 
        new Date()
    ];
    SpreadsheetApp.openById(fid).getSheets()[0].appendRow(row);
    return { success: true, transaction: { id: id, ...t } };
}

function updateFinanceField(year, id, field, value) {
    const fid = getFinanceFileId(year);
    if (!fid) return { success: false, error: "Không tìm thấy file Sổ Quỹ" };
    const s = SpreadsheetApp.openById(fid).getSheets()[0];
    const data = s.getDataRange().getValues();
    const headers = data[0];
    let colIdx = -1;
    for(let j=0; j<headers.length; j++) if(headers[j].toLowerCase() === field.toLowerCase()) { colIdx = j + 1; break; }
    if(colIdx === -1) return { success: false, error: "Trường dữ liệu không tồn tại: " + field };
    for(let i=1; i<data.length; i++) if(String(data[i][0]).trim() === String(id).trim()) { s.getRange(i+1, colIdx).setValue(value); return { success: true }; }
    return { success: false, error: "Không tìm thấy giao dịch ID: " + id };
}

function getFinanceMeta() {
    const s = getSheet(SHEET_FINANCE_META);
    const d = s.getDataRange().getValues();
    const c = []; const p = []; const sc = [];
    p.push("Công Ty"); 
    for (let i = 1; i < d.length; i++) { 
        if (d[i][0]) c.push(d[i][0]); 
        if (d[i][1] && String(d[i][1]).trim() !== "Công Ty") p.push(d[i][1]); 
        if (d[i][2]) sc.push(d[i][2]);
    }
    return { categories: [...new Set(c)], payers: [...new Set(p)], subCategories: sc };
}

function addFinanceMeta(type, value) {
    const s = getSheet(SHEET_FINANCE_META);
    let col = 1;
    if (type === 'payer') col = 2;
    else if (type === 'subCategory') col = 3;
    const lastRow = s.getLastRow();
    const data = s.getDataRange().getValues();
    for (let i=1; i<data.length; i++) if (String(data[i][col-1]).trim() === String(value).trim()) return { success: true };
    let targetRow = 2;
    while(targetRow <= lastRow && s.getRange(targetRow, col).getValue() !== "") targetRow++;
    s.getRange(targetRow, col).setValue(value);
    return { success: true };
}

// --- RESTORED MAPPINGS & CONFIGS ---
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
  const skuLower = String(sku).toLowerCase().trim();
  for(let i = 1; i < d.length; i++){
    if(String(d[i][1]).toLowerCase().trim() === skuLower){
      s.getRange(i + 1, 3).setValue(category);
      return { success: true };
    }
  }
  s.appendRow([d.length, sku, category]);
  return { success: true };
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
  const catLower = String(category).toLowerCase().trim();
  for(let i = 1; i < d.length; i++){
    if(String(d[i][0]).toLowerCase().trim() === catLower){
      s.getRange(i + 1, 2).setValue(price);
      return { success: true };
    }
  }
  s.appendRow([category, price]);
  return { success: true };
}

// --- SYNC & BATCH (FIXED MISSING VARIABLES) ---
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
    
    // 1. Cập nhật tại Master Sheet (Cột N: Design Done - Index 14)
    const s0 = ss.getSheets()[0];
    const d0 = s0.getDataRange().getValues();
    const list0 = [];
    for(let r=1; r<d0.length; r++) if(ids.has(String(d0[r][1]))) list0.push(s0.getRange(r+1, 14).getA1Notation());
    if(list0.length > 0) s0.getRangeList(list0).setValue(val);

    // 2. Cập nhật đồng bộ tại các Tab Designer (Cột J: Design Done - Index 10)
    ["Designer", "Designer Online"].forEach(name => {
        const s = ss.getSheetByName(name);
        if (!s) return;
        const d = s.getDataRange().getValues();
        const idIdx = 2; // Cột C: ID Etsy
        const resIdx = 10; // Cột K: Design Done
        const listSub = [];
        for(let r=1; r<d.length; r++) {
            if(ids.has(String(d[r][idIdx]))) {
                listSub.push(s.getRange(r+1, resIdx).getA1Notation());
            }
        }
        if(listSub.length > 0) s.getRangeList(listSub).setValue(val);
    });
    return { success: true };
}

function handleSyncPW(fid) {
  try {
    const ss = SpreadsheetApp.openById(fid);
    const mS = ss.getSheets()[0]; 
    const pS = ss.getSheetByName("PW");
    if (!pS) return { success: false, error: "Không tìm thấy sheet PW" };
    const mD = mS.getDataRange().getValues(); 
    const pD = pS.getDataRange().getValues();
    let map = {};
    for (let i = 1; i < pD.length; i++) { 
        const orderName = String(pD[i][3]).trim(); 
        if (orderName) map[orderName] = pD[i][5]; 
    }
    let c = 0;
    for (let r = 1; r < mD.length; r++) {
      const orderId = String(mD[r][1]).trim();
      if (map[orderId]) { 
        mS.getRange(r+1, 9).setValue(map[orderId]); 
        mS.getRange(r+1, 28).setValue("TRUE"); 
        c++; 
      }
    }
    return { success: true, updatedCount: c };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function handleSyncFF(fid) {
  try {
    const ss = SpreadsheetApp.openById(fid);
    const mS = ss.getSheets()[0]; 
    const fS = ss.getSheetByName("Fulfillment_Export");
    if (!fS) return { success: false, error: "Không tìm thấy sheet Fulfillment_Export" };
    const mD = mS.getDataRange().getValues(); 
    const fD = fS.getDataRange().getValues();
    let set = new Set();
    for (let i = 1; i < fD.length; i++) { const id = String(fD[i][0]).trim(); if (id) set.add(id); }
    let c = 0;
    for (let r = 1; r < mD.length; r++) {
      const orderId = String(mD[r][1]).trim();
      const isAlreadyFulfilled = String(mD[r][27]).toUpperCase() === "TRUE";
      if (!isAlreadyFulfilled && set.has(orderId)) { 
        mS.getRange(r+1, 9).setValue("Fulfilled"); 
        mS.getRange(r+1, 28).setValue("TRUE"); 
        c++; 
      }
    }
    return { success: true, updatedCount: c };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function handleSyncFulfillment(fid) { 
  const resPW = handleSyncPW(fid); 
  const resFF = handleSyncFF(fid); 
  return { 
    success: resPW.success || resFF.success, 
    updatedCount: (resPW.updatedCount || 0) + (resFF.updatedCount || 0) 
  }; 
}

function getStoreHistory(id) { const d = getSheet(SHEET_STORE_HISTORY).getDataRange().getValues(); d.shift(); return d.filter(r => String(r[1]) == String(id)).map(r => ({ date: formatDate(r[0]), listing: r[2], sale: r[3] })); }

function autoRecordDailyStats(isDebug) {
  const st = getSheet(SHEET_STORES).getDataRange().getValues(); st.shift(); 
  let tL = 0; let tS = 0; 
  let date = new Date(); if (isDebug) date.setDate(date.getDate() - 1); 
  const dStr = Utilities.formatDate(date, "GMT+7", 'yyyy-MM-dd');
  st.forEach(r => { tL += Number(r[5]); tS += Number(r[6]); getSheet(SHEET_STORE_HISTORY).appendRow([dStr, r[0], r[5], r[6]]); });
  getSheet(SHEET_DAILY).appendRow([dStr, tL, tS]);
}