/**
 * Custom Database Introspection Script
 * Generates Drizzle schema files from live Supabase database
 */

import { Pool } from 'pg';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

dotenvConfig({ path: resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  udt_name: string;
}

interface TableInfo {
  table_schema: string;
  table_name: string;
}

interface EnumInfo {
  type_name: string;
  enum_values: string[];
}

function mapPostgresTypeToDrizzle(dataType: string, udtName: string, isNullable: boolean): string {
  const nullable = isNullable ? '' : '.notNull()';

  switch (dataType) {
    case 'uuid':
      return `uuid('${udtName}')${nullable}`;
    case 'text':
    case 'character varying':
      return `text('${udtName}')${nullable}`;
    case 'integer':
      return `integer('${udtName}')${nullable}`;
    case 'bigint':
      return `bigint('${udtName}', { mode: 'number' })${nullable}`;
    case 'timestamp with time zone':
      return `timestamp('${udtName}', { withTimezone: true })${nullable}`;
    case 'timestamp without time zone':
      return `timestamp('${udtName}')${nullable}`;
    case 'boolean':
      return `boolean('${udtName}')${nullable}`;
    case 'jsonb':
      return `jsonb('${udtName}')${nullable}`;
    case 'json':
      return `json('${udtName}')${nullable}`;
    case 'numeric':
    case 'decimal':
      return `numeric('${udtName}')${nullable}`;
    case 'real':
    case 'double precision':
      return `real('${udtName}')${nullable}`;
    case 'ARRAY':
      return `text('${udtName}')${nullable}.$type<string[]>()`;
    case 'USER-DEFINED':
      // Enum type
      return `text('${udtName}')${nullable}`;
    default:
      return `text('${udtName}')${nullable}`;
  }
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function introspectDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔍 Introspecting database...\n');

    // Get all user tables (exclude system schemas)
    const { rows: tables } = await client.query<TableInfo>(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast', '_realtime', 'realtime', 'storage', 'vault', 'extensions', 'graphql', 'graphql_public', 'net', 'pgsodium', 'pgsodium_masks', 'pgtle', 'repack', 'tiger', 'tiger_data', 'topology', 'drizzle')
      ORDER BY table_schema, table_name
    `);

    console.log(`Found ${tables.length} tables across schemas\n`);

    // Group tables by schema
    const schemaGroups = tables.reduce((acc, table) => {
      if (!acc[table.table_schema]) {
        acc[table.table_schema] = [];
      }
      acc[table.table_schema].push(table.table_name);
      return acc;
    }, {} as Record<string, string[]>);

    // Process each schema
    for (const [schemaName, tableNames] of Object.entries(schemaGroups)) {
      console.log(`📁 Processing schema: ${schemaName}`);
      console.log(`   Tables: ${tableNames.join(', ')}\n`);

      const schemaImports = new Set<string>(['pgTable']);
      const schemaTables: string[] = [];

      for (const tableName of tableNames) {
        // Get columns for this table
        const { rows: columns } = await client.query<ColumnInfo>(`
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            udt_name
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
          ORDER BY ordinal_position
        `, [schemaName, tableName]);

        const tableVarName = toCamelCase(tableName);
        const tableColumns: string[] = [];

        for (const col of columns) {
          const colName = col.column_name;
          const isNullable = col.is_nullable === 'YES';

          // Determine Drizzle type
          let drizzleType = mapPostgresTypeToDrizzle(col.data_type, colName, isNullable);

          // Add imports
          if (col.data_type === 'uuid') schemaImports.add('uuid');
          if (col.data_type === 'text' || col.data_type === 'character varying') schemaImports.add('text');
          if (col.data_type === 'integer') schemaImports.add('integer');
          if (col.data_type === 'bigint') schemaImports.add('bigint');
          if (col.data_type.includes('timestamp')) schemaImports.add('timestamp');
          if (col.data_type === 'boolean') schemaImports.add('boolean');
          if (col.data_type === 'jsonb') schemaImports.add('jsonb');
          if (col.data_type === 'json') schemaImports.add('json');
          if (col.data_type === 'numeric' || col.data_type === 'decimal') schemaImports.add('numeric');
          if (col.data_type === 'real' || col.data_type === 'double precision') schemaImports.add('real');

          // Handle defaults
          if (col.column_default) {
            if (col.column_default.includes('gen_random_uuid()')) {
              drizzleType += '.defaultRandom()';
            } else if (col.column_default.includes('now()')) {
              drizzleType += '.defaultNow()';
            } else if (col.column_default.includes('::')) {
              const defaultVal = col.column_default.split('::')[0].replace(/'/g, '');
              drizzleType += `.default('${defaultVal}')`;
            }
          }

          // Handle primary key
          const { rows: pkCheck } = await client.query(`
            SELECT 1
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = $1
              AND tc.table_name = $2
              AND kcu.column_name = $3
          `, [schemaName, tableName, colName]);

          if (pkCheck.length > 0) {
            drizzleType += '.primaryKey()';
          }

          tableColumns.push(`    ${colName}: ${drizzleType},`);
        }

        const tableDefinition = `export const ${tableVarName} = pgTable('${tableName}', {\n${tableColumns.join('\n')}\n});`;
        schemaTables.push(tableDefinition);

        // Add type exports
        schemaTables.push(`\nexport type ${tableVarName[0].toUpperCase() + tableVarName.slice(1)} = typeof ${tableVarName}.$inferSelect;`);
        schemaTables.push(`export type New${tableVarName[0].toUpperCase() + tableVarName.slice(1)} = typeof ${tableVarName}.$inferInsert;\n`);
      }

      // Generate file content
      const imports = `import { ${Array.from(schemaImports).sort().join(', ')} } from 'drizzle-orm/pg-core';\n\n`;
      const fileContent = imports + schemaTables.join('\n\n');

      // Write to file
      const fileName = schemaName === 'public' ? 'public.ts' : `${schemaName}.ts`;
      const filePath = resolve(__dirname, 'src', 'schema', fileName);

      writeFileSync(filePath, fileContent);
      console.log(`✅ Generated: src/schema/${fileName}\n`);
    }

    // Create index file
    const indexContent = Object.keys(schemaGroups)
      .map(schema => {
        const fileName = schema === 'public' ? 'public' : schema;
        return `export * from './${fileName}';`;
      })
      .join('\n') + '\n';

    writeFileSync(resolve(__dirname, 'src', 'schema', 'index.ts'), indexContent);
    console.log('✅ Generated: src/schema/index.ts\n');

    console.log('🎉 Database introspection complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

introspectDatabase().catch(error => {
  console.error(error);
  process.exit(1);
});
