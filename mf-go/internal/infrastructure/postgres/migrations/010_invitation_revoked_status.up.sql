-- Allow organization invitations to be revoked by org admin/owner (GFG-22).
ALTER TABLE organization_invitations
    DROP CONSTRAINT IF EXISTS organization_invitations_status_check;

ALTER TABLE organization_invitations
    ADD CONSTRAINT organization_invitations_status_check
        CHECK (status IN ('pending', 'accepted', 'declined', 'revoked'));
