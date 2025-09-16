import { Metadata } from 'next';
import { SidebarNav } from '@/components/dashboard/SidebarNav';

export const metadata: Metadata = {
  title: 'Stores | Xeno Insights',
  description: 'Manage your connected stores',
};

export default function StoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-blue-900/30">
      <SidebarNav />
      <div className="flex-1 ml-64 p-6">
        <main className="max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
