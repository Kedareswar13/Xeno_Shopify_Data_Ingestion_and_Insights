'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      toast.success('If an account exists, a reset code has been sent.');
      router.push(`/reset-otp?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to send reset code';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-blue-900/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Forgot your password?</h2>
          <p className="mt-2 text-center text-sm text-white">
            Enter your email and we'll send you a one-time code to reset your password.
          </p>
        </div>
        <form onSubmit={onSubmit} className="mt-8 space-y-6" noValidate>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                disabled={isSubmitting}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-white text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
                Back to login
              </Link>
            </div>
          </div>

          <div>
            <Button disabled={isSubmitting} className={`w-full ${isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {isSubmitting ? 'Sending...' : 'Send reset code'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
