import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  content: string;
}

const AnalysisResult: React.FC<Props> = ({ content }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden animate-fade-in-up">
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center gap-2">
        <CheckCircle2 className="text-blue-600" size={20} />
        <h2 className="font-semibold text-gray-900">Результат проверки</h2>
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
          {content}
        </ReactMarkdown>
      </div>
      <div className="bg-blue-50/50 p-4 border-t border-blue-100 flex items-start gap-3">
        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-blue-700">
          ИИ может допускать ошибки. Пожалуйста, используйте этот отчет как вспомогательный инструмент и всегда проверяйте критические данные вручную.
        </p>
      </div>
    </div>
  );
};

export default AnalysisResult;
