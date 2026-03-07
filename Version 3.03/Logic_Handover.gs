
/**
 * ==========================================
 * LOGIC_HANDOVER.GS: BÀN GIAO CÔNG VIỆC V5.8
 * ==========================================
 */

function handleGetHandover(dateStr, viewerName, viewerRole) {
  try {
    const s = getSheet(SHEET_HANDOVER);
    const d = s.getDataRange().getValues();
    if (d.length <= 1) return [];
    
    d.shift();
    
    const isAdminOrCEO = viewerRole && (viewerRole.toLowerCase() === 'admin' || viewerRole.toLowerCase() === 'ceo' || viewerRole.toLowerCase() === 'leader');
    
    let list = d.filter(r => {
      if (!dateStr || dateStr === "" || String(dateStr).toLowerCase() === "all") return true; 
      const rowDateRaw = r[1];
      let rowDateFormatted = "";
      if (rowDateRaw instanceof Date) rowDateFormatted = Utilities.formatDate(rowDateRaw, "GMT+7", "yyyy-MM-dd");
      else rowDateFormatted = String(rowDateRaw).split(' ')[0];
      return rowDateFormatted.startsWith(String(dateStr));
    }).map(r => ({
      id: String(r[0]),
      date: formatDate(r[1]),
      task: String(r[2] || ""),
      assignee: String(r[3] || ""),
      deadlineAt: r[4] ? formatDate(r[4]) : "",
      priority: String(r[5] || "Trung bình"), 
      status: r[6] || "Pending",
      startTime: r[7] ? formatDate(r[7]) : "",
      endTime: r[8] ? formatDate(r[8]) : "",
      report: r[9] || "", 
      fileLink: r[10] || "", 
      imageLink: r[11] || "",
      createdBy: r[12] || "System",
      resultLink: r[13] || "", 
      progress: Number(r[14] || 0)
    }));

    if (!isAdminOrCEO && viewerName) {
      list = list.filter(item => String(item.assignee).toLowerCase() === String(viewerName).toLowerCase());
    }

    const nowTs = new Date().getTime();
    list.forEach(item => {
      if (item.status !== 'Completed' && item.status !== 'Overdue' && item.deadlineAt) {
         try {
           const deadlineTs = new Date(item.deadlineAt).getTime();
           if (!isNaN(deadlineTs) && nowTs > deadlineTs) {
              item.status = 'Overdue';
           }
         } catch (e) {}
      }
    });

    return list;
  } catch (err) {
    console.error("handleGetHandover Error: " + err.toString());
    return [];
  }
}

function handleAddHandover(data) {
  const s = getSheet(SHEET_HANDOVER);
  const id = "H-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss");
  
  let dlDate = "";
  if(data.deadlineAt) dlDate = new Date(data.deadlineAt);

  s.appendRow([
    id, 
    new Date(), 
    data.task, 
    data.assignee, 
    dlDate, 
    'Trung bình', 
    'Pending', 
    '', '', '', 
    data.fileLink || '', 
    '', 
    data.createdBy,
    '', 
    0 
  ]);
  return { success: true };
}

function handleUpdateHandover(id, updates) {
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  const searchId = String(id).trim();

  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).trim() === searchId) {
      const row = i + 1;
      if (updates.task !== undefined) s.getRange(row, 3).setValue(updates.task);
      if (updates.assignee !== undefined) s.getRange(row, 4).setValue(updates.assignee);
      if (updates.deadlineAt !== undefined) s.getRange(row, 5).setValue(updates.deadlineAt ? new Date(updates.deadlineAt) : "");
      if (updates.status !== undefined) s.getRange(row, 7).setValue(updates.status);
      if (updates.startTime !== undefined) s.getRange(row, 8).setValue(updates.startTime);
      if (updates.endTime !== undefined) s.getRange(row, 9).setValue(updates.endTime ? new Date(updates.endTime) : "");
      if (updates.report !== undefined) s.getRange(row, 10).setValue(updates.report);
      if (updates.fileLink !== undefined) s.getRange(row, 11).setValue(updates.fileLink); 
      if (updates.resultLink !== undefined) s.getRange(row, 14).setValue(updates.resultLink); 
      if (updates.progress !== undefined) s.getRange(row, 15).setValue(updates.progress);
      
      return { success: true };
    }
  }
  return { success: false, error: "Không tìm thấy nhiệm vụ" };
}

function handleDeleteHandover(id) {
  if (!id) return { success: false, error: "Thiếu ID" };
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  for (let i = d.length - 1; i >= 1; i--) {
    if (String(d[i][0]).trim() === String(id).trim()) {
      s.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Không tìm thấy" };
}

function handleMarkHandoverAsSeen(id) {
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).trim() === String(id).trim()) {
      return { success: true };
    }
  }
  return { success: false };
}

function handleGetUserNote(username, boardKey) {
  try {
    const s = getSheet(SHEET_USER_NOTES);
    const d = s.getDataRange().getValues();
    const searchDate = String(boardKey).trim();
    const searchUser = String(username).toLowerCase().trim();

    for (let i = 1; i < d.length; i++) {
      let rowUser = String(d[i][0]).toLowerCase().trim();
      let rowDate = d[i][1];
      let rowDateStr = "";

      // Chuẩn hóa ngày từ Sheet để so sánh
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, "GMT+7", "yyyy-MM-dd");
      } else {
        rowDateStr = String(rowDate).trim().split(' ')[0];
      }

      if (rowUser === searchUser && rowDateStr === searchDate) {
        try {
          const fullData = JSON.parse(d[i][2] || '{}');
          return { 
            username: d[i][0], 
            date: boardKey, 
            items: fullData.items || [], 
            columns: fullData.columns || null,
            showPlanner: true 
          };
        } catch(e) { 
          return { username, date: boardKey, items: [], columns: null, showPlanner: true }; 
        }
      }
    }
  } catch (e) {
    console.error("handleGetUserNote Error: " + e.toString());
  }
  return { username, date: boardKey, items: [], columns: null, showPlanner: true };
}

function handleSaveUserNote(note) {
  const s = getSheet(SHEET_USER_NOTES);
  const d = s.getDataRange().getValues();
  const searchDate = String(note.date).trim();
  const searchUser = String(note.username).toLowerCase().trim();

  // Chỉ lưu items và columns về backend
  const dataToSave = { 
    items: note.items || [],
    columns: note.columns || null,
    lastUpdate: new Date().toISOString()
  };
  
  const jsonStr = JSON.stringify(dataToSave);
  let foundRow = -1;

  for (let i = 1; i < d.length; i++) {
    let rowUser = String(d[i][0]).toLowerCase().trim();
    let rowDate = d[i][1];
    let rowDateStr = "";

    // Chuẩn hóa ngày từ Sheet để tìm dòng cũ
    if (rowDate instanceof Date) {
      rowDateStr = Utilities.formatDate(rowDate, "GMT+7", "yyyy-MM-dd");
    } else {
      rowDateStr = String(rowDate).trim().split(' ')[0];
    }

    if (rowUser === searchUser && rowDateStr === searchDate) { 
      foundRow = i + 1; 
      break; 
    }
  }

  if (foundRow > 0) {
    s.getRange(foundRow, 3).setValue(jsonStr);
  } else {
    s.appendRow([note.username, note.date, jsonStr]);
  }
  return { success: true };
}
