import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { ShopifySyncService } from '../src/services/shopify.service';
import logger from '../src/utils/logger';

async function main() {
  const prisma = new PrismaClient();
  try {
    const domain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!domain || !accessToken) {
      throw new Error('Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in .env');
    }

    logger.info(`Manual sync starting for shop: ${domain}`);

    // Ensure a tenant exists (create a placeholder if needed)
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: 'Manual Tenant' },
      });
      logger.info(`Created tenant ${tenant.id}`);
    }

    // Ensure a store exists for the domain
    let store = await prisma.store.findFirst({ where: { domain } });
    if (!store) {
      store = await prisma.store.create({
        data: {
          name: domain,
          domain,
          accessToken,
          tenantId: tenant.id,
        },
      });
      logger.info(`Created store ${store.id} for domain ${domain}`);
    } else if (store.accessToken !== accessToken) {
      store = await prisma.store.update({
        where: { id: store.id },
        data: { accessToken },
      });
      logger.info(`Updated access token for store ${store.id}`);
    }

    // Run the sync
    const sync = new ShopifySyncService(store);
    await sync.syncAllData();

    // Update lastSyncedAt is handled inside sync, but ensure it here too
    await prisma.store.update({
      where: { id: store.id },
      data: { lastSyncedAt: new Date() },
    });

    logger.info('Manual sync complete.');
  } catch (err: any) {
    logger.error('Manual sync failed:', err?.message || err);
    if (err?.stack) {
      console.error(err.stack);
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  } finally {
    await new PrismaClient().$disconnect();
  }
}

main();
