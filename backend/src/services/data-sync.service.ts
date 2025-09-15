import { PrismaClient, Prisma } from '@prisma/client';
import { ShopifyService } from './shopify.service';
import type { 
  ShopifyOrder as ShopifyServiceOrder, 
  ShopifyCustomer as ShopifyServiceCustomer,
  ShopifyProduct as ShopifyServiceProduct,
  ShopifyVariant,
  ShopifyImage
} from './shopify.service';
import logger from '../utils/logger';

// #region Types
type StoreRef = {
  id: string;
  tenantId: string;
  domain: string;
};
interface SyncResult {
  success: boolean;
  message: string;
  stats: {
    total: number;
    created: number;
    updated: number;
    errors: number;
  };
}

interface ShopifyLineItem {
  id: number;
  product_id: number | null;
  variant_id: number | null;
  title: string;
  quantity: number;
  price: string;
  sku: string;
  vendor: string | null;
  name: string;
  requires_shipping: boolean;
  taxable: boolean;
  fulfillment_status: string | null;
  fulfillment_service: string;
  tax_lines: any[];
  discount_allocations: any[];
  properties: any[];
  variant_title: string | null;
  product_exists: boolean;
  fulfillable_quantity: number;
  grams: number;
  total_discount: string;
  admin_graphql_api_id: string;
  duties: any[];
}

// Extended Shopify types with our custom fields
type ShopifyOrder = Omit<ShopifyServiceOrder, 
  'line_items' | 'order_status_url' | 'created_at' | 'updated_at' | 'processed_at' | 'financial_status' | 'fulfillment_status' | 'currency' | 'total_price' | 'subtotal_price' | 'total_tax' | 'total_discounts' | 'total_line_items_price' | 'customer' | 'shipping_address' | 'billing_address' | 'shipping_lines' | 'discount_codes' | 'note' | 'tags' | 'customer_locale'
> & {
  created_at: string;
  updated_at: string;
  processed_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  currency: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  total_line_items_price: string;
  customer: ShopifyCustomer | null;
  shipping_address: any | null;
  billing_address: any | null;
  shipping_lines: any[];
  discount_codes: any[];
  note: string | null;
  tags: string;
  customer_locale: string | null;
  order_status_url: string | null;
  line_items: ShopifyLineItem[];
};

type ShopifyProduct = Omit<ShopifyServiceProduct, 'variants' | 'images' | 'body_html' | 'vendor' | 'product_type' | 'status' | 'published_scope' | 'admin_graphql_api_id' | 'template_suffix' | 'handle' | 'created_at' | 'updated_at' | 'published_at' | 'tags'> & {
  body_html: string;
  vendor: string;
  product_type: string;
  status: string;
  published_scope: string;
  admin_graphql_api_id: string;
  template_suffix: string;
  handle: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  tags: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
    created_at: string;
    updated_at: string;
  }>;
  images: Array<{
    id: number;
    src: string;
    position: number;
    created_at: string;
    updated_at: string;
  }>;
};

// Extend the ShopifyCustomer type to ensure all required fields are present
type ShopifyCustomer = Omit<ShopifyServiceCustomer, 'first_name' | 'last_name' | 'email' | 'phone' | 'tags' | 'total_spent' | 'orders_count' | 'updated_at' | 'accepts_marketing' | 'verified_email' | 'tax_exempt' | 'state' | 'created_at' | 'currency' | 'addresses' | 'default_address' | 'default_address_id' | 'accepts_marketing_updated_at' | 'marketing_opt_in_level' | 'tax_exemptions' | 'admin_graphql_api_id'> & {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  tags: string;
  total_spent: string;
  orders_count: number;
  updated_at: string;
  accepts_marketing: boolean;
  verified_email: boolean;
  tax_exempt: boolean;
  state: string;
  created_at: string;
  currency: string;
  addresses: any[];
  default_address: any | null;
  default_address_id: number | null;
  accepts_marketing_updated_at: string;
  marketing_opt_in_level: string | null;
  tax_exemptions: any[];
  admin_graphql_api_id: string;
};

// #endregion

