import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fynd GlamAR Ribble Configurator",
  description: "Interactive 3D cycle configurator concept for Ribble and Fynd GlamAR.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
