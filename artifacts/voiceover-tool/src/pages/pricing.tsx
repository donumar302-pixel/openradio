import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { ArrowRight, Loader2, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { useSeo } from "@/lib/seo";
import { trackEvent } from "@/lib/analytics";

interface Currency { code: string; symbol: string; }
interface Plan {
  id: string; name: string; credits: number;
  durationDays: number; highlight: boolean;
  cta: string; features: string[];
  more?: string[];
  prices: Record<string, number>;
}
interface PlansResponse { currencies: Currency[]; plans: Plan[]; }

async function fetchPlans(): Promise<PlansResponse> {
  const res = await fetch("/api/plans");
  if (!res.ok) throw new Error("Failed to load plans");
  return res.json();
}

const DiamondIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2L15 10.5L23 12L15 13.5L12 22L9 13.5L1 12L9 10.5L12 2Z" />
  </svg>
);

function FeatureGroup({ features, title }: { features: string[], title?: string }) {
  if (!features || features.length === 0) return null;
  
  const groups: { type: 'list' | 'table', items: string[] }[] = [];
  let currentGroup: { type: 'list' | 'table', items: string[] } | null = null;
  
  features.forEach(f => {
    // Treat as key/value table row if it has a colon and the key part isn't too long
    const isTable = f.includes(':') && f.split(':')[0].length < 40;
    const type = isTable ? 'table' : 'list';
    
    if (!currentGroup || currentGroup.type !== type) {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = { type, items: [f] };
    } else {
      currentGroup.items.push(f);
    }
  });
  if (currentGroup) groups.push(currentGroup);

  return (
    <div className="flex flex-col gap-5">
      {title && (
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">
            {title}
          </h4>
          {title.toLowerCase().includes('premium') && (
            <span className="text-[8px] font-black tracking-widest text-orange-400 uppercase bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
              Unlocked
            </span>
          )}
        </div>
      )}
      {groups.map((g, i) => (
        g.type === 'list' ? (
          <ul key={i} className="space-y-3 px-1">
            {g.items.map((item, j) => (
               <li key={j} className="flex items-start gap-3">
                 <div className="mt-[3px] shrink-0">
                   <DiamondIcon className="w-3.5 h-3.5 text-orange-500" />
                 </div>
                 <span className="text-[13px] text-white/80 font-medium leading-relaxed">{item}</span>
               </li>
            ))}
          </ul>
        ) : (
          <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 space-y-3">
            {g.items.map((item, j) => {
               const [key, ...rest] = item.split(':');
               const val = rest.join(':').trim();
               return (
                 <div key={j} className="flex items-center justify-between pb-3 border-b border-white/5 last:border-0 last:pb-0">
                   <span className="text-[12px] text-white/50 font-medium pr-4">{key.trim()}</span>
                   <span className="text-[12px] text-white font-bold text-right">{val}</span>
                 </div>
               );
            })}
          </div>
        )
      ))}
    </div>
  );
}

