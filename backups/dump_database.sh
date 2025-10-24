#!/bin/bash
# ScrimSpec Database Dump Script
# Usage: ./backups/dump_database.sh [password]

set -e

# Configuration
DB_HOST="aws-1-ap-south-1.pooler.supabase.com"
DB_PORT="6543"
DB_USER="postgres.cuwdjemjuszaaxpouprc"
DB_NAME="postgres"
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  ScrimSpec Database Backup${NC}"
echo "=================================="
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "Timestamp: $TIMESTAMP"
echo ""

# Check if password provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  Database password not provided${NC}"
    echo "Usage: ./backups/dump_database.sh YOUR_DB_PASSWORD"
    echo ""
    echo "Or set PGPASSWORD environment variable:"
    echo "export PGPASSWORD='your_password'"
    echo "./backups/dump_database.sh"
    exit 1
fi

export PGPASSWORD="$1"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}📦 Creating full backup...${NC}"
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --no-owner \
    --no-privileges \
    --schema=public \
    --exclude-table-data='audit_log' \
    --exclude-table-data='id_uuid_mapping' \
    --file="$BACKUP_DIR/full_backup_${TIMESTAMP}.sql"

echo -e "${GREEN}✅ Full backup created: full_backup_${TIMESTAMP}.sql${NC}"

echo -e "${GREEN}📋 Creating schema-only backup...${NC}"
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    --file="$BACKUP_DIR/schema_${TIMESTAMP}.sql"

echo -e "${GREEN}✅ Schema backup created: schema_${TIMESTAMP}.sql${NC}"

echo -e "${GREEN}💾 Creating data-only backup...${NC}"
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --data-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    --exclude-table-data='audit_log' \
    --exclude-table-data='id_uuid_mapping' \
    --file="$BACKUP_DIR/data_${TIMESTAMP}.sql"

echo -e "${GREEN}✅ Data backup created: data_${TIMESTAMP}.sql${NC}"

# Get file sizes
echo ""
echo -e "${GREEN}📊 Backup Summary:${NC}"
ls -lh "$BACKUP_DIR"/*_${TIMESTAMP}.sql | awk '{print "  " $9 " - " $5}'

echo ""
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo "Files saved in: $BACKUP_DIR/"

# Unset password
unset PGPASSWORD
