import Script from "next/script";

/** The GA4 measurement ID. It is public (every page sends it), so it lives in code; the env var can override it. */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-6GQ5842PC3";

/** Google tag (gtag.js). Loads only in production builds, so local development doesn't count as traffic. */
export function GoogleAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  const id = MEASUREMENT_ID;

  return (
    <>
      <Script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
