import { api } from '@/lib/api';

export interface Product {
  id: string;
  title: string;
  handle: string;
  images: Array<{ src: string }>;
  variants: Array<{
    price: string;
    compareAtPrice: string;
    inventoryQuantity: number;
  }>;
  totalInventory: number;
  status: 'active' | 'draft' | 'archived';
}

export interface Order {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string;
  totalPrice: string;
  lineItems: Array<{
    title: string;
    quantity: number;
    originalTotalPrice: string;
  }>;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  note?: string;
}

export interface Customer {
  id: string;
  displayName: string;
  email: string;
  totalSpent: string;
  ordersCount: number;
  lastOrderDate?: string;
}

export const shopifyService = {
  // List stores for current tenant
  async listStores(params?: { page?: number; limit?: number; search?: string }) {
    const q: string[] = [];
    if (params?.page) q.push(`page=${params.page}`);
    if (params?.limit) q.push(`limit=${params.limit}`);
    if (params?.search) q.push(`search=${encodeURIComponent(params.search)}`);
    const qs = q.length ? `?${q.join('&')}` : '';
    const data = await api.get(`/api/stores${qs}`);
    return data;
  },

  // Connect a new store (domain + accessToken, optional name)
  async connectStore(input: { domain: string; accessToken: string; name?: string }) {
    const data = await api.post(`/api/stores`, input);
    return data;
  },

  // Trigger manual sync for a store
  async manualSync(storeId: string) {
    const data = await api.post(`/api/shopify/stores/${storeId}/sync`);
    return data;
  },
  // Fetch store analytics
  async getStoreAnalytics(storeId: string) {
    const data = await api.get(`/api/shopify/stores/${storeId}/analytics`);
    return data;
  },

  // Get top performing products
  async getTopProducts(storeId: string, limit: number = 5) {
    const data = await api.get(
      `/api/shopify/stores/${storeId}/products/top?limit=${limit}`
    );
    return data as Product[];
  },

  // Get recent orders
  async getRecentOrders(storeId: string, limit: number = 5) {
    const data = await api.get(
      `/api/shopify/stores/${storeId}/orders/recent?limit=${limit}`
    );
    return data as Order[];
  },

  // Get customer insights
  async getCustomerInsights(storeId: string) {
    const data = await api.get(
      `/api/shopify/stores/${storeId}/customers/insights`
    );
    return data;
  },

  // AI-Powered Product Performance Prediction (Unique Feature #1)
  async predictProductPerformance(storeId: string, productId: string) {
    const data = await api.post(
      `/api/shopify/ai/predict-performance`,
      { storeId, productId }
    );
    return data;
  },

  // Customer Sentiment Analysis (Unique Feature #2)
  async analyzeCustomerSentiment(storeId: string) {
    const data = await api.get(
      `/api/shopify/ai/analyze-sentiment?storeId=${storeId}`
    );
    return data;
  },

  // Get sales data for charts (server-aggregated). If start/end provided, they take precedence over period.
  async getSalesData(
    storeId: string,
    options?: { period?: 'day' | 'week' | 'month'; startDate?: Date; endDate?: Date }
  ) {
    const params: string[] = [];
    const period = options?.period ?? 'week';
    if (!options?.startDate && !options?.endDate) {
      params.push(`period=${period}`);
    }
    if (options?.startDate) {
      params.push(`startDate=${encodeURIComponent(options.startDate.toISOString())}`);
    }
    if (options?.endDate) {
      params.push(`endDate=${encodeURIComponent(options.endDate.toISOString())}`);
    }
    const qs = params.length ? `?${params.join('&')}` : '';
    const data = await api.get(
      `/api/shopify/stores/${storeId}/sales${qs}`
    );
    return data as Array<{ date: string; sales: number; orders: number }>;
  },

  // Get inventory status
  async getInventoryStatus(storeId: string) {
    const data = await api.get(
      `/api/shopify/stores/${storeId}/inventory`
    );
    return data;
  },

  // New analytics helpers
  async getCustomerSplit(storeId: string, options?: { startDate?: Date; endDate?: Date }) {
    const qs: string[] = [];
    if (options?.startDate) qs.push(`startDate=${encodeURIComponent(options.startDate.toISOString())}`);
    if (options?.endDate) qs.push(`endDate=${encodeURIComponent(options.endDate.toISOString())}`);
    const q = qs.length ? `?${qs.join('&')}` : '';
    return api.get(`/api/shopify/stores/${storeId}/customers/split${q}`) as Promise<{
      new: { orders: number; revenue: number };
      returning: { orders: number; revenue: number };
      startDate: string; endDate: string;
    }>;
  },

  async getSalesByType(storeId: string, options?: { startDate?: Date; endDate?: Date; groupBy?: 'productType' | 'vendor' }) {
    const qs: string[] = [];
    if (options?.startDate) qs.push(`startDate=${encodeURIComponent(options.startDate.toISOString())}`);
    if (options?.endDate) qs.push(`endDate=${encodeURIComponent(options.endDate.toISOString())}`);
    if (options?.groupBy) qs.push(`groupBy=${options.groupBy}`);
    const q = qs.length ? `?${qs.join('&')}` : '';
    return api.get(`/api/shopify/stores/${storeId}/sales/by-type${q}`) as Promise<Array<{ type: string; revenue: number; orders: number }>>;
  },

  async getTrafficHeatmap(storeId: string, options?: { startDate?: Date; endDate?: Date; metric?: 'orders' | 'revenue' }) {
    const qs: string[] = [];
    if (options?.startDate) qs.push(`startDate=${encodeURIComponent(options.startDate.toISOString())}`);
    if (options?.endDate) qs.push(`endDate=${encodeURIComponent(options.endDate.toISOString())}`);
    if (options?.metric) qs.push(`metric=${options.metric}`);
    const q = qs.length ? `?${qs.join('&')}` : '';
    return api.get(`/api/shopify/stores/${storeId}/traffic/heatmap${q}`) as Promise<{ metric: 'orders' | 'revenue'; heatmap: number[][]; startDate: string; endDate: string }>;
  },

  async getDiscountsSummary(storeId: string, options?: { startDate?: Date; endDate?: Date }) {
    const qs: string[] = [];
    if (options?.startDate) qs.push(`startDate=${encodeURIComponent(options.startDate.toISOString())}`);
    if (options?.endDate) qs.push(`endDate=${encodeURIComponent(options.endDate.toISOString())}`);
    const q = qs.length ? `?${qs.join('&')}` : '';
    return api.get(`/api/shopify/stores/${storeId}/discounts/summary${q}`) as Promise<{ totalDiscounts: number; avgDiscountPerOrder: number; netRevenue: number; ordersCount: number; startDate: string; endDate: string }>;
  },
};
