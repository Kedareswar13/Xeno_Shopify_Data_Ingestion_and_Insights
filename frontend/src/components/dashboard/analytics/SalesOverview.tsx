'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { shopifyService } from '@/lib/shopify';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DateRange } from 'react-day-picker';
import { addDays, differenceInCalendarDays, format } from 'date-fns';

interface SalesOverviewProps {
  dateRange?: DateRange;
  storeId?: string;
}

export function SalesOverview({ dateRange, storeId: passedStoreId }: SalesOverviewProps) {
  const params = useParams();
  const storeId = (passedStoreId ?? (params?.storeId as string | undefined)) as string | undefined;
  
  // Fetch server-aggregated sales for the date range
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-data', storeId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!storeId || !dateRange?.from) return [] as Array<{ date: string; sales: number; orders: number }>;
      return shopifyService.getSalesData(storeId as string, {
        startDate: dateRange.from,
        endDate: dateRange.to ?? new Date(),
      });
    },
    enabled: !!storeId && !!dateRange?.from,
  });

  // Note: No comparison line needed per requirement

  // Helper: zero-fill days between start and end, and align previous period to current x-axis for visual comparison
  const buildContinuousSeries = (
    data: Array<{ date: string; sales: number; orders: number }>,
    start: Date,
    end: Date
  ) => {
    const map = new Map<string, { sales: number; orders: number }>();
    for (const r of data || []) {
      const key = format(new Date(r.date), 'yyyy-MM-dd');
      map.set(key, { sales: r.sales, orders: r.orders });
    }
    const out: Array<{ dateISO: string; dateLabel: string; sales: number; orders: number }> = [];
    const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(start, i);
      const key = format(d, 'yyyy-MM-dd');
      const val = map.get(key) || { sales: 0, orders: 0 };
      out.push({ dateISO: key, dateLabel: format(d, 'MMM d'), sales: val.sales, orders: val.orders });
    }
    return out;
  };

  const rangeStart = dateRange?.from ?? new Date();
  const rangeEnd = dateRange?.to ?? new Date();
  const currentSeries = buildContinuousSeries(salesData || [], rangeStart, rangeEnd);

  // Build single-series chart data
  const chartData = currentSeries.map((row) => ({
    date: row.dateLabel,
    sales: row.sales,
    orders: row.orders,
  }));

  const totalRevenue = currentSeries.reduce((s, r) => s + (r.sales || 0), 0);
  const periodLabel = dateRange?.from
    ? (dateRange.to
        ? `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`
        : `${dateRange.from.toLocaleDateString()}`)
    : '';
  // Build reduced set of ticks to prevent congestion on long ranges
  const buildTicks = (start: Date, end: Date, desired: number) => {
    const total = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const step = Math.max(1, Math.floor(total / desired));
    const ticks: string[] = [];
    for (let i = 0; i < total; i += step) {
      const d = addDays(start, i);
      ticks.push(format(d, 'MMM d'));
    }
    // Ensure last tick is included
    const lastLabel = format(end, 'MMM d');
    if (ticks[ticks.length - 1] !== lastLabel) ticks.push(lastLabel);
    return ticks;
  };
  const xTicks = buildTicks(rangeStart, rangeEnd, 7);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Sales Overview</CardTitle>
          <div className="text-2xl font-semibold text-white">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalRevenue)}</div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 h-[2px] bg-blue-400 rounded" />
              <span>{periodLabel}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#9CA3AF' }}
              axisLine={{ stroke: '#4B5563' }}
              tickLine={{ stroke: '#4B5563' }}
              ticks={xTicks}
              interval={0}
              minTickGap={12}
            />
            <YAxis 
              tick={{ fill: '#9CA3AF' }}
              axisLine={{ stroke: '#4B5563' }}
              tickLine={{ stroke: '#4B5563' }}
              tickFormatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                borderColor: '#4B5563',
                borderRadius: '0.5rem',
              }}
              itemStyle={{ color: '#E5E7EB' }}
              labelStyle={{ color: '#9CA3AF' }}
              formatter={(value: number, name, props: any) => {
                const label = 'Sales';
                const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value));
                return [inr, label];
              }}
            />
            <Line 
              type="monotone" 
              dataKey="sales" 
              name="Sales" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: '#2563EB', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
