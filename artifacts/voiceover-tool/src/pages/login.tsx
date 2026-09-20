import { BrandWordmark } from "@/components/brand-wordmark";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { useAuth } from "@/hooks/use-auth";
import { useSeo } from "@/lib/seo";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.includes("\n") || value.includes("\r")) return "/";
  return value;
}

export default function LoginPage() {
  useSeo({
    title: "Log In — OpenRadio",
    description: "Continue with Google or log in to an account provided by an OpenRadio reseller.",
    path: "/login",
    noindex: true,
  });

  const [, setLocation] = useLocation();
  const { login, loginPending } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [error, setError] = useState(
    params.get("error") === "google" ? "Google sign-in failed. Please try again." : "",
  );
  const returnTo = safeReturnTo(params.get("returnTo"));
  const signupHref = params.toString() ? `/register?${params.toString()}` : "/register";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    login(
      { email, password },
      {
        onSuccess: () => setLocation(returnTo),
        onError: (err: any) => setError(err?.error || err?.message || "Invalid email or password"),
      },
    );
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center mb-8">
          <BrandWordmark textClass="font-black text-[26px] tracking-tight text-gray-900" imgClass="h-[1.15em] w-auto" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-8 py-8">
          <h1 className="text-[22px] font-bold text-gray-900 text-center mb-2">Log in to OpenRadio</h1>
          <p className="text-[13px] text-gray-500 text-center mb-6">Choose the option that matches your account.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] font-medium" data-testid="text-login-error">
              {error}
            </div>
          )}

          <GoogleAuthButton label="Continue with Google" />

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Reseller account</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reseller-login-email" className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                id="reseller-login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                data-testid="input-email"
              />
            </div>

            <div>
              <label htmlFor="reseller-login-password" className="block text-[13px] font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="reseller-login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-gray-200 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginPending}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[14px] font-bold transition disabled:opacity-60 flex items-center justify-center gap-2"
              data-testid="btn-reseller-login"
            >
              {loginPending && <Loader2 size={15} className="animate-spin" />}
              {loginPending ? "Logging in..." : "Log in with Email"}
            </button>
          </form>

          <p className="text-[12px] text-gray-500 text-center mt-5">
            Need a new account?{" "}
            <Link href={signupHref} className="font-bold text-orange-600 hover:underline">Sign up with Google</Link>
          </p>
        </div>
      </div>
    </div>
  );
}