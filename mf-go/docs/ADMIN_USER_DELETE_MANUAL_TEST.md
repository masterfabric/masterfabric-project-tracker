# Manual test: admin user delete + data cascade

PostgreSQL foreign keys already remove (or null) dependent rows when a user is deleted (`001_init_schema.up.sql`, `002_user_sessions.up.sql`, `003_user_messages.up.sql`). The GraphQL query `adminUserDeletionImpact` summarizes counts for admins; `adminDeleteUser` runs `DELETE FROM users` and publishes `iam.user.deleted` (same payload shape as self-service `deleteAccount`).

## Scenario (Expo + mf-go)

1. **Start backend**  
   Run mf-go with a reachable Postgres (e.g. `make docker-up` then `make run` from `mf-go`).

2. **Create a normal user**  
   Register/sign up as a non-admin user (e.g. `user+a@test.com`). Note their email/password.

3. **Sign in as that user**  
   In mf-expo, log in.

4. **Add todos**  
   Create several todos on **My Todos** (synced todos if signed in).

5. **Join or create “MasterFabric” organization**  
   - If your app flow creates an org named MasterFabric, use that; or create any org and add this user as a member (invite/accept as implemented in your build).  
   - Optional: create todos linked to that organization if your UI supports `organizationId`.

6. **Sign out; sign in as admin**  
   Use an `ADMIN` account. Open **Settings → User Management** (`/admin-user-management`).

7. **Inspect user (optional)**  
   Tap the **person** icon on the test user row. A full-height bottom sheet loads `adminUser` + **`adminUserOwnedTodos`**; you can toggle complete or delete todos as admin.

8. **Delete the test user**  
   Tap the trash icon on the test user row.  
   - Confirm the sheet lists **owned todos**, **organization memberships**, and any **owned organizations** (whole org removed if they are owner).  
   - Confirm delete.

9. **Verify**  
   - User no longer appears in admin list.  
   - Attempting to log in as the deleted user fails.  
   - Optional: in Postgres, `SELECT * FROM users WHERE email = '…'` returns no row; `user_todos`, `organization_members`, etc. have no orphaned rows referencing that `id`.

## Scenario (GraphQL only)

Use Insomnia/Postman against `/graphql` with an **admin** Bearer token.

1. `register` / `login` as user A → save `accessToken` and `user.id`.  
2. As user A: `createTodo` (and optionally org APIs).  
3. `login` as admin → `adminUserDeletionImpact(id: "<user A uuid>")` → inspect counts.  
4. `adminDeleteUser(id: "<user A uuid>")` → `true`.  
5. `adminUser(id: "<user A uuid>")` → should error (user not found).

## Notes

- **Owner deletes org**: `organizations.owner_user_id` is `ON DELETE CASCADE`, so deleting the **owner** user deletes the **entire organization** and related `organization_members` / invitations; other members lose that org.  
- **Assignee**: `user_todos.assigned_to_user_id` is `ON DELETE SET NULL` — other users’ todos keep the row but lose the assignee.  
- Admins **cannot** delete their own account via `adminDeleteUser` (`ADMIN_CANNOT_DELETE_SELF`).
