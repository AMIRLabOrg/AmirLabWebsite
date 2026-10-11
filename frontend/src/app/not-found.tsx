import DefaultNotFound from "next/dist/client/components/builtin/not-found";
import { SiteLayout } from "@/components/site-layout";

export default function NotFound() {
  return (
    <SiteLayout>
      <DefaultNotFound />
    </SiteLayout>
  );
}
