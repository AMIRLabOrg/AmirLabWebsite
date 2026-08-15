import { WeeklyReports } from "@/components/weekly-reports";
import { MemberOnly } from "@/components/member-only";

export default function WeeklyReportsPage() {
  return <MemberOnly><WeeklyReports /></MemberOnly>;
}
