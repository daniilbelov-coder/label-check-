import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, AlertCircle, Download, FileText, Image as ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AnalysisResultData } from '../types';

interface Props {
  data: AnalysisResultData;
}

const AnalysisResult: React.FC<Props> = ({ data }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('label-check-report.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Не удалось создать PDF. Попробуйте снова.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
       
      {/* Header Actions */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
         <div className="flex items-center gap-2">
            <CheckCircle2 className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Результат проверки</h2>
         </div>
         <button 
           onClick={handleDownloadPDF}
           disabled={isDownloading}
           className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-70"
         >
            {isDownloading ? <span className="animate-spin">⌛</span> : <Download size={16} />}
            Скачать PDF
         </button>
      </div>

      {/* Main Report Content */}
      <div 
        ref={reportRef} 
        className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col lg:flex-row"
      >
        {/* Left Column: Text Report */}
        <div className="flex-1 border-b lg:border-b-0 lg:border-r border-gray-100">
           <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center gap-2">
              <FileText size={18} className="text-slate-500"/>
              <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Текстовый отчет</span>
           </div>
           <div className="p-8 prose prose-slate prose-headings:font-medium prose-a:text-blue-600 max-w-none">
            <ReactMarkdown
              components={{
                ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4" {...props} />,
                li: ({node, ...props}) => <li className="text-gray-700 leading-relaxed" {...props} />,
                strong: ({node, ...props}) => <span className="font-semibold text-gray-900 bg-yellow-50 px-1 rounded" {...props} />,
                h1: ({node, ...props}) => <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3" {...props} />,
                h2: ({node, ...props}) => <h4 className="text-lg font-bold text-gray-900 mt-5 mb-2 border-b pb-2" {...props} />,
                h3: ({node, ...props}) => <h5 className="text-base font-bold text-gray-800 mt-4 mb-2" {...props} />,
              }}
            >
              {data.markdown}
            </ReactMarkdown>
          </div>
        </div>

        {/* Right Column: Visual Annotations */}
        {data.annotatedImageUrl && (
          <div className="flex-1 bg-slate-50 min-h-[400px]">
             <div className="bg-white px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                <ImageIcon size={18} className="text-slate-500"/>
                <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Визуализация ошибок</span>
             </div>
             <div className="p-6 flex flex-col items-center">
               <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 w-full">
                  <img 
                    src={`data:image/png;base64,${data.annotatedImageUrl}`} 
                    alt="Annotated Label" 
                    className="w-full h-auto rounded-lg"
                  />
               </div>
               <p className="text-xs text-gray-500 mt-3 text-center">
                 ИИ выделил потенциальные места ошибок красным цветом.
               </p>
             </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50/50 p-4 border border-blue-100 rounded-xl flex items-start gap-3">
        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-blue-700">
          ИИ может допускать ошибки. Пожалуйста, используйте этот отчет как вспомогательный инструмент и всегда проверяйте критические данные вручную.
        </p>
      </div>
    </div>
  );
};

export default AnalysisResult;