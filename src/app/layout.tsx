import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLIPFORGE AI — Turn Livestreams Into Viral Shorts",
  description: "AI finds your best livestream moments and edits them into vertical shorts with captions, facecam framing and professional audio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
