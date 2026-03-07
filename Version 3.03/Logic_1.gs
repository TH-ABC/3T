/**
 * ==========================================
 * LOGIC_1.GS: NGHIỆP VỤ CHÍNH V9.0 (FULL HANDLERS)
 * + PATCH DESIGNER ONLINE: Link DS / Check / Note / product_url / options_text (SAVE BE)
 * (KHÔNG XÓA / KHÔNG RÚT GỌN HÀM NÀO)
 * ==========================================
 */

/* =========================
   NEWS HANDLERS
   ========================= */

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
  for (let i = 1; i < readData.length; i++) {
    if (String(readData[i][0]) === String(username)) {
      lastReadTime = new Date(readData[i][1]).getTime();
      break;
    }
  }

  if (newsData.length <= 1) return { news: [], lastReadTime: lastReadTime };

  const commentMap = {};
  for (let i = 1; i < commentData.length; i++) {
    const nid = String(commentData[i][1]);
    if (!commentMap[nid]) commentMap[nid] = [];
    commentMap[nid].push({
      id: String(commentData[i][0]),
      newsId: nid,
      username: commentData[i][2],
      text: commentData[i][3],
      timestamp: formatDate(commentData[i][4])
    });
  }

  const userLikes = new Set();
  const newsLikesCount = {};
  for (let i = 1; i < likeData.length; i++) {
    const nid = String(likeData[i][0]);
    if (String(likeData[i][1]) === String(username)) userLikes.add(nid);
    newsLikesCount[nid] = (newsLikesCount[nid] || 0) + 1;
  }

  newsData.shift();
  const newsItems = newsData
    .map(r => {
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
    })
    .reverse();

  return { news: newsItems, lastReadTime: lastReadTime };
}

function handleUpdateNews(news) {
  try {
    if (!news || !news.id) return { success: false, error: "Thiếu ID bản tin để cập nhật" };
    const sheet = getSheet(SHEET_NEWS);
    const data = sheet.getDataRange().getValues();
    const targetId = String(news.id).trim();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === targetId) {
        sheet.getRange(i + 1, 2).setValue(news.title || "");
        sheet.getRange(i + 1, 3).setValue(news.content || "");
        if (news.imageUrl !== undefined) {
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

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }

  if (found) {
    const cSheet = getSheet(SHEET_NEWS_COMMENTS);
    const cData = cSheet.getDataRange().getValues();
    for (let j = cData.length - 1; j >= 1; j--) {
      if (String(cData[j][1]).trim() === targetId) cSheet.deleteRow(j + 1);
    }

    const lSheet = getSheet(SHEET_NEWS_LIKES);
    const lData = lSheet.getDataRange().getValues();
    for (let k = lData.length - 1; k >= 1; k--) {
      if (String(lData[k][0]).trim() === targetId) lSheet.deleteRow(k + 1);
    }
    return { success: true };
  }
  return { success: false, error: "Không tìm thấy ID bài viết: " + newsId };
}

function handleToggleLockNews(newsId) {
  if (!newsId) return { success: false, error: "Thiếu ID bản tin" };
  const sheet = getSheet(SHEET_NEWS);
  const data = sheet.getDataRange().getValues();
  const targetId = String(newsId).trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
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

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(username)) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) sheet.getRange(foundRow, 2).setValue(now);
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

  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][0]).trim() === targetId &&
      String(data[i][1]).trim() === targetUser
    ) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    sheet.deleteRow(foundRow);
    return { success: true, liked: false };
  }
  sheet.appendRow([newsId, username]);
  return { success: true, liked: true };
}

/* =========================
   AUTH & USER HANDLERS
   ========================= */

