import * as XLSX from 'xlsx';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the Data-URL prefix (e.g. "data:image/png;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = error => reject(error);
  });
};

export const parseExcelFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        let fullText = "";
        
        workbook.SheetNames.forEach(sheetName => {
          try {
            const worksheet = workbook.Sheets[sheetName];
            // Use header:1 to get array of arrays, raw:true to avoid auto-formatting dates/numbers which might hide diffs
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
            
            if (!json || json.length === 0) {
              console.warn(`Sheet "${sheetName}" is empty, skipping.`);
              return;
            }

            fullText += `Sheet: ${sheetName}\n`;
            
            json.forEach((row: any, rowIndex) => {
               // Skip empty rows
               if (!row || (Array.isArray(row) && row.length === 0)) {
                 return; 
               }

               try {
                 // Read column A (block name) and column F (data)
                 // A=0, B=1, C=2, D=3, E=4, F=5
                 if (Array.isArray(row)) {
                   const cellA = row[0]; // Column A - block name
                   const cellF = row.length > 5 ? row[5] : null; // Column F - data
                   
                   // If column A has a block name, add it as a header
                   if (cellA !== null && cellA !== undefined && String(cellA).trim() !== '') {
                     const blockName = String(cellA).trim();
                     // Add separator before block name for better parsing
                     fullText += "\n" + blockName + "\n";
                   }
                   
                   // Add data from column F
                   if (cellF !== null && cellF !== undefined && String(cellF).trim() !== '') {
                     fullText += String(cellF).trim() + "\n";
                   }
                 }
               } catch (rowError) {
                 console.warn(`Error parsing row ${rowIndex} in sheet ${sheetName}:`, rowError);
                 // Continue to next row
               }
            });
            fullText += "\n---\n";
          } catch (sheetError) {
             console.error(`Error parsing sheet ${sheetName}:`, sheetError);
             // Continue to next sheet
          }
        });
        
        if (fullText.trim().length === 0) {
           reject(new Error("Столбец F пуст или не содержит данных."));
        } else {
           resolve(fullText);
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const createPreviewUrl = (file: File): string => {
  return URL.createObjectURL(file);
};

export const generateAndDownloadExcel = (data: Record<string, string>, fileName: string = 'processed_brief.xlsx') => {
  // Convert object to array of arrays for Excel [["Header", "Content"], ...]
  const wsData = [
    ["Раздел", "Скорректированный текст"], // Headers
    ...Object.entries(data)
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-width column somewhat
  const wscols = [{ wch: 30 }, { wch: 100 }];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "Бриф");
  XLSX.writeFile(wb, fileName);
};
