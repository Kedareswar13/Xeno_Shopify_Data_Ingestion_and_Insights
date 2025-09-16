'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { shopifyService } from '@/lib/shopify';
import { formatCurrency } from '@/lib/currency';

type Store = {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
};

type OrderRow = { id: string; number: string; customer: string | null; email: string | null; total: number; status: string | null; createdAt: string };
type CustomerRow = { id: string; name: string; email: string | null; orders: number; totalSpent: number };
type ProductRow = { id: string; title: string; price: number; image?: string | null };

export default function StoresPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [orders, setOrders] = useState<Record<string, OrderRow[]>>({});
  const [customers, setCustomers] = useState<Record<string, CustomerRow[]>>({});
  const [products, setProducts] = useState<Record<string, ProductRow[]>>({});

  useEffect(() => {
    const loadStores = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/api/stores');
        const payload = (res as any)?.data ?? res;
        const list: Store[] =
          payload?.data?.stores ??
          payload?.stores ??
          (Array.isArray(payload) ? payload : []) ?? [];
        setStores(list);
      } catch (e) {
        console.error('Failed to load stores', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStores();
  }, []);

  const toggleExpand = async (store: Store) => {
    const next = !expanded[store.id];
    setExpanded((p) => ({ ...p, [store.id]: next }));
    if (!next) return;

    // Lazy-load tables for this store
    try {
      const [recentOrders, topCustomers, topProducts] = await Promise.all([
        shopifyService.getRecentOrders(store.id, 15).catch(() => []),
        shopifyService.getCustomerInsights(store.id).catch(() => []),
        shopifyService.getTopProducts(store.id, 15).catch(() => []),
      ]);

      setOrders((p) => ({
        ...p,
        [store.id]: (recentOrders as any[]).map((o: any) => ({
          id: o.id,
          number: o.order_number?.toString?.() || o.orderNumber || o.name || String(o.id),
          customer: o.customer?.first_name || o.customer?.firstName ? `${o.customer?.first_name ?? o.customer?.firstName ?? ''} ${o.customer?.last_name ?? o.customer?.lastName ?? ''}`.trim() : o.customerEmail ?? null,
          email: o.customer?.email ?? o.customerEmail ?? null,
          total: Number(o.total_price ?? o.totalPrice ?? 0),
          status: o.financial_status ?? o.financialStatus ?? null,
          createdAt: o.created_at ?? o.createdAt ?? new Date().toISOString(),
        })),
      }));

      setCustomers((p) => ({
        ...p,
        [store.id]: (topCustomers as any[]).map((c: any) => ({
          id: c.id,
          name: c.firstName || c.first_name ? `${c.first_name ?? c.firstName ?? ''} ${c.last_name ?? c.lastName ?? ''}`.trim() : (c.email ?? '—'),
          email: c.email ?? null,
          orders: c.orders_count ?? c.ordersCount ?? 0,
          totalSpent: Number(c.total_spent ?? c.totalSpend ?? 0),
        })),
      }));

      setProducts((p) => ({
        ...p,
        [store.id]: (topProducts as any[]).map((pr: any) => ({
          id: pr.id,
          title: pr.title,
          price: Number(pr.variants?.[0]?.price ?? pr.price ?? 0),
          image: pr.image?.src ?? pr.imageUrl ?? null,
        })),
      }));
    } catch (e) {
      console.error('Failed loading tables for store', store.id, e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Stores</h1>
      {stores.length === 0 ? (
        <p className="text-blue-200">No stores found for your account.</p>
      ) : null}

      <div className="space-y-3">
        {stores.map((store) => (
          <div key={store.id} className="rounded-xl border border-blue-800/50 bg-blue-900/40 shadow-sm">
            <div
              role="button"
              tabIndex={0}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-900/50 transition-colors rounded-t-xl"
              onClick={() => toggleExpand(store)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpand(store);
                }
              }}
            >
              <div>
                <div className="font-medium text-white">{store.name || store.domain}</div>
                <div className="text-xs text-blue-200">{store.domain}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs px-2 py-1 rounded border border-blue-700 text-blue-200 hover:bg-blue-900/40"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await api.post(`/api/shopify/stores/${store.id}/sync`);
                      // Hard reload to reflect latest data immediately across views
                      setTimeout(() => window.location.reload(), 100);
                    } catch (err) {
                      console.error('Manual sync failed', err);
                    }
                  }}
                >
                  Manual Sync
                </button>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded[store.id] ? 'rotate-180' : ''}`} />
            </div>
            {expanded[store.id] ? (
              <div className="px-4 pb-4 pt-1 space-y-6">
                {/* Orders */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Recent Orders</h2>
                    <span className="text-xs text-blue-200">{orders[store.id]?.length ?? 0} items</span>
                  </div>
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto pr-2 custom-scrollbar rounded-md border border-blue-800/40 bg-blue-900/30">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-blue-900/60 text-blue-200">
                        <tr>
                          <th className="px-3 py-2 text-left">Order #</th>
                          <th className="px-3 py-2 text-left">Customer</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Total</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orders[store.id] ?? []).map((o) => (
                          <tr key={o.id} className="border-t border-blue-800/30 text-blue-100">
                            <td className="px-3 py-2 font-medium">{o.number}</td>
                            <td className="px-3 py-2">{o.customer ?? '—'}</td>
                            <td className="px-3 py-2">{o.email ?? '—'}</td>
                            <td className="px-3 py-2">{formatCurrency(o.total)}</td>
                            <td className="px-3 py-2">{o.status ?? '—'}</td>
                            <td className="px-3 py-2">{new Date(o.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Customers */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Top Customers</h2>
                    <span className="text-xs text-blue-200">{customers[store.id]?.length ?? 0} items</span>
                  </div>
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto pr-2 custom-scrollbar rounded-md border border-blue-800/40 bg-blue-900/30">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-blue-900/60 text-blue-200">
                        <tr>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Orders</th>
                          <th className="px-3 py-2 text-left">Total Spent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(customers[store.id] ?? []).map((c) => (
                          <tr key={c.id} className="border-t border-blue-800/30 text-blue-100">
                            <td className="px-3 py-2 font-medium">{c.name}</td>
                            <td className="px-3 py-2">{c.email ?? '—'}</td>
                            <td className="px-3 py-2">{c.orders}</td>
                            <td className="px-3 py-2">{formatCurrency(c.totalSpent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Products */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Top Products</h2>
                    <span className="text-xs text-blue-200">{products[store.id]?.length ?? 0} items</span>
                  </div>
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto pr-2 custom-scrollbar rounded-md border border-blue-800/40 bg-blue-900/30">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-blue-900/60 text-blue-200">
                        <tr>
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-left">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(products[store.id] ?? []).map((p) => (
                          <tr key={p.id} className="border-t border-blue-800/30 text-blue-100">
                            <td className="px-3 py-2 font-medium flex items-center gap-3">
                              {p.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.image} alt={p.title} className="h-7 w-7 rounded object-cover" />
                              ) : null}
                              {p.title}
                            </td>
                            <td className="px-3 py-2">{formatCurrency(p.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
