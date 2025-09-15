import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Metric = {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
};

export function Metrics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['store-metrics'],
    queryFn: async () => {
      const response = await api.get('/api/stores/metrics');
      return response.data;
    },
  });

  const metrics: Metric[] = [
    {
      title: 'Total Orders',
      value: data?.totalOrders ?? 0,
      description: 'Across all stores',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          className="h-4 w-4 text-muted-foreground"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      title: 'Total Products',
      value: data?.totalProducts ?? 0,
      description: 'Across all stores',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          className="h-4 w-4 text-muted-foreground"
        >
          <path d="M12 2v20" />
          <path d="M2 12h20" />
          <path d="M2 6h20" />
          <path d="M2 18h20" />
        </svg>
      ),
    },
    {
      title: 'Total Profit',
      value: data?.totalProfit ? `$${data.totalProfit.toLocaleString()}` : '$0',
      description: 'Total revenue across all stores',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          className="h-4 w-4 text-muted-foreground"
        >
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
  ];

  if (error) {
    return <div className="text-red-500">Error loading metrics</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric, index) => (
        <Card key={index} className="bg-gradient-to-br from-white to-gray-50 border border-gray-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">{metric.icon}</div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{metric.value}</div>
            )}
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
