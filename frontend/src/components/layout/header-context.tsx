"use client";

import * as React from "react";

export type HeaderState = {
  companyName: string;
  projectName: string;
  currentTool: string;
  userInitials: string;
};

export const DEFAULT_HEADER_STATE: HeaderState = {
  companyName: "Alleato Group",
  projectName: "24-104 - Goodwill Bart",
  currentTool: "Budget",
  userInitials: "BC",
};

type HeaderContextValue = {
  header: HeaderState;
  setHeader: React.Dispatch<React.SetStateAction<HeaderState>>;
};

const HeaderContext = React.createContext<HeaderContextValue | undefined>(
  undefined,
);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = React.useState<HeaderState>(DEFAULT_HEADER_STATE);

  return (
    <HeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = React.useContext(HeaderContext);

  if (!context) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }

  return context;
}
