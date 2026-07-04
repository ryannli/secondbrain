import type { Metadata } from "next";
import { Inter, DM_Sans, Space_Grotesk, Outfit, Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Second Brain",
  description: "Your personal knowledge management system",
};

// Script to prevent flash of wrong theme on initial load
// Runs before React hydrates to apply the correct theme class
const themeScript = `
(function() {
  try {
    const stored = localStorage.getItem('theme-mode');
    const theme = stored || 'light';
    const isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* No app-rendered children in <head>: browser extensions inject
          scripts there and shift React's position-based hydration matching.
          The theme script runs as the first element of <body> instead —
          still before any content paints, so no theme flash. */}
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${dmSans.variable} ${spaceGrotesk.variable} ${outfit.variable} ${sora.variable} ${plusJakarta.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
