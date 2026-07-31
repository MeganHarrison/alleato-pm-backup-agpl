import Link from "next/link";
import { ShieldX } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REASON_MESSAGES: Record<string, string> = {
  "no-project-access":
    "You don't have an active membership for this project. Contact your project administrator to request access.",
  "no-profile":
    "Your account is not linked to a person profile. Contact your organization administrator.",
  "invalid-project": "The project you tried to access does not exist.",
  "insufficient-permissions":
    "You don't have permission to access this section. Contact your project administrator if you believe this is an error.",
  "developer-only":
    "This feature is currently in development and is only available to the Alleato development team.",
  "owner-only":
    "This section is restricted to the workspace owner.",
};

const DEFAULT_MESSAGE =
  "You don't have permission to access this resource.";

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const message =
    (params.reason && REASON_MESSAGES[params.reason]) || DEFAULT_MESSAGE;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldX className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              {message}
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild variant="outline">
                <Link href="/">Back to Projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
