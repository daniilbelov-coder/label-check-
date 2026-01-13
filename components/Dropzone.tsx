import React, { useRef, useState } from 'react';
import { Upload, X, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { DragDropProps } from '../types';

const Dropzone: React.FC<DragDropProps> = ({ 
  type, 
  accept, 
  fileData, 
  onFileSelect, 
  onClear, 
  title, 
  description 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const startSimulatedUpload = (file: File) => {
    setUploadProgress(0);
    let currentProgress = 0;
    const interval = setInterval(() => {
      // Simulate non-linear progress
      const increment = Math.random() * 15 + 5;
      currentProgress += increment;
      
      if (currentProgress >= 100) {
        currentProgress = 100;
        setUploadProgress(100);
        clearInterval(interval);
        
        // Brief delay before showing completion state
        setTimeout(() => {
          onFileSelect(file);
          setUploadProgress(null);
        }, 400);
      } else {
        setUploadProgress(currentProgress);
      }
    }, 80);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      startSimulatedUpload(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    if (!fileData && uploadProgress === null) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      startSimulatedUpload(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col w-full">
      <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-1">
        {title}
      </h3>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative w-full h-[320px] rounded-[32px] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden
          ${fileData 
            ? 'border-transparent bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800' 
            : isDragging 
              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10' 
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }
          ${!fileData && uploadProgress === null ? 'cursor-pointer' : ''}
        `}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept={accept} 
          className="hidden" 
        />

        {uploadProgress !== null ? (
          <div className="w-full flex flex-col items-center justify-center p-12 animate-fade-in">
            <div className="relative w-24 h-24 mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={2 * Math.PI * 44 * (1 - uploadProgress / 100)}
                  strokeLinecap="round"
                  className="text-brand-500 transition-all duration-300 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-white mb-1">Загрузка файла...</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">Пожалуйста, подождите</p>
          </div>
        ) : fileData ? (
          <div className="w-full h-full p-6 flex flex-col items-center justify-center animate-fade-in">
            {type === 'label' && fileData.previewUrl ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  src={fileData.previewUrl} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain rounded-xl" 
                />
                {fileData.file.type === 'application/pdf' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 rounded-xl">
                    <FileText className="w-12 h-12 text-slate-400 dark:text-slate-600" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 rounded-3xl flex items-center justify-center mb-4">
                  <FileSpreadsheet size={36} />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white text-center max-w-[240px] truncate px-2">
                  {fileData.file.name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Excel файл готов</p>
              </div>
            )}

            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute top-4 right-4 p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full shadow-sm text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:border-red-100 dark:hover:border-red-900/30 transition-all hover:scale-110"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center p-8 text-center group">
            <div className={`
              w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 transition-all duration-300
              ${isDragging ? 'bg-brand-500 text-white scale-110' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/20 group-hover:text-brand-500'}
            `}>
              {type === 'label' ? <Upload size={28} /> : <FileSpreadsheet size={28} />}
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-white mb-2">
              {type === 'label' ? 'Загрузите этикетку' : 'Загрузите таблицу'}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-[200px] leading-relaxed">
              {description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dropzone;
