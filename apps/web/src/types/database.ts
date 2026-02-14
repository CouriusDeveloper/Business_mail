/** Document classification types from AI pipeline */
export type DocumentType =
  | "incoming_invoice"
  | "outgoing_invoice"
  | "credit_note"
  | "contract"
  | "general_correspondence"
  | "irrelevant";

/** Inbox item processing status */
export type InboxItemStatus =
  | "processing"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "unclear"
  | "error";

/** Contact type */
export type ContactType = "supplier" | "customer" | "both";

/** Export target configuration */
export type ExportTarget = "datev" | "onedrive" | "both";

/** Export status tracking */
export type ExportStatus = "sent" | "failed" | "retry";

/** User role permissions */
export interface RolePermissions {
  can_approve: boolean;
  can_reject: boolean;
  can_edit_fields: boolean;
  can_export_config: boolean;
  can_manage_contacts: boolean;
  can_manage_users: boolean;
  can_manage_settings: boolean;
}

/** Notification preferences per user */
export interface NotificationPrefs {
  frequency: "immediate" | "digest_30min" | "daily";
  events: {
    new_items: boolean;
    due_date_reminders: boolean;
    unclear_items: boolean;
    processing_errors: boolean;
  };
}

/** Organization settings */
export interface OrganizationSettings {
  default_export_target: ExportTarget;
  notification_defaults: NotificationPrefs;
}

/** Extracted invoice data from AI pipeline */
export interface ExtractedInvoiceData {
  invoice_number?: string;
  invoice_date?: string;
  net_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  gross_amount?: number;
  supplier_name?: string;
  customer_name?: string;
  vat_id?: string;
  iban?: string;
  payment_terms?: string;
  due_date?: string;
  line_items?: ExtractedLineItem[];
}

/** Extracted line item */
export interface ExtractedLineItem {
  position: number;
  description: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
}

/** Per-field confidence scores */
export interface FieldConfidences {
  [fieldName: string]: number;
}

/** Audit log change tracking */
export interface AuditChanges {
  [fieldName: string]: {
    old: unknown;
    new: unknown;
  };
}

// ─── Database Row Types ──────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  inbox_email: string | null;
  ms365_tenant_id: string | null;
  ms365_access_token: string | null;
  ms365_refresh_token: string | null;
  ms365_token_expiry: string | null;
  ms365_connected_email: string | null;
  ms365_connected: boolean;
  graph_webhook_id: string | null;
  graph_webhook_expiry: string | null;
  settings: OrganizationSettings | null;
  created_at: string;
}

export interface Company {
  id: string;
  organization_id: string;
  name: string;
  tax_id: string | null;
  datev_upload_email: string | null;
  onedrive_folder_path: string | null;
  export_target: ExportTarget;
  filename_schema: string;
  settings: Record<string, unknown> | null;
  created_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  name: string | null;
  role_id: string | null;
  notification_prefs: NotificationPrefs | null;
  created_at: string;
}

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  permissions: RolePermissions;
  is_default: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  organization_id: string;
  company_id: string | null;
  name: string;
  type: ContactType;
  tax_id: string | null;
  iban: string | null;
  email_addresses: string[];
  notes: string | null;
  auto_created: boolean;
  created_at: string;
}

export interface InboxItem {
  id: string;
  organization_id: string;
  company_id: string | null;
  company_confidence: number | null;
  type: DocumentType;
  status: InboxItemStatus;
  email_message_id: string;
  email_conversation_id: string | null;
  email_subject: string | null;
  email_from: string | null;
  email_to: string | null;
  email_body: string | null;
  email_received_at: string | null;
  summary: string | null;
  overall_confidence: number | null;
  unclear_note: string | null;
  processed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  exported_at: string | null;
  created_at: string;
  // Joined relations
  company?: Company;
  documents?: Document[];
}

export interface Document {
  id: string;
  inbox_item_id: string;
  file_path: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  extracted_data: ExtractedInvoiceData | null;
  field_confidences: FieldConfidences | null;
  extraction_model: string | null;
  pages: number | null;
  created_at: string;
  // Joined relations
  line_items?: LineItem[];
}

export interface LineItem {
  id: string;
  document_id: string;
  position: number;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  confidence: number | null;
}

export interface ExportLog {
  id: string;
  inbox_item_id: string;
  company_id: string | null;
  export_target: string;
  export_status: ExportStatus;
  target_address: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: AuditChanges | null;
  created_at: string;
}
