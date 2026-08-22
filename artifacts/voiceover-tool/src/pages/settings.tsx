import { useState } from "react";
import { Settings, User, Shield, Save, Eye, EyeOff, Check, Gift, KeyRound, Copy, Trash2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DevApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

function DeveloperApiSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const isPaid = !!user && (user.isAdmin || user.plan !== "free");

  const { data } = useQuery<{ keys: DevApiKey[] }>({
    queryKey: ["dev-api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/keys", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load API keys");
      return res.json();
    },
    enabled: isPaid,
  });
  const keys = data?.keys ?? [];

  const createKey = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: keyName.trim() || "API Key" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create key");
      setNewKey(data.fullKey);
      setKeyName("");
      queryClient.invalidateQueries({ queryKey: ["dev-api-keys"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: number) => {
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to revoke key");
      }
      queryClient.invalidateQueries({ queryKey: ["dev-api-keys"] });
      toast({ title: "Key revoked", description: "This API key can no longer be used." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyNewKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-primary" />
        <h2 className="font-bold text-base">Developer API</h2>
      </div>
      <p className="text-muted-foreground text-sm -mt-1">
        Use OpenRadio Text to Speech from your own apps. Credits are charged from your account balance.
      </p>

      {!isPaid ? (
        <p className="text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          The Developer API is available on paid plans. Upgrade to create API keys.
        </p>
      ) : (
        <>
          {newKey && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-green-800">Your new API key — copy it now, it won't be shown again:</p>
              <div className="flex gap-2 items-center">
                <code className="flex-1 text-xs bg-white border border-green-200 rounded-lg px-3 py-2 break-all">{newKey}</code>
                <Button size="sm" variant="outline" onClick={copyNewKey} className="shrink-0">
                  {keyCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </Button>
              </div>
              <button className="text-xs text-green-700 underline" onClick={() => setNewKey(null)}>I've saved it — hide</button>
            </div>
          )}

          {keys.length > 0 && (
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 border border-[#e5e7eb] rounded-xl px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{k.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code>{k.keyPrefix}…</code>
                      {" · "}
                      {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => revokeKey(k.id)} className="text-red-500 hover:text-red-600 shrink-0">
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Key name (e.g. My App)"
              maxLength={60}
              className="flex-1"
            />
            <Button onClick={createKey} disabled={creating} size="sm" className="shrink-0 px-3 font-semibold">
              <Plus size={14} className="mr-1" /> {creating ? "Creating…" : "Create Key"}
            </Button>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-primary">How to use (quick example)</summary>
            <pre className="mt-2 bg-[#0f172a] text-[#e2e8f0] text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">{`curl -X POST https://openradio.io/api/v1/tts \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Hello from the API!", "voice_id": "VOICE_ID"}'

# List voices:  GET /api/v1/voices?provider=elevenlabs&search=deep
# Your account: GET /api/v1/me
# Task status:  GET /api/v1/tasks/{id}`}</pre>
          </details>
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [email, setEmail] = useState(user?.email ?? "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleRedeemPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoMsg(null);
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid promo code");
      setPromoCode("");
      setPromoMsg({ ok: true, text: `+${data.creditsAdded.toLocaleString()} credits added` });
      toast({ title: "Promo applied", description: `+${data.creditsAdded.toLocaleString()} credits added.` });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    } catch (e: any) {
      setPromoMsg({ ok: false, text: e.message });
    } finally {
      setPromoLoading(false);
    }
  };

  const handleEmailSave = async () => {
    if (!email.trim() || email === user?.email) return;
    setEmailSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update email");
      queryClient.setQueryData(["auth", "me"], data);
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
      toast({ title: "Email updated", description: "Your email has been changed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "New password and confirm password must match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  };

  const emailChanged = email.trim() !== "" && email !== user?.email;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Account Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Manage your profile and security</p>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User size={16} className="text-primary" />
          <h2 className="font-bold text-base">Profile</h2>
        </div>

        {/* Name (read-only) */}
        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">Name</Label>
          <Input value={user?.name ?? ""} readOnly className="bg-[#f9fafb] text-[#6b7280]" />
        </div>

        {/* Email (editable) */}
        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">Email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailSaved(false); }}
              placeholder="your@email.com"
              className="flex-1"
            />
            <Button
              onClick={handleEmailSave}
              disabled={!emailChanged || emailSaving}
              size="sm"
              className={cn(
                "shrink-0 px-3 font-semibold transition-all",
                emailSaved ? "bg-green-500 hover:bg-green-500 text-white" : ""
              )}
            >
              {emailSaved
                ? <><Check size={14} /> Saved</>
                : emailSaving
                  ? "Saving..."
                  : <><Save size={14} /> Save</>
              }
            </Button>
          </div>
        </div>

        {/* Member since */}
        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">Member since</Label>
          <Input
            value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}
            readOnly
            className="bg-[#f9fafb] text-[#6b7280]"
          />
        </div>
      </div>

      {/* Promo code */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Gift size={16} className="text-primary" />
          <h2 className="font-bold text-base">Have a promo code?</h2>
        </div>
        <p className="text-muted-foreground text-sm -mt-1">Redeem a code to add free credits to your account.</p>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value); setPromoMsg(null); }}
              onKeyDown={e => { if (e.key === "Enter") handleRedeemPromo(); }}
              placeholder="Enter promo code"
              className="flex-1 uppercase"
            />
            <Button
              onClick={handleRedeemPromo}
              disabled={!promoCode.trim() || promoLoading}
              size="sm"
              className="shrink-0 px-4 font-semibold"
            >
              {promoLoading ? "Applying..." : "Apply"}
            </Button>
          </div>
          {promoMsg && (
            <p className={cn("text-xs font-semibold", promoMsg.ok ? "text-green-600" : "text-red-500")}>
              {promoMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Developer API keys */}
      <DeveloperApiSection />

      {/* Password change */}
      <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-primary" />
          <h2 className="font-bold text-base">Change Password</h2>
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">Current Password</Label>
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-foreground transition-colors"
            >
              {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">New Password</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-foreground transition-colors"
            >
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">Confirm New Password</Label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className={cn("pr-10", confirmPassword && confirmPassword !== newPassword && "border-red-300 focus:ring-red-200")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-foreground transition-colors"
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
        </div>

        <Button
          onClick={handlePasswordSave}
          disabled={!currentPassword || !newPassword || !confirmPassword || pwSaving || newPassword !== confirmPassword}
          className="w-full font-bold"
        >
          {pwSaving ? "Updating..." : "Update Password"}
        </Button>
      </div>
    </div>
  );
}
