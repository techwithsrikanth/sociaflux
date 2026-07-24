import type { Metadata } from "next";
import "./globals.css";

const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME || "CreatorMatch AI";

export const metadata: Metadata = {
  title: productName,
  description: "AI creator matchmaking engine MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
