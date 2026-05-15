// Stub for api/src/controllers/AuthController.ts.
//
// personaCard.ts uses `authenticateGatewayOrBearer*` as Express middleware on
// its router. In coursework we do not exercise those routes (the server in
// src/server/index.ts has its own simpler routes), but we still need the
// symbols to exist so personaCard.ts compiles unmodified. We export pass-
// through middleware that just calls next().

import type { Request, Response, NextFunction } from 'express';

export function authenticateGatewayOrBearer(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}

export function authenticateGatewayOrBearerIfPresent(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
