import { Link } from "wouter";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { Check, ArrowRight } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    desc: "Get started and explore the basics.",
    features: ["10,000 characters / month", "Standard voices", "MP3 downloads", "Community support"],
    cta: "Get Started",
    href: "/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    desc: "For creators who publish regularly.",
    features: [
      "500,000 characters / month",
      "All premium & emotional voices",
      "Voice cloning",
      "Multilingual dubbing",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    href: "/register",
    highlight: true,
  },
  {
    name: "Business",
    price: "$49",
    period: "/mo",
    desc: "For teams and high-volume needs.",
    features: [
      "2,000,000 characters / month",
      "Everything in Pro",
      "Commercial license",
      "API access",
      "Dedicated support",
    ],
    cta: "Choose Business",
    href: "/register",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#fafaf9] text-gray-900 flex flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-tr from-orange-200/40 via-amber-100/30 to-rose-200/30 blur-3xl" />
          </div>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-10 text-center">
            <h1 className="text-[36px] sm:text-[52px] leading-[1.05] font-black tracking-tight">
              Simple, transparent pricing
            </h1>
            <p className="mt-5 text-[16px] sm:text-[18px] text-gray-500">
              Choose the plan that fits your needs. Upgrade or downgrade anytime.
            </p>
          </div>
        </section>

        {/* Plans */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((p, i) => (
              <div
                key={i}
                className={
                  "relative rounded-3xl p-7 sm:p-8 flex flex-col transition-all " +
                  (p.highlight
                    ? "bg-gray-900 text-white shadow-2xl shadow-orange-200/40 md:-translate-y-3"
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
                <p className={"text-[13.5px] mt-1 " + (p.highlight ? "text-white/60" : "text-gray-500")}>
                  {p.desc}
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-[40px] font-black tracking-tight">{p.price}</span>
                  <span className={p.highlight ? "text-white/50" : "text-gray-400"}>{p.period}</span>
                </div>

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
                      <span className={"text-[13.5px] " + (p.highlight ? "text-white/85" : "text-gray-600")}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.href}
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
            ))}
          </div>

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
