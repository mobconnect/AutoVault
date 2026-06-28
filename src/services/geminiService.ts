
import { GoogleGenAI, Type } from "@google/genai";
import { FileCategory, Folder, VaultFile } from "../types";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export interface CategorizationResult {
  category: FileCategory;
  suggestedPath: string;
  reason: string;
}

export interface FolderSuggestion {
  fileId: string;
  folderId: string;
  reason: string;
}

export async function suggestFolderMoves(
  files: VaultFile[],
  folders: Folder[]
): Promise<FolderSuggestion[]> {
  // Only analyze files that are not already matched or are currently unorganized / have generic paths
  const candidateFiles = files.filter(f => {
    // If a file's suggestedPath does not already end in a custom folder, it's a candidate
    const pathParts = f.suggestedPath.split('/');
    const currentFolderOrCategory = pathParts[pathParts.length - 1];
    
    // Check if it already lies inside any existing custom folder's path
    const isInCustomFolder = folders.some(folder => f.suggestedPath === folder.path || f.suggestedPath.startsWith(folder.path + '/'));
    return !isInCustomFolder;
  });

  if (candidateFiles.length === 0 || folders.length === 0) return [];

  const model = "gemini-3.5-flash";

  const fileData = candidateFiles.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    category: f.category,
    suggestedPath: f.suggestedPath
  }));

  const folderData = folders.map(fold => ({
    id: fold.id,
    name: fold.name,
    path: fold.path,
    category: fold.category
  }));

  const prompt = `
    You are an intelligent machine learning-based file pattern recognizer.
    We have a list of user files and a list of existing custom folders.
    
    Candidate Files to organize:
    ${JSON.stringify(fileData, null, 2)}
    
    Existing Custom Folders:
    ${JSON.stringify(folderData, null, 2)}
    
    Your task is to analyze file naming patterns, extensions, and metadata to see if any candidate files should be filed into an existing custom folder.
    
    Guidelines:
    1. Only make a suggestion if there is high confidence and a strong pattern or semantic match.
       - e.g. "Invoice_April_2026.pdf" matches "Invoices" (Work/Invoices) or "Financial" folders.
       - e.g. "Family_Dinner.jpg" or "paris_trip.png" matches "Trips" (Personal/Trips).
    2. Suggest only ONE folder suggestion per file.
    3. If there is no strong match for a file, do not suggest anything for it.
    4. Provide a very short and helpful explanation of why the pattern matches (e.g., "Contains 'invoice' keyword", "Image file matching 'Trips' context").
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fileId: { type: Type.STRING },
                  folderId: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["fileId", "folderId", "reason"]
              }
            }
          },
          required: ["suggestions"]
        }
      }
    });

    const parsed = JSON.parse(response.text);
    return (parsed.suggestions || []) as FolderSuggestion[];
  } catch (error) {
    console.error("AI Folder Move Suggestion failed:", error);
    return [];
  }
}

export async function categorizeFile(
  fileName: string, 
  fileType: string, 
  content?: string
): Promise<CategorizationResult> {
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analyze this file and decide which folder it belongs in.
    
    File Name: ${fileName}
    File Type: ${fileType}
    Content Preview: ${content ? content.substring(0, 500) : "No content preview available"}

    Rules for folders:
    1. "Work": Professional documents, resumes, spreadsheets, project notes.
    2. "Personal": Personal photos, journal entries, daycare pictures (e.g. Emily_Daycare_Painting.jpg), daycare screenshots (e.g. daycare schedule or updates), parenting schedules, and home-related lists.
    3. "Apps": .apk or .abb files. Create a specific subfolder based on the App Name if identifiable.
    4. "Media": Random pictures, videos that aren't clearly personal, financial, or work.
    5. "Notes": Text snippets that don't fit perfectly into Work or Personal.
    6. "Financial": Invoices, receipts, bank statements (e.g., Chase Bank, Wells Fargo), bank statement screenshots, salary slips, and financial ledger snaps.

    Specifically:
    - If the filename, file type, or content suggests "daycare", "childcare", or kids activity photos/screenshots, categorize it under "Personal" and suggest a structured subfolder path like "Personal/Daycare" or "Personal/Daycare/Emily".
    - If the filename, file type, or content suggests "bank statement", "statement", "receipt", "invoice", "bank screenshot", or financial ledger capture, categorize it under "Financial" and suggest a subfolder path like "Financial/Bank Statements" or "Financial/Receipts".

    Return the category (Work, Personal, Apps, Media, Notes, Financial) and a suggested path (e.g., "Personal/Daycare" or "Financial/Bank Statements/June").
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, enum: ["Work", "Personal", "Apps", "Media", "Notes", "Financial"] },
            suggestedPath: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["category", "suggestedPath", "reason"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as CategorizationResult;
  } catch (error) {
    console.error("AI Categorization failed:", error);
    return {
      category: "Uncategorized",
      suggestedPath: "Inbox",
      reason: "Analysis failed"
    };
  }
}
