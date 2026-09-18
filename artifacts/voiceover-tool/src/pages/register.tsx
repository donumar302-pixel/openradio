import { useEffect } from "react";
import { useLocation } from "wouter";

export default function RegisterPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const query = typeof window !== "undefined" ? window.location.search : "";
    setLocation(`/login${query}`, { replace: true });
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-orange-500 animate-spin" aria-label="Opening Google sign-in" />
    </div>
  );
}