import { Prisma, Tenant } from '@prisma/client';
import { CreateTenantInput, UpdateTenantInput } from '@/types/tenant.types';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '@/utils/errors';
import { prisma } from '@/utils/prisma';
export class TenantService {
  private prisma: typeof prisma;

  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  /**
   * Create a new tenant with the provided input
   */
  async createTenant(createInput: CreateTenantInput): Promise<Tenant> {
    try {
      return await this.prisma.tenant.create({
        data: {
          ...createInput,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new AppError(
            'Tenant with this externalId or name already exists',
            StatusCodes.CONFLICT
          );
        }
      }
      throw error;
    }
  }

  /**
   * Find or create a tenant by external ID or name
   * Prevents duplicate tenants and handles race conditions
   */
  async findOrCreateTenant(createInput: CreateTenantInput): Promise<Tenant> {
    const { externalId } = createInput;
    
    // First try to find existing tenant
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { externalId }
    });
    
    if (existingTenant) {
      return existingTenant;
    }
    
    // If not found, create new tenant with transaction to prevent race conditions
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check again in transaction to handle race condition
        const existing = await tx.tenant.findUnique({
          where: { externalId }
        });
        
        if (existing) {
          return existing;
        }
        
        // Create new tenant using the createTenant method
        return await this.createTenant(createInput);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle unique constraint violation
        if (error.code === 'P2002') {
          // If we get a unique constraint error, another request created the tenant
          const tenant = await this.prisma.tenant.findUnique({
            where: { externalId }
          });
          if (!tenant) {
            throw new AppError('Failed to create or find tenant', StatusCodes.INTERNAL_SERVER_ERROR);
          }
          return tenant;
        }
      }
      throw error;
    }
  }

  /**
   * Get tenant by ID with optional relations
   */
  async getTenantById(
    id: string,
    includeRelations: boolean = false
  ): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: {
        stores: includeRelations,
        users: includeRelations,
      },
    });
  }

  /**
   * Update tenant information
   */
  async updateTenant(
    id: string,
    data: Prisma.TenantUpdateInput
  ): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a tenant and all related data (cascading delete)
   */
  async deleteTenant(id: string): Promise<void> {
    // Use a transaction to ensure data consistency
    await this.prisma.$transaction([
      // Delete related data first
      this.prisma.product.deleteMany({ where: { store: { tenantId: id } } }),
      this.prisma.customer.deleteMany({ where: { store: { tenantId: id } } }),
      this.prisma.order.deleteMany({ where: { store: { tenantId: id } } }),
      this.prisma.event.deleteMany({ where: { store: { tenantId: id } } }),
      this.prisma.store.deleteMany({ where: { tenantId: id } }),
      this.prisma.user.deleteMany({ where: { tenantId: id } }),
      // Finally delete the tenant
      this.prisma.tenant.delete({ where: { id } }),
    ]);
  }

  /**
   * List all tenants with pagination
   */
  async listTenants(params: {
    skip?: number;
    take?: number;
    where?: Prisma.TenantWhereInput;
    orderBy?: Prisma.TenantOrderByWithRelationInput;
  }): Promise<{ data: Tenant[]; total: number }> {
    const { skip = 0, take = 10, where, orderBy } = params;

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take,
        where,
        orderBy,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total };
  }
}

// Export a singleton instance
export const tenantService = new TenantService();
