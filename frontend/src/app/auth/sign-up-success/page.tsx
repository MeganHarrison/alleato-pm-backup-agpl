import Link from "next/link";
import { CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <Card className="border-success/20 bg-success/10">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl text-success">
                Account Created Successfully!
              </CardTitle>
              <CardDescription className="text-success">
                Welcome to Alleato PM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-success leading-relaxed">
                  Your account has been created and is ready to use. You can now
                  sign in to start managing your construction projects.
                </p>
              </div>

              <div className="pt-4">
                <Button asChild className="w-full bg-success hover:bg-success/90">
                  <Link href="/auth/login">
                    Continue to Login
                  </Link>
                </Button>
              </div>

              <div className="text-center pt-2">
                <Link
                  href="/"
                  className="text-xs text-link hover:text-link-hover hover:underline"
                >
                  Return to Home
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
