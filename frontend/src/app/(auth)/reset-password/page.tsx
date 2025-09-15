'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const e = search.get('email');
    const o = search.get('otp');
    if (e) setEmail(e);
    if (o) setOtp(o);
  }, [search]);

  const valid = useMemo(() => {
    return (
      email && otp && otp.length === 6 && password.length >= 8 && password === confirmPassword
    );
  }, [email, otp, password, confirmPassword]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { email, otp, password, passwordConfirm: confirmPassword });
      toast.success('Password reset successful. Please log in.');
      router.replace('/login');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to reset password';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-blue-900/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Set a new password</h2>
          <p className="mt-2 text-center text-sm text-white">Enter the code and your new password</p>
        </div>
        <form onSubmit={onSubmit} className="mt-8 space-y-6" noValidate>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white mb-1">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <label className="block text-sm text-white mb-1">6-digit OTP</label>
              <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" pattern="\\d{6}" maxLength={6} required />
            </div>
            <div>
              <label className="block text-sm text-white mb-1">New password</label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </div>
            <div>
              <label className="block text-sm text-white mb-1">Confirm new password</label>
              <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" required />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">Back to login</Link>
            </div>
          </div>
          <div>
            <Button disabled={isSubmitting || !valid} className={`w-full ${isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {isSubmitting ? 'Resetting...' : 'Reset password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
