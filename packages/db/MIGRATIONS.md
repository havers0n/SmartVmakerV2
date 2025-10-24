# Database Migrations

## Running Migrations

To apply migrations to your database:

```bash
# From packages/db directory
pnpm migrate:run
```

## Requirements

Ensure `DATABASE_URL` environment variable is set:

```bash
export DATABASE_URL="postgresql://user:pass@host:port/dbname"
```

For SSL connections (e.g., Supabase), the connection will use `ssl: { rejectUnauthorized: false }` in production.

## Generated Migrations

- `0000_medical_nicolaos.sql` - Initial schema
- `0001_panoramic_tinkerer.sql` - HWAR tables (scenarios, harvests)

## Manual Migration (if migrate:run fails)

You can also apply migrations manually by running the SQL files in order:

```bash
psql $DATABASE_URL -f migrations/0000_medical_nicolaos.sql
psql $DATABASE_URL -f migrations/0001_panoramic_tinkerer.sql
```
