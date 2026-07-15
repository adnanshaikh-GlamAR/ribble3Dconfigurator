import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://adnanshaikh-glamar.github.io/ribble3Dconfigurator";
const socialPreviewImage = `${siteUrl}/social/ribble-configurator-preview.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Fynd GlamAR Ribble Configurator",
  description: "Interactive 3D cycle configurator concept for Ribble and Fynd GlamAR.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Fynd GlamAR Ribble Configurator",
    description: "Configure the Ribble NEW ULTRA-ROAD in an immersive 3D viewer.",
    images: [
      {
        url: socialPreviewImage,
        width: 2992,
        height: 1502,
        alt: "Fynd GlamAR Ribble NEW ULTRA-ROAD 3D configurator preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fynd GlamAR Ribble Configurator",
    description: "Configure the Ribble NEW ULTRA-ROAD in an immersive 3D viewer.",
    images: [socialPreviewImage],
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
