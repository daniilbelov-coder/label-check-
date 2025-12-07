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
                 // Filter out null/undefined/empty cells to avoid "|||" noise
                 const rowContent = Array.isArray(row) 
                   ? row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').join(" | ") 
                   : String(row);

                 if (rowContent.trim().length > 0) {
                   fullText += rowContent + "\n";
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
           reject(new Error("Файл Excel пуст или не содержит читаемого текста."));
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