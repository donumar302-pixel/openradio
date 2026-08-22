import { BrandWordmark } from "@/components/brand-wordmark";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { register, registerPending } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const sanitizeReturnTo = (path: string | null): string => {
    if (!path || typeof path !== "string") return "/";
    if (path.includes("\n") || path.includes("\r")) return "/";
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
    return path;
  };

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const checkout = searchParams.get("checkout");
  const currency = searchParams.get("currency");
  let redirectPath = "/";

  if (checkout && currency) {
    redirectPath = `/pricing?checkout=${checkout}&currency=${currency}`;
  } else {
    redirectPath = sanitizeReturnTo(searchParams.get("returnTo"));
  }

  const cleanParams = new URLSearchParams(searchParams);
  cleanParams.delete("error");
  const qs = cleanParams.toString();
  const loginLink = qs ? `/login?${qs}` : "/login";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    register(
      { name: username, email, password },
      {
        onSuccess: () => setLocation(redirectPath),
        onError: (err: any) => setError(err?.error || "Registration failed. Please try again."),
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center justify-center mb-10">
          <BrandWordmark textClass="font-black text-[26px] tracking-tight text-gray-900" imgClass="h-[1.15em] w-auto" />
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-8 py-8">
          <h1 className="text-[22px] font-bold text-gray-900 text-center mb-6">Create an account</h1>

          <GoogleAuthButton label="Sign up with Google" />

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[12px] font-medium text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. johndoe"
                required
                autoComplete="username"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15 transition"
                data-testid="input-name"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15 transition"
                data-testid="input-email"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-gray-200 text-[14px] text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15 transition"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={registerPending}
              className="w-full py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea6c0a] text-white text-[14px] font-bold transition disabled:opacity-60 mt-2 flex items-center justify-center gap-2"
              data-testid="btn-register"
            >
              {registerPending && <Loader2 size={15} className="animate-spin" />}
              {registerPending ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-[13px] text-gray-500 text-center mt-5">
            Already registered?{" "}
            <Link href={loginLink} className="text-[#f97316] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
