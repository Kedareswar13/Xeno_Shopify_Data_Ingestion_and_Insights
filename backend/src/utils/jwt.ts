import jwt from 'jsonwebtoken';
import logger from './logger';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

// JWT payload type
type JwtPayload = {
  id: string;
  iat?: number;
  exp?: number;
};

// Sign JWT token
export const signToken = (userId: string): string => {
  try {
    const payload = { id: userId };
    // Use a fixed expiration of 7 days
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  } catch (error) {
    logger.error('Error signing JWT token:', error);
    throw new Error('Error generating authentication token');
  }
};

// Verify JWT token
export const verifyToken = (token: string): Promise<JwtPayload> => {
  return new Promise((resolve, reject) => {
    if (!JWT_SECRET) {
      return reject(new Error('JWT_SECRET is not defined'));
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        logger.error('Error verifying JWT token:', err);
        return reject(new Error('Invalid or expired token'));
      }
      resolve(decoded as JwtPayload);
    });
  });
};

// Create and sign token for user
export const createAuthToken = (user: { id: string }): string => {
  if (!user || !user.id) {
    throw new Error('Invalid user data for token creation');
  }
  return signToken(user.id);
};
