import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

// Validate store access helper (strict: must match tenant always)
async function ensureStoreAccess(storeId: string, tenantId: string | undefined, next: NextFunction) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, tenantId: true } });
  if (!store) {
    return next({ statusCode: StatusCodes.NOT_FOUND, message: 'Store not found' });
  }
  if (store.tenantId !== tenantId) {
    return next({ statusCode: StatusCodes.FORBIDDEN, message: 'Forbidden' });
  }
  return store;
}

export const getStoreAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    const [productsCount, customersCount, ordersCount, revenueAgg] = await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.customer.count({ where: { storeId } }),
      prisma.order.count({ where: { storeId } }),
      prisma.order.aggregate({ where: { storeId }, _sum: { totalPrice: true } }),
    ]);

    res.status(StatusCodes.OK).json({
      total_products: productsCount,
      total_customers: customersCount,
      total_orders: ordersCount,
      total_revenue: revenueAgg._sum.totalPrice || 0,
    });
  } catch (err) {
    logger.error('getStoreAnalytics error:', err);
    next(err);
  }
};

// New: New vs Returning split by orders and revenue
export const getCustomerSplit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    const startDateQ = req.query.startDate as string | undefined;
    const endDateQ = req.query.endDate as string | undefined;
    const start = startDateQ ? new Date(startDateQ) : new Date(new Date().getTime() - 30 * 24 * 3600_000);
    const end = endDateQ ? new Date(endDateQ) : new Date();

    // Orders in range (sorted chronologically)
    const orders = await prisma.order.findMany({
      where: { storeId, createdAt: { gte: start, lte: end } },
      select: { id: true, totalPrice: true, createdAt: true, customerId: true, customerEmail: true },
      orderBy: { createdAt: 'asc' },
    });

    // For each unique customer (by email if id missing), determine if they had an order before start
    const customerKeys = new Set<string>();
    for (const o of orders) {
      const key = (o.customerId || o.customerEmail || 'unknown').toString();
      customerKeys.add(key);
    }
    const keysArr = Array.from(customerKeys);

    // Fetch earliest order date per customer prior to range
    const preOrders = await Promise.all(keysArr.map(async (key) => {
      // Prefer id lookups when available
      if (key.startsWith('cm') || key.length > 20) {
        const first = await prisma.order.findFirst({ where: { storeId, customerId: key, createdAt: { lt: start } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        return { key, hasPre: !!first };
      } else {
        const first = await prisma.order.findFirst({ where: { storeId, customerEmail: key, createdAt: { lt: start } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        return { key, hasPre: !!first };
      }
    }));
    const preMap = new Map(preOrders.map(p => [p.key, p.hasPre]));

    let newOrders = 0, newRevenue = 0, retOrders = 0, retRevenue = 0;
    const seenInRange = new Map<string, boolean>();
    for (const o of orders) {
      const key = (o.customerId || o.customerEmail || 'unknown').toString();
      const hadPre = preMap.get(key) === true;
      const seen = seenInRange.get(key) === true;
      const returning = hadPre || seen; // if had pre-range orders OR already had an order in this range
      if (returning) {
        retOrders += 1; retRevenue += Number(o.totalPrice || 0);
      } else {
        newOrders += 1; newRevenue += Number(o.totalPrice || 0);
        seenInRange.set(key, true);
      }
    }

    res.status(StatusCodes.OK).json({
      new: { orders: newOrders, revenue: Math.round(newRevenue) },
      returning: { orders: retOrders, revenue: Math.round(retRevenue) },
      startDate: start.toISOString(), endDate: end.toISOString(),
    });
  } catch (err) {
    logger.error('getCustomerSplit error:', err);
    next(err);
  }
};

// New: Sales by Product Type (or vendor); default to productType
export const getSalesByType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    const startDateQ = req.query.startDate as string | undefined;
    const endDateQ = req.query.endDate as string | undefined;
    const groupBy = ((req.query.groupBy as string) || 'productType') as 'productType' | 'vendor';
    const start = startDateQ ? new Date(startDateQ) : new Date(new Date().getTime() - 30 * 24 * 3600_000);
    const end = endDateQ ? new Date(endDateQ) : new Date();

    const orders = await prisma.order.findMany({ where: { storeId, createdAt: { gte: start, lte: end } }, select: { lineItems: true } });
    const totals = new Map<string, { revenue: number; orders: number }>();

    // Build map shopifyId -> product meta
    const allShopifyIds = new Set<string>();
    for (const o of orders) {
      if (!o.lineItems) continue; let items: any[] = [];
      try { items = JSON.parse(o.lineItems as unknown as string) || []; } catch { items = []; }
      for (const li of items) {
        const sid = (li.product_id ?? li.productId)?.toString();
        if (sid) allShopifyIds.add(sid);
      }
    }
    const products = await prisma.product.findMany({ where: { storeId, shopifyId: { in: Array.from(allShopifyIds) } }, select: { shopifyId: true, productType: true, vendor: true, title: true } });
    const normalize = (s?: string | null): string => {
      if (!s) return 'Uncategorized';
      const v = s.toString().trim().toLowerCase();
      if (!v) return 'Uncategorized';
      // Map common synonyms to unified categories
      if (/(t\s*-?\s*shirt|tee\b|tshirt|tees)/i.test(v)) return 'T-Shirts';
      if (/(hoodie|sweatshirt)/i.test(v)) return 'Hoodies';
      if (/(pant|trouser|jean)/i.test(v)) return 'Bottoms';
      if (/(dress|kurti|gown)/i.test(v)) return 'Dresses';
      return v.replace(/\s+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    };
    const meta = new Map(products.map(p => [p.shopifyId!, { productType: normalize(p.productType), vendor: p.vendor || 'Unknown', title: p.title || '' }]));

    for (const o of orders) {
      if (!o.lineItems) continue; let items: any[] = [];
      try { items = JSON.parse(o.lineItems as unknown as string) || []; } catch { items = []; }
      const seenGroups = new Set<string>();
      for (const li of items) {
        const sid = (li.product_id ?? li.productId)?.toString();
        if (!sid) continue;
        const m = meta.get(sid) || { productType: 'Uncategorized', vendor: 'Unknown', title: '' };
        let key = (groupBy === 'vendor' ? m.vendor : m.productType) || 'Uncategorized';
        if (key === 'Uncategorized') {
          // Try to infer from title if available
          const t = (m.title || '').toLowerCase();
          if (/(t\s*-?\s*shirt|tee\b|tshirt|tees)/i.test(t)) key = 'T-Shirts';
        }
        const qty = Number(li.quantity || 0);
        const price = Number(parseFloat(li.price || '0'));
        const prev = totals.get(key) || { revenue: 0, orders: 0 };
        prev.revenue += qty * price;
        // Count order once per group key
        if (!seenGroups.has(key)) { prev.orders += 1; seenGroups.add(key); }
        totals.set(key, prev);
      }
    }

    const result = Array.from(totals.entries()).map(([type, v]) => ({ type, revenue: Math.round(v.revenue), orders: v.orders }));
    res.status(StatusCodes.OK).json(result);
  } catch (err) {
    logger.error('getSalesByType error:', err);
    next(err);
  }
};

// New: Traffic heatmap (orders or revenue) by weekday/hour
export const getTrafficHeatmap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    const startDateQ = req.query.startDate as string | undefined;
    const endDateQ = req.query.endDate as string | undefined;
    const metric = ((req.query.metric as string) || 'orders') as 'orders' | 'revenue';
    const start = startDateQ ? new Date(startDateQ) : new Date(new Date().getTime() - 30 * 24 * 3600_000);
    const end = endDateQ ? new Date(endDateQ) : new Date();

    const orders = await prisma.order.findMany({ where: { storeId, createdAt: { gte: start, lte: end } }, select: { createdAt: true, totalPrice: true } });
    // Build 7x24 matrix
    const heat: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const o of orders) {
      const d = o.createdAt;
      const dow = d.getDay(); // 0-6
      const hr = d.getHours(); // 0-23
      if (metric === 'revenue') heat[dow][hr] += Number(o.totalPrice || 0);
      else heat[dow][hr] += 1;
    }
    res.status(StatusCodes.OK).json({ metric, heatmap: heat, startDate: start.toISOString(), endDate: end.toISOString() });
  } catch (err) {
    logger.error('getTrafficHeatmap error:', err);
    next(err);
  }
};

