import { config } from 'dotenv';
import { getPgClient } from './src/client';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const client = getPgClient();
    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected.');

        console.log('Listing schemas...');
        const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'drizzle'");
        console.log('Schemas:', res.rows);

        if (res.rows.length === 0) {
            console.log('Creating schema...');
            await client.query('CREATE SCHEMA "drizzle"');
            console.log('Schema created.');
        } else {
            console.log('Schema exists.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

main();
