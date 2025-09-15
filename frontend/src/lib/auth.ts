'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Types
export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: { name: string; email: string; password: string }) => Promise<void>;
};

// Create context with default value of undefined, we'll check in hook
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props interface
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider Component
export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

    // Load user from localStorage on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if we have a user in localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('user');
        setUser(null);
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // TODO: Add actual login logic calling backend
      // For now, we'll simulate a successful login
      const mockUser = { 
        id: '1', 
        name: 'John Doe', 
        username: email.split('@')[0],
        email 
      };
      setUser(mockUser);
      localStorage.setItem('user', JSON.stringify(mockUser));
      router.push('/dashboard');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      localStorage.removeItem('user');
      // TODO: call backend logout if needed
      router.push('/login');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const register = async (userData: { name: string; email: string; password: string }) => {
    try {
      // TODO: Add actual registration logic
      const newUser = { 
        id: '2', 
        name: userData.name, 
        username: userData.email.split('@')[0],
        email: userData.email 
      };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      router.push('/dashboard');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    register,
  };

  // <-- This return is valid JSX (file must be .tsx and React must be available)
  return React.createElement(AuthContext.Provider, { value }, children);
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Mock implementation for development (keeps same AuthContextType)
export function useMockAuth(): AuthContextType {
  const [user, setUser] = useState<User | null>({
    id: '1',
    name: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
  });

  const [isLoading] = useState(false);
  const router = useRouter();

  const login = async (email: string, password: string) => {
    // ignore password in mock
    await new Promise((resolve) => setTimeout(resolve, 500));
    setUser({
      id: '1',
      name: 'John Doe',
      username: email.split('@')[0],
      email,
    });
    router.push('/dashboard');
  };

  const logout = async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    setUser(null);
    router.push('/login');
  };

  const register = async (userData: { name: string; email: string; password: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    setUser({
      id: '2',
      name: userData.name,
      username: userData.email.split('@')[0],
      email: userData.email,
    });
    router.push('/dashboard');
  };

  return {
    user,
    isLoading,
    login,
    logout,
    register,
  };
}
