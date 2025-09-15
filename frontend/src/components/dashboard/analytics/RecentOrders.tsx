'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { shopifyService, Order } from '@/lib/shopify';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from 'react-day-picker';

interface RecentOrdersProps {
  dateRange?: DateRange;
  storeId?: string;
}

export function RecentOrders({ dateRange, storeId: passedStoreId }: RecentOrdersProps) {
  const params = useParams();
  const storeId = (passedStoreId ?? (params?.storeId as string | undefined)) as string | undefined;
  
  const { data: orders, isLoading } = useQuery({
    queryKey: ['recentOrders', storeId, dateRange],
    queryFn: () => {
      // In a real app, you would pass the date range to your API
      return shopifyService.getRecentOrders(storeId as string, 50);
    },
    enabled: !!storeId,
  });
  // Generate mock data based on date range
  const generateMockData = (): Order[] => {
    const statuses = ['Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
    const daysAgo = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date;
    };

    return Array.from({ length: 5 }, (_, i) => ({
      id: `#${Math.floor(10000 + Math.random() * 90000)}`,
      name: `Order #${1000 + i}`,
      createdAt: daysAgo(Math.floor(Math.random() * 30)).toISOString(),
      financialStatus: statuses[Math.floor(Math.random() * statuses.length)],
      totalPrice: (Math.random() * 500 + 50).toFixed(2),
      lineItems: [{
        title: `Product ${i + 1}`,
        quantity: Math.floor(Math.random() * 5) + 1,
        originalTotalPrice: (Math.random() * 400 + 50).toFixed(2)
      }],
      customer: {
        firstName: 'Customer',
        lastName: `${i + 1}`,
        email: `customer${i + 1}@example.com`
      }
    }));
  };

  const ordersData = orders || generateMockData();

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Shipped':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Orders</CardTitle>
          {dateRange?.from && (
            <span className="text-xs text-muted-foreground">
              {dateRange.to 
                ? `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`
                : `Since ${dateRange.from.toLocaleDateString()}`}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Scrollable list */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
          {ordersData.map((order, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{order.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {order.customer?.firstName} {order.customer?.lastName}
                </p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(order.financialStatus)}`}>
                  {order.financialStatus}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  ₹{parseFloat(order.totalPrice).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(order.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
