import { pgTable, text, integer, boolean, timestamp, decimal, jsonb, serial, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  userType: text("user_type").notNull().default("merchant"),
  platformRole: text("platform_role"),
  merchantRole: text("merchant_role"),
  tenantId: integer("tenant_id"),
  storeId: integer("store_id"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_users_tenant").on(table.tenantId),
  index("idx_users_username").on(table.username),
]);

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  contactName: text("contact_name").notNull(),
  primaryEmail: text("primary_email").notNull(),
  primaryPhone: text("primary_phone"),
  monthlySoftwareFee: decimal("monthly_software_fee", { precision: 10, scale: 2 }).notNull().default("30.00"),
  billingStartDate: timestamp("billing_start_date"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  phone: text("phone"),
  email: text("email"),
  timezone: text("timezone").default("America/New_York"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_stores_tenant").on(table.tenantId),
]);

export const merchantSettings = pgTable("merchant_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique(),
  dualPricingEnabled: boolean("dual_pricing_enabled").notNull().default(false),
  cardUpliftPercent: decimal("card_uplift_percent", { precision: 5, scale: 2 }).notNull().default("3.50"),
  cashLabel: text("cash_label").notNull().default("Cash Price"),
  cardLabel: text("card_label").notNull().default("Card Price"),
  emailReceiptsEnabled: boolean("email_receipts_enabled").notNull().default(true),
  repairStatusEmailsEnabled: boolean("repair_status_emails_enabled").notNull().default(true),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  logoUrl: text("logo_url"),
  footerText: text("footer_text"),
  spinEnabled: boolean("spin_enabled").notNull().default(false),
  taxLabor: boolean("tax_labor").notNull().default(false),
  defaultEstimateTerms: text("default_estimate_terms"),
  ticketCommissionType: text("ticket_commission_type").notNull().default("disabled"),
  ticketCommissionValue: decimal("ticket_commission_value", { precision: 10, scale: 2 }).notNull().default("0.00"),
  receiptShowLogo: boolean("receipt_show_logo").notNull().default(true),
  receiptShowBusinessName: boolean("receipt_show_business_name").notNull().default(true),
  receiptShowStoreName: boolean("receipt_show_store_name").notNull().default(true),
  receiptShowAddress: boolean("receipt_show_address").notNull().default(true),
  receiptShowPhone: boolean("receipt_show_phone").notNull().default(true),
  receiptShowEmailWebsite: boolean("receipt_show_email_website").notNull().default(false),
  receiptShowCustomerName: boolean("receipt_show_customer_name").notNull().default(true),
  receiptShowCashierName: boolean("receipt_show_cashier_name").notNull().default(true),
  receiptShowTicketNumber: boolean("receipt_show_ticket_number").notNull().default(true),
  receiptShowSerialImei: boolean("receipt_show_serial_imei").notNull().default(true),
  receiptShowPricingMode: boolean("receipt_show_pricing_mode").notNull().default(true),
  receiptShowDiscountLine: boolean("receipt_show_discount_line").notNull().default(true),
  receiptShowTaxLine: boolean("receipt_show_tax_line").notNull().default(true),
  receiptFooterText: text("receipt_footer_text").default("Thank you for your business!"),
  receiptReturnPolicy: text("receipt_return_policy"),
  receiptWarrantyText: text("receipt_warranty_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull().unique(),
  tenantId: integer("tenant_id").notNull(),
  defaultTaxRateId: integer("default_tax_rate_id"),
  terminalMapping: jsonb("terminal_mapping"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().unique(),
  status: text("status").notNull().default("active"),
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }).notNull(),
  billingStartDate: timestamp("billing_start_date"),
  nextInvoiceDate: timestamp("next_invoice_date"),
  paymentStatus: text("payment_status").notNull().default("current"),
  externalBillingCustomerId: text("external_billing_customer_id"),
  externalSubscriptionId: text("external_subscription_id"),
  minimumMonthlyCardVolume: decimal("minimum_monthly_card_volume", { precision: 12, scale: 2 }).notNull().default("20000.00"),
  belowThresholdFee: decimal("below_threshold_fee", { precision: 10, scale: 2 }).notNull().default("30.00"),
  billingEnabled: boolean("billing_enabled").notNull().default(false),
  billingStatus: text("billing_status").notNull().default("pending_setup"),
  billingContactEmail: text("billing_contact_email"),
  mxMerchantCustomerRef: text("mx_merchant_customer_ref"),
  mxMerchantVaultToken: text("mx_merchant_vault_token"),
  billingCardBrand: text("billing_card_brand"),
  billingCardLast4: text("billing_card_last4"),
  billingCardExpMonth: integer("billing_card_exp_month"),
  billingCardExpYear: integer("billing_card_exp_year"),
  billingFullName: text("billing_full_name"),
  billingAddress1: text("billing_address1"),
  billingAddress2: text("billing_address2"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZip: text("billing_zip"),
  billingCountry: text("billing_country").notNull().default("US"),
  proratedFirstBillCharged: boolean("prorated_first_bill_charged").notNull().default(false),
  retryCount: integer("retry_count").notNull().default(0),
  lastRetryAt: timestamp("last_retry_at"),
  outstandingBalance: decimal("outstanding_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  outstandingAssessmentId: integer("outstanding_assessment_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionInvoices = pgTable("subscription_invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  subscriptionId: integer("subscription_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_invoices_tenant").on(table.tenantId),
]);

export const billingEvents = pgTable("billing_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  subscriptionId: integer("subscription_id"),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_billing_events_tenant").on(table.tenantId),
]);

export const agreementTemplates = pgTable("agreement_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const signedAgreements = pgTable("signed_agreements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  agreementTemplateId: integer("agreement_template_id").notNull(),
  agreementVersion: integer("agreement_version").notNull(),
  agreementTitle: text("agreement_title").notNull().default(""),
  agreementContent: text("agreement_content").notNull().default(""),
  contentHash: text("content_hash"),
  signedByUserId: integer("signed_by_user_id").notNull(),
  signedName: text("signed_name").notNull(),
  legalBusinessName: text("legal_business_name"),
  signerTitle: text("signer_title"),
  signerEmail: text("signer_email"),
  agreedToAgreement: boolean("agreed_to_agreement").default(false),
  representedAuthorityToBind: boolean("represented_authority_to_bind").default(false),
  consentedToElectronicRecords: boolean("consented_to_electronic_records").default(false),
  checkboxTimestamps: jsonb("checkbox_timestamps"),
  agreementTextHashDisplayed: text("agreement_text_hash_displayed"),
  renderedExportHash: text("rendered_export_hash"),
  sessionMetadata: jsonb("session_metadata"),
  presentationEvidence: jsonb("presentation_evidence"),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => [
  index("idx_signed_agreements_tenant").on(table.tenantId),
]);

export const storeBillingConfigs = pgTable("store_billing_configs", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }).notNull().default("30.00"),
  minimumMonthlyCardVolume: decimal("minimum_monthly_card_volume", { precision: 12, scale: 2 }).notNull().default("20000.00"),
  belowThresholdFee: decimal("below_threshold_fee", { precision: 10, scale: 2 }).notNull().default("30.00"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_store_billing_configs_store").on(table.storeId),
  index("idx_store_billing_configs_tenant").on(table.tenantId),
]);

