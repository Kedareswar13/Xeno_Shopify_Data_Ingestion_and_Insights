'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  // Add other user properties as needed
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyOtp: (email: string, otp: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// List of public paths that don't require authentication
const publicPaths = ['/login', '/signup', '/verify-otp', '/forgot-password', '/reset-otp', '/reset-password'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is logged in using real backend
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const cachedUser = localStorage.getItem('user');
        if (!token) {
          setUser(null);
          return;
        }
        if (cachedUser) {
          try { setUser(JSON.parse(cachedUser)); } catch {}
        }
        const me: any = await api.get('/api/auth/me');
        const u = me?.data?.user || me?.user || me;
        if (u?.id) {
          setUser(u);
          localStorage.setItem('user', JSON.stringify(u));
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Listen for token changes from other parts of the app (e.g., hooks/useAuth)
  useEffect(() => {
    const handleAuthUpdate = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setUser(null);
          return;
        }
        const me: any = await api.get('/api/auth/me');
        const u = me?.data?.user || me?.user || me;
        if (u?.id) {
          setUser(u);
          localStorage.setItem('user', JSON.stringify(u));
        }
      } catch (e) {
        // If it fails, clear user
        setUser(null);
      }
    };

    window.addEventListener('storage', handleAuthUpdate);
    window.addEventListener('auth:update', handleAuthUpdate as EventListener);
    return () => {
      window.removeEventListener('storage', handleAuthUpdate);
      window.removeEventListener('auth:update', handleAuthUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated and not on a public path
    if (!loading && !user && !publicPaths.some(path => pathname.startsWith(path))) {
      router.push('/login');
    }
    
    // Redirect to dashboard if authenticated and on a public path
    if (!loading && user && publicPaths.some(path => pathname === path)) {
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    try {
      const resp: any = await api.post('/api/auth/login', { email, password });
      const token = resp?.token || resp?.data?.token;
      const u = resp?.data?.user || resp?.user;
      if (!token || !u?.id) throw new Error('Invalid login response');
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('userId', u.id);
      setUser(u);
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      // Clear any bad state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      await api.post('/api/auth/signup', { username: name, email, password, passwordConfirm: password });
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const verifyOtp = async (email: string, otp: string): Promise<boolean> => {
    try {
      const resp: any = await api.post('/api/auth/verify-otp', { email, otp });
      const token = resp?.token || resp?.data?.token;
      const u = resp?.user || resp?.data?.user;
      if (token && u?.id) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(u));
        localStorage.setItem('userId', u.id);
        setUser(u);
        return true;
      }
      return false;
    } catch (error) {
      console.error('OTP verification failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await api.get('/api/auth/logout');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      localStorage.removeItem('pendingVerificationEmail');
      setUser(null);
      setTimeout(() => { window.location.href = '/login'; }, 100);
    } catch (error) {
      console.error('Error during logout:', error);
      // Still redirect to login even if there's an error
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
