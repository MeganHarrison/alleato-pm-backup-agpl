"use client";

import { useEffect } from "react";
import { installAppToastInstrumentation } from "@/lib/toast/app-toast";

export function ToastInstrumentation() {
  useEffect(() => {
    installAppToastInstrumentation();
  }, []);

  return null;
}