// New: Discounts summary
export const getDiscountsSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    const startDateQ = req.query.startDate as string | undefined;
    const endDateQ = req.query.endDate as string | undefined;
    const start = startDateQ ? new Date(startDateQ) : new Date(new Date().getTime() - 30 * 24 * 3600_000);
    const end = endDateQ ? new Date(endDateQ) : new Date();

    const agg = await prisma.order.aggregate({
      where: { storeId, createdAt: { gte: start, lte: end } },
      _sum: { totalPrice: true, totalDiscounts: true },
      _count: { _all: true },
    });
    const totalDiscounts = Number(agg._sum.totalDiscounts || 0);
    const totalRevenue = Number(agg._sum.totalPrice || 0);
    const ordersCount = Number((agg as any)._count?._all || 0);
    const avgDiscountPerOrder = ordersCount > 0 ? totalDiscounts / ordersCount : 0;
    const netRevenue = totalRevenue - totalDiscounts;

    res.status(StatusCodes.OK).json({
      totalDiscounts: Math.round(totalDiscounts),
      avgDiscountPerOrder: Math.round(avgDiscountPerOrder),
      netRevenue: Math.round(netRevenue),
      ordersCount,
      startDate: start.toISOString(), endDate: end.toISOString(),
    });
  } catch (err) {
    logger.error('getDiscountsSummary error:', err);
    next(err);
  }
};

