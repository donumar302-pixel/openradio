import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Mic2, Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Welcome */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Sparkles size={12} />
          Welcome to Bunny TTS
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-foreground">
          Hello, <span className="text-primary">{user?.name || "there"}</span>
        </h1>
        <p className="text-muted-foreground text-lg">What would you like to create today?</p>
      </div>

      {/* Quick start card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link href="/studio">
          <div className="group bg-white border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-md hover:shadow-orange-50 transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:shadow-md group-hover:shadow-primary/30 transition-all">
              <Mic2 className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-bold text-lg text-foreground mb-1">Text to Speech</h3>
            <p className="text-sm text-muted-foreground mb-4">Convert your script into lifelike AI voices using ElevenLabs.</p>
            <div className="flex items-center gap-1 text-primary text-sm font-semibold">
              Start generating <ArrowRight size={14} />
            </div>
          </div>
        </Link>

        <div className="bg-secondary/50 border border-dashed border-border rounded-2xl p-6 opacity-60">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-bold text-lg text-foreground mb-1">More coming soon</h3>
          <p className="text-sm text-muted-foreground">Voice cloning, music generation, and more features on the way.</p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-primary to-orange-400 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-extrabold mb-2">Ready to generate?</h2>
        <p className="text-white/80 text-sm mb-4">Click below to open the Text to Speech studio and create your first voiceover.</p>
        <Link href="/studio">
          <Button className="bg-white text-primary hover:bg-white/90 font-bold shadow-md">
            <Mic2 className="mr-2 h-4 w-4" /> Open Studio
          </Button>
        </Link>
      </div>
    </div>
  );
}
