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
  role: string;
  src: string;
};

const VOICES: Voice[] = [
  { id: "v1", name: "Arthur", role: "Documentary Narrator", src: asset("voices/narrator.mp3") },
  { id: "v2", name: "Elena", role: "Guided Meditation", src: asset("voices/serena.mp3") },
  { id: "v3", name: "Marcus", role: "Audiobook Protagonist", src: asset("voices/soren.mp3") },
  { id: "v4", name: "Leo", role: "Commercial Voiceover", src: asset("voices/kai.mp3") },
];

const fadeIn = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } }
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

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
          
          <motion.h1 variants={fadeIn} className="text-5xl sm:text-7xl lg:text-[88px] font-black tracking-[-0.04em] leading-[0.95] text-black mb-8">
            Audio that sounds <br/>
            <span className="text-orange-500">Unbelievably Real.</span>
          </motion.h1>
          
          <motion.p variants={fadeIn} className="text-lg sm:text-2xl text-black/60 font-medium max-w-2xl mx-auto leading-relaxed mb-10">
            Generate lifelike speech, clone voices in seconds, and dub videos globally. A playful, premium studio built for modern creators.
          </motion.p>
          
          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <Link href="/register" className="w-full sm:w-auto relative group">
              <div className="absolute inset-0 bg-orange-600 rounded-[32px] translate-y-1.5 group-hover:translate-y-2 transition-transform duration-200" />
              <div className="relative flex items-center justify-center gap-2 px-8 py-4.5 bg-orange-500 rounded-[32px] text-white text-lg font-black border-2 border-orange-600 group-hover:-translate-y-1 transition-transform duration-200">
                Start Creating Free
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto relative group">
              <div className="absolute inset-0 bg-black/10 rounded-[32px] translate-y-1.5 group-hover:translate-y-2 transition-transform duration-200" />
              <div className="relative flex items-center justify-center gap-2 px-8 py-4.5 bg-white rounded-[32px] text-black text-lg font-black border-2 border-black/10 group-hover:-translate-y-1 transition-transform duration-200">
                View Credit Plans
              </div>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. Interactive Demo Section */}
      <section className="relative px-4 sm:px-6 max-w-6xl mx-auto pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="bg-white rounded-[48px] p-6 sm:p-12 shadow-[0_30px_60px_-15px_rgba(249,115,22,0.15)] border-2 border-black/5 relative z-10"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-100 text-orange-500 mb-6">
                <AudioLines size={28} />
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-black mb-4">
                Hear the difference.
              </h2>
              <p className="text-xl text-black/60 font-medium mb-8">
                No robotic undertones. No weird pacing. Just breathtakingly natural voices ready to read your script.
              </p>
              
              <div className="space-y-4">
                {VOICES.map((v) => {
                  const isPlaying = playingId === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => toggleVoice(v)}
                      aria-pressed={isPlaying}
                      aria-label={(isPlaying ? "Pause " : "Play ") + v.name + " sample"}
                      className={`w-full group flex items-center justify-between p-4 rounded-3xl border-2 transition-all duration-300 ${
                        isPlaying 
                          ? "border-orange-500 bg-orange-50/50 shadow-[0_8px_0_0_rgba(249,115,22,1)] -translate-y-1" 
                          : "border-black/5 bg-white hover:border-orange-200 hover:shadow-[0_8px_0_0_rgba(249,115,22,0.2)] hover:-translate-y-1"
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center text-white shadow-inner transition-colors ${isPlaying ? "bg-orange-500" : "bg-black group-hover:bg-gray-800"}`}>
                          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                        </div>
                        <div className="text-left">
                          <div className="font-black text-black text-xl mb-0.5">{v.name}</div>
                          {errorId === v.id ? (
                            <div className="font-bold text-rose-500 text-sm tracking-wide uppercase">Sample coming soon</div>
                          ) : (
                            <div className="font-bold text-black/40 text-sm tracking-wide uppercase">{v.role}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="pr-2 opacity-100 transition-opacity">
                        <AnimatedWaveform isPlaying={isPlaying} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-[#fafafa] rounded-[40px] p-8 sm:p-10 border-2 border-black/5 h-full flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/5 rounded-full blur-3xl" />
              
              <div className="relative z-10 space-y-6">
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-black/5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex h-3 w-3 rounded-full bg-orange-500" />
                    <span className="font-bold text-sm text-black/40 uppercase tracking-widest">Input Script</span>
                  </div>
                  <p className="text-lg font-medium text-black leading-relaxed">
                    "The secret to a great performance isn't just in the words you say... it's the breath between them."
                  </p>
                </div>
                
                <div className="flex justify-center">
                  <ArrowRight className="text-orange-500 rotate-90" size={24} />
                </div>

                <div className="bg-orange-500 rounded-[24px] p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="text-white" size={18} />
                    <span className="font-bold text-sm text-white/80 uppercase tracking-widest">Processing</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-white/20 rounded-full w-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white rounded-full"
                        animate={{ width: ["0%", "100%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                    <p className="text-white/90 font-medium text-sm text-center">Rendering emotional cadence...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. How It Works Section */}
      <section className="px-4 sm:px-6 max-w-7xl mx-auto pb-32">
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-black mb-6">
            Effortless Creation.
          </h2>
          <p className="text-xl text-black/60 font-medium max-w-2xl mx-auto">
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
              <h3 className="text-2xl font-black text-black mb-4">{step.title}</h3>
              <p className="text-lg text-black/60 font-medium leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 4. Features Bento Grid */}
      <section className="px-4 sm:px-6 max-w-7xl mx-auto pb-32">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-black mb-6">
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
              <h3 className="text-4xl font-black text-white mb-4">Emotional AI Text-to-Speech</h3>
              <p className="text-orange-100 text-xl font-medium max-w-lg leading-relaxed">
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
              <h3 className="text-3xl font-black mb-4">Studio Grade Output</h3>
              <p className="text-gray-400 text-lg font-medium leading-relaxed">
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
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-black mb-6">
              Instant Voice Cloning.
            </h2>
            <p className="text-xl text-black/60 font-medium mb-10 leading-relaxed max-w-lg">
              Upload just a 30-second audio clip and create a digital twin of any voice in seconds. Secure, private, and breathtakingly accurate.
            </p>
            <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-black rounded-[32px] text-white text-lg font-black hover:-translate-y-1 transition-transform">
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
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-6">
              Go Global Instantly.
            </h2>
            <p className="text-2xl text-orange-50 font-medium mb-10 leading-relaxed">
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
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-black mb-6">
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
              <h4 className="text-2xl font-black text-black mb-3">{uc.title}</h4>
              <p className="text-lg text-black/60 font-medium">{uc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 8. CTA Section */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto pb-32">
        <div className="bg-black rounded-[48px] p-10 sm:p-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.2)_0%,transparent_60%)] pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-5xl sm:text-7xl font-black tracking-tight text-white mb-8">
              Your studio is ready.
            </h2>
            <p className="text-2xl text-gray-400 font-medium max-w-2xl mx-auto mb-12">
              Join creators producing professional audio at the speed of thought. 
            </p>
            
            <Link href="/register" className="inline-flex items-center gap-2 px-10 py-5 bg-orange-500 rounded-[32px] text-white text-xl font-black hover:-translate-y-1 transition-transform border-4 border-orange-600 shadow-[0_10px_30px_-10px_rgba(249,115,22,0.5)]">
              Get Started Free <ArrowRight size={24} />
            </Link>
            <p className="mt-8 text-gray-500 font-medium text-lg">No credit card required to start.</p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