export const getTopProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const limit = Math.min(parseInt((req.query.limit as string) || '5', 10), 50);
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    // 1) Read all orders for this store (could be optimized with date filters if needed)
    const orders = await prisma.order.findMany({
      where: { storeId },
      select: { lineItems: true },
    });

    // 2) Accumulate sold counts and revenue per Shopify product ID
    const soldMap = new Map<string, { sold: number; revenue: number }>();
    for (const o of orders) {
      if (!o.lineItems) continue;
      let items: any[] = [];
      try {
        items = JSON.parse(o.lineItems as unknown as string) || [];
      } catch {
        items = [];
      }
      for (const li of items) {
        const shopifyProductId = (li.product_id ?? li.productId)?.toString();
        if (!shopifyProductId) continue;
        const qty = Number(li.quantity || 0);
        const price = Number(parseFloat(li.price || '0'));
        const prev = soldMap.get(shopifyProductId) || { sold: 0, revenue: 0 };
        soldMap.set(shopifyProductId, { sold: prev.sold + qty, revenue: prev.revenue + qty * price });
      }
    }

    // 3) Load product details for the top by sold
    const ranked = Array.from(soldMap.entries())
      .sort((a, b) => b[1].sold - a[1].sold)
      .slice(0, limit);

    const topShopifyIds = ranked.map(([shopId]) => shopId);
    const topProducts = await prisma.product.findMany({
      where: { storeId, shopifyId: { in: topShopifyIds } },
      select: { id: true, shopifyId: true, title: true, price: true },
    });

    // 4) Build response preserving rank order
    const productByShopifyId = new Map(topProducts.map(p => [p.shopifyId, p]));
    const result = ranked.map(([shopifyId, agg]) => {
      const p = productByShopifyId.get(shopifyId);
      if (!p) return null;
      return {
        id: p.id,
        title: p.title,
        price: p.price,
        sold: agg.sold,
        revenue: Math.round(agg.revenue),
      };
    }).filter(Boolean);

    res.status(StatusCodes.OK).json(result);
  } catch (err) {
    logger.error('getTopProducts error:', err);
    next(err);
  }
};

