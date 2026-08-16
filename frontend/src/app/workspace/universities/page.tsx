import { Plus } from "lucide-react";
import { UniversityIndex } from "@/components/universities-admin";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button-control";
export const metadata: Metadata = { title: "Universities" };

export default function UniversitiesPage() {
  return (
    <WorkspacePageShell
      action={
        <ButtonLink href="/workspace/universities/new" variant="primary">
          <Plus aria-hidden="true" size={16} /> New university
        </ButtonLink>
      }
      description="Manage collaborating universities shown in the public site marquee."
    >
      <UniversityIndex />
    </WorkspacePageShell>
  );
}
