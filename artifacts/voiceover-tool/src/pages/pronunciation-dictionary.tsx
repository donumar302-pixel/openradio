import { BookOpenText, Loader2, Plus, Trash2, X, Wand2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { osJson } from "@/lib/os-api";

interface Rule { from: string; to: string; matchType: "word" | "contains"; caseSensitive: boolean }
interface Dict { id: string; name: string; rules: Rule[]; rulesCount: number; createdAt: string }

const EMPTY_RULE: Rule = { from: "", to: "", matchType: "word", caseSensitive: false };

export default function PronunciationDictionaryPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [rules, setRules] = useState<Rule[]>([{ ...EMPTY_RULE }]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [previewOut, setPreviewOut] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["os-dictionaries"],
    queryFn: () => osJson<{ dictionaries: Dict[] }>("/dictionaries"),
  });

  const reset = () => { setName(""); setRules([{ ...EMPTY_RULE }]); setEditingId(null); setPreviewOut(null); };

  const save = useMutation({
    mutationFn: async () => {
      const clean = rules.filter((r) => r.from.trim());
      if (!name.trim() || clean.length === 0) throw new Error("Add a name and at least one rule.");
      if (editingId) {
        return osJson(`/dictionaries/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, rules: clean }),
        });
      }
      return osJson("/dictionaries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rules: clean }),
      });
    },
    onSuccess: () => {
      toast({ title: editingId ? "Updated!" : "Created!", description: "Use it from the Studio when generating speech." });
      reset();
      qc.invalidateQueries({ queryKey: ["os-dictionaries"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/os/dictionaries/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-dictionaries"] }),
  });

  const preview = useMutation({
    mutationFn: async () => {
      const clean = rules.filter((r) => r.from.trim());
      if (!previewText.trim() || clean.length === 0) throw new Error("Enter sample text and at least one rule.");
      return osJson<{ output: string }>("/dictionaries/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: previewText, rules: clean }),
      });
    },
    onSuccess: (d) => setPreviewOut(d.output),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (d: Dict) => {
    setEditingId(d.id);
    setName(d.name);
    setRules(d.rules.length > 0 ? d.rules.map((r) => ({ ...EMPTY_RULE, ...r })) : [{ ...EMPTY_RULE }]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setRule = (i: number, patch: Partial<Rule>) =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpenText size={18} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Pronunciation Dictionary</h1>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">New</span>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-12">Fix how names and brand words are pronounced in generated speech</p>
      </div>

      <div className="space-y-5 bg-white rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-bold text-sm">{editingId ? "Edit dictionary" : "New dictionary"}</p>
          {editingId && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>Cancel edit</Button>
          )}
        </div>
        <div className="space-y-2">
          <Label className="font-semibold">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 100))} placeholder="Brand names" className="text-sm" />
        </div>

        <div className="space-y-3">
          <Label className="font-semibold">Rules</Label>
          {rules.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={r.from} onChange={(e) => setRule(i, { from: e.target.value })} placeholder="AI" className="text-sm flex-1" />
              <span className="text-muted-foreground text-xs shrink-0">→</span>
              <Input value={r.to} onChange={(e) => setRule(i, { to: e.target.value })} placeholder="Ay Eye" className="text-sm flex-1" />
              <Select value={r.matchType} onValueChange={(v) => setRule(i, { matchType: v as Rule["matchType"] })}>
                <SelectTrigger className="w-[104px] text-xs shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="word">Word</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                </SelectContent>
              </Select>
              {rules.length > 1 && (
                <button onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))} className="text-muted-foreground/50 hover:text-red-500 shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setRules((rs) => [...rs, { ...EMPTY_RULE }])}>
            <Plus size={13} />Add rule
          </Button>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Label className="font-semibold">Try it out</Label>
          <div className="flex gap-2">
            <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="AI is amazing" className="text-sm flex-1" />
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => preview.mutate()} disabled={preview.isPending}>
              {preview.isPending ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}Preview
            </Button>
          </div>
          {previewOut !== null && (
            <p className="text-sm bg-secondary/40 rounded-lg px-3 py-2">Will be spoken as: <span className="font-semibold">{previewOut}</span></p>
          )}
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full bg-primary hover:bg-primary/90 font-bold">
          {save.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : editingId ? "Update Dictionary" : "Create Dictionary"}
        </Button>
      </div>

      <div className="space-y-3">
        <p className="font-bold text-sm text-foreground">Your dictionaries</p>
        {isLoading ? (
          <div className="py-6 text-center"><Loader2 className="animate-spin inline text-muted-foreground" size={18} /></div>
        ) : (data?.dictionaries ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center bg-secondary/30 rounded-xl">No dictionaries yet.</p>
        ) : (
          <div className="space-y-2">
            {data!.dictionaries.map((d) => (
              <div key={d.id} className="bg-white rounded-xl border border-border px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(d)}>
                  <p className="text-[13px] font-semibold truncate">{d.name}</p>
                  <p className="text-[11px] text-muted-foreground">{d.rulesCount} rule{d.rulesCount === 1 ? "" : "s"}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEdit(d)}>Edit</Button>
                <button onClick={() => del.mutate(d.id)} className="text-muted-foreground/50 hover:text-red-500 shrink-0" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
