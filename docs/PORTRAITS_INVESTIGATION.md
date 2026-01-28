# Portraits investigation ("most of my beautiful portraits are gone")

## Where portraits live

- **DB**: `library_people.portrait_url`, `library_people.original_photo_url` (Supabase)
- **Storage**: `profile-images/{userId}/{personId}/AI-generated-portrait.png`, `original.png`
- **Couple portraits**: `couple_portraits` table, `couple-portraits` bucket

## How they're loaded

- **Frontend** (`MyLibraryScreen`): Fetches `library_people` via Supabase (anon key), maps `portrait_url` / `original_photo_url` into `libraryPeopleById`, displays avatars.
- **PDF worker**: Reads `library_people` / `couple_portraits` via service role, uses portrait URLs when generating PDFs.

## Likely cause: legacy Supabase keys disabled

If legacy anon/service_role keys are disabled and the app still uses them (or wrong keys):

- Supabase rejects requests → frontend gets no `library_people` data → no portrait URLs in UI → "portraits gone."

The portraits are usually still in DB + storage; the app just can't fetch them.

**Fix:** Use the new Supabase keys (Publishable + Secret). See `docs/SUPABASE_LEGACY_KEYS_DISABLED.md`.

## If DB URLs were lost but storage files exist

Run the restore script from the backend folder:

```bash
cd 1-in-a-billion-backend
npx ts-node scripts/restore-portraits.ts
```

It scans the `profile-images` bucket, finds `AI-generated-portrait.png` per person, and updates `library_people.portrait_url` where missing. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (use new Secret key if legacy is disabled).

## If storage files were deleted

The restore script can only relink existing files. Deleted files cannot be recovered; portraits would need to be re-uploaded and re-generated.
