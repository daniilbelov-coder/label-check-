import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, AlertCircle, Download, FileText, LayoutPanelTop, RefreshCw } from 'lucide-react';
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
       
      {/* Header Actions */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Результат анализа</h2>
         </div>
         <button 
           onClick={handleDownloadPDF}
           disabled={isDownloading}
           className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-brand-600 text-white rounded-full hover:bg-brand-600 dark:hover:bg-brand-500 transition-all font-bold text-sm shadow-md disabled:opacity-70"
         >
            {isDownloading ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
            Скачать отчет PDF
         </button>
      </div>

      {/* Main Report Content */}
      <div 
        ref={reportRef} 
        className="bg-white dark:bg-slate-900 rounded-[32px] ring-1 ring-slate-200 dark:ring-slate-800 shadow-xl overflow-hidden"
      >
        <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
           <LayoutPanelTop size={18} className="text-slate-400 dark:text-slate-500"/>
           <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-widest">Детальный отчет ИИ</span>
        </div>
        
        <div className="p-10 prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              ul: ({node, ...props}) => <ul className="list-none pl-0 space-y-4 mb-6" {...props} />,
              li: ({node, ...props}) => (
                <li className="flex gap-4 items-start text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800" {...props}>
                  <div className="w-2 h-2 mt-2 rounded-full bg-brand-400 dark:bg-brand-600 shrink-0" />
                  <div className="flex-1">{props.children}</div>
                </li>
              ),
              strong: ({node, ...props}) => <span className="font-bold text-slate-900 dark:text-white text-brand-700 dark:text-brand-400 underline decoration-brand-200 dark:decoration-brand-900/50 decoration-2 underline-offset-2" {...props} />,
              h1: ({node, ...props}) => <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-10 mb-6 tracking-tight flex items-center gap-3" {...props} />,
              h2: ({node, ...props}) => <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3" {...props} />,
              h3: ({node, ...props}) => <h5 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-6 mb-3" {...props} />,
              p: ({node, ...props}) => <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4" {...props} />,
            }}
          >
            {data.markdown}
          </ReactMarkdown>
        </div>
      </div>

      <div className="bg-brand-50 dark:bg-brand-900/10 p-6 rounded-[24px] border border-brand-100 dark:border-brand-900/30 flex items-start gap-4">
        <AlertCircle className="text-brand-500 dark:text-brand-400 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-brand-900 dark:text-brand-100 font-bold text-sm mb-1">Важное примечание</h4>
          <p className="text-sm text-brand-700 dark:text-brand-300 leading-relaxed">
            Искусственный интеллект является вспомогательным инструментом. Пожалуйста, проведите финальную ручную сверку критически важных данных (аллергены, дозировки, юридические адреса) перед отправкой макета в печать.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
