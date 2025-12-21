/**
 * ==========================================
 * LOGIC_FINANCE.GS: TÀI CHÍNH & VẬN HÀNH
 * ==========================================
 */

// --- QUẢN LÝ SỔ QUỸ (FINANCE) ---
function getFinance(year) {
    const fid = getFinanceFileId(year);
    if (!fid) return { transactions: [], fileId: null };
    const d = SpreadsheetApp.openById(fid).getSheets()[0].getDataRange().getValues();
    d.shift();
    return { 
        fileId: fid, 
        transactions: d.map(r => ({ 
            id: r[0], category: r[1], description: r[2], 
            date: formatDate(r[3]), quantity: r[4], unitPrice: r[5], 
            totalAmount: r[6], payer: r[7], note: r[8] 
        })).reverse() 
    };
}

function addFinance(year, t) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const id = "F-" + Utilities.getUuid().substring(0,8);
    const row = [id, t.category, t.description, t.date || new Date(), t.quantity || 1, t.unitPrice || 0, t.totalAmount || 0, t.payer, t.note || "", new Date()];
    SpreadsheetApp.openById(fid).getSheets()[0].appendRow(row);
    return { success: true, transaction: { id: id, ...t } };
}

function getFinanceMeta() {
    const d = getSheet(SHEET_FINANCE_META).getDataRange().getValues();
    const c = []; const p = [];
    for (let i = 1; i < d.length; i++) { 
        if (d[i][0]) c.push(d[i][0]); 
        if (d[i][1]) p.push(d[i][1]); 
    }
    return { categories: c, payers: p };
}

function addFinanceMeta(type, value) {
    const s = getSheet(SHEET_FINANCE_META);
    const col = type === 'category' ? 1 : 2;
    s.getRange(s.getLastRow() + 1, col).setValue(value);
    return { success: true };
}

// --- MAPPINGS & CONFIGS ---
function getSkuMappings() {
  const d = getSheet(SHEET_PL_SKU).getDataRange().getValues(); 
  d.shift();
  return d.map(r => ({ sku: String(r[1]), category: String(r[2]) })).filter(x => x.sku);
}

function handleUpdateSkuCategory(sku, cat) {
    const s = getSheet(SHEET_PL_SKU);
    const d = s.getDataRange().getValues();
    for(let i=1; i<d.length; i++) {
        if(String(d[i][1]).toLowerCase() === sku.toLowerCase()) { 
            s.getRange(i+1, 3).setValue(cat); 
            return { success: true }; 
        }
    }
    s.appendRow([s.getLastRow(), sku, cat]);
    return { success: true };
}

function getPriceMappings() {
    const d = getSheet(SHEET_PRICES).getDataRange().getValues(); 
    d.shift();
    return d.map(r => ({ category: String(r[0]), price: Number(r[1]||0) }));
}

function handleUpdateCategoryPrice(cat, pr) {
    const s = getSheet(SHEET_PRICES);
    const d = s.getDataRange().getValues();
    for(let i=1; i<d.length; i++) {
        if(String(d[i][0]).toLowerCase() === cat.toLowerCase()) { 
            s.getRange(i+1, 2).setValue(pr); 
            return { success: true }; 
        }
    }
    s.appendRow([cat, pr]);
    return { success: true };
}

// --- ĐỒNG BỘ & BATCH UPDATES ---
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
        const s = ss.getSheetByName(name);
        if (!s) return;
        const d = s.getDataRange().getValues();
        const idIdx = 2; const resIdx = 10;
        const listSub = [];
        for(let r=1; r<d.length; r++) if(ids.has(String(d[r][idIdx]))) listSub.push(s.getRange(r+1, resIdx).getA1Notation());
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

// --- THỐNG KÊ STORE ---
function getStoreHistory(id) {
    const d = getSheet(SHEET_STORE_HISTORY).getDataRange().getValues(); 
    d.shift();
    return d.filter(r => String(r[1]) == String(id)).map(r => ({ date: formatDate(r[0]), listing: r[2], sale: r[3] }));
}

function autoRecordDailyStats(isDebug) {
  const st = getSheet(SHEET_STORES).getDataRange().getValues(); 
  st.shift(); 
  let tL = 0; let tS = 0; 
  let date = new Date(); 
  if (isDebug) date.setDate(date.getDate() - 1); 
  const dStr = Utilities.formatDate(date, "GMT+7", 'yyyy-MM-dd');
  st.forEach(r => { 
      tL += Number(r[5]); 
      tS += Number(r[6]); 
      getSheet(SHEET_STORE_HISTORY).appendRow([dStr, r[0], r[5], r[6]]); 
  });
  getSheet(SHEET_DAILY).appendRow([dStr, tL, tS]);
}