'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { User, Lock, Trash2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';

// Helper function to get user initials
const getUserInitials = (user: { username?: string } | null) => {
  if (!user?.username) return 'U';
  return user.username
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

type ProfileData = {
  email: string;
  name: string;
  username: string;
};

type PasswordData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function SettingsPage(): React.ReactNode {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState<ProfileData>({
    email: '',
    name: '',
    username: '',
  });

  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Debug: log user when it changes (remove in production)
  useEffect(() => {
    // console.log('SettingsPage user:', user);
    if (!user) return;

    // Only map the server-provided username/name/email into state
    setProfileData((prev) => ({
      email: user.email ?? prev.email,
      name: user.name ?? prev.name,
      username: user.username ?? prev.username,
    }));
  }, [user]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/login');
    }
  }, [user, isAuthLoading, router]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profileData.name || !profileData.username) {
      setError('Name and username are required');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      // Uncomment and call real API if available
      // await api.put('/api/users/me', {
      //   name: profileData.name,
      //   username: profileData.username
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update the user in localStorage (if your app uses it)
      // Prefer to update auth context via a provided setter in useAuth if available
      if (user) {
        const updatedUser = {
          ...user,
          name: profileData.name,
          username: profileData.username,
        };
        try {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch {
          // ignore storage errors
        }
      }

      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      // Real API call:
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });

      // Simulate delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      setSuccess('Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // TODO: Implement account deletion logic
      alert('Account deletion request received');
    }
  };

  // If auth is still loading, show loader
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If not authenticated, render nothing (redirect handled by effect)
  if (!user) {
    return null;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:max-w-6xl lg:mx-auto lg:px-8">
          <div className="py-6 md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {/* Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Profile Information
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="relative h-20 w-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-2xl font-semibold text-blue-600 dark:text-blue-300">
                    {getUserInitials(user)}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {profileData.username || 'User'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{profileData.email}</p>
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Success</AlertTitle>
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          name="name"
                          type="text"
                          className="mt-1"
                          value={profileData.name}
                          onChange={handleProfileChange}
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          name="username"
                          type="text"
                          className="mt-1"
                          value={profileData.username}
                          onChange={handleProfileChange}
                          placeholder="Enter your username"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          className="mt-1 bg-gray-100 dark:bg-gray-700"
                          value={profileData.email}
                          onChange={handleProfileChange}
                          placeholder="Enter your email"
                          disabled
                        />
                        <p className="text-xs text-gray-500 mt-1">Contact support to change your email</p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Change Password Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="w-5 h-5 mr-2" />
                  Change Password
                </CardTitle>
              </CardHeader>

              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Success</AlertTitle>
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        placeholder="Enter current password"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="Enter new password"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder="Confirm new password"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Updating...' : 'Change Password'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Delete Account Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trash2 className="w-5 h-5 mr-2" />
                  Delete Account
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Once your account is deleted, all of its resources and data will be permanently deleted.
                    Before deleting your account, please download any data or information that you wish to retain.
                  </p>

                  <div>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                    >
                      Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
