'use client';

// Thin adapter to the real provider at providers/AuthProvider,
// preserving the previous API shape used across the app.

import React, { type ReactNode } from 'react';
import { AuthProvider as RealAuthProvider, useAuth as useRealAuth } from '@/providers/AuthProvider';

export interface User {
  id: string;
  name?: string;
  username?: string;
  email: string;
}

type LegacyAuthContext = {
  user: User | null;
  isLoading: boolean; // alias to `loading`
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void> | void;
  register: (userData: { name: string; email: string; password: string }) => Promise<void>;
};

export default function AuthProvider({ children }: { children: ReactNode }) {
  return React.createElement(RealAuthProvider as any, null, children);
}

export function useAuth(): LegacyAuthContext {
  const ctx = useRealAuth() as any;
  // Map `loading` -> `isLoading` to keep existing pages working
  return {
    user: ctx.user || null,
    isLoading: !!ctx.loading,
    login: ctx.login,
    logout: ctx.logout,
    register: async ({ name, email, password }: { name: string; email: string; password: string }) => {
      await ctx.register(name, email, password);
    },
  };
}
