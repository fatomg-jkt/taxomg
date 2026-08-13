import { CashflowEditorEnhancements } from "@/components/cashflow-editor-enhancements";
import { DashboardAuth } from "@/components/dashboard-auth";
import { PaymentRequestEnhancement } from "@/components/payment-request-enhancement";
import { SidebarDashboardAccordion } from "@/components/sidebar-dashboard-accordion";
import { UserAccessSettingsOverlay } from "@/components/user-access-settings-overlay";

export default function Home() {
  return <><DashboardAuth /><SidebarDashboardAccordion /><CashflowEditorEnhancements /><PaymentRequestEnhancement /><UserAccessSettingsOverlay /></>;
}
