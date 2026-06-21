import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import {
  Wand2, Mic, Copy, AudioWaveform, Play, Pause, ArrowRight, Check, Sparkles,
  Globe, BookOpen, Clapperboard, GraduationCap, Megaphone,
} from "lucide-react";

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`.replace(/([^:]\/)\/+/g, "$1");

const DEMO_TABS = [
  { icon: Wand2, label: "Voice Design" },
  { icon: Mic, label: "Text to Speech" },
  { icon: Copy, label: "Voice Clone" },
  { icon: AudioWaveform, label: "Sound Design" },
];

type Voice = {
  id: string;
  name: string;
  tags: string[];
  color: string;
  src: string;
};

const VOICES: Voice[] = [
  { id: "narrator", name: "Educational Narrator", tags: ["English", "Adult", "Male", "Neutral"], color: "bg-blue-500", src: asset("voices/narrator.mp3") },
  { id: "serena", name: "The Healer (Serena)", tags: ["English", "Young", "Female", "Calm"], color: "bg-rose-500", src: asset("voices/serena.mp3") },
  { id: "soren", name: "The Naturalist (Soren)", tags: ["English", "Middle Aged", "Male"], color: "bg-amber-500", src: asset("voices/soren.mp3") },
  { id: "kai", name: "The Mentor (Kai)", tags: ["English", "Young", "Male", "Joyful"], color: "bg-emerald-500", src: asset("voices/kai.mp3") },
];

const ROTATING = ["Truly Alive", "Truly Human", "Truly Yours", "Full of Emotion", "Simply Unreal"];

const SCENARIOS = [
  {
    icon: Globe,
    title: "Multilingual Dubbing",
    desc: "Globalize your content with one-click AI dubbing. Seamlessly translate videos into multiple languages while preserving your original voice and every emotional nuance.",
  },
  {
    icon: BookOpen,
    title: "Immersive Storytelling",
    desc: "Bring audiobooks and narratives to life with expressive, character-rich voices that hold listeners from the first line to the last.",
  },
  {
    icon: Clapperboard,
    title: "Creative & Entertainment",
    desc: "Generate voices for games, animation, and film. Design unique characters with distinct personalities and emotional range.",
  },
  {
    icon: GraduationCap,
    title: "Educational Audio",
    desc: "Turn lessons, courses, and e-learning material into clear, engaging narration that students actually want to listen to.",
  },
  {
    icon: Megaphone,
    title: "Commercial & Branding",
    desc: "Craft polished voiceovers for ads, explainers, and product demos that sound studio-recorded — in minutes, not days.",
  },
];

const FEATURES = [
  { icon: Sparkles, title: "Emotional AI Voices", desc: "Voices that laugh, whisper, and emphasize — with natural human emotion built in." },
  { icon: Copy, title: "Instant Voice Cloning", desc: "Clone any voice from a short sample and use it across all your projects." },
  { icon: Globe, title: "30+ Languages", desc: "Generate and dub content in dozens of languages with native-level fluency." },
  { icon: Mic, title: "Studio-Grade Output", desc: "Crisp, broadcast-ready audio you can drop straight into your timeline." },
];

/* ── Rotating headline word ─────────────────────────────────────────── */
function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % ROTATING.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-block align-top overflow-hidden">
      {ROTATING.map((w, idx) => (
        <span
          key={idx}
          className={
            "block bg-gradient-to-r from-[#f97316] to-amber-500 bg-clip-text text-transparent transition-all duration-500 " +
            (idx === i
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-full absolute inset-0")
          }
        >
          {w}
        </span>
      ))}
    </span>
  );
}

/* ── Animated equalizer bars ────────────────────────────────────────── */
function EqBars() {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {[0, 1, 2, 3].map((n) => (
        <span
          key={n}
          className="w-[3px] rounded-full bg-[#f97316] animate-pulse"
          style={{ height: `${[60, 100, 45, 80][n]}%`, animationDelay: `${n * 120}ms`, animationDuration: "700ms" }}
        />
      ))}
    </div>
  );
}

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState(1);
  const [activeScenario, setActiveScenario] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ScenarioIcon = SCENARIOS[activeScenario].icon;

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  function toggleVoice(v: Voice) {
    setErrorId(null);
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;
      audio.addEventListener("ended", () => setPlayingId(null));
    }
    if (playingId === v.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = v.src;
    audio.currentTime = 0;
    audio.play()
      .then(() => setPlayingId(v.id))
      .catch(() => { setPlayingId(null); setErrorId(v.id); });
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-gray-900">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-gradient-to-tr from-orange-200/50 via-amber-100/40 to-rose-200/40 blur-3xl" />
          <div className="absolute top-[20%] left-[5%] w-[400px] h-[400px] rounded-full bg-orange-300/20 blur-3xl" />
          <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] rounded-full bg-amber-200/30 blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 border border-black/[0.06] text-[12.5px] font-semibold text-gray-600 mb-7 shadow-sm">
            <Sparkles size={13} className="text-[#f97316]" />
            AI-native voices, cloning & design
          </div>
          <h1 className="text-[48px] sm:text-[84px] leading-[0.98] font-black tracking-[-0.03em] text-gray-900">
            Voices That Feel
            <br />
            <RotatingWord />
          </h1>
          <p className="mt-7 text-[16px] sm:text-[19px] text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Unlock AI-native emotional voices, cloning, and design. Create audiobooks,
            podcasts, videos, and beyond — exactly as you imagine.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#f97316] hover:bg-[#ea6c0a] text-white text-[15px] font-bold shadow-lg shadow-orange-500/30 transition-all"
            >
              Get Started
              <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white border border-black/[0.08] text-gray-700 hover:text-gray-900 text-[15px] font-bold transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>

        {/* Product preview mockup */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          <div className="flex justify-center mb-5">
            <div className="inline-flex flex-wrap justify-center gap-1 p-1.5 rounded-2xl bg-white/80 border border-black/[0.06] shadow-sm backdrop-blur">
              {DEMO_TABS.map((t, i) => {
                const Icon = t.icon;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all " +
                      (activeTab === i ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-800")
                    }
                  >
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-black/[0.07] bg-white shadow-2xl shadow-orange-100/50 overflow-hidden">
            <div className="grid md:grid-cols-2">
              {/* Left: text input */}
              <div className="p-6 sm:p-8 border-b md:border-b-0 md:border-r border-black/[0.06]">
                <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Enter your own text
                </p>
                <p className="text-[15px] leading-relaxed text-gray-700">
                  <span className="inline-block mr-1">😄</span> I can't believe I actually won
                  the first prize! This is the best day of my life.{" "}
                  <span className="inline-block mx-1">😢</span> But realizing that I have to move
                  away and leave you guys behind breaks my heart.
                </p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-[12px] text-gray-400">186 / 400</span>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-bold"
                  >
                    <Play size={13} /> Generate Voice
                  </Link>
                </div>
              </div>

              {/* Right: playable voice list */}
              <div className="p-6 sm:p-8 bg-[#fafaf9]/60">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400">
                    Select a voice — tap to play
                  </p>
                </div>
                <div className="space-y-2.5">
                  {VOICES.map((v) => {
                    const isPlaying = playingId === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => toggleVoice(v)}
                        className={
                          "w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all " +
                          (isPlaying
                            ? "border-[#f97316]/50 bg-orange-50/80 shadow-sm"
                            : "border-black/[0.05] bg-white hover:border-[#f97316]/30 hover:shadow-sm")
                        }
                      >
                        {/* Play/pause avatar */}
                        <span className={"relative w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white " + v.color}>
                          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-bold text-gray-900 truncate">{v.name}</p>
                          {errorId === v.id ? (
                            <p className="text-[10.5px] font-semibold text-rose-500 mt-1">Sample coming soon</p>
                          ) : (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {v.tags.slice(0, 4).map((t, j) => (
                                <span key={j} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/[0.05] text-gray-500">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isPlaying && <EqBars />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scenarios */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-[30px] sm:text-[40px] font-black tracking-tight text-gray-900 mb-10">
          Give Every Scenario the
          <br className="hidden sm:block" /> Voice It Deserves
        </h2>

        <div className="grid md:grid-cols-[280px_1fr] gap-6 lg:gap-10">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {SCENARIOS.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveScenario(i)}
                className={
                  "shrink-0 md:w-full text-left px-5 py-3.5 rounded-2xl text-[14.5px] font-bold transition-all whitespace-nowrap md:whitespace-normal " +
                  (activeScenario === i
                    ? "bg-gray-900 text-white shadow-lg"
                    : "bg-white border border-black/[0.06] text-gray-600 hover:text-gray-900")
                }
              >
                {s.title}
              </button>
            ))}
          </div>

          <div className="relative rounded-3xl bg-gray-900 text-white overflow-hidden min-h-[340px] p-7 sm:p-10 flex flex-col justify-between">
            <div className="pointer-events-none absolute inset-0 opacity-30">
              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#f97316]/30 to-transparent" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-[12.5px] font-bold mb-5">
                <ScenarioIcon size={14} className="text-[#f97316]" />
                {SCENARIOS[activeScenario].title}
              </div>
              <p className="text-[17px] sm:text-[19px] leading-relaxed text-white/85 max-w-xl">
                {SCENARIOS[activeScenario].desc}
              </p>
            </div>
            <div className="relative mt-8 flex items-end gap-1 h-16">
              {Array.from({ length: 48 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full bg-gradient-to-t from-[#f97316] to-amber-300"
                  style={{ height: `${20 + Math.abs(Math.sin(i * 0.6 + activeScenario)) * 80}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="p-6 rounded-3xl bg-white border border-black/[0.06] hover:shadow-lg hover:shadow-orange-100/50 transition-all">
                <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-[#f97316]" />
                </div>
                <h3 className="text-[16px] font-black text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-[13.5px] text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA band */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <div className="relative rounded-[32px] bg-gradient-to-br from-[#f97316] to-orange-500 px-8 sm:px-14 py-14 sm:py-20 text-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-white/40 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full bg-amber-200/50 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-[30px] sm:text-[44px] font-black tracking-tight text-white">
              Start creating with BunnyTTS
            </h2>
            <p className="mt-4 text-[16px] sm:text-[18px] text-white/90 max-w-xl mx-auto">
              Join creators bringing their words to life with voices that feel truly alive.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#f97316] text-[15px] font-black shadow-xl hover:scale-[1.02] transition-transform"
            >
              Get Started Free
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
