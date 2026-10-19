import type { Metadata } from "next";
import { DepartmentsPageView } from "@/components/departments-page-view";
import { getDepartments } from "@/lib/api";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  return <DepartmentsPageView departments={await getDepartments()} />;
}
