import { notFound } from "next/navigation";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import {
  SiteContentEditor,
  type SiteContentPage,
} from "@/components/site-content-editor";

export default async function EditSiteContentPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (page !== "home" && page !== "about") notFound();
  return (
    <WorkspacePageShell>
      <SiteContentEditor page={page as SiteContentPage} />
    </WorkspacePageShell>
  );
}
