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

export interface FabrikaSignInput {
  name: string;
  dataUrl: string;
}

export interface FabrikaAnalyzeRequest {
  excelText: string;
  pdfPages: string[];
  signs: FabrikaSignInput[];
  modelId?: string;
}

export interface FabrikaSignResult {
  name: string;
  raw: string;
  error?: boolean;
}

export interface FabrikaAnalyzeResponse {
  result: string;
  signResults: FabrikaSignResult[];
  mainMd: string;
}

// ===== Fabrika batch QA (new) =====

export type FabrikaRowStatus = 'pending' | 'analyzing' | 'done' | 'error' | 'no-spec';

export interface FabrikaMatchedColumn {
  sheet: string;
  colIndex: number;
  fileName: string;
}

export interface FabrikaRow {
  id: string;
  pdfName: string;
  status: FabrikaRowStatus;
  matchedColumn: FabrikaMatchedColumn | null;
  specText: string | null;
  mainMd: string | null;
  signResults: Array<{ name: string; raw: string; error: string | null }> | null;
  error: string | null;
  durationMs: number | null;
}

export interface FabrikaJob {
  id: string;
  status: 'parsing' | 'running' | 'done' | 'error';
  createdAt: number;
  totalPdfs: number;
  completedPdfs: number;
  errorCount: number;
  rows: FabrikaRow[];
  unmatchedColumns: Array<{ sheet: string; fileName: string }>;
}

export interface FabrikaJobSettings {
  modelId?: string;
  qaSystemPrompt?: string;
  signCheckPrompt?: string;
}

export interface FabrikaPromptDefaults {
  qaSystemPrompt: string;
  signCheckPrompt: string;
}
