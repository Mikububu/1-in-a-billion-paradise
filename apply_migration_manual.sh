#!/bin/bash
# Manual migration script - applies SQL directly via Supabase REST API

MIGRATION_FILE=$1
if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: ./apply_migration_manual.sh <migration-file>"
  exit 1
fi

source .env
SQL=$(cat "migrations/$MIGRATION_FILE")

echo "Applying migration: $MIGRATION_FILE"
echo "To Supabase: $SUPABASE_URL"

# Use Supabase Management API or direct SQL execution
# Note: This requires the SQL to be executed in Supabase Dashboard → SQL Editor
echo ""
echo "⚠️  Automatic migration not fully supported yet."
echo "💡 Please run this SQL manually in Supabase Dashboard → SQL Editor:"
echo ""
echo "$SQL"
