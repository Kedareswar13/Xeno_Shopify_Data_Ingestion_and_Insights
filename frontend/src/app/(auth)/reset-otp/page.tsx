'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ResetOtpPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const e = search.get('email');
    if (e) setEmail(e);
  }, [search]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!email) throw new Error('Missing email');
      if (!otp || otp.length !== 6) throw new Error('Enter the 6-digit OTP');
      router.push(`/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`);
    } catch (err: any) {
      toast.error(err?.message || 'Please enter the OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-blue-900/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Enter the reset code</h2>
          <p className="mt-2 text-center text-sm text-white">Check your email for the 6-digit code</p>
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
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-indigo-400 hover:text-indigo-300">Resend code</Link>
            </div>
          </div>
          <div>
            <Button disabled={isSubmitting} className={`w-full ${isSubmitting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {isSubmitting ? 'Verifying...' : 'Verify code'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