function handleLogin(u, p, ip) {
  const s = getSheet(SHEET_USERS);
  const d = s.getDataRange().getValues();

  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]) === String(u) && String(d[i][1]) === String(p)) {
      if (d[i][6] === "Inactive") return { success: false, error: "Tài khoản đã bị khóa." };
      let perms = {};
      try {
        perms = d[i][7] ? JSON.parse(d[i][7]) : {};
      } catch (e) {}
      const user = {
        username: d[i][0],
        fullName: d[i][2],
        role: d[i][3],
        email: d[i][4],
        phone: d[i][5],
        status: d[i][6],
        permissions: perms
      };
      getSheet(SHEET_LOGS).appendRow([new Date(), u, "LOGIN", ip || ""]);
      return { success: true, user: user };
    }
  }
  return { success: false, error: "Sai tài khoản hoặc mật khẩu." };
}

function handleLogout(username, type) {
  const s = getSheet(SHEET_LOGS);
  s.appendRow([new Date(), username, type || "LOGOUT", ""]);
  return { success: true };
}

function handleChangePassword(username, oldPass, newPass) {
  const s = getSheet(SHEET_USERS);
  const d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]) === String(username) && String(d[i][1]) === String(oldPass)) {
      s.getRange(i + 1, 2).setValue(newPass);
      return { success: true };
    }
  }
  return { success: false, error: "Mật khẩu cũ không chính xác" };
}

function getUsers() {
  const s = getSheet(SHEET_USERS);
  const d = s.getDataRange().getValues();
  d.shift();
  return d.map(r => {
    let perms = {};
    try {
      perms = r[7] ? JSON.parse(r[7]) : {};
    } catch (e) {}
    return {
      username: r[0],
      password: r[1],
      fullName: r[2],
      role: r[3],
      email: r[4],
      phone: r[5],
      status: r[6],
      permissions: perms
    };
  });
}

function createUser(u, p, f, r, e, ph, perms) {
  const s = getSheet(SHEET_USERS);
  const d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) if (d[i][0] == u) return { success: false, error: "Username đã tồn tại" };
  s.appendRow([u, p, f, r, e, ph, "Active", JSON.stringify(perms || {})]);
  return { success: true };
}

function updateUser(u, r, s_stat, perms) {
  const s = getSheet(SHEET_USERS);
  const d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (d[i][0] == u) {
      if (r) s.getRange(i + 1, 4).setValue(r);
      if (s_stat) s.getRange(i + 1, 7).setValue(s_stat);
      if (perms) s.getRange(i + 1, 8).setValue(JSON.stringify(perms));
      return { success: true };
    }
  }
  return { success: false };
}

function addRole(name, level) {
  const s = getSheet(SHEET_ROLES);
  s.appendRow([name, level]);
  return { success: true };
}

/* =========================
   ORDER HANDLERS
   ========================= */

/**
 * PATCH DESIGNER ONLINE:
 * - Khi load orders, BE sẽ lookup thêm sheet "Designer Online" (nếu có) để lấy:
 *   Link DS (cột P), Check (cột Q), Note (cột R), product_url (cột S), options_text (cột T)
 * - Trả về các field: linkDs, check, designerNote, productUrl, optionsText
 */
