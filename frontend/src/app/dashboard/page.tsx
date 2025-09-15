'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SalesOverview } from '@/components/dashboard/analytics/SalesOverview';
import { RecentOrders } from '@/components/dashboard/analytics/RecentOrders';
import { TopProducts } from '@/components/dashboard/analytics/TopProducts';
import { DateRange } from 'react-day-picker';
import { addDays, subDays, format } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { api } from '@/lib/api';
import { shopifyService } from '@/lib/shopify';
import { formatCurrency } from '@/lib/currency';

type Store = {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [hasConnectedStore, setHasConnectedStore] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(undefined);
  const [analytics, setAnalytics] = useState<{ total_revenue: number; total_orders: number; total_products: number; total_customers: number } | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const fetchedRef = useRef(false);
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const loadStores = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setIsLoading(true);
      const response = await api.get('/api/stores');
      const payload = (response as any)?.data ?? response;
      const items: Store[] =
        payload?.data?.stores ??
        payload?.stores ??
        (Array.isArray(payload) ? payload : []) ?? [];
      console.log('Resolved stores length:', Array.isArray(items) ? items.length : 0, items);
      setStores(items);
      const hasStore = items.length > 0;
      setHasConnectedStore(hasStore);
      if (hasStore) {
        const firstId = items[0].id;
        setSelectedStoreId(firstId);
        await ensureSyncedThenFetchAnalytics(firstId);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  };

  const ensureSyncedThenFetchAnalytics = async (storeId: string) => {
    try {
      // Kick off background sync
      api.post(`/api/shopify/stores/${storeId}/sync`).catch(() => {});

      // Poll sync status briefly to let data catch up
      const maxAttempts = 6; // ~6s total with 1s delay
      let attempt = 0;
      let isDataReady = false;

      while (attempt < maxAttempts) {
        try {
          const status: any = await api.get(`/api/shopify/stores/${storeId}/sync-status`);
          const stats = status?.data?.stats || status?.stats || status?.data || {};
          const total = (stats.products || 0) + (stats.customers || 0) + (stats.orders || 0);
          if (total > 0) {
            isDataReady = true;
            break;
          }
        } catch (e) {
          // Ignore and keep trying
        }
        await new Promise((r) => setTimeout(r, 1000));
        attempt++;
      }

      // Fetch analytics regardless after attempts
      const ana = await shopifyService.getStoreAnalytics(storeId);
      setAnalytics(ana);
    } catch (err) {
      console.error('Failed to ensure sync/fetch analytics', err);
      setAnalytics(null);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    // Only run this effect on the client side
    if (typeof window === 'undefined') return;

    // Only proceed if auth state is loaded
    if (isAuthLoading) return;

    if (!user) {
      console.log('No user found in dashboard, redirecting to login');
      router.replace('/login');
      return;
    }

    // If we have a user, fetch their stores

    const userId = (user as any)?.id ?? 'anonymous';
    const guardKey = `dashboardFetched:${userId}`;
    const alreadyFetched = typeof window !== 'undefined' ? sessionStorage.getItem(guardKey) === '1' : false;
    if (!fetchedRef.current && !alreadyFetched) {
      fetchedRef.current = true;
      sessionStorage.setItem(guardKey, '1');
      loadStores();
    } else if (alreadyFetched) {
      // If we previously fetched but state is empty (e.g., after login), attempt one fetch
      if (stores.length === 0 && !fetchingRef.current) {
        loadStores();
      } else {
        // Avoid spinner when skipping fetch due to guard
        setIsLoading(false);
      }
    }
    return () => {
      mountedRef.current = false;
    };
  }, [user, isAuthLoading]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Empty state if no connected stores
  if (!hasConnectedStore || !selectedStoreId) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-white">No connected stores</h2>
          <p className="text-blue-200">Connect a Shopify store to see analytics on your dashboard.</p>
          <div className="flex items-center gap-3 justify-center">
            <Button onClick={() => router.push('/stores')}>Connect a Store</Button>
            <Button variant="outline" onClick={async () => { sessionStorage.removeItem(`dashboardFetched:${(user as any)?.id ?? 'anonymous'}`); await loadStores(); }}>Retry loading</Button>
          </div>
        </div>
      </div>
    );
  }
  // Navigation items
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { name: 'Store', href: '/store', icon: 'store' },
    { name: 'Settings', href: '/settings', icon: 'settings' },
  ] as const;

  if (!hasConnectedStore) {
    return (
      <div className="p-6">
        <div className="p-6 dark:bg-blue-900/30  rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Connect Your First Store</h2>
          <p className="text-white mb-6">
            Get started by connecting your Shopify store to access powerful analytics and insights.
          </p>
          <Button 
            onClick={() => router.push('/stores/connect')}
            className="w-full sm:w-auto"
          >
            Connect Store
          </Button>
        </div>
          
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {[
            {
              title: 'Track Sales',
              description: 'Monitor your store performance with real-time analytics.',
              icon: '📊'
            },
            {
              title: 'Manage Products',
              description: 'View and update your product inventory in one place.',
              icon: '📦'
            },
            {
              title: 'Customer Insights',
              description: 'Understand your customers and their buying behavior.',
              icon: '👥'
            }
          ].map((feature, index) => (
            <div key={index} className="p-4  dark:bg-blue-900 rounded-lg border border-gray-200 shadow-sm">
              <div className="text-2xl mb-3">{feature.icon}</div>
              <h3 className="font-medium text-white">{feature.title}</h3>
              <p className="text-sm text-white mt-1">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-gray-400">Welcome back! Here's what's happening with your store.</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              className="bg-blue-900/50 border border-blue-800/50 rounded-md px-3 py-2 text-white"
              value={selectedStoreId}
              onChange={async (e) => {
                const id = e.target.value;
                setSelectedStoreId(id);
                await ensureSyncedThenFetchAnalytics(id);
              }}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name || s.domain}</option>
              ))}
            </select>
            <Button 
              onClick={() => selectedStoreId && ensureSyncedThenFetchAnalytics(selectedStoreId)}
              className="w-full sm:w-auto"
            >
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Date Range Picker */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Button 
              variant={!dateRange?.from || dateRange.from.getTime() === subDays(new Date(), 7).setHours(0, 0, 0, 0) ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange({
                from: subDays(new Date(), 7),
                to: new Date(),
              })}
            >
              Last 7 days
            </Button>
            <Button 
              variant={dateRange?.from?.getTime() === subDays(new Date(), 30).setHours(0, 0, 0, 0) ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange({
                from: subDays(new Date(), 30),
                to: new Date(),
              })}
            >
              Last 30 days
            </Button>
            <Button 
              variant={dateRange?.from?.getTime() === subDays(new Date(), 90).setHours(0, 0, 0, 0) ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange({
                from: subDays(new Date(), 90),
                to: new Date(),
              })}
            >
              Last 90 days
            </Button>
          </div>
          <div className="w-full sm:w-auto">
            <DateRangePicker 
              date={dateRange} 
              setDate={setDateRange} 
            />
          </div>
        </div>
      </div>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {([
          { 
            title: 'Total Revenue', 
            value: analytics ? formatCurrency(analytics.total_revenue) : '—', 
            change: '', 
            trend: 'up',
            icon: '💰'
          },
          { 
            title: 'Total Orders', 
            value: analytics ? `${analytics.total_orders.toLocaleString()}` : '—', 
            change: '', 
            trend: 'up',
            icon: '📦'
          },
          { 
            title: 'Active Products', 
            value: analytics ? `${analytics.total_products.toLocaleString()}` : '—', 
            change: '', 
            trend: 'up',
            icon: '🏷️'
          },
          { 
            title: 'Total Customers', 
            value: analytics ? `${analytics.total_customers.toLocaleString()}` : '—', 
            change: '', 
            trend: 'up',
            icon: '👥'
          },
        ] as const).map((stat, index) => (
          <div 
            key={index} 
            className="bg-blue-900/50 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-blue-800/50 hover:border-blue-700/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-blue-200 text-sm font-medium">{stat.title}</p>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold mt-2 text-white">{stat.value}</p>
            <p className={`text-xs mt-2 flex items-center ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
              <span>{stat.change} {stat.change ? 'from last month' : ''}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Full Width on mobile, 2/3 on desktop */}
        <div className="lg:col-span-2 space-y-6">
          <SalesOverview dateRange={dateRange} storeId={selectedStoreId} />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          <RecentOrders dateRange={dateRange} storeId={selectedStoreId} />
          <TopProducts dateRange={dateRange} storeId={selectedStoreId} />
        </div>
      </div>
    </div>
  );
}
