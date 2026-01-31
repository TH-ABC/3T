
/**
 * ==========================================
 * MAIN.GS: ĐIỀU HƯỚNG CHÍNH V34.2
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
const SHEET_ATTENDANCE = 'Attendance';
const SHEET_OT_ATTENDANCE = 'OTAttendance';
const SHEET_SCHEDULE_STAFF = 'ScheduleStaff';
const SHEET_HANDOVER = 'Handover';
const SHEET_USER_NOTES = 'UserNotes';
const SHEET_HOLIDAYS = 'Holidays';
const SHEET_USER_READ_STATUS = 'UserReadStatus';
const SHEET_AI_INSIGHTS = 'AiInsights';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000); 
  try {
    const contents = e.postData.contents;
    if (!contents) return createJsonResponse({ success: false, error: "Empty request body" });
    
    const postData = JSON.parse(contents);
    const action = postData.action;
    let result = {};

    // --- 1. NEWS ACTIONS ---
    if (action === 'getNews') result = handleGetNews(postData.username);
    else if (action === 'addNews') result = handleAddNews(postData);
    else if (action === 'updateNews') result = handleUpdateNews(postData);
    else if (action === 'deleteNews') result = handleDeleteNews(postData.newsId);
    else if (action === 'toggleLockNews') result = handleToggleLockNews(postData.newsId);
    else if (action === 'addComment') result = handleAddComment(postData);
    else if (action === 'toggleLike') result = handleToggleLike(postData.newsId, postData.username);
    else if (action === 'updateLastReadTime') result = handleUpdateLastRead(postData.username);

    // --- 2. FINANCE & AI ACTIONS ---
    else if (action === 'getFinance') result = getFinance(String(postData.year || "").trim()); 
    else if (action === 'addFinance') result = addFinance(String(postData.year || "").trim(), postData.transaction);
    else if (action === 'addPayment') result = addPayment(String(postData.year || "").trim(), postData.payment);
    else if (action === 'addHold') result = addHold(String(postData.year || "").trim(), postData.hold);
    else if (action === 'updateFinanceField') result = updateFinanceField(postData.year, postData.id, postData.field, postData.value);
    else if (action === 'createFinanceFile') result = createFinanceFile(String(postData.year || "").trim());
    else if (action === 'getStaffSalarySummary') result = getStaffSalarySummary(postData.year);
    else if (action === 'addPrintwayBatch') result = addPrintwayBatch(String(postData.year || "").trim(), postData.list);
    else if (action === 'addEbayBatch') result = addEbayBatch(String(postData.year || "").trim(), postData.list);
    else if (action === 'addGKEBatch') result = addGKEBatch(String(postData.year || "").trim(), postData.list);
    else if (action === 'getFinanceMeta') result = getFinanceMeta();
    else if (action === 'addFinanceMeta') result = addFinanceMeta(postData.type, postData.value);
    else if (action === 'getAiInsight') result = handleGetAiInsight(postData.monthKey, postData.year);
    else if (action === 'saveAiInsight') result = handleSaveAiInsight(postData.monthKey, postData.year, postData.content);

    // --- 3. ORDER & STORE ACTIONS ---
    else if (action === 'getOrders') result = getOrdersFromMonthFile(postData.month);
    else if (action === 'login') result = handleLogin(postData.username, postData.password, postData.ip);
    else if (action === 'getUsers') result = getUsers();
    else if (action === 'getStores') result = getData(SHEET_STORES);
    else if (action === 'addStore') result = addStore(postData);
    else if (action === 'getSkuMappings') result = getSkuMappings();
    else if (action === 'updateSkuCategory') result = handleUpdateSkuCategory(postData.sku, postData.category);
    else if (action === 'getPriceMappings') result = getPriceMappings();
    else if (action === 'updateCategoryPrice') result = handleUpdateCategoryPrice(postData.category, postData.price);
    
    // --- 4. HANDOVER & ATTENDANCE ---
    else if (action === 'getHandover') result = handleGetHandover(postData.date, postData.viewerName, postData.viewerRole);
    else if (action === 'addHandover') result = handleAddHandover(postData);
    else if (action === 'updateHandover') result = handleUpdateHandover(postData.id, postData.updates);
    else if (action === 'deleteHandover') result = handleDeleteHandover(postData.id);
    else if (action === 'markHandoverAsSeen') result = handleMarkHandoverAsSeen(postData.id);
    else if (action === 'getUserNote') result = handleGetUserNote(postData.username, postData.date);
    else if (action === 'saveUserNote') result = handleSaveUserNote(postData);

    // --- 5. HR & SCHEDULE ---
    else if (action === 'getScheduleStaff') result = getScheduleStaff();
    else if (action === 'saveScheduleStaff') result = saveScheduleStaff(postData);
    else if (action === 'deleteScheduleStaffMember') result = deleteScheduleStaffMember(postData.username, postData.name);
    else if (action === 'getAttendance') result = getAttendance(postData.month);
    else if (action === 'checkIn') result = checkIn(postData.username, postData.name);
    else if (action === 'checkOut') result = checkOut(postData.username, postData.name);
    else if (action === 'getHolidays') result = getHolidays(postData.month);
    else if (action === 'toggleHoliday') result = toggleHoliday(postData.date);

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ success: false, error: "Server Error: " + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