export const billingAssessments = pgTable("billing_assessments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  subscriptionId: integer("subscription_id").notNull(),
  storeId: integer("store_id"),
  storeBillingConfigId: integer("store_billing_config_id"),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  baseFee: decimal("base_fee", { precision: 10, scale: 2 }).notNull(),
  cardVolume: decimal("card_volume", { precision: 12, scale: 2 }).notNull(),
  minimumMonthlyCardVolume: decimal("minimum_monthly_card_volume", { precision: 12, scale: 2 }).notNull(),
  belowThresholdFee: decimal("below_threshold_fee", { precision: 10, scale: 2 }).notNull(),
  surchargeApplied: boolean("surcharge_applied").notNull().default(false),
  totalFee: decimal("total_fee", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_billing_assessments_tenant").on(table.tenantId),
]);

export const billingTransactions = pgTable("billing_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  subscriptionId: integer("subscription_id"),
  billingAssessmentId: integer("billing_assessment_id"),
  storeId: integer("store_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  adjustmentStatus: text("adjustment_status"),
  adjustmentReason: text("adjustment_reason"),
  mxTransactionId: text("mx_transaction_id"),
  mxResponseCode: text("mx_response_code"),
  mxResponseMessage: text("mx_response_message"),
  rawResponseJson: text("raw_response_json"),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
  succeededAt: timestamp("succeeded_at"),
  failedAt: timestamp("failed_at"),
}, (table) => [
  index("idx_billing_transactions_tenant").on(table.tenantId),
]);

export const billingAdjustments = pgTable("billing_adjustments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  billingTransactionId: integer("billing_transaction_id"),
  billingAssessmentId: integer("billing_assessment_id"),
  adjustmentType: text("adjustment_type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  adminUserId: integer("admin_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_billing_adjustments_tenant").on(table.tenantId),
]);

export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_audit_tenant").on(table.tenantId),
  index("idx_audit_created").on(table.createdAt),
]);

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  notes: text("notes"),
  emailReceipts: boolean("email_receipts").notNull().default(true),
  emailTicketUpdates: boolean("email_ticket_updates").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_customers_tenant").on(table.tenantId),
]);

export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_categories_tenant").on(table.tenantId),
  index("idx_categories_parent").on(table.parentId),
]);

export const COST_CALCULATION_MODE = {
  FIXED_COST: "fixed_cost",
  PROFIT_PERCENT_OF_SALE: "profit_percent_of_sale",
  FLAT_PROFIT: "flat_profit",
  MANUAL_COST_AT_SALE: "manual_cost_at_sale",
} as const;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  categoryId: integer("category_id"),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  barcode: text("barcode"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  cashPrice: decimal("cash_price", { precision: 10, scale: 2 }),
  isService: boolean("is_service").notNull().default(false),
  isOpenPrice: boolean("is_open_price").notNull().default(false),
  costCalculationMode: text("cost_calculation_mode").notNull().default("fixed_cost"),
  fixedCost: decimal("fixed_cost", { precision: 10, scale: 2 }),
  profitPercent: decimal("profit_percent", { precision: 10, scale: 4 }),
  flatProfitAmount: decimal("flat_profit_amount", { precision: 10, scale: 2 }),
  minOpenPrice: decimal("min_open_price", { precision: 10, scale: 2 }),
  maxOpenPrice: decimal("max_open_price", { precision: 10, scale: 2 }),
  isSerialized: boolean("is_serialized").notNull().default(false),
  trackInventory: boolean("track_inventory").notNull().default(true),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  taxable: boolean("taxable").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  commissionEnabled: boolean("commission_enabled").notNull().default(false),
  commissionType: text("commission_type").notNull().default("none"),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_products_tenant").on(table.tenantId),
  index("idx_products_category").on(table.categoryId),
  index("idx_products_sku").on(table.sku),
]);

export const storeInventory = pgTable("store_inventory", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id").notNull(),
  productId: integer("product_id").notNull(),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_store_inv_tenant").on(table.tenantId),
  index("idx_store_inv_store_product").on(table.storeId, table.productId),
]);

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_vendors_tenant").on(table.tenantId),
]);

export const inventoryUnits = pgTable("inventory_units", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id"),
  productId: integer("product_id").notNull(),
  serialNumber: text("serial_number"),
  imei: text("imei"),
  condition: text("condition").notNull().default("new"),
  sourceType: text("source_type").notNull().default("manual"),
  vendorId: integer("vendor_id"),
  sourceNameSnapshot: text("source_name_snapshot"),
  acquisitionCost: decimal("acquisition_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  status: text("status").notNull().default("in_stock"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  soldAt: timestamp("sold_at"),
  saleId: integer("sale_id"),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  commissionType: text("commission_type"),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_inv_units_tenant").on(table.tenantId),
  index("idx_inv_units_product").on(table.productId),
  index("idx_inv_units_store").on(table.storeId),
  index("idx_inv_units_status").on(table.status),
  index("idx_inv_units_serial").on(table.tenantId, table.serialNumber),
  index("idx_inv_units_imei").on(table.tenantId, table.imei),
  // Partial unique indexes applied via raw SQL (Drizzle lacks WHERE support):
  // uq_inv_units_tenant_serial UNIQUE (tenant_id, serial_number) WHERE serial_number IS NOT NULL
  // uq_inv_units_tenant_imei   UNIQUE (tenant_id, imei)          WHERE imei IS NOT NULL
]);

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id"),
  productId: integer("product_id").notNull(),
  type: text("type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  reason: text("reason"),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_inv_movements_tenant").on(table.tenantId),
  index("idx_inv_movements_product").on(table.productId),
]);

export const SALE_TYPE = {
  RETAIL: "retail",
  REPAIR_DEPOSIT: "repair_deposit",
  REPAIR_FINAL: "repair_final",
} as const;
export type SaleTypeValue = typeof SALE_TYPE[keyof typeof SALE_TYPE];

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id"),
  customerId: integer("customer_id"),
  employeeId: integer("employee_id").notNull(),
  saleNumber: text("sale_number").notNull(),
  saleType: text("sale_type").notNull().default("retail"),
  ticketId: integer("ticket_id"),
  pricingModeUsed: text("pricing_mode_used").notNull().default("cash"),
  subtotalCash: decimal("subtotal_cash", { precision: 10, scale: 2 }).notNull(),
  subtotalCard: decimal("subtotal_card", { precision: 10, scale: 2 }).notNull(),
  taxTotal: decimal("tax_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  discountTotal: decimal("discount_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  discountType: text("discount_type"),
  discountValue: text("discount_value"),
  finalTotal: decimal("final_total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  status: text("status").notNull().default("completed"),
  completedAt: timestamp("completed_at"),
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
  totalRefunded: decimal("total_refunded", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_sales_tenant").on(table.tenantId),
  index("idx_sales_employee").on(table.employeeId),
  index("idx_sales_customer").on(table.customerId),
  index("idx_sales_created").on(table.createdAt),
  uniqueIndex("uq_sales_tenant_number").on(table.tenantId, table.saleNumber),
]);

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  productId: integer("product_id"),
  inventoryUnitId: integer("inventory_unit_id"),
  serialNumberSnapshot: text("serial_number_snapshot"),
  imeiSnapshot: text("imei_snapshot"),
  unitCostSnapshot: decimal("unit_cost_snapshot", { precision: 10, scale: 2 }),
  grossProfitSnapshot: decimal("gross_profit_snapshot", { precision: 10, scale: 2 }),
  descriptionSnapshot: text("description_snapshot").notNull(),
  quantity: integer("quantity").notNull().default(1),
  cashUnitPrice: decimal("cash_unit_price", { precision: 10, scale: 2 }).notNull(),
  cardUnitPrice: decimal("card_unit_price", { precision: 10, scale: 2 }).notNull(),
  finalUnitPrice: decimal("final_unit_price", { precision: 10, scale: 2 }).notNull(),
  pricingModeUsed: text("pricing_mode_used").notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  commissionEligible: boolean("commission_eligible").notNull().default(false),
  commissionType: text("commission_type"),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }),
  commissionBaseAmount: decimal("commission_base_amount", { precision: 10, scale: 2 }),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }),
  commissionEmployeeId: integer("commission_employee_id"),
  quantityRefunded: integer("quantity_refunded").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_sale_items_sale").on(table.saleId),
  index("idx_sale_items_tenant").on(table.tenantId),
]);

