/**
 * ==========================================
 * LOGIC_1.GS: NGHIỆP VỤ CHÍNH V8.2 (STABLE)
 * ==========================================
 */

function handleGetNews(username) {
  const newsSheet = getSheet(SHEET_NEWS);
  const commentSheet = getSheet(SHEET_NEWS_COMMENTS);
  const likeSheet = getSheet(SHEET_NEWS_LIKES);
  const readStatusSheet = getSheet(SHEET_USER_READ_STATUS);
  
  const newsData = newsSheet.getDataRange().getValues();
  const commentData = commentSheet.getDataRange().getValues();
  const likeData = likeSheet.getDataRange().getValues();
  const readData = readStatusSheet.getDataRange().getValues();
  
  let lastReadTime = 0;
  for(let i=1; i<readData.length; i++) {
    if(String(readData[i][0]) === String(username)) {
      lastReadTime = new Date(readData[i][1]).getTime();
      break;
    }
  }

  if (newsData.length <= 1) return { news: [], lastReadTime: lastReadTime };
  
  const commentMap = {};
  for(let i = 1; i < commentData.length; i++) {
    const nid = String(commentData[i][1]);
    if(!commentMap[nid]) commentMap[nid] = [];
    commentMap[nid].push({ id: String(commentData[i][0]), newsId: nid, username: commentData[i][2], text: commentData[i][3], timestamp: formatDate(commentData[i][4]) });
  }
  
  const userLikes = new Set();
  const newsLikesCount = {};
  for(let i = 1; i < likeData.length; i++) {
    const nid = String(likeData[i][0]);
    if(String(likeData[i][1]) === String(username)) userLikes.add(nid);
    newsLikesCount[nid] = (newsLikesCount[nid] || 0) + 1;
  }
  
  newsData.shift(); 
  const newsItems = newsData.map(r => {
    const id = String(r[0]);
    return { 
      id: id, 
      title: r[1], 
      content: r[2], 
      imageUrl: r[3], 
      author: r[4], 
      timestamp: formatDate(r[5]), 
      likesCount: newsLikesCount[id] || 0, 
      isLiked: userLikes.has(id), 
      isLocked: r[6] === true || r[6] === "TRUE", 
      comments: commentMap[id] || [] 
    };
  }).reverse();

  return { news: newsItems, lastReadTime: lastReadTime };
}

function handleUpdateNews(news) {
  try {
    if (!news || !news.id) return { success: false, error: "Thiếu ID bản tin để cập nhật" };
    const sheet = getSheet(SHEET_NEWS);
    const data = sheet.getDataRange().getValues();
    const targetId = String(news.id).trim();
    
    for(let i = 1; i < data.length; i++) {
      if(String(data[i][0]).trim() === targetId) {
        sheet.getRange(i + 1, 2).setValue(news.title || "");
        sheet.getRange(i + 1, 3).setValue(news.content || "");
        if(news.imageUrl !== undefined) {
          const imgStr = String(news.imageUrl);
          sheet.getRange(i + 1, 4).setValue(imgStr);
        }
        return { success: true }; 
      }
    }
    return { success: false, error: "Không tìm thấy bản tin ID: " + targetId };
  } catch (err) {
    return { success: false, error: "Lỗi Server xử lý cập nhật: " + err.toString() };
  }
}

function handleDeleteNews(newsId) {
  if (!newsId) return { success: false, error: "Thiếu ID bản tin" };
  const sheet = getSheet(SHEET_NEWS);
  const data = sheet.getDataRange().getValues();
  const targetId = String(newsId).trim();
  let found = false;
  for(let i = 1; i < data.length; i++) {
    if(String(data[i][0]).trim() === targetId) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }
  if (found) {
    const cSheet = getSheet(SHEET_NEWS_COMMENTS);
    const cData = cSheet.getDataRange().getValues();
    for(let j = cData.length - 1; j >= 1; j--) if(String(cData[j][1]).trim() === targetId) cSheet.deleteRow(j + 1);
    const lSheet = getSheet(SHEET_NEWS_LIKES);
    const lData = lSheet.getDataRange().getValues();
    for(let k = lData.length - 1; k >= 1; k--) if(String(lData[k][0]).trim() === targetId) lSheet.deleteRow(k + 1);
    return { success: true };
  }
  return { success: false, error: "Không tìm thấy ID bài viết: " + newsId };
}

