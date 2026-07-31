import type { ReactNode } from "react";
import Image from "next/image";

import { SiteFooter } from "@/components/layout/site-footer";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-background">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <Image
            src="/Alleato-Group-Logo_Dark.png"
            alt="Alleato"
            width={140}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </div>
      </header>
      <main className="flex-1 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
