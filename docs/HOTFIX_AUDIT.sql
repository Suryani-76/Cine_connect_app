-- ==============================================================================
-- CineConnect — Hotfix Audit: Inspect Administrator Accounts
-- ==============================================================================
-- PURPOSE:
--   Lists every user account currently possessing role = 'admin'.
--   Review this list to verify that all admin users are authorized and intended.
--
-- DIRECTIVE:
--   READ-ONLY. This query performs no mutations.
--   DO NOT run automatically via automated scripts. Apply manually in psql
--   or the Supabase SQL editor.
-- ==============================================================================

SELECT 
    id, 
    email, 
    username, 
    role, 
    created_at
FROM 
    public.users
WHERE 
    role = 'admin'
ORDER BY 
    created_at ASC;
