"use client";

export function WhitespaceSection() {
  return (
    <section id="whitespace">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">04</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Whitespace as Dividers</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">Same principle as dark mode — space communicates grouping, borders signal interactivity</p>
        </div>
      </div>

      {/* Compare Grid */}
      <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-border shadow-sm mb-6">
        {/* Wrong: Card everything */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-600 bg-red-50 px-2 py-[3px] rounded mb-5">
            ✗ Card everything
          </div>

          <div className="space-y-2">
            <div className="bg-muted/50 border border-border rounded-md p-3 mb-2">
              <div className="text-[12px] font-semibold text-muted-foreground">Profile</div>
              <div className="text-[12px] text-muted-foreground/60">User information and preferences</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-md p-3 mb-2">
              <div className="text-[12px] font-semibold text-muted-foreground">Notifications</div>
              <div className="text-[12px] text-muted-foreground/60">Manage your alert settings</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-md p-3 mb-2">
              <div className="text-[12px] font-semibold text-muted-foreground">Security</div>
              <div className="text-[12px] text-muted-foreground/60">Password and 2FA settings</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-md p-3">
              <div className="text-[12px] font-semibold text-muted-foreground">Billing</div>
              <div className="text-[12px] text-muted-foreground/60">Subscription and payment</div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            Every section gets a card, creating visual noise with no hierarchy.
          </p>
        </div>

        {/* Right: Space creates groups */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 px-2 py-[3px] rounded mb-5">
            ✓ Space creates groups
          </div>

          {/* Profile Section */}
          <div className="mb-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">PROFILE</div>
            <div className="flex items-center gap-2.5 py-2 border-b border-border text-[13px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              Display name and avatar
            </div>
            <div className="flex items-center gap-2.5 py-2 border-b border-border text-[13px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              Email preferences
            </div>
          </div>

          {/* Security Section */}
          <div className="mb-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">SECURITY</div>
            <div className="flex items-center gap-2.5 py-2 border-b border-border text-[13px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              Change password
            </div>
            <div className="flex items-center gap-2.5 py-2 border-b border-border text-[13px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              Two-factor authentication
            </div>
          </div>

          {/* Billing Section */}
          <div className="mb-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-3">BILLING</div>
            <div className="flex items-center gap-2.5 py-2 border-b border-border text-[13px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              Subscription plan
            </div>
            <div className="flex items-center gap-2.5 py-2 text-[13px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              Payment methods
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            Generous spacing between groups creates structure without visual clutter.
          </p>
        </div>
      </div>
    </section>
  );
}
