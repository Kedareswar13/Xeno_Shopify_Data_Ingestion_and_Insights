import multer from 'multer';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    // Create a subdirectory for each entity type (e.g., stores, products)
    const entityType = req.baseUrl.split('/').pop() || 'misc';
    const entityDir = path.join(uploadDir, entityType);
    
    if (!fs.existsSync(entityDir)) {
      fs.mkdirSync(entityDir, { recursive: true });
    }
    
    cb(null, entityDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter to allow only certain file types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and documents are allowed.'));
  }
};

// Configure multer with limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware to handle file uploads
export const uploadFile = (fieldName: string) => {
  return (req: Request, res: any, next: any) => {
    const uploadSingle = upload.single(fieldName);
    
    uploadSingle(req, res, (err: any) => {
      if (err) {
        logger.error('File upload error:', err);
        return res.status(400).json({
          status: 'error',
          message: err.message || 'Error uploading file',
        });
      }
      
      // If file was uploaded, add the file path to the request body
      if (req.file) {
        const relativePath = path.relative(process.cwd(), req.file.path);
        req.body[fieldName] = relativePath;
      }
      
      next();
    });
  };
};

// Middleware to handle multiple file uploads
export const uploadFiles = (fieldName: string, maxCount: number = 5) => {
  return (req: Request, res: any, next: any) => {
    const uploadMultiple = upload.array(fieldName, maxCount);
    
    uploadMultiple(req, res, (err: any) => {
      if (err) {
        logger.error('Multiple file upload error:', err);
        return res.status(400).json({
          status: 'error',
          message: err.message || 'Error uploading files',
        });
      }
      
      // If files were uploaded, add the file paths to the request body
      if (req.files && Array.isArray(req.files)) {
        req.body[fieldName] = (req.files as Express.Multer.File[]).map(file => ({
          originalname: file.originalname,
          filename: file.filename,
          path: path.relative(process.cwd(), file.path),
          size: file.size,
          mimetype: file.mimetype,
        }));
      }
      
      next();
    });
  };
};

// Function to delete a file
// export const deleteFile = (filePath: string): Promise<void> => {
//   return new Promise((resolve, reject) => {
//     const fullPath = path.join(process.cwd(), filePath);
//     
//     fs.unlink(fullPath, (err) => {
//       if (err) {
//         logger.error('Error deleting file:', err);
//         reject(err);
//       } else {
//         resolve();
//       }
//     });
//   });
// };

// Function to generate a signed URL for file access
export const getFileUrl = (filePath: string): string => {
  if (!filePath) return '';
  
  // In development, serve files directly
  if (process.env.NODE_ENV === 'development') {
    return `/api/files/${encodeURIComponent(filePath)}`;
  }
  
  // In production, you might want to use a CDN or cloud storage URL
  // For example, with AWS S3:
  // return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
  
  // For now, we'll just return a relative path
  return `/api/files/${encodeURIComponent(filePath)}`;
};

// Function to serve files
export const serveFile = (req: Request, res: any) => {
  try {
    const filePath = path.join(process.cwd(), req.params[0]);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(uploadDir)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied',
      });
    }
    
    res.sendFile(filePath);
  } catch (error) {
    logger.error('Error serving file:', error);
    res.status(404).json({
      status: 'error',
      message: 'File not found',
    });
  }
};
