'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { shopifyService } from '@/lib/shopify';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRange } from 'react-day-picker';
import { formatCurrency } from '@/lib/currency';

interface ProductData {
  id: string;
  title: string;
  price: number;
  sold: number;
  revenue: number;
}

interface TopProductsProps {
  dateRange?: DateRange;
  storeId?: string;
}

export function TopProducts({ dateRange, storeId: passedStoreId }: TopProductsProps) {
  const params = useParams();
  const storeId = (passedStoreId ?? (params?.storeId as string | undefined)) as string | undefined;
  
  const { data: products, isLoading } = useQuery({
    queryKey: ['topProducts', storeId, dateRange],
    queryFn: async (): Promise<ProductData[]> => {
      // Use backend-calculated sold counts and revenue
      const apiProducts = await shopifyService.getTopProducts(storeId as string, 20);
      return apiProducts as unknown as ProductData[];
    },
    enabled: !!storeId,
  });
  const productsData = (products as ProductData[]) || [];

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle>Top Products</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle>Top Products</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Scrollable list */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {(productsData || []).map((product: ProductData) => (
            <div key={product.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {product.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCurrency(product.price)}
                </p>
              </div>
              <div className="text-right ml-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {product.sold} sold
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCurrency(product.revenue)} revenue
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
