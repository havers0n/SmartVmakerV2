# Database Migrations

## Running Migrations

To apply migrations to your database:

```bash
# From packages/db directory
pnpm migrate:run
```

The script will automatically load `.env` from the project root.

## Requirements

Ensure `DATABASE_URL` is set in your `.env` file in the project root:

```bash
# .env (root of project)
DATABASE_URL="postgresql://user:pass@host:port/dbname"

# For Supabase (example):
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"
```

**Note:** For Supabase:
- Use the **Transaction** pooler connection string (port 5432)
- Get it from: Supabase Dashboard → Settings → Database → Connection string
- Format: `postgresql://postgres.[ref]:[password]@[host]:5432/postgres`

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
