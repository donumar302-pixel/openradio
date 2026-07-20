import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { 
  Play, Pause, ArrowRight, Mic, Globe, 
  Wand2, AudioLines, Sparkles, Zap, Fingerprint,
  MessageSquare, Headset, Shapes
} from "lucide-react";
import { motion } from "framer-motion";

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`.replace(/([^:]\/)\/+/g, "$1");

type Voice = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  src: string;
  gradient: string;
};

const VOICES: Voice[] = [
  {
    id: "v1", name: "Audiobook", category: "Narrator",
    tags: ["Professional", "Calm", "Articulate"],
    src: asset("voices/narrator.mp3"),
    gradient: "from-stone-400 via-orange-200 to-amber-100",
  },
  {
    id: "v2", name: "Guided Meditation", category: "Companion",
    tags: ["Warm", "Soothing", "Feminine"],
    src: asset("voices/serena.mp3"),
    gradient: "from-rose-300 via-pink-200 to-orange-100",
  },
  {
    id: "v3", name: "Voice Acting", category: "Character",
    tags: ["Expressive", "Lively", "Charismatic"],
    src: asset("voices/soren.mp3"),
    gradient: "from-orange-400 via-amber-300 to-yellow-100",
  },
  {
    id: "v4", name: "Commercial Ad", category: "Presenter",
    tags: ["Energetic", "Bold", "Persuasive"],
    src: asset("voices/kai.mp3"),
    gradient: "from-sky-300 via-indigo-200 to-purple-100",
  },
];

const fadeIn = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } }
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const ROTATING = ["Truly Alive", "Truly Human", "Truly Yours", "Full of Emotion", "Simply Unreal"];

const DEMO_VOICES = [
  { id: "d1", name: "Arthur (Narrator)", tags: ["English", "Adult", "Male", "Calm"], color: "bg-amber-200" },
  { id: "d2", name: "Elena (Healer)", tags: ["English", "Young", "Female", "Calm"], color: "bg-rose-200" },
  { id: "d3", name: "Marcus (Soren)", tags: ["English", "Middle Aged", "Male", "Calm"], color: "bg-sky-200" },
  { id: "d4", name: "Leo (Mentor)", tags: ["English", "Young", "Male", "Energetic"], color: "bg-orange-200" },
];

const DEMO_TEXTS = {
  tts: `[😊]: Yes! I finally beat you at this game! I am the champion!\n[😤]: Wait a minute... why is the console unplugged? You let me win on purpose? That is so insulting!`,
  clone: `Upload your voice sample and type any text — we'll clone it instantly with the same tone, pace, and emotion as the original.`,
};

