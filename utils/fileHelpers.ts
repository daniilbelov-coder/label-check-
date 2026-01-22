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

export const addCorrectionColumnToExcel = async (
  originalFile: File, 
  corrections: Record<string, string>, 
  fileName: string = 'brief_corrected.xlsx'
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        // Read the original Excel file
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON to work with data
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          raw: false,
          defval: '' // Fill empty cells with empty string
        });
        
        // Add header for column G if it doesn't exist
        if (jsonData.length > 0 && Array.isArray(jsonData[0])) {
          const headerRow = jsonData[0] as any[];
          // Add "Исправленный текст" header in column G (index 6)
          headerRow[6] = "Исправленный текст";
        }
        
        // Iterate through rows and match block names from column A
        jsonData.forEach((row: any, index) => {
          if (index === 0 || !Array.isArray(row)) return; // Skip header row
          
          const blockName = row[0]; // Column A
          
          if (blockName && typeof blockName === 'string') {
            const trimmedBlockName = blockName.trim();
            // Extract first line only (before \r\n or \n) to match correction keys
            const firstLine = trimmedBlockName.split(/[\r\n]+/)[0].trim();
            
            // Find matching correction by block name
            let correction = corrections[firstLine];
            
            // If exact match not found, try finding a key that starts with the first line
            if (!correction) {
              const matchingKey = Object.keys(corrections).find(key => 
                firstLine.startsWith(key) || key.startsWith(firstLine)
              );
              if (matchingKey) {
                correction = corrections[matchingKey];
              }
            }
            
            if (correction) {
              // Add correction to column G (index 6)
              row[6] = correction;
            }
          }
        });
        
        // Convert back to worksheet
        const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);
        
        // Set column widths
        const wscols = [
          { wch: 30 },  // A
          { wch: 25 },  // B
          { wch: 15 },  // C
          { wch: 15 },  // D
          { wch: 15 },  // E
          { wch: 50 },  // F
          { wch: 50 }   // G - new column
        ];
        newWorksheet['!cols'] = wscols;
        
        // Create new workbook with modified sheet
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
        
        // Download file
        XLSX.writeFile(newWorkbook, fileName);
        
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(originalFile);
  });
};
