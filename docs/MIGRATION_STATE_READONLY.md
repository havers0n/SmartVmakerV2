# Read-only migration-state check

Do not run `pnpm db:migrate`, `pnpm db:migrate:run`, `drizzle-kit push`, or
`drizzle-kit introspect` against production for this check. Use a separately
provisioned database role with `CONNECT` and `SELECT` only.

```bash
psql "$READONLY_DATABASE_URL" -c \
  'SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at;'
```

Compare the returned hashes and timestamps with
`packages/db/migrations/meta/_journal.json` and the committed SQL files. The
repository cannot establish which migrations are live without that read-only
connection; no migration command is safe to substitute for this query.