export class DataSyncService {
  private prisma: PrismaClient;

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly store: StoreRef
  ) {
    this.prisma = new PrismaClient();
  }

  async syncAllData(): Promise<SyncResult> {
    logger.info(`Starting data sync for store: ${this.store.domain}`);
    try {
      const [productsResult, customersResult, ordersResult] = await Promise.all([
        this.syncProducts(),
        this.syncCustomers(),
        this.syncOrders(),
      ]);

      await this.prisma.store.update({
        where: { id: this.store.id },
        data: { lastSyncedAt: new Date() },
      });

      const combinedStats = {
        total: productsResult.stats.total + customersResult.stats.total + ordersResult.stats.total,
        created: productsResult.stats.created + customersResult.stats.created + ordersResult.stats.created,
        updated: productsResult.stats.updated + customersResult.stats.updated + ordersResult.stats.updated,
        errors: productsResult.stats.errors + customersResult.stats.errors + ordersResult.stats.errors,
      };

      logger.info(`Completed data sync for store: ${this.store.domain}`);
      return {
        success: true,
        message: 'Data synced successfully',
        stats: combinedStats,
      };
    } catch (error) {
      logger.error(`Error during full data sync for store ${this.store.domain}:`, error);
      return {
        success: false,
        message: 'Data sync failed',
        stats: { total: 0, created: 0, updated: 0, errors: 1 },
      };
    }
  }

  // #region Sync Methods
  async syncProducts(): Promise<SyncResult> {
    return this.syncPaginatedData<ShopifyProduct>(
      'products',
      async (params) => {
        const response = await this.shopifyService.getProducts({
          limit: params.limit,
          page: params.page
        });
        
        // Map the response to ensure all required fields are present
        const products: ShopifyProduct[] = response.products.map(product => ({
          ...product,
          // Ensure required fields have non-null values
          body_html: product.body_html || '',
          vendor: product.vendor || '',
          product_type: product.product_type || '',
          status: product.status || 'active',
          published_scope: product.published_scope || 'web',
          admin_graphql_api_id: product.admin_graphql_api_id || `gid://shopify/Product/${product.id}`,
          template_suffix: product.template_suffix || '',
          handle: product.handle || `product-${product.id}`,
          created_at: product.created_at || new Date().toISOString(),
          updated_at: product.updated_at || new Date().toISOString(),
          published_at: product.published_at || new Date().toISOString(),
          tags: product.tags || '',
          // Map variants
          variants: (product.variants || []).map(variant => ({
            id: variant.id,
            title: variant.title || '',
            price: variant.price || '0',
            sku: variant.sku || '',
            inventory_quantity: variant.inventory_quantity || 0,
            created_at: variant.created_at || new Date().toISOString(),
            updated_at: variant.updated_at || new Date().toISOString()
          })),
          // Map images
          images: (product.images || []).map(image => ({
            id: image.id,
            src: image.src || '',
            position: image.position || 0,
            created_at: image.created_at || new Date().toISOString(),
            updated_at: image.updated_at || new Date().toISOString()
          }))
        }));
        
        return { products };
      },
      this.upsertProduct.bind(this)
    );
  }

  async syncCustomers(): Promise<SyncResult> {
    return this.syncPaginatedData<ShopifyCustomer>(
      'customers',
      async (params) => {
        const response = await this.shopifyService.getCustomers({
          limit: params.limit,
          page: params.page,
          order_status: 'any'
        });
        
        // Map the response to ensure all required fields are present
        const customers: ShopifyCustomer[] = response.customers.map(customer => ({
          ...customer,
          first_name: customer.first_name || '',
          last_name: customer.last_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          tags: customer.tags || '',
          total_spent: customer.total_spent || '0',
          orders_count: customer.orders_count || 0,
          updated_at: customer.updated_at || new Date().toISOString(),
          accepts_marketing: customer.accepts_marketing || false,
          verified_email: customer.verified_email || false,
          tax_exempt: customer.tax_exempt || false,
          state: customer.state || 'disabled',
          created_at: customer.created_at || new Date().toISOString(),
          currency: customer.currency || 'USD',
          addresses: customer.addresses || [],
          default_address: customer.default_address || null,
          default_address_id: customer.default_address_id || null,
          accepts_marketing_updated_at: customer.accepts_marketing_updated_at || new Date().toISOString(),
          marketing_opt_in_level: customer.marketing_opt_in_level || null,
          tax_exemptions: customer.tax_exemptions || [],
          admin_graphql_api_id: customer.admin_graphql_api_id || `gid://shopify/Customer/${customer.id}`
        }));
        
        return { customers };
      },
      this.upsertCustomer.bind(this)
    );
  }

  async syncOrders(): Promise<SyncResult> {
    return this.syncPaginatedData<ShopifyOrder>(
      'orders',
      async (params) => {
        const response = await this.shopifyService.getOrders({
          limit: params.limit,
          page: params.page,
          status: 'any' as const
        });
        
        // Map the response to ensure all required fields are present
        const orders: ShopifyOrder[] = await Promise.all(response.orders.map(async (order) => {
          // First sync the customer if it exists and create a properly typed customer object
          let customer: ShopifyCustomer | null = null;
          if (order.customer) {
            // Create a properly typed customer object first
            const typedCustomer: ShopifyCustomer = {
              ...order.customer,
              first_name: order.customer.first_name || '',
              last_name: order.customer.last_name || '',
              email: order.customer.email || '',
              phone: order.customer.phone || '',
              tags: order.customer.tags || '',
              total_spent: order.customer.total_spent || '0',
              orders_count: order.customer.orders_count || 0,
              updated_at: order.customer.updated_at || new Date().toISOString(),
              accepts_marketing: order.customer.accepts_marketing || false,
              verified_email: order.customer.verified_email || false,
              tax_exempt: order.customer.tax_exempt || false,
              state: order.customer.state || 'disabled',
              created_at: order.customer.created_at || new Date().toISOString(),
              currency: order.customer.currency || 'USD',
              addresses: order.customer.addresses || [],
              default_address: order.customer.default_address || null,
              default_address_id: order.customer.default_address_id || null,
              accepts_marketing_updated_at: order.customer.accepts_marketing_updated_at || new Date().toISOString(),
              marketing_opt_in_level: order.customer.marketing_opt_in_level || null,
              tax_exemptions: order.customer.tax_exemptions || [],
              // Add any other required fields with defaults
              id: order.customer.id,
              // Add any other missing required fields from ShopifyServiceCustomer
              ...(order.customer as any) // Spread the rest of the customer properties
            };
            
            // Now upsert the properly typed customer
            await this.upsertCustomer(typedCustomer);
            customer = typedCustomer;
          }
          
          return {
            ...order,
            created_at: order.created_at || new Date().toISOString(),
            updated_at: order.updated_at || new Date().toISOString(),
            processed_at: order.processed_at || new Date().toISOString(),
            financial_status: order.financial_status || 'pending',
            fulfillment_status: order.fulfillment_status || null,
            currency: order.currency || 'USD',
            total_price: order.total_price || '0',
            subtotal_price: order.subtotal_price || '0',
            total_tax: order.total_tax || '0',
            total_discounts: order.total_discounts || '0',
            total_line_items_price: order.total_line_items_price || '0',
            customer,
            shipping_address: order.shipping_address || null,
            billing_address: order.billing_address || null,
            shipping_lines: order.shipping_lines || [],
            discount_codes: order.discount_codes || [],
            note: order.note || null,
            tags: order.tags || '',
            customer_locale: order.customer_locale || 'en',
            order_status_url: order.order_status_url || null,
            line_items: (order.line_items || []).map(item => ({
              ...item,
              title: item.title || '',
              price: item.price || '0',
              sku: item.sku || '',
              quantity: item.quantity || 0,
              vendor: item.vendor || null,
              name: item.name || '',
              requires_shipping: item.requires_shipping || false,
              taxable: item.taxable || false,
              fulfillment_status: item.fulfillment_status || null,
              fulfillment_service: item.fulfillment_service || 'manual',
              tax_lines: item.tax_lines || [],
              discount_allocations: item.discount_allocations || [],
              properties: item.properties || [],
              variant_title: item.variant_title || null,
              product_exists: item.product_exists || false,
              fulfillable_quantity: item.fulfillable_quantity || 0,
              grams: item.grams || 0,
              total_discount: item.total_discount || '0',
              admin_graphql_api_id: item.admin_graphql_api_id || `gid://shopify/LineItem/${item.id}`,
              duties: item.duties || []
            }))
          };
        }));
        
        return { orders };
      },
      this.upsertOrder.bind(this)
    );
  }
  // #endregion

  // #region Upsert Methods
  private async upsertProduct(product: ShopifyProduct): Promise<void> {
    const productId = `${this.store.id}_${product.id}`;
    const productData = {
      title: product.title,
      bodyHtml: product.body_html || '',
      vendor: product.vendor,
      productType: product.product_type || '',
      handle: product.handle,
      status: product.status,
      publishedAt: product.published_at ? new Date(product.published_at) : null,
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at),
      store: { connect: { id: this.store.id } },
      tenantId: this.store.tenantId,
      price: parseFloat(product.variants?.[0]?.price) || 0,
      imageUrl: product.images?.[0]?.src ?? null,
      tags: product.tags ? product.tags.split(',').map(tag => tag.trim()) : [],
    };

    await this.prisma.product.upsert({
      where: { id: productId },
      create: { 
        ...productData, 
        id: productId, 
        shopifyId: product.id.toString(),
        price: productData.price,
      },
      update: {
        ...productData,
        price: productData.price,
      },
    });
  }

  private async upsertCustomer(customer: ShopifyCustomer): Promise<void> {
    const customerId = `${this.store.id}_${customer.id}`;
    const customerData = {
      email: customer.email,
      firstName: customer.first_name || null,
      lastName: customer.last_name || null,
      phone: customer.phone || null,
      totalSpend: parseFloat(customer.total_spent) || 0,
      ordersCount: customer.orders_count || 0,
      tags: customer.tags ? customer.tags.split(',').map(t => t.trim()) : [],
      updatedAt: new Date(customer.updated_at),
      store: { connect: { id: this.store.id } },
      tenantId: this.store.tenantId,
      acceptsMarketing: (customer as any).accepts_marketing || false,
      verifiedEmail: (customer as any).verified_email || false,
      lastOrderId: (customer as any).last_order_id ? (customer as any).last_order_id.toString() : null,
      lastOrderName: (customer as any).last_order_name || null,
      currency: (customer as any).currency || 'USD',
    };

    await this.prisma.customer.upsert({
      where: { id: customerId },
      create: { 
        ...customerData, 
        id: customerId, 
        shopifyId: customer.id.toString(),
      },
      update: {
        ...customerData,
        // Don't update these fields on existing customers
        id: undefined,
        shopifyId: undefined,
        email: undefined,
        firstName: undefined,
        lastName: undefined,
        phone: undefined,
        totalSpend: undefined,
        ordersCount: undefined,
        updatedAt: undefined,
      },
    });
  }

  private async upsertOrder(order: ShopifyOrder): Promise<void> {
    const orderId = `${this.store.id}_${order.id}`;
    let customerId: string | null = null;

    // Handle customer data if present
    if (order.customer) {
      await this.upsertCustomer(order.customer);
      customerId = `${this.store.id}_${order.customer.id}`;
    }

    const totalLineItemsPrice = parseFloat(order.subtotal_price) || 0;
    const processedAt = order.processed_at ? new Date(order.processed_at) : new Date();
    const createdAt = order.created_at ? new Date(order.created_at) : processedAt;
    const updatedAt = order.updated_at ? new Date(order.updated_at) : new Date();
    
    // Prepare line items as JSON
    const lineItems = (order.line_items || []).map(item => ({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      title: item.title,
      quantity: item.quantity,
      price: parseFloat(item.price) || 0,
      sku: item.sku || '',
      vendor: item.vendor || null,
      name: item.name,
      requiresShipping: item.requires_shipping,
      taxable: item.taxable,
      fulfillmentStatus: item.fulfillment_status,
      fulfillmentService: item.fulfillment_service,
      taxLines: item.tax_lines || [],
      discountAllocations: item.discount_allocations || [],
      properties: item.properties || [],
      variantTitle: item.variant_title,
      productExists: item.product_exists,
      fulfillableQuantity: item.fulfillable_quantity,
      grams: item.grams,
      totalDiscount: parseFloat(item.total_discount) || 0,
      adminGraphqlApiId: item.admin_graphql_api_id,
      duties: item.duties || []
    }));

    // Prepare order data for Prisma
    const orderData = {
      orderNumber: order.order_number.toString(),
      customerId,
      customerEmail: order.customer?.email || null,
      financialStatus: order.financial_status || null,
      fulfillmentStatus: order.fulfillment_status || null,
      currency: order.currency || 'USD',
      totalPrice: parseFloat(order.total_price) || 0,
      subtotalPrice: totalLineItemsPrice,
      totalLineItemsPrice: totalLineItemsPrice,
      totalTax: parseFloat(order.total_tax) || 0,
      totalDiscounts: parseFloat(order.total_discounts) || 0,
      lineItems: lineItems as Prisma.InputJsonValue,
      shippingAddress: order.shipping_address as Prisma.InputJsonValue,
      billingAddress: order.billing_address as Prisma.InputJsonValue,
      shippingLines: (order.shipping_lines || []) as Prisma.InputJsonValue[],
      discountCodes: (order.discount_codes || []) as Prisma.InputJsonValue[],
      note: order.note || null,
      tags: order.tags ? order.tags.split(',').map(tag => tag.trim()) : [],
      processedAt,
      createdAt,
      updatedAt,
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
      orderStatusUrl: order.order_status_url || null,
      customerLocale: order.customer_locale || 'en',
      store: { connect: { id: this.store.id } },
      tenantId: this.store.tenantId,
    };

    // Prepare create and update data separately to handle Prisma's type requirements
    const createData = {
      ...orderData,
      id: orderId,
      shopifyId: order.id.toString(),
      store: { connect: { id: this.store.id } },
      customer: customerId ? { connect: { id: customerId } } : undefined,
    };

    const updateData = {
      ...orderData,
      // Don't update these fields on existing orders
      id: undefined,
      shopifyId: undefined,
      orderNumber: undefined,
      createdAt: undefined,
      customer: customerId ? { connect: { id: customerId } } : { disconnect: true },
    };

    // Remove undefined values to avoid Prisma errors
    const cleanCreateData = Object.fromEntries(
      Object.entries(createData).filter(([_, v]) => v !== undefined)
    );

    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );

    // Create or update the order
    await this.prisma.order.upsert({
      where: { id: orderId },
      create: cleanCreateData as any, // We've ensured type safety above
      update: cleanUpdateData as any, // We've ensured type safety above
    });
  }
  // #endregion

  private async syncPaginatedData<T extends { id: number }>(
    dataType: 'products' | 'customers' | 'orders',
    fetchFn: (params: { limit: number; page: number }) => Promise<{ [key: string]: T[] }>,
    upsertFn: (item: T) => Promise<void>
  ): Promise<SyncResult> {
    let page = 1;
    const limit = 50;
    let hasMore = true;
    const stats = { total: 0, created: 0, updated: 0, errors: 0 };

    logger.info(`Starting sync for ${dataType}...`);

    // Map data type to Prisma model name
    const modelName = dataType.slice(0, -1); // Convert 'products' to 'product', etc.
    
    while (hasMore) {
      try {
        const response = await fetchFn({ limit, page });
        const items = response[dataType] || [];

        if (items.length === 0) {
          hasMore = false;
          continue;
        }

        stats.total += items.length;

        // Process items in batches to avoid overwhelming the database
        const batchSize = 10;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (item: T) => {
            try {
              // Check if record exists to track created/updated stats
              const recordId = `${this.store.id}_${item.id}`;
              const record = await (this.prisma as any)[modelName].findUnique({ 
                where: { id: recordId },
                select: { id: true } // Only select the ID to minimize data transfer
              });
              
              await upsertFn(item);
              
              if (record) {
                stats.updated++;
              } else {
                stats.created++;
              }
            } catch (error) {
              logger.error(`Error processing ${dataType} ${item.id}:`, error);
              stats.errors++;
            }
          }));
        }

        // If we got fewer items than the limit, we've reached the end
        if (items.length < limit) {
          hasMore = false;
        } else {
          page++;
        }
      } catch (error) {
        logger.error(`Error fetching ${dataType} page ${page}:`, error);
        stats.errors++;
        // Only stop if we're getting consistent errors
        if (stats.errors > 3) {
          logger.error('Too many errors, stopping sync');
          hasMore = false;
        }
      }
    }

    const message = `Synced ${stats.total} ${dataType} (${stats.created} created, ${stats.updated} updated, ${stats.errors} errors)`;
    if (stats.errors > 0) {
      logger.warn(message);
    } else {
      logger.info(message);
    }

    return {
      success: stats.errors === 0,
      message,
      stats,
    };
    return { success: stats.errors === 0, message: `${dataType} sync finished.`, stats };
  }
}
