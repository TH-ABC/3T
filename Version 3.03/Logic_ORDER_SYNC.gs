
/**
 * ==========================================
 * LOGIC_ORDER_SYNC.GS: MAPPING & BATCH SYNC V10.8
 * ==========================================
 */

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
    const mS = ss.getSheets()[0]; 
    const pS = ss.getSheetByName("PW");
    if (!pS) return { success: false, error: "Sheet PW không tồn tại" };
    const mD = mS.getDataRange().getValues(); 
    const pD = pS.getDataRange().getValues();
    let map = {};
    for (let i = 1; i < pD.length; i++) { 
        const orderName = String(pD[i][3]).trim() || String(pD[i][4]).trim(); 
        if (orderName) map[orderName] = pD[i][5]; 
    }
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
    const mS = ss.getSheets()[0]; 
    const fS = ss.getSheetByName("Fulfillment_Export");
    if (!fS) return { success: false, error: "Sheet Fulfillment_Export không tồn tại" };
    const mD = mS.getDataRange().getValues(); 
    const fD = fS.getDataRange().getValues();
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
  const resPW = handleSyncPW(fid); 
  const resFF = handleSyncFF(fid); 
  return { success: resPW.success || resFF.success, updatedCount: (resPW.updatedCount || 0) + (resFF.updatedCount || 0) }; 
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
  for(let i = 1; i < d.length; i++){
    if(String(d[i][1]).toLowerCase().trim() === skuLower){ s.getRange(i + 1, 3).setValue(category); return { success: true }; }
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
  for(let i = 1; i < d.length; i++){
    if(String(d[i][0]).toLowerCase().trim() === category.toLowerCase().trim()){ s.getRange(i + 1, 2).setValue(price); return { success: true }; }
  }
  s.appendRow([category, price]); return { success: true };
}

function getStoreHistory(id) {
  const d = getSheet(SHEET_STORE_HISTORY).getDataRange().getValues();
  d.shift();
  return d.filter(r => String(r[1]) == String(id)).map(r => ({ date: formatDate(r[0]), listing: r[2], sale: r[3] }));
}

function autoRecordDailyStats(isDebug) {
  const st = getSheet(SHEET_STORES).getDataRange().getValues(); st.shift();
  let tL = 0; let tS = 0;
  let date = new Date();
  // KHÔI PHỤC LOGIC ISDEBUG CỦA V10.4: Nếu debug thì lùi ngày -1
  if (isDebug) date.setDate(date.getDate() - 1);
  const dStr = Utilities.formatDate(date, "GMT+7", 'yyyy-MM-dd');
  st.forEach(r => {
    tL += parseSheetNumber(r[5]); tS += parseSheetNumber(r[6]);
    getSheet(SHEET_STORE_HISTORY).appendRow([dStr, r[0], r[5], r[6]]);
  });
  getSheet(SHEET_DAILY).appendRow([dStr, tL, tS]);
}

function addPrintwayBatch(year, list) {
    const fid = getFinanceFileId(year) || createFinanceFile(year).fileId;
    const ss = SpreadsheetApp.openById(fid);
    let sPW = ss.getSheetByName("Printway");
    const lastRow = sPW.getLastRow();
    let existingIds = new Set();
    if (lastRow > 1) {
        const idsData = sPW.getRange(2, 1, lastRow - 1, 1).getValues();
        idsData.forEach(r => existingIds.add(String(r[0]).trim()));
    }
    const filteredList = list.filter(item => {
        const id = String(item.invoiceId || '').trim();
        return id !== '' && !existingIds.has(id);
    });
    if (filteredList.length === 0) return { success: true, message: "Không có dữ liệu mới" };
    const rows = filteredList.map(item => [item.invoiceId, item.type, item.status, item.date, item.method, item.amountUsd, item.fee, item.totalAmount, item.note, item.loai]);
    sPW.getRange(sPW.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
    return { success: true, count: rows.length };
}