function HeroDemoWidget() {
  const [tab, setTab] = useState<"tts" | "clone">("tts");
  const [text, setText] = useState(DEMO_TEXTS.tts);
  const [selectedVoice, setSelectedVoice] = useState("d3");
  const [showDropdown, setShowDropdown] = useState(false);

  const handleTab = (t: "tts" | "clone") => {
    setTab(t);
    setText(DEMO_TEXTS[t]);
  };

  const selected = DEMO_VOICES.find(v => v.id === selectedVoice)!;
  const maxChars = 400;

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 mb-4">
      {/* Tab bar */}
      <div className="flex items-center justify-center gap-1 mb-5">
        {([["tts", "Text to Speech"], ["clone", "Voice Clone"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => handleTab(id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              tab === id ? "bg-black text-white shadow" : "text-black/50 hover:text-black"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Widget card */}
      <div className="bg-white rounded-3xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12)] border border-black/5 overflow-hidden">
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/5">
          {/* Left — text area */}
          <div className="p-5 flex flex-col min-h-[260px]">
            <p className="text-xs font-bold text-black/30 uppercase tracking-widest mb-3">Enter your own text here</p>
            {tab === "clone" && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-black/10 text-sm text-black/40 font-medium cursor-pointer hover:border-orange-300 transition-colors">
                <Mic size={16} className="text-orange-400" />
                Upload voice sample (MP3, WAV)
              </div>
            )}
            <textarea
              className="flex-1 resize-none text-sm font-medium text-black leading-relaxed bg-transparent outline-none placeholder:text-black/20"
              value={text}
              onChange={e => setText(e.target.value.slice(0, maxChars))}
              rows={6}
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5">
              <span className="text-xs text-black/30 font-medium">{text.length} / {maxChars}</span>
              <Link href="/register" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-full text-white text-sm font-bold shadow shadow-orange-500/30 transition-all">
                <Sparkles size={14} />
                Generate Voice
              </Link>
            </div>
          </div>

          {/* Right — voice selection */}
          <div className="p-5 flex flex-col">
            <p className="text-xs font-bold text-black/30 uppercase tracking-widest mb-3">Select a Voice</p>
            <div className="flex-1 space-y-1.5 overflow-auto">
              {DEMO_VOICES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all ${
                    selectedVoice === v.id
                      ? "bg-orange-50 ring-2 ring-orange-400"
                      : "hover:bg-black/[0.03]"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 ${v.color} flex items-center justify-center text-black/40`}>
                    <Mic size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-black truncate">{v.name}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {v.tags.map(t => (
                        <span key={t} className="text-[10px] font-semibold text-black/40">{t}</span>
                      ))}
                    </div>
                  </div>
                  {selectedVoice === v.id && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <Link href="/register" className="mt-3 flex items-center justify-center gap-1.5 pt-3 border-t border-black/5 text-xs font-bold text-black/40 hover:text-orange-500 transition-colors">
              <ArrowRight size={12} />
              Explore More Popular Voices
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

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
            "block text-orange-500 transition-all duration-500 " +
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

function AnimatedWaveform({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-center gap-[4px] h-8">
      {[0, 1, 2, 3, 4].map((n) => (
        <motion.div
          key={n}
          className="w-[4px] rounded-full bg-orange-500"
          animate={isPlaying ? {
            height: ["20%", "100%", "40%", "80%", "20%"],
          } : {
            height: "20%"
          }}
          transition={isPlaying ? {
            duration: 0.8,
            repeat: Infinity,
            delay: n * 0.1,
            ease: "easeInOut"
          } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

export default function LandingPage() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    <div className="min-h-screen bg-[#fafafa] text-black overflow-x-clip font-sans selection:bg-orange-500/20 selection:text-orange-900">
      <MarketingNav />

      {/* 1. Hero Section */}
      <section className="relative pt-24 pb-32 sm:pt-32 sm:pb-40 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Soft floating background blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-orange-400/20 rounded-[100%] blur-[120px] pointer-events-none -z-10" />
        
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div variants={fadeIn} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-black/5 text-sm font-bold text-black mb-8">
            <span className="flex h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse" />
            The Next Generation of AI Audio
          </motion.div>
          
          <motion.h1 variants={fadeIn} className="text-[40px] sm:text-6xl lg:text-7xl font-black tracking-[-0.03em] leading-[1.02] text-black mb-6">
            Voices That Feel <br/>
            <RotatingWord />
          </motion.h1>
          
          <motion.p variants={fadeIn} className="text-base sm:text-lg text-black/60 font-medium max-w-xl mx-auto leading-relaxed mb-8">
            Generate lifelike speech, clone voices in seconds, and dub videos globally. A playful, premium studio built for modern creators.
          </motion.p>
          
          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/register" className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-orange-500 hover:bg-orange-600 rounded-full text-white text-[15px] font-bold shadow-lg shadow-orange-500/30 transition-all">
              Start Creating Free
              <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white rounded-full text-black text-[15px] font-bold border border-black/10 hover:border-black/20 transition-colors">
              View Credit Plans
            </Link>
          </motion.div>

          <motion.div variants={fadeIn}>
            <HeroDemoWidget />
          </motion.div>
        </motion.div>
      </section>

      {/* 2. Bunny Audio Voice Cards */}
      <section className="relative px-4 sm:px-6 max-w-6xl mx-auto pb-28">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="mb-10">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-black leading-tight mb-3">
              Experience Bunny Audio<br />
              <span className="text-black/40 font-semibold text-xl sm:text-2xl">AI Voice — but this time, it's alive.</span>
            </h2>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-black rounded-full text-white text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              Hear it in action <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {VOICES.map((v) => {
              const isPlaying = playingId === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => toggleVoice(v)}
                  aria-pressed={isPlaying}
                  aria-label={(isPlaying ? "Pause " : "Play ") + v.name}
                  className="group relative rounded-3xl overflow-hidden aspect-[3/4] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  {/* Gradient texture background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${v.gradient} transition-all duration-500 group-hover:scale-105`} />
                  {/* Noise overlay for texture */}
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "150px" }} />
                  {/* Playing ring */}
                  {isPlaying && (
                    <div className="absolute inset-0 ring-4 ring-inset ring-orange-500/60 rounded-3xl pointer-events-none" />
                  )}

                  {/* Category label — top left */}
                  <div className="absolute top-4 left-4">
                    <span className="text-sm font-bold text-black/70 bg-white/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      {v.category}
                    </span>
                  </div>

                  {/* Dotted waveform — center */}
                  <div className="absolute inset-0 flex items-center justify-center px-4">
                    <div className="flex items-end gap-[3px] h-8 opacity-30">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-[3px] rounded-full bg-black transition-all duration-150 ${isPlaying ? "animate-pulse" : ""}`}
                          style={{ height: `${Math.round(20 + Math.sin(i * 0.9) * 14 + Math.cos(i * 0.4) * 8)}px` }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Bottom info + play button */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                    <div>
                      <div className="font-black text-black text-sm mb-1">{v.name}</div>
                      {errorId === v.id ? (
                        <div className="text-rose-600 text-xs font-bold">Sample coming soon</div>
                      ) : (
                        <div className="text-black/50 text-xs font-medium">{v.tags.join(" • ")}</div>
                      )}
                    </div>
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg flex-shrink-0 transition-colors ${isPlaying ? "bg-orange-500" : "bg-black/80 group-hover:bg-black"}`}>
                      {isPlaying
                        ? <Pause size={18} fill="white" className="text-white" />
                        : <Play size={18} fill="white" className="text-white ml-0.5" />
                      }
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* 3. How It Works Section */}
      <section className="px-4 sm:px-6 max-w-7xl mx-auto pb-32">
        <div className="text-center mb-20">
          <h2 className="text-3xl sm:text-[40px] font-black tracking-tight text-black mb-6">
            Effortless Creation.
          </h2>
          <p className="text-base text-black/60 font-medium max-w-2xl mx-auto">
            From script to final audio in three simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: MessageSquare, title: "1. Type or Paste", desc: "Drop your script into our editor. We support long-form content perfectly." },
            { icon: Headset, title: "2. Choose a Voice", desc: "Select from our premium library or clone your own voice instantly." },
            { icon: Zap, title: "3. Generate Audio", desc: "Hit generate and download studio-grade MP3 audio in seconds." }
          ].map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-[40px] p-10 text-center border-2 border-black/5 hover:border-orange-500 transition-colors shadow-sm"
            >
              <div className="w-20 h-20 mx-auto bg-orange-50 rounded-[24px] flex items-center justify-center mb-8 text-orange-500">
                <step.icon size={36} />
              </div>
              <h3 className="text-xl font-black text-black mb-3">{step.title}</h3>
              <p className="text-[15px] text-black/60 font-medium leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. Features Bento Grid */}
      <section className="px-4 sm:px-6 max-w-7xl mx-auto pb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-[40px] font-black tracking-tight text-black mb-6">
            Pro tools, playful vibe.
          </h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="md:col-span-2 bg-orange-500 rounded-[48px] p-10 sm:p-14 shadow-[0_20px_40px_-15px_rgba(249,115,22,0.4)] relative overflow-hidden group"
          >
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-orange-400 rounded-full blur-3xl opacity-50 transition-opacity group-hover:opacity-80" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-[24px] bg-white text-orange-500 flex items-center justify-center mb-8 shadow-sm">
                <Wand2 size={32} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white mb-3">Emotional AI Text-to-Speech</h3>
              <p className="text-orange-100 text-base font-medium max-w-lg leading-relaxed">
                Inject laughter, whispers, shouts, and sighs. Our AI understands context and delivers lines with genuine human emotion, never flat robot reading.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-black text-white rounded-[48px] p-10 sm:p-12 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-gray-800/50 to-transparent opacity-50" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-[24px] bg-white/10 text-white flex items-center justify-center mb-8">
                <Shapes size={32} />
              </div>
              <h3 className="text-2xl font-black mb-3">Studio Grade Output</h3>
              <p className="text-gray-400 text-[15px] font-medium leading-relaxed">
                Download pristine, broadcast-ready MP3s. Zero background noise.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 5. Voice Cloning Section */}
      <section className="px-4 sm:px-6 max-w-7xl mx-auto pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-[48px] border-2 border-black/5 p-8 sm:p-16 flex flex-col md:flex-row items-center gap-16 shadow-sm"
        >
          <div className="flex-1">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-black text-white mb-8">
              <Fingerprint size={32} />
            </div>
            <h2 className="text-3xl sm:text-[40px] font-black tracking-tight text-black mb-6">
              Instant Voice Cloning.
            </h2>
            <p className="text-base text-black/60 font-medium mb-8 leading-relaxed max-w-lg">
              Upload just a 30-second audio clip and create a digital twin of any voice in seconds. Secure, private, and breathtakingly accurate.
            </p>
            <Link href="/register" className="inline-flex items-center gap-2 px-7 py-3.5 bg-black rounded-full text-white text-[15px] font-bold hover:bg-gray-800 transition-colors">
              Try Cloning <ArrowRight size={20} />
            </Link>
          </div>
          <div className="flex-1 w-full">
            <div className="bg-[#fafafa] rounded-[40px] p-8 border-2 border-black/5 aspect-square flex flex-col items-center justify-center relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1)_0%,transparent_70%)]" />
              <div className="relative z-10 text-center">
                <div className="w-24 h-24 mx-auto bg-white rounded-full border-4 border-orange-500 flex items-center justify-center shadow-lg mb-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-orange-500/20 animate-ping" />
                  <Mic size={40} className="text-orange-500 relative z-10" />
                </div>
                <div className="bg-white px-6 py-3 rounded-full shadow-sm font-bold text-black border border-black/5">
                  Voice Profile Created
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 6. Global Dubbing */}
      <section className="px-4 sm:px-6 max-w-7xl mx-auto pb-32">
        <div className="bg-orange-500 rounded-[48px] p-8 sm:p-16 text-center text-white relative overflow-hidden shadow-[0_20px_60px_-15px_rgba(249,115,22,0.3)]">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="w-20 h-20 mx-auto bg-white text-orange-500 rounded-[24px] flex items-center justify-center mb-8 shadow-lg">
              <Globe size={40} />
            </div>
            <h2 className="text-3xl sm:text-[40px] font-black tracking-tight mb-6">
              Go Global Instantly.
            </h2>
            <p className="text-base sm:text-lg text-orange-50 font-medium mb-8 leading-relaxed">
              Translate and dub your content into 30+ languages with native-level fluency. Maintain the original emotional tone and voice identity across every language.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['English', 'Spanish', 'French', 'German', 'Japanese', 'Hindi', '+24 More'].map((lang, i) => (
                <div key={i} className="px-5 py-2.5 bg-white/20 backdrop-blur-sm rounded-full font-bold text-white border border-white/20">
                  {lang}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Use Cases */}
      <section className="px-4 sm:px-6 max-w-7xl mx-auto pb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-[40px] font-black tracking-tight text-black mb-6">
            Built for modern creators.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "Audiobooks", desc: "Keep listeners hooked for hours with expressive, non-fatiguing narrators." },
            { title: "Podcasts", desc: "Fix flubbed lines or generate entire ad reads instantly without a mic." },
            { title: "Gaming", desc: "Populate your virtual worlds with hundreds of unique character voices." },
            { title: "Marketing", desc: "Create high-converting video ads without booking expensive studio time." }
          ].map((uc, i) => (
            <div 
              key={i}
              className="bg-white rounded-[32px] p-8 border-2 border-black/5 hover:border-black transition-colors"
            >
              <div className="w-12 h-12 rounded-[16px] bg-black flex items-center justify-center mb-6 text-white font-black text-xl">
                {i + 1}
              </div>
              <h4 className="text-xl font-black text-black mb-2">{uc.title}</h4>
              <p className="text-[15px] text-black/60 font-medium">{uc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 8. CTA Section */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto pb-32">
        <div className="bg-black rounded-[48px] p-10 sm:p-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.2)_0%,transparent_60%)] pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-6">
              Your studio is ready.
            </h2>
            <p className="text-base sm:text-lg text-gray-400 font-medium max-w-xl mx-auto mb-10">
              Join creators producing professional audio at the speed of thought. 
            </p>
            
            <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 rounded-full text-white text-base font-bold shadow-lg shadow-orange-500/30 transition-all">
              Get Started Free <ArrowRight size={24} />
            </Link>
            <p className="mt-6 text-gray-500 font-medium text-sm">No credit card required to start.</p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
