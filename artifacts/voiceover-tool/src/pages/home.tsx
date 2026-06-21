import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Mic2,
  Sparkles,
  ArrowRight,
  AudioWaveform,
  MessageSquareText,
  Radio,
  Languages,
} from "lucide-react";

const tools = [
  {
    href: "/studio",
    icon: <Mic2 className="h-7 w-7" />,
    color: "bg-orange-500",
    lightColor: "bg-orange-50",
    textColor: "text-orange-500",
    borderColor: "hover:border-orange-300",
    badge: "AI",
    name: "Text to Speech",
    desc: "Apna text type karo aur AI se lifelike awaaz generate karo. 29 zabano mein support, multiple voice styles available.",
    cta: "Open Studio",
  },
  {
    href: "/speech-to-speech",
    icon: <AudioWaveform className="h-7 w-7" />,
    color: "bg-violet-500",
    lightColor: "bg-violet-50",
    textColor: "text-violet-500",
    borderColor: "hover:border-violet-300",
    badge: null,
    name: "Speech to Speech",
    desc: "Apni awaaz record karo ya audio upload karo, AI kisi bhi voice mein convert kar dega — ek click mein.",
    cta: "Try Now",
  },
  {
    href: "/speech-to-text",
    icon: <MessageSquareText className="h-7 w-7" />,
    color: "bg-blue-500",
    lightColor: "bg-blue-50",
    textColor: "text-blue-500",
    borderColor: "hover:border-blue-300",
    badge: null,
    name: "Speech to Text",
    desc: "Koi bhi audio ya video file upload karo — AI automatically text mein transcribe kar dega, har language mein.",
    cta: "Transcribe",
  },
  {
    href: "/audio-isolation",
    icon: <Radio className="h-7 w-7" />,
    color: "bg-emerald-500",
    lightColor: "bg-emerald-50",
    textColor: "text-emerald-500",
    borderColor: "hover:border-emerald-300",
    badge: null,
    name: "Audio Isolation",
    desc: "Background noise, music ya shor hat jata hai — sirf crystal clear awaaz bachti hai. Podcasts aur voiceovers ke liye perfect.",
    cta: "Clean Audio",
  },
  {
    href: "/dubbing",
    icon: <Languages className="h-7 w-7" />,
    color: "bg-rose-500",
    lightColor: "bg-rose-50",
    textColor: "text-rose-500",
    borderColor: "hover:border-rose-300",
    badge: "New",
    name: "Dubbing",
    desc: "Koi bhi video ya audio 29+ zabano mein dub karo. Original timing aur emotion bilkul same rehti hai automatically.",
    cta: "Start Dubbing",
  },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Welcome */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
          <Sparkles size={12} />
          Welcome to Bunny TTS
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-2 text-foreground">
          Hello, <span className="text-primary">{user?.name || "there"}</span>
        </h1>
        <p className="text-[#6b7280] text-lg">What would you like to create today?</p>
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <div className={`group bg-white border border-[#f3f4f6] rounded-2xl p-6 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${tool.borderColor}`}>
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl ${tool.lightColor} ${tool.textColor} flex items-center justify-center mb-5 transition-all group-hover:scale-105`}>
                {tool.icon}
              </div>

              {/* Badge + Name */}
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-[17px] text-foreground">{tool.name}</h3>
                {tool.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tool.lightColor} ${tool.textColor}`}>
                    {tool.badge}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-[#6b7280] leading-relaxed mb-5">{tool.desc}</p>

              {/* CTA */}
              <div className={`flex items-center gap-1.5 text-sm font-semibold ${tool.textColor}`}>
                {tool.cta}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA banner */}
      <div className="bg-gradient-to-r from-primary to-orange-400 rounded-2xl p-7 text-white flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="flex-1">
          <h2 className="text-2xl font-black mb-1">Ready to generate?</h2>
          <p className="text-white/80 text-sm">Text to Speech studio kholo aur apna pehla voiceover banao.</p>
        </div>
        <Link href="/studio">
          <Button className="bg-white text-primary hover:bg-white/90 font-bold shadow-md shrink-0 px-6">
            <Mic2 className="mr-2 h-4 w-4" /> Open Studio
          </Button>
        </Link>
      </div>
    </div>
  );
}
