
/**
 * ==========================================
 * MAIN.GS: ĐIỀU HƯỚNG CHÍNH V27.0
 * ==========================================
 */

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

    // --- 2. FINANCE ACTIONS ---
    else if (action === 'getFinance') result = getFinance(String(postData.year || "").trim()); 
    else if (action === 'addFinance') result = addFinance(String(postData.year || "").trim(), postData.transaction);
    else if (action === 'addPayment') result = addPayment(String(postData.year || "").trim(), postData.payment);
    else if (action === 'createFinanceFile') result = createFinanceFile(String(postData.year || "").trim());
    else if (action === 'getStaffSalarySummary') result = getStaffSalarySummary(postData.year);
    else if (action === 'addPrintwayBatch') result = addPrintwayBatch(String(postData.year || "").trim(), postData.list);
    else if (action === 'addEbayBatch') result = addEbayBatch(String(postData.year || "").trim(), postData.list);
    else if (action === 'addGKEBatch') result = addGKEBatch(String(postData.year || "").trim(), postData.list);

    // ... Các routing cũ giữ nguyên ...
    else if (action === 'getOrders') result = getOrdersFromMonthFile(postData.month);
    else if (action === 'login') result = handleLogin(postData.username, postData.password, postData.ip);

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
