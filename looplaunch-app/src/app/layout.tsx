import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { getSiteUrl, siteConfig } from "@/lib/seo";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const siteUrl = getSiteUrl();

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Loop Launch — AI-Powered Strategic Marketing Intelligence",
    template: "%s | Loop Launch",
  },
  description: siteConfig.description,
  applicationName: "Loop Launch",
  keywords: siteConfig.keywords,
  authors: [{ name: "Loop Launch", url: siteUrl }],
  creator: "Loop Launch",
  publisher: "Loop Launch",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Loop Launch — AI-Powered Strategic Marketing Intelligence",
    description: siteConfig.description,
    url: siteUrl,
    siteName: "Loop Launch",
    images: [
      {
        url: "/logo-black.png",
        width: 1200,
        height: 630,
        alt: "Loop Launch — AI-Powered Strategic Marketing Intelligence",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop Launch — AI-Powered Strategic Marketing Intelligence",
    description: siteConfig.description,
    images: ["/logo-black.png"],
    creator: "@looplaunch",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      "url": siteUrl,
      "name": "Loop Launch",
      "description": siteConfig.description,
      "inLanguage": "en-US",
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      "name": "Loop Launch",
      "url": siteUrl,
      "logo": `${siteUrl}/logo.png`,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      "name": "Loop Launch",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web Browser",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${GeistMono.variable} h-full antialiased`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
