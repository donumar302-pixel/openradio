import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { Check, ArrowRight, Loader2, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";

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

export default function PricingPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const [currency, setCurrency] = useState("USD");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const currencies = data?.currencies ?? [];
  const plans      = data?.plans ?? [];
  const symbol     = currencies.find(c => c.code === currency)?.symbol ?? "$";

  return (
    <div className="min-h-screen bg-[#f7f7f6] text-black flex flex-col font-sans">
      <MarketingNav />

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="pt-20 pb-12 px-4 sm:px-6 text-center max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="text-[11px] font-black tracking-widest text-orange-500 uppercase">Pricing</span>
            <h1 className="mt-3 text-[38px] sm:text-[52px] font-black tracking-tight leading-[1.05] text-black">
              Simple Pricing<br />for Every Creator
            </h1>
            <p className="mt-4 text-base sm:text-lg text-black/45 font-medium max-w-xl mx-auto leading-relaxed">
              Enjoy predictable costs, powerful features, and the flexibility to scale at your own pace.
            </p>

            {/* Currency switcher */}
            {currencies.length > 0 && (
              <div className="mt-7 inline-flex items-center gap-1 p-1.5 rounded-full bg-white border border-black/8 shadow-sm">
                {currencies.map(c => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`px-5 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                      currency === c.code
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-black/40 hover:text-black"
                    }`}
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Plans Grid ─────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-28">
          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          )}
          {isError && (
            <p className="text-center text-red-500 py-20">Could not load pricing. Please refresh.</p>
          )}

          {!isLoading && !isError && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {plans.map((plan, i) => {
                const price = plan.prices[currency] ?? 0;
                const isHighlighted = plan.highlight;

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.45 }}
                    className={`relative rounded-3xl p-7 flex flex-col ${
                      isHighlighted
                        ? "bg-[#111] text-white shadow-2xl shadow-black/20 ring-1 ring-orange-500/30"
                        : "bg-white border border-black/8 shadow-sm"
                    }`}
                  >
                    {/* Popular badge */}
                    {isHighlighted && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 text-white text-[11px] font-black rounded-full shadow-lg shadow-orange-500/30 uppercase tracking-wide">
                          <Zap size={10} className="fill-white" /> Most Popular
                        </span>
                      </div>
                    )}

                    {/* Plan name */}
                    <div className="mb-5 pt-2">
                      <h2 className={`text-[17px] font-black mb-1 ${isHighlighted ? "text-white" : "text-black"}`}>
                        {plan.name}
                      </h2>
                    </div>

                    {/* Price */}
                    <div className="mb-1">
                      {price === 0 ? (
                        <span className={`text-[42px] font-black tracking-tight leading-none ${isHighlighted ? "text-white" : "text-black"}`}>
                          $0
                        </span>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className={`text-[42px] font-black tracking-tight leading-none ${isHighlighted ? "text-white" : "text-black"}`}>
                            {symbol}{price % 1 === 0 ? price : price.toFixed(2)}
                          </span>
                          <span className={`text-[14px] font-semibold ${isHighlighted ? "text-white/40" : "text-black/35"}`}>/mo</span>
                        </div>
                      )}
                    </div>
                    <p className={`text-[11px] font-medium mb-6 ${isHighlighted ? "text-white/30" : "text-black/30"}`}>
                      {plan.credits.toLocaleString()} chars · {plan.durationDays} days
                    </p>

                    {/* Features */}
                    <ul className="space-y-2.5 flex-1 mb-7">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2.5">
                          <span className={`mt-0.5 w-[17px] h-[17px] rounded-full flex items-center justify-center shrink-0 ${
                            isHighlighted ? "bg-orange-500" : "bg-orange-100"
                          }`}>
                            <Check size={9} className={isHighlighted ? "text-white" : "text-orange-500"} strokeWidth={3} />
                          </span>
                          <span className={`text-[12px] font-medium leading-snug ${isHighlighted ? "text-white/75" : "text-black/55"}`}>
                            {f}
                          </span>
                        </li>
                      ))}

                      {/* See more details */}
                      {(plan.more?.length ?? 0) > 0 && (
                        <>
                          {expanded[plan.id] && plan.more!.map((f, j) => (
                            <li key={`m-${j}`} className="flex items-start gap-2.5">
                              <span className={`mt-0.5 w-[17px] h-[17px] rounded-full flex items-center justify-center shrink-0 ${
                                isHighlighted ? "bg-white/10" : "bg-black/5"
                              }`}>
                                <Check size={9} className={isHighlighted ? "text-white/60" : "text-black/40"} strokeWidth={3} />
                              </span>
                              <span className={`text-[12px] font-medium leading-snug ${isHighlighted ? "text-white/55" : "text-black/45"}`}>
                                {f}
                              </span>
                            </li>
                          ))}
                          <li>
                            <button
                              onClick={() => setExpanded(e => ({ ...e, [plan.id]: !e[plan.id] }))}
                              className={`inline-flex items-center gap-1 text-[12px] font-bold transition-colors ${
                                isHighlighted ? "text-orange-400 hover:text-orange-300" : "text-orange-500 hover:text-orange-600"
                              }`}
                            >
                              {expanded[plan.id] ? <>See less <ChevronUp size={13} /></> : <>See more <ChevronDown size={13} /></>}
                            </button>
                          </li>
                        </>
                      )}
                    </ul>

                    {/* CTA */}
                    <Link href="/register">
                      <button className={`w-full py-3 rounded-xl text-[13px] font-black tracking-wide transition-all ${
                        isHighlighted
                          ? "bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/25"
                          : "bg-black hover:bg-gray-800 text-white"
                      }`}>
                        {plan.cta}
                      </button>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Bottom note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-[13px] text-black/35 font-medium mt-8"
          >
            All plans include Edge TTS — 400+ voices.{" "}
            <Link href="/register" className="text-orange-500 font-bold hover:underline">
              Need a custom plan? Contact us →
            </Link>
          </motion.p>
        </section>

        {/* ── Bottom CTA strip ───────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-black rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(249,115,22,0.18)_0%,transparent_65%)] pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
                Not sure which plan to pick?
              </h2>
              <p className="text-white/40 text-sm font-medium mb-6 max-w-md mx-auto">
                Start with our Basic plan — no credit card needed. Upgrade whenever you need more characters or features.
              </p>
              <Link href="/register">
                <button className="inline-flex items-center gap-2 px-7 py-3.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-[14px] font-black transition-colors shadow-lg shadow-orange-500/25">
                  Get Started <ArrowRight size={15} />
                </button>
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
