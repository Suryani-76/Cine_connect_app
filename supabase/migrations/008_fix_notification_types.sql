-- ============================================================
-- CineConnect – Fix notifications.type CHECK constraint
-- Run after 007_email_notification_trigger.sql
--
-- ROLLBACK: alter table public.notifications drop constraint if exists
--           notifications_type_check;
-- ============================================================

-- The notifications table was created with a comment listing 3 types,
-- but no CHECK constraint was added. Two additional types are inserted
-- by triggers in migrations 006 and 007.
-- This migration adds a CHECK constraint that covers all 5 type values.

-- Types produced by triggers:
--   'new_application'       — trg_notify_new_application (005)
--   'new_message'           — trg_notify_new_message (005)
--   'high_match_talent'     — trg_notify_high_match (005)
--   'new_application'       — trg_notify_high_match (006, reused with match_type='talent_alert')
--   'new_application'       — trg_application_status_change (007, reused with match_type='status_change')
--
-- Distinct type VALUES actually inserted: new_application, new_message, high_match_talent
-- (Migration 007 reuses 'new_application' — comment explains it uses payload.match_type to distinguish)

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'new_application',
    'new_message',
    'high_match_talent'
  ));