function getOrdersFromMonthFile(month) {
  let fileId = getFileIdForMonth(month, "Orders");
  if (!fileId) return { orders: [], fileId: null };
  try {
    const ss = SpreadsheetApp.openById(fileId);
    const pick = getOrdersSheetStrict(ss, month);
    if (!pick.sheet) return { orders: [], fileId: fileId, error: pick.error };
    
    const data = pick.sheet.getDataRange().getValues();
    if (data.length <= 1) return { orders: [], fileId: fileId };
    data.shift();

    // Fallback map từ sheet "Designer Online" (nếu có)
    const designerOnlineMap = (typeof buildDesignerOnlineMap_ === "function") ? buildDesignerOnlineMap_(ss) : {};

    return {
      fileId: fileId,
      orders: data.map((row, index) => {
        const orderId = String(row[1] || "").trim();
        const rowNum = index + 2; // +1 for 0-index, +1 for header

        // ✅ Ưu tiên lấy trực tiếp từ sheet theo đúng cột P-Q-R-S-T
        // P=15, Q=16, R=17, S=18, T=19 (0-based index)
        // URL_artwork_front = AJ (col 36, index 35)
        // URL_mockup = AL (col 38, index 37)
        const fromMain = {
          linkDs: row[15] || "",
          check: row[16] || "",
          designerNote: row[17] || "",
          productUrl: row[18] || "",
          optionsText: row[19] || "",
          urlArtworkFront: row[35] || "",
          urlMockup: row[37] || ""
        };

        // Fallback nếu sheet trống
        const fromDO = designerOnlineMap[orderId] || {
          linkDs: "",
          check: "",
          designerNote: "",
          productUrl: "",
          optionsText: "",
          urlArtworkFront: "",
          urlMockup: ""
        };

        // Nếu main có giá trị thì dùng main, không thì dùng DO
        const extra = {
          linkDs: fromMain.linkDs !== "" ? fromMain.linkDs : fromDO.linkDs,
          check: fromMain.check !== "" ? fromMain.check : fromDO.check,
          designerNote: fromMain.designerNote !== "" ? fromMain.designerNote : fromDO.designerNote,
          productUrl: fromMain.productUrl !== "" ? fromMain.productUrl : fromDO.productUrl,
          optionsText: fromMain.optionsText !== "" ? fromMain.optionsText : fromDO.optionsText,
          urlArtworkFront: fromMain.urlArtworkFront !== "" ? fromMain.urlArtworkFront : fromDO.urlArtworkFront,
          urlMockup: fromMain.urlMockup !== "" ? fromMain.urlMockup : fromDO.urlMockup
        };

        return {
          date: formatDate(row[0]),
          id: row[1],
          storeId: row[2],
          type: row[3],
          sku: row[4],
          quantity: row[5],
          tracking: row[6],
          link: row[7],
          status: row[8],
          note: row[9],
          handler: row[10] || "",
          actionRole: row[11] || "",
          isChecked: row[12] === "TRUE" || row[12] === true,
          isDesignDone: row[13] === "TRUE" || row[13] === true,
          shippingFirstName: row[14],
          shippingLastName: row[15],
          shippingAddress1: row[16],
          shippingAddress2: row[17],
          shippingCity: row[18],
          shippingProvince: row[19],
          shippingZip: row[20],
          shippingCountry: row[21],
          shippingPhone: row[22],
          productName: row[23],
          itemSku: row[24],
          urlMockup: row[25],
          mockupType: row[26],
          isFulfilled: row[27] === "TRUE" || row[27] === true,
          urlArtworkFront: row[28],
          urlArtworkBack: row[29],

          // ✅ Trả đúng các field UI đang dùng
          linkDs: extra.linkDs,
          check: extra.check,
          designerNote: extra.designerNote,
          productUrl: extra.productUrl,
          optionsText: extra.optionsText,
          urlArtworkFront: extra.urlArtworkFront,
          urlMockup: extra.urlMockup,
          rowNumber: rowNum
        };
      })
    };
  } catch (e) {
    return { orders: [], fileId: null, error: "Access Denied: " + e.toString() };
  }
}

