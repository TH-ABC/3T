/**
 * ==========================================
 * MAIN.GS: ĐIỀU HƯỚNG CHÍNH V5.1
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
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    let result = {};

    // --- HANDOVER & NOTES ---
    if (action === 'getHandover') result = handleGetHandover(postData.date, postData.viewerName, postData.viewerRole);
    else if (action === 'addHandover') result = handleAddHandover(postData);
    else if (action === 'updateHandover') result = handleUpdateHandover(postData.id, postData.updates);
    else if (action === 'deleteHandover') result = handleDeleteHandover(postData.id);
    else if (action === 'markHandoverAsSeen') result = handleMarkHandoverAsSeen(postData.id); // Route mới
    else if (action === 'getUserNote') result = handleGetUserNote(postData.username, postData.date);
    else if (action === 'saveUserNote') result = handleSaveUserNote(postData);

    // --- SCHEDULE & ATTENDANCE ---
    else if (action === 'getScheduleStaff') result = getScheduleStaff();
    else if (action === 'saveScheduleStaff') result = saveScheduleStaff(postData);
    else if (action === 'getAttendance') result = getAttendance(postData.month);
    else if (action === 'checkIn') result = checkIn(postData.username, postData.name);
    else if (action === 'checkOut') result = checkOut(postData.username, postData.name);
    
    // --- OT & HOLIDAYS ---
    else if (action === 'getOTAttendance') result = getOTAttendance(postData.month);
    else if (action === 'checkInOT') result = checkInOT(postData.username, postData.name);
    else if (action === 'checkOutOT') result = checkOutOT(postData.username, postData.name);
    else if (action === 'getHolidays') result = getHolidays(postData.month);
    else if (action === 'toggleHoliday') result = toggleHoliday(postData.date);

    // --- NEWS & NOTIFICATIONS ---
    else if (action === 'getNews') result = handleGetNews(postData.username);
    else if (action === 'addNews') result = handleAddNews(postData);
    else if (action === 'updateNews') result = handleUpdateNews(postData);
    else if (action === 'deleteNews') result = handleDeleteNews(postData.newsId);
    else if (action === 'toggleLockNews') result = handleToggleLockNews(postData.newsId);
    else if (action === 'addComment') result = handleAddComment(postData);
    else if (action === 'toggleLike') result = handleToggleLike(postData.newsId, postData.username);
    else if (action === 'updateLastReadTime') result = handleUpdateLastRead(postData.username);

    // --- ORDERS & FULFILLMENT ---
    else if (action === 'getOrders') result = getOrdersFromMonthFile(postData.month);
    else if (action === 'addOrder') result = handleAddOrder(postData);
    else if (action === 'updateOrder') result = updateOrderSingle(postData.fileId, postData.orderId, postData.field, postData.value);
    else if (action === 'fulfillOrder') result = handleFulfillOrder(postData);
    else if (action === 'batchUpdateOrder') result = handleBatchUpdateOrder(postData);
    else if (action === 'batchUpdateDesigner') result = handleBatchUpdateDesigner(postData);
    else if (action === 'updateDesignerStatus') result = updateDesignerStatus(e);
    else if (action === 'createMonthFile') result = { success: true, fileId: createNewMonthFile(postData.month) };

    // --- SYNC ---
    else if (action === 'syncPW') result = handleSyncPW(postData.fileId);
    else if (action === 'syncFF') result = handleSyncFF(postData.fileId);
    else if (action === 'syncFulfillment') result = handleSyncFulfillment(postData.fileId);

    // --- FINANCE ---
    else if (action === 'getFinance') result = getFinance(postData.year);
    else if (action === 'addFinance') result = addFinance(postData.year, postData.transaction);
    else if (action === 'createFinanceFile') result = createFinanceFile(postData.year);
    else if (action === 'getFinanceMeta') result = getFinanceMeta();
    else if (action === 'addFinanceMeta') result = addFinanceMeta(postData.type, postData.value);

    // --- USERS ---
    else if (action === 'login') result = handleLogin(postData.username, postData.password, postData.ip);
    else if (action === 'getUsers') result = getUsers();
    else if (action === 'createUser') result = createUser(postData.username, postData.password, postData.fullName, postData.role, postData.email, postData.phone, postData.permissions);
    else if (action === 'updateUser') result = updateUser(postData.username, postData.role, postData.status, postData.permissions);
    else if (action === 'changePassword') result = handleChangePassword(postData.username, postData.oldPass, postData.newPass);
    else if (action === 'getRoles') result = getRoles();
    else if (action === 'addRole') result = addRole(postData.name, postData.level);

    // --- SYSTEM & MAPPINGS ---
    else if (action === 'getStores') result = getData(SHEET_STORES);
    else if (action === 'addStore') result = addRow(SHEET_STORES, [Utilities.getUuid().substring(0,8), postData.name, postData.url, postData.region||"", postData.status||"LIVE", 0, 0]);
    else if (action === 'deleteStore') result = deleteRow(SHEET_STORES, postData.id);
    else if (action === 'getStoreHistory') result = getStoreHistory(postData.storeId);
    else if (action === 'getDailyStats') result = getData(SHEET_DAILY);
    else if (action === 'getSkuMappings') result = getSkuMappings();
    else if (action === 'updateSkuCategory') result = handleUpdateSkuCategory(postData.sku, postData.category);
    else if (action === 'getPriceMappings') result = getPriceMappings();
    else if (action === 'updateCategoryPrice') result = handleUpdateCategoryPrice(postData.category, postData.price);
    else if (action === 'debugSnapshot') { autoRecordDailyStats(true); result = {success: true}; }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "running", version: "5.1", timestamp: new Date() })).setMimeType(ContentService.MimeType.JSON);
}