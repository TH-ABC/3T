
/**
 * ==========================================
 * LOGIC_1.GS: NGHIỆP VỤ CHÍNH V10.0 (FULL HANDLERS)
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

function handleAddNews(news) {
  const sheet = getSheet(SHEET_NEWS);
  const id = "N-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss");
  const imgStr = String(news.imageUrl || "");
  sheet.appendRow([id, news.title, news.content, imgStr, news.author, new Date(), "FALSE"]);
  return { success: true };
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
          sheet.getRange(i + 1, 4).setValue(String(news.imageUrl));
        }
        return { success: true }; 
      }
    }
    return { success: false, error: "Không tìm thấy bản tin ID: " + targetId };
  } catch (err) {
    return { success: false, error: "Lỗi Server: " + err.toString() };
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
  return { success: false, error: "Không tìm thấy bài viết" };
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
