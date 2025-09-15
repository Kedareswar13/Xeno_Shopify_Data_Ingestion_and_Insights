import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { createHmac } from 'crypto';
import { subDays, formatISO } from 'date-fns';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

type AxiosInstance = any;
type AxiosRequestConfig = any;

export interface ShopifyStore {
  id: number;
  name: string;
  email: string;
  domain: string;
  created_at: string;
  customer_email: string;
  currency: string;
  timezone: string;
  iana_timezone: string;
  shop_owner: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  country_code?: string;
  country_name?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  primary_location_id?: number;
  primary_locale?: string;
  weight_unit?: string;
  weight_unit_system?: string;
  taxes_included?: boolean;
  tax_shipping?: boolean;
  county_taxes?: boolean;
  plan_display_name?: string;
  plan_name?: string;
  has_discounts?: boolean;
  has_gift_cards?: boolean;
  myshopify_domain?: string;
  google_apps_domain?: string;
  google_apps_login_enabled?: boolean;
  money_in_emails_format?: string;
  money_with_currency_in_emails_format?: string;
  eligible_for_payments?: boolean;
  requires_extra_payments_agreement?: boolean;
  password_enabled?: boolean;
  has_storefront?: boolean;
  eligible_for_card_reader_giveaway?: boolean;
  finances?: boolean;
  primary_location?: {
    id: number;
    name: string;
    address1: string;
    address2: string;
    city: string;
    zip: string;
    country: string;
    country_code: string;
    country_name: string;
    province: string;
    province_code: string;
    phone: string;
    created_at: string;
    updated_at: string;
    country_id: number;
    legacy: boolean;
    active: boolean;
    admin_graphql_api_id: string;
    localized_country_name: string;
    localized_province_name: string;
  };
  checkout_api_supported?: boolean;
  multi_location_enabled?: boolean;
  setup_required?: boolean;
  force_ssl?: boolean;
  pre_launch_enabled?: boolean;
  enabled_presentment_currencies?: string[];
  transactional_sms_disabled?: boolean;
  marketing_sms_consent_enabled_at_checkout?: boolean;
}

type StoreRef = {
  id: string;
  tenantId: string;
  domain: string;
  accessToken: string | null;
};

export interface ShopifyProductParams {
  limit?: number;
  page?: number;
  collection_id?: number;
  product_type?: string;
  vendor?: string;
  title?: string;
  created_at_min?: string;
  created_at_max?: string;
  updated_at_min?: string;
  updated_at_max?: string;
  published_at_min?: string;
  published_at_max?: string;
  published_status?: 'published' | 'unpublished' | 'any';
  fields?: string;
  ids?: string;
  since_id?: number;
}

export interface ShopifyOrderParams {
  limit?: number;
  page?: number;
  status?: 'open' | 'closed' | 'cancelled' | 'any';
  created_at_min?: string;
  created_at_max?: string;
  updated_at_min?: string;
  updated_at_max?: string;
  processed_at_min?: string;
  processed_at_max?: string;
  fields?: string;
  ids?: string;
  since_id?: number;
  financial_status?: 'authorized' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'voided' | 'partially_refunded' | 'any' | 'unpaid';
  fulfillment_status?: 'shipped' | 'partial' | 'unshipped' | 'any' | 'unfulfilled';
  attribution_app_id?: number;
  name?: string;
  customer_id?: number;
  processed_at?: string;
}

