import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import OfflineRegistration from "./offline-registration";
import AppNavigation from "./navigation";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Schach spielen und analysieren",
  description: "Spiele Schach, trainiere und werde Teil der Schach-Community.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={geistSans.variable + " " + geistMono.variable + " h-full antialiased"}>
      <body className="min-h-full flex flex-col">
        <OfflineRegistration />
        <AppNavigation />
        <div className="min-h-screen pt-14 md:pt-0 md:pl-72">{children}</div>
      </body>
    </html>
  );
}