export const REFUND_TYPE = {
  FULL: "full",
  LINE_ITEM: "line_item",
  CUSTOM: "custom",
} as const;

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  saleId: integer("sale_id").notNull(),
  refundType: text("refund_type").notNull(),
  subtotalRefunded: decimal("subtotal_refunded", { precision: 10, scale: 2 }).notNull(),
  taxRefunded: decimal("tax_refunded", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalRefunded: decimal("total_refunded", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  employeeId: integer("employee_id").notNull(),
  employeeName: text("employee_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_refunds_sale").on(table.saleId),
  index("idx_refunds_tenant").on(table.tenantId),
]);

export const refundItems = pgTable("refund_items", {
  id: serial("id").primaryKey(),
  refundId: integer("refund_id").notNull(),
  saleItemId: integer("sale_item_id").notNull(),
  productId: integer("product_id"),
  inventoryUnitId: integer("inventory_unit_id"),
  descriptionSnapshot: text("description_snapshot").notNull(),
  quantityRefunded: integer("quantity_refunded").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotalRefunded: decimal("subtotal_refunded", { precision: 10, scale: 2 }).notNull(),
  taxRefunded: decimal("tax_refunded", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalRefunded: decimal("total_refunded", { precision: 10, scale: 2 }).notNull(),
}, (table) => [
  index("idx_refund_items_refund").on(table.refundId),
]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  processor: text("processor").notNull().default("mock"),
  paymentMethodType: text("payment_method_type").notNull(),
  terminalId: text("terminal_id"),
  externalTransactionId: text("external_transaction_id"),
  processorReferenceId: text("processor_reference_id"),
  authorizationCode: text("authorization_code"),
  status: text("status").notNull().default("pending"),
  amountRequested: decimal("amount_requested", { precision: 10, scale: 2 }).notNull(),
  amountApproved: decimal("amount_approved", { precision: 10, scale: 2 }),
  responseCode: text("response_code"),
  responseMessage: text("response_message"),
  cardBrand: text("card_brand"),
  cardLast4: text("card_last4"),
  entryMode: text("entry_mode"),
  isSettled: boolean("is_settled").notNull().default(false),
  rawResponseJson: jsonb("raw_response_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_payments_sale").on(table.saleId),
  index("idx_payments_tenant").on(table.tenantId),
]);

export const COMMISSION_STATUS = {
  ACTIVE: "active",
  REVERSED: "reversed",
} as const;
export type CommissionStatusValue = typeof COMMISSION_STATUS[keyof typeof COMMISSION_STATUS];

export const PAYOUT_STATUS = {
  UNPAID: "unpaid",
  PAID: "paid",
} as const;
export type PayoutStatusValue = typeof PAYOUT_STATUS[keyof typeof PAYOUT_STATUS];

export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  saleId: integer("sale_id").notNull(),
  saleLineId: integer("sale_line_id"),
  ticketId: integer("ticket_id"),
  employeeId: integer("employee_id").notNull(),
  storeId: integer("store_id"),
  itemName: text("item_name").notNull(),
  commissionType: text("commission_type").notNull(),
  commissionBasisAmount: decimal("commission_basis_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  calculatedCommission: decimal("calculated_commission", { precision: 10, scale: 2 }).notNull().default("0.00"),
  finalCommission: decimal("final_commission", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isOverridden: boolean("is_overridden").notNull().default(false),
  overrideReason: text("override_reason"),
  overrideBy: integer("override_by"),
  overrideAt: timestamp("override_at"),
  status: text("status").notNull().default("active"),
  reversalOfId: integer("reversal_of_id"),
  reversalReason: text("reversal_reason"),
  payoutStatus: text("payout_status").notNull().default("unpaid"),
  payoutBatchId: integer("payout_batch_id"),
  paidAt: timestamp("paid_at"),
  paidByEmployeeId: integer("paid_by_employee_id"),
  payoutNotes: text("payout_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_commissions_tenant").on(table.tenantId),
  index("idx_commissions_sale").on(table.saleId),
  index("idx_commissions_employee").on(table.employeeId),
  index("idx_commissions_store").on(table.storeId),
  index("idx_commissions_payout_status").on(table.payoutStatus),
]);

export const insertCommissionSchema = createInsertSchema(commissions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

export const commissionPayoutBatches = pgTable("commission_payout_batches", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  employeeCount: integer("employee_count").notNull().default(0),
  lineCount: integer("line_count").notNull().default(0),
  totalPaid: decimal("total_paid", { precision: 10, scale: 2 }).notNull().default("0.00"),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
  paidByEmployeeId: integer("paid_by_employee_id").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_payout_batches_tenant").on(table.tenantId),
]);

export const insertCommissionPayoutBatchSchema = createInsertSchema(commissionPayoutBatches).omit({ id: true, createdAt: true });
export type InsertCommissionPayoutBatch = z.infer<typeof insertCommissionPayoutBatchSchema>;
export type CommissionPayoutBatch = typeof commissionPayoutBatches.$inferSelect;

export const repairTickets = pgTable("repair_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id"),
  ticketNumber: text("ticket_number").notNull(),
  customerId: integer("customer_id").notNull(),
  assignedEmployeeId: integer("assigned_employee_id"),
  status: text("status").notNull().default("new"),
  deviceType: text("device_type").notNull(),
  brand: text("brand"),
  model: text("model"),
  serialNumber: text("serial_number"),
  imei: text("imei"),
  issueDescription: text("issue_description").notNull(),
  intakeNotes: text("intake_notes"),
  estimateAmount: decimal("estimate_amount", { precision: 10, scale: 2 }),
  depositPaid: decimal("deposit_paid", { precision: 10, scale: 2 }).notNull().default("0"),
  discountType: text("discount_type"),
  discountValue: text("discount_value"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  discountReason: text("discount_reason"),
  discountAppliedById: integer("discount_applied_by_id"),
  discountAppliedAt: timestamp("discount_applied_at"),
  estimatedCompletionDate: timestamp("estimated_completion_date"),
  actualCompletionDate: timestamp("actual_completion_date"),
  pickedUpAt: timestamp("picked_up_at"),
  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_tickets_tenant").on(table.tenantId),
  index("idx_tickets_customer").on(table.customerId),
  index("idx_tickets_status").on(table.status),
  uniqueIndex("uq_tickets_tenant_number").on(table.tenantId, table.ticketNumber),
]);

