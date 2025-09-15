export interface AuthUser {
  id: string;
  email: string;
  tenantId?: string;
  [key: string]: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const isAuthenticated = (user: any): user is AuthUser => {
  return !!user && typeof user === 'object' && 'id' in user && 'email' in user;
};
