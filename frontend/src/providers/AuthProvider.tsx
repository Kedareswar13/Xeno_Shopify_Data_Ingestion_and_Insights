'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

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
const publicPaths = ['/login', '/signup', '/verify-otp', '/forgot-password', '/reset-password'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        // Here you would typically check for an auth token in cookies/localStorage
        // and validate it with your backend
        const token = localStorage.getItem('token');
        
        if (token) {
          // Validate token with backend
          // const response = await fetch('/api/auth/me', {
          //   headers: { 'Authorization': `Bearer ${token}` }
          // });
          // if (response.ok) {
          //   const userData = await response.json();
          //   setUser(userData);
          // } else {
          //   localStorage.removeItem('token');
          //   setUser(null);
          // }
          
          // For now, just set a mock user
          setUser({ id: '1', email: 'user@example.com', name: 'John Doe' });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
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
      // Here you would typically make an API call to your backend
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password })
      // });
      // const data = await response.json();
      
      // if (!response.ok) throw new Error(data.message || 'Login failed');
      
      // localStorage.setItem('token', data.token);
      // setUser(data.user);
      
      // For now, just set a mock user
      setUser({ id: '1', email, name: 'John Doe' });
      localStorage.setItem('token', 'mock-token');
      
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      // Here you would typically make an API call to your backend
      // const response = await fetch('/api/auth/register', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ name, email, password })
      // });
      // const data = await response.json();
      
      // if (!response.ok) throw new Error(data.message || 'Registration failed');
      
      // For now, just redirect to verify-otp
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const verifyOtp = async (email: string, otp: string): Promise<boolean> => {
    try {
      // Here you would typically make an API call to your backend
      // const response = await fetch('/api/auth/verify-otp', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, otp })
      // });
      // const data = await response.json();
      
      // if (!response.ok) throw new Error(data.message || 'Verification failed');
      
      // For now, just log in the user
      await login(email, 'password');
      return true;
    } catch (error) {
      console.error('OTP verification failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      // Clear all auth-related data from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      localStorage.removeItem('pendingVerificationEmail');
      
      // Clear any auth cookies if they exist
      document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      
      // Reset user state
      setUser(null);
      
      // Redirect to login page with a small delay to ensure state is cleared
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
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
