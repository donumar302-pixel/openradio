import { Link } from "wouter";
import {
  useGetAdminStats,
  getGetAdminStatsQueryKey,
  useListApiKeys,
  getListApiKeysQueryKey,
  useUpdateApiKey,
  useDeleteApiKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Key, Activity, Database, Hash, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: loadingStats } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() }
  });

  const { data: keys, isLoading: loadingKeys } = useListApiKeys({
    query: { queryKey: getListApiKeysQueryKey() }
  });

  const updateKey = useUpdateApiKey();
  const deleteKey = useDeleteApiKey();

  const handleToggleActive = (id: number, currentStatus: boolean) => {
    updateKey.mutate(
      { id, data: { isActive: !currentStatus } },
      {
        onSuccess: () => {
          toast({ title: "Status updated", description: `Key is now ${!currentStatus ? "active" : "inactive"}.` });
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to update key status.", variant: "destructive" })
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteKey.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Key deleted", description: "API key has been removed." });
          queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Failed to delete key.", variant: "destructive" })
      }
    );
  };

  const statCards = [
    { label: "Total Keys", value: stats?.totalKeys ?? 0, icon: Key, color: "text-orange-500" },
    { label: "Active Keys", value: stats?.activeKeys ?? 0, icon: Activity, color: "text-green-500" },
    { label: "Total Generations", value: stats?.totalGenerations ?? 0, icon: Database, color: "text-blue-500" },
    { label: "Characters Used", value: stats?.totalCharacters?.toLocaleString() ?? 0, icon: Hash, color: "text-purple-500" },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground">Manage your ElevenLabs API keys and monitor usage.</p>
        </div>
        <Link href="/admin/keys/new">
          <Button className="bg-primary hover:bg-primary/90 shadow-md shadow-primary/25 font-semibold" data-testid="btn-add-key">
            <Plus className="mr-2 h-4 w-4" /> Add API Key
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Card key={card.label} className="border-border shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="text-3xl font-extrabold text-foreground">
                {loadingStats ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Keys Table */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border px-6">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingKeys ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : keys?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                    <TableHead className="pl-6 font-semibold">Label</TableHead>
                    <TableHead className="font-semibold">Key Preview</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Usage</TableHead>
                    <TableHead className="text-right font-semibold">Last Used</TableHead>
                    <TableHead className="w-[80px] text-right pr-6 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} className="hover:bg-secondary/20" data-testid={`row-key-${key.id}`}>
                      <TableCell className="pl-6 font-semibold">{key.label}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{key.keyPreview}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={key.isActive}
                            onCheckedChange={() => handleToggleActive(key.id, key.isActive)}
                            disabled={updateKey.isPending}
                            data-testid={`switch-key-${key.id}`}
                          />
                          <Badge
                            className={
                              key.isActive
                                ? "bg-green-50 text-green-600 border-green-200 hover:bg-green-50"
                                : "bg-secondary text-muted-foreground border-border hover:bg-secondary"
                            }
                            variant="outline"
                          >
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{key.usageCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                              data-testid={`btn-delete-key-${key.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{key.label}"? This cannot be undone and may interrupt TTS if no other active keys exist.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(key.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Key className="h-7 w-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">No API keys yet</p>
              <p className="text-sm mb-4">Add your first ElevenLabs API key to start generating audio.</p>
              <Link href="/admin/keys/new">
                <Button className="bg-primary hover:bg-primary/90 font-semibold">
                  <Plus className="mr-2 h-4 w-4" /> Add First Key
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
