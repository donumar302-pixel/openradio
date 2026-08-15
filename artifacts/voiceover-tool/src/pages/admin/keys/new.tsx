import { Link, useLocation } from "wouter";
import { useCreateApiKey, getListApiKeysQueryKey, getGetAdminStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Key, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PROVIDERS = [
  { value: "elevenlabs", label: "ElevenLabs",  hint: "Get from elevenlabs.io → Profile → API Keys", placeholder: "sk-..." },
  { value: "minimax",    label: "Fire TTS",     hint: "Format: groupId:apiKey — from platform.minimaxi.chat", placeholder: "groupId:apiKey" },
  { value: "fishaudio",  label: "Fish Audio",   hint: "Get from fish.audio → Settings → API Keys", placeholder: "Paste API key..." },
];

const keyFormSchema = z.object({
  label:    z.string().min(1, "Label is required").max(50, "Label is too long"),
  key:      z.string().min(8, "Valid API key is required"),
  provider: z.string().min(1, "Select a provider"),
});

type KeyFormValues = z.infer<typeof keyFormSchema>;

export default function AdminKeysNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<KeyFormValues>({
    resolver: zodResolver(keyFormSchema),
    defaultValues: { label: "", key: "", provider: "elevenlabs" },
  });

  const selectedProvider = form.watch("provider");
  const providerInfo = PROVIDERS.find((p) => p.value === selectedProvider) ?? PROVIDERS[0]!;

  const createKey = useCreateApiKey();

  const onSubmit = (data: KeyFormValues) => {
    createKey.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "API Key added!", description: "The key has been securely saved." });
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          setLocation("/adminarea");
        },
        onError: (error: any) => {
          toast({
            title: "Failed to add key",
            description: error?.error || "An unknown error occurred.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-xl">
      <div className="mb-8">
        <Link href="/adminarea">
          <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary mb-4 font-semibold" data-testid="link-back-admin">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-foreground">Add API Key</h1>
        <p className="text-muted-foreground">Add an API key to power voice generation.</p>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200/60 mb-6">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Keys are stored securely. Only a masked preview is ever displayed — the full key is never shown again.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Key className="h-4 w-4 text-primary" /> Key Details
          </CardTitle>
          <CardDescription>{providerInfo.hint}</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-5 pt-6">

              {/* Provider selector */}
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Provider</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-border focus:ring-primary/40" data-testid="select-provider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Label */}
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Label</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Account 1, My Personal Key"
                        className="border-border focus-visible:ring-primary/40"
                        {...field}
                        data-testid="input-key-label"
                      />
                    </FormControl>
                    <FormDescription>A name to identify this key in the dashboard.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Key */}
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={providerInfo.placeholder}
                        className="border-border focus-visible:ring-primary/40 font-mono"
                        {...field}
                        data-testid="input-key-value"
                      />
                    </FormControl>
                    <FormDescription>{providerInfo.hint}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </CardContent>
            <CardFooter className="bg-secondary/20 border-t border-border py-4 flex justify-end gap-3">
              <Link href="/adminarea">
                <Button variant="outline" type="button" data-testid="btn-cancel">Cancel</Button>
              </Link>
              <Button
                type="submit"
                disabled={createKey.isPending}
                className="bg-primary hover:bg-primary/90 font-semibold shadow-md shadow-primary/20"
                data-testid="btn-submit-key"
              >
                {createKey.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  "Save API Key"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