export interface ShopifyCustomerParams {
  limit?: number;
  page?: number;
  created_at_min?: string;
  created_at_max?: string;
  updated_at_min?: string;
  updated_at_max?: string;
  fields?: string;
  ids?: string;
  since_id?: number;
  email?: string;
  phone?: string;
  order?: 'last_order_date DESC' | 'last_order_date ASC' | 'total_spent DESC' | 'total_spent ASC' | 'updated_at DESC' | 'updated_at ASC' | 'orders_count DESC' | 'orders_count ASC';
  order_status?: 'any' | 'open' | 'closed' | 'cancelled';
  total_spent_min?: number;
  total_spent_max?: number;
  orders_count_min?: number;
  orders_count_max?: number;
  customer_state?: 'disabled' | 'invited' | 'enabled' | 'declined';
  product_id?: number;
  tag?: string;
  accept_language?: string;
  fields_to_return?: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string;
  template_suffix: string | null;
  status: string;
  published_scope: string;
  tags: string;
  admin_graphql_api_id: string;
  variants: ShopifyVariant[];
  options: ShopifyOption[];
  images: ShopifyImage[];
  image: ShopifyImage | null;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  fulfillment_service: string;
  inventory_management: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  image_id: number | null;
  weight: number;
  weight_unit: string;
  inventory_item_id: number;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
  admin_graphql_api_id: string;
}

export interface ShopifyOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
  admin_graphql_api_id: string;
}

export interface ShopifyOrder {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
  number: number;
  note: string | null;
  token: string;
  gateway: string;
  test: boolean;
  total_price: string;
  subtotal_price: string;
  total_weight: number;
  total_tax: string;
  taxes_included: boolean;
  currency: string;
  financial_status: string;
  confirmed: boolean;
  total_discounts: string;
  total_line_items_price: string;
  cart_token: string | null;
  buyer_accepts_marketing: boolean;
  name: string;
  referring_site: string | null;
  landing_site: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  total_price_usd: string;
  checkout_token: string | null;
  reference: string | null;
  user_id: number | null;
  location_id: number | null;
  source_identifier: string | null;
  source_url: string | null;
  processed_at: string;
  device_id: number | null;
  phone: string | null;
  customer_locale: string | null;
  app_id: number;
  browser_ip: string | null;
  landing_site_ref: string | null;
  order_number: number;
  discount_applications: any[];
  discount_codes: any[];
  note_attributes: any[];
  payment_gateway_names: string[];
  processing_method: string;
  source_name: string;
  fulfillment_status: string | null;
  tax_lines: any[];
  tags: string;
  contact_email: string;
  order_status_url: string;
  presentment_currency: string;
  total_line_items_price_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_discounts_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_shipping_price_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  subtotal_price_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_price_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_tax_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  line_items: ShopifyLineItem[];
  shipping_lines: any[];
  billing_address: ShopifyAddress | null;
  shipping_address: ShopifyAddress | null;
  customer: ShopifyCustomer | null;
}

export interface ShopifyLineItem {
  id: number;
  variant_id: number;
  title: string;
  quantity: number;
  sku: string;
  variant_title: string | null;
  vendor: string | null;
  fulfillment_service: string;
  product_id: number;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
  name: string;
  variant_inventory_management: string | null;
  properties: any[];
  product_exists: boolean;
  fulfillable_quantity: number;
  grams: number;
  price: string;
  total_discount: string;
  fulfillment_status: string | null;
  price_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  total_discount_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  discount_allocations: any[];
  admin_graphql_api_id: string;
  tax_lines: any[];
  duties: any[];
}

export interface ShopifyAddress {
  first_name: string;
  address1: string;
  phone: string;
  city: string;
  zip: string;
  province: string;
  country: string;
  last_name: string;
  address2: string | null;
  company: string | null;
  latitude: number;
  longitude: number;
  name: string;
  country_code: string;
  province_code: string;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  state: string;
  total_spent: string;
  last_order_id: number | null;
  note: string | null;
  verified_email: boolean;
  multipass_identifier: string | null;
  tax_exempt: boolean;
  phone: string | null;
  tags: string;
  last_order_name: string | null;
  currency: string;
  addresses: ShopifyAddress[];
  default_address: ShopifyAddress;
  accepts_marketing_updated_at: string;
  marketing_opt_in_level: string | null;
  tax_exemptions: any[];
  admin_graphql_api_id: string;
  default_address_id: number;
}

export interface ShopifyCustomerListResponse {
  customers: ShopifyCustomer[];
}