export const getRecentOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const limit = Math.min(parseInt((req.query.limit as string) || '5', 10), 50);
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    const orders = await prisma.order.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        financialStatus: true,
        totalPrice: true,
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    res.status(StatusCodes.OK).json(
      orders.map((o: { id: string; orderNumber: string; createdAt: Date; financialStatus: string | null; totalPrice: number; customer?: { firstName: string | null; lastName: string | null; email: string | null } | null; }) => ({
        id: o.id,
        name: o.orderNumber,
        createdAt: o.createdAt.toISOString(),
        financialStatus: o.financialStatus || 'pending',
        totalPrice: o.totalPrice.toString(),
        customer: o.customer ? {
          firstName: o.customer.firstName || '',
          lastName: o.customer.lastName || '',
          email: o.customer.email || '',
        } : undefined,
      }))
    );
  } catch (err) {
    logger.error('getRecentOrders error:', err);
    next(err);
  }
};

export const getSalesData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const period = (req.query.period as string) || 'week';
    const startDateQ = req.query.startDate as string | undefined;
    const endDateQ = req.query.endDate as string | undefined;
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    // Determine range
    let since: Date;
    let until: Date | undefined;
    if (startDateQ || endDateQ) {
      // Use explicit range if provided
      since = startDateQ ? new Date(startDateQ) : new Date(0);
      until = endDateQ ? new Date(endDateQ) : undefined;
    } else {
      // Aggregate orders by day for last N days depending on period
      const days = period === 'day' ? 1 : period === 'month' ? 30 : 7;
      since = new Date();
      since.setDate(since.getDate() - days);
    }

    const orders = await prisma.order.findMany({
      where: { 
        storeId, 
        createdAt: { 
          gte: since, 
          ...(until ? { lte: until } : {})
        } 
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, totalPrice: true },
    });

    const buckets = new Map<string, { sales: number; orders: number }>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const prev = buckets.get(key) || { sales: 0, orders: 0 };
      prev.sales += o.totalPrice;
      prev.orders += 1;
      buckets.set(key, prev);
    }

    const data = Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      sales: Math.round(v.sales),
      orders: v.orders,
    }));

    res.status(StatusCodes.OK).json(data);
  } catch (err) {
    logger.error('getSalesData error:', err);
    next(err);
  }
};

export const getCustomerInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeId } = req.params;
    const tenantId = (req.user as any)?.tenantId as string | undefined;
    await ensureStoreAccess(storeId, tenantId, next);

    // Compute from orders to ensure correct totals even if aggregates were not materialized
    const orders = await prisma.order.findMany({
      where: { storeId },
      select: {
        totalPrice: true,
        createdAt: true,
        customerEmail: true,
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    type Agg = { ordersCount: number; totalSpend: number; lastOrderDate: Date; firstName?: string | null; lastName?: string | null; email?: string | null };
    const aggByKey = new Map<string, Agg>();

    for (const o of orders) {
      const email = o.customer?.email || o.customerEmail || 'unknown@unknown.local';
      const key = email.toLowerCase();
      const prev = aggByKey.get(key) || { ordersCount: 0, totalSpend: 0, lastOrderDate: new Date(0), firstName: o.customer?.firstName || null, lastName: o.customer?.lastName || null, email };
      prev.ordersCount += 1;
      prev.totalSpend += Number(o.totalPrice || 0);
      if (o.createdAt && o.createdAt > prev.lastOrderDate) prev.lastOrderDate = o.createdAt;
      // prefer non-empty names if available later
      if (!prev.firstName && o.customer?.firstName) prev.firstName = o.customer.firstName;
      if (!prev.lastName && o.customer?.lastName) prev.lastName = o.customer.lastName;
      aggByKey.set(key, prev);
    }

    const ranked = Array.from(aggByKey.entries())
      .sort((a, b) => b[1].totalSpend - a[1].totalSpend)
      .slice(0, 5)
      .map(([key, v]) => ({
        id: key, // use email as a stable key for UI; DB id may not be present for every order
        firstName: v.firstName || null,
        lastName: v.lastName || null,
        email: v.email || key,
        totalSpend: Math.round(v.totalSpend),
        ordersCount: v.ordersCount,
        lastOrderDate: v.lastOrderDate,
      }));

    res.status(StatusCodes.OK).json(ranked);
  } catch (err) {
    logger.error('getCustomerInsights error:', err);
    next(err);
  }
};
