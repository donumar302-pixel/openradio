import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { Check, ArrowRight, Loader2 } from "lucide-react";

interface Currency {
  code: string;
  symbol: string;
}
interface Plan {
  id: string;
  name: string;
  credits: number;
  durationDays: number;
  highlight: boolean;
  cta: string;
  features: string[];
  prices: Record<string, number>;
}
interface PlansResponse {
  currencies: Currency[];
  plans: Plan[];
}

async function fetchPlans(): Promise<PlansResponse> {
  const res = await fetch("/api/plans");
  if (!res.ok) throw new Error("Failed to load plans");
  return res.json();
}

function formatPrice(symbol: string, value: number): string {
  const n = Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${n}`;
}

export default function PricingPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const [currency, setCurrency] = useState("USD");

  const currencies = data?.currencies ?? [];
  const plans = data?.plans ?? [];
  const activeSymbol = currencies.find((c) => c.code === currency)?.symbol ?? "$";

  return (
    <div className="min-h-screen bg-[#fafaf9] text-gray-900 flex flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-tr from-orange-200/40 via-amber-100/30 to-rose-200/30 blur-3xl" />
          </div>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-8 text-center">
            <h1 className="text-[36px] sm:text-[52px] leading-[1.05] font-black tracking-tight">
              Simple, transparent pricing
            </h1>
            <p className="mt-5 text-[16px] sm:text-[18px] text-gray-500">
              Choose the plan that fits your needs. Upgrade or downgrade anytime.
            </p>

            {/* Currency switcher */}
            {currencies.length > 0 && (
              <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-white border border-black/[0.07] shadow-sm">
                {currencies.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={
                      "px-4 py-1.5 rounded-full text-[13px] font-bold transition-all " +
                      (currency === c.code
                        ? "bg-[#f97316] text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-900")
                    }
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Plans */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#f97316]" />
            </div>
          )}
          {isError && (
            <p className="text-center text-red-500 py-20">Could not load pricing. Please refresh.</p>
          )}

          {!isLoading && !isError && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {plans.map((p) => {
                const price = p.prices[currency] ?? 0;
                return (
                  <div
                    key={p.id}
                    className={
                      "relative rounded-3xl p-7 flex flex-col transition-all " +
                      (p.highlight
                        ? "bg-gray-900 text-white shadow-2xl shadow-orange-200/40 lg:-translate-y-3"
                        : "bg-white border border-black/[0.07]")
                    }
                  >
                    {p.highlight && (
                      <span className="absolute top-5 right-5 px-3 py-1 rounded-full bg-[#f97316] text-white text-[11px] font-black uppercase tracking-wide">
                        Popular
                      </span>
                    )}
                    <p className={"text-[15px] font-black " + (p.highlight ? "text-white" : "text-gray-900")}>
                      {p.name}
                    </p>
                    <div className="mt-5 flex items-baseline gap-1">
                      <span className="text-[38px] font-black tracking-tight">
                        {price === 0 ? "Free" : formatPrice(activeSymbol, price)}
                      </span>
                      {price !== 0 && (
                        <span className={p.highlight ? "text-white/50" : "text-gray-400"}>/mo</span>
                      )}
                    </div>
                    <p className={"text-[12px] mt-1 " + (p.highlight ? "text-white/50" : "text-gray-400")}>
                      {p.credits.toLocaleString()} characters · {p.durationDays} days
                    </p>

                    <ul className="mt-6 space-y-3 flex-1">
                      {p.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2.5">
                          <span
                            className={
                              "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 " +
                              (p.highlight ? "bg-[#f97316]" : "bg-orange-100")
                            }
                          >
                            <Check size={11} className={p.highlight ? "text-white" : "text-[#f97316]"} />
                          </span>
                          <span className={"text-[13px] " + (p.highlight ? "text-white/85" : "text-gray-600")}>
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href="/register"
                      className={
                        "mt-7 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[14px] font-bold transition-all " +
                        (p.highlight
                          ? "bg-[#f97316] hover:bg-[#ea6c0a] text-white"
                          : "bg-gray-900 hover:bg-gray-800 text-white")
                      }
                    >
                      {p.cta} <ArrowRight size={15} />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-center text-[13px] text-gray-400 mt-10">
            Need a custom plan?{" "}
            <Link href="/register" className="text-[#f97316] font-semibold hover:underline">
              Contact us
            </Link>
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
