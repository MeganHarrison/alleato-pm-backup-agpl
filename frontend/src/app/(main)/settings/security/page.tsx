"use client";

import * as React from "react";
import { Shield, Smartphone, Clock, Key } from "lucide-react";
import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function SettingsRow({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed max-w-sm">
            {description}
          </p>
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

// Mock recent sessions
const RECENT_SESSIONS = [
  {
    id: "1",
    device: "Chrome on macOS",
    location: "Nashville, TN",
    lastSeen: "Active now",
    current: true,
  },
  {
    id: "2",
    device: "Safari on iPhone",
    location: "Nashville, TN",
    lastSeen: "2 hours ago",
    current: false,
  },
  {
    id: "3",
    device: "Chrome on Windows",
    location: "Atlanta, GA",
    lastSeen: "3 days ago",
    current: false,
  },
];

export default function SecuritySettingsPage() {
  const [twoFactor, setTwoFactor] = React.useState(false);
  const [ssoEnabled, setSsoEnabled] = React.useState(false);

  return (
    <PageShell variant="dashboard" title="Security">
    <div className="px-8 py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Authentication */}
        <section>
          <SectionRuleHeading label="Authentication" />
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            <div className="px-5">
              <SettingsRow
                icon={Smartphone}
                title="Two-factor authentication"
                description="Require a second verification step when members sign in. Applies to all workspace members."
                control={
                  <div className="flex items-center gap-2">
                    <Switch
                      id="2fa"
                      checked={twoFactor}
                      onCheckedChange={setTwoFactor}
                    />
                    <Label htmlFor="2fa" className="text-xs text-muted-foreground">
                      {twoFactor ? "Required" : "Optional"}
                    </Label>
                  </div>
                }
              />
            </div>
            <div className="px-5">
              <SettingsRow
                icon={Key}
                title="Single sign-on (SSO)"
                description="Allow members to sign in using your identity provider (Okta, Azure AD, Google Workspace)."
                control={
                  <div className="flex items-center gap-2">
                    <Switch
                      id="sso"
                      checked={ssoEnabled}
                      onCheckedChange={setSsoEnabled}
                    />
                    {ssoEnabled ? (
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        Configure
                      </Button>
                    ) : (
                      <Label htmlFor="sso" className="text-xs text-muted-foreground">
                        Disabled
                      </Label>
                    )}
                  </div>
                }
              />
            </div>
            <div className="px-5">
              <SettingsRow
                icon={Clock}
                title="Session timeout"
                description="Automatically sign out inactive members after this period."
                control={
                  <Select defaultValue="7d">
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">1 day</SelectItem>
                      <SelectItem value="7d">7 days</SelectItem>
                      <SelectItem value="30d">30 days</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm">Save security settings</Button>
          </div>
        </section>

        <Separator />

        {/* Active sessions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <SectionRuleHeading label="Active Sessions" />
              <p className="text-xs text-muted-foreground">
                Devices currently signed in to your account.
              </p>
            </div>
            <Button variant="outline" size="sm" className="text-xs text-destructive border-destructive/30 hover:bg-destructive/5">
              Revoke all other sessions
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
            {RECENT_SESSIONS.map((session) => (
              <div key={session.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{session.device}</span>
                    {session.current && (
                      <span className="inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        This device
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {session.location} · {session.lastSeen}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:text-destructive h-7"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
    </PageShell>
  );
}
