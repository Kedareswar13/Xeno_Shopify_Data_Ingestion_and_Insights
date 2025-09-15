'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const router = useRouter();
  const { toast } = useToast();
  const { verifyOtp, resendOtp } = useAuth();

  // Handle OTP input change
  const handleChange = (index: number, value: string) => {
    if (value && !/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input on number input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();
    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otp];
      const pastedChars = pastedData.split('').slice(0, 6);
      
      pastedChars.forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      
      setOtp(newOtp);
      
      // Focus the next empty input or the last one if all are filled
      const nextIndex = Math.min(pastedChars.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    if (!email) {
      toast.error('Email is required');
      return;
    }

    setIsLoading(true);
    try {
      await verifyOtp({ email, otp: otpCode });
      toast.success('Email verified successfully! Redirecting to dashboard...');
      // Redirect to dashboard after successful verification
      router.push('/dashboard');
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Invalid or expired verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    if (!email || resendDisabled) return;

    try {
      await resendOtp({ email });
      setResendDisabled(true);
      setResendTimer(30);
      
      toast.success('A new verification code has been sent to your email');
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast.error('Failed to resend verification code');
    }
  };

  // Resend timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (resendDisabled && resendTimer > 0) {
      timer = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setResendDisabled(false);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendDisabled, resendTimer]);

  // Auto-submit when all OTP digits are entered
  useEffect(() => {
    if (otp.every(digit => digit !== '') && otp.length === 6) {
      handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    }
  }, [otp]);

  return (
    <div className="min-h-screen flex items-center justify-center dark:bg-blue-900/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Verify your email
          </h2>
          <p className="mt-2 text-center text-sm text-white">
            We've sent a 6-digit verification code to {email || 'your email'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="flex justify-center space-x-2">
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el: HTMLInputElement | null) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  value={digit}
                  maxLength={1}
                  className="w-12 h-12 text-center text-xl font-semibold"
                  inputMode="numeric"
                  pattern="\d*"
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={isLoading}
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>

          <div className="text-center text-sm text-white">
            Didn't receive a code?{' '}
            <button 
              type="button" 
              onClick={handleResendOtp} 
              disabled={resendDisabled || !email}
              className={`font-medium ${resendDisabled ? 'text-white' : 'text-indigo-600 hover:text-indigo-500'}`}
            >
              {resendDisabled ? `Resend in ${resendTimer}s` : 'Resend'}
            </button>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 "
              disabled={isLoading || otp.some(digit => digit === '')}
            >
              {isLoading ? 'Verifying...' : 'Verify Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
