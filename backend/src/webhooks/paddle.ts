/**
 * @fileoverview Paddle Webhook handler.
 *
 * Public route (no authentication) — Paddle calls this endpoint directly.
 * Requires raw body parsing (must be registered before express.json()).
 *
 * Handled events:
 *   subscription.activated  → upgrade user plan
 *   subscription.updated    → handle plan change (upgrade/downgrade)
 *   subscription.canceled   → downgrade user to FREE
 *   transaction.completed   → handle one-time yearly payment (set planExpiresAt)
 *
 * Paddle webhook docs:
 *   https://developer.paddle.com/webhooks/overview
 */

import {Request, Response} from 'express';
import {EventName} from '@paddle/paddle-node-sdk';
import type {EventEntity} from '@paddle/paddle-node-sdk';
import {prisma} from '../lib/prisma';
import {paddleService, PRICE_TO_PLAN} from '../services/paddleService';
import {logger} from '../utils/logger';
import {Plan} from '@prisma/client';

/**
 * Maps a Paddle price ID to our internal Plan enum.
 * Returns null if the price ID is not recognized.
 */
function resolvePlan(priceId: string): Plan | null {
  return PRICE_TO_PLAN[priceId]?.plan ?? null;
}

/**
 * For yearly subscriptions, compute planExpiresAt as 1 year from now.
 */
function computePlanExpiresAt(priceId: string): Date | null {
  const mapping = PRICE_TO_PLAN[priceId];
  if (!mapping) return null;
  if (mapping.billing === 'yearly') {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  return null;
}

// ---- Event Handlers ----

async function handleSubscriptionActivated(event: EventEntity): Promise<void> {
  const sub = (event as unknown as {data: {customerId: string; id: string; items?: {price?: {id: string}}[];}}).data;

  const customerId = sub.customerId;
  const subscriptionId = sub.id;
  const priceId = sub.items?.[0]?.price?.id;

  if (!priceId) {
    logger.warn('subscription.activated: no priceId found', {subscriptionId});
    return;
  }

  const plan = resolvePlan(priceId);
  if (!plan || plan === 'FREE') {
    logger.warn('subscription.activated: unknown or FREE priceId', {priceId});
    return;
  }

  const planExpiresAt = computePlanExpiresAt(priceId);

  const updated = await prisma.user.updateMany({
    where: {paddleCustomerId: customerId},
    data: {plan, planExpiresAt, paddleSubscriptionId: subscriptionId},
  });

  if (updated.count === 0) {
    logger.error('subscription.activated: no user for paddleCustomerId', {customerId});
  } else {
    logger.info('subscription.activated: upgraded user', {customerId, plan});
  }
}

async function handleSubscriptionUpdated(event: EventEntity): Promise<void> {
  const sub = (event as unknown as {data: {customerId: string; id: string; items?: {price?: {id: string}}[];}}).data;

  const priceId = sub.items?.[0]?.price?.id;
  if (!priceId) return;

  const plan = resolvePlan(priceId);
  if (!plan) return;

  await prisma.user.updateMany({
    where: {paddleCustomerId: sub.customerId},
    data: {plan, planExpiresAt: computePlanExpiresAt(priceId)},
  });

  logger.info('subscription.updated: updated plan', {customerId: sub.customerId, plan});
}

async function handleSubscriptionCanceled(event: EventEntity): Promise<void> {
  const sub = (event as unknown as {data: {customerId: string}}).data;

  await prisma.user.updateMany({
    where: {paddleCustomerId: sub.customerId},
    data: {plan: 'FREE', planExpiresAt: null, paddleSubscriptionId: null},
  });

  logger.info('subscription.canceled: downgraded to FREE', {customerId: sub.customerId});
}

async function handleTransactionCompleted(event: EventEntity): Promise<void> {
  const tx = (event as unknown as {data: {customerId?: string; items?: {price?: {id: string}}[];}}).data;

  const customerId = tx.customerId;
  if (!customerId) return;

  const priceId = tx.items?.[0]?.price?.id;
  if (!priceId) return;

  const mapping = PRICE_TO_PLAN[priceId];
  if (!mapping || mapping.billing !== 'yearly') return;

  await prisma.user.updateMany({
    where: {paddleCustomerId: customerId},
    data: {plan: mapping.plan, planExpiresAt: computePlanExpiresAt(priceId)},
  });

  logger.info('transaction.completed: yearly plan set', {customerId, plan: mapping.plan});
}

// ---- Express handler ----

/**
 * POST /webhooks/paddle
 *
 * This route must receive the raw (unparsed) request body.
 * Registered in app.ts with express.raw() BEFORE express.json().
 */
export const paddleWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  const signatureHeader = req.headers['paddle-signature'];

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    res.status(400).json({error: 'Missing paddle-signature header'});
    return;
  }

  const rawBody = (req.body as Buffer).toString('utf8');

  let event: EventEntity | null;
  try {
    event = await paddleService.unmarshalWebhook(rawBody, signatureHeader);
  } catch (err) {
    logger.warn('Paddle webhook signature/parse failed', {err});
    res.status(401).json({error: 'Invalid webhook signature'});
    return;
  }

  if (!event) {
    res.status(400).json({error: 'Could not parse webhook event'});
    return;
  }

  try {
    switch (event.eventType) {
      case EventName.SubscriptionActivated:
        await handleSubscriptionActivated(event);
        break;
      case EventName.SubscriptionUpdated:
        await handleSubscriptionUpdated(event);
        break;
      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event);
        break;
      case EventName.TransactionCompleted:
        await handleTransactionCompleted(event);
        break;
      default:
        logger.debug('Unhandled Paddle event', {eventType: event.eventType});
    }
    res.json({received: true});
  } catch (err) {
    logger.error('Paddle webhook processing error', {err, eventType: event.eventType});
    res.status(500).json({error: 'Webhook processing failed'});
  }
};
