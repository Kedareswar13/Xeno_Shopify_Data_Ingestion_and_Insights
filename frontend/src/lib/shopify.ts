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
};
