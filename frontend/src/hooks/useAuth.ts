import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { z } from 'zod';
import { useState, useEffect, useRef, useCallback } from 'react';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be less than 30 characters'),
    email: z.string().email('Please enter a valid email'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,}$/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const otpSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    token: z.string().min(1, 'Token is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type User = {
  id: string;
  email: string;
  username?: string;
  name?: string;
  isVerified?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  email: string;
  password: string;
  passwordConfirm: string;
  username: string;
};

type ResetPasswordData = {
  password: string;
  confirmPassword: string;
  token: string;
};

type ResendOtpData = {
  email: string;
};

type ForgotPasswordData = {
  email: string;
};

type VerifyOtpData = {
  email: string;
  otp: string;
};

type ApiResponse<T = any> = {
  data?: T;
  token?: string;
  user?: User;
  message?: string;
  success?: boolean;
};

interface AuthResponse {
  data?: {
    user: User;
    token: string;
  };
  user?: User;
  token?: string;
  success?: boolean;
  message?: string;
}

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<AuthResponse>;
  loginIsLoading: boolean;
  register: (data: RegisterData) => Promise<AuthResponse>;
  registerIsLoading: boolean;
  verifyOtp: (data: VerifyOtpData) => Promise<ApiResponse>;
  verifyOtpIsLoading: boolean;
  resendOtp: (data: ResendOtpData) => Promise<ApiResponse>;
  resendOtpIsLoading: boolean;
  forgotPassword: (data: ForgotPasswordData) => Promise<ApiResponse>;
  forgotPasswordIsLoading: boolean;
  resetPassword: (data: Omit<ResetPasswordData, 'confirmPassword'>) => Promise<ApiResponse>;
  resetPasswordIsLoading: boolean;
  logout: () => void;
  clearUser: () => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMounted = useRef<boolean>(true);

  // Function to clear user data on logout
  const clearUser = useCallback(() => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    queryClient.clear();
  }, [queryClient]);

  // Function to fetch user data
  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      console.log('Fetching user data from /api/auth/me');
      const response = await api.get<AuthResponse>('/api/auth/me');
      console.log('User data from /api/auth/me:', response);
      
      const userData = response.user || response.data?.user;
      if (userData) {
        // Ensure we have all required fields
        const completeUser: User = {
          id: userData.id,
          email: userData.email || '',
          name: userData.name || '',
          username: userData.username || userData.email?.split('@')[0] || '',
          isVerified: userData.isVerified,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        };
        
        setUser(completeUser);
        // Update localStorage with complete user data
        localStorage.setItem('user', JSON.stringify(completeUser));
      } else {
        console.warn('No user data in response');
        clearUser();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      clearUser();
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [clearUser]);

  // Effect to fetch user data on mount and when token changes
  useEffect(() => {
    isMounted.current = true;
    
    // Only fetch if we have a token and we're not already loading
    if (localStorage.getItem('token')) {
      fetchUser();
    } else {
      setIsLoading(false);
    }

    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [fetchUser]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      // First try with the expected response format
      try {
        const response = await api.post<{ user: User; token: string }>('/api/auth/login', data);
        const { user, token } = response;
        
        if (!user || !token) {
          throw new Error('Invalid response format from server');
        }
        
        return { user, token };
      } catch (error: unknown) {
        // If the first attempt fails, try with the alternative format
        const axiosError = error as {
          response?: {
            data?: {
              data?: {
                user: User;
                token: string;
              };
            };
          };
        };
        
        if (axiosError.response?.data?.data) {
          const { user, token } = axiosError.response.data.data;
          if (user && token) {
            return { user, token };
          }
        }
        
        // Re-throw with a more descriptive error if we can't handle it
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('An unknown error occurred during login');
      }
    },
    onSuccess: async ({ user: userData, token }) => {
      console.log('Login successful:', { user: userData });
      
      if (!userData || !token) {
        throw new Error('Invalid login response');
      }
      
      // Ensure we have all required fields
      const completeUser: User = {
        id: userData.id,
        email: userData.email || '',
        name: userData.name || '',
        username: userData.username || userData.email?.split('@')[0] || '',
        isVerified: userData.isVerified,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      };
      
      // Store token and user data
      localStorage.setItem('token', token);
      localStorage.setItem('userId', completeUser.id);
      setUser(completeUser);
      
      // Check if email is verified
      if (!completeUser.isVerified) {
        // Store email for OTP verification
        localStorage.setItem('pendingVerificationEmail', completeUser.email);
        
        // Show message and redirect to OTP verification
        toast.info('Please verify your email address to continue');
        router.push(`/verify-otp?email=${encodeURIComponent(completeUser.email)}`);
        return;
      }
      
      // If email is verified, proceed to dashboard
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success('Login successful! Redirecting...');
      
      // Get return URL from query params or default to dashboard
      const returnUrl = typeof window !== 'undefined' 
        ? new URLSearchParams(window.location.search).get('returnUrl') 
        : null;
      
      const redirectUrl = returnUrl || '/dashboard';
      console.log('Redirecting to:', redirectUrl);
      window.location.href = redirectUrl;
    },
    onError: (error: unknown) => {
      console.error('Login error:', error);
      const errorMessage = 
        (error as any)?.response?.data?.message || 
        (error as Error)?.message || 
        'Login failed. Please check your credentials and try again.';
      toast.error(errorMessage);
      
      // Clear any invalid auth state
      if ((error as any)?.response?.status === 401) {
        clearUser();
      }
    }
  });

  const registerMutation = useMutation<AuthResponse, Error, RegisterData>({
    mutationFn: async (data) => {
      const response = await api.post<AuthResponse>('/api/auth/signup', {
        email: data.email,
        password: data.password,
        username: data.username,
        passwordConfirm: data.passwordConfirm // Add password confirmation to the request
      });
      return response;
    },
    onSuccess: async (response) => {
      console.log('Registration response:', response);
      
      // Get email from response or form data
      const email = response?.user?.email || response?.data?.user?.email;
      
      if (email) {
        // Store email in localStorage for OTP verification
        localStorage.setItem('pendingVerificationEmail', email);
        
        // Redirect to OTP verification page
        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
        toast.success('Registration successful! Please enter the OTP sent to your email.');
      } else {
        // Fallback in case email is not available
        toast.success('Registration successful! Please check your email for verification instructions.');
        router.push('/login');
      }
    },
    onError: (error: unknown) => {
      console.error('Registration error:', error);
      
      // Show error message to user
      const errorMessage = 
        (error as any)?.response?.data?.message || 
        (error as Error)?.message || 
        'Registration failed';
      toast.error(errorMessage);
      
      // Clear any invalid auth state
      if ((error as any)?.response?.status === 401) {
        clearUser();
      }
    }
  });

  // Verify OTP mutation
  const verifyOtpMutation = useMutation<ApiResponse, Error, VerifyOtpData>({
    mutationFn: async (data) => {
      const response = await api.post<ApiResponse>('/api/auth/verify-otp', data);
      return response;
    },
    onSuccess: async (response) => {
      console.log('OTP verification response:', response);
      
      // Handle the token and user data from the response
      const token = response.token;
      const userData = response.user;

      if (token && userData) {
        // Store the token and user data
        localStorage.setItem('token', token);
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userId', userData.id);
        localStorage.removeItem('pendingVerificationEmail');
        
        // Invalidate any cached queries that depend on auth state
        await queryClient.invalidateQueries({ queryKey: ['auth'] });
        
        // Show success message and redirect
        toast.success('Email verified successfully! Redirecting...');
        
        // Force a hard refresh to ensure all auth state is properly set
        window.location.href = '/dashboard';
        return;
      }
      
      // If we get here, something went wrong with the response
      toast.success('Email verified successfully! Please log in.');
      router.push('/login');
    },
    onError: (error: any) => {
      console.error('OTP verification error:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to verify OTP. Please try again.';
      toast.error(errorMessage);
      
      // Clear any invalid auth state
      if (error?.response?.status === 401) {
        clearUser();
      }
    }
  });

  // Resend OTP mutation
  const resendOtpMutation = useMutation<ApiResponse, Error, ResendOtpData>({
    mutationFn: async (data) => {
      const response = await api.post<ApiResponse>('/api/auth/resend-otp', data);
      return response;
    },
    onSuccess: (response) => {
      console.log('Resend OTP response:', response);
      toast.success('Verification code has been resent');
    },
    onError: (error: any) => {
      console.error('Resend OTP error:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to resend verification code. Please try again.';
      toast.error(errorMessage);
      
      if (error?.response?.status === 401) {
        clearUser();
      }
    }
  });

  // Forgot password mutation
  const forgotPasswordMutation = useMutation<ApiResponse, Error, ForgotPasswordData>({
    mutationFn: async (data) => {
      const response = await api.post<ApiResponse>('/api/auth/forgot-password', data);
      return response;
    },
    onSuccess: (response) => {
      console.log('Forgot password response:', response);
      toast.success('Password reset instructions sent to your email');
      router.push('/login');
    },
    onError: (error: any) => {
      console.error('Forgot password error:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to process forgot password request. Please try again.';
      toast.error(errorMessage);
      
      // Clear any invalid auth state
      if (error?.response?.status === 401) {
        clearUser();
      }
    }
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation<ApiResponse, Error, Omit<ResetPasswordData, 'confirmPassword'>>({
    mutationFn: async (data) => {
      const response = await api.post<ApiResponse>('/api/auth/reset-password', data);
      return response;
    },
    onSuccess: (response) => {
      console.log('Reset password response:', response);
      toast.success('Password has been reset successfully');
      router.push('/login');
    },
    onError: (error: any) => {
      console.error('Reset password error:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to reset password. Please try again.';
      toast.error(errorMessage);
      
      // Clear any invalid auth state
      if (error?.response?.status === 401) {
        clearUser();
      }
    }
  });

  // Logout function
  const logout = async () => {
    try {
      // Call the logout endpoint to clear the HTTP-only cookie
      await api.get<ApiResponse>('/api/auth/logout');
    } catch (error) {
      console.error('Logout API error (proceeding with client-side cleanup):', error);
    } finally {
      // Clear user data and any cached queries
      clearUser();
      
      // Invalidate any cached queries that depend on auth state
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      
      // Show success message
      toast.success('Successfully logged out');
      
      // Force a full page reload to ensure all state is cleared
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    loginIsLoading: loginMutation.isLoading || isLoading,
    register: registerMutation.mutateAsync,
    registerIsLoading: registerMutation.isLoading,
    verifyOtp: verifyOtpMutation.mutateAsync,
    verifyOtpIsLoading: verifyOtpMutation.isLoading,
    resendOtp: resendOtpMutation.mutateAsync,
    resendOtpIsLoading: resendOtpMutation.isLoading,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    forgotPasswordIsLoading: forgotPasswordMutation.isLoading,
    resetPassword: resetPasswordMutation.mutateAsync,
    resetPasswordIsLoading: resetPasswordMutation.isLoading,
    logout,
    clearUser,
  };
}