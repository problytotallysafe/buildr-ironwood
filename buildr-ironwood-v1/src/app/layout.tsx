import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buildr | Ironwood Remodeling",
  description: "Customer, estimate, proposal, project, and payment management for Ironwood Remodeling.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
