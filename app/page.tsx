import { CashflowEditorEnhancements } from "@/components/cashflow-editor-enhancements";
import { CashflowWorkbookEnhancement } from "@/components/cashflow-workbook-enhancement";
import { DashboardAuth } from "@/components/dashboard-auth";
import { LoginCopyEnhancement } from "@/components/login-copy-enhancement";
import { PaymentRequestEnhancement } from "@/components/payment-request-enhancement";
import { SidebarDashboardAccordion } from "@/components/sidebar-dashboard-accordion";
import { TaxExcelActionsEnhancement } from "@/components/tax-excel-actions-enhancement";
import { UserAccessSettingsOverlay } from "@/components/user-access-settings-overlay";
import { UserIdInputEnhancement } from "@/components/user-id-input-enhancement";

export default function Home() {
  return <><DashboardAuth /><LoginCopyEnhancement /><UserIdInputEnhancement /><SidebarDashboardAccordion /><TaxExcelActionsEnhancement /><CashflowEditorEnhancements /><CashflowWorkbookEnhancement /><PaymentRequestEnhancement /><UserAccessSettingsOverlay /></>;
}
