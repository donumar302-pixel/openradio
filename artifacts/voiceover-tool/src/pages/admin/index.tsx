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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
          toast({ title: "Status updated", description: `API key is now ${!currentStatus ? 'active' : 'inactive'}.` });
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage API keys and view system usage statistics.</p>
        </div>
        <Link href="/admin/keys/new">
          <Button data-testid="btn-add-key">
            <Plus className="mr-2 h-4 w-4" /> Add API Key
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingStats ? "-" : stats?.totalKeys || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Keys</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingStats ? "-" : stats?.activeKeys || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Generations</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingStats ? "-" : stats?.totalGenerations || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Characters Used</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingStats ? "-" : stats?.totalCharacters?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingKeys ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : keys?.length ? (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Key Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead className="text-right">Last Used</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} data-testid={`row-key-${key.id}`}>
                      <TableCell className="font-medium">{key.label}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{key.keyPreview}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={key.isActive} 
                            onCheckedChange={() => handleToggleActive(key.id, key.isActive)}
                            disabled={updateKey.isPending}
                            data-testid={`switch-key-${key.id}`}
                          />
                          <Badge variant={key.isActive ? "default" : "secondary"} className={key.isActive ? "bg-green-500/20 text-green-500 hover:bg-green-500/20 border-green-500/20" : ""}>
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{key.usageCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`btn-delete-key-${key.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the key "{key.label}"? This action cannot be undone and may break TTS functionality if no other active keys exist.
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
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-lg">
              <Key className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No API keys configured.</p>
              <Link href="/admin/keys/new">
                <Button variant="link" className="mt-2 text-primary">Add your first key</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
