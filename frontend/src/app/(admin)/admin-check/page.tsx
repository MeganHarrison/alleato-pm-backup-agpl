"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Shield } from "lucide-react";
import { Text } from "@/components/ds/text";
import { apiFetch, ApiError } from "@/lib/api-client";

interface AdminCheckResponse {
  authenticated: boolean;
  userId?: string;
  email?: string;
  fullName?: string | null;
  isAdmin?: boolean;
  hasPersonLink?: boolean;
  personId?: string | null;
  adminAccess?: {
    enabled: boolean;
    description: string;
  };
  error?: string;
  details?: string;
  hint?: string;
}

export default function AdminCheckPage() {
  const [data, setData] = useState<AdminCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await apiFetch<AdminCheckResponse>("/api/auth/admin-check");
      setData(json);
    } catch (err) {
      if (err instanceof ApiError) {
        // Preserve the parsed body so the UI can show details/hint fields
        const body = err.body as AdminCheckResponse;
        setData(body);
      }
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStatus();
  }, []);

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <Text>Checking admin status...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Access Check</h1>
          <p className="text-muted-foreground mt-1">
            Verify your super admin privileges and access status
          </p>
        </div>
        <Button onClick={fetchAdminStatus} variant="outline" size="sm">
          <RefreshCw />
          Refresh
        </Button>
      </div>

      <div className="space-y-6">
        {/* Authentication Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {data?.authenticated ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              Authentication Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Text tone="muted">Logged In</Text>
              <Badge variant={data?.authenticated ? "default" : "destructive"}>
                {data?.authenticated ? "Yes" : "No"}
              </Badge>
            </div>
            {data?.email && (
              <div className="flex items-center justify-between">
                <Text tone="muted">Email</Text>
                <Text>{data.email}</Text>
              </div>
            )}
            {data?.userId && (
              <div className="flex items-center justify-between">
                <Text tone="muted">User ID</Text>
                <Text className="font-mono text-xs">{data.userId}</Text>
              </div>
            )}
            {data?.fullName && (
              <div className="flex items-center justify-between">
                <Text tone="muted">Full Name</Text>
                <Text>{data.fullName}</Text>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Status */}
        {data?.authenticated && (
          <Card className={data.isAdmin ? "border-green-600" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className={`h-5 w-5 ${data.isAdmin ? "text-success" : "text-muted-foreground"}`} />
                Super Admin Status
              </CardTitle>
              <CardDescription>
                {data.adminAccess?.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Text tone="muted">Admin Access</Text>
                <Badge variant={data.isAdmin ? "default" : "secondary"}>
                  {data.isAdmin ? "✅ Enabled" : "❌ Disabled"}
                </Badge>
              </div>
              {data.isAdmin && (
                <div className="rounded-lg bg-success/10 p-4 dark:bg-success/20">
                  <Text size="sm" className="font-medium text-success">
                    🎉 You have super admin access!
                  </Text>
                  <Text size="sm" tone="muted" className="mt-2">
                    You can access all projects without individual project memberships.
                    All permission checks are bypassed for your account.
                  </Text>
                </div>
              )}
              {!data.isAdmin && (
                <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
                  <Text size="sm" className="font-medium text-amber-900 dark:text-amber-100">
                    ℹ️ Limited Access
                  </Text>
                  <Text size="sm" tone="muted" className="mt-2">
                    You need to be granted admin access. Contact a system administrator
                    or run: <code className="text-xs">npm run set-admin {data.email}</code>
                  </Text>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Person Link Status */}
        {data?.authenticated && (
          <Card>
            <CardHeader>
              <CardTitle>Directory Integration</CardTitle>
              <CardDescription>
                Linking your auth account to the people directory
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Text tone="muted">Person Link</Text>
                <Badge variant={data.hasPersonLink ? "default" : "secondary"}>
                  {data.hasPersonLink ? "Linked" : "Not Linked"}
                </Badge>
              </div>
              {data.personId && (
                <div className="flex items-center justify-between">
                  <Text tone="muted">Person ID</Text>
                  <Text className="font-mono text-xs">{data.personId}</Text>
                </div>
              )}
              {!data.hasPersonLink && (
                <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
                  <Text size="sm" className="font-medium text-amber-900 dark:text-amber-100">
                    ⚠️ No person record found
                  </Text>
                  <Text size="sm" tone="muted" className="mt-2">
                    You may need to complete your profile setup or have an admin
                    create a person record for you.
                  </Text>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Text className="text-destructive">{error}</Text>
              {data?.details && (
                <Text size="sm" tone="muted" className="mt-2">
                  Details: {data.details}
                </Text>
              )}
              {data?.hint && (
                <Text size="sm" tone="muted" className="mt-2">
                  💡 {data.hint}
                </Text>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
