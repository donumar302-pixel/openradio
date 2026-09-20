import { BrandWordmark } from "@/components/brand-wordmark";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { useSeo } from "@/lib/seo";
import { Link } from "wouter";

export default function RegisterPage() {
  useSeo({
    title: "Sign Up Free — OpenRadio",
    description: "Create your OpenRadio account securely with Google.",
    path: "/register",
    noindex: true,
  });

  const query = typeof window !== "undefined" ? window.location.search : "";

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center justify-center mb-10">
          <BrandWordmark textClass="font-black text-[26px] tracking-tight text-gray-900" imgClass="h-[1.15em] w-auto" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-8 py-8">
          <h1 className="text-[22px] font-bold text-gray-900 text-center mb-2">Create your account</h1>
          <p className="text-[13px] text-gray-500 text-center mb-6">
            Sign up securely with your Google account.
          </p>

          <GoogleAuthButton label="Sign up with Google" />

          <p className="text-[13px] text-gray-500 text-center mt-6">
            Have an account from a reseller?{" "}
            <Link href={`/login${query}`} className="font-bold text-orange-600 hover:underline" data-testid="link-reseller-login">
              Log in with email and password
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}