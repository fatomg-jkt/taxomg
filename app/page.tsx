import { DashboardAuth } from "@/components/dashboard-auth";
import { UserAccessSettingsOverlay } from "@/components/user-access-settings-overlay";

export default function Home() {
  return <><DashboardAuth /><UserAccessSettingsOverlay /></>;
}
