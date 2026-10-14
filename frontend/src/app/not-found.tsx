import { PublicStatusPage } from "@/components/public-status-page";
import { SiteLayout } from "@/components/site-layout";

export default function NotFound() {
  return (
    <SiteLayout>
      <PublicStatusPage
        label="404 · Page not found"
        title="This page isn’t here"
        description="The link may have changed, or the page is no longer available. Explore the lab from the home page."
        href="/"
        action="Back to the lab"
      />
    </SiteLayout>
  );
}
