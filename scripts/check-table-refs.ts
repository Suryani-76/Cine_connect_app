#!/usr/bin/env tsx
/**
 * scripts/check-table-refs.ts
 *
 * Verifies that every database table referenced via Supabase query builder (.from("..."))
 * in `server/src/` and `scripts/` actually exists in `supabase/migrations/*.sql`.
 * Ignores Supabase Storage bucket access (.storage.from("...")).
 *
 * Exits with code 1 if any unmigrated/phantom table references are detected.
 */

import fs from 'fs'
import path from 'path'

const ROOT_DIR = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase', 'migrations')
const SERVER_SRC_DIR = path.join(ROOT_DIR, 'server', 'src')
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts')

function getMigrationTables(): Set<string> {
  const tables = new Set<string>()
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found at ${MIGRATIONS_DIR}`)
    process.exit(1)
  }

  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'))
  const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi

  for (const file of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, file)
    const content = fs.readFileSync(filePath, 'utf8')
    let match: RegExpExecArray | null
    while ((match = createTableRegex.exec(content)) !== null) {
      tables.add(match[1].toLowerCase())
    }
  }

  return tables
}

function findTsFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        results.push(...findTsFiles(fullPath))
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      // Exclude this script itself
      if (fullPath === __filename) continue
      results.push(fullPath)
    }
  }
  return results
}

interface TableReference {
  table: string
  file: string
  line: number
}

function scanTableReferences(files: string[]): TableReference[] {
  const references: TableReference[] = []
  // Matches .from('table_name') or .from("table_name"), but not .storage.from(...)
  const fromRegex = /(?<!\.storage)\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]
      // Skip commented-out lines
      const trimmed = lineText.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue

      let match: RegExpExecArray | null
      while ((match = fromRegex.exec(lineText)) !== null) {
        references.push({
          table: match[1].toLowerCase(),
          file: path.relative(ROOT_DIR, file),
          line: i + 1,
        })
      }
    }
  }

  return references
}

export function checkTableRefs(): { valid: boolean; errors: string[] } {
  const migrationTables = getMigrationTables()
  const codeFiles = [...findTsFiles(SERVER_SRC_DIR), ...findTsFiles(SCRIPTS_DIR)]
  const references = scanTableReferences(codeFiles)

  const errors: string[] = []
  const uniqueCodeTables = new Set<string>()

  for (const ref of references) {
    uniqueCodeTables.add(ref.table)
    if (!migrationTables.has(ref.table)) {
      errors.push(
        `Phantom table reference: "${ref.table}" in ${ref.file}:${ref.line} (no matching migration in supabase/migrations/)`
      )
    }
  }

  console.log(`[check-table-refs] Migrated tables found (${migrationTables.size}): ${Array.from(migrationTables).sort().join(', ')}`)
  console.log(`[check-table-refs] Tables referenced in code (${uniqueCodeTables.size}): ${Array.from(uniqueCodeTables).sort().join(', ')}`)

  if (errors.length > 0) {
    console.error('\n❌ Unmigrated or phantom table references detected:')
    for (const err of errors) {
      console.error(`   - ${err}`)
    }
    return { valid: false, errors }
  }

  console.log('\n✅ All database table references correspond to existing migrations.')
  return { valid: true, errors: [] }
}

if (require.main === module || process.argv[1] === __filename) {
  const result = checkTableRefs()
  if (!result.valid) {
    process.exit(1)
  }
}