export const ticketPayments = pgTable("ticket_payments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  saleId: integer("sale_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  cardUpliftAmount: decimal("card_uplift_amount", { precision: 10, scale: 2 }),
  totalCharged: decimal("total_charged", { precision: 10, scale: 2 }),
  paymentMethod: text("payment_method").notNull(),
  paymentType: text("payment_type").notNull(),
  status: text("status").notNull().default("completed"),
  reference: text("reference"),
  collectedById: integer("collected_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_ticket_payments_ticket").on(table.ticketId),
  index("idx_ticket_payments_tenant").on(table.tenantId),
]);

export const repairTicketNotes = pgTable("repair_ticket_notes", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  isCustomerFacing: boolean("is_customer_facing").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_ticket_notes_ticket").on(table.ticketId),
]);

export const repairPartUsage = pgTable("repair_part_usage", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  productId: integer("product_id"),
  customDescription: text("custom_description"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  unitCostSnapshot: decimal("unit_cost_snapshot", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_part_usage_ticket").on(table.ticketId),
]);

export const ticketInternalCosts = pgTable("ticket_internal_costs", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_internal_costs_ticket").on(table.ticketId),
]);

export const ticketLaborLines = pgTable("ticket_labor_lines", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_labor_lines_ticket").on(table.ticketId),
]);

export const taxRates = pgTable("tax_rates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  rate: decimal("rate", { precision: 5, scale: 4 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_tax_rates_tenant").on(table.tenantId),
]);

export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  recipientEmail: text("recipient_email").notNull(),
  senderEmail: text("sender_email"),
  emailType: text("email_type").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("sent"),
  providerMessageId: text("provider_message_id"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  sentAt: timestamp("sent_at").defaultNow(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  emailType: text("email_type").notNull(),
  scope: text("scope").notNull().default("platform"),
  tenantId: integer("tenant_id"),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body").notNull(),
  senderAddress: text("sender_address").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const platformBranding = pgTable("platform_branding", {
  id: serial("id").primaryKey(),
  logoUrl: text("logo_url"),
  companyName: text("company_name").notNull().default("PPD Repair"),
  footerContent: text("footer_content"),
  supportEmail: text("support_email").default("support@ppdrepair.com"),
  supportPhone: text("support_phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  store: one(stores, { fields: [users.storeId], references: [stores.id] }),
}));

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  stores: many(stores),
  users: many(users),
  settings: one(merchantSettings, { fields: [tenants.id], references: [merchantSettings.tenantId] }),
  subscription: one(subscriptions, { fields: [tenants.id], references: [subscriptions.tenantId] }),
  customers: many(customers),
  products: many(products),
  sales: many(sales),
  repairTickets: many(repairTickets),
  auditLogs: many(auditLogs),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  tenant: one(tenants, { fields: [stores.tenantId], references: [tenants.id] }),
  users: many(users),
  storeSettings: one(storeSettings, { fields: [stores.id], references: [storeSettings.storeId] }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  tenant: one(tenants, { fields: [sales.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  employee: one(users, { fields: [sales.employeeId], references: [users.id] }),
  items: many(saleItems),
  payments: many(payments),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  sale: one(sales, { fields: [payments.saleId], references: [sales.id] }),
}));

export const repairTicketsRelations = relations(repairTickets, ({ one, many }) => ({
  tenant: one(tenants, { fields: [repairTickets.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [repairTickets.customerId], references: [customers.id] }),
  assignedEmployee: one(users, { fields: [repairTickets.assignedEmployeeId], references: [users.id] }),
  notes: many(repairTicketNotes),
  partsUsed: many(repairPartUsage),
  laborLines: many(ticketLaborLines),
}));

export const repairTicketNotesRelations = relations(repairTicketNotes, ({ one }) => ({
  ticket: one(repairTickets, { fields: [repairTicketNotes.ticketId], references: [repairTickets.id] }),
  user: one(users, { fields: [repairTicketNotes.userId], references: [users.id] }),
}));

export const repairPartUsageRelations = relations(repairPartUsage, ({ one }) => ({
  ticket: one(repairTickets, { fields: [repairPartUsage.ticketId], references: [repairTickets.id] }),
  product: one(products, { fields: [repairPartUsage.productId], references: [products.id] }),
}));

export const ticketLaborLinesRelations = relations(ticketLaborLines, ({ one }) => ({
  ticket: one(repairTickets, { fields: [ticketLaborLines.ticketId], references: [repairTickets.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
  sales: many(sales),
  repairTickets: many(repairTickets),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  category: one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  inventoryUnits: many(inventoryUnits),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vendors.tenantId], references: [tenants.id] }),
  inventoryUnits: many(inventoryUnits),
}));

export const inventoryUnitsRelations = relations(inventoryUnits, ({ one }) => ({
  tenant: one(tenants, { fields: [inventoryUnits.tenantId], references: [tenants.id] }),
  product: one(products, { fields: [inventoryUnits.productId], references: [products.id] }),
  store: one(stores, { fields: [inventoryUnits.storeId], references: [stores.id] }),
  vendor: one(vendors, { fields: [inventoryUnits.vendorId], references: [vendors.id] }),
  sale: one(sales, { fields: [inventoryUnits.saleId], references: [sales.id] }),
}));

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [productCategories.tenantId], references: [tenants.id] }),
  products: many(products),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  tenant: one(tenants, { fields: [subscriptions.tenantId], references: [tenants.id] }),
  invoices: many(subscriptionInvoices),
  billingAssessments: many(billingAssessments),
}));

export const subscriptionInvoicesRelations = relations(subscriptionInvoices, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionInvoices.subscriptionId], references: [subscriptions.id] }),
  tenant: one(tenants, { fields: [subscriptionInvoices.tenantId], references: [tenants.id] }),
}));

export const agreementTemplatesRelations = relations(agreementTemplates, ({ one }) => ({
  createdBy: one(users, { fields: [agreementTemplates.createdById], references: [users.id] }),
}));

export const signedAgreementsRelations = relations(signedAgreements, ({ one }) => ({
  tenant: one(tenants, { fields: [signedAgreements.tenantId], references: [tenants.id] }),
  template: one(agreementTemplates, { fields: [signedAgreements.agreementTemplateId], references: [agreementTemplates.id] }),
  signedBy: one(users, { fields: [signedAgreements.signedByUserId], references: [users.id] }),
}));

export const billingAssessmentsRelations = relations(billingAssessments, ({ one }) => ({
  tenant: one(tenants, { fields: [billingAssessments.tenantId], references: [tenants.id] }),
  subscription: one(subscriptions, { fields: [billingAssessments.subscriptionId], references: [subscriptions.id] }),
}));

// ── Standardized Status Enums ──
// Single source of truth for all status values used across schema, routes, and frontend.

export const SALE_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  VOIDED: "voided",
  REFUNDED: "refunded",
  FAILED: "failed",
} as const;
export type SaleStatusValue = typeof SALE_STATUS[keyof typeof SALE_STATUS];

