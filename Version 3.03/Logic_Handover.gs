
/**
 * ==========================================
 * LOGIC_HANDOVER.GS: BÀN GIAO CÔNG VIỆC V5.3
 * ==========================================
 */

function handleGetHandover(dateStr, viewerName, viewerRole) {
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return [];
  
  d.shift();
  
  const isAdminOrCEO = viewerRole && (viewerRole.toLowerCase() === 'admin' || viewerRole.toLowerCase() === 'ceo' || viewerRole.toLowerCase() === 'leader');
  
  let list = d.filter(r => {
    if (!dateStr || dateStr === "" || dateStr === "all") return true; 
    const rowDate = formatDate(r[1]).split(' ')[0]; 
    return rowDate.startsWith(dateStr);
  }).map(r => ({
    id: String(r[0]),
    date: formatDate(r[1]),
    task: r[2],
    assignee: r[3],
    deadlineAt: r[4] ? formatDate(r[4]) : "",
    isSeen: r[5] === 'Seen' || r[5] === true, 
    status: r[6],
    startTime: r[7] ? formatDate(r[7]) : "",
    endTime: r[8] ? formatDate(r[8]) : "",
    report: r[9] || "", 
    fileLink: r[10] || "",
    imageLink: r[11] || "",
    createdBy: r[12],
    resultLink: r[13] || "" // Cột N (Index 13) cho link hoàn tất
  }));

  if (!isAdminOrCEO && viewerName) {
    list = list.filter(item => item.assignee.toLowerCase() === viewerName.toLowerCase());
  }

  const now = new Date().getTime();
  list.forEach(item => {
    if (item.status !== 'Completed' && item.deadlineAt) {
       const deadlineTs = new Date(item.deadlineAt).getTime();
       if (now > deadlineTs) {
         if (item.status !== 'Overdue') {
            item.status = 'Overdue';
            updateHandoverStatusInSheet(item.id, 'Overdue');
         }
       }
    }
  });

  return list;
}

function handleMarkHandoverAsSeen(id) {
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  const searchId = String(id).trim();

  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).trim() === searchId) {
      s.getRange(i + 1, 6).setValue('Seen'); 
      return { success: true };
    }
  }
  return { success: false, error: "Không tìm thấy nhiệm vụ ID: " + id };
}

function handleAddHandover(data) {
  const s = getSheet(SHEET_HANDOVER);
  const id = "H-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss");
  
  let dlDate = "";
  if(data.deadlineAt) {
      dlDate = new Date(data.deadlineAt);
  }

  s.appendRow([
    id, 
    new Date(data.date), 
    data.task, 
    data.assignee, 
    dlDate, 
    '', 
    'Pending', 
    '', '', '', 
    data.fileLink || '', 
    data.imageLink || '',
    data.createdBy,
    '' // resultLink mặc định trống
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
      if (updates.deadlineAt !== undefined) {
         const dlVal = updates.deadlineAt ? new Date(updates.deadlineAt) : "";
         s.getRange(row, 5).setValue(dlVal);
      }
      if (updates.status !== undefined) s.getRange(row, 7).setValue(updates.status);
      if (updates.startTime !== undefined) s.getRange(row, 8).setValue(updates.startTime);
      if (updates.endTime !== undefined) {
         const endVal = updates.endTime ? new Date(updates.endTime) : "";
         s.getRange(row, 9).setValue(endVal);
      }
      if (updates.report !== undefined) s.getRange(row, 10).setValue(updates.report);
      if (updates.fileLink !== undefined) s.getRange(row, 11).setValue(updates.fileLink);
      if (updates.imageLink !== undefined) s.getRange(row, 12).setValue(updates.imageLink);
      if (updates.createdBy !== undefined) s.getRange(row, 13).setValue(updates.createdBy);
      if (updates.resultLink !== undefined) s.getRange(row, 14).setValue(updates.resultLink); // Lưu vào cột N
      
      return { success: true };
    }
  }
  return { success: false, error: "Không tìm thấy nhiệm vụ ID: " + id };
}

function handleDeleteHandover(id) {
  if (!id) return { success: false, error: "Thiếu ID" };
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  const searchId = String(id).trim();
  for (let i = d.length - 1; i >= 1; i--) {
    if (String(d[i][0]).trim() === searchId) {
      s.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Không tìm thấy" };
}

function updateHandoverStatusInSheet(id, status) {
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).trim() === String(id).trim()) {
      s.getRange(i + 1, 7).setValue(status);
      break;
    }
  }
}

function handleGetUserNote(username, date) {
  const s = getSheet(SHEET_USER_NOTES);
  const d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    const rowDate = formatDate(d[i][1]).split(' ')[0];
    if (String(d[i][0]) === String(username) && rowDate === date) {
      try {
        const fullData = JSON.parse(d[i][2] || '{}');
        // Nếu là format cũ (chỉ là array), chuyển sang format mới
        if (Array.isArray(fullData)) {
            return { username: d[i][0], date: rowDate, items: fullData, showPlanner: true };
        }
        return { 
          username: d[i][0], 
          date: rowDate, 
          items: fullData.items || [], 
          showPlanner: fullData.showPlanner !== undefined ? fullData.showPlanner : true 
        };
      } catch(e) {
        return { username, date, items: [], showPlanner: true };
      }
    }
  }
  return { username, date, items: [], showPlanner: true };
}

function handleSaveUserNote(note) {
  const s = getSheet(SHEET_USER_NOTES);
  const d = s.getDataRange().getValues();
  // Lưu cả items và trạng thái ẩn hiện Planner
  const dataToSave = {
    items: note.items || [],
    showPlanner: note.showPlanner !== undefined ? note.showPlanner : true
  };
  const jsonStr = JSON.stringify(dataToSave);

  let foundRow = -1;
  for (let i = 1; i < d.length; i++) {
    const rowDate = formatDate(d[i][1]).split(' ')[0];
    if (String(d[i][0]) === String(note.username) && rowDate === note.date) {
      foundRow = i + 1;
      break;
    }
  }
  if (foundRow > 0) {
    s.getRange(foundRow, 3).setValue(jsonStr);
  } else {
    s.appendRow([note.username, new Date(note.date), jsonStr]);
  }
  return { success: true };
}
