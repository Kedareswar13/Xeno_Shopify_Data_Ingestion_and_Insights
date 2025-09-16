"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { shopifyService } from "@/lib/shopify";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function SalesByType({ storeId, dateRange, groupBy = 'productType' as 'productType' | 'vendor' }: { storeId?: string; dateRange?: DateRange; groupBy?: 'productType' | 'vendor' }) {
  const { data, isLoading } = useQuery({
    queryKey: ["sales-by-type", storeId, groupBy, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!storeId || !dateRange?.from) return [] as Array<{ type: string; revenue: number; orders: number }>;
      return shopifyService.getSalesByType(storeId, { startDate: dateRange.from, endDate: dateRange.to ?? new Date(), groupBy });
    },
    enabled: !!storeId && !!dateRange?.from,
  });

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader><Skeleton className="h-6 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-[240px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sales by {groupBy === 'vendor' ? 'Vendor' : 'Product Type'}</CardTitle>
      </CardHeader>
      <CardContent className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="type" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#4B5563' }} tickLine={{ stroke: '#4B5563' }} angle={-20} textAnchor="end" />
            <YAxis tick={{ fill: '#9CA3AF' }} axisLine={{ stroke: '#4B5563' }} tickLine={{ stroke: '#4B5563' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563' }} itemStyle={{ color: '#E5E7EB' }} />
            <Bar dataKey="revenue" name="Revenue" fill="#60A5FA" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
