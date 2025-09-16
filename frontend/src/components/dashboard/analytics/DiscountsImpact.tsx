"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { shopifyService } from "@/lib/shopify";

export function DiscountsImpact({ storeId, dateRange }: { storeId?: string; dateRange?: DateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ["discounts-impact", storeId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!storeId || !dateRange?.from) return null as any;
      return shopifyService.getDiscountsSummary(storeId, { startDate: dateRange.from, endDate: dateRange.to ?? new Date() });
    },
    enabled: !!storeId && !!dateRange?.from,
  });

  if (isLoading || !data) {
    return (
      <Card className="w-full">
        <CardHeader><Skeleton className="h-6 w-56" /></CardHeader>
        <CardContent><Skeleton className="h-12 w-40" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Discounts Impact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-blue-200">Total Discounts</div>
        <div className="text-xl font-semibold text-white">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.totalDiscounts)}</div>
        <div className="text-sm text-blue-200">Avg Discount / Order</div>
        <div className="text-xl font-semibold text-white">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.avgDiscountPerOrder)}</div>
        <div className="text-sm text-blue-200">Net Revenue</div>
        <div className="text-xl font-semibold text-white">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(data.netRevenue)}</div>
      </CardContent>
    </Card>
  );
}
