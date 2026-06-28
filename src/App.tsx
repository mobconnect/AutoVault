
import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderIcon, 
  FileIcon, 
  UploadIcon, 
  CpuIcon, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  MoreVertical,
  Briefcase,
  Home,
  Smartphone,
  ImageIcon,
  FileText,
  ChevronRight,
  Plus,
  Trash2,
  Move,
  X,
  Square,
  CheckSquare,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Share2,
  Copy,
  ExternalLink,
  Bell,
  BellOff,
  Info,
  Lock,
  Unlock,
  Key,
  Receipt,
  Download,
  Sparkles,
  Laptop,
  Camera,
  ShoppingBag,
  Eye,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { VaultFile, FileCategory, Folder, AppNotification } from './types';
import { cn, formatBytes } from './lib/utils';
import { categorizeFile, suggestFolderMoves, FolderSuggestion } from './services/geminiService';
import { 
  initAuth, 
  googleSignIn, 
  logoutGoogle, 
  listGoogleDriveFiles, 
  uploadFileToDrive, 
  getDriveFileContent, 
  GoogleDriveFile 
} from './services/googleDriveService';
import { User } from 'firebase/auth';

const CATEGORIES: { id: FileCategory; icon: React.ElementType; color: string }[] = [
  { id: 'Work', icon: Briefcase, color: 'text-blue-500' },
  { id: 'Personal', icon: Home, color: 'text-emerald-500' },
  { id: 'Apps', icon: Smartphone, color: 'text-purple-500' },
  { id: 'Media', icon: ImageIcon, color: 'text-orange-500' },
  { id: 'Notes', icon: FileText, color: 'text-amber-500' },
  { id: 'Financial', icon: Receipt, color: 'text-rose-500' },
];

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  type: string;
  size: number;
  category: FileCategory;
  suggestedPath: string;
  thumbnail: string;
  price: string;
  content?: string;
}

const SMART_STORE_ITEMS: StoreItem[] = [
  {
    id: 'store_1',
    name: 'Aesthetic Nature Landscape.jpg',
    description: 'High-resolution serene nature landscape wallpaper. Perfect for your device background.',
    type: 'image/jpeg',
    size: 2457600,
    category: 'Media',
    suggestedPath: 'Media/Wallpapers',
    thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    price: 'Free'
  },
  {
    id: 'store_2',
    name: 'Cyberpunk Synthwave Vector.png',
    description: 'Vibrant neon cyber synthwave aesthetic illustration with glowing lines.',
    type: 'image/png',
    size: 4194304,
    category: 'Media',
    suggestedPath: 'Media/Graphics',
    thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
    price: 'Free'
  },
  {
    id: 'store_3',
    name: 'Minimal Workspace Sketch.jpg',
    description: 'Clean monochrome sketch of a modern desk layout. Inspiring and peaceful.',
    type: 'image/jpeg',
    size: 921600,
    category: 'Notes',
    suggestedPath: 'Notes/Sketches',
    thumbnail: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80',
    price: 'Free'
  },
  {
    id: 'store_4',
    name: 'Professional Invoice Template.pdf',
    description: 'Pre-formatted corporate financial invoice draft ready for business customization.',
    type: 'application/pdf',
    size: 102400,
    category: 'Financial',
    suggestedPath: 'Financial/Templates',
    thumbnail: 'invoice_temp',
    price: 'Free',
    content: 'AUTONIZE SMART INVOICE TEMPLATE\n--------------------------------\nInvoice #: INV-2026-001\nDate: June 28, 2026\nBill To: Client Name\nAmount Due: $0.00\n\nThank you for your business!'
  },
  {
    id: 'store_5',
    name: 'Project Roadmap Blueprint.pdf',
    description: 'High-level roadmap slide template for visual project tracking.',
    type: 'application/pdf',
    size: 184320,
    category: 'Work',
    suggestedPath: 'Work/Roadmaps',
    thumbnail: 'roadmap_temp',
    price: 'Premium',
    content: 'PROJECT ROADMAP BLUEPRINT\n-------------------------\nPhase 1: Architecture & Prototyping\nPhase 2: Alpha Testing & Security Audit\nPhase 3: Production Release\nTarget Timeline: Q3-Q4 2026'
  },
  {
    id: 'store_6',
    name: 'Aesthetic Coffee Mug Close-Up.jpg',
    description: 'Relaxing close-up photo of warm coffee cup on desk with cozy ambient light.',
    type: 'image/jpeg',
    size: 1536000,
    category: 'Media',
    suggestedPath: 'Media/Photos',
    thumbnail: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
    price: 'Free'
  }
];

