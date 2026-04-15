/**
 * @fileoverview Express application factory.
 * Composes middleware and routes without starting the server.
 * Keeping this separate from server.ts enables clean integration testing.
 */

import path from 'path';
import {v4 as uuidv4} from 'uuid';
import express, {Application} from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import {PrismaClient} from '@prisma/client';
import type {Redis} from 'ioredis';
import {config} from './config/index';
import {logger} from './utils/logger';
import {createRouter} from './routes/index';
import {errorHandler, notFoundHandler} from './middleware/errorHandler';

export function createApp(prisma: PrismaClient, redis: Redis): Application {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: config.NODE_ENV === 'production',
    }),
  );

  // CORS
  const allowedOrigins = config.CORS_ORIGINS.split(',').map(s => s.trim());
  const corsOptions: cors.CorsOptions = {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-SDK-Platform', 'X-SDK-Version', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true, // Required for cross-origin cookie sessions (dashboard SPA → API)
  };

  if (allowedOrigins.includes('*') || config.NODE_ENV !== 'production') {
    // Development / wildcard: allow all origins
    corsOptions.origin = true;
  } else {
    // Production: include FRONTEND_URL automatically alongside explicit CORS_ORIGINS
    const productionOrigins = [...allowedOrigins];
    if (config.FRONTEND_URL && !productionOrigins.includes(config.FRONTEND_URL)) {
      productionOrigins.push(config.FRONTEND_URL);
    }
    corsOptions.origin = (origin, callback) => {
      if (!origin || productionOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    };
  }
  app.use(cors(corsOptions));

  // Request compression
  app.use(compression());

  // Request body parsing
  app.use(express.json({limit: '1mb'}));
  app.use(express.urlencoded({extended: true}));

  // Parse cookies (used for dashboard session JWT)
  app.use(cookieParser());

  // Structured HTTP logging with Request-ID propagation.
  // The ID is taken from the incoming X-Request-Id header (so callers can
  // correlate across services) or generated fresh, then echoed back in the
  // response so clients can reference it in support requests.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers['x-request-id'];
        const id = (typeof existing === 'string' && existing) ? existing : uuidv4();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (_req, res) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // Trust proxy headers when running behind load balancer
  app.set('trust proxy', 1);

  // Development-only static assets
  if (config.NODE_ENV !== 'production') {
    const examplesPath = path.resolve(__dirname, '../../examples');
    const sdkJsDistPath = path.resolve(__dirname, '../../sdk/js/dist');
    app.use('/examples', express.static(examplesPath));
    app.use('/sdk/js/dist', express.static(sdkJsDistPath));
    logger.info(`Examples:  http://localhost:${config.PORT}/examples/web/fingerprint-demo.html`);
    logger.info(`Health:    http://localhost:${config.PORT}/api/health`);
  }

  // Routes — mounted at /api so local and production share the same base path.
  // Local:      http://localhost:6066/api/v1/clicks
  // Production: https://console.share-installs.com/api/v1/clicks (nginx passes /api/ through)
  app.use('/api', createRouter(prisma, redis));

  // 404 handler
  app.use(notFoundHandler);

  // Centralized error handler (must be last)
  app.use(errorHandler);

  return app;
}
