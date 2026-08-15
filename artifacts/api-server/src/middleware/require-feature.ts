import type { Request, Response, NextFunction } from "express";
import { isFeatureEnabled } from "../lib/settings";

/**
 * Admin kill-switch: blocks a whole provider/feature when it has been
 * disabled from the admin Settings page. Cached ~30s in lib/settings.
 */
export function requireFeature(feature: string) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    if (await isFeatureEnabled(feature)) { next(); return; }
    res.status(503).json({ error: "This feature is temporarily disabled. Please try again later." });
  };
}
