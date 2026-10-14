import { PublicStatusPage } from "@/components/public-status-page";
export default function OfflinePage() {
  return (
    <PublicStatusPage
      label="Connection unavailable"
      title="You’re offline"
      description="Reconnect to open your workspace. Your account and lab content will be available when you’re back online."
      href="/workspace"
      action="Try again"
    />
  );
}
