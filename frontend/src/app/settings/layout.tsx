import { Metadata } from 'next';
import { SidebarNav } from '@/components/dashboard/SidebarNav';

export const metadata: Metadata = {
  title: 'Settings | Xeno Insights',
  description: 'Manage your account settings',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen  dark:bg-gray-800 shadow">
      <SidebarNav />
      <div className="flex-1 ml-64">
        <main className="max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
