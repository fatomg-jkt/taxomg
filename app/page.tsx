import { CashflowEditorEnhancements } from "@/components/cashflow-editor-enhancements";
import { CashflowRollingTableStructureEnhancement } from "@/components/cashflow-rolling-table-structure-enhancement";
import { CashflowSummaryStructureEnhancement } from "@/components/cashflow-summary-structure-enhancement";
import { CashflowWorkbookEnhancement } from "@/components/cashflow-workbook-enhancement";
import { DashboardAuth } from "@/components/dashboard-auth";
import { FinanceControlVisualEnhancement } from "@/components/finance-control-visual-enhancement";
import { LoginCopyEnhancement } from "@/components/login-copy-enhancement";
import { PaymentRequestEnhancement } from "@/components/payment-request-enhancement";
import { SidebarDashboardAccordion } from "@/components/sidebar-dashboard-accordion";
import { TaxExcelActionsEnhancement } from "@/components/tax-excel-actions-enhancement";
import { UserAccessSettingsOverlay } from "@/components/user-access-settings-overlay";
import { UserIdInputEnhancement } from "@/components/user-id-input-enhancement";

export default function Home() {
  return <><DashboardAuth /><FinanceControlVisualEnhancement /><LoginCopyEnhancement /><UserIdInputEnhancement /><SidebarDashboardAccordion /><TaxExcelActionsEnhancement /><CashflowEditorEnhancements /><CashflowWorkbookEnhancement /><CashflowSummaryStructureEnhancement /><CashflowRollingTableStructureEnhancement /><PaymentRequestEnhancement /><UserAccessSettingsOverlay /></>;
}
