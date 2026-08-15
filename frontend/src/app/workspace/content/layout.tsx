import type { ReactNode } from "react";
import { AdminOnly } from "@/components/admin-only";

export default function SiteContentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminOnly>{children}</AdminOnly>;
}