export default function App() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'All'>('All');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Google Drive integration state variables
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [driveFilter, setDriveFilter] = useState<'all' | 'image' | 'pdf' | 'apk'>('all');
  const [driveSearch, setDriveSearch] = useState('');
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [isDriveProcessing, setIsDriveProcessing] = useState<Record<string, boolean>>({});
  const [isExportingToDrive, setIsExportingToDrive] = useState(false);
  
  const [activeView, setActiveView] = useState<'files' | 'store'>('files');
  const [selectedStoreItem, setSelectedStoreItem] = useState<any | null>(null);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);

  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editFileCategory, setEditFileCategory] = useState<FileCategory>('Work');
  const [editFilePath, setEditFilePath] = useState('');

  const saveFileEdits = (id: string, newName: string, newCategory: FileCategory, newPath: string) => {
    if (!newName.trim()) {
      notify("Invalid Name", "File name cannot be empty.", "warning");
      return;
    }
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          name: newName.trim(),
          category: newCategory,
          suggestedPath: newPath.trim() || `${newCategory}/Unsorted`,
          isOrganized: true
        };
      }
      return f;
    }));
    notify("File Updated", `"${newName}" has been updated successfully.`, "success");
    addLog(`FILE: Updated metadata for "${newName}".`);
    setPreviewFile(prev => prev && prev.id === id ? {
      ...prev,
      name: newName.trim(),
      category: newCategory,
      suggestedPath: newPath.trim() || `${newCategory}/Unsorted`,
      isOrganized: true
    } : prev);
  };

  const deleteSingleFile = (id: string) => {
    const file = files.find(f => f.id === id);
    if (!file) return;
    setFiles(prev => prev.filter(f => f.id !== id));
    notify("File Deleted", `"${file.name}" has been deleted.`, "success");
    addLog(`DELETE: Removed "${file.name}".`);
    setPreviewFile(null);
  };

  const downloadSingleFile = (file: VaultFile) => {
    try {
      const content = file.content || `autonize Simulated File Content\nName: ${file.name}\nSize: ${formatBytes(file.size)}\nType: ${file.type}\nOrganized Path: ${file.suggestedPath}`;
      const blob = new Blob([content], { type: file.type || 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify("Download Completed", `"${file.name}" downloaded to your system.`, "success");
      addLog(`DOWNLOAD: Downloaded "${file.name}".`);
    } catch (err) {
      console.error(err);
      notify("Download Failed", "Failed to compile document.", "error");
    }
  };

  const computerInputRef = React.useRef<HTMLInputElement>(null);
  const mobilePhotoInputRef = React.useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = React.useRef<HTMLInputElement>(null);

  const handleQuickMemo = () => {
    const memoText = prompt("Type or paste your quick note:");
    if (!memoText || !memoText.trim()) return;

    const fileName = `Memo_${new Date().toISOString().slice(0,10)}_${Math.random().toString(36).substr(2,4)}.txt`;
    const baseFile: VaultFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: fileName,
      type: 'text/plain',
      size: memoText.length,
      lastModified: Date.now(),
      category: 'Notes',
      suggestedPath: 'Notes/Memos',
      isOrganized: true,
      content: memoText
    };

    setFiles(prev => [baseFile, ...prev]);
    notify("Memo Saved", `"${fileName}" saved under Notes!`, "success");
    addLog(`MEMO: Saved instant memo into Notes.`);
  };
  
  // Theme State
  const [mood, setMood] = useState<'default' | 'vogue' | 'cyber'>('default');
  
  const themes = {
    default: {
      bg: 'bg-[#F0F0EE]',
      sidebar: 'bg-white',
      border: 'border-[#141414]',
      text: 'text-[#141414]',
      accent: 'bg-[#141414]',
      accentText: 'text-white',
      highlight: 'bg-emerald-500',
      secondary: 'bg-gray-100',
      muted: 'opacity-40'
    },
    vogue: { // Modern Girl Style
      bg: 'bg-[#FFF1F2]',
      sidebar: 'bg-white',
      border: 'border-[#9F1239]',
      text: 'text-[#881337]',
      accent: 'bg-[#FB7185]',
      accentText: 'text-white',
      highlight: 'bg-[#BE123D]',
      secondary: 'bg-[#FFE4E6]',
      muted: 'opacity-50'
    },
    cyber: { // Modern Boy Style
      bg: 'bg-[#F0F9FF]',
      sidebar: 'bg-white',
      border: 'border-[#0369A1]',
      text: 'text-[#075985]',
      accent: 'bg-[#38BDF8]',
      accentText: 'text-white',
      highlight: 'bg-[#0EA5E9]',
      secondary: 'bg-[#E0F2FE]',
      muted: 'opacity-50'
    }
  };

  const t = themes[mood];

  // Security State
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [masterPin, setMasterPin] = useState(() => localStorage.getItem('vault_pin') || "2026");
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPinInput, setNewPinInput] = useState("");
  
  // Sorting State
  const [sortLayers, setSortLayers] = useState<{field: 'name' | 'lastModified' | 'size' | 'type' | 'category', order: 'asc' | 'desc'}[]>([
    { field: 'lastModified', order: 'desc' }
  ]);
  
  // Custom Folders State
  const [folders, setFolders] = useState<Folder[]>([
    { id: 'f1', name: 'Invoices', path: 'Work/Invoices', category: 'Work', fileCount: 0 },
    { id: 'f2', name: 'Trips', path: 'Personal/Trips', category: 'Personal', fileCount: 0 },
  ]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCategory, setNewFolderCategory] = useState<FileCategory>('Work');
  const [newFolderPath, setNewFolderPath] = useState('');

  // Sync path when category or name changes
  useEffect(() => {
    if (isCreatingFolder) {
      setNewFolderPath(`${newFolderCategory}/${newFolderName.trim().replace(/\s+/g, '-') || 'Untitled'}`);
    }
  }, [newFolderName, newFolderCategory, isCreatingFolder]);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin === masterPin) {
      setTimeout(() => {
        setIsLocked(false);
        setPin("");
        notify("Access Granted", "Welcome back, Operator.", "success");
      }, 300);
    } else if (newPin.length === 4) {
      setTimeout(() => {
        setPin("");
        notify("Access Denied", "Incorrect PIN code.", "error");
      }, 500);
    }
  };

  const updateMasterPin = () => {
    if (newPinInput.length !== 4) return;
    localStorage.setItem('vault_pin', newPinInput);
    setMasterPin(newPinInput);
    setIsSettingPin(false);
    setNewPinInput("");
    notify("Security Updated", "Your custom access PIN has been saved.", "success");
  };

  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [logs, setLogs] = useState<{msg: string, time: string}[]>([]);
  const [cloudServices, setCloudServices] = useState<{id: string, name: string, active: boolean}[]>([
    { id: 'gdrive', name: 'Google Drive', active: false },
    { id: 'dropbox', name: 'Dropbox', active: false }
  ]);

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifSettings, setNotifSettings] = useState({
    categorization: true,
    cloudSync: true,
    duplicates: true
  });
  const [notifColors, setNotifColors] = useState({
    info: { bg: '#DBEAFE', text: '#1E40AF' },
    success: { bg: '#D1FAE5', text: '#065F46' },
    warning: { bg: '#FEF3C7', text: '#92400E' },
    error: { bg: '#FEE2E2', text: '#991B1B' }
  });

  const [folderSuggestions, setFolderSuggestions] = useState<FolderSuggestion[]>([]);
  const [isAnalyzingPatterns, setIsAnalyzingPatterns] = useState(false);

  const notify = (title: string, message: string, type: AppNotification['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotif: AppNotification = { id, title, message, type, timestamp: Date.now() };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const addLog = (msg: string) => {
    setLogs(prev => [{ msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  const importStoreItem = (item: StoreItem) => {
    if (files.some(f => f.name === item.name)) {
      notify("Already Added", `"${item.name}" is already in your local storage.`, "warning");
      return;
    }

    const newFile: VaultFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: item.name,
      type: item.type,
      size: item.size,
      lastModified: Date.now(),
      category: item.category,
      suggestedPath: item.suggestedPath,
      isOrganized: true,
      content: item.content,
      thumbnail: item.thumbnail
    };

    setFiles(prev => [newFile, ...prev]);
    notify("Item Saved", `Successfully imported "${item.name}" to ${item.suggestedPath}!`, "success");
    addLog(`STORE: Imported template "${item.name}" into ${item.category}.`);
  };

  const saveToPhotosAlbum = async (item: StoreItem | VaultFile) => {
    const isImage = item.type.startsWith('image/') || 
                    item.name.toLowerCase().endsWith('.jpg') || 
                    item.name.toLowerCase().endsWith('.png') || 
                    item.name.toLowerCase().endsWith('.jpeg');
    if (!isImage) {
      notify("Incompatible File", "This file type cannot be saved to Photos. Please select an image asset.", "warning");
      return;
    }

    const imageUrl = (item as any).thumbnail || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
    addLog(`Photos Album: Preparing "${item.name}"...`);

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], item.name, { type: blob.type });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: item.name,
          text: `Save this photo to your device roll`
        });
        addLog("NATIVE SHARE: Dispatched photo export to device gallery.");
        notify("Photo Saved", "Opened device sharing/saving roll successfully!", "success");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        notify("Photo Saved", `"${item.name}" download started!`, "success");
        addLog(`DOWNLOAD: Saved "${item.name}" to your local photos folder.`);
      }
    } catch (e) {
      console.warn("Direct blob share failed or was blocked. Triggering fallback download link.", e);
      const link = document.createElement('a');
      link.href = imageUrl;
      link.target = "_blank";
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      notify("Photo Exported", "Opened in a new tab. Please press & hold or right-click to Save to Photos.", "info");
    }

    setSelectedStoreItem(item);
  };

  const runFolderSuggestionAI = async () => {
    if (files.length === 0 || folders.length === 0) {
      setFolderSuggestions([]);
      return;
    }
    setIsAnalyzingPatterns(true);
    addLog("AI Pattern Recognition Scanning...");
    try {
      const suggestions = await suggestFolderMoves(files, folders);
      setFolderSuggestions(suggestions);
      if (suggestions.length > 0) {
        notify("AI Suggestions Found", `Pattern analyzer found ${suggestions.length} custom folder matches!`, "success");
        addLog(`AI: Detected ${suggestions.length} smart organization opportunities.`);
      } else {
        notify("Scan Complete", "No new naming pattern matches found for custom folders.", "info");
        addLog("AI: Scan complete, no new suggestions.");
      }
    } catch (err) {
      console.error("Pattern analysis error:", err);
      notify("AI Scan Failed", "Pattern analyzer failed to execute.", "error");
    } finally {
      setIsAnalyzingPatterns(false);
    }
  };

  const acceptSuggestion = (fileId: string, targetFolder: Folder) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          category: targetFolder.category,
          suggestedPath: targetFolder.path,
          isOrganized: true
        };
      }
      return f;
    }));
    setFolderSuggestions(prev => prev.filter(s => s.fileId !== fileId));
    notify("File Organized", `"${files.find(f => f.id === fileId)?.name}" moved to "${targetFolder.name}"`, "success");
    addLog(`AI MOVE: Organised file into custom folder "${targetFolder.name}"`);
  };

  const acceptAllSuggestions = () => {
    if (folderSuggestions.length === 0) return;
    setFiles(prev => prev.map(f => {
      const sug = folderSuggestions.find(s => s.fileId === f.id);
      if (sug) {
        const folder = folders.find(fold => fold.id === sug.folderId);
        if (folder) {
          return {
            ...f,
            category: folder.category,
            suggestedPath: folder.path,
            isOrganized: true
          };
        }
      }
      return f;
    }));
    notify("Folders Organized", `Bulk-organized ${folderSuggestions.length} files based on AI patterns!`, "success");
    addLog(`AI BULK-MOVE: Organized ${folderSuggestions.length} files successfully.`);
    setFolderSuggestions([]);
  };

  const dismissSuggestion = (fileId: string) => {
    setFolderSuggestions(prev => prev.filter(s => s.fileId !== fileId));
    addLog("AI Suggestion Dismissed.");
  };

  // Automatically scan for folder moves in background when files or custom folders update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (files.length > 0 && folders.length > 0) {
        suggestFolderMoves(files, folders)
          .then(suggestions => {
            setFolderSuggestions(suggestions);
          })
          .catch(err => console.error("Error in automatic pattern check:", err));
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [files.length, folders.length]);

  useEffect(() => {
    let interval: any;
    if (isAutoSyncing) {
      addLog("Initializing Autonomous Scanning Engine...");
      addLog("Watching for new downloads & paperwork...");
      
      interval = setInterval(() => {
        const shouldFindFile = Math.random() > 0.7; // 30% chance every 10s to "find" a file
        if (shouldFindFile) {
          const mockPaperwork = [
            { name: "Invoice_April_2026.pdf", type: "application/pdf", size: 45200, content: "Invoice for childcare/daycare materials. Amount: $120.00." },
            { name: "Legal_Agreement_Draft.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 124000 },
            { name: "Daycare_Lunch_Menu_Weekly.jpg", type: "image/jpeg", size: 852000, content: "Bright Horizons childcare weekly lunch menu and meal schedules for Emily. Lunch: baby carrots." },
            { name: "Screenshot_Chase_Bank_Statement_June.png", type: "image/png", size: 412000, content: "Chase Bank Checking Account Screen Capture. Account number ending in 1121. Total available balance: $4,850.12." },
            { name: "Screenshot_Daycare_Emily_Updates.png", type: "image/png", size: 385000, content: "Childcare mobile app screen capture. Emily slept for 1.5 hours today. Diaper change at 12:30 PM." }
          ];
          const found = mockPaperwork[Math.floor(Math.random() * mockPaperwork.length)];
          const newId = Math.random().toString(36).substr(2, 9);
          
          addLog(`NEW DETECTION: ${found.name}`);
          
          const newFile: VaultFile = {
            id: newId,
            name: found.name,
            type: found.type,
            size: found.size,
            lastModified: Date.now(),
            category: 'Uncategorized',
            suggestedPath: 'Analyzing...',
            isOrganized: false,
            content: found.content
          };

          setFiles(prev => [newFile, ...prev]);
          
          // Instant AI processing simulation
          setTimeout(async () => {
             const result = await categorizeFile(found.name, found.type, found.content);
             setFiles(prev => prev.map(f => f.id === newId ? {
               ...f,
               category: result.category,
               suggestedPath: result.suggestedPath,
               isOrganized: true
             } : f));
             notify("Paperwork Secured", `"${found.name}" archived in ${result.suggestedPath}`, "success");
             addLog(`SECURED: Archived to ${result.suggestedPath}`);
          }, 1500);
        } else {
          addLog(`Scanning recursive directories... No new files detected.`);
        }
      }, 10000);
    } else {
      if (logs.length > 0) addLog("Scanning Engine Paused.");
    }
    return () => clearInterval(interval);
  }, [isAutoSyncing, notifSettings.categorization]);

  const toggleAutoSync = () => {
    setIsAutoSyncing(!isAutoSyncing);
    if (!isAutoSyncing) {
      addLog("Requesting Storage permissions...");
      if (notifSettings.duplicates) {
        setTimeout(() => notify("Scan Complete", "No duplicate files found in 1.2s", "success"), 2000);
      }
    }
  };

  // Auto-sort sample files on initial load for demo
  useEffect(() => {
    const sampleFiles: VaultFile[] = [
      { 
        id: '1', 
        name: 'Q4_Report.pdf', 
        type: 'application/pdf', 
        size: 2400000, 
        lastModified: Date.now() - 10000000, 
        category: 'Work', 
        suggestedPath: 'Work/Reports', 
        isOrganized: true 
      },
      { 
        id: '2', 
        name: 'Family_Dinner.jpg', 
        type: 'image/jpeg', 
        size: 1200000, 
        lastModified: Date.now() - 20000000, 
        category: 'Personal', 
        suggestedPath: 'Personal/Photos', 
        isOrganized: true,
        thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'
      },
      { 
        id: '3', 
        name: 'Screenshot_Chase_Checking_June.png', 
        type: 'image/png', 
        size: 640000, 
        lastModified: Date.now() - 30000000, 
        category: 'Financial', 
        suggestedPath: 'Financial/Bank Statements', 
        isOrganized: true,
        thumbnail: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
        content: 'Chase checking statement screen grab. Available balance $5,240.50. Credit card payment auto-deduction: -$250.00. Salary deposit: +$3,200.00. Safe & secure checksum verified.'
      },
      { 
        id: '4', 
        name: 'Screenshot_Daycare_Emily_Updates.png', 
        type: 'image/png', 
        size: 520000, 
        lastModified: Date.now() - 40000000, 
        category: 'Personal', 
        suggestedPath: 'Personal/Daycare', 
        isOrganized: true,
        thumbnail: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=800&q=80',
        content: 'Bright Horizons Childcare updates for Emily. Rest time: 1:15 PM - 2:45 PM. Meals: Ate all turkey pasta and green peas. Fun activity: Finger painting outdoor scenery.'
      },
      { 
        id: '5', 
        name: 'Emily_Daycare_Art_Project.jpg', 
        type: 'image/jpeg', 
        size: 1450000, 
        lastModified: Date.now() - 50000000, 
        category: 'Personal', 
        suggestedPath: 'Personal/Daycare/Emily', 
        isOrganized: true,
        thumbnail: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80',
        content: 'Photo of watercolor art painting created by Emily at daycare today. Beautiful abstract colorful brush strokes.'
      },
      { 
        id: '6', 
        name: 'Facebook_Lite.apk', 
        type: 'application/vnd.android.package-archive', 
        size: 55000000, 
        lastModified: Date.now() - 60000000, 
        category: 'Apps', 
        suggestedPath: 'Apps/Facebook', 
        isOrganized: true 
      }
    ];
    setFiles(sampleFiles);
  }, []);

  // Initialize Google Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setDriveUser(user);
        setDriveToken(token);
        // Automatically sync cloud services toggle
        setCloudServices(prev => prev.map(s => s.id === 'gdrive' ? { ...s, active: true } : s));
      },
      () => {
        setDriveUser(null);
        setDriveToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Google Drive Files whenever token, filter or search query changes
  const fetchDriveFiles = useCallback(async () => {
    if (!driveToken) return;
    setIsDriveLoading(true);
    try {
      const filesList = await listGoogleDriveFiles(driveToken, driveFilter, driveSearch);
      setDriveFiles(filesList);
    } catch (err) {
      console.error('Failed to retrieve Google Drive files:', err);
      notify('Drive Error', 'Failed to retrieve files list from your Google Drive.', 'error');
    } finally {
      setIsDriveLoading(false);
    }
  }, [driveToken, driveFilter, driveSearch]);

  useEffect(() => {
    if (driveToken && isDriveModalOpen) {
      fetchDriveFiles();
    }
  }, [driveToken, driveFilter, driveSearch, isDriveModalOpen, fetchDriveFiles]);

  const handleDriveLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setDriveUser(res.user);
        setDriveToken(res.accessToken);
        setCloudServices(prev => prev.map(s => s.id === 'gdrive' ? { ...s, active: true } : s));
        notify('Connected to Google Drive', `Signed in as ${res.user.email}. Ready for secure imports!`, 'success');
        addLog(`AUTH: Connected Google Drive account (${res.user.email}).`);
      }
    } catch (err) {
      console.error('Login failed', err);
      notify('Sign-In Failed', 'Unable to complete Google Drive sign-in.', 'error');
    }
  };

  const handleDriveLogout = async () => {
    try {
      await logoutGoogle();
      setDriveUser(null);
      setDriveToken(null);
      setCloudServices(prev => prev.map(s => s.id === 'gdrive' ? { ...s, active: false } : s));
      setDriveFiles([]);
      notify('Disconnected', 'Disconnected Google Drive successfully.', 'success');
      addLog('AUTH: Disconnected Google Drive.');
    } catch (err) {
      console.error('Logout failed', err);
      notify('Logout Failed', 'An error occurred during logout.', 'error');
    }
  };

  const importFromGoogleDrive = async (driveFile: GoogleDriveFile) => {
    if (!driveToken) {
      notify("Authentication Required", "Please sign in to Google Drive first.", "warning");
      return;
    }

    setIsDriveProcessing(prev => ({ ...prev, [driveFile.id]: true }));
    notify("Intaking File", `Downloading and analyzing "${driveFile.name}"...`, "info");

    try {
      let content: string | undefined = undefined;
      
      // If text file, download plain text for better categorizing
      if (driveFile.mimeType.startsWith('text/') || driveFile.name.endsWith('.txt') || driveFile.name.endsWith('.md')) {
        const blob = await getDriveFileContent(driveToken, driveFile.id);
        content = await blob.text();
      } else if (driveFile.mimeType === 'application/vnd.google-apps.document') {
        content = `Google Docs document: "${driveFile.name}".`;
      } else if (driveFile.mimeType.startsWith('image/')) {
        content = `Photo: "${driveFile.name}". Contains phone screenshots, daycare details, or bank statement logs.`;
      }

      // Check if file is daycare or statement related for richer mock details
      if (driveFile.name.toLowerCase().includes('daycare') || driveFile.name.toLowerCase().includes('childcare')) {
        content = `Daycare photo statement Emily updates: rest time, watercolor painting, lunch snacks.`;
      } else if (driveFile.name.toLowerCase().includes('statement') || driveFile.name.toLowerCase().includes('bank') || driveFile.name.toLowerCase().includes('chase') || driveFile.name.toLowerCase().includes('receipt')) {
        content = `Financial statement log check ledger amount verification. Balance record.`;
      }

      const baseFile: VaultFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: driveFile.name,
        type: driveFile.mimeType || 'application/octet-stream',
        size: driveFile.size ? parseInt(driveFile.size) : 102400,
        lastModified: driveFile.createdTime ? new Date(driveFile.createdTime).getTime() : Date.now(),
        category: 'Uncategorized',
        suggestedPath: 'Analyzing...',
        isOrganized: false,
        content,
        thumbnail: driveFile.thumbnailLink || (driveFile.mimeType.startsWith('image/') ? 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=800&q=80' : undefined)
      };

      setFiles(prev => [baseFile, ...prev]);

      // Trigger AI Categorization
      try {
        const result = await categorizeFile(driveFile.name, driveFile.mimeType, content);
        setFiles(prev => prev.map(f => f.id === baseFile.id ? {
          ...f,
          category: result.category,
          suggestedPath: result.suggestedPath,
          isOrganized: true
        } : f));

        if (notifSettings.categorization) {
          notify("Cloud Intake Succeeded", `Successfully imported "${driveFile.name}" into ${result.category}/${result.suggestedPath}.`, "success");
        }
        addLog(`CLOUD INTAKE: Imported "${driveFile.name}" from Google Drive into ${result.category}/${result.suggestedPath}.`);
      } catch (err) {
        console.error("Failed to categorize imported file", err);
        // Fallback categorization if Gemini service rate limits or fails
        setFiles(prev => prev.map(f => f.id === baseFile.id ? {
          ...f,
          category: driveFile.mimeType.startsWith('image/') ? 'Personal' : 'Work',
          suggestedPath: driveFile.mimeType.startsWith('image/') ? 'Personal/Daycare' : 'Work/Documents',
          isOrganized: true
        } : f));
        notify("Intake Succeeded (Fallback)", `Imported "${driveFile.name}" to appropriate categories.`, "info");
      }
    } catch (err) {
      console.error("Failed importing from Google Drive", err);
      notify("Intake Failed", `Unable to import "${driveFile.name}".`, "error");
    } finally {
      setIsDriveProcessing(prev => ({ ...prev, [driveFile.id]: false }));
    }
  };

  const bulkExportToDrive = async () => {
    if (!driveToken) {
      notify("Authentication Required", "Please sign in to Google Drive first.", "warning");
      setIsDriveModalOpen(true);
      return;
    }

    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Export ${selectedIds.size} file(s) to your Google Drive? This will create organized folder hierarchies matching your local structure.`
    );
    if (!confirmed) return;

    setIsExportingToDrive(true);
    notify("Exporting Files", `Preparing Google Drive folder structure...`, "info");

    try {
      let successCount = 0;
      const selectedFiles = files.filter(f => selectedIds.has(f.id));

      for (const file of selectedFiles) {
        const path = file.suggestedPath || 'Unsorted';
        const content = file.content || 'Binary File Capsule';
        const mimeType = file.type || 'text/plain';

        await uploadFileToDrive(driveToken, file.name, mimeType, content, path);
        successCount++;
      }

      notify("Cloud Backup Successful", `Successfully exported ${successCount} files into structured Google Drive folders.`, "success");
      addLog(`EXPORT: Backup up ${successCount} files to Google Drive.`);
      clearSelection();
    } catch (err) {
      console.error("Bulk export failed", err);
      notify("Export Failed", "An error occurred while backing up files to Google Drive.", "error");
    } finally {
      setIsExportingToDrive(false);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    setIsProcessing(true);

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      // Read content for text/notes categorization
      let content: string | undefined = undefined;
      if (file.type.includes('text')) {
        content = await file.text();
      }

      const baseFile: VaultFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type || (file.name.endsWith('.apk') || file.name.endsWith('.abb') ? 'application/vnd.android.package-archive' : 'application/octet-stream'),
        size: file.size,
        lastModified: file.lastModified,
        category: 'Uncategorized',
        suggestedPath: 'Analyzing...',
        isOrganized: false,
        content
      };

      setFiles(prev => [baseFile, ...prev]);

      // Trigger AI Categorization
      try {
        const result = await categorizeFile(file.name, file.type, content);
        setFiles(prev => prev.map(f => f.id === baseFile.id ? {
          ...f,
          category: result.category,
          suggestedPath: result.suggestedPath,
          isOrganized: true
        } : f));

        if (notifSettings.categorization) {
          notify("File Categorized", `"${file.name}" moved to ${result.category}`, "success");
        }
      } catch (err) {
        console.error("Failed to categorize", err);
      }
    }
    setIsProcessing(false);
  };

  const toggleSelection = (id: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const shareFile = async (file: VaultFile) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: file.name,
          text: `File from autonize: ${file.suggestedPath}`,
          url: window.location.href, // In a real app, this would be a direct file link
        });
      } catch (err) {
        console.log('Share failed', err);
      }
    } else {
      // Fallback: Download
      const link = document.createElement('a');
      link.href = '#'; // Simulated
      link.download = file.name;
      link.click();
    }
  };

  const copyNote = (content?: string) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    addLog("Note content copied to clipboard.");
  };

  const createFolder = () => {
    if (!newFolderName.trim() || !newFolderPath.trim()) return;
    const newFolder: Folder = {
      id: Math.random().toString(36).substr(2, 9),
      name: newFolderName,
      path: newFolderPath,
      category: newFolderCategory,
      fileCount: 0
    };
    setFolders(prev => [...prev, newFolder]);
    setNewFolderName('');
    setNewFolderPath('');
    setIsCreatingFolder(false);
    notify("Folder Created", `"${newFolderName}" is now active in ${newFolderCategory}.`, "success");
  };

  const bulkMove = (category: FileCategory, folderPath?: string) => {
    const targetPath = folderPath || `${category}/Unsorted`;
    setFiles(prev => prev.map(f => 
      selectedIds.has(f.id) ? { ...f, category, isOrganized: true, suggestedPath: targetPath } : f
    ));
    clearSelection();
  };

  const bulkDelete = () => {
    setFiles(prev => prev.filter(f => !selectedIds.has(f.id)));
    clearSelection();
    setIsDeleting(false);
  };

  const bulkDownload = async () => {
    const zip = new JSZip();
    const selectedFiles = files.filter(f => selectedIds.has(f.id));
    
    if (selectedFiles.length === 0) return;
    
    selectedFiles.forEach(file => {
      // Create a structured path in the ZIP
      const folderPath = file.suggestedPath.split('/');
      let currentFolder: JSZip | null = zip;
      
      folderPath.slice(0, -1).forEach(p => {
        if (currentFolder) currentFolder = currentFolder.folder(p);
      });

      if (currentFolder) {
        const content = file.content || `autonize Simulated File Content\nName: ${file.name}\nSize: ${formatBytes(file.size)}\nType: ${file.type}\nOrganized Path: ${file.suggestedPath}`;
        currentFolder.file(file.name, content);
      }
    });

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `autonize_Archive_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`);
      notify("Download Started", `Creating structured archive for ${selectedFiles.length} files.`, "success");
      clearSelection();
    } catch (error) {
      console.error("ZIP Generation failed", error);
      notify("Download Failed", "Could not generate archive.", "error");
    }
  };

  // Storage Usage Calculations
  const categorySizes = CATEGORIES.reduce((acc, cat) => {
    const totalSize = files
      .filter(f => f.category === cat.id)
      .reduce((sum, f) => sum + (f.size || 0), 0);
    acc[cat.id] = totalSize;
    return acc;
  }, {} as Record<FileCategory, number>);

  const uncategorizedSize = files
    .filter(f => !f.category || f.category === 'Uncategorized')
    .reduce((sum, f) => sum + (f.size || 0), 0);

  const totalStorageUsed = Object.values(categorySizes).reduce((sum, size) => sum + size, 0) + uncategorizedSize;
  const TOTAL_CAPACITY = 100 * 1024 * 1024; // 100 MB

  const filteredFiles = files.filter(f => {
    const lowerQuery = searchQuery.toLowerCase();
    
    // Privacy Logic: Hide Personal/Apps files if locked
    if (isLocked && (f.category === 'Personal' || f.category === 'Apps')) return false;

    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch = 
      f.name.toLowerCase().includes(lowerQuery) || 
      f.suggestedPath.toLowerCase().includes(lowerQuery) ||
      (f.content && f.content.toLowerCase().includes(lowerQuery));
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    for (const layer of sortLayers) {
      const factor = layer.order === 'asc' ? 1 : -1;
      let comparison = 0;
      
      const valA = a[layer.field as keyof VaultFile];
      const valB = b[layer.field as keyof VaultFile];

      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      }
      
      if (comparison !== 0) return comparison * factor;
    }
    return 0;
  });

  return (
    <div className={cn("flex h-screen font-sans selection:bg-[#141414] selection:text-white transition-colors duration-500", t.bg, t.text)}>
      <AnimatePresence>
        {isLocked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn("fixed inset-0 z-[300] text-white flex flex-col items-center justify-center p-6", mood === 'default' ? 'bg-[#141414]' : mood === 'vogue' ? 'bg-[#4C0519]' : 'bg-[#082F49]')}
          >
            <div className="max-w-xs w-full text-center">
              <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 border transition-all duration-700", mood === 'vogue' ? 'bg-rose-400/20 border-rose-400' : mood === 'cyber' ? 'bg-sky-400/20 border-sky-400' : 'bg-white/5 border-white/10')}>
                <Lock className={cn("w-8 h-8", mood === 'vogue' ? 'text-rose-400' : mood === 'cyber' ? 'text-sky-400' : 'text-white')} />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Access Locked</h2>
              <p className="text-[10px] font-mono uppercase opacity-40 mb-12 tracking-[0.3em]">
                {mood === 'vogue' ? 'Elegance & Isolation' : mood === 'cyber' ? 'Biometric Decryption' : 'Identity Verification'} Required
              </p>
              
              <div className="flex justify-center gap-4 mb-12">
                {[0, 1, 2, 3].map((i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-4 h-4 rounded-full border-2 border-white/20 transition-all duration-300",
                      pin.length > i ? "bg-white border-white scale-110" : ""
                    )} 
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-6">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "C"].map((key, i) => {
                  if (key === "") return <div key={`spacer-${i}`} />;
                  return (
                    <button
                      key={key}
                      onClick={() => key === "C" ? setPin("") : handlePinInput(key)}
                      className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold hover:bg-white/10 active:bg-white/20 transition-all border border-transparent hover:border-white/10"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-12 text-[9px] font-mono opacity-20 uppercase tracking-widest">
                Protected by autonize AES-256
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Precision Grid Style */}
      <aside className={cn("w-72 border-r flex flex-col", t.sidebar, t.border)}>
        <div className={cn("p-8 border-b mb-4", t.border)}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 flex items-center justify-center rounded-sm", t.accent)}>
                <CpuIcon className={cn("w-5 h-5", t.accentText)} />
              </div>
              <h1 className="text-xl font-bold tracking-tight uppercase">autonize</h1>
            </div>
            <button 
              onClick={() => setIsLocked(true)}
              className={cn("p-2 rounded-sm transition-colors", t.secondary, mood === 'vogue' ? 'text-rose-600' : 'text-red-500')}
              title="Lock System"
            >
              <Unlock className="w-4 h-4" />
            </button>
          </div>
          <p className={cn("text-[10px] uppercase tracking-[0.2em] font-mono", t.muted)}>Autonomous Archiving System</p>
        </div>

        {/* Navigation Tabs (Storage vs Smart Store) */}
        <div className="px-4 mb-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setActiveView('files'); setSelectedCategory('All'); }}
            className={cn(
              "py-2.5 rounded-sm text-[9px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1 border cursor-pointer",
              activeView === 'files' 
                ? cn("bg-[#141414] text-white", mood === 'vogue' ? 'border-rose-600 bg-rose-500' : mood === 'cyber' ? 'border-sky-600 bg-sky-500' : 'border-[#141414]')
                : "bg-transparent text-gray-500 hover:bg-gray-100 border-transparent"
            )}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            Storage
          </button>
          <button
            onClick={() => setActiveView('store')}
            className={cn(
              "py-2.5 rounded-sm text-[9px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1 border cursor-pointer",
              activeView === 'store'
                ? cn("bg-[#141414] text-white", mood === 'vogue' ? 'border-rose-600 bg-rose-500' : mood === 'cyber' ? 'border-sky-600 bg-sky-500' : 'border-[#141414]')
                : "bg-transparent text-gray-500 hover:bg-gray-100 border-transparent"
            )}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Smart Store
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <div className="mb-8 px-4">
            <button 
              onClick={toggleAutoSync}
              className={cn(
                "w-full py-4 rounded-sm text-[10px] font-black tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3",
                isAutoSyncing 
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" 
                  : "bg-[#141414] text-white hover:bg-black/90"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", isAutoSyncing ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
              {isAutoSyncing ? "Engine: Running" : "Start Auto-Sync"}
            </button>
            {isAutoSyncing && (
              <div className="mt-4 bg-[#f9f9f7] border border-[#141414]/10 p-3 rounded-sm">
                <p className="text-[9px] font-mono uppercase opacity-40 mb-2">Live Activity Log</p>
                <div className="space-y-1.5">
                  {logs.map((log, i) => (
                    <div key={i} className="text-[8px] font-mono flex justify-between leading-tight">
                      <span className="opacity-60">{log.msg}</span>
                      <span className="opacity-30">{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => setSelectedCategory('All')}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all group",
              selectedCategory === 'All' ? "bg-[#141414] text-white" : "hover:bg-gray-100"
            )}
          >
            <div className="flex items-center gap-3">
              <FolderIcon className="w-4 h-4" />
              <span>All Files</span>
            </div>
            <span className="font-mono text-[10px] opacity-50 group-hover:opacity-100">{files.length}</span>
          </button>

          {/* Quick Access Recents */}
          <div className="my-6 px-4">
            <p className={cn("mb-2 text-[10px] uppercase tracking-[0.2em] font-mono", t.muted)}>Quick Access Recents</p>
            <div className="space-y-1">
              {files.slice(0, 3).map(file => (
                <button
                  key={file.id}
                  onClick={() => {
                    setPreviewFile(file);
                    setEditFileName(file.name);
                    setEditFileCategory(file.category);
                    setEditFilePath(file.suggestedPath);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-sm text-[11px] transition-all border text-left cursor-pointer",
                    t.secondary,
                    t.border.replace('border-', 'border-opacity-10 border-'),
                    "hover:border-gray-400"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {file.type.includes('image') ? (
                      <ImageIcon className="text-orange-500 w-3.5 h-3.5 flex-shrink-0" />
                    ) : (file.name.endsWith('.apk') || file.name.endsWith('.abb')) ? (
                      <Smartphone className="text-purple-500 w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <FileIcon className="text-blue-500 w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <span className="truncate uppercase font-medium text-gray-700">{file.name}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 opacity-30 shrink-0" />
                </button>
              ))}
              {files.length === 0 && (
                <p className="text-[9px] font-mono opacity-30 uppercase tracking-wider text-center py-2">No recent files</p>
              )}
            </div>
          </div>

          {/* Storage Allocation Progress Bar & Chart Breakdown */}
          <div className="my-6 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className={cn("text-[10px] uppercase tracking-[0.2em] font-mono", t.muted)}>Storage Used</span>
              <span className="text-[10px] font-mono font-bold">
                {formatBytes(totalStorageUsed)} / {formatBytes(TOTAL_CAPACITY)}
              </span>
            </div>
            
            {/* Multi-segmented Progress Bar */}
            <div className={cn("w-full h-3 rounded-sm overflow-hidden flex border mb-3 p-0.5", t.secondary, t.border.replace('border-', 'border-opacity-10 border-'))}>
              {CATEGORIES.map(cat => {
                const size = categorySizes[cat.id] || 0;
                if (size === 0) return null;
                const percentage = (size / TOTAL_CAPACITY) * 100;
                
                const colorMap: Record<FileCategory, string> = {
                  Work: 'bg-blue-500',
                  Personal: 'bg-emerald-500',
                  Apps: 'bg-purple-500',
                  Media: 'bg-orange-500',
                  Notes: 'bg-amber-500',
                  Financial: 'bg-rose-500',
                  Uncategorized: 'bg-gray-400'
                };
                
                return (
                  <div 
                    key={cat.id} 
                    className={cn("h-full transition-all duration-500 first:rounded-l-sm last:rounded-r-sm", colorMap[cat.id])}
                    style={{ width: `${percentage}%` }}
                    title={`${cat.id}: ${formatBytes(size)} (${Math.round(percentage)}%)`}
                  />
                );
              })}
              {uncategorizedSize > 0 && (
                <div 
                  className="h-full transition-all duration-500 bg-gray-400 last:rounded-r-sm"
                  style={{ width: `${(uncategorizedSize / TOTAL_CAPACITY) * 100}%` }}
                  title={`Uncategorized: ${formatBytes(uncategorizedSize)}`}
                />
              )}
            </div>

            {/* Storage Breakdown Chart Legend */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {[
                ...CATEGORIES.map(cat => ({
                  id: cat.id,
                  name: cat.id,
                  size: categorySizes[cat.id] || 0,
                  colorClass: {
                    Work: 'bg-blue-500',
                    Personal: 'bg-emerald-500',
                    Apps: 'bg-purple-500',
                    Media: 'bg-orange-500',
                    Notes: 'bg-amber-500',
                    Financial: 'bg-rose-500',
                    Uncategorized: 'bg-gray-400'
                  }[cat.id]
                })),
                ...(uncategorizedSize > 0 ? [{
                  id: 'Uncategorized',
                  name: 'Uncategorized',
                  size: uncategorizedSize,
                  colorClass: 'bg-gray-400'
                }] : [])
              ]
              .filter(item => item.size > 0)
              .sort((a, b) => b.size - a.size)
              .map(item => {
                const percentage = Math.round((item.size / TOTAL_CAPACITY) * 100);
                return (
                  <div 
                    key={item.id} 
                    onClick={() => {
                      if (item.id !== 'Uncategorized') {
                        setSelectedCategory(item.id as FileCategory);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 text-[10px] font-mono leading-none p-2 rounded-sm border cursor-pointer hover:opacity-80 transition-all", 
                      t.secondary, 
                      t.border.replace('border-', 'border-opacity-10 border-')
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full shrink-0", item.colorClass)} />
                    <span className="flex-1 truncate uppercase tracking-wider opacity-85 font-medium">{item.name}</span>
                    <span className="font-bold shrink-0">{formatBytes(item.size)}</span>
                    <span className="opacity-40 text-[8px] shrink-0 font-light">({percentage}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="my-6">
            <p className={cn("px-4 mb-3 text-[10px] uppercase tracking-[0.2em] font-mono", t.muted)}>Visual Mood</p>
            <div className="px-4 flex gap-2">
              {[
                { id: 'default', label: 'Pro', color: 'bg-[#141414]' },
                { id: 'vogue', label: 'Vogue', color: 'bg-rose-400' },
                { id: 'cyber', label: 'Cyber', color: 'bg-sky-400' }
              ].map(skin => (
                <button
                  key={skin.id}
                  onClick={() => setMood(skin.id as any)}
                  className={cn(
                    "flex-1 py-2 text-[8px] font-black uppercase tracking-widest transition-all border",
                    mood === skin.id ? t.border + " " + t.accent + " " + t.accentText : "border-transparent " + t.secondary + " opacity-50"
                  )}
                >
                  {skin.label}
                </button>
              ))}
            </div>
          </div>

          <div className="my-6">
            <p className={cn("px-4 mb-3 text-[10px] uppercase tracking-[0.2em] font-mono", t.muted)}>System Settings</p>
            
            {/* Cloud Controls */}
            <div className="mb-4">
              <p className="px-4 mb-2 text-[9px] font-mono uppercase opacity-30">Cloud Sync</p>
              {cloudServices.map(service => {
                const isActive = service.id === 'gdrive' ? !!driveToken : service.active;
                return (
                  <div key={service.id} className="px-4 py-2 flex flex-col group gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-tight opacity-70">{service.name}</span>
                        {service.id === 'gdrive' && driveUser && (
                          <span className="text-[8px] font-mono opacity-50 truncate max-w-[120px]">{driveUser.email}</span>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          if (service.id === 'gdrive') {
                            if (driveToken) {
                              handleDriveLogout();
                            } else {
                              handleDriveLogin();
                            }
                          } else {
                            setCloudServices(prev => prev.map(s => s.id === service.id ? { ...s, active: !s.active } : s));
                            if (notifSettings.cloudSync) notify("Sync Active", `${service.name} integration enabled.`, "info");
                          }
                        }}
                        className={cn(
                          "w-10 h-5 rounded-full transition-all relative border border-[#141414] shrink-0",
                          isActive ? "bg-emerald-500" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all text-white",
                          isActive ? "left-5.5" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notification Toggles */}
            <div className="mb-6">
              <p className="px-4 mb-2 text-[9px] font-mono uppercase opacity-30">Notifications</p>
              <div className="px-4 space-y-2">
                {[
                  { id: 'categorization', label: 'Organization' },
                  { id: 'cloudSync', label: 'Cloud Activity' },
                  { id: 'duplicates', label: 'Duplicate Alerts' }
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => setNotifSettings(prev => ({ ...prev, [item.id]: !prev[item.id as keyof typeof prev]}))}
                    className="w-full flex items-center justify-between group py-1"
                  >
                    <span className="text-[10px] uppercase tracking-wider font-medium opacity-60 group-hover:opacity-100 transition-opacity">
                      {item.label}
                    </span>
                    {notifSettings[item.id as keyof typeof notifSettings] ? (
                      <Bell className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <BellOff className="w-3 h-3 text-gray-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Appearance Customization */}
            <div className="mb-6">
              <p className="px-4 mb-3 text-[9px] font-mono uppercase opacity-30">Alert Themes</p>
              <div className="px-4 space-y-3">
                {(['success', 'info', 'error', 'warning'] as const).map(type => (
                  <div key={type} className="flex items-center justify-between group">
                    <span className="text-[9px] font-bold uppercase opacity-60 group-hover:opacity-100 transition-opacity">{type}</span>
                    <div className="flex gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <input 
                          type="color" 
                          value={notifColors[type].bg} 
                          onChange={(e) => setNotifColors(prev => ({ ...prev, [type]: { ...prev[type], bg: e.target.value } }))}
                          className="w-5 h-5 rounded-full border-none cursor-pointer overflow-hidden transition-transform hover:scale-110" 
                          title="Background"
                        />
                        <span className="text-[6px] uppercase opacity-40">BG</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <input 
                          type="color" 
                          value={notifColors[type].text} 
                          onChange={(e) => setNotifColors(prev => ({ ...prev, [type]: { ...prev[type], text: e.target.value } }))}
                          className="w-5 h-5 rounded-full border-none cursor-pointer overflow-hidden transition-transform hover:scale-110" 
                          title="Text"
                        />
                        <span className="text-[6px] uppercase opacity-40">TXT</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Control */}
            <div className={cn("px-4 border-t pt-4", t.border.replace('border-', 'border-opacity-10 border-'))}>
              <button 
                onClick={() => setIsSettingPin(true)}
                className={cn("w-full py-2 text-[8px] font-black tracking-widest uppercase hover:opacity-80 transition-all flex items-center justify-center gap-2", t.accent, t.accentText)}
              >
                <Key className="w-3 h-3" />
                Change Custom PIN
              </button>
            </div>
          </div>

          <div className="my-6">
            <div className="px-4 mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] font-mono opacity-40">Categories</p>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={runFolderSuggestionAI}
                  disabled={isAnalyzingPatterns}
                  className={cn("p-1.5 hover:bg-gray-100 rounded transition-colors group flex items-center justify-center disabled:opacity-50")}
                  title="Scan Naming Patterns with AI"
                >
                  <Sparkles className={cn("w-3.5 h-3.5 transition-all", isAnalyzingPatterns ? "text-indigo-500 animate-spin" : "text-indigo-400 group-hover:text-indigo-600 group-hover:scale-110")} />
                </button>
                <button 
                  onClick={() => setIsCreatingFolder(true)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors group"
                  title="Create custom folder"
                >
                  <Plus className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                </button>
              </div>
            </div>

            {CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <button
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all group",
                    selectedCategory === cat.id ? "bg-[#141414] text-white" : "hover:bg-gray-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <cat.icon className={cn("w-4 h-4", selectedCategory === cat.id ? "text-white" : cat.color)} />
                    <span>{cat.id}</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-50 group-hover:opacity-100">
                    {files.filter(f => f.category === cat.id).length}
                  </span>
                </button>
                
                {/* Sub-folders */}
                {folders.filter(f => f.category === cat.id).map(folder => (
                  <button
                    key={folder.id}
                    className="w-full flex items-center gap-3 pl-11 pr-4 py-2 text-[11px] opacity-60 hover:opacity-100 hover:bg-gray-50 transition-all border-l-2 border-transparent hover:border-[#141414]"
                  >
                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="flex-1 text-left truncate uppercase tracking-wider">{folder.name}</span>
                    <span className="font-mono text-[9px] opacity-50">
                      {files.filter(f => f.suggestedPath === folder.path).length}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>

        <div className="p-6 border-t border-[#141414]">
          {deferredPrompt && (
            <button 
              onClick={handleInstallClick}
              className="w-full mb-4 bg-emerald-600 text-white py-3 rounded-sm text-[10px] font-black tracking-[0.2em] uppercase hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              Download App
            </button>
          )}
          <div className="bg-[#f0f0f0] p-4 rounded-lg border border-dashed border-gray-400">
            <h4 className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              System Status
            </h4>
            <div className="flex items-center justify-between text-[11px] font-mono uppercase">
              <span>Gemini Pro</span>
              <span className="text-emerald-600">Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header Ribbon */}
        <header className={cn("h-16 border-b flex items-center justify-between px-8 backdrop-blur-sm sticky top-0 z-10 transition-colors", t.sidebar, t.border)}>
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <Search className="w-4 h-4 opacity-40" />
            <input 
              type="text" 
              placeholder="SEARCH FILES OR FOLDERS..." 
              className={cn("w-full bg-transparent border-none outline-none text-xs font-mono tracking-widest uppercase placeholder:opacity-30", t.text)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-6">
            <div className={cn("flex items-center gap-3 border-r pr-6", t.border.replace('border-', 'border-opacity-10 border-'))}>
              <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest leading-none">Sort layers:</span>
              <div className="flex items-center gap-2">
                {sortLayers.map((layer, idx) => (
                  <div key={idx} className={cn("flex items-center gap-1 px-2 py-1 rounded-sm border group/layer", t.secondary, t.border.replace('border-', 'border-opacity-10 border-'))}>
                    <span className="text-[9px] font-black uppercase tracking-tight">{layer.field}</span>
                    <button 
                      onClick={() => {
                        const newLayers = [...sortLayers];
                        newLayers[idx].order = newLayers[idx].order === 'asc' ? 'desc' : 'asc';
                        setSortLayers(newLayers);
                      }}
                      className="hover:scale-110 transition-transform"
                    >
                      {layer.order === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />}
                    </button>
                    {sortLayers.length > 1 && (
                      <button 
                        onClick={() => setSortLayers(prev => prev.filter((_, i) => i !== idx))}
                        className="opacity-0 group-hover/layer:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                {sortLayers.length < 3 && (
                  <select 
                    onChange={(e) => {
                      const field = e.target.value as any;
                      if (!sortLayers.find(l => l.field === field)) {
                        setSortLayers(prev => [...prev, { field, order: 'desc' }]);
                      }
                      e.target.value = "";
                    }}
                    value=""
                    className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm cursor-pointer hover:opacity-80 transition-all", t.accent, t.accentText)}
                  >
                    <option value="" disabled>+</option>
                    <option value="category">Category</option>
                    <option value="lastModified">Date</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                    <option value="type">Type</option>
                  </select>
                )}
              </div>
            </div>

            {selectedIds.size > 0 && (
              <button 
                onClick={clearSelection}
                className="text-[10px] font-bold tracking-widest uppercase opacity-50 hover:opacity-100 flex items-center gap-2"
              >
                <X className="w-3 h-3" />
                Clear Selection ({selectedIds.size})
              </button>
            )}
            <div className="relative">
              {/* Secret hidden native input elements targeting phone camera, photos, or computer files */}
              <input type="file" ref={computerInputRef} multiple className="hidden" onChange={handleFileUpload} />
              <input type="file" ref={mobilePhotoInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} />
              <input type="file" ref={mobileCameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />

              <button 
                onClick={() => setIsIntakeOpen(!isIntakeOpen)}
                className={cn("px-6 py-2.5 rounded-sm text-[10px] font-black tracking-widest uppercase hover:opacity-80 transition-colors flex items-center gap-2 cursor-pointer shadow-sm", t.accent, t.accentText)}
              >
                <Plus className="w-4 h-4" />
                Intake Files
              </button>

              <AnimatePresence>
                {isIntakeOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsIntakeOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 bg-white border border-[#141414] shadow-[8px_8px_0px_rgba(20,20,20,1)] p-4 z-50 rounded-sm"
                    >
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3 font-mono">Select Source Device</h4>
                      
                      <div className="space-y-1.5">
                        {/* Computer file selector */}
                        <button
                          onClick={() => {
                            setIsIntakeOpen(false);
                            computerInputRef.current?.click();
                          }}
                          className="w-full text-left p-3 hover:bg-gray-100 flex items-start gap-3 rounded-sm transition-all group cursor-pointer"
                        >
                          <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-900 group-hover:text-blue-600">Import from Computer</p>
                            <p className="text-[9px] font-mono opacity-50 uppercase mt-0.5">Desktop documents, apps & logs</p>
                          </div>
                        </button>

                        {/* Phone / Tablet Photos */}
                        <button
                          onClick={() => {
                            setIsIntakeOpen(false);
                            mobilePhotoInputRef.current?.click();
                          }}
                          className="w-full text-left p-3 hover:bg-gray-100 flex items-start gap-3 rounded-sm transition-all group cursor-pointer"
                        >
                          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-900 group-hover:text-emerald-600">Phone & Tablet Gallery</p>
                            <p className="text-[9px] font-mono opacity-50 uppercase mt-0.5">Camera roll photo library</p>
                          </div>
                        </button>

                         {/* Phone Camera roll (instant shutter) */}
                        <button
                          onClick={() => {
                            setIsIntakeOpen(false);
                            mobileCameraInputRef.current?.click();
                          }}
                          className="w-full text-left p-3 hover:bg-gray-100 flex items-start gap-3 rounded-sm transition-all group cursor-pointer"
                        >
                          <div className="p-1.5 bg-rose-50 text-rose-600 rounded">
                            <Camera className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-900 group-hover:text-rose-600">Snap Mobile Shutter</p>
                            <p className="text-[9px] font-mono opacity-50 uppercase mt-0.5">Direct camera scan</p>
                          </div>
                        </button>

                        {/* Google Drive Import Option */}
                        <button
                          onClick={() => {
                            setIsIntakeOpen(false);
                            setIsDriveModalOpen(true);
                          }}
                          className="w-full text-left p-3 hover:bg-gray-100 flex items-start gap-3 rounded-sm transition-all group cursor-pointer"
                        >
                          <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-900 group-hover:text-blue-600">Import from Google Drive</p>
                            <p className="text-[9px] font-mono opacity-50 uppercase mt-0.5">Browse & Autonize cloud files</p>
                          </div>
                        </button>

                        {/* Instant Quick note */}
                        <button
                          onClick={() => {
                            setIsIntakeOpen(false);
                            handleQuickMemo();
                          }}
                          className="w-full text-left p-3 hover:bg-gray-100 flex items-start gap-3 rounded-sm transition-all group cursor-pointer border-t border-dashed border-gray-100 mt-2"
                        >
                          <div className="p-1.5 bg-amber-50 text-amber-600 rounded">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-900 group-hover:text-amber-600">Paste Quick Note</p>
                            <p className="text-[9px] font-mono opacity-50 uppercase mt-0.5">Instant scratchpad clipboard</p>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-12">
          {activeView === 'store' ? (
            <div className="max-w-6xl mx-auto">
              <div className={cn("flex flex-col md:flex-row md:items-baseline justify-between mb-12 border-b pb-4 gap-4", t.border)}>
                <div className="flex items-center gap-4">
                  <h2 className="text-5xl font-black tracking-tighter uppercase">Smart Store</h2>
                  <div className={cn("px-3 py-1 rounded-full text-[10px] font-mono", t.accent, t.accentText)}>
                    {SMART_STORE_ITEMS.length} RESOURCES AVAILABLE
                  </div>
                </div>
                <p className={cn("font-mono text-[10px] uppercase tracking-widest leading-none", t.muted)}>
                  Curated paperwork, note templates & photos
                </p>
              </div>

              {/* Smart Store Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
                {SMART_STORE_ITEMS.map((item) => {
                  const isImage = item.type.startsWith('image/');
                  const isAdded = files.some(f => f.name === item.name);

                  return (
                    <div 
                      key={item.id}
                      className={cn(
                        "bg-white border p-6 flex flex-col h-full relative group transition-all duration-200",
                        t.border,
                        "hover:shadow-[8px_8px_0px_rgba(20,20,20,0.1)] shadow-gray-200"
                      )}
                    >
                      {/* Thumbnail Header */}
                      <div className="relative w-full h-40 bg-gray-50 border border-gray-100 rounded-sm mb-4 overflow-hidden flex items-center justify-center">
                        {isImage ? (
                          <img 
                            src={item.thumbnail} 
                            alt={item.name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className={cn("w-12 h-12 flex items-center justify-center rounded-sm", item.category === 'Financial' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600')}>
                              {item.category === 'Financial' ? <Receipt className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                            </div>
                            <span className="text-[10px] font-mono uppercase opacity-40">{item.type.split('/')[1] || 'PDF'} Template</span>
                          </div>
                        )}
                        
                        <div className="absolute top-2 right-2 bg-black/80 text-white font-mono text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                          {item.price}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col">
                        <h3 className="font-black text-sm uppercase tracking-tight text-gray-900 mb-1 line-clamp-1">{item.name}</h3>
                        <p className="text-[9px] font-mono text-gray-400 uppercase tracking-widest mb-3">{formatBytes(item.size)} • {item.category}</p>
                        <p className="text-[11px] text-gray-600 leading-relaxed mb-6 font-sans flex-1">{item.description}</p>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 mt-auto">
                          <button
                            onClick={() => importStoreItem(item)}
                            disabled={isAdded}
                            className={cn(
                              "w-full py-2.5 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer border",
                              isAdded 
                                ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                : cn("bg-[#141414] hover:bg-black text-white border-[#141414]", mood === 'vogue' && 'bg-rose-500 hover:bg-rose-600 border-rose-600', mood === 'cyber' && 'bg-sky-500 hover:bg-sky-600 border-sky-600')
                            )}
                          >
                            <Download className="w-3.5 h-3.5" />
                            {isAdded ? "Added to Storage" : "Import to Storage"}
                          </button>

                          {isImage && (
                            <button
                              onClick={() => saveToPhotosAlbum(item)}
                              className="w-full py-2 bg-white hover:bg-gray-50 text-[#141414] border border-[#141414] rounded-sm text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-orange-500" />
                              Save to Photos
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              <div className={cn("flex items-baseline justify-between mb-12 border-b pb-4", t.border)}>
                <div className="flex items-center gap-4">
                  <h2 className="text-5xl font-bold tracking-tighter uppercase">{selectedCategory}</h2>
                  <div className={cn("px-3 py-1 rounded-full text-[10px] font-mono", t.accent, t.accentText)}>
                    {filteredFiles.length} ITEM{filteredFiles.length !== 1 && 'S'}
                  </div>
                </div>
                <p className={cn("font-mono text-[10px] uppercase tracking-widest leading-none", t.muted)}>
                  Last Sync: {new Date().toLocaleTimeString()}
                </p>
              </div>

              {/* AI Pattern Suggestions Overview Banner */}
              {folderSuggestions.length > 0 && (
                <div className="mb-10 p-5 bg-indigo-50/70 backdrop-blur-sm border border-indigo-200 rounded-sm shadow-[4px_4px_0px_rgba(79,70,229,0.1)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-indigo-100">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-600 rounded text-white animate-pulse">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950">AI Pattern Matching Suggestions</h3>
                        <p className="text-[10px] font-mono text-indigo-600/80 uppercase tracking-tight">
                          Our smart analyzer detected {folderSuggestions.length} custom folder matches for your unorganized files.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={acceptAllSuggestions}
                      className="self-start sm:self-center px-4 py-2 bg-indigo-600 text-white font-black uppercase tracking-widest text-[9px] hover:bg-indigo-700 transition-all rounded-sm shadow-[2px_2px_0px_rgba(30,27,75,0.2)] cursor-pointer"
                    >
                      Organize All ({folderSuggestions.length})
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {folderSuggestions.map(s => {
                      const file = files.find(f => f.id === s.fileId);
                      const folder = folders.find(fold => fold.id === s.folderId);
                      if (!file || !folder) return null;
                      return (
                        <div key={s.fileId} className="bg-white p-3 border border-indigo-100 rounded flex items-center justify-between gap-3 text-xs shadow-sm">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-950 truncate uppercase tracking-tight">{file.name}</p>
                            <p className="text-[9px] font-mono text-gray-500 uppercase mt-0.5">
                              Move to: <span className="text-indigo-700 font-bold">{folder.path}</span>
                            </p>
                            <p className="text-[9px] italic text-indigo-600 font-mono mt-1">Reason: {s.reason}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => acceptSuggestion(s.fileId, folder)}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[8px] rounded-sm transition-colors cursor-pointer"
                            >
                              Move
                            </button>
                            <button
                              onClick={() => dismissSuggestion(s.fileId)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
                              title="Dismiss Suggestion"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Files Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
                <AnimatePresence mode="popLayout">
                  {filteredFiles.map((file, index) => {
                    const isSelected = selectedIds.has(file.id);
                    return (
                      <motion.div
                        key={file.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                        className="group"
                        onClick={() => {
                          setPreviewFile(file);
                          setEditFileName(file.name);
                          setEditFileCategory(file.category);
                          setEditFilePath(file.suggestedPath);
                        }}
                      >
                        <div className={cn(
                          "bg-white border p-6 transition-all duration-200 cursor-pointer flex flex-col h-full relative",
                          t.border,
                          isSelected ? cn("shadow-[12px_12px_0px] bg-blue-50/10", mood === 'vogue' ? "shadow-rose-500 border-rose-600" : mood === 'cyber' ? "shadow-sky-500 border-sky-600" : "shadow-[#141414] border-blue-600") : "hover:shadow-[8px_8px_0px] shadow-gray-200"
                        )}>
                          {/* Selection Checkbox */}
                          <div 
                            className="absolute top-4 left-4 z-10 p-1 rounded hover:bg-gray-100 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(file.id);
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare className={cn("w-4 h-4", mood === 'vogue' ? "text-rose-600" : mood === 'cyber' ? "text-sky-600" : "text-blue-600")} />
                            ) : (
                              <Square className="w-4 h-4 opacity-30 group-hover:opacity-100 translate-x-[-4px] group-hover:translate-x-0 transition-all text-gray-400" />
                            )}
                          </div>

                          <div className="flex items-start justify-between mb-6 pt-2">
                            <div className={cn(
                              "w-12 h-12 flex items-center justify-center rounded-sm ml-auto",
                              file.isOrganized ? "bg-gray-50 border border-gray-100" : "bg-yellow-50 animate-pulse border border-yellow-200"
                            )}>
                              {file.type.includes('image') ? (
                                <ImageIcon className="text-orange-500 w-6 h-6" />
                              ) : (file.name.endsWith('.apk') || file.name.endsWith('.abb')) ? (
                                <Smartphone className="text-purple-500 w-6 h-6" />
                              ) : (
                                <FileIcon className="text-blue-500 w-6 h-6" />
                              )}
                            </div>
                            <CheckCircle2 className={cn(
                              "w-5 h-5",
                              file.isOrganized ? "text-emerald-500" : "text-gray-200"
                            )} />
                          </div>
                          
                          <div className="flex-1">
                            <h3 className={cn("font-bold text-sm truncate mb-1 transition-colors uppercase tracking-tight", mood === 'vogue' ? "group-hover:text-rose-600" : mood === 'cyber' ? "group-hover:text-sky-600" : "group-hover:text-blue-600")}>
                              {file.name}
                            </h3>
                            <p className="text-[10px] font-mono opacity-40 uppercase">
                              {formatBytes(file.size)} • {file.type.split('/')[1] || 'FILE'}
                            </p>
                            
                            {/* Instant Utility Actions */}
                            <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); shareFile(file); }}
                                className={cn("p-2 rounded-sm hover:opacity-80 transition-all", t.accent, t.accentText)}
                                title="Share to Email/Message"
                              >
                                <Share2 className="w-3 h-3" />
                              </button>
                              {file.content && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); copyNote(file.content); }}
                                  className={cn("p-2 border rounded-sm transition-all", t.border, t.secondary)}
                                  title="Copy Content"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFile(file);
                                  setEditFileName(file.name);
                                  setEditFileCategory(file.category);
                                  setEditFilePath(file.suggestedPath);
                                }}
                                className={cn("px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm transition-all flex items-center gap-1", mood === 'vogue' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')}
                                title="Open Preview"
                              >
                                <Eye className="w-3 h-3" />
                                Preview
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadSingleFile(file);
                                }}
                                className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center gap-1"
                                title="Grab / Direct Download File"
                              >
                                <Download className="w-3 h-3" />
                                Grab
                              </button>
                            </div>

                            {/* Pattern Suggestion Badge / Acceptor */}
                            {(() => {
                              const sug = folderSuggestions.find(s => s.fileId === file.id);
                              const targetFold = sug ? folders.find(fold => fold.id === sug.folderId) : null;
                              if (!sug || !targetFold) return null;
                              return (
                                <div className="mt-4 p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-sm text-[10px] relative z-10">
                                  <div className="flex items-center gap-1.5 text-indigo-850 font-black uppercase tracking-wider mb-1">
                                    <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                                    <span>Pattern Suggestion</span>
                                  </div>
                                  <p className="text-gray-600 font-mono text-[9px] mb-2 leading-tight">
                                    Move to custom <strong className="text-gray-900 font-bold">"{targetFold.name}"</strong>?
                                    <span className="block text-[8px] opacity-75 italic text-indigo-600 mt-0.5">({sug.reason})</span>
                                  </p>
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        acceptSuggestion(file.id, targetFold);
                                      }}
                                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[8px] rounded-sm transition-colors cursor-pointer"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        dismissSuggestion(file.id);
                                      }}
                                      className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold uppercase tracking-wider text-[8px] rounded-sm transition-colors cursor-pointer"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div className={cn("mt-6 pt-6 border-t", t.border.replace('border-', 'border-opacity-10 border-'))}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn("w-1.5 h-1.5 rounded-full", t.accent)} />
                                <span className="text-[10px] font-mono font-bold tracking-wider opacity-60 uppercase truncate max-w-[150px]">
                                  {file.suggestedPath}
                                </span>
                              </div>
                              <ChevronRight className="w-3 h-3 opacity-30 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {filteredFiles.length === 0 && (
                    <div className={cn("col-span-full py-24 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed rounded-lg", t.border)}>
                      <CpuIcon className="w-16 h-16 mb-4" />
                      <p className="text-sm font-mono uppercase tracking-[0.3em]">No Resources Found</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </section>

        {/* Bulk Action Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#141414] text-white px-8 py-4 rounded-sm shadow-[12px_12px_0px_rgba(20,20,20,0.2)] z-50 flex items-center gap-8 border border-white/10"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Selected Items</span>
                <span className="text-sm font-bold">{selectedIds.size} FILES</span>
              </div>
              
              <div className="h-8 w-px bg-white/10" />

              <div className="flex items-center gap-4">
                <div className="group relative">
                  <button className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded transition-colors text-[10px] font-black tracking-widest uppercase">
                    <Move className="w-4 h-4" />
                    Move To
                  </button>
                  <div className="absolute bottom-full mb-2 left-0 w-64 bg-white text-[#141414] border border-[#141414] shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all max-h-80 overflow-y-auto">
                    {CATEGORIES.map(cat => (
                      <div key={cat.id} className="border-b border-[#141414]/10 last:border-0">
                        <button
                          onClick={() => bulkMove(cat.id)}
                          className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-100 flex items-center gap-2 bg-gray-50/50"
                        >
                          <cat.icon className={cn("w-3 h-3", cat.color)} />
                          {cat.id} ROOT
                        </button>
                        {folders.filter(f => f.category === cat.id).map(folder => (
                          <button
                            key={folder.id}
                            onClick={() => bulkMove(cat.id, folder.path)}
                            className="w-full text-left px-4 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-blue-50 flex items-center gap-2 pl-8"
                          >
                            <span className="opacity-30">└</span> {folder.name}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={bulkDownload}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-emerald-500/20 text-emerald-500 rounded transition-colors text-[10px] font-black tracking-widest uppercase"
                >
                  <Download className="w-4 h-4" />
                  Download ZIP
                </button>

                <button 
                  onClick={bulkExportToDrive}
                  disabled={isExportingToDrive}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors text-[10px] font-black tracking-widest uppercase disabled:opacity-50"
                  title="Export selected files into structured Google Drive folders"
                >
                  {isExportingToDrive ? (
                    <Sparkles className="w-4 h-4 animate-spin text-blue-400" />
                  ) : (
                    <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
                    </svg>
                  )}
                  {isExportingToDrive ? "Exporting..." : "Backup to Drive"}
                </button>

                <button 
                  onClick={() => setIsDeleting(true)}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/20 text-red-500 rounded transition-colors text-[10px] font-black tracking-widest uppercase"
                >
                  <Trash2 className="w-4 h-4" />
                  Discard
                </button>
              </div>

              <button 
                onClick={clearSelection}
                className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
                title="Cancel Selection"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications HUD */}
        <div className="fixed top-8 right-8 z-[200] flex flex-col gap-4 pointer-events-none">
          <AnimatePresence>
            {notifications.map(notif => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className={cn(
                  "pointer-events-auto border-2 border-[#141414] p-6 shadow-[8px_8px_0px_#141414] min-w-[320px] flex gap-4 transition-colors"
                )}
                style={{ 
                  backgroundColor: notifColors[notif.type].bg, 
                  color: notifColors[notif.type].text,
                  boxShadow: `8px 8px 0px ${mood === 'default' ? '#141414' : mood === 'vogue' ? '#881337' : '#075985'}`
                }}
              >
                <div 
                  className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${notifColors[notif.type].text}15` }}
                >
                  {notif.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : 
                   notif.type === 'error' ? <AlertCircle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="font-black uppercase tracking-tighter text-sm mb-1">{notif.title}</h4>
                  <p className="text-[10px] font-mono uppercase opacity-60 leading-tight">{notif.message}</p>
                </div>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                  className="absolute top-2 right-2 opacity-20 hover:opacity-100 p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Modal: Delete Confirmation */}
        <AnimatePresence>
          {isDeleting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#141414]/90 backdrop-blur-md z-[110] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-white border-2 border-[#141414] p-12 max-w-sm w-full text-center shadow-[0_0_100px_rgba(255,255,255,0.1)]"
              >
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">Confirm Deletion</h3>
                <p className="text-[10px] font-mono uppercase opacity-50 mb-8 leading-relaxed">
                  You are about to permanently remove <span className="font-bold text-[#141414]">{selectedIds.size} files</span> from your local storage. This operation is irreversible.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={bulkDelete}
                    className="w-full bg-red-600 text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-700 transition-colors shadow-[4px_4px_0px_#141414]"
                  >
                    Confirm Permanent Discard
                  </button>
                  <button 
                    onClick={() => setIsDeleting(false)}
                    className="w-full bg-white text-[#141414] border border-[#141414] py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-50 transition-colors"
                  >
                    Keep My Files
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Change PIN */}
        <AnimatePresence>
          {isSettingPin && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#141414]/95 backdrop-blur-md z-[150] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-white border-2 border-[#141414] p-10 max-w-sm w-full text-center shadow-[15px_15px_0px_#141414]"
              >
                <Key className="w-10 h-10 mx-auto mb-6 opacity-20" />
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">Set New PIN</h3>
                <p className="text-[9px] font-mono uppercase opacity-50 mb-8">Enter a 4-digit code to secure your data.</p>
                
                <input 
                  type="password" 
                  maxLength={4}
                  value={newPinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 4) setNewPinInput(val);
                  }}
                  className="w-full text-center text-4xl font-black tracking-[0.5em] border-b-2 border-[#141414] outline-none mb-10 pb-2"
                  autoFocus
                />

                <div className="flex gap-4">
                  <button 
                    onClick={updateMasterPin}
                    disabled={newPinInput.length !== 4}
                    className="flex-1 bg-[#141414] text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black/90 disabled:opacity-30 transition-all"
                  >
                    Save Secret
                  </button>
                  <button 
                    onClick={() => setIsSettingPin(false)}
                    className="px-8 border border-[#141414] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-50 transition-all"
                  >
                    Back
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isProcessing && !selectedIds.size && (
          <div className="absolute bottom-8 right-8 bg-[#141414] text-white px-8 py-4 rounded-sm shadow-2xl flex items-center gap-4 z-50 border border-white/10">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Autonomous Sorting...</span>
          </div>
        )}

        {/* Modal: Create Folder */}
        <AnimatePresence>
          {isCreatingFolder && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white border-2 border-[#141414] p-10 max-w-md w-full shadow-[20px_20px_0px_rgba(20,20,20,0.4)]"
              >
                <h3 className="text-3xl font-black uppercase tracking-tighter mb-8">New Directory</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-mono uppercase opacity-40 block mb-2">Folder Name</label>
                    <input 
                      type="text" 
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="e.g. PROJECT X"
                      autoFocus
                      className="w-full border-b-2 border-[#141414] py-2 text-xl font-bold uppercase outline-none placeholder:opacity-10"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase opacity-40 block mb-2 text-rose-500">Target Path (AI Suggested)</label>
                    <input 
                      type="text" 
                      value={newFolderPath}
                      onChange={(e) => setNewFolderPath(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-mono font-bold outline-none rounded-sm transition-all focus:border-[#141414]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase opacity-40 block mb-4">Parent Category</label>
                    <div className="grid grid-cols-2 gap-3">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setNewFolderCategory(cat.id)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all",
                            newFolderCategory === cat.id ? "bg-[#141414] text-white scale-[1.02]" : "border-gray-200 hover:border-[#141414]"
                          )}
                        >
                          <cat.icon className={cn("w-3 h-3", newFolderCategory === cat.id ? "text-white" : cat.color)} />
                          {cat.id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-8">
                    <button 
                      onClick={createFolder}
                      disabled={!newFolderName.trim()}
                      className="flex-1 bg-[#141414] text-white py-4 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black/90 disabled:opacity-30 transition-all"
                    >
                      Initialize Folder
                    </button>
                    <button 
                      onClick={() => setIsCreatingFolder(false)}
                      className="px-8 border border-[#141414] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Save to Photos Device Instructions Helper */}
        <AnimatePresence>
          {selectedStoreItem && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#141414]/90 backdrop-blur-md z-[110] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white border-2 border-[#141414] p-8 max-w-md w-full shadow-[12px_12px_0px_rgba(20,20,20,1)] rounded-sm"
              >
                <div className="flex justify-between items-start mb-6 pb-2 border-b border-gray-150">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-gray-900 flex items-center gap-2">
                      <Camera className="w-5 h-5 text-orange-500 animate-pulse" />
                      Save to Photos
                    </h3>
                    <p className="text-[9px] font-mono uppercase opacity-50 mt-1">Multi-Device Camera Roll Helper</p>
                  </div>
                  <button 
                    onClick={() => setSelectedStoreItem(null)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Photo Preview */}
                <div className="relative w-full h-48 bg-gray-50 border border-gray-200 rounded-sm mb-6 overflow-hidden flex items-center justify-center">
                  <img 
                    src={selectedStoreItem.thumbnail || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'} 
                    alt={selectedStoreItem.name} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/80 text-white font-mono text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                    {selectedStoreItem.name}
                  </div>
                </div>

                {/* Device-Specific Instructions */}
                <div className="space-y-4 mb-8">
                  {/* Phone & Tablet */}
                  <div className="flex items-start gap-3 bg-rose-50/50 p-3 border border-rose-100 rounded">
                    <Smartphone className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-rose-950">On Phone & Tablet</h4>
                      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                        To save directly to your native Camera Roll / Photos App, <strong>long-press (tap and hold) the preview image above</strong>, then select <strong className="text-gray-900">"Save Image"</strong> or <strong className="text-gray-900">"Add to Photos"</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Computer */}
                  <div className="flex items-start gap-3 bg-blue-50/50 p-3 border border-blue-100 rounded">
                    <Laptop className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-950">On Computer / Laptop</h4>
                      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                        Your computer has automatically triggered a direct physical file download of this photo asset. You can find it in your system's <strong>Downloads</strong> folder.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button 
                    onClick={() => saveToPhotosAlbum(selectedStoreItem)}
                    className={cn("flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border cursor-pointer", mood === 'vogue' ? 'bg-rose-500 hover:bg-rose-600 border-rose-600 text-white' : mood === 'cyber' ? 'bg-sky-500 hover:bg-sky-600 border-sky-600 text-white' : 'bg-[#141414] hover:bg-black text-white border-[#141414]')}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Trigger Re-Download
                  </button>
                  <button 
                    onClick={() => setSelectedStoreItem(null)}
                    className="flex-1 py-3 bg-white text-[#141414] border border-[#141414] text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Interactive File Access Preview & Operations Center */}
        <AnimatePresence>
          {previewFile && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#141414]/90 backdrop-blur-md z-[120] flex items-center justify-center p-4 overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white border-2 border-[#141414] p-6 md:p-8 max-w-2xl w-full shadow-[16px_16px_0px_rgba(20,20,20,1)] rounded-sm my-8"
              >
                {/* Header section with category icon */}
                <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-600 shrink-0">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-600">Dynamic File Explorer</span>
                      <h3 className="text-xl font-black uppercase tracking-tight text-gray-950 mt-0.5">Quick Access Viewer</h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPreviewFile(null)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-gray-900" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left Column: Interactive Settings / Metadata */}
                  <div className="md:col-span-5 space-y-4">
                    <div>
                      <label className="text-[9px] font-mono uppercase opacity-50 block mb-1">File Identifier / Name</label>
                      <input 
                        type="text" 
                        value={editFileName}
                        onChange={(e) => setEditFileName(e.target.value)}
                        className="w-full text-xs font-mono font-bold border border-gray-300 focus:border-[#141414] px-2.5 py-2 outline-none rounded-sm bg-gray-50 uppercase"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-mono uppercase opacity-50 block mb-1">Directory / Category</label>
                      <select 
                        value={editFileCategory}
                        onChange={(e) => {
                          const cat = e.target.value as FileCategory;
                          setEditFileCategory(cat);
                          // Default path suggestion
                          if (!editFilePath.startsWith(cat)) {
                            setEditFilePath(`${cat}/${editFileName.split('_')[0] || 'Unsorted'}`);
                          }
                        }}
                        className="w-full text-xs font-mono font-bold border border-gray-300 focus:border-[#141414] px-2.5 py-2 outline-none rounded-sm bg-white cursor-pointer"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.id.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-mono uppercase opacity-50 block mb-1">Structured Storage Path</label>
                      <input 
                        type="text" 
                        value={editFilePath}
                        onChange={(e) => setEditFilePath(e.target.value)}
                        className="w-full text-xs font-mono font-bold border border-gray-300 focus:border-[#141414] px-2.5 py-2 outline-none bg-gray-50 rounded-sm"
                        placeholder="e.g. Work/Invoices/2026"
                      />
                    </div>

                    {/* Technical stats breakdown */}
                    <div className="p-3 bg-gray-50 border border-gray-150 rounded-sm font-mono text-[9px] space-y-2">
                      <p className="font-bold text-gray-500 uppercase tracking-wider border-b pb-1">Asset Metadata</p>
                      <div className="flex justify-between">
                        <span className="opacity-60">SIZE:</span>
                        <span className="font-bold">{formatBytes(previewFile.size)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-60">TYPE:</span>
                        <span className="font-bold uppercase">{previewFile.type || 'UNKNOWN/BINARY'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-60">MODIFIED:</span>
                        <span className="font-bold">{new Date(previewFile.lastModified).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-60">ORGANIZED:</span>
                        <span className={cn("font-bold", previewFile.isOrganized ? "text-emerald-600" : "text-amber-500")}>
                          {previewFile.isOrganized ? "VERIFIED" : "UNSORTED"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Dynamic Preview Panel */}
                  <div className="md:col-span-7 flex flex-col">
                    <label className="text-[9px] font-mono uppercase opacity-50 block mb-1">Interactive Content Preview</label>
                    <div className="flex-1 min-h-[180px] bg-gray-900 border border-gray-800 rounded-sm p-4 relative overflow-hidden flex flex-col justify-between text-white font-mono">
                      
                      {/* Image Preview */}
                      {previewFile.type.includes('image') ? (
                        <div className="absolute inset-0 bg-black flex flex-col justify-between p-2">
                          <img 
                            src={previewFile.thumbnail || 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80'} 
                            alt={previewFile.name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                          <button 
                            onClick={() => saveToPhotosAlbum(previewFile)}
                            className="absolute bottom-2 right-2 bg-[#141414] hover:bg-black text-white px-2.5 py-1.5 rounded-sm text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
                          >
                            <Camera className="w-3 h-3 text-orange-500" />
                            Save to Photos
                          </button>
                        </div>
                      ) : null}

                      {/* Text Note / Code Memo Preview */}
                      {previewFile.content ? (
                        <div className="flex flex-col h-full justify-between">
                          <div className="overflow-y-auto max-h-[160px] text-[10px] leading-relaxed text-gray-300 pr-1 select-all whitespace-pre-wrap">
                            {previewFile.content}
                          </div>
                          <button 
                            onClick={() => copyNote(previewFile.content || '')}
                            className="self-end mt-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-sm text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            Copy Text
                          </button>
                        </div>
                      ) : null}

                      {/* APK / Mobile Application Package Preview */}
                      {(previewFile.name.endsWith('.apk') || previewFile.name.endsWith('.abb')) ? (
                        <div className="flex flex-col h-full justify-between py-2 text-center">
                          <div className="flex flex-col items-center justify-center pt-2">
                            <Smartphone className="w-10 h-10 text-purple-400 animate-bounce mb-2" />
                            <p className="text-[10px] font-bold text-white uppercase tracking-wider">Mobile Package Analyzer</p>
                            <p className="text-[8px] text-purple-300 mt-1 uppercase">Ready for Android Install Simulation</p>
                          </div>
                          <button 
                            onClick={() => {
                              notify("Simulation Started", "Connecting to android target emulator...", "info");
                              setTimeout(() => {
                                notify("Install Succeeded", `Successfully deployed "${previewFile.name}" to simulated device.`, "success");
                              }, 1500);
                            }}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[8px] font-black uppercase tracking-wider rounded-sm transition-colors cursor-pointer"
                          >
                            Simulate Deployment
                          </button>
                        </div>
                      ) : null}

                      {/* Fallback Binary Details Preview */}
                      {!previewFile.type.includes('image') && !previewFile.content && !(previewFile.name.endsWith('.apk') || previewFile.name.endsWith('.abb')) ? (
                        <div className="flex flex-col h-full justify-between py-2 text-center">
                          <div className="flex flex-col items-center justify-center pt-4">
                            <FileIcon className="w-10 h-10 text-blue-400 mb-2 opacity-80" />
                            <p className="text-[10px] font-bold text-gray-200 uppercase tracking-widest">Document Storage Capsule</p>
                            <p className="text-[8px] text-gray-400 mt-1 max-w-[200px]">Secure, checksummed file asset. Ready for immediate download or structured share.</p>
                          </div>
                          <p className="text-[8px] text-emerald-400 uppercase tracking-widest font-black">● Security Scan Clear</p>
                        </div>
                      ) : null}

                    </div>
                  </div>
                </div>

                {/* Operations Suite Footer */}
                <div className="mt-8 pt-6 border-t border-gray-150 flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => downloadSingleFile(previewFile)}
                      className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      title="Direct download to local computer"
                    >
                      <Download className="w-4 h-4" />
                      Grab / Download
                    </button>
                    <button 
                      onClick={() => shareFile(previewFile)}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 border cursor-pointer"
                      title="Share link simulation"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently delete "${previewFile.name}"?`)) {
                          deleteSingleFile(previewFile.id);
                        }
                      }}
                      className="px-4 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      title="Permanently remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                    <button 
                      onClick={() => {
                        saveFileEdits(previewFile.id, editFileName, editFileCategory, editFilePath);
                        setPreviewFile(null);
                      }}
                      className={cn("px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer", mood === 'vogue' ? 'bg-rose-500 hover:bg-rose-600 text-white' : mood === 'cyber' ? 'bg-sky-500 hover:bg-sky-600 text-white' : 'bg-[#141414] hover:bg-black text-white')}
                    >
                      <Check className="w-4 h-4" />
                      Save & Close
                    </button>
                  </div>
                </div>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
