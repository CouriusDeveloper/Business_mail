-- ============================================================
-- Seed function: Create default roles for new organizations
-- Called during organization onboarding
-- ============================================================

CREATE OR REPLACE FUNCTION create_default_roles(org_id UUID)
RETURNS void AS $$
BEGIN
    -- Admin role
    INSERT INTO roles (organization_id, name, permissions, is_default)
    VALUES (
        org_id,
        'Admin',
        '{
            "can_approve": true,
            "can_reject": true,
            "can_edit_fields": true,
            "can_export_config": true,
            "can_manage_contacts": true,
            "can_manage_users": true,
            "can_manage_settings": true
        }',
        false
    );

    -- Sachbearbeiter (Clerk) role
    INSERT INTO roles (organization_id, name, permissions, is_default)
    VALUES (
        org_id,
        'Sachbearbeiter',
        '{
            "can_approve": true,
            "can_reject": true,
            "can_edit_fields": true,
            "can_export_config": false,
            "can_manage_contacts": false,
            "can_manage_users": false,
            "can_manage_settings": false
        }',
        true
    );

    -- Viewer role
    INSERT INTO roles (organization_id, name, permissions, is_default)
    VALUES (
        org_id,
        'Viewer',
        '{
            "can_approve": false,
            "can_reject": false,
            "can_edit_fields": false,
            "can_export_config": false,
            "can_manage_contacts": false,
            "can_manage_users": false,
            "can_manage_settings": false
        }',
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
