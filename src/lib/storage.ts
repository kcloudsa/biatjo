import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import crypto from 'crypto';

/**
 * Upload a buffer to Firebase Storage at a given destination path.
 * Returns the public download URL.
 */
export async function uploadBuffer(
  destinationPath: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; path: string }> {
  const fileRef = ref(storage, destinationPath);
  // Convert Buffer to Uint8Array for Firebase Web SDK
  const data = new Uint8Array(buffer);
  await uploadBytes(fileRef, data, {
    contentType,
    cacheControl: 'public, max-age=31536000, immutable',
  });
  const url = await getDownloadURL(fileRef);
  return { url, path: destinationPath };
}

/**
 * Delete a file from Firebase Storage given its URL or path.
 */
export async function deleteFile(urlOrPath: string): Promise<boolean> {
  try {
    if (!urlOrPath) return false;
    
    // Extract path from URL if it's a full Firebase Storage URL
    let path = urlOrPath;
    if (urlOrPath.includes('firebasestorage.googleapis.com')) {
      const urlObj = new URL(urlOrPath);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        path = decodeURIComponent(pathMatch[1]);
      }
    }
    
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
    return true;
  } catch (error: any) {
    // File might not exist or already deleted
    console.warn(`Failed to delete file: ${urlOrPath}`, error.message);
    return false;
  }
}

/**
 * Check if a file exists in Firebase Storage.
 */
export async function fileExists(urlOrPath: string): Promise<boolean> {
  try {
    if (!urlOrPath) return false;
    
    let path = urlOrPath;
    if (urlOrPath.includes('firebasestorage.googleapis.com')) {
      const urlObj = new URL(urlOrPath);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        path = decodeURIComponent(pathMatch[1]);
      }
    }
    
    const fileRef = ref(storage, path);
    await getMetadata(fileRef);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Generate a hash for a buffer to identify duplicate files.
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Build a path using file hash for deduplication.
 */
export function buildHashedPath(opts: {
  entity: 'users' | 'products' | 'brands' | 'misc' | 'categories' | 'collections';
  id: string;
  field: string;
  hash: string;
  extension: string;
}): string {
  return `${opts.entity}/${opts.id}/${opts.field}/${opts.hash}${opts.extension}`;
}

/** Build a canonical destination path for an entity */
export function buildPath(opts: {
  entity:
    | 'users'
    | 'products'
    | 'brands'
    | 'misc'
    | 'categories'
    | 'collections';
  id: string;
  field: string;
  filename: string;
}): string {
  const safe = opts.filename.replace(/[^A-Za-z0-9_.-]/g, '_');
  return `${opts.entity}/${opts.id}/${opts.field}/${Date.now()}_${safe}`;
}

export default { uploadBuffer, buildPath, deleteFile, fileExists, generateFileHash, buildHashedPath };
