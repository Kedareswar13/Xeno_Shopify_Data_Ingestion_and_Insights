import { v4 as uuidv4 } from 'uuid';
import { api } from './api';

interface UploadFileOptions {
  file: File;
  path?: string;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  onProgress?: (progress: number) => void;
}

export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

export const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

export const ALLOWED_TYPES = [...IMAGE_TYPES, ...DOCUMENT_TYPES];

export const MAX_FILE_SIZE_MB = 10;

export const bytesToMB = (bytes: number): number => {
  return bytes / (1024 * 1024);
};

export const validateFile = (
  file: File,
  options: {
    maxSizeMB?: number;
    acceptedFormats?: string[];
  } = {}
): { valid: boolean; error?: string } => {
  const { maxSizeMB = MAX_FILE_SIZE_MB, acceptedFormats = ALLOWED_TYPES } = options;
  
  // Check file size
  if (bytesToMB(file.size) > maxSizeMB) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  // Check file type
  if (!acceptedFormats.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported. Allowed types: ${acceptedFormats.join(', ')}`,
    };
  }

  return { valid: true };
};

export const generateFileName = (file: File, path = 'uploads'): string => {
  const ext = file.name.split('.').pop();
  const filename = `${uuidv4()}.${ext}`;
  return path ? `${path}/${filename}` : filename;
};

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const compressImage = async (
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<Blob> => {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      // Draw image on canvas
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set background color for transparent images
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          resolve(blob);
        },
        file.type || 'image/jpeg',
        quality
      );
    };

    img.onerror = (error) => {
      reject(error);
    };

    img.src = URL.createObjectURL(file);
  });
};

export const uploadFile = async ({
  file,
  path = 'uploads',
  maxSizeMB = 10,
  acceptedFormats = ALLOWED_TYPES,
  onProgress,
}: UploadFileOptions): Promise<{ url: string; key: string }> => {
  // Validate file
  const validation = validateFile(file, { maxSizeMB, acceptedFormats });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate a unique filename
  const filename = generateFileName(file, path);
  
  // Get a presigned URL from the server
  const { url, fields } = await api.post('/storage/upload-url', {
    filename,
    contentType: file.type,
  });

  // Create form data
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value as string);
  });
  formData.append('file', file);

  // Upload the file
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new Error('Upload failed'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed'));
    };

    xhr.open('POST', url, true);
    xhr.send(formData);
  });

  // Return the file URL
  return {
    url: `${url}${filename}`,
    key: filename,
  };
};

export const deleteFile = async (key: string): Promise<void> => {
  await api.delete(`/storage/files/${encodeURIComponent(key)}`);
};

export const getFileUrl = (key: string): string => {
  return `${process.env.NEXT_PUBLIC_STORAGE_URL}/${key}`;
};

export const downloadFile = async (url: string, filename: string): Promise<void> => {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  window.URL.revokeObjectURL(blobUrl);
};
