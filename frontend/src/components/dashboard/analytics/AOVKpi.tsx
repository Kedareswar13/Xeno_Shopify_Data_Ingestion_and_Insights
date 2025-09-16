"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { shopifyService } from "@/lib/shopify";

export function AOVKpi({ storeId, dateRange }: { storeId?: string; dateRange?: DateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ["aov", storeId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!storeId || !dateRange?.from) return [] as Array<{ date: string; sales: number; orders: number }>;
      return shopifyService.getSalesData(storeId, {
        startDate: dateRange.from,
        endDate: dateRange.to ?? new Date(),
      });
    },
    enabled: !!storeId && !!dateRange?.from,
  });

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
        <CardContent><Skeleton className="h-8 w-32" /></CardContent>
      </Card>
    );
  }

  const totalSales = (data || []).reduce((s, r) => s + (r.sales || 0), 0);
  const totalOrders = (data || []).reduce((s, r) => s + (r.orders || 0), 0);
  const aov = totalOrders > 0 ? totalSales / totalOrders : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Average Order Value</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm text-blue-200">Total Sales</div>
          <div className="text-xl font-semibold text-white">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalSales)}</div>
        </div>
        <div>
          <div className="text-sm text-blue-200">Total Orders</div>
          <div className="text-xl font-semibold text-white">{totalOrders}</div>
        </div>
        <div>
          <div className="text-sm text-blue-200">Average Order Value</div>
          <div className="text-2xl font-semibold text-white">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(aov)}</div>
        </div>
      </CardContent>
    </Card>
  );
}
