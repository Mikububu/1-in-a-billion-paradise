# APPLY MISSING MIGRATIONS TO SUPABASE

The social features (gallery, chat, matching, claymation) need these database migrations applied.

## Go to Supabase SQL Editor and run these in order:

### 1. Add Claymation URLs (027)
```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- CLAYMATION PORTRAIT URL
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS claymation_url TEXT;
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS original_photo_url TEXT;

COMMENT ON COLUMN library_people.claymation_url IS 'URL to the AI-generated claymation portrait image (OpenAI DALL-E 3)';
COMMENT ON COLUMN library_people.original_photo_url IS 'URL to the original uploaded portrait photo (stored for reference)';
```

### 2. Matches and Chat System (028)
```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- MATCHING & CHAT SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- Matches table: Vedic resonance matching
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  score NUMERIC(5, 2) NOT NULL, -- 0-100
  algorithm TEXT DEFAULT 'vedic_resonance',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  seen_by_user1_at TIMESTAMPTZ,
  seen_by_user2_at TIMESTAMPTZ,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_score ON matches(score DESC);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_match ON conversations(match_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

-- Gallery views tracking
CREATE TABLE IF NOT EXISTS gallery_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL,
  viewed_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(viewer_id, viewed_id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_views_viewer ON gallery_views(viewer_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_views_viewed ON gallery_views(viewed_id, viewed_at DESC);

-- RLS Policies
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_views ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY IF NOT EXISTS "Service role can do everything on matches"
  ON matches FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can do everything on conversations"
  ON conversations FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can do everything on messages"
  ON messages FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can do everything on gallery_views"
  ON gallery_views FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

### 3. Create Supabase Storage Bucket for Profile Images

Go to **Supabase Storage** → Create a new bucket:
- **Name**: `profile-images`
- **Public**: ✅ Yes (public bucket)
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/jpg`

### 4. Update Michael's Profile with Claymation URL

After migrations are applied, run this in SQL Editor:

```sql
UPDATE library_people 
SET 
  claymation_url = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images/e34061de-755c-4b5e-9b0d-a6c7aa8bddc2/self/claymation.png',
  original_photo_url = 'https://qdfikbgwuauertfmkmzk.supabase.co/storage/v1/object/public/profile-images/e34061de-755c-4b5e-9b0d-a6c7aa8bddc2/self/original.jpg',
  updated_at = NOW()
WHERE user_id = 'e34061de-755c-4b5e-9b0d-a6c7aa8bddc2' 
  AND is_user = true;
```

## Then the following will work in the app:

✅ **Gallery Screen**: View worldwide claymation portraits
✅ **Match System**: Vedic resonance matching algorithm
✅ **Chat**: Real-time messaging for matched users
✅ **Profile Avatar**: Your claymation portrait displays everywhere
✅ **Match Reveal**: Animated reveal when 2 users match

## Check the Admin Panel

After migrations, go to Admin Panel → **Matches & Gallery** tab to see:
- Total claymation portraits
- Active users
- Match statistics
- Recent matches
