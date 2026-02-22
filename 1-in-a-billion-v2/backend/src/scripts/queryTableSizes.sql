-- QUERY TABLE SIZES IN SUPABASE
-- 
-- Run this SQL query in Supabase Dashboard → SQL Editor
-- to get exact table sizes

SELECT 
  schemaname as schema,
  tablename as table,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
  pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Get row counts too
SELECT 
  schemaname,
  tablename,
  n_live_tup as estimated_row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
