/**
 * @fileoverview Paddle Billing service (Paddle Billing new version).
 *
 * Encapsulates all Paddle API interactions:
 *   - Create/get customers
 *   - Generate checkout transactions (Overlay mode)
 *   - Cancel subscriptions
 *   - Map Paddle Plan → internal Plan enum
 *
 * Paddle Billing docs: https://developer.paddle.com/api-reference/overview
 */

import {Paddle, Environment} from '@paddle/paddle-node-sdk';
import {Plan} from '@prisma/client';
import {config} from '../config/index';
import {logger} from '../utils/logger';

// ---- Price ID → Plan mapping ----

export const PRICE_TO_PLAN: Record<string, {plan: Plan; billing: 'monthly' | 'yearly'}> = {
  [config.PADDLE_PRICE_PRO_MONTHLY]: {plan: 'PRO', billing: 'monthly'},
  [config.PADDLE_PRICE_PRO_YEARLY]: {plan: 'PRO', billing: 'yearly'},
  [config.PADDLE_PRICE_UNLIMITED_MONTHLY]: {plan: 'UNLIMITED', billing: 'monthly'},
  [config.PADDLE_PRICE_UNLIMITED_YEARLY]: {plan: 'UNLIMITED', billing: 'yearly'},
};

// ---- Pricing constants (for frontend display) ----

export const PRICING = {
  PRO: {
    monthly: {priceId: config.PADDLE_PRICE_PRO_MONTHLY, amount: 4.99},
    yearly: {priceId: config.PADDLE_PRICE_PRO_YEARLY, amount: 50},
  },
  UNLIMITED: {
    monthly: {priceId: config.PADDLE_PRICE_UNLIMITED_MONTHLY, amount: 9.99},
    yearly: {priceId: config.PADDLE_PRICE_UNLIMITED_YEARLY, amount: 100},
  },
} as const;

// ---- Paddle SDK client (singleton) ----

let paddleInstance: Paddle | null = null;

function getPaddle(): Paddle {
  if (!paddleInstance) {
    if (!config.PADDLE_API_KEY) {
      throw new Error('PADDLE_API_KEY is not configured');
    }
    // Use PADDLE_ENV (not NODE_ENV) so sandbox keys work in production containers.
    // Set PADDLE_ENV=production in .env only when using live Paddle API keys.
    const environment =
      config.PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox;
    paddleInstance = new Paddle(config.PADDLE_API_KEY, {environment});
  }
  return paddleInstance;
}

// ---- Service class ----

export class PaddleService {
  /**
   * Ensures a Paddle customer exists for the given user.
   * If already linked (paddleCustomerId set), returns that ID.
   * Otherwise creates a new Paddle customer and returns the new ID.
   */
  async ensureCustomer(opts: {
    userId: string;
    email: string | null;
    displayName: string | null;
    existingPaddleCustomerId?: string | null;
  }): Promise<string> {
    if (opts.existingPaddleCustomerId) {
      return opts.existingPaddleCustomerId;
    }

    const paddle = getPaddle();
    let customerId: string;

    try {
      const customer = await paddle.customers.create({
        email: opts.email ?? `user_${opts.userId}@placeholder.local`,
        name: opts.displayName ?? undefined,
        customData: {userId: opts.userId},
      });
      customerId = customer.id;
      logger.info('Created Paddle customer', {userId: opts.userId, paddleCustomerId: customerId});
    } catch (err: any) {
      if ((err.code === 'conflict' || err.code === 'customer_already_exists') && opts.email) {
        logger.info('Customer email conflicts in Paddle, resolving customer ID', {
          email: opts.email,
          errorCode: err.code,
          errorMessage: err.message,
          errorDetail: err.detail,
        });

        // 1. Try to extract from error message/detail using regex (avoids extra API request)
        const errorText = `${err.message || ''} ${err.detail || ''}`;
        const match = errorText.match(/ctm_[a-zA-Z0-9]+/);
        if (match) {
          customerId = match[0];
          logger.info('Reused existing Paddle customer (extracted from conflict error)', {
            userId: opts.userId,
            paddleCustomerId: customerId,
          });
        } else {
          // 2. Fallback: Search for customer using list API
          const customers = paddle.customers.list({email: [opts.email]});
          let existingCustomer: any = null;
          for await (const c of customers) {
            existingCustomer = c;
            break;
          }
          if (existingCustomer) {
            customerId = existingCustomer.id;
            logger.info('Reused existing Paddle customer (retrieved from list query fallback)', {
              userId: opts.userId,
              paddleCustomerId: customerId,
            });
          } else {
            throw err;
          }
        }
      } else {
        throw err;
      }
    }

    return customerId;
  }

  /**
   * Creates a Paddle checkout transaction for Overlay mode.
   * Returns the transaction ID that the frontend passes to Paddle.js.
   *
   * Paddle Overlay docs:
   *   https://developer.paddle.com/build/checkout/build-overlay-checkout
   */
  async createCheckoutTransaction(opts: {
    priceId: string;
    paddleCustomerId: string;
    userId: string;
    successUrl: string;
  }): Promise<{transactionId: string}> {
    const paddle = getPaddle();

    const transaction = await paddle.transactions.create({
      items: [{priceId: opts.priceId, quantity: 1}],
      customerId: opts.paddleCustomerId,
      customData: {userId: opts.userId},
      checkout: {url: opts.successUrl},
    });

    logger.info('Created Paddle checkout transaction', {
      userId: opts.userId,
      transactionId: transaction.id,
      priceId: opts.priceId,
    });

    return {transactionId: transaction.id};
  }

  /**
   * Cancels an active Paddle subscription.
   * Cancellation is effective at end of current billing period.
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    const paddle = getPaddle();
    await paddle.subscriptions.cancel(subscriptionId, {effectiveFrom: 'next_billing_period'});
    logger.info('Cancelled Paddle subscription', {subscriptionId});
  }

  /**
   * Fetches current subscription details from Paddle.
   */
  async getSubscription(subscriptionId: string) {
    const paddle = getPaddle();
    return paddle.subscriptions.get(subscriptionId);
  }

  /**
   * Verifies the Paddle webhook signature using the SDK's built-in helper.
   * Throws if the signature is invalid.
   */
  async verifyWebhookSignature(rawBody: string, signatureHeader: string): Promise<void> {
    if (!config.PADDLE_WEBHOOK_SECRET) {
      throw new Error('PADDLE_WEBHOOK_SECRET is not configured');
    }
    const paddle = getPaddle();
    const isValid = await paddle.webhooks.isSignatureValid(
      rawBody,
      config.PADDLE_WEBHOOK_SECRET,
      signatureHeader,
    );
    if (!isValid) {
      throw new Error('Invalid Paddle webhook signature');
    }
  }

  /**
   * Parses a raw webhook body using the Paddle SDK.
   */
  async unmarshalWebhook(rawBody: string, signatureHeader: string) {
    if (!config.PADDLE_WEBHOOK_SECRET) {
      throw new Error('PADDLE_WEBHOOK_SECRET is not configured');
    }
    const paddle = getPaddle();
    return paddle.webhooks.unmarshal(
      rawBody,
      config.PADDLE_WEBHOOK_SECRET,
      signatureHeader,
    );
  }
}

export const paddleService = new PaddleService();
