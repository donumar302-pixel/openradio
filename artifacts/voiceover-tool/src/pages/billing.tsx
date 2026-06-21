import { CreditCard, Zap, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    credits: "0 Credits",
    features: ["Basic TTS access", "Voice Cloning (1 voice)", "Standard quality", "Community support"],
    current: true,
    cta: "Current Plan",
  },
  {
    name: "Starter",
    price: "$9",
    period: "/ month",
    credits: "10,000 Credits",
    features: ["All TTS engines", "5 Voice Clones", "HD quality audio", "Priority support"],
    current: false,
    cta: "Upgrade",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    credits: "50,000 Credits",
    features: ["All TTS engines", "Unlimited Voice Clones", "Ultra HD quality", "API access", "Priority support"],
    current: false,
    cta: "Upgrade",
    highlight: true,
  },
];

export default function BillingPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Billing</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12">Manage your plan and usage</p>
      </div>

      {/* Current usage card */}
      <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 p-5 flex items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
          <Zap size={22} className="text-white fill-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#6b7280] font-medium">Current Plan</p>
          <p className="text-xl font-extrabold text-foreground">Free Plan</p>
          <p className="text-xs text-[#9ca3af] mt-0.5">0 credits remaining — upgrade to get more</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-foreground">0</p>
          <p className="text-xs text-[#9ca3af]">Credits left</p>
        </div>
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-3">Choose a Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
                plan.highlight
                  ? "border-primary bg-gradient-to-br from-orange-50 to-white shadow-md shadow-primary/10"
                  : "border-[#e5e7eb] bg-white"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-primary text-white uppercase tracking-wide">Most Popular</span>
                </div>
              )}

              <div>
                <p className="text-[13px] font-bold text-[#6b7280] uppercase tracking-wide">{plan.name}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-sm text-[#9ca3af]">{plan.period}</span>
                </div>
                <p className="text-xs text-primary font-semibold mt-0.5">{plan.credits}</p>
              </div>

              <ul className="space-y-1.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-[#6b7280]">
                    <Check size={13} className="text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.current ? "outline" : "default"}
                disabled={plan.current}
                className={`w-full font-bold text-sm ${plan.highlight && !plan.current ? "bg-primary hover:bg-primary/90" : ""}`}
                size="sm"
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing history placeholder */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
        <h2 className="font-bold text-base mb-3">Billing History</h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CreditCard size={32} className="text-[#d1d5db] mb-3" />
          <p className="text-sm font-medium text-[#6b7280]">No billing history yet</p>
          <p className="text-xs text-[#9ca3af] mt-1">Your invoices will appear here after upgrading</p>
        </div>
      </div>
    </div>
  );
}
