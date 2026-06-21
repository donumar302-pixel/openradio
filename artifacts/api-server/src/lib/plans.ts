export const PLAN_CREDITS: Record<string, number> = {
  free: 10000,
  starter: 100000,
  pro: 500000,
  enterprise: 2000000,
};

export const PLAN_DURATION_DAYS = 30;

export function planCredits(plan: string): number {
  return PLAN_CREDITS[plan] ?? 0;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