export const PAYMENT_STATUS = {
  PENDING: "pending",
  CAPTURED: "captured",
  FAILED: "failed",
  VOIDED: "voided",
  REFUNDED: "refunded",
} as const;
export type PaymentStatusValue = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

export const TICKET_STATUS = {
  NEW: "new",
  IN_PROGRESS: "in_progress",
  READY_FOR_PICKUP: "ready_for_pickup",
  PICKED_UP: "picked_up",
  CANCELLED: "cancelled",
} as const;
export type TicketStatusValue = typeof TICKET_STATUS[keyof typeof TICKET_STATUS];

export const TICKET_PAYMENT_TYPE = {
  DEPOSIT: "deposit",
  FINAL_PAYMENT: "final_payment",
} as const;
export type TicketPaymentTypeValue = typeof TICKET_PAYMENT_TYPE[keyof typeof TICKET_PAYMENT_TYPE];

export const PAYMENT_METHOD = {
  CASH: "cash",
  CARD: "card",
} as const;
export type PaymentMethodValue = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];

export const COMMISSION_TYPE = {
  NONE: "none",
  FLAT_AMOUNT: "flat_amount",
  PERCENT_OF_SALE: "percent_of_sale",
  PERCENT_OF_PROFIT: "percent_of_profit",
} as const;
export type CommissionTypeValue = typeof COMMISSION_TYPE[keyof typeof COMMISSION_TYPE];

export const INVENTORY_UNIT_STATUS = {
  IN_STOCK: "in_stock",
  RESERVED: "reserved",
  SOLD: "sold",
  RETURNED: "returned",
  DAMAGED: "damaged",
  TRANSFERRED: "transferred",
} as const;
export type InventoryUnitStatusValue = typeof INVENTORY_UNIT_STATUS[keyof typeof INVENTORY_UNIT_STATUS];

export const INVENTORY_UNIT_SOURCE = {
  VENDOR: "vendor",
  CUSTOMER_TRADE_IN: "customer_trade_in",
  CUSTOMER_PURCHASE: "customer_purchase",
  MANUAL: "manual",
  TRANSFER: "transfer",
} as const;
export type InventoryUnitSourceValue = typeof INVENTORY_UNIT_SOURCE[keyof typeof INVENTORY_UNIT_SOURCE];

export const TRANSFER_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
export type TransferStatusValue = typeof TRANSFER_STATUS[keyof typeof TRANSFER_STATUS];

export const TRANSFER_TYPE = {
  SERIALIZED: "serialized",
  STANDARD: "standard",
} as const;
export type TransferTypeValue = typeof TRANSFER_TYPE[keyof typeof TRANSFER_TYPE];

export const inventoryTransfers = pgTable("inventory_transfers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  fromStoreId: integer("from_store_id").notNull(),
  toStoreId: integer("to_store_id").notNull(),
  transferType: text("transfer_type").notNull().default("serialized"),
  productId: integer("product_id"),
  quantity: integer("quantity"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  initiatedById: integer("initiated_by_id").notNull(),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_inv_transfers_tenant").on(table.tenantId),
  index("idx_inv_transfers_from_store").on(table.fromStoreId),
  index("idx_inv_transfers_to_store").on(table.toStoreId),
]);

export const inventoryTransferItems = pgTable("inventory_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull(),
  inventoryUnitId: integer("inventory_unit_id").notNull(),
  productId: integer("product_id").notNull(),
  serialNumberSnapshot: text("serial_number_snapshot"),
  imeiSnapshot: text("imei_snapshot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_inv_transfer_items_transfer").on(table.transferId),
  index("idx_inv_transfer_items_unit").on(table.inventoryUnitId),
]);

// Allowed ticket status transitions: key = current status, value = array of allowed next statuses.
export const TICKET_TRANSITIONS: Record<string, string[]> = {
  [TICKET_STATUS.NEW]: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CANCELLED],
  [TICKET_STATUS.IN_PROGRESS]: [TICKET_STATUS.READY_FOR_PICKUP, TICKET_STATUS.CANCELLED],
  [TICKET_STATUS.READY_FOR_PICKUP]: [TICKET_STATUS.PICKED_UP, TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CANCELLED],
  [TICKET_STATUS.PICKED_UP]: [],
  [TICKET_STATUS.CANCELLED]: [],
  "waiting_on_parts": [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CANCELLED],
};

// ── Email Type Constants ──
export const EMAIL_TYPES = {
  MERCHANT_WELCOME: "merchant_welcome",
  USER_WELCOME: "user_welcome",
  PASSWORD_RESET: "password_reset",
  BILLING_RECEIPT: "billing_receipt",
  PAYMENT_FAILED: "payment_failed",
  ACCOUNT_LOCKED: "account_locked",
  PAYMENT_RECOVERED: "payment_recovered",
  TICKET_CREATED: "ticket_created",
  TICKET_STATUS_UPDATE: "ticket_status_update",
  READY_FOR_PICKUP: "ready_for_pickup",
  SALES_RECEIPT: "sales_receipt",
  TICKET_DEPOSIT_RECEIPT: "ticket_deposit_receipt",
  TICKET_FINAL_RECEIPT: "ticket_final_receipt",
  PICKUP_CONFIRMATION: "pickup_confirmation",
  TICKET_CANCELLED: "ticket_cancelled",
  TICKET_ESTIMATE: "ticket_estimate",
  REFUND_RECEIPT: "refund_receipt",
} as const;

export const PLATFORM_ONLY_EMAIL_TYPES = [
  EMAIL_TYPES.MERCHANT_WELCOME,
  EMAIL_TYPES.USER_WELCOME,
  EMAIL_TYPES.PASSWORD_RESET,
  EMAIL_TYPES.BILLING_RECEIPT,
  EMAIL_TYPES.PAYMENT_FAILED,
  EMAIL_TYPES.ACCOUNT_LOCKED,
  EMAIL_TYPES.PAYMENT_RECOVERED,
] as const;

export const MERCHANT_EDITABLE_EMAIL_TYPES = [
  EMAIL_TYPES.TICKET_CREATED,
  EMAIL_TYPES.TICKET_STATUS_UPDATE,
  EMAIL_TYPES.READY_FOR_PICKUP,
  EMAIL_TYPES.TICKET_DEPOSIT_RECEIPT,
  EMAIL_TYPES.TICKET_FINAL_RECEIPT,
  EMAIL_TYPES.PICKUP_CONFIRMATION,
  EMAIL_TYPES.TICKET_CANCELLED,
  EMAIL_TYPES.SALES_RECEIPT,
] as const;

