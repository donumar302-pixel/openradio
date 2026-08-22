import { Router } from "express";
import { CURRENCIES, PLAN_DEFINITIONS, priceInCurrency } from "../lib/plans";

const router = Router();

// Public pricing. Exchange rates live server-side; only converted prices ship.
router.get("/", (_req, res) => {
  res.json({
    currencies: CURRENCIES,
    plans: PLAN_DEFINITIONS.map((p) => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      durationDays: p.durationDays,
      highlight: p.highlight,
      cta: p.cta,
      features: p.features,
      more: p.more ?? [],
      prices: Object.fromEntries(CURRENCIES.map((c) => [c.code, priceInCurrency(p.id, c.code)])),
    })),
  });
});

export default router;
