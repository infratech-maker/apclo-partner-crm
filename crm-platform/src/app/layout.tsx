import type { Metadata } from "next";
import "./globals.css";
import AuthSessionProvider from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "統合CRMプラットフォーム",
  description: "高度なBI機能を持つ統合CRMプラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}


