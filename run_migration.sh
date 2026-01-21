#!/bin/bash

echo "🔄 Applying migration 030: Rename claymation to portrait"
echo ""

# Source .env file
export $(cat .env | grep -v '^#' | xargs)

# SQL statements
cat migrations/030_rename_claymation_to_portrait.sql

echo ""
echo "📋 Opening Supabase SQL Editor..."
echo "📌 Project: qdfikbgwuauertfmkmzk"
echo ""
echo "Please:"
echo "1. Go to: https://supabase.com/dashboard/project/qdfikbgwuauertfmkmzk/sql/new"
echo "2. Paste the SQL above"
echo "3. Click 'Run'"
echo ""
echo "Or copy this one-liner:"
echo ""

# Create one-liner SQL
echo "ALTER TABLE library_people RENAME COLUMN claymation_url TO portrait_url; ALTER TABLE couple_claymations RENAME TO couple_portraits; DROP INDEX IF EXISTS idx_couple_claymations_user_id; DROP INDEX IF EXISTS idx_couple_claymations_persons; CREATE INDEX IF NOT EXISTS idx_couple_portraits_user_id ON couple_portraits(user_id); CREATE INDEX IF NOT EXISTS idx_couple_portraits_persons ON couple_portraits(person1_id, person2_id);"

