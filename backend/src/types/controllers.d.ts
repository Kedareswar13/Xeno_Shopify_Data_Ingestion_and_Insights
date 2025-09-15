import { RequestHandler } from 'express';

declare module '@/controllers/shopify.controller' {
  export const shopifyController: {
    getStoreInfo: RequestHandler;
    getProducts: RequestHandler;
    getOrders: RequestHandler;
    getCustomers: RequestHandler;
    getAnalytics: RequestHandler;
  };
}
