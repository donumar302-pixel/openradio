import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import type { User } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      resellerUser?: User;
    }
  }
}

export async function requireReseller(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user || !user.isReseller) {
    res.status(403).json({ error: "Reseller access required" });
    return;
  }
  if (user.status !== "active") {
    res.status(403).json({ error: "Account suspended" });
    return;
  }
  if (user.resellerExpiresAt && user.resellerExpiresAt.getTime() < Date.now()) {
    res.status(403).json({ error: "Reseller account expired", expired: true });
    return;
  }
  req.resellerUser = user;
  next();
}
