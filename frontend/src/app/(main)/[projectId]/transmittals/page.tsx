import { Suspense } from "react";
import TransmittalsClient from "./transmittals-client";

export default function TransmittalsPage() {
  return (
    <Suspense>
      <TransmittalsClient />
    </Suspense>
  );
}
