import { Link } from "wouter";
import { Home, Mic, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4">
      <div className="text-center max-w-lg">
        {/* Decorative waveform */}
        <div className="flex items-end justify-center gap-1.5 mb-8" aria-hidden="true">
          {[14, 26, 40, 56, 40, 26, 14].map((h, i) => (
            <div
              key={i}
              className="w-2 rounded-full bg-orange-500/80 animate-pulse"
              style={{ height: `${h}px`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>

        <p className="text-7xl sm:text-8xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
          404
        </p>

        <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900">
          This page went off the air
        </h1>
        <p className="mt-3 text-gray-600 leading-relaxed">
          The page you're looking for doesn't exist or has been moved. Let's get
          you back to creating amazing voiceovers.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Mic className="h-4 w-4 text-orange-500" />
            Explore Tools
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Need help?{" "}
          <Link href="/contact" className="text-orange-600 hover:underline font-medium">
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