export interface ShopifyProductListResponse {
  products: ShopifyProduct[];
}

export interface ShopifyOrderListResponse {
  orders: ShopifyOrder[];
}

export class ShopifyService {
  private client: AxiosInstance;
  private store: StoreRef;

  constructor(store: StoreRef) {
    this.store = store;
    this.client = axios.create({
      baseURL: `https://${store.domain}/admin/api/2024-10`,
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config: AxiosRequestConfig) => {
        console.log(`[Shopify API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: any) => {
        console.error('[Shopify API] Request error:', error);
        return Promise.reject(error);
      }
    );
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await this.client.get(endpoint, { params }) as { data: T };
      return response.data;
    } catch (error: any) {
      console.error(`[Shopify API] Error fetching ${endpoint}:`, error);
      throw new Error(`Failed to fetch data from Shopify: ${error.message}`);
    }
  }

  /**
   * Verify the store connection by making a test API call
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/shop.json');
      return true;
    } catch (error) {
      console.error('Failed to verify Shopify store connection:', error);
      return false;
    }
  }

  /**
   * Get store information
   */
  async getStoreInfo(): Promise<ShopifyStore> {
    const response = await this.makeRequest<{ shop: ShopifyStore }>('/shop.json');
    return response.shop;
  }

  /**
   * Get products with pagination
   */
  async getProducts(params: ShopifyProductParams = {}): Promise<{ products: ShopifyProduct[] }> {
    const response = await this.makeRequest<{ products: ShopifyProduct[] }>('/products.json', params);
    return { products: response.products };
  }

  /**
   * Get orders with pagination and filters
   */
  async getOrders(params: ShopifyOrderParams = {}): Promise<{ orders: ShopifyOrder[] }> {
    const response = await this.makeRequest<{ orders: ShopifyOrder[] }>('/orders.json', params);
    return { orders: response.orders };
  }

  /**
   * Get customers with pagination and filters
   */
  async getCustomers(params: ShopifyCustomerParams = {}): Promise<{ customers: ShopifyCustomer[] }> {
    const response = await this.makeRequest<{ customers: ShopifyCustomer[] }>('/customers.json', params);
    return { customers: response.customers };
  }

  /**
   * Get a single product by ID
   */
  async getProductById(id: number): Promise<ShopifyProduct> {
    const response = await this.client.get(`/products/${id}.json`);
    return response.data.product;
  }

  /**
   * Get a single order by ID
   */
  async getOrderById(id: number): Promise<ShopifyOrder> {
    const response = await this.client.get(`/orders/${id}.json`);
    return response.data.order;
  }

  /**
   * Get a single customer by ID
   */
  async getCustomerById(id: number): Promise<ShopifyCustomer> {
    const response = await this.client.get(`/customers/${id}.json`);
    return response.data.customer;
  }

  /**
   * Get store analytics data
   */
  async getAnalytics(params: {
    start_date: string;
    end_date: string;
  }): Promise<any> {
    // This is a simplified example - in a real app, you would implement
    // more sophisticated analytics based on your requirements
    const [orders, products, customers] = await Promise.all([
      this.getOrders({
        created_at_min: params.start_date,
        created_at_max: params.end_date,
        limit: 1,
      }),
      this.getProducts({ limit: 1 }),
      this.getCustomers({ limit: 1 }),
    ]);

    return {
      total_orders: orders.orders.length,
      total_products: products.products.length,
      total_customers: customers.customers.length,
      // Add more analytics as needed
    };
  }
}

/**
 * Verify a Shopify webhook HMAC signature
 */
export function verifyWebhookHmac(
  body: string | Buffer,
  hmac: string,
  secret: string
): boolean {
  const computedHmac = createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return computedHmac === hmac;
}

/**
 * Sync data from Shopify to the local database
 */
export class ShopifySyncService {
  private shopifyService: ShopifyService;
  private store: StoreRef;
  private prisma: PrismaClient;

  constructor(store: StoreRef, prismaClient: PrismaClient = prisma as unknown as PrismaClient) {
    this.store = store;
    this.shopifyService = new ShopifyService(store);
    this.prisma = prismaClient;
  }

  /**
   * Sync all store data (products, customers, orders)
   */
  async syncAllData() {
    try {
      logger.info(`Starting full data sync for store: ${this.store.domain}`);
      
      // Sync store info first
      await this.syncStoreInfo();
      
      // Sync products
      await this.syncProducts();
      
      // Sync customers
      await this.syncCustomers();
      
      // Sync orders (last 30 days by default)
      const endDate = new Date();
      const startDate = subDays(endDate, 30);
      await this.syncOrders({
        created_at_min: formatISO(startDate),
        created_at_max: formatISO(endDate),
      });
      
      // Update last sync timestamp
      await this.prisma.store.update({
        where: { id: this.store.id },
        data: { lastSyncedAt: new Date() },
      });
      
      logger.info(`Completed data sync for store: ${this.store.domain}`);
      return { success: true };
    } catch (error) {
      logger.error(`Error syncing data for store ${this.store.domain}:`, error);
      throw error;
    }
  }

  /**
   * Sync store information
   */
  private async syncStoreInfo() {
    try {
      const shopInfo = await this.shopifyService.getStoreInfo();
      
      await this.prisma.store.update({
        where: { id: this.store.id },
        data: {
          name: shopInfo.name,
          domain: shopInfo.domain,
          shopifyId: shopInfo.id.toString(),
        },
      });
      
      logger.info(`Updated store info for: ${shopInfo.domain}`);
    } catch (error) {
      logger.error('Error syncing store info:', error);
      throw error;
    }
  }

  /**
   * Sync products from Shopify
   */
  async syncProducts() {
    try {
      const limit = 50;
      let sinceId: number | undefined = undefined;

      while (true) {
        const params: any = { limit };
        if (sinceId) params.since_id = sinceId;

        const { products } = await this.shopifyService.getProducts(params);

        if (!products.length) break;

        for (const product of products) {
          await this.upsertProduct(product);
        }

        // Advance since_id to the last seen ID
        sinceId = products[products.length - 1].id;

        if (products.length < limit) break;
      }
      
      logger.info(`Synced products for store: ${this.store.domain}`);
    } catch (error) {
      logger.error('Error syncing products:', error);
      throw error;
    }
  }

  /**
   * Upsert a single product
   */
  private async upsertProduct(shopifyProduct: ShopifyProduct) {
    try {
      const productData = {
        shopifyId: shopifyProduct.id.toString(),
        title: shopifyProduct.title,
        description: shopifyProduct.body_html || '',
        price: parseFloat(shopifyProduct.variants[0]?.price) || 0,
        compareAtPrice: shopifyProduct.variants[0]?.compare_at_price 
          ? parseFloat(shopifyProduct.variants[0].compare_at_price) 
          : null,
        inventoryQuantity: shopifyProduct.variants.reduce(
          (sum: number, v: any) => sum + (v.inventory_quantity || 0), 
          0
        ),
        vendor: shopifyProduct.vendor || '',
        productType: shopifyProduct.product_type || '',
        handle: shopifyProduct.handle,
        publishedAt: shopifyProduct.published_at ? new Date(shopifyProduct.published_at) : null,
        tags: shopifyProduct.tags ? shopifyProduct.tags.split(',').map((tag: string) => tag.trim()) : [],
        images: shopifyProduct.images?.map((img: any) => ({
          id: img.id.toString(),
          src: img.src,
          position: img.position || 0,
          alt: img.alt || '',
        })) || [],
        variants: shopifyProduct.variants?.map((variant: any) => ({
          id: variant.id.toString(),
          title: variant.title,
          price: variant.price,
          sku: variant.sku || '',
          inventoryQuantity: variant.inventory_quantity || 0,
        })) || [],
      };

      await this.prisma.product.upsert({
        where: { 
          id: `${this.store.id}-${shopifyProduct.id}`
        },
        create: {
          ...productData,
          id: `${this.store.id}-${shopifyProduct.id}`,
          storeId: this.store.id,
          tenantId: this.store.tenantId,
        },
        update: productData,
      });
    } catch (error) {
      logger.error(`Error upserting product ${shopifyProduct.id}:`, error);
      throw error;
    }
  }

  /**
   * Sync customers from Shopify
   */
  async syncCustomers() {
    try {
      const limit = 50;
      let sinceId: number | undefined = undefined;

      while (true) {
        const params: any = { limit };
        if (sinceId) params.since_id = sinceId;

        const { customers } = await this.shopifyService.getCustomers(params);

        if (!customers.length) break;

        for (const customer of customers) {
          await this.upsertCustomer(customer);
        }

        sinceId = customers[customers.length - 1].id;

        if (customers.length < limit) break;
      }
      
      logger.info(`Synced customers for store: ${this.store.domain}`);
    } catch (error) {
      logger.error('Error syncing customers:', error);
      throw error;
    }
  }

  /**
   * Upsert a single customer
   */
  private async upsertCustomer(shopifyCustomer: ShopifyCustomer) {
    try {
      // Convert addresses and defaultAddress to JSON strings for storage
      const addressesJson = JSON.stringify(shopifyCustomer.addresses || []);
      const defaultAddressJson = JSON.stringify(shopifyCustomer.default_address || {});
      
      const customerData = {
        shopifyId: shopifyCustomer.id.toString(),
        email: shopifyCustomer.email || '',
        firstName: shopifyCustomer.first_name || '',
        lastName: shopifyCustomer.last_name || '',
        phone: shopifyCustomer.phone || '',
        acceptsMarketing: shopifyCustomer.accepts_marketing || false,
        totalSpend: parseFloat(shopifyCustomer.total_spent as any) || 0,
        ordersCount: shopifyCustomer.orders_count || 0,
        state: shopifyCustomer.state || 'enabled',
        verifiedEmail: shopifyCustomer.verified_email || false,
        addresses: addressesJson,
        defaultAddress: defaultAddressJson,
        tags: shopifyCustomer.tags ? shopifyCustomer.tags.split(',').map((tag: string) => tag.trim()) : [],
        lastOrderId: shopifyCustomer.last_order_id ? shopifyCustomer.last_order_id.toString() : null,
        lastOrderDate: shopifyCustomer.updated_at ? new Date(shopifyCustomer.updated_at) : null,
        storeId: this.store.id,
        tenantId: this.store.tenantId,
      };

      await this.prisma.customer.upsert({
        where: { 
          id: `${this.store.id}-${shopifyCustomer.id}`
        },
        create: {
          ...customerData,
          id: `${this.store.id}-${shopifyCustomer.id}`,
          storeId: this.store.id,
          tenantId: this.store.tenantId,
        },
        update: customerData,
      });
    } catch (error) {
      logger.error(`Error upserting customer ${shopifyCustomer.id}:`, error);
      throw error;
    }
  }

  /**
   * Sync orders from Shopify
   */
  async syncOrders(params: { created_at_min: string; created_at_max: string }) {
    try {
      const limit = 50;
      let sinceId: number | undefined = undefined;

      while (true) {
        const reqParams: any = { ...params, limit, status: 'any' };
        if (sinceId) reqParams.since_id = sinceId;

        const { orders } = await this.shopifyService.getOrders(reqParams);

        if (!orders.length) break;

        for (const order of orders) {
          await this.upsertOrder(order);
        }

        sinceId = orders[orders.length - 1].id;

        if (orders.length < limit) break;
      }
      
      logger.info(`Synced orders for store: ${this.store.domain}`);
    } catch (error) {
      logger.error('Error syncing orders:', error);
      throw error;
    }
  }

  /**
   * Upsert a single order
   */
  private async upsertOrder(shopifyOrder: ShopifyOrder) {
    try {
      // Find or create customer
      let customerId: string | null = null;
      if (shopifyOrder.customer) {
        await this.upsertCustomer(shopifyOrder.customer);
        customerId = `${this.store.id}-${shopifyOrder.customer.id}`;
      }

      // Convert complex objects to JSON strings for storage
      const lineItemsJson = JSON.stringify(shopifyOrder.line_items || []);
      const shippingAddressJson = JSON.stringify(shopifyOrder.shipping_address || {});
      const billingAddressJson = JSON.stringify(shopifyOrder.billing_address || {});
      const shippingLinesJson = JSON.stringify(shopifyOrder.shipping_lines || []);
      const discountCodesJson = JSON.stringify(shopifyOrder.discount_codes || []);
      const refundsJson = JSON.stringify((shopifyOrder as any).refunds || []);
      const transactionsJson = JSON.stringify(
        (shopifyOrder as any).payment_gateway_names?.map((gateway: string) => ({
          gateway,
          status: shopifyOrder.financial_status,
          amount: shopifyOrder.total_price,
        })) || []
      );

      const createdAtDate = shopifyOrder.created_at
        ? new Date(shopifyOrder.created_at)
        : (shopifyOrder.processed_at ? new Date(shopifyOrder.processed_at) : new Date());

      const orderData = {
        shopifyId: shopifyOrder.id.toString(),
        orderNumber: shopifyOrder.order_number?.toString() || shopifyOrder.id.toString(),
        customerId: customerId || null,
        customerEmail: shopifyOrder.email || (shopifyOrder as any).contact_email || '',
        financialStatus: shopifyOrder.financial_status || 'pending',
        fulfillmentStatus: shopifyOrder.fulfillment_status || 'unfulfilled',
        currency: shopifyOrder.currency || 'USD',
        totalPrice: parseFloat(shopifyOrder.total_price as any) || 0,
        subtotalPrice: parseFloat(shopifyOrder.subtotal_price as any) || 0,
        totalTax: parseFloat(shopifyOrder.total_tax as any) || 0,
        totalDiscounts: parseFloat(shopifyOrder.total_discounts as any) || 0,
        totalLineItemsPrice: parseFloat(shopifyOrder.total_line_items_price as any) || 0,
        lineItems: lineItemsJson,
        shippingAddress: shippingAddressJson,
        billingAddress: billingAddressJson,
        shippingLines: shippingLinesJson,
        discountCodes: discountCodesJson,
        note: shopifyOrder.note || '',
        tags: shopifyOrder.tags ? shopifyOrder.tags.split(',').map((tag: string) => tag.trim()) : [],
        processedAt: shopifyOrder.processed_at ? new Date(shopifyOrder.processed_at) : null,
        cancelledAt: shopifyOrder.cancelled_at ? new Date(shopifyOrder.cancelled_at) : null,
        closedAt: (shopifyOrder as any).closed_at ? new Date((shopifyOrder as any).closed_at) : null,
        refunds: refundsJson,
        transactions: transactionsJson,
        customerLocale: shopifyOrder.customer_locale || '',
        orderStatusUrl: (shopifyOrder as any).order_status_url || '',
        storeId: this.store.id,
        tenantId: this.store.tenantId,
      };

      await this.prisma.order.upsert({
        where: { 
          id: `${this.store.id}-${shopifyOrder.id}`
        },
        create: {
          ...orderData,
          id: `${this.store.id}-${shopifyOrder.id}`,
          storeId: this.store.id,
          tenantId: this.store.tenantId,
          // Ensure DB createdAt reflects Shopify's order creation time
          createdAt: createdAtDate,
        },
        update: {
          ...orderData,
          // Backfill/Correct createdAt for previously inserted orders
          createdAt: createdAtDate,
        },
      });
    } catch (error) {
      logger.error(`Error upserting order ${shopifyOrder.id}:`, error);
      throw error;
    }
  }
}