// ── Insert schemas ──
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true });
export const insertMerchantSettingsSchema = createInsertSchema(merchantSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSaleItemSchema = createInsertSchema(saleItems).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRepairTicketSchema = createInsertSchema(repairTickets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTicketPaymentSchema = createInsertSchema(ticketPayments).omit({ id: true, createdAt: true });
export const insertRepairTicketNoteSchema = createInsertSchema(repairTicketNotes).omit({ id: true, createdAt: true });
export const insertRepairPartUsageSchema = createInsertSchema(repairPartUsage).omit({ id: true, createdAt: true });
export const insertTicketLaborLineSchema = createInsertSchema(ticketLaborLines).omit({ id: true, createdAt: true });
export const insertTicketInternalCostSchema = createInsertSchema(ticketInternalCosts).omit({ id: true, createdAt: true });
export const insertTaxRateSchema = createInsertSchema(taxRates).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionInvoiceSchema = createInsertSchema(subscriptionInvoices).omit({ id: true, createdAt: true });
export const insertBillingEventSchema = createInsertSchema(billingEvents).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({ id: true, createdAt: true });
export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({ id: true, createdAt: true });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlatformBrandingSchema = createInsertSchema(platformBranding).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStoreSettingsSchema = createInsertSchema(storeSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryUnitSchema = createInsertSchema(inventoryUnits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAgreementTemplateSchema = createInsertSchema(agreementTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSignedAgreementSchema = createInsertSchema(signedAgreements).omit({ id: true });
export const insertStoreBillingConfigSchema = createInsertSchema(storeBillingConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBillingAssessmentSchema = createInsertSchema(billingAssessments).omit({ id: true, createdAt: true });
export const insertBillingTransactionSchema = createInsertSchema(billingTransactions).omit({ id: true });
export const insertBillingAdjustmentSchema = createInsertSchema(billingAdjustments).omit({ id: true, createdAt: true });
export const insertPlatformSettingSchema = createInsertSchema(platformSettings).omit({ id: true, updatedAt: true });
export const insertInventoryTransferSchema = createInsertSchema(inventoryTransfers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryTransferItemSchema = createInsertSchema(inventoryTransferItems).omit({ id: true, createdAt: true });
export const insertStoreInventorySchema = createInsertSchema(storeInventory).omit({ id: true, updatedAt: true });

// ── Route-level Validation Schemas ──
// Used by routes to validate request bodies before processing.

export const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive().nullable().optional(),
    inventoryUnitId: z.number().int().positive().nullable().optional(),
    isManual: z.boolean().optional().default(false),
    description: z.string().optional(),
    cashUnitPrice: z.string().optional(),
    quantity: z.number().int().min(1).default(1),
    taxable: z.boolean().optional(),
    openPriceAmount: z.string().optional(),
    manualCost: z.string().optional(),
  })).min(1, "Cart must have at least one item"),
  customerId: z.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(["cash", "card"]),
  discountTotal: z.string().optional().default("0.00"),
  storeId: z.number().int().positive().nullable().optional(),
  terminalId: z.number().int().positive().nullable().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

const optStr = z.preprocess((v) => (v === null || v === "" ? undefined : v), z.string().optional());

export const createTicketSchema = z.object({
  customerId: z.number().int().positive(),
  deviceType: z.string().min(1, "Device type is required"),
  brand: optStr,
  model: optStr,
  serialNumber: optStr,
  imei: optStr,
  issueDescription: z.string().min(1, "Issue description is required"),
  intakeNotes: optStr,
  estimateAmount: optStr,
  estimatedCompletionDate: optStr,
  assignedEmployeeId: z.number().int().positive().nullable().optional(),
  storeId: z.number().int().positive().nullable().optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(["new", "in_progress", "ready_for_pickup", "picked_up", "cancelled"]).optional(),
  assignedEmployeeId: z.number().int().positive().nullable().optional(),
  estimateAmount: optStr,
  estimatedCompletionDate: optStr,
  intakeNotes: optStr,
  brand: optStr,
  model: optStr,
}).refine(data => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export const createInventoryTransferSchema = z.object({
  fromStoreId: z.number().int().positive(),
  toStoreId: z.number().int().positive(),
  unitIds: z.array(z.number().int().positive()).min(1, "At least one unit must be selected"),
  notes: z.string().optional(),
});

export const createStandardTransferSchema = z.object({
  fromStoreId: z.number().int().positive(),
  toStoreId: z.number().int().positive(),
  productId: z.number().int().positive(),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  notes: z.string().optional(),
});

export const createMerchantSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  monthlySoftwareFee: z.string().optional().default("30.00").refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Must be a valid non-negative amount"),
  minimumMonthlyCardVolume: z.string().optional().default("20000.00").refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Must be a valid non-negative amount"),
  belowThresholdFee: z.string().optional().default("30.00").refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Must be a valid non-negative amount"),
  billingStartDate: z.string().optional(),
  storeName: z.string().optional(),
  storeAddress: z.string().optional(),
  storeCity: z.string().optional(),
  storeState: z.string().optional(),
  storeZip: z.string().optional(),
  ownerFirstName: z.string().optional(),
  ownerLastName: z.string().optional(),
  ownerUsername: z.string().min(3, "Username must be at least 3 characters"),
  ownerPassword: z.string().min(8, "Password must be at least 8 characters"),
  dualPricingEnabled: z.boolean().optional().default(false),
  cardUpliftPercent: z.string().optional().default("3.50"),
});

export const updateSettingsSchema = z.object({
  tenantData: z.object({
    businessName: z.string().optional(),
    contactName: z.string().optional(),
    primaryEmail: z.string().email().optional(),
    primaryPhone: z.string().optional(),
  }).optional(),
  settingsData: z.object({
    dualPricingEnabled: z.boolean().optional(),
    cardUpliftPercent: z.string().optional(),
    cashLabel: z.string().optional(),
    cardLabel: z.string().optional(),
    emailReceiptsEnabled: z.boolean().optional(),
    repairStatusEmailsEnabled: z.boolean().optional(),
    senderName: z.string().optional(),
    senderEmail: z.string().optional(),
    spinEnabled: z.boolean().optional(),
    taxLabor: z.boolean().optional(),
    defaultEstimateTerms: z.string().optional(),
    logoUrl: z.string().optional(),
    footerText: z.string().optional(),
    ticketCommissionType: z.enum(["disabled", "flat_amount", "percent_of_profit"]).optional(),
    ticketCommissionValue: z.string().optional(),
    receiptShowLogo: z.boolean().optional(),
    receiptShowBusinessName: z.boolean().optional(),
    receiptShowStoreName: z.boolean().optional(),
    receiptShowAddress: z.boolean().optional(),
    receiptShowPhone: z.boolean().optional(),
    receiptShowEmailWebsite: z.boolean().optional(),
    receiptShowCustomerName: z.boolean().optional(),
    receiptShowCashierName: z.boolean().optional(),
    receiptShowTicketNumber: z.boolean().optional(),
    receiptShowSerialImei: z.boolean().optional(),
    receiptShowPricingMode: z.boolean().optional(),
    receiptShowDiscountLine: z.boolean().optional(),
    receiptShowTaxLine: z.boolean().optional(),
    receiptFooterText: z.string().max(200).nullable().optional(),
    receiptReturnPolicy: z.string().max(500).nullable().optional(),
    receiptWarrantyText: z.string().max(500).nullable().optional(),
  }).optional(),
}).refine(data => data.tenantData || data.settingsData, { message: "At least one of tenantData or settingsData must be provided" });

export const inventoryAdjustSchema = z.object({
  productId: z.number().int().positive(),
  quantityDelta: z.number().int().refine(v => v !== 0, "Quantity delta cannot be zero"),
  reason: z.string().optional(),
  storeId: z.number().int().positive().optional(),
});

export const voidSaleSchema = z.object({
  reason: z.string().min(1, "Void reason is required").default("No reason provided"),
});

export const createVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export const createInventoryUnitSchema = z.object({
  productId: z.number().int().positive(),
  storeId: z.number().int().positive().nullable().optional(),
  serialNumber: z.string().min(1).optional(),
  imei: z.string().min(1).optional(),
  condition: z.enum(["new", "used_like_new", "used_good", "used_fair", "used_poor", "refurbished"]).default("new"),
  sourceType: z.enum(["vendor", "customer_trade_in", "customer_purchase", "manual", "transfer"]).default("manual"),
  vendorId: z.number().int().positive().nullable().optional(),
  sourceNameSnapshot: z.string().optional(),
  acquisitionCost: z.string().default("0.00"),
  notes: z.string().optional(),
  commissionType: z.enum(["none", "flat_amount", "percent_of_profit"]).nullable().optional(),
  commissionValue: z.string().nullable().optional(),
}).refine(data => data.serialNumber || data.imei, { message: "At least one of serialNumber or imei is required" });

export const createAgreementTemplateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Agreement content is required"),
  version: z.number().int().positive().optional(),
});

export const updateAgreementTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export const signAgreementSchema = z.object({
  signedName: z.string().min(1, "Authorized signer name is required"),
  legalBusinessName: z.string().min(1, "Legal business name is required"),
  signerTitle: z.string().min(1, "Signer title is required"),
  signerEmail: z.string().email("Valid email is required").optional(),
  agreedToAgreement: z.literal(true, { errorMap: () => ({ message: "You must agree to the agreement" }) }),
  representedAuthorityToBind: z.literal(true, { errorMap: () => ({ message: "You must confirm authority to bind" }) }),
  consentedToElectronicRecords: z.literal(true, { errorMap: () => ({ message: "You must consent to electronic records" }) }),
  checkboxTimestamps: z.object({
    agreedToAgreement: z.string().optional(),
    representedAuthorityToBind: z.string().optional(),
    consentedToElectronicRecords: z.string().optional(),
  }).optional(),
  presentationEvidence: z.object({
    fullAgreementModalAvailable: z.boolean().optional(),
    pdfDownloadAvailable: z.boolean().optional(),
    agreementTextScrollable: z.boolean().optional(),
    scrolledToEnd: z.boolean().optional(),
  }).optional(),
  agreementTextHashDisplayed: z.string().min(1, "Agreement text hash is required"),
});

export const billingCardSchema = z.object({
  cardNumber: z.string().min(13).max(19),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(2025).max(2050),
  cvv: z.string().min(3).max(4),
  cardholderName: z.string().min(1, "Cardholder name is required"),
  billingFullName: z.string().min(1, "Billing name is required"),
  billingAddress1: z.string().min(1, "Billing address is required"),
  billingAddress2: z.string().optional().default(""),
  billingCity: z.string().min(1, "City is required"),
  billingState: z.string().min(1, "State is required"),
  billingZip: z.string().min(1, "ZIP code is required"),
  billingCountry: z.string().optional().default("US"),
});

export const updateBillingConfigSchema = z.object({
  monthlyFee: z.string().optional(),
  minimumMonthlyCardVolume: z.string().optional(),
  belowThresholdFee: z.string().optional(),
  billingEnabled: z.boolean().optional(),
  billingContactEmail: z.string().email().optional().or(z.literal("")),
  billingStatus: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export const adminTransactionFilterSchema = z.object({
  tenantId: z.number().int().positive().optional(),
  storeId: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentMethod: z.enum(["cash", "card"]).optional(),
  paymentStatus: z.string().optional(),
});

export const updateInventoryUnitSchema = z.object({
  storeId: z.number().int().positive().nullable().optional(),
  serialNumber: z.string().min(1).nullable().optional().transform(v => v === "" ? null : v),
  imei: z.string().min(1).nullable().optional().transform(v => v === "" ? null : v),
  condition: z.enum(["new", "used_like_new", "used_good", "used_fair", "used_poor", "refurbished"]).optional(),
  sourceType: z.enum(["vendor", "customer_trade_in", "customer_purchase", "manual", "transfer"]).optional(),
  vendorId: z.number().int().positive().nullable().optional(),
  sourceNameSnapshot: z.string().optional(),
  acquisitionCost: z.string().optional(),
  status: z.enum(["in_stock", "reserved", "sold", "returned", "damaged", "transferred"]).optional(),
  notes: z.string().optional(),
  commissionType: z.enum(["none", "flat_amount", "percent_of_profit"]).nullable().optional(),
  commissionValue: z.string().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { message: "At least one field must be provided" });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type MerchantSettings = typeof merchantSettings.$inferSelect;
export type InsertMerchantSettings = z.infer<typeof insertMerchantSettingsSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type RepairTicket = typeof repairTickets.$inferSelect;
export type InsertRepairTicket = z.infer<typeof insertRepairTicketSchema>;
export type TicketPayment = typeof ticketPayments.$inferSelect;
export type InsertTicketPayment = z.infer<typeof insertTicketPaymentSchema>;
export type RepairTicketNote = typeof repairTicketNotes.$inferSelect;
export type InsertRepairTicketNote = z.infer<typeof insertRepairTicketNoteSchema>;
export type RepairPartUsage = typeof repairPartUsage.$inferSelect;
export type InsertRepairPartUsage = z.infer<typeof insertRepairPartUsageSchema>;
export type TicketLaborLine = typeof ticketLaborLines.$inferSelect;
export type InsertTicketLaborLine = z.infer<typeof insertTicketLaborLineSchema>;
export type TicketInternalCost = typeof ticketInternalCosts.$inferSelect;
export type InsertTicketInternalCost = z.infer<typeof insertTicketInternalCostSchema>;
export type TaxRate = typeof taxRates.$inferSelect;
export type InsertTaxRate = z.infer<typeof insertTaxRateSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type SubscriptionInvoice = typeof subscriptionInvoices.$inferSelect;
export type InsertSubscriptionInvoice = z.infer<typeof insertSubscriptionInvoiceSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type PlatformBranding = typeof platformBranding.$inferSelect;
export type InsertPlatformBranding = z.infer<typeof insertPlatformBrandingSchema>;
export type StoreSettings = typeof storeSettings.$inferSelect;
export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type InventoryUnit = typeof inventoryUnits.$inferSelect;
export type InsertInventoryUnit = z.infer<typeof insertInventoryUnitSchema>;
export type AgreementTemplate = typeof agreementTemplates.$inferSelect;
export type InsertAgreementTemplate = z.infer<typeof insertAgreementTemplateSchema>;
export type SignedAgreement = typeof signedAgreements.$inferSelect;
export type InsertSignedAgreement = z.infer<typeof insertSignedAgreementSchema>;
export type StoreBillingConfig = typeof storeBillingConfigs.$inferSelect;
export type InsertStoreBillingConfig = z.infer<typeof insertStoreBillingConfigSchema>;
export type BillingAssessment = typeof billingAssessments.$inferSelect;
export type InsertBillingAssessment = z.infer<typeof insertBillingAssessmentSchema>;
export type BillingTransaction = typeof billingTransactions.$inferSelect;
export type InsertBillingTransaction = z.infer<typeof insertBillingTransactionSchema>;
export type BillingAdjustment = typeof billingAdjustments.$inferSelect;
export type InsertBillingAdjustment = z.infer<typeof insertBillingAdjustmentSchema>;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_password_reset_user").on(table.userId),
  index("idx_password_reset_expires").on(table.expiresAt),
]);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const userStoreAccess = pgTable("user_store_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  storeId: integer("store_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
}, (table) => [
  index("idx_usa_user").on(table.userId),
  index("idx_usa_store").on(table.storeId),
  index("idx_usa_tenant").on(table.tenantId),
  uniqueIndex("idx_usa_user_store").on(table.userId, table.storeId),
]);

export const insertUserStoreAccessSchema = createInsertSchema(userStoreAccess).omit({ id: true, grantedAt: true });
export type UserStoreAccess = typeof userStoreAccess.$inferSelect;
export type InsertUserStoreAccess = z.infer<typeof insertUserStoreAccessSchema>;

export type StoreInventory = typeof storeInventory.$inferSelect;
export type InsertStoreInventory = z.infer<typeof insertStoreInventorySchema>;
export type InventoryTransfer = typeof inventoryTransfers.$inferSelect;
export type InsertInventoryTransfer = z.infer<typeof insertInventoryTransferSchema>;
export type InventoryTransferItem = typeof inventoryTransferItems.$inferSelect;
export type InsertInventoryTransferItem = z.infer<typeof insertInventoryTransferItemSchema>;

export const SPIN_DEVICE_TYPES = ["P1", "P3", "P5", "P8", "P12", "P17"] as const;
export type SpinDeviceType = typeof SPIN_DEVICE_TYPES[number];

export const SPIN_TRANS_TYPES = {
  SALE: "Sale",
  RETURN: "Return",
  VOID: "Void",
  SETTLE: "Settle",
  BATCH_REPORT: "BatchReport",
  SUMMARY_REPORT: "SummaryReport",
  DAILY_REPORT: "DailyReport",
  STATUS_REQUEST: "StatusRequest",
  STATUS_LIST: "StatusList",
  ABORT: "Abort",
  CAPTURE: "Capture",
} as const;

export const spinConfigs = pgTable("spin_configs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id").notNull(),
  authKey: text("auth_key").notNull(),
  registerId: text("register_id").notNull(),
  spinUrl: text("spin_url").notNull().default("https://api.spinpos.net"),
  batchApiKey: text("batch_api_key"),
  batchSecretKey: text("batch_secret_key"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_spin_configs_tenant").on(table.tenantId),
  index("idx_spin_configs_store").on(table.storeId),
]);