function handleAddOrder(postData) {
  let month =
    postData.month ||
    (postData.date
      ? postData.date.substring(0, 7)
      : Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM"));

  // GIỮ NGUYÊN cấu trúc row V9.0 (KHÔNG SHIFT CỘT)
  // Các cột Link DS / Check / Note / product_url / options_text được lưu trên sheet "Designer Online"
  // (BE cập nhật bằng handleUpdateDesignerOnlineFields / updateOrderRow patch bên dưới)
  const row = [
    postData.date,
    postData.id,
    postData.storeId,
    postData.type || "",
    postData.sku,
    postData.quantity || 1,
    postData.tracking || "",
    postData.link || "",
    postData.status || "Pending",
    postData.note || "",
    postData.user || "",
    postData.actionRole || "",
    postData.isChecked ? "TRUE" : "FALSE",
    postData.isDesignDone ? "TRUE" : "FALSE",
    postData.shippingFirstName || "",
    postData.shippingLastName || "",
    postData.shippingAddress1 || "",
    postData.shippingAddress2 || "",
    postData.shippingCity || "",
    postData.shippingProvince || "",
    postData.shippingZip || "",
    postData.shippingCountry || "",
    postData.shippingPhone || "",
    postData.productName || "",
    postData.itemSku || "",
    postData.urlMockup || "",
    postData.mockupType || "",
    "FALSE",
    postData.urlArtworkFront || "",
    postData.urlArtworkBack || ""
  ];

  let fileId = getFileIdForMonth(month) || createNewMonthFile(month);
  SpreadsheetApp.openById(fileId).getSheets()[0].appendRow(row);
  return { success: true, fileId: fileId };
}

function handleFulfillOrder(postData) {
  const res = fulfillOrderToSheet(postData.fileId, postData);
  if (res.success && postData.id) updateOrderSingle(postData.fileId, postData.id, "isFulfilled", "TRUE");
  return res;
}

function fulfillOrderToSheet(fileId, data) {
  try {
    const ss = SpreadsheetApp.openById(fileId);
    let s = ss.getSheetByName("Fulfillment_Export") || ss.insertSheet("Fulfillment_Export");
    if (s.getLastRow() === 0)
      s.appendRow([
        "Order_ID",
        "Product_name",
        "Item_sku",
        "Quantity",
        "First_name",
        "Last_name",
        "Shipping_address1",
        "Shipping_address2",
        "Shipping_city",
        "Shipping_zip",
        "Shipping_province",
        "Shipping_country",
        "Shipping_phone",
        "URL_artwork_front",
        "URL_artwork_back",
        "URL_mockup",
        "Note"
      ]);
    s.appendRow([
      data.id,
      data.productName,
      data.itemSku,
      data.quantity,
      data.shippingFirstName,
      data.shippingLastName,
      data.shippingAddress1,
      data.shippingAddress2,
      data.shippingCity,
      data.shippingZip,
      data.shippingProvince,
      data.shippingCountry,
      data.shippingPhone,
      data.urlArtworkFront,
      data.urlArtworkBack,
      data.urlMockup,
      data.mockupType
    ]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * PATCH:
 * - MỞ RỘNG updateOrderRow để hỗ trợ update các field Designer Online
 *   linkDs/check/designerNote/productUrl/optionsText
 * - Khi update các field này:
 *   + vẫn update ở sheet chính nếu bạn có cột map (nếu có)
 *   + đồng thời update ở sheet "Designer Online" cột P-Q-R-S-T (bắt buộc để "luôn luôn lưu")
 */
function updateOrderRow(fileId, orderId, updates, rowNumber) {
  if (!fileId) return { success: false };
  const ss = SpreadsheetApp.openById(fileId);
  const s = ss.getSheets()[0];
  let found = false;

  // Map cột của sheet chính (GIỮ NGUYÊN V9.0) + PATCH thêm field (nếu sheet chính có)
  // Lưu ý: map dùng 1-based column index
  const map = {
    date: 1, id: 2, storeId: 3, type: 4, sku: 5, quantity: 6, tracking: 7, link: 8, status: 9, note: 10, handler: 11, actionRole: 12, isChecked: 13, isDesignDone: 14, isFulfilled: 28,
    linkDs: 16, check: 17, designerNote: 18, productUrl: 19, optionsText: 20,
    urlArtworkFront: 36, urlMockup: 38
  };

  const updateRow = (rowIndex) => {
    for (const [k, v] of Object.entries(updates)) {
      if (map[k]) {
        let val = v;
        if (["isChecked", "isDesignDone", "isFulfilled"].includes(k)) {
          val = v === true || v === "TRUE" ? "TRUE" : "FALSE";
        }
        try { s.getRange(rowIndex, map[k]).setValue(val); } catch (err) {}
      }
      if (["linkDs", "check", "designerNote", "productUrl", "optionsText", "urlArtworkFront", "urlMockup"].includes(k)) {
        updateDesignerOnlineCellByOrderId_(ss, orderId, k, v, rowIndex);
      }
    }
    found = true;
  };

  if (rowNumber) {
    updateRow(rowNumber);
  } else {
    const d = s.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][1]).trim() === String(orderId).trim()) {
        updateRow(i + 1);
      }
    }
  }
  return { success: found };
}

