# Backup & Disaster Recovery Strategy

## 🛡️ Current Protection Levels

### Level 1: Automatic (Supabase Built-in) ✅
- **Database Backups**: Automatic daily backups by Supabase
- **Replication**: Multi-zone replication for high availability
- **Point-in-Time Recovery**: Available based on your Supabase plan
- **Uptime**: 99.9% SLA

### Level 2: Manual Backups (Recommended) ⚠️
- **Database Snapshots**: Export all tables to JSON
- **Frequency**: Weekly or before major changes
- **Storage**: Local disk + optional cloud storage

### Level 3: Full Backup (Optional) 💾
- **Database + Storage Files**: Complete backup including all MP3s/PDFs
- **Frequency**: Monthly or before major migrations
- **Storage**: External cloud storage (S3, Google Drive, etc.)

---

## 🔄 What Happens If...

### Scenario 1: Fly.io Goes Down
**Impact:** ❌ API unavailable (users can't make new requests)  
**Data Loss:** ✅ **NONE** - All data is in Supabase  
**Recovery:** Deploy to new platform (Render, Railway, etc.)  
**Time:** ~30 minutes  

### Scenario 2: Supabase Has Outage
**Impact:** ❌ Entire system unavailable  
**Data Loss:** ✅ **NONE** - Supabase has automatic backups  
**Recovery:** Wait for Supabase to restore service  
**Time:** Typically < 1 hour (per Supabase SLA)  

### Scenario 3: Accidental Data Deletion
**Impact:** ⚠️ Lost data (users, jobs, etc.)  
**Data Loss:** ⚠️ **MAYBE** - Depends on Supabase plan & point-in-time recovery  
**Recovery:** Restore from Supabase automatic backup OR manual backup  
**Time:** 1-4 hours  

### Scenario 4: Supabase Account Deleted/Locked
**Impact:** ❌ Total data loss if no manual backup  
**Data Loss:** ⚠️ **YES** - Unless you have manual backups  
**Recovery:** Restore from manual backup to new Supabase project  
**Time:** 4-8 hours  

---

## 📋 Backup Checklist

### Weekly (Recommended)
```bash
cd 1-in-a-billion-backend
npx tsx scripts/backupSupabaseData.ts
```
- ✅ Backs up all database tables to JSON
- ✅ Saves to: `~/Desktop/1-IN-A-BILLION-BACKUPS/`
- ✅ Quick (< 1 minute for typical data size)
- ❌ Does NOT backup storage files (MP3s/PDFs)

### Monthly (Optional but Recommended)
```bash
# 1. Database backup
npx tsx scripts/backupSupabaseData.ts

# 2. Storage files backup
npx tsx scripts/downloadCompleteMedia.ts
```
- ✅ Complete backup including all media files
- ⚠️ Slow (depends on storage size - could be hours)
- 💾 Requires significant disk space

### Before Major Changes (Critical)
Run weekly backup before:
- Schema migrations
- Data migrations
- Major refactoring
- Supabase project changes

---

## 💾 Storage Requirements

| Backup Type | Size Estimate | Frequency |
|-------------|---------------|-----------|
| **Database Only** | ~10-50 MB | Weekly |
| **Database + Storage** | ~10-100 GB+ | Monthly |

**Your Current Storage Usage:**
- Check Supabase Dashboard → Storage → Usage
- Or run: `npx tsx scripts/checkStorageSize.ts` (if created)

---

## 🔧 Backup Scripts

### Created Scripts

1. **`scripts/backupSupabaseData.ts`** ✅
   - Backs up all database tables
   - Fast and lightweight
   - Run weekly or before changes

2. **`scripts/downloadCompleteMedia.ts`** ✅ (Already exists)
   - Downloads all MP3s, PDFs from Supabase Storage
   - Slow but complete
   - Run monthly or before migrations

### Usage

```bash
# Quick database backup (< 1 min)
cd 1-in-a-billion-backend
npx tsx scripts/backupSupabaseData.ts

# Full backup including media (slow)
npx tsx scripts/backupSupabaseData.ts
npx tsx scripts/downloadCompleteMedia.ts
```

### Backup Location
```
~/Desktop/1-IN-A-BILLION-BACKUPS/
├── BACKUP_20260112_153045/
│   ├── people.json
│   ├── jobs.json
│   ├── job_tasks.json
│   ├── job_artifacts.json
│   ├── api_keys.json
│   ├── backup_metadata.json
│   └── README.txt
└── media/  (if using downloadCompleteMedia.ts)
    ├── audio/
    └── pdf/
```

---

## 🚀 Restore Process

### Restore Database

1. **Option A: Via Supabase Dashboard (Easy)**
   - Go to Supabase → Database → Import
   - Upload JSON files
   - Map columns

2. **Option B: Via SQL (Fast)**
   ```sql
   -- Create table if needed, then:
   INSERT INTO people
   SELECT * FROM json_populate_recordset(NULL::people, '[...]');
   ```

3. **Option C: Via Script** (Future improvement)
   ```bash
   npx tsx scripts/restoreSupabaseData.ts BACKUP_20260112_153045
   ```

### Restore Storage Files

1. Use Supabase Storage API or Dashboard to upload
2. Or use script (if created)

---

## 🔐 Security Notes

- **Backups contain sensitive data** (API keys, user info)
- Store backups securely
- Don't commit backups to git
- Consider encrypting backup files for cloud storage

---

## 📊 Monitoring

### Check Backup Health
```bash
# List all backups
ls -lh ~/Desktop/1-IN-A-BILLION-BACKUPS/

# Check latest backup
cat ~/Desktop/1-IN-A-BILLION-BACKUPS/BACKUP_*/backup_metadata.json
```

### Supabase Dashboard
- Monitor database size: Supabase → Database → Usage
- Monitor storage size: Supabase → Storage → Usage
- Check automatic backup status: Supabase → Settings → Backups

---

## ✅ Recommended Setup

### Minimal (Good)
- ✅ Rely on Supabase automatic backups
- ✅ Run manual backup before major changes
- ✅ Keep backups for 30 days

### Recommended (Better)
- ✅ Weekly automated database backups
- ✅ Monthly full backups (database + storage)
- ✅ Keep backups for 90 days
- ✅ Store backups on external cloud (Google Drive, Dropbox)

### Enterprise (Best)
- ✅ Daily automated database backups
- ✅ Weekly full backups
- ✅ Real-time replication to secondary Supabase project
- ✅ Keep backups for 1 year
- ✅ Encrypted cloud storage

---

## 🎯 Next Steps

1. **Run your first manual backup:**
   ```bash
   cd 1-in-a-billion-backend
   npx tsx scripts/backupSupabaseData.ts
   ```

2. **Set a calendar reminder:**
   - Weekly: Run database backup
   - Monthly: Run full backup
   - Before deployments: Run database backup

3. **Optional: Automate with cron** (macOS/Linux)
   ```bash
   # Add to crontab: Run every Sunday at 2am
   0 2 * * 0 cd /path/to/backend && npx tsx scripts/backupSupabaseData.ts
   ```

4. **Optional: Upload to cloud storage**
   - Manually copy backups to Google Drive, Dropbox, etc.
   - Or create script to auto-upload

---

## 📞 Support

- **Supabase Support**: https://supabase.com/dashboard/support
- **Backup Issues**: Check scripts/backupSupabaseData.ts logs
