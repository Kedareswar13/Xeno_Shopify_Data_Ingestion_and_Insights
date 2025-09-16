"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { shopifyService } from "@/lib/shopify";

function HeatCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = `rgba(59, 130, 246, ${0.1 + intensity * 0.8})`; // blue with varying opacity
  return <div className="h-6 w-8 rounded" style={{ backgroundColor: bg }} title={`${value}`} />;
}

const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function TrafficHeatmap({ storeId, dateRange, metric = 'orders' as 'orders' | 'revenue' }: { storeId?: string; dateRange?: DateRange; metric?: 'orders' | 'revenue' }) {
  const { data, isLoading } = useQuery({
    queryKey: ["traffic-heatmap", storeId, metric, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!storeId || !dateRange?.from) return null as any;
      return shopifyService.getTrafficHeatmap(storeId, { startDate: dateRange.from, endDate: dateRange.to ?? new Date(), metric });
    },
    enabled: !!storeId && !!dateRange?.from,
  });

  if (isLoading || !data) {
    return (
      <Card className="w-full">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  const heat = data.heatmap || [];
  const max = Math.max(0, ...heat.flat());

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Traffic Heatmap ({metric === 'revenue' ? 'Revenue' : 'Orders'})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(24, 1fr)` }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-[10px] text-blue-200 text-center">{h}</div>
              ))}
              {heat.map((row: number[], dow: number) => (
                <>
                  <div key={`label-${dow}`} className="text-xs text-blue-200 h-6 flex items-center">{days[dow]}</div>
                  {row.map((val: number, hr: number) => (
                    <HeatCell key={`${dow}-${hr}`} value={val} max={max} />
                  ))}
                </>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
