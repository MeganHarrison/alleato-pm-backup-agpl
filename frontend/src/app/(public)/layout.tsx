import type { ReactNode } from "react";
import Image from "next/image";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
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
      <main className="py-8">{children}</main>
    </div>
  );
}
