import { useState } from "react";
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
import { ArrowLeft, Loader2, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const keyFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(50, "Label is too long"),
  key: z.string().min(10, "Valid API key is required").startsWith("sk-", "ElevenLabs keys usually start with sk-"),
});

type KeyFormValues = z.infer<typeof keyFormSchema>;

export default function AdminKeysNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<KeyFormValues>({
    resolver: zodResolver(keyFormSchema),
    defaultValues: {
      label: "",
      key: "",
    },
  });
  
  const createKey = useCreateApiKey();
  
  const onSubmit = (data: KeyFormValues) => {
    createKey.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "API Key added", description: "The new API key has been securely stored." });
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          setLocation("/admin");
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
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/admin">
          <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary transition-colors mb-4" data-testid="link-back-admin">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Add API Key</h1>
        <p className="text-muted-foreground">Register a new ElevenLabs API key to power the voice generation.</p>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" /> Key Details
          </CardTitle>
          <CardDescription>
            The key will be encrypted and stored securely. Only a masked version will be visible.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Production Key 1, Shared Team Key" {...field} data-testid="input-key-label" />
                    </FormControl>
                    <FormDescription>A memorable name to identify this key.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="sk-..." {...field} data-testid="input-key-value" />
                    </FormControl>
                    <FormDescription>Your ElevenLabs secret API key.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="bg-secondary/20 border-t border-border/50 py-4 flex justify-end gap-3">
              <Link href="/admin">
                <Button variant="outline" type="button" data-testid="btn-cancel">Cancel</Button>
              </Link>
              <Button type="submit" disabled={createKey.isPending} data-testid="btn-submit-key">
                {createKey.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save API Key"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
