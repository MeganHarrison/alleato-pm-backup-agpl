import { Head, Html, Main, NextScript } from "next/document";

/**
 * Next.js production page-data collection can request /_document even for an
 * App Router-first app. This explicit bridge prevents missing-module failures.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
