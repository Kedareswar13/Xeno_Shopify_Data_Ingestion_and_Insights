'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type FormData = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading: isAuthLoading } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasRedirected = useRef(false);
  const isMounted = useRef(true);
  const returnUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnUrl') : null;
  
  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (user) {
      router.push(returnUrl || '/dashboard');
    }
  }, [user, returnUrl, router]);

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Show loading state while checking auth
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    if (isSubmitting) return;
    
    // Prevent multiple submissions
    setIsSubmitting(true);
    
    try {
      const emailTrimmed = data.email.trim().toLowerCase();
      console.log('Attempting login with:', { email: emailTrimmed, hasPassword: !!data.password });
      
      // Reset the form immediately after submission starts
      const form = document.querySelector('form');
      if (form) form.reset();
      
      // Disable the form
      const formElements = form?.elements;
      if (formElements) {
        for (let i = 0; i < formElements.length; i++) {
          (formElements[i] as HTMLInputElement).disabled = true;
        }
      }
      
      // Call the legacy login(email, password) function
      await login(emailTrimmed, data.password);
      
      // Show success message
      toast.success('Login successful!');
      
      // Redirect to the return URL or dashboard
      router.push(returnUrl || '/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      // Show a more specific error message if available
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error(errorMessage);
      
      // Re-enable the form on error
      const form = document.querySelector('form');
      if (form) {
        const formElements = form.elements;
        for (let i = 0; i < formElements.length; i++) {
          (formElements[i] as HTMLInputElement).disabled = false;
        }
      }
    } finally {
      if (isMounted.current) {
        setIsSubmitting(false);
      }
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-blue-900/30  py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-white">
            Or{' '}
            <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
              create a new account
            </Link>
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6" noValidate>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                disabled={isSubmitting}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-white text-white rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={isSubmitting}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-white text-white rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-white">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <Button
              disabled={isSubmitting}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : 'Sign in'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