function updateOrderSingle(fileId, orderId, field, value, rowNumber) {
  const up = {};
  up[field] = value;
  return updateOrderRow(fileId, orderId, up, rowNumber);
}

/**
 * GIỮ NGUYÊN hàm updateDesignerStatus V9.0
 * (đang update sheet "Designer" + "Designer Online" cột 14 cho isDesignDone)
 */
function updateDesignerStatus(data) {
  const ss = SpreadsheetApp.openById(data.fileId);
  const isDone = data.isDone ? "TRUE" : "FALSE";
  const rowNumber = data.order ? data.order.rowNumber : null;
  
  updateOrderSingle(data.fileId, data.order.id, "isDesignDone", isDone, rowNumber);
  
  ["Designer", "Designer Online"].forEach(n => {
    const s = ss.getSheetByName(n);
    if (s) {
      if (rowNumber) {
        try {
          // Kiểm tra lại ID tại dòng đó để chắc chắn
          const checkId = s.getRange(rowNumber, 2).getValue();
          if (String(checkId).trim() === String(data.order.id).trim()) {
            s.getRange(rowNumber, 14).setValue(isDone);
            return;
          }
        } catch (e) {}
      }
      
      const d = s.getDataRange().getValues();
      for (let j = 1; j < d.length; j++)
        if (String(d[j][1]).trim() == String(data.order.id).trim()) {
          s.getRange(j + 1, 14).setValue(isDone);
          if (rowNumber) break; // Nếu có rowNumber mà không khớp dòng mong muốn nhưng khớp dòng khác thì chỉ update 1 dòng đầu tiên tìm thấy
        }
    }
  });
  return { success: true };
}

