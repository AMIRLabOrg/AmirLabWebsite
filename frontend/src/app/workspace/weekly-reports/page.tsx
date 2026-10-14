import { WorkspaceContent } from "@/components/workspace-content";
import { WeeklyReports } from "@/components/weekly-reports";
import { MemberOnly } from "@/components/member-only";

export default function WeeklyReportsPage() {
  return (
    <WorkspaceContent>
      <MemberOnly>
        <WeeklyReports />
      </MemberOnly>
    </WorkspaceContent>
  );
}
