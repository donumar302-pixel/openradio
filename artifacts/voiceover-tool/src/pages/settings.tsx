import { Settings, User, Bell, Shield, Key } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-12">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-primary" />
          <h2 className="font-bold text-base">Profile</h2>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="font-semibold">Name</Label>
            <Input value={user?.name ?? ""} readOnly className="bg-secondary/30" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold">Email</Label>
            <Input value={user?.email ?? ""} readOnly className="bg-secondary/30" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-semibold">Member since</Label>
            <Input
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
              readOnly
              className="bg-secondary/30"
            />
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-primary" />
            <h2 className="font-bold text-base">ElevenLabs API Keys</h2>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm">Manage Keys</Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Add and manage ElevenLabs API keys from the Admin Panel. Multiple keys are supported with automatic load balancing.
        </p>
      </div>

      {/* Security */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-primary" />
          <h2 className="font-bold text-base">Security</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Sessions are securely managed and expire automatically. Sign out from all devices if you believe your account has been compromised.
        </p>
      </div>
    </div>
  );
}
