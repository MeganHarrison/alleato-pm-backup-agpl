import type { AppProps } from "next/app";

/**
 * Production builds can still resolve legacy Pages Router modules even though
 * the product uses the App Router. Keep this bridge minimal and side-effect free.
 */
export default function AlleatoPagesApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
