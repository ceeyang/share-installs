/**
 * @fileoverview Billing controller – handles Paddle checkout and subscription management.
 *
 * Routes (all under /dashboard/billing, require session):
 *   POST /checkout    – create a Paddle checkout transaction (Overlay mode)
 *   POST /cancel      – cancel active subscription
 *   GET  /subscription – get current subscription details
 *   GET  /prices      – return configured price IDs and amounts (for frontend)
 */

import {Request, Response} from 'express';
import {prisma} from '../lib/prisma';
import {paddleService, PRICING} from '../services/paddleService';
import {logger} from '../utils/logger';
import {config} from '../config/index';

function requireUserId(req: Request): string {
  if (!req.userId) throw new Error('Unauthorized');
  return req.userId;
}

/**
 * GET /dashboard/billing/prices
 * Returns price IDs and amounts for the frontend (no auth required but kept under dashboard for consistency).
 */
export const getPrices = async (_req: Request, res: Response) => {
  res.json({
    PRO: {
      monthly: {priceId: PRICING.PRO.monthly.priceId, amount: PRICING.PRO.monthly.amount},
      yearly: {priceId: PRICING.PRO.yearly.priceId, amount: PRICING.PRO.yearly.amount},
    },
    UNLIMITED: {
      monthly: {
        priceId: PRICING.UNLIMITED.monthly.priceId,
        amount: PRICING.UNLIMITED.monthly.amount,
      },
      yearly: {
        priceId: PRICING.UNLIMITED.yearly.priceId,
        amount: PRICING.UNLIMITED.yearly.amount,
      },
    },
  });
};

/**
 * POST /dashboard/billing/checkout
 * Body: { priceId: string }
 * Returns: { transactionId: string } – passed to Paddle.js for Overlay checkout.
 */
export const createCheckout = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const {priceId} = req.body as {priceId?: string};

    if (!priceId || typeof priceId !== 'string') {
      return res.status(400).json({error: 'priceId is required'});
    }

    // Validate priceId is one of our known prices
    const validPriceIds = [
      config.PADDLE_PRICE_PRO_MONTHLY,
      config.PADDLE_PRICE_PRO_YEARLY,
      config.PADDLE_PRICE_UNLIMITED_MONTHLY,
      config.PADDLE_PRICE_UNLIMITED_YEARLY,
    ];
    if (!validPriceIds.includes(priceId)) {
      return res.status(400).json({error: 'Invalid priceId'});
    }

    const user = await prisma.user.findUnique({where: {id: userId}});
    if (!user) return res.status(404).json({error: 'User not found'});

    // Ensure Paddle customer exists
    const paddleCustomerId = await paddleService.ensureCustomer({
      userId,
      email: user.email,
      displayName: user.displayName,
      existingPaddleCustomerId: user.paddleCustomerId,
    });

    // Persist paddleCustomerId if newly created
    if (!user.paddleCustomerId) {
      await prisma.user.update({
        where: {id: userId},
        data: {paddleCustomerId},
      });
    }

    const successUrl = `${config.FRONTEND_URL}/billing/success`;
    const {transactionId} = await paddleService.createCheckoutTransaction({
      priceId,
      paddleCustomerId,
      userId,
      successUrl,
    });

    res.json({transactionId});
  } catch (error) {
    logger.error('Failed to create checkout', {error});
    res.status(500).json({error: 'Internal server error'});
  }
};

/**
 * POST /dashboard/billing/cancel
 * Cancels the user's active Paddle subscription (effective at end of billing period).
 */
export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const user = await prisma.user.findUnique({where: {id: userId}});
    if (!user) return res.status(404).json({error: 'User not found'});

    if (!user.paddleSubscriptionId) {
      return res.status(400).json({error: 'No active subscription found'});
    }

    await paddleService.cancelSubscription(user.paddleSubscriptionId);

    res.json({message: 'Subscription will be cancelled at end of current billing period'});
  } catch (error) {
    logger.error('Failed to cancel subscription', {error});
    res.status(500).json({error: 'Internal server error'});
  }
};

/**
 * GET /dashboard/billing/subscription
 * Returns current Paddle subscription details for the logged-in user.
 */
export const getSubscription = async (req: Request, res: Response) => {
  try {
    const userId = requireUserId(req);
    const user = await prisma.user.findUnique({where: {id: userId}});
    if (!user) return res.status(404).json({error: 'User not found'});

    if (!user.paddleSubscriptionId) {
      return res.json({subscription: null});
    }

    const sub = await paddleService.getSubscription(user.paddleSubscriptionId);
    res.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        nextBilledAt: sub.nextBilledAt,
        scheduledChange: sub.scheduledChange,
      },
    });
  } catch (error) {
    logger.error('Failed to get subscription', {error});
    res.status(500).json({error: 'Internal server error'});
  }
};
