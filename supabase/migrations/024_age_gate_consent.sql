-- ============================================================
-- CineConnect – Migration 024: Statutory Age Gate (DPDP Act 2023 §9)
--
-- Adds age_confirmed column to user_consents table to ensure
-- verifiable record that the registrant is 18 years of age or older.
-- Child talent onboarding is deferred pending legal guardian workflow design.
-- ============================================================

ALTER TABLE public.user_consents
  ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT true;
