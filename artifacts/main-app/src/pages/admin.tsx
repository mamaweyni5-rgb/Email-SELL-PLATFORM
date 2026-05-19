import { Link } from "wouter";
import { format } from "date-fns";
import { 
  useListRegistrations, 
  useGetRegistrationStats, 
  useDeleteRegistration,
  getListRegistrationsQueryKey,
  getGetRegistrationStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Users, Calendar, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const { data: registrations, isLoading: isLoadingList } = useListRegistrations();
  const { data: stats, isLoading: isLoadingStats } = useGetRegistrationStats();
  const deleteRegistration = useDeleteRegistration();

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to remove this registration?")) {
      deleteRegistration.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRegistrationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRegistrationStatsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-serif font-medium text-lg tracking-tight">Admin Console</span>
          </div>
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Portal
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif text-foreground mb-2">Overview</h1>
          <p className="text-muted-foreground">Monitor and manage user registrations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-md shadow-black/5 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-primary">{stats?.total || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md shadow-black/5 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-primary">{stats?.todayCount || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md shadow-black/5 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-primary">{stats?.weekCount || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingList ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !registrations || registrations.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No registrations found</p>
                <p className="text-sm text-muted-foreground/70">When users register, they will appear here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Date Registered</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium text-foreground">{reg.email}</TableCell>
                      <TableCell className="font-mono text-sm text-foreground">{reg.password}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(reg.createdAt), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(reg.id)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          disabled={deleteRegistration.isPending && deleteRegistration.variables?.id === reg.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
