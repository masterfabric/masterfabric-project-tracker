-- Revert to three-way status (fails if any row is revoked — resolve manually before down).
ALTER TABLE organization_invitations
    DROP CONSTRAINT IF EXISTS organization_invitations_status_check;

ALTER TABLE organization_invitations
    ADD CONSTRAINT organization_invitations_status_check
        CHECK (status IN ('pending', 'accepted', 'declined'));
