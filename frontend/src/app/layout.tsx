import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SearchProvider } from "@/context/SearchContext";
import { VideoProvider } from "@/context/VideoContext";
import MainLayout from "@/components/MainLayout";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chefsy — Your AI Kitchen Companion",
  description: "AI-powered recipe assistant for delicious home cooking. Get personalised recipes, ingredient lists, nutrition insights and cooking tips.",
};

export const viewport: Viewport = {
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#DA7756",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
      </head>
      <body
        className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} antialiased`}
        style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
      >
        {/* Theme bootstrap: read from localStorage before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('gharka_theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', t);
                } catch(e) {}
              })();
            `,
          }}
        />
        <SearchProvider>
          <VideoProvider>
            <MainLayout>{children}</MainLayout>
          </VideoProvider>
        </SearchProvider>
      </body>
    </html>
  );
}
