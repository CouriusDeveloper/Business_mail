-- ============================================================
-- Row Level Security Policies for Multi-Tenancy
-- All tables are scoped to the user's organization
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ─── Helper function: get current user's organization ────────

CREATE OR REPLACE FUNCTION public.user_organization_id()
RETURNS UUID AS $$
    SELECT organization_id
    FROM users
    WHERE id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Organizations ───────────────────────────────────────────

CREATE POLICY "Users can view their own organization"
    ON organizations FOR SELECT
    USING (id = public.user_organization_id());

CREATE POLICY "Admins can update their own organization"
    ON organizations FOR UPDATE
    USING (id = public.user_organization_id())
    WITH CHECK (id = public.user_organization_id());

-- ─── Companies ───────────────────────────────────────────────

CREATE POLICY "Users can view companies in their org"
    ON companies FOR SELECT
    USING (organization_id = public.user_organization_id());

CREATE POLICY "Users can insert companies in their org"
    ON companies FOR INSERT
    WITH CHECK (organization_id = public.user_organization_id());

CREATE POLICY "Users can update companies in their org"
    ON companies FOR UPDATE
    USING (organization_id = public.user_organization_id())
    WITH CHECK (organization_id = public.user_organization_id());

CREATE POLICY "Users can delete companies in their org"
    ON companies FOR DELETE
    USING (organization_id = public.user_organization_id());

-- ─── Roles ───────────────────────────────────────────────────

CREATE POLICY "Users can view roles in their org"
    ON roles FOR SELECT
    USING (organization_id = public.user_organization_id());

CREATE POLICY "Admins can manage roles in their org"
    ON roles FOR ALL
    USING (organization_id = public.user_organization_id())
    WITH CHECK (organization_id = public.user_organization_id());

-- ─── Users ───────────────────────────────────────────────────

CREATE POLICY "Users can view users in their org"
    ON users FOR SELECT
    USING (organization_id = public.user_organization_id());

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage users in their org"
    ON users FOR INSERT
    WITH CHECK (organization_id = public.user_organization_id());

-- ─── Contacts ────────────────────────────────────────────────

CREATE POLICY "Users can view contacts in their org"
    ON contacts FOR SELECT
    USING (organization_id = public.user_organization_id());

CREATE POLICY "Users can insert contacts in their org"
    ON contacts FOR INSERT
    WITH CHECK (organization_id = public.user_organization_id());

CREATE POLICY "Users can update contacts in their org"
    ON contacts FOR UPDATE
    USING (organization_id = public.user_organization_id())
    WITH CHECK (organization_id = public.user_organization_id());

CREATE POLICY "Users can delete contacts in their org"
    ON contacts FOR DELETE
    USING (organization_id = public.user_organization_id());

-- ─── Inbox Items ─────────────────────────────────────────────

CREATE POLICY "Users can view inbox items in their org"
    ON inbox_items FOR SELECT
    USING (organization_id = public.user_organization_id());

CREATE POLICY "Service role can insert inbox items"
    ON inbox_items FOR INSERT
    WITH CHECK (organization_id = public.user_organization_id());

CREATE POLICY "Users can update inbox items in their org"
    ON inbox_items FOR UPDATE
    USING (organization_id = public.user_organization_id())
    WITH CHECK (organization_id = public.user_organization_id());

-- ─── Documents ───────────────────────────────────────────────

CREATE POLICY "Users can view documents via inbox items"
    ON documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM inbox_items
            WHERE inbox_items.id = documents.inbox_item_id
            AND inbox_items.organization_id = public.user_organization_id()
        )
    );

CREATE POLICY "Service role can insert documents"
    ON documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM inbox_items
            WHERE inbox_items.id = documents.inbox_item_id
            AND inbox_items.organization_id = public.user_organization_id()
        )
    );

CREATE POLICY "Users can update documents in their org"
    ON documents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM inbox_items
            WHERE inbox_items.id = documents.inbox_item_id
            AND inbox_items.organization_id = public.user_organization_id()
        )
    );

-- ─── Line Items ──────────────────────────────────────────────

CREATE POLICY "Users can view line items via documents"
    ON line_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN inbox_items ON inbox_items.id = documents.inbox_item_id
            WHERE documents.id = line_items.document_id
            AND inbox_items.organization_id = public.user_organization_id()
        )
    );

-- ─── Draft Replies ───────────────────────────────────────────

CREATE POLICY "Users can view draft replies in their org"
    ON draft_replies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM inbox_items
            WHERE inbox_items.id = draft_replies.inbox_item_id
            AND inbox_items.organization_id = public.user_organization_id()
        )
    );

-- ─── Export Log ──────────────────────────────────────────────

CREATE POLICY "Users can view export logs in their org"
    ON export_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM inbox_items
            WHERE inbox_items.id = export_log.inbox_item_id
            AND inbox_items.organization_id = public.user_organization_id()
        )
    );

-- ─── Audit Log ───────────────────────────────────────────────

CREATE POLICY "Users can view audit logs in their org"
    ON audit_log FOR SELECT
    USING (organization_id = public.user_organization_id());

CREATE POLICY "System can insert audit logs"
    ON audit_log FOR INSERT
    WITH CHECK (organization_id = public.user_organization_id());
