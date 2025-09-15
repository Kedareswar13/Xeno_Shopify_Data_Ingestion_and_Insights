'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { shopifyService } from '@/lib/shopify';
import { Button } from '@/components/ui/button';

interface OrderRow {
  id: string;
  number: string;
  customer: string | null;
  email: string | null;
  total: number;
  status: string | null;
  createdAt: string;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  orders: number;
  totalSpent: number;
}

interface ProductRow {
  id: string;
  title: string;
  price: number;
  image?: string | null;
}

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const storeId = params?.storeId as string | undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [dateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  useEffect(() => {
    if (!storeId) return;

    const load = async () => {
      try {
        setIsLoading(true);
        // Recent Orders
        const recents = await shopifyService.getRecentOrders(storeId, 20);
        const orderRows: OrderRow[] = recents.map((o: any) => ({
          id: o.id,
          number: o.order_number?.toString?.() || o.orderNumber || o.name || String(o.id),
          customer: o.customer?.first_name || o.customer?.firstName ? `${o.customer?.first_name ?? o.customer?.firstName ?? ''} ${o.customer?.last_name ?? o.customer?.lastName ?? ''}`.trim() : o.customerEmail ?? null,
          email: o.customer?.email ?? o.customerEmail ?? null,
          total: Number(o.total_price ?? o.totalPrice ?? 0),
          status: o.financial_status ?? o.financialStatus ?? null,
          createdAt: o.created_at ?? o.createdAt ?? new Date().toISOString(),
        }));
        setOrders(orderRows);

        // Top Customers (by spend)
        const insights = await shopifyService.getCustomerInsights(storeId);
        const customerRows: CustomerRow[] = insights.map((c: any) => ({
          id: c.id,
          name: c.firstName || c.first_name ? `${c.first_name ?? c.firstName ?? ''} ${c.last_name ?? c.lastName ?? ''}`.trim() : (c.email ?? '—'),
          email: c.email ?? null,
          orders: c.orders_count ?? c.ordersCount ?? 0,
          totalSpent: Number(c.total_spent ?? c.totalSpend ?? 0),
        }));
        setCustomers(customerRows);

        // Top Products
        const tops = await shopifyService.getTopProducts(storeId, 20);
        const productRows: ProductRow[] = tops.map((p: any) => ({
          id: p.id,
          title: p.title,
          price: Number(p.variants?.[0]?.price ?? p.price ?? 0),
          image: p.image?.src ?? p.imageUrl ?? null,
        }));
        setProducts(productRows);
      } catch (err) {
        console.error('Failed to load store data', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [storeId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Store Overview</h1>
        <div className="space-x-2">
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
        </div>
      </div>

      {/* Orders Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent Orders</h2>
          <span className="text-sm text-muted-foreground">{orders.length} items</span>
        </div>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Order #</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Total</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{o.number}</td>
                  <td className="px-4 py-2">{o.customer ?? '—'}</td>
                  <td className="px-4 py-2">{o.email ?? '—'}</td>
                  <td className="px-4 py-2">{formatCurrency(o.total)}</td>
                  <td className="px-4 py-2">{o.status ?? '—'}</td>
                  <td className="px-4 py-2">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Customers Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Top Customers</h2>
          <span className="text-sm text-muted-foreground">{customers.length} items</span>
        </div>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Orders</th>
                <th className="px-4 py-2 text-left">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.email ?? '—'}</td>
                  <td className="px-4 py-2">{c.orders}</td>
                  <td className="px-4 py-2">{formatCurrency(c.totalSpent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Products Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Top Products</h2>
          <span className="text-sm text-muted-foreground">{products.length} items</span>
        </div>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur supports-[backdrop-filter]:bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-left">Price</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2 font-medium flex items-center gap-3">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.title} className="h-8 w-8 rounded object-cover" />
                    ) : null}
                    {p.title}
                  </td>
                  <td className="px-4 py-2">{formatCurrency(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
