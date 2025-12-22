
/**
 * ==========================================
 * LOGIC_HANDOVER.GS: BÀN GIAO CÔNG VIỆC
 * ==========================================
 */

function handleGetHandover(dateStr, viewerName, viewerRole) {
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return [];
  
  d.shift();
  
  // Kiểm tra quyền: Admin và CEO được xem tất cả
  const isAdminOrCEO = viewerRole && (viewerRole.toLowerCase() === 'admin' || viewerRole.toLowerCase() === 'ceo');
  
  // Lọc theo ngày được chọn (dạng yyyy-mm-dd). Nếu dateStr rỗng thì lấy tất cả để hiển thị lịch sử.
  let list = d.filter(r => {
    if (!dateStr || dateStr === "") return true; // Lấy tất cả nếu không truyền ngày (dùng cho thanh thông báo)
    const rowDate = formatDate(r[1]);
    return rowDate.startsWith(dateStr);
  }).map(r => ({
    id: String(r[0]),
    date: formatDate(r[1]),
    task: r[2],
    assignee: r[3],
    deadlineAt: r[4] ? formatDate(r[4]) : "",
    isSeen: r[5] === 'Seen' || r[5] === true, // Cột Reserved (cột F) dùng để lưu trạng thái đã xem
    status: r[6],
    startTime: r[7] ? formatDate(r[7]) : "",
    endTime: r[8] ? formatDate(r[8]) : "",
    report: r[9] || "", 
    fileLink: r[10] || "",
    imageLink: r[11] || "",
    createdBy: r[12]
  }));

  // Nếu không phải Admin/CEO, chỉ trả về những việc được giao cho viewerName
  if (!isAdminOrCEO && viewerName) {
    list = list.filter(item => item.assignee.toLowerCase() === viewerName.toLowerCase());
  }

  // Tự động kiểm tra quá hạn dựa trên thời gian thực hiện tại
  const now = new Date().getTime();
  list.forEach(item => {
    if (item.status !== 'Completed' && item.deadlineAt) {
       const deadlineTs = new Date(item.deadlineAt).getTime();
       if (now > deadlineTs) {
         item.status = 'Overdue';
         updateHandoverStatusInSheet(item.id, 'Overdue');
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
      s.getRange(i + 1, 6).setValue('Seen'); // Cột Reserved là cột số 6 (F)
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

  // Thứ tự cột: ID, Date, Task, Assignee, DeadlineAt, [Reserved], Status, StartTime, EndTime, Report, FileLink, ImageLink, CreatedBy
  s.appendRow([
    id, 
    new Date(data.date), 
    data.task, 
    data.assignee, 
    dlDate, 
    '', // Reserved (isSeen ban đầu trống)
    'Pending', 
    '', '', '', 
    data.fileLink || '', 
    data.imageLink || '',
    data.createdBy
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
      
      return { success: true };
    }
  }
  return { success: false, error: "Không tìm thấy nhiệm vụ ID: " + id };
}

function handleDeleteHandover(id) {
  if (!id) return { success: false, error: "Lỗi hệ thống: Thiếu ID để thực hiện thao tác xóa." };
  
  const s = getSheet(SHEET_HANDOVER);
  const d = s.getDataRange().getValues();
  const searchId = String(id).trim();
  
  for (let i = d.length - 1; i >= 1; i--) {
    if (String(d[i][0]).trim() === searchId) {
      s.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Dữ liệu không tồn tại hoặc đã bị xóa trước đó." };
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
        const items = JSON.parse(d[i][2] || '[]');
        return { username: d[i][0], date: rowDate, items: items };
      } catch(e) {
        return { username, date, items: [] };
      }
    }
  }
  return { username, date, items: [] };
}

function handleSaveUserNote(note) {
  const s = getSheet(SHEET_USER_NOTES);
  const d = s.getDataRange().getValues();
  const itemsJson = JSON.stringify(note.items || []);
  let foundRow = -1;
  for (let i = 1; i < d.length; i++) {
    const rowDate = formatDate(d[i][1]).split(' ')[0];
    if (String(d[i][0]) === String(note.username) && rowDate === note.date) {
      foundRow = i + 1;
      break;
    }
  }
  if (foundRow > 0) {
    s.getRange(foundRow, 3).setValue(itemsJson);
  } else {
    s.appendRow([note.username, new Date(note.date), itemsJson]);
  }
  return { success: true };
}
