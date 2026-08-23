"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { ProfileEditor } from "@/components/profile-editor";
import { EmailChangePanel } from "@/components/email-change-panel";

export default function EditAccountPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { loading, user } = useAuth();

  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") {
      router.replace("/workspace/overview");
    }
  }, [loading, user, router]);

  if (loading || user?.role !== "ADMIN") return null;

  return (
    <WorkspacePageShell>
      <ProfileEditor userId={id} />
      <EmailChangePanel userId={id} />
    </WorkspacePageShell>
  );
}
