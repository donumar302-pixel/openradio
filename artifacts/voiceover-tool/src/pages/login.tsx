import { BrandWordmark } from "@/components/brand-wordmark";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { useSeo } from "@/lib/seo";

export default function LoginPage() {
  useSeo({
    title: "Log In — OpenRadio",
    description: "Continue with Google to access OpenRadio and create AI voiceovers, clone voices and dub videos.",
    path: "/login",
    noindex: true,
  });

  const googleFailed =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("error") === "google";

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center mb-10">
          <BrandWordmark textClass="font-black text-[26px] tracking-tight text-gray-900" imgClass="h-[1.15em] w-auto" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-8 py-8">
          <h1 className="text-[22px] font-bold text-gray-900 text-center mb-2">Welcome to OpenRadio</h1>
          <p className="text-[13px] text-gray-500 text-center mb-6">
            Continue securely with your Google account.
          </p>

          {googleFailed && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] font-medium" data-testid="text-google-error">
              Google sign-in failed. Please try again.
            </div>
          )}

          <GoogleAuthButton label="Continue with Google" />

          <p className="text-[11px] leading-relaxed text-gray-400 text-center mt-5">
            A new OpenRadio account will be created automatically the first time you continue with Google.
          </p>
        </div>
      </div>
    </div>
  );
}