/* =========================
   PATCH: NEW HANDLER (ADD ONLY)
   =========================
   Dành cho nút "Cập nhật" Link DS / Check / Note / product_url / options_text trên DESIGNER ONLINE
   - KHÔNG ẢNH HƯỞNG UI KHÁC
   - LƯU TRỰC TIẾP VÀO SHEET "Designer Online" (cột P-Q-R-S-T)
*/
function handleUpdateDesignerOnlineFields(postData) {
  try {
    if (!postData || !postData.fileId || !postData.orderId) {
      return { success: false, error: "Missing fileId/orderId" };
    }

    const ss = SpreadsheetApp.openById(postData.fileId);

    const updates = {};
    if (postData.linkDs !== undefined) updates.linkDs = postData.linkDs;
    if (postData.check !== undefined) updates.check = postData.check;
    if (postData.designerNote !== undefined) updates.designerNote = postData.designerNote;
    if (postData.productUrl !== undefined) updates.productUrl = postData.productUrl;
    if (postData.optionsText !== undefined) updates.optionsText = postData.optionsText;
    if (postData.urlArtworkFront !== undefined) updates.urlArtworkFront = postData.urlArtworkFront;
    if (postData.urlMockup !== undefined) updates.urlMockup = postData.urlMockup;

    const keys = Object.keys(updates);
    if (keys.length === 0) return { success: false, error: "No fields to update" };

    // Update using the same core logic (also tries to update main sheet if mapped)
    const res = updateOrderRow(postData.fileId, postData.orderId, updates, postData.rowNumber);
    if (!res.success) return res;

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function buildDesignerOnlineMap_(ss) {
  const out = {};
  const sh = ss.getSheetByName("Designer Online");
  if (!sh) return out;

  const values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) return out;

  const headers = values[0].map(h => String(h || "").toLowerCase().trim());

  // Tìm cột Order ID linh hoạt (ID ORDER ETSY / ORDER ID / ID)
  const orderIdIdx =
    headers.indexOf("id order etsy") !== -1 ? headers.indexOf("id order etsy") :
    headers.indexOf("order id") !== -1 ? headers.indexOf("order id") :
    headers.indexOf("id") !== -1 ? headers.indexOf("id") :
    1; // fallback cột B

  // Tìm các cột theo header đúng như UI bạn đang hiển thị
  const linkDsIdx = headers.indexOf("link ds");
  const checkIdx = headers.indexOf("check");
  const noteIdx = headers.indexOf("note");
  const productUrlIdx = headers.indexOf("product_url");
  const optionsTextIdx = headers.indexOf("options_text");
  const urlArtworkFrontIdx = headers.indexOf("url_artwork_front");
  const urlMockupIdx = headers.indexOf("url_mockup");

  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][orderIdIdx] || "").trim();
    if (!id) continue;

    out[id] = {
      linkDs: linkDsIdx !== -1 ? (values[i][linkDsIdx] || "") : "",
      check: checkIdx !== -1 ? (values[i][checkIdx] || "") : "",
      designerNote: noteIdx !== -1 ? (values[i][noteIdx] || "") : "",
      productUrl: productUrlIdx !== -1 ? (values[i][productUrlIdx] || "") : "",
      optionsText: optionsTextIdx !== -1 ? (values[i][optionsTextIdx] || "") : "",
      urlArtworkFront: urlArtworkFrontIdx !== -1 ? (values[i][urlArtworkFrontIdx] || "") : "",
      urlMockup: urlMockupIdx !== -1 ? (values[i][urlMockupIdx] || "") : ""
    };
  }

  return out;
}

function updateDesignerOnlineCellByOrderId_(ss, orderId, field, value, rowNumber) {
  const sh = ss.getSheetByName("Designer Online");
  if (!sh) return false;

  const data = sh.getDataRange().getValues();
  if (!data || data.length <= 1) return false;

  const headers = data[0].map(h => String(h || "").toLowerCase().trim());

  const orderIdIdx =
    headers.indexOf("id order etsy") !== -1 ? headers.indexOf("id order etsy") :
    headers.indexOf("order id") !== -1 ? headers.indexOf("order id") :
    headers.indexOf("id") !== -1 ? headers.indexOf("id") :
    1;

  const fieldToHeader = {
    linkDs: "link ds",
    check: "check",
    designerNote: "note",
    productUrl: "product_url",
    optionsText: "options_text",
    urlArtworkFront: "url_artwork_front",
    urlMockup: "url_mockup"
  };

  const h = fieldToHeader[field];
  if (!h) return false;

  const colIdx = headers.indexOf(h);
  if (colIdx === -1) return false;

  let found = false;
  const targetId = String(orderId).trim();

  // Nếu có rowNumber, thử update đúng dòng đó trước
  if (rowNumber && rowNumber <= data.length) {
    if (String(data[rowNumber - 1][orderIdIdx] || "").trim() === targetId) {
      sh.getRange(rowNumber, colIdx + 1).setValue(value);
      return true;
    }
  }

  // Fallback: tìm theo ID (có thể update nhiều dòng nếu không có rowNumber hoặc rowNumber không khớp)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][orderIdIdx] || "").trim() === targetId) {
      sh.getRange(i + 1, colIdx + 1).setValue(value);
      found = true;
      if (rowNumber) break; // Nếu có rowNumber mà không khớp dòng mong muốn nhưng khớp dòng khác thì chỉ update 1 dòng đầu tiên tìm thấy
    }
  }
  return found;
}
