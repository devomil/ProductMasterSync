import { db } from '../db';
import { marketplaceOrders, marketplaceOrderItems } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

interface OrderSyncState {
  active: boolean;
  intervalId: NodeJS.Timeout | null;
  lastAmazonSync: Date | null;
  lastWalmartSync: Date | null;
  isRunning: boolean;
  intervalMs: number;
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

const state: OrderSyncState = {
  active: false,
  intervalId: null,
  lastAmazonSync: null,
  lastWalmartSync: null,
  isRunning: false,
  intervalMs: FOUR_HOURS_MS,
};

const log = (message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Order Sync Scheduler] ${message}`);
};

async function syncAmazonOrders(): Promise<{ synced: number; updated: number; errors: number }> {
  try {
    const { getAmazonConfigFromDb } = await import('../utils/get-amazon-config-from-db');
    const axios = (await import('axios')).default;

    const config = await getAmazonConfigFromDb();

    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    });

    const tokenResponse = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      tokenParams.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token;

    const createdAfter = new Date();
    createdAfter.setDate(createdAfter.getDate() - 30);

    let allOrders: any[] = [];
    let nextToken: string | undefined;

    do {
      const params: any = {
        MarketplaceIds: config.marketplaceId || 'ATVPDKIKX0DER',
        CreatedAfter: createdAfter.toISOString(),
      };
      if (nextToken) {
        params.NextToken = nextToken;
      } else {
        params.OrderStatuses = 'Unshipped,PartiallyShipped,Shipped,Pending,Canceled';
      }

      const ordersResponse = await axios.get(
        `${config.endpoint || 'https://sellingpartnerapi-na.amazon.com'}/orders/v0/orders`,
        {
          params,
          headers: {
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      const orders = ordersResponse.data?.payload?.Orders || ordersResponse.data?.Orders || [];
      allOrders = allOrders.concat(orders);
      nextToken = ordersResponse.data?.payload?.NextToken || ordersResponse.data?.NextToken;

      if (nextToken) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } while (nextToken);

    log(`Amazon: Fetched ${allOrders.length} orders`);

    const statusMap: Record<string, string> = {
      'Pending': 'pending',
      'Unshipped': 'unshipped',
      'PartiallyShipped': 'unshipped',
      'Shipped': 'shipped',
      'Canceled': 'cancelled',
      'Cancelled': 'cancelled',
      'Unfulfillable': 'on_hold'
    };

    let synced = 0, updated = 0, errors = 0;

    for (const order of allOrders) {
      try {
        const amazonOrderId = order.AmazonOrderId;
        const existingOrders = await db
          .select()
          .from(marketplaceOrders)
          .where(eq(marketplaceOrders.marketplaceOrderId, amazonOrderId))
          .limit(1);

        const orderData = {
          marketplace: 'amazon' as const,
          marketplaceOrderId: amazonOrderId,
          orderNumber: amazonOrderId,
          status: (statusMap[order.OrderStatus] || 'pending') as any,
          orderType: 'standard' as any,
          customerName: order.BuyerInfo?.BuyerName || null,
          customerEmail: order.BuyerInfo?.BuyerEmail || null,
          orderDate: new Date(order.PurchaseDate),
          shipByDate: order.LatestShipDate ? new Date(order.LatestShipDate) : null,
          promisedDeliveryDate: order.LatestDeliveryDate ? new Date(order.LatestDeliveryDate) : null,
          lastModifiedDate: order.LastUpdateDate ? new Date(order.LastUpdateDate) : null,
          totalInCents: order.OrderTotal?.Amount ? Math.round(parseFloat(order.OrderTotal.Amount) * 100) : null,
          currencyCode: order.OrderTotal?.CurrencyCode || 'USD',
          shippingService: order.ShipmentServiceLevelCategory || null,
          isPremium: order.IsPrime || false,
          isBusinessCustomer: order.IsBusinessOrder || false,
          fulfillmentChannel: order.FulfillmentChannel || 'MFN',
          lastSyncedAt: new Date(),
        };

        if (existingOrders.length > 0) {
          await db
            .update(marketplaceOrders)
            .set({ ...orderData, updatedAt: new Date() })
            .where(eq(marketplaceOrders.id, existingOrders[0].id));
          updated++;
        } else {
          const [newOrder] = await db
            .insert(marketplaceOrders)
            .values(orderData)
            .returning();

          try {
            const itemsResponse = await axios.get(
              `${config.endpoint || 'https://sellingpartnerapi-na.amazon.com'}/orders/v0/orders/${amazonOrderId}/orderItems`,
              {
                headers: {
                  'x-amz-access-token': accessToken,
                  'Content-Type': 'application/json'
                }
              }
            );

            const items = itemsResponse.data?.payload?.OrderItems || itemsResponse.data?.OrderItems || [];

            for (const item of items) {
              await db.insert(marketplaceOrderItems).values({
                orderId: newOrder.id,
                marketplaceSku: item.SellerSKU || item.ASIN,
                title: item.Title || null,
                quantity: item.QuantityOrdered || 1,
                unitPriceInCents: item.ItemPrice?.Amount ? Math.round(parseFloat(item.ItemPrice.Amount) * 100 / (item.QuantityOrdered || 1)) : null,
              });
            }
          } catch (itemsError) {
            log(`Amazon: Error fetching items for ${amazonOrderId}`);
          }

          synced++;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (orderError) {
        errors++;
      }
    }

    return { synced, updated, errors };
  } catch (error: any) {
    log(`Amazon sync error: ${error.message}`);
    throw error;
  }
}

async function syncWalmartOrders(): Promise<{ synced: number; updated: number; errors: number }> {
  try {
    const { syncWalmartOrders: doSync } = await import('./walmart-listings-sync');
    return await doSync(30);
  } catch (error: any) {
    log(`Walmart sync error: ${error.message}`);
    throw error;
  }
}

async function runScheduledSync(): Promise<void> {
  if (state.isRunning) {
    log('Sync already in progress, skipping');
    return;
  }

  state.isRunning = true;
  log('Starting scheduled order sync for all marketplaces');

  try {
    const amazonResult = await syncAmazonOrders();
    state.lastAmazonSync = new Date();
    log(`Amazon sync complete: ${amazonResult.synced} new, ${amazonResult.updated} updated, ${amazonResult.errors} errors`);
  } catch (error: any) {
    log(`Amazon order sync failed: ${error.message}`);
    if (error.response?.data) {
      log(`Amazon API error details: ${JSON.stringify(error.response.data)}`);
    }
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const walmartResult = await syncWalmartOrders();
    state.lastWalmartSync = new Date();
    log(`Walmart sync complete: ${walmartResult.synced} new, ${walmartResult.updated} updated, ${walmartResult.errors} errors`);
  } catch (error: any) {
    log(`Walmart order sync failed: ${error.message}`);
    if (error.response?.data) {
      log(`Walmart API error details: ${JSON.stringify(error.response.data)}`);
    }
  }

  state.isRunning = false;
  log('Scheduled order sync complete');
}

export async function initOrderSyncScheduler(): Promise<void> {
  if (state.active) {
    log('Scheduler already active');
    return;
  }

  log('Initializing order sync scheduler (every 4 hours)');

  state.active = true;
  state.intervalId = setInterval(runScheduledSync, state.intervalMs);

  log('Scheduler started - next sync in 4 hours (initial sync skipped to reduce memory usage)');
}

export function stopOrderSyncScheduler(): void {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.active = false;
  log('Scheduler stopped');
}

export function getOrderSyncStatus() {
  return {
    active: state.active,
    isRunning: state.isRunning,
    lastAmazonSync: state.lastAmazonSync?.toISOString() || null,
    lastWalmartSync: state.lastWalmartSync?.toISOString() || null,
    intervalHours: state.intervalMs / (60 * 60 * 1000),
  };
}
