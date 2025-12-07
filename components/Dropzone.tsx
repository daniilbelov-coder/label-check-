import React, { useRef, useState } from 'react';
import { Upload, X, FileText, FileSpreadsheet, Eye } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (fileData) {
    return (
      <div className="relative group w-full h-64 border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all">
        {/* Preview for images */}
        {type === 'label' && fileData.previewUrl ? (
          <div className="w-full h-full relative">
            <img 
              src={fileData.previewUrl} 
              alt="Preview" 
              className="w-full h-full object-contain p-4" 
            />
            {fileData.file.type === 'application/pdf' && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50">
                <div className="bg-white p-4 rounded-xl shadow text-center">
                   <FileText className="w-10 h-10 text-red-500 mx-auto mb-2" />
                   <span className="text-sm font-medium text-gray-700">PDF Документ</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-green-50">
            <FileSpreadsheet className="w-16 h-16 text-green-600 mb-4" />
            <p className="text-sm font-medium text-green-800 text-center truncate w-full px-4">
              {fileData.file.name}
            </p>
            <p className="text-xs text-green-600 mt-1">Excel файл загружен</p>
          </div>
        )}

        {/* Remove Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md text-gray-500 hover:text-red-500 transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Overlay info */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-3 border-t border-gray-100 flex items-center gap-3">
           <div className={`p-2 rounded-lg ${type === 'label' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
              {type === 'label' ? <Eye size={16} /> : <FileSpreadsheet size={16} />}
           </div>
           <div className="flex-1 min-w-0">
             <p className="text-sm font-medium text-gray-900 truncate">{fileData.file.name}</p>
             <p className="text-xs text-gray-500">{(fileData.file.size / 1024).toFixed(1)} KB</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 scale-[0.99]' 
          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
        }
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept={accept} 
        className="hidden" 
      />
      
      <div className={`
        p-4 rounded-full mb-4 transition-colors
        ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500'}
      `}>
        {type === 'label' ? <Upload size={28} /> : <FileSpreadsheet size={28} />}
      </div>

      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 text-center max-w-[200px]">{description}</p>
    </div>
  );
};

export default Dropzone;
