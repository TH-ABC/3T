
/**
 * ==========================================
 * MAIN.GS: ĐIỀU HƯỚNG CHÍNH V17.0
 * ==========================================
 */

const SHEET_STORES = 'Stores';
const SHEET_USERS = 'Users';
const SHEET_UNITS = 'Units';
const SHEET_ROLES = 'Roles';
const SHEET_LOGS = 'AccessLogs';
const SHEET_DAILY = 'DailyStats';
const SHEET_STORE_HISTORY = 'StoreHistory';
const SHEET_FILE_INDEX = 'FileIndex';
const SHEET_PL_SKU = 'PL SKU';
const SHEET_PRICES = 'PriceMap';
const SHEET_FINANCE_META = 'FinanceMeta';
const SHEET_NEWS = 'News';
const SHEET_NEWS_COMMENTS = 'NewsComments';
const SHEET_NEWS_LIKES = 'NewsLikes';
const SHEET_USER_READ_STATUS = 'UserReadStatus';
const SHEET_SCHEDULE_STAFF = 'ScheduleStaff';
const SHEET_ATTENDANCE = 'Attendance';
const SHEET_OT_ATTENDANCE = 'OTAttendance';
const SHEET_HOLIDAYS = 'Holidays';
const SHEET_HANDOVER = 'DailyHandover';
const SHEET_USER_NOTES = 'UserNotes';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000); 
  try {
    const contents = e.postData.contents;
    if (!contents) return createJsonResponse({ success: false, error: "Empty request body" });
    
    const postData = JSON.parse(contents);
    const action = postData.action;
    let result = {};

    // --- FINANCE ACTIONS ---
    if (action === 'getFinance') result = getFinance(String(postData.year || "").trim()); 
    else if (action === 'addFinance') result = addFinance(String(postData.year || "").trim(), postData.transaction);
    else if (action === 'addPayment') result = addPayment(String(postData.year || "").trim(), postData.payment);
    else if (action === 'addPrintwayBatch') result = addPrintwayBatch(String(postData.year || "").trim(), postData.list);
    else if (action === 'syncPrintwayData') result = handleSyncPrintwayData(postData.month, postData.list);
    else if (action === 'addEbayBatch') result = addEbayBatch(String(postData.year || "").trim(), postData.list);
    else if (action === 'updateFinanceField') result = updateFinanceField(String(postData.year || "").trim(), postData.id, postData.field, postData.value);
    else if (action === 'updatePaymentField') result = updatePaymentField(String(postData.year || "").trim(), postData.id, postData.field, postData.value);
    else if (action === 'createFinanceFile') result = createFinanceFile(String(postData.year || "").trim());
    else if (action === 'getFinanceMeta') result = getFinanceMeta();
    else if (action === 'addFinanceMeta') result = addFinanceMeta(postData.type, postData.value);
    else if (action === 'getStaffSalarySummary') result = getStaffSalarySummary(postData.year);

    // --- NEWS ACTIONS ---
    else if (action === 'getNews') result = handleGetNews(postData.username);
    else if (action === 'addNews') result = handleAddNews(postData);
    else if (action === 'updateNews') result = handleUpdateNews(postData);
    else if (action === 'deleteNews') result = handleDeleteNews(postData.newsId);
    else if (action === 'toggleLockNews') result = handleToggleLockNews(postData.newsId);
    else if (action === 'addComment') result = handleAddComment(postData);
    else if (action === 'toggleLike') result = handleToggleLike(postData.newsId, postData.username);
    else if (action === 'updateLastReadTime') result = handleUpdateLastRead(postData.username);
    
    // --- ATTENDANCE & SCHEDULE ---
    else if (action === 'getScheduleStaff') result = getScheduleStaff();
    else if (action === 'saveScheduleStaff') result = saveScheduleStaff(postData);
    else if (action === 'getAttendance') result = getAttendance(postData.month);
    else if (action === 'checkIn') result = checkIn(postData.username, postData.name);
    else if (action === 'checkOut') result = checkOut(postData.username, postData.name);
    else if (action === 'getOTAttendance') result = getOTAttendance(postData.month);
    else if (action === 'checkInOT') result = checkInOT(postData.username, postData.name);
    else if (action === 'checkOutOT') result = checkOutOT(postData.username, postData.name);
    else if (action === 'getManualTimekeeping') result = getManualTimekeeping(postData.month);
    else if (action === 'saveManualTimekeeping') result = saveManualTimekeeping(postData.month, postData.username, postData.day, postData.value);
    else if (action === 'saveFullMonthlyTable') result = saveFullMonthlyTable(postData.month, postData.matrix);

    // --- HANDOVER ACTIONS ---
    else if (action === 'getHandover') result = handleGetHandover(postData.date, postData.viewerName, postData.viewerRole);
    else if (action === 'addHandover') result = handleAddHandover(postData);
    else if (action === 'updateHandover') result = handleUpdateHandover(postData.id, postData.updates);
    else if (action === 'deleteHandover') result = handleDeleteHandover(postData.id);
    else if (action === 'markHandoverAsSeen') result = handleMarkHandoverAsSeen(postData.id); 
    else if (action === 'getUserNote') result = handleGetUserNote(postData.username, postData.date);
    else if (action === 'saveUserNote') result = handleSaveUserNote(postData);

    // --- ORDERS & SYSTEM ---
    else if (action === 'getOrders') result = getOrdersFromMonthFile(postData.month);
    else if (action === 'addOrder') result = handleAddOrder(postData);
    else if (action === 'updateOrder') result = updateOrderSingle(postData.fileId, postData.orderId, postData.field, postData.value);
    else if (action === 'getStores') result = getData(SHEET_STORES);
    else if (action === 'addStore') result = addStore(postData);
    else if (action === 'deleteStore') result = deleteRow(SHEET_STORES, postData.id);
    else if (action === 'getStoreHistory') result = getStoreHistory(postData.storeId);
    else if (action === 'getDailyStats') result = getData(SHEET_DAILY);
    else if (action === 'getSkuMappings') result = getSkuMappings();
    else if (action === 'getPriceMappings') result = getPriceMappings();
    else if (action === 'updateSkuCategory') result = handleUpdateSkuCategory(postData.sku, postData.category);
    else if (action === 'updateCategoryPrice') result = handleUpdateCategoryPrice(postData.category, postData.price);
    else if (action === 'login') result = handleLogin(postData.username, postData.password, postData.ip);
    else if (action === 'getUsers') result = getUsers();
    else if (action === 'debugSnapshot') { autoRecordDailyStats(true); result = {success: true}; }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ success: false, error: "Server Internal Error: " + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return createJsonResponse({ status: "running", version: "17.0", timestamp: new Date() });
}

function addStore(postData) {
    const id = Utilities.getUuid().substring(0,8);
    return addRow(SHEET_STORES, [id, postData.name, postData.url, postData.region||"", postData.status||"LIVE", 0, 0]);
}
