
/**
 * ==========================================
 * UTILS.GS: CORE HELPERS
 * ==========================================
 */

function getActualLastRow(sheet) {
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    for (let j = 0; j < data[i].length; j++) {
      if (data[i][j] != "") return i + 1;
    }
  }
  return 0;
}
