/**
 * scripts/import-content.ts
 * ─────────────────────────
 * Idempotent CSV content importer for curated jobs and talent invitations.
 *
 * CRITICAL COMPLIANCE RULE (DPDP Act 2023 §6):
 * Never scrape or import personal data without verified prior consent.
 * Placeholder talent accounts will ONLY be created if `has_explicit_consent`
 * is explicitly true in the CSV record.
 *
 * Usage:
 *   npx tsx scripts/import-content.ts --jobs=seed/jobs.csv --dry-run
 *   npx tsx scripts/import-content.ts --invites=seed/invitations.csv
 */

import fs from 'fs';
import path from 'path';
import { supabase } from '../server/src/db/supabase';

interface JobRow {
  title: string;
  production_company: string;
  department: string;
  role: string;
  location: string;
  description: string;
  skills: string; // comma-separated
  experience_min?: string;
  budget_inr?: string;
}

interface TalentInviteRow {
  email: string;
  full_name: string;
  role: string;
  has_explicit_consent: string; // 'true' | 'false' | '1' | '0'
  invite_code?: string;
}

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

function getArgValue(flag: string): string | null {
  const arg = args.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.split('=')[1] : null;
}

function parseCSV<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple CSV parser supporting quoted commas
    const values: string[] = [];
    let insideQuotes = false;
    let currentVal = '';

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"' && (c === 0 || line[c - 1] !== '\\')) {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentVal.trim().replace(/^"|"$/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim().replace(/^"|"$/g, ''));

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push(rowObj as unknown as T);
  }
  return rows;
}

async function importJobs(filePath: string) {
  console.log(`\n📂 Loading jobs from: ${filePath} (Dry Run: ${isDryRun ? 'YES' : 'NO'})`);
  const rows = parseCSV<JobRow>(filePath);
  console.log(`Parsed ${rows.length} job records.`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    if (!row.title || !row.department || !row.role) {
      console.warn(`[WARN] Skipping invalid job row (missing required fields): ${JSON.stringify(row)}`);
      skippedCount++;
      continue;
    }

    // Check idempotency: does job title + department already exist?
    const { data: existing } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('title', row.title.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[SKIP] Job already exists: "${row.title}" (ID: ${existing[0].id})`);
      skippedCount++;
      continue;
    }

    const skillsArray = row.skills
      ? row.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const jobRecord = {
      title: row.title.trim(),
      department: row.department.trim(),
      role: row.role.trim(),
      location: row.location?.trim() || 'Mumbai, Maharashtra',
      description: row.description?.trim() || 'Film production position.',
      skills: skillsArray,
      experience_min: parseInt(row.experience_min || '1', 10),
      budget_inr: row.budget_inr ? parseInt(row.budget_inr, 10) : null,
      status: 'published',
    };

    if (isDryRun) {
      console.log(`[DRY-RUN] Would insert job: "${jobRecord.title}" in ${jobRecord.department}`);
      insertedCount++;
    } else {
      const { error } = await supabase.from('jobs').insert(jobRecord);
      if (error) {
        console.error(`[ERROR] Failed to insert job "${row.title}":`, error.message);
      } else {
        console.log(`[OK] Inserted job: "${jobRecord.title}"`);
        insertedCount++;
      }
    }
  }

  console.log(`Job Import Summary: ${insertedCount} inserted/would insert, ${skippedCount} skipped.`);
}

async function importInvitations(filePath: string) {
  console.log(`\n📂 Loading invitations from: ${filePath} (Dry Run: ${isDryRun ? 'YES' : 'NO'})`);
  const rows = parseCSV<TalentInviteRow>(filePath);
  console.log(`Parsed ${rows.length} talent invitation records.`);

  let insertedCount = 0;
  let skippedConsentCount = 0;
  let skippedExistingCount = 0;

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !row.role) {
      console.warn(`[WARN] Skipping row without email or role: ${JSON.stringify(row)}`);
      continue;
    }

    // MANDATORY COMPLIANCE CHECK: Explicit Prior Consent
    const consent = (row.has_explicit_consent || '').trim().toLowerCase();
    const hasConsent = consent === 'true' || consent === '1' || consent === 'yes';

    if (!hasConsent) {
      console.warn(
        `[LEGAL BLOCKED] Skipping "${email}": DPDP Act 2023 §6 prohibits creating placeholder profiles or processing personal data without explicit prior consent.`
      );
      skippedConsentCount++;
      continue;
    }

    const code = row.invite_code?.trim() || `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Idempotency: Check if invite code or email already exists
    const { data: existing } = await supabase
      .from('invite_codes')
      .select('id, code')
      .eq('code', code)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[SKIP] Invite code already exists: ${code}`);
      skippedExistingCount++;
      continue;
    }

    if (isDryRun) {
      console.log(`[DRY-RUN] Would create claimable invite: ${code} for ${email} (${row.role})`);
      insertedCount++;
    } else {
      const { error } = await supabase.from('invite_codes').insert({
        code,
        role: row.role.trim(),
        max_uses: 1,
        times_used: 0,
        is_active: true,
      });

      if (error) {
        console.error(`[ERROR] Failed to insert invite code ${code}:`, error.message);
      } else {
        console.log(`[OK] Created invite code ${code} for ${email}`);
        insertedCount++;
      }
    }
  }

  console.log(
    `Talent Invitation Summary: ${insertedCount} created/would create, ${skippedExistingCount} existing, ${skippedConsentCount} blocked for lack of consent.`
  );
}

async function main() {
  console.log('=== CineConnect Seed & Launch Content Importer ===');

  const jobsFile = getArgValue('jobs');
  const invitesFile = getArgValue('invites');

  if (!jobsFile && !invitesFile) {
    console.log(`
Usage:
  npx tsx scripts/import-content.ts --jobs=<path-to-jobs.csv> [--dry-run]
  npx tsx scripts/import-content.ts --invites=<path-to-invites.csv> [--dry-run]
    `);
    process.exit(0);
  }

  if (jobsFile) await importJobs(jobsFile);
  if (invitesFile) await importInvitations(invitesFile);

  console.log('\nImport process completed.');
}

main().catch((err) => {
  console.error('[FATAL] Importer crashed:', err);
  process.exit(1);
});
