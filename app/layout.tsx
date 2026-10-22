import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnackOps Agent Workbench",
  description: "可观测的电商客服 Agent 工作台，展示计划、能力执行、评分与风险复核。",
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
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
