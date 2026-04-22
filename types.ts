export interface FileData {
  file: File;
  previewUrl?: string; // For images
  content?: string; // For text/excel parsed data
  base64?: string; // For API transport
  type: 'label' | 'excel';
}

export interface AnalysisResultData {
  markdown: string;
}

export interface BriefResultData {
  structuredData: Record<string, string>;
  originalResponse: string;
}

export interface DragDropProps {
  type: 'label' | 'excel';
  accept: string;
  fileData: FileData | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  title: string;
  description: string;
}

export type AppView =
  | 'brand-select'
  | 'lavka'
  | 'fabrika'
  | 'brief'
  | 'compare'
  | 'final'
  | 'textcheck';

export type BriefType = 'food' | 'nonfood' | 'inter' | 'ge';
