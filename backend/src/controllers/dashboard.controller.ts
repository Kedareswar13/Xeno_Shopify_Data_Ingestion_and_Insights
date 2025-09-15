import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

// Validate store access helper
async function ensureStoreAccess(storeId: string, tenantId: string | undefined, next: NextFunction) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, tenantId: true } });
  if (!store) {
    return next({ statusCode: StatusCodes.NOT_FOUND, message: 'Store not found' });
  }
  // In development, allow when no tenantId is present on the request
  if (!tenantId && process.env.NODE_ENV === 'development') {
    return store;
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

    const topCustomers = await prisma.customer.findMany({
      where: { storeId },
      orderBy: { totalSpend: 'desc' },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        totalSpend: true,
        ordersCount: true,
        lastOrderDate: true,
      },
    });

    res.status(StatusCodes.OK).json(topCustomers);
  } catch (err) {
    logger.error('getCustomerInsights error:', err);
    next(err);
  }
};
