-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "shopifyId" TEXT,
    "accessToken" TEXT,
    "scope" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "otp" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "resetPasswordOtp" TEXT,
    "resetPasswordOtpExpiresAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopifyId" TEXT,
    "sku" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "compareAtPrice" DOUBLE PRECISION,
    "inventoryQuantity" INTEGER,
    "vendor" TEXT,
    "productType" TEXT,
    "publishedAt" TIMESTAMP(3),
    "handle" TEXT,
    "tags" TEXT[],
    "images" JSONB,
    "variants" JSONB,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopifyId" TEXT,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "acceptsMarketing" BOOLEAN NOT NULL DEFAULT false,
    "totalSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT,
    "verifiedEmail" BOOLEAN NOT NULL DEFAULT false,
    "addresses" JSONB,
    "defaultAddress" JSONB,
    "tags" TEXT[],
    "lastOrderId" TEXT,
    "lastOrderDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shopifyId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT,
    "financialStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "subtotalPrice" DOUBLE PRECISION NOT NULL,
    "totalTax" DOUBLE PRECISION NOT NULL,
    "totalDiscounts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLineItemsPrice" DOUBLE PRECISION NOT NULL,
    "lineItems" JSONB NOT NULL,
    "shippingAddress" JSONB,
    "billingAddress" JSONB,
    "shippingLines" JSONB,
    "discountCodes" JSONB,
    "note" TEXT,
    "tags" TEXT[],
    "processedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "refunds" JSONB,
    "transactions" JSONB,
    "customerLocale" TEXT,
    "orderStatusUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_externalId_key" ON "public"."tenants"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_name_key" ON "public"."tenants"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stores_domain_key" ON "public"."stores"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "stores_shopifyId_key" ON "public"."stores"("shopifyId");

-- CreateIndex
CREATE INDEX "stores_tenantId_idx" ON "public"."stores"("tenantId");

-- CreateIndex
CREATE INDEX "stores_domain_idx" ON "public"."stores"("domain");

-- CreateIndex
CREATE INDEX "stores_shopifyId_idx" ON "public"."stores"("shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_email_idx" ON "public"."users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "products_shopifyId_key" ON "public"."products"("shopifyId");

-- CreateIndex
CREATE INDEX "products_storeId_idx" ON "public"."products"("storeId");

-- CreateIndex
CREATE INDEX "products_tenantId_idx" ON "public"."products"("tenantId");

-- CreateIndex
CREATE INDEX "products_shopifyId_idx" ON "public"."products"("shopifyId");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "public"."products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "customers_shopifyId_key" ON "public"."customers"("shopifyId");

-- CreateIndex
CREATE INDEX "customers_storeId_idx" ON "public"."customers"("storeId");

-- CreateIndex
CREATE INDEX "customers_tenantId_idx" ON "public"."customers"("tenantId");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "public"."customers"("email");

-- CreateIndex
CREATE INDEX "customers_shopifyId_idx" ON "public"."customers"("shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_storeId_email_key" ON "public"."customers"("storeId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "orders_shopifyId_key" ON "public"."orders"("shopifyId");

-- CreateIndex
CREATE INDEX "orders_storeId_idx" ON "public"."orders"("storeId");

-- CreateIndex
CREATE INDEX "orders_tenantId_idx" ON "public"."orders"("tenantId");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "public"."orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_shopifyId_idx" ON "public"."orders"("shopifyId");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "public"."orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_financialStatus_idx" ON "public"."orders"("financialStatus");

-- CreateIndex
CREATE INDEX "orders_fulfillmentStatus_idx" ON "public"."orders"("fulfillmentStatus");

-- CreateIndex
CREATE INDEX "events_storeId_idx" ON "public"."events"("storeId");

-- CreateIndex
CREATE INDEX "events_tenantId_idx" ON "public"."events"("tenantId");

-- CreateIndex
CREATE INDEX "events_type_idx" ON "public"."events"("type");

-- AddForeignKey
ALTER TABLE "public"."stores" ADD CONSTRAINT "stores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