function handleToggleLockNews(newsId) {
  if (!newsId) return { success: false, error: "Thiếu ID bản tin" };
  const sheet = getSheet(SHEET_NEWS);
  const data = sheet.getDataRange().getValues();
  const targetId = String(newsId).trim();
  for(let i = 1; i < data.length; i++) {
    if(String(data[i][0]).trim() === targetId) {
      const currentStatus = data[i][6] === true || data[i][6] === "TRUE";
      sheet.getRange(i + 1, 7).setValue(!currentStatus);
      return { success: true };
    }
  }
  return { success: false, error: "Không tìm thấy bài viết" };
}

function handleUpdateLastRead(username) {
  const sheet = getSheet(SHEET_USER_READ_STATUS);
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  let foundRow = -1;
  for(let i=1; i < data.length; i++) {
    if(String(data[i][0]) === String(username)) {
      foundRow = i + 1;
      break;
    }
  }
  if(foundRow > 0) sheet.getRange(foundRow, 2).setValue(now);
  else sheet.appendRow([username, now]);
  return { success: true };
}

function handleAddNews(news) {
  const sheet = getSheet(SHEET_NEWS);
  const id = "N-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss");
  const imgStr = String(news.imageUrl || "");
  sheet.appendRow([id, news.title, news.content, imgStr, news.author, new Date(), "FALSE"]);
  return { success: true };
}

function handleAddComment(cmt) {
  const sheet = getSheet(SHEET_NEWS_COMMENTS);
  const id = "C-" + Utilities.getUuid();
  sheet.appendRow([id, cmt.newsId, cmt.username, cmt.text, new Date()]);
  return { success: true };
}

function handleToggleLike(newsId, username) {
  const sheet = getSheet(SHEET_NEWS_LIKES);
  const data = sheet.getDataRange().getValues();
  const targetId = String(newsId).trim();
  const targetUser = String(username).trim();
  let foundRow = -1;
  for(let i = 1; i < data.length; i++) if(String(data[i][0]).trim() === targetId && String(data[i][1]).trim() === targetUser) { foundRow = i + 1; break; }
  if(foundRow > 0) { sheet.deleteRow(foundRow); return { success: true, liked: false }; }
  sheet.appendRow([newsId, username]);
  return { success: true, liked: true };
}

function getOrdersFromMonthFile(month) {
  let fileId = getFileIdForMonth(month);
  if (!fileId) return { orders: [], fileId: null };
  try {
    const ss = SpreadsheetApp.openById(fileId);
    const data = ss.getSheets()[0].getDataRange().getValues();
    if (data.length <= 1) return { orders: [], fileId: fileId };
    data.shift(); 
    return {
      fileId: fileId,
      orders: data.map(row => ({
        date: formatDate(row[0]), id: row[1], storeId: row[2], type: row[3], sku: row[4], quantity: row[5], tracking: row[6], link: row[7], status: row[8], note: row[9],
        handler: row[10] || "", actionRole: row[11] || "", isChecked: row[12] === "TRUE" || row[12] === true, isDesignDone: row[13] === "TRUE" || row[13] === true,
        shippingFirstName: row[14], shippingLastName: row[15], shippingAddress1: row[16], shippingAddress2: row[17], shippingCity: row[18], shippingProvince: row[19], shippingZip: row[20], shippingCountry: row[21], shippingPhone: row[22],
        productName: row[23], itemSku: row[24], urlMockup: row[25], mockupType: row[26], isFulfilled: row[27] === "TRUE" || row[27] === true, urlArtworkFront: row[28], urlArtworkBack: row[29]
      }))
    };
  } catch (e) { return { orders: [], fileId: null, error: "Access Denied" }; }
}

