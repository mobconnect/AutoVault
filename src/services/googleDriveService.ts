import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add required Google Drive scopes
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

// In-memory token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess(user, cachedAccessToken);
      } else {
        // If user is logged in but token was cleared (e.g., page reload), we require re-signin
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure();
    }
  });
};

// Start Google sign-in flow
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google sign-in credential.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve current cached token
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Set token directly (e.g. during manual flow)
export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Sign out and clear cache
export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// --- Google Drive API operations ---

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  thumbnailLink?: string;
}

// List files from user's Google Drive
export const listGoogleDriveFiles = async (
  token: string,
  filterType: 'all' | 'image' | 'pdf' | 'apk' = 'all',
  searchQuery = ''
): Promise<GoogleDriveFile[]> => {
  try {
    let q = 'trashed = false';
    
    if (filterType === 'image') {
      q += " and mimeType codes 'image/'";
    } else if (filterType === 'pdf') {
      q += " and mimeType = 'application/pdf'";
    } else if (filterType === 'apk') {
      q += " and (name contains '.apk' or mimeType = 'application/vnd.android.package-archive')";
    }

    if (searchQuery.trim()) {
      // Escape single quotes in search query
      const escapedQuery = searchQuery.replace(/'/g, "\\'");
      q += ` and name contains '${escapedQuery}'`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,createdTime,thumbnailLink)&pageSize=30&orderBy=createdTime desc`;
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('Failed to list Google Drive files:', err);
    throw err;
  }
};

// Get or create folder structure on Google Drive
// Path example: "Personal/Daycare/Emily"
export const getOrCreateFolderByPath = async (token: string, path: string): Promise<string> => {
  const parts = path.split('/').filter(p => p.trim().length > 0);
  let parentId = 'root';

  for (const part of parts) {
    // Search if folder already exists under current parentId
    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${part.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!searchRes.ok) {
      throw new Error(`Folder search failed for "${part}"`);
    }
    
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      parentId = searchData.files[0].id;
    } else {
      // Create the folder
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentId === 'root' ? undefined : [parentId]
        })
      });
      
      if (!createRes.ok) {
        throw new Error(`Failed to create folder "${part}"`);
      }
      
      const createdFolder = await createRes.json();
      parentId = createdFolder.id;
    }
  }

  return parentId;
};

// Upload a file to Google Drive under a structured folder path
export const uploadFileToDrive = async (
  token: string,
  fileName: string,
  mimeType: string,
  content: string | Blob,
  folderPath: string
): Promise<string> => {
  try {
    // Get or create parent folder ID
    const parentFolderId = await getOrCreateFolderByPath(token, folderPath);
    
    // Step 1: Create file metadata
    const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: fileName,
        parents: [parentFolderId],
        mimeType: mimeType
      })
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Metadata creation failed: ${errText}`);
    }

    const meta = await metaRes.json();
    const fileId = meta.id;

    // Step 2: Upload file content
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType
      },
      body: blob
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Content upload failed: ${errText}`);
    }

    return fileId;
  } catch (err) {
    console.error(`Failed uploading file ${fileName} to Google Drive:`, err);
    throw err;
  }
};

// Download actual file content from Google Drive (e.g. text/image)
export const getDriveFileContent = async (
  token: string,
  fileId: string
): Promise<Blob> => {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error(`Failed to retrieve file media stream (${res.status})`);
    }

    return await res.blob();
  } catch (err) {
    console.error('Failed to download file from Google Drive:', err);
    throw err;
  }
};
