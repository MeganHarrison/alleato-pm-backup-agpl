"use client";

import { Button } from "@/components/ui/button";

export function SettingsPageSection() {
  return (
    <section id="settings-pattern">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">10</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Settings Page Pattern</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            White panel on gray canvas. Footer uses surface-2 tint to anchor the save action.
          </p>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-card rounded-xl overflow-hidden max-w-[640px] shadow-sm mb-4">

        {/* Section 1 — General */}
        <div className="p-7 px-8 border-b border-border">
          <div className="text-[13px] font-semibold text-foreground mb-1">General</div>
          <div className="text-xs text-muted-foreground/60 mb-5 leading-[1.5]">
            Basic account information and workspace preferences.
          </div>

          {/* Field: Display Name */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Display Name
            </label>
            <input
              type="text"
              defaultValue="Megan Harrison"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-foreground outline-none shadow-xs"
              readOnly
            />
          </div>

          {/* Field: Email Address */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Email Address
            </label>
            <input
              type="email"
              defaultValue="megan@meganharrison.llc"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-foreground outline-none shadow-xs"
              readOnly
            />
          </div>
        </div>

        {/* Section 2 — Notifications */}
        <div className="p-7 px-8 border-b border-border">
          <div className="text-[13px] font-semibold text-foreground mb-1">Notifications</div>
          <div className="text-xs text-muted-foreground/60 mb-5 leading-[1.5]">
            Control when and how you receive alerts.
          </div>

          {/* Toggle Row 1 — Email digests (ON) */}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="text-[13px] text-muted-foreground">Email digests</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">Weekly summary of activity</div>
            </div>
            {/* ON toggle */}
            <div className="w-9 h-5 rounded-full relative cursor-pointer transition-colors bg-primary">
              <span className="w-3.5 h-3.5 rounded-full bg-card shadow-sm absolute top-[3px] left-[18px] transition-all" />
            </div>
          </div>

          <div className="h-px bg-border my-2.5" />

          {/* Toggle Row 2 — Deployment alerts (ON) */}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="text-[13px] text-muted-foreground">Deployment alerts</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">Notify when builds fail</div>
            </div>
            {/* ON toggle */}
            <div className="w-9 h-5 rounded-full relative cursor-pointer transition-colors bg-primary">
              <span className="w-3.5 h-3.5 rounded-full bg-card shadow-sm absolute top-[3px] left-[18px] transition-all" />
            </div>
          </div>

          <div className="h-px bg-border my-2.5" />

          {/* Toggle Row 3 — Marketing emails (OFF) */}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="text-[13px] text-muted-foreground">Marketing emails</div>
              <div className="text-[11px] text-muted-foreground/60 mt-0.5">Product updates and announcements</div>
            </div>
            {/* OFF toggle */}
            <div className="w-9 h-5 rounded-full relative cursor-pointer transition-colors bg-muted border border-border">
              <span className="w-3.5 h-3.5 rounded-full bg-card shadow-sm absolute top-[3px] left-[3px] transition-all" />
            </div>
          </div>
        </div>

        {/* Section 3 — Danger Zone */}
        <div className="p-7 px-8 border-b border-border">
          <div className="text-[13px] font-semibold text-foreground mb-1">Danger Zone</div>
          <div className="text-xs text-muted-foreground/60 mb-5 leading-[1.5]">
            Irreversible actions. Proceed with caution.
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div>
              <div className="text-[13px] text-muted-foreground">Delete workspace</div>
              <div className="text-[12px] text-muted-foreground/60 mt-0.5">Permanently removes all data.</div>
            </div>
            <Button variant="destructive" size="sm">
              Delete workspace
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-8 py-4 bg-muted/50 border-t border-border">
          <Button variant="outline" size="sm">
            Cancel
          </Button>
          <Button size="sm">
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}
