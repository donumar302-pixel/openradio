import type { Request, Response, NextFunction } from "express";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isAdminEmail } from "../lib/admin";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      appUser?: User;
    }
  }
}

export function isUserAdmin(user: Pick<User, "isAdmin" | "email">): boolean {
  return user.isAdmin || isAdminEmail(user.email);
}

export async function requireActiveUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }

  if (!isUserAdmin(user)) {
    if (user.status === "blocked") {
      res.status(403).json({ error: "Your account has been suspended. Please contact support." });
      return;
    }
    if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) {
      res.status(402).json({ error: "Your plan has expired. Please renew to continue." });
      return;
    }
  }

  req.appUser = user;
  next();
}
