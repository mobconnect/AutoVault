
export type FileCategory = 'Work' | 'Personal' | 'Apps' | 'Media' | 'Notes' | 'Financial' | 'Uncategorized';

export interface VaultFile {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  category: FileCategory;
  suggestedPath: string;
  isOrganized: boolean;
  content?: string; // For notes
  thumbnail?: string; // For images
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  category: FileCategory;
  fileCount: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}
