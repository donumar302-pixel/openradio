import { useState } from "react";

export default function ResellerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? "Login failed");
        setLoading(false);
        return;
      }
      if (!body?.isReseller) {
        setError("This account is not a reseller account.");
        // Don't leave a non-reseller session hanging on this page.
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
        setLoading(false);
        return;
      }
      window.location.href = "/reseller";
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <p className="font-black text-[24px]">OpenRadio</p>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Reseller Panel</p>
        </div>
        <form onSubmit={submit} className="bg-[#161b22] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50"
              placeholder="you@example.com" autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0f1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50"
              placeholder="••••••••" autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-400 text-xs font-semibold">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="text-center text-white/20 text-xs">Reseller access only. Contact the administrator for an account.</p>
      </div>
    </div>
  );
}