export const insertSpinConfigSchema = createInsertSchema(spinConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export type SpinConfig = typeof spinConfigs.$inferSelect;
export type InsertSpinConfig = z.infer<typeof insertSpinConfigSchema>;

export const spinTerminals = pgTable("spin_terminals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id").notNull(),
  spinConfigId: integer("spin_config_id"),
  deviceName: text("device_name").notNull(),
  deviceType: text("device_type"),
  serialNumber: text("serial_number"),
  tpn: text("tpn").notNull(),
  authKey: text("auth_key").notNull().default(""),
  registerId: text("register_id").notNull().default(""),
  spinUrl: text("spin_url").notNull().default("https://api.spinpos.net"),
  notes: text("notes"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  lastStatusCheck: timestamp("last_status_check"),
  lastStatus: text("last_status"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_spin_terminals_tenant").on(table.tenantId),
  index("idx_spin_terminals_store").on(table.storeId),
]);

export const insertSpinTerminalSchema = createInsertSchema(spinTerminals).omit({ id: true, createdAt: true, updatedAt: true, lastStatusCheck: true, lastStatus: true, spinConfigId: true });
export type SpinTerminal = typeof spinTerminals.$inferSelect;
export type InsertSpinTerminal = z.infer<typeof insertSpinTerminalSchema>;

export const spinTransactions = pgTable("spin_transactions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id"),
  terminalId: integer("terminal_id"),
  saleId: integer("sale_id"),
  transType: text("trans_type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  refId: text("ref_id"),
  pnRef: text("pn_ref"),
  authCode: text("auth_code"),
  resultCode: text("result_code"),
  message: text("message"),
  respMsg: text("resp_msg"),
  paymentType: text("payment_type"),
  cardBrand: text("card_brand"),
  cardLast4: text("card_last4"),
  entryMode: text("entry_mode"),
  rawRequest: jsonb("raw_request"),
  rawResponse: jsonb("raw_response"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_spin_tx_tenant").on(table.tenantId),
  index("idx_spin_tx_store").on(table.storeId),
  index("idx_spin_tx_terminal").on(table.terminalId),
  index("idx_spin_tx_sale").on(table.saleId),
  index("idx_spin_tx_pnref").on(table.pnRef),
]);

export const insertSpinTransactionSchema = createInsertSchema(spinTransactions).omit({ id: true, createdAt: true });
export type SpinTransaction = typeof spinTransactions.$inferSelect;
export type InsertSpinTransaction = z.infer<typeof insertSpinTransactionSchema>;

export const batchReports = pgTable("batch_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id"),
  terminalId: integer("terminal_id"),
  tpn: text("tpn"),
  batchNumber: text("batch_number").notNull(),
  batchDate: text("batch_date").notNull(),
  settleDate: text("settle_date"),
  batchTotal: decimal("batch_total", { precision: 12, scale: 2 }),
  saleTotal: decimal("sale_total", { precision: 12, scale: 2 }),
  returnTotal: decimal("return_total", { precision: 12, scale: 2 }),
  voidTotal: decimal("void_total", { precision: 12, scale: 2 }),
  taxTotal: decimal("tax_total", { precision: 12, scale: 2 }),
  tipTotal: decimal("tip_total", { precision: 12, scale: 2 }),
  feeTotal: decimal("fee_total", { precision: 12, scale: 2 }),
  transactionCount: integer("transaction_count"),
  batchSummary: jsonb("batch_summary"),
  batchDetails: jsonb("batch_details"),
  settlementResponseJson: jsonb("settlement_response_json"),
  rawApiResponse: jsonb("raw_api_response"),
  status: text("status").notNull().default("fetched"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_batch_reports_tenant").on(table.tenantId),
  index("idx_batch_reports_terminal").on(table.terminalId),
  index("idx_batch_reports_batch").on(table.batchNumber, table.batchDate),
]);

export const insertBatchReportSchema = createInsertSchema(batchReports).omit({ id: true, createdAt: true, updatedAt: true });
export type BatchReport = typeof batchReports.$inferSelect;
export type InsertBatchReport = z.infer<typeof insertBatchReportSchema>;

export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  storeId: integer("store_id").notNull(),
  name: text("name").notNull(),
  defaultTerminalId: integer("default_terminal_id").references(() => spinTerminals.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_stations_tenant").on(table.tenantId),
  index("idx_stations_store").on(table.storeId),
  uniqueIndex("idx_stations_unique_name").on(table.tenantId, table.storeId, table.name),
]);

export const insertStationSchema = createInsertSchema(stations).omit({ id: true, createdAt: true });
export type Station = typeof stations.$inferSelect;
export type InsertStation = z.infer<typeof insertStationSchema>;
