import * as XLSX from 'xlsx';
import { parse, differenceInMinutes, isValid } from 'date-fns';

export const parseExcel = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Process all sheets
        const result = {};
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          result[sheetName] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        });
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const calculatePenaltyHours = (checkInStr, checkOutStr, workStartStr = "09:00", workEndStr = "15:00") => {
  // Parsing standard times
  const today = new Date().toISOString().split('T')[0];
  
  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    // Handle excel time format or standard HH:mm
    // E.g. "09:30" or excel decimal format - let's assume it's already string formatted like "HH:mm" or "HH:mm:ss"
    const parsed = new Date(`${today}T${timeStr}`);
    if (isValid(parsed)) return parsed;
    
    // Fallback simple parsing
    const parts = String(timeStr).split(':');
    if (parts.length >= 2) {
      const d = new Date();
      d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      return d;
    }
    return null;
  };

  const stdStart = parseTime(workStartStr);
  const stdEnd = parseTime(workEndStr);
  const actualStart = parseTime(checkInStr);
  const actualEnd = parseTime(checkOutStr);

  let lateInMins = 0;
  let earlyOutMins = 0;

  if (actualStart && stdStart) {
    const diff = differenceInMinutes(actualStart, stdStart);
    if (diff > 0) lateInMins = diff; // positive means late
  }

  if (actualEnd && stdEnd) {
    const diff = differenceInMinutes(stdEnd, actualEnd);
    if (diff > 0) earlyOutMins = diff; // positive means left early
  }

  // Handle case where checkIn or checkOut is missing 
  if (!actualStart || !actualEnd) {
    // If completely missing, whole day absence = 6 hours penalty
    return 6; 
  }

  const totalLateMins = lateInMins + earlyOutMins;
  if (totalLateMins < 15) return 0;
  if (totalLateMins <= 60) return 1;
  return Math.ceil(totalLateMins / 60);
};