function handleAddOrder(postData) {
    let month = postData.month || (postData.date ? postData.date.substring(0, 7) : Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM"));
    const row = [postData.date, postData.id, postData.storeId, postData.type || "", postData.sku, postData.quantity || 1, postData.tracking || "", postData.link || "", postData.status || "Pending", postData.note || "", postData.user || "", postData.actionRole || "", postData.isChecked ? "TRUE" : "FALSE", postData.isDesignDone ? "TRUE" : "FALSE", postData.shippingFirstName || "", postData.shippingLastName || "", postData.shippingAddress1 || "", postData.shippingAddress2 || "", postData.shippingCity || "", postData.shippingProvince || "", postData.shippingZip || "", postData.shippingCountry || "", postData.shippingPhone || "", postData.productName || "", postData.itemSku || "", postData.urlMockup || "", postData.mockupType || "", "FALSE", postData.urlArtworkFront || "", postData.urlArtworkBack || ""];
    let fileId = getFileIdForMonth(month) || createNewMonthFile(month);
    SpreadsheetApp.openById(fileId).getSheets()[0].appendRow(row);
    return { success: true, fileId: fileId };
}

function handleFulfillOrder(postData) {
    const res = fulfillOrderToSheet(postData.fileId, postData);
    if (res.success && postData.id) updateOrderSingle(postData.fileId, postData.id, 'isFulfilled', "TRUE");
    return res;
}

function fulfillOrderToSheet(fileId, data) {
  try {
    const ss = SpreadsheetApp.openById(fileId);
    let s = ss.getSheetByName("Fulfillment_Export") || ss.insertSheet("Fulfillment_Export");
    if (s.getLastRow() === 0) s.appendRow(["Order_ID", "Product_name", "Item_sku", "Quantity", "First_name", "Last_name", "Shipping_address1", "Shipping_address2", "Shipping_city", "Shipping_zip", "Shipping_province", "Shipping_country", "Shipping_phone", "URL_artwork_front", "URL_artwork_back", "URL_mockup", "Note"]);
    s.appendRow([data.id, data.productName, data.itemSku, data.quantity, data.shippingFirstName, data.shippingLastName, data.shippingAddress1, data.shippingAddress2, data.shippingCity, data.shippingZip, data.shippingProvince, data.shippingCountry, data.shippingPhone, data.urlArtworkFront, data.urlArtworkBack, data.urlMockup, data.mockupType]);
    return { success: true };
  } catch (e) { return { success: false, error: e.toString() }; }
}

function updateOrderRow(fileId, orderId, updates) {
  if (!fileId) return { success: false };
  const s = SpreadsheetApp.openById(fileId).getSheets()[0];
  const d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][1]).trim() === String(orderId).trim()) {
      const map = { 'date':1, 'id':2, 'storeId':3, 'type':4, 'sku':5, 'quantity':6, 'tracking':7, 'link':8, 'status':9, 'note':10, 'handler':11, 'actionRole':12, 'isChecked':13, 'isDesignDone':14, 'isFulfilled':28 };
      for (const [k, v] of Object.entries(updates)) {
        if (map[k]) {
          let val = v;
          if (['isChecked', 'isDesignDone', 'isFulfilled'].includes(k)) val = (v === true || v === "TRUE") ? "TRUE" : "FALSE";
          s.getRange(i+1, map[k]).setValue(val);
        }
      }
      return { success: true };
    }
  }
  return { success: false };
}

function updateOrderSingle(fileId, orderId, field, value) { 
  const up = {}; up[field] = value; return updateOrderRow(fileId, orderId, up); 
}

function updateDesignerStatus(data) {
  const ss = SpreadsheetApp.openById(data.fileId);
  const isDone = data.isDone ? "TRUE" : "FALSE";
  updateOrderSingle(data.fileId, data.order.id, 'isDesignDone', isDone);
  ["Designer", "Designer Online"].forEach(n => {
    const s = ss.getSheetByName(n);
    if (s) {
      const d = s.getDataRange().getValues();
      for (let j = 1; j < d.length; j++) if (String(d[j][1]).trim() == String(data.order.id).trim()) s.getRange(j + 1, 14).setValue(isDone);
    }
  });
  return { success: true };
}