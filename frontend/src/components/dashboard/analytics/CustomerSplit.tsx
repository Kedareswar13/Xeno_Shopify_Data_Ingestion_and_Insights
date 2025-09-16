"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { shopifyService } from "@/lib/shopify";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function CustomerSplit({ storeId, dateRange }: { storeId?: string; dateRange?: DateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-split", storeId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!storeId || !dateRange?.from) return null as any;
      return shopifyService.getCustomerSplit(storeId, { startDate: dateRange.from, endDate: dateRange.to ?? new Date() });
    },
    enabled: !!storeId && !!dateRange?.from,
  });

  if (isLoading || !data) {
    return (
      <Card className="w-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = [
    { type: "New", orders: data.new.orders, revenue: data.new.revenue },
    { type: "Returning", orders: data.returning.orders, revenue: data.returning.revenue },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Customers: New vs Returning</CardTitle>
      </CardHeader>
      <CardContent className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis dataKey="type" tick={{ fill: '#9CA3AF' }} axisLine={{ stroke: '#4B5563' }} tickLine={{ stroke: '#4B5563' }} />
            <YAxis tick={{ fill: '#9CA3AF' }} axisLine={{ stroke: '#4B5563' }} tickLine={{ stroke: '#4B5563' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#4B5563' }} itemStyle={{ color: '#E5E7EB' }} />
            <Bar dataKey="orders" name="Orders" fill="#60A5FA" radius={[4,4,0,0]} />
            <Bar dataKey="revenue" name="Revenue" fill="#34D399" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
