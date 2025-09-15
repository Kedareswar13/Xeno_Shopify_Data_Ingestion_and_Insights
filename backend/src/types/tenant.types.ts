export interface CreateTenantInput {
  externalId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateTenantInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface TenantWithRelations {
  id: string;
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  stores?: any[]; // Replace 'any' with proper Store type if available
}
