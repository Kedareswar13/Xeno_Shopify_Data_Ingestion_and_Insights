import { Prisma, Store } from '@prisma/client';
import axios from 'axios';
import { prisma } from '@/utils/prisma';

export class StoreService {
  private prisma: typeof prisma;

  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  /**
   * Connect or update a Shopify store
   */
  async connectStore(params: {
    tenantId: string;
    domain: string;
    accessToken: string;
    shopifyId?: string;
    name: string;
    scope?: string[];
  }): Promise<Store> {
    const { tenantId, domain, accessToken, shopifyId, name, scope = [] } = params;

    // Clean domain (remove protocol and trailing slashes)
    const cleanDomain = domain.replace(/^https?:\/\/|\/$/g, '');

    // Check if store already exists for this tenant
    const existingStore = await this.prisma.store.findFirst({
      where: {
        OR: [
          { domain: cleanDomain },
          ...(shopifyId ? [{ shopifyId }] : []),
        ],
      },
    });

    const data: Prisma.StoreCreateInput = {
      name,
      domain: cleanDomain,
      accessToken,
      scope,
      isActive: true,
      tenant: { connect: { id: tenantId } },
      ...(shopifyId && { shopifyId }),
    };

    if (existingStore) {
      // Update existing store
      if (existingStore.tenantId !== tenantId) {
        throw new Error('Store already connected to another tenant');
      }

      return this.prisma.store.update({
        where: { id: existingStore.id },
        data: {
          ...data,
          // Don't update the shopifyId if it already exists
          ...(existingStore.shopifyId && { shopifyId: undefined }),
        },
      });
    }

    // Create new store
    return this.prisma.store.create({
      data,
    });
  }

  /**
   * Disconnect a store
   */
  async disconnectStore(storeId: string): Promise<Store> {
    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        accessToken: null,
        isActive: false,
      },
    });
  }

  /**
   * Get store by ID with optional relations
   */
  async getStoreById(
    id: string,
    includeRelations: boolean = false
  ): Promise<Store | null> {
    return this.prisma.store.findUnique({
      where: { id },
      include: {
        tenant: includeRelations,
        products: includeRelations,
        customers: includeRelations,
        orders: includeRelations,
      },
    });
  }

  /**
   * List stores for a tenant with pagination
   */
  async listStores(params: {
    tenantId: string;
    skip?: number;
    take?: number;
    where?: Prisma.StoreWhereInput;
    orderBy?: Prisma.StoreOrderByWithRelationInput;
  }): Promise<{ data: Store[]; total: number }> {
    const { tenantId, skip = 0, take = 10, where = {}, orderBy = { createdAt: 'desc' } } = params;

    const [data, total] = await Promise.all([
      this.prisma.store.findMany({
        where: { ...where, tenantId },
        skip,
        take,
        orderBy,
      }),
      this.prisma.store.count({
        where: { ...where, tenantId },
      }),
    ]);

    return { data, total };
  }

  /**
   * Verify store connection by making a test API call to Shopify
   */
  async verifyStoreConnection(store: Store): Promise<boolean> {
    if (!store.accessToken) return false;

    try {
      const response = await axios.get(
        `https://${store.domain}/admin/api/2023-10/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': store.accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error('Error verifying store connection:', error);
      return false;
    }
  }

  /**
   * Update store's last sync timestamp
   */
  async updateLastSync(storeId: string): Promise<void> {
    await this.prisma.store.update({
      where: { id: storeId },
      data: { lastSyncedAt: new Date() },
    });
  }
}

// Export a singleton instance
export const storeService = new StoreService();