export default function PricingPage() {
  useSeo({
    title: "Pricing & Credit Plans — OpenRadio AI Voice Generator",
    description:
      "Simple credit-based pricing for AI text to speech, voice cloning and dubbing. Start free, upgrade when you need more — no hidden fees.",
    path: "/pricing",
  });
  const { data, isLoading, isError } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [currency, setCurrency] = useState("USD");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const checkoutParam = searchParams.get("checkout");
      const currencyParam = searchParams.get("currency");

      if (checkoutParam && ["starter", "pro", "max"].includes(checkoutParam)) {
        setCheckoutPlanId(checkoutParam);
        if (currencyParam && /^[A-Z]{3}$/.test(currencyParam)) setCurrency(currencyParam);

        // Clear query params after opening checkout.
        window.history.replaceState({}, "", "/pricing");
      } else if (currencyParam) {
        setCurrency(currencyParam);
      }
    }
  }, []);

  const handlePlanClick = (e: React.MouseEvent, plan: Plan) => {
    e.preventDefault();
    const price = plan.prices[currency] ?? 0;
    trackEvent("plan_selected", {
      plan: plan.id,
      currency,
      authenticated: isAuthenticated,
    });

    if (price === 0) {
      if (isAuthenticated) {
        setLocation("/");
      } else {
        setLocation("/register");
      }
    } else {
      setCheckoutPlanId(plan.id);
    }
  };

  const currencies = data?.currencies ?? [];
  const plans      = data?.plans ?? [];
  const symbol     = currencies.find(c => c.code === currency)?.symbol ?? "$";

  return (
    <div className="dark min-h-[100dvh] bg-[#020202] text-white flex flex-col font-sans relative overflow-hidden selection:bg-orange-500/30">
      <CheckoutDialog
        planId={checkoutPlanId}
        currency={currency}
        onClose={() => setCheckoutPlanId(null)}
      />
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-orange-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[400px] bg-orange-500/5 blur-[150px] rounded-full pointer-events-none" />

      <MarketingNav />

      <main className="flex-1 relative z-10">
        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="pt-28 pb-16 px-4 sm:px-6 text-center max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[10px] font-black tracking-widest text-orange-400 uppercase">Pricing Plans</span>
            </div>
            
            <h1 className="text-[40px] sm:text-[56px] lg:text-[72px] font-black tracking-tight leading-[1.05] text-white">
              Scale Your Creative <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-orange-500 to-orange-600">Arsenal</span>
            </h1>
            
            <p className="mt-6 text-base sm:text-xl text-white/50 font-medium max-w-2xl mx-auto leading-relaxed">
              Transparent pricing. Dedicated infrastructure. The most powerful AI models, all in one place.
            </p>
            
            {/* Currency switcher */}
            {currencies.length > 0 && (
              <div className="mt-10 inline-flex items-center p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
                {currencies.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`relative px-8 py-2.5 rounded-xl text-[13px] font-black tracking-wider uppercase transition-all duration-300 ${
                      currency === c.code
                        ? "text-white shadow-lg"
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {currency === c.code && (
                      <motion.div
                        layoutId="currency-indicator"
                        className="absolute inset-0 bg-white/10 border border-white/20 rounded-xl"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Plans Grid ─────────────────────────────────────── */}
        <section className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-32">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
              <span className="text-white/40 text-sm font-bold uppercase tracking-widest">Loading Arsenal...</span>
            </div>
          )}
          {isError && (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <span className="text-red-500 font-bold">!</span>
              </div>
              <span className="text-red-500/80 text-sm font-bold uppercase tracking-widest">Failed to load plans</span>
            </div>
          )}

          {!isLoading && !isError && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
              {plans.map((plan, i) => {
                const price = plan.prices[currency] ?? 0;
                const isHighlighted = plan.highlight;
                const formattedPrice = price === 0 
                  ? "0" 
                  : price.toLocaleString(undefined, {
                      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
                      maximumFractionDigits: price % 1 === 0 ? 0 : 2,
                    });

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
                    className={`relative h-full flex flex-col rounded-[2rem] p-6 sm:p-8 backdrop-blur-md transition-all duration-300 ${
                      isHighlighted
                        ? "bg-[#0d0d12] border border-orange-500/40 shadow-[0_0_40px_-15px_rgba(249,115,22,0.2)] hover:border-orange-500/60 hover:shadow-[0_0_60px_-15px_rgba(249,115,22,0.3)] z-10"
                        : "bg-[#08080b] border border-white/5 shadow-2xl hover:bg-[#0a0a0e] hover:border-white/10"
                    }`}
                  >
                    {isHighlighted && (
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)] rounded-[2rem] pointer-events-none" />
                    )}

                    <div className="relative z-10 flex-1 flex flex-col">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <h2 className={`text-2xl font-black tracking-tight uppercase ${isHighlighted ? "text-orange-500" : "text-white"}`}>
                          {plan.name}
                        </h2>
                        {isHighlighted && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black rounded-full shadow-lg uppercase tracking-widest">
                            <Zap size={10} className="fill-orange-400" /> Best Value
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="mt-4 mb-6">
                        <div className="flex items-end gap-1.5">
                          {price === 0 && <span className="text-[48px] font-black tracking-tighter text-white leading-[1]">$</span>}
                          <span className="text-[48px] font-black tracking-tighter text-white leading-[1]">
                            {price !== 0 && symbol}{formattedPrice}
                          </span>
                          <span className="text-[14px] font-bold text-white/30 uppercase tracking-wide mb-1.5">/mo</span>
                        </div>
                        {plan.credits > 0 && plan.durationDays > 0 && (
                          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                            <Zap className="w-3.5 h-3.5 text-orange-400" />
                            <span className="text-[11px] font-bold text-white/60 tracking-wide">
                              {plan.credits.toLocaleString()} Characters <span className="text-white/20 mx-1">•</span> {plan.durationDays} Days
                            </span>
                          </div>
                        )}
                      </div>

                      {/* CTA Button */}
                      <button
                        onClick={(e) => handlePlanClick(e, plan)}
                        className={`w-full block py-4 text-center rounded-xl text-[13px] font-black uppercase tracking-widest transition-all duration-300 ${
                          isHighlighted
                            ? "bg-orange-500 hover:bg-orange-400 text-white shadow-[0_0_20px_-5px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.6)] hover:scale-[1.02]"
                            : "bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white hover:scale-[1.02]"
                        }`}
                      >
                        {plan.cta}
                      </button>

                      {/* Divider */}
                      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

                      {/* Features */}
                      <div className="flex-1 flex flex-col">
                        <FeatureGroup features={plan.features} title="Included Capabilities" />

                        {(plan.more?.length ?? 0) > 0 && (
                          <div className="mt-auto pt-6">
                            <AnimatePresence>
                              {expanded[plan.id] && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden mb-6"
                                >
                                  <div className="pt-2 pb-2">
                                    <FeatureGroup features={plan.more!} title="Premium Models & Details" />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <button
                              onClick={() => setExpanded(e => ({ ...e, [plan.id]: !e[plan.id] }))}
                              className={`w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-xl border ${
                                expanded[plan.id]
                                  ? "text-white/60 hover:text-white bg-white/10 border-white/10"
                                  : "text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border-white/5"
                              }`}
                            >
                              {expanded[plan.id] ? (
                                <>Hide Advanced <ChevronUp size={14} /></>
                              ) : (
                                <>View Full Toolset <ChevronDown size={14} /></>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Bottom note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-16"
          >
            <p className="text-[13px] text-white/40 font-medium">
              All plans include Edge TTS — 400+ voices.{" "}
              <Link href="/contact" className="text-orange-400 font-bold hover:text-orange-300 transition-colors ml-1">
                Need a custom enterprise plan? Contact us <ArrowRight className="inline w-3 h-3 ml-0.5 relative -top-[1px]" />
              </Link>
            </p>
          </motion.div>
        </section>

        {/* ── Bottom CTA strip ───────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-[2.5rem] bg-[#0c0c10] border border-white/10 p-10 sm:p-16 text-center overflow-hidden shadow-2xl"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)] pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
                Not sure where to start?
              </h2>
              <p className="text-white/50 text-base font-medium mb-10 max-w-lg mx-auto">
                Begin with our Basic plan—no credit card required. Upgrade seamlessly as your creative needs grow.
              </p>
              <button
                onClick={(e) => handlePlanClick(e, plans[0] || { id: 'free', prices: { [currency]: 0 } } as any)}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-[14px] font-black uppercase tracking-widest transition-all shadow-[0_0_30px_-10px_rgba(249,115,22,0.6)] hover:shadow-[0_0_40px_-5px_rgba(249,115,22,0.8)] hover:scale-105"
              >
                Start for Free <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
