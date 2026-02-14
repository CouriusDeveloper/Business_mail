-- ============================================================
-- Business Inbox Agent - Initial Database Schema
-- Version: MVP 0.3
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Organizations (SaaS-Mandanten) ──────────────────────────

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    inbox_email     TEXT,
    ms365_tenant_id TEXT,
    graph_webhook_id TEXT,
    graph_webhook_expiry TIMESTAMPTZ,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ─── Companies (Unternehmen pro Mandant) ─────────────────────

CREATE TABLE companies (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    tax_id              TEXT,
    datev_upload_email  TEXT,
    onedrive_folder_path TEXT,
    export_target       TEXT NOT NULL DEFAULT 'datev'
                        CHECK (export_target IN ('datev', 'onedrive', 'both')),
    filename_schema     TEXT DEFAULT '{type}_{date}_{supplier}_{amount}',
    settings            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_companies_org ON companies(organization_id);

-- ─── Roles ───────────────────────────────────────────────────

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    permissions     JSONB NOT NULL DEFAULT '{
        "can_approve": false,
        "can_reject": false,
        "can_edit_fields": false,
        "can_export_config": false,
        "can_manage_contacts": false,
        "can_manage_users": false,
        "can_manage_settings": false
    }',
    is_default      BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_roles_org ON roles(organization_id);

-- ─── Users ───────────────────────────────────────────────────

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    name                TEXT,
    role_id             UUID REFERENCES roles(id) ON DELETE SET NULL,
    notification_prefs  JSONB DEFAULT '{
        "frequency": "immediate",
        "events": {
            "new_items": true,
            "due_date_reminders": true,
            "unclear_items": true,
            "processing_errors": true
        }
    }',
    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- ─── Contacts (Lieferanten/Kunden-Stammdaten) ───────────────

CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'supplier'
                    CHECK (type IN ('supplier', 'customer', 'both')),
    tax_id          TEXT,
    iban            TEXT,
    email_addresses TEXT[] DEFAULT '{}',
    notes           TEXT,
    auto_created    BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_name ON contacts(organization_id, name);

-- ─── Inbox Items ─────────────────────────────────────────────

CREATE TABLE inbox_items (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    company_id              UUID REFERENCES companies(id) ON DELETE SET NULL,
    company_confidence      DECIMAL(3,2),
    type                    TEXT NOT NULL DEFAULT 'general_correspondence'
                            CHECK (type IN (
                                'incoming_invoice', 'outgoing_invoice',
                                'credit_note', 'contract',
                                'general_correspondence', 'irrelevant'
                            )),
    status                  TEXT NOT NULL DEFAULT 'processing'
                            CHECK (status IN (
                                'processing', 'ready_for_review', 'approved',
                                'rejected', 'unclear', 'error'
                            )),
    email_message_id        TEXT UNIQUE,
    email_conversation_id   TEXT,
    email_subject           TEXT,
    email_from              TEXT,
    email_to                TEXT,
    email_body              TEXT,
    email_received_at       TIMESTAMPTZ,
    summary                 TEXT,
    overall_confidence      DECIMAL(3,2),
    unclear_note            TEXT,
    processed_at            TIMESTAMPTZ,
    approved_at             TIMESTAMPTZ,
    approved_by             UUID REFERENCES users(id) ON DELETE SET NULL,
    exported_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_inbox_org ON inbox_items(organization_id);
CREATE INDEX idx_inbox_status ON inbox_items(organization_id, status);
CREATE INDEX idx_inbox_type ON inbox_items(organization_id, type);
CREATE INDEX idx_inbox_company ON inbox_items(company_id);
CREATE INDEX idx_inbox_email_msg ON inbox_items(email_message_id);
CREATE INDEX idx_inbox_received ON inbox_items(organization_id, email_received_at DESC);

-- ─── Documents ───────────────────────────────────────────────

CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inbox_item_id       UUID NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    file_path           TEXT NOT NULL,
    file_name           TEXT,
    file_type           TEXT,
    file_size           INTEGER,
    extracted_data      JSONB,
    field_confidences   JSONB,
    extraction_model    TEXT,
    pages               INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_documents_inbox ON documents(inbox_item_id);

-- ─── Line Items (Rechnungspositionen) ────────────────────────

CREATE TABLE line_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,
    description     TEXT,
    quantity        DECIMAL,
    unit_price      DECIMAL,
    total_price     DECIMAL,
    confidence      DECIMAL(3,2),
    UNIQUE(document_id, position)
);

CREATE INDEX idx_line_items_doc ON line_items(document_id);

-- ─── Draft Replies (Phase 2, table created now for schema completeness) ──

CREATE TABLE draft_replies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inbox_item_id   UUID NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    draft_body      TEXT,
    approved_body   TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'sent')),
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_draft_replies_inbox ON draft_replies(inbox_item_id);

-- ─── Export Log ──────────────────────────────────────────────

CREATE TABLE export_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inbox_item_id   UUID NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
    export_target   TEXT NOT NULL
                    CHECK (export_target IN ('datev_upload_mail', 'onedrive')),
    export_status   TEXT NOT NULL DEFAULT 'sent'
                    CHECK (export_status IN ('sent', 'failed', 'retry')),
    target_address  TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_export_log_inbox ON export_log(inbox_item_id);
CREATE INDEX idx_export_log_status ON export_log(export_status);

-- ─── Audit Log ───────────────────────────────────────────────

CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    changes         JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_audit_org ON audit_log(organization_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(organization_id, created_at DESC);
