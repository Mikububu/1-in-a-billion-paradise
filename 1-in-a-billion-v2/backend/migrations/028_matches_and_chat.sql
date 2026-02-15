-- ═══════════════════════════════════════════════════════════════════════════
-- MATCHES AND CHAT SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════
-- Complete system for:
-- 1. User matches (when compatibility algorithms find resonance)
-- 2. Chat conversations between matched users
-- 3. Messages within conversations
-- 4. Gallery visibility settings

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- USER PROFILES (extended for gallery)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add gallery visibility to library_people (for self profiles)
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS show_in_gallery BOOLEAN DEFAULT true;
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS gallery_bio TEXT;
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- MATCHES TABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- Stores matched pairs of users based on compatibility algorithms

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The two matched users (always user1_id < user2_id for uniqueness)
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The library_people records for each (their "self" profiles)
  person1_id UUID REFERENCES library_people(id) ON DELETE SET NULL,
  person2_id UUID REFERENCES library_people(id) ON DELETE SET NULL,
  
  -- Match quality metrics from the algorithm
  compatibility_score NUMERIC(5, 2), -- 0.00 to 100.00
  match_reason TEXT, -- Why they matched (e.g., "Vedic Moon compatibility")
  systems_matched JSONB DEFAULT '[]', -- Which systems showed resonance
  
  -- Match status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'blocked', 'expired')),
  
  -- Who has seen/acknowledged the match
  user1_seen_at TIMESTAMPTZ,
  user2_seen_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique pairs (user1 always < user2)
  CONSTRAINT unique_match_pair UNIQUE (user1_id, user2_id),
  CONSTRAINT ordered_users CHECK (user1_id < user2_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- CONVERSATIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- Each match can have one conversation

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  
  -- Conversation state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  
  -- Last message info (for listing)
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  
  -- Unread counts
  user1_unread_count INTEGER DEFAULT 0,
  user2_unread_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_conversation_per_match UNIQUE (match_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_match ON conversations(match_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- MESSAGES TABLE
-- ═══════════════════════════════════════════════════════════════════════════
-- Individual messages within conversations

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Sender
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'image', 'audio')),
  
  -- For system messages (e.g., "Good luck with this soul connection!")
  is_system_message BOOLEAN DEFAULT false,
  
  -- Read status
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- GALLERY VIEWS TABLE (optional - track who viewed whom)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gallery_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_person_id UUID NOT NULL REFERENCES library_people(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate views in same session
  CONSTRAINT unique_view_per_day UNIQUE (viewer_id, viewed_person_id, (viewed_at::date))
);

CREATE INDEX IF NOT EXISTS idx_gallery_views_viewer ON gallery_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_gallery_views_viewed ON gallery_views(viewed_person_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_views ENABLE ROW LEVEL SECURITY;

-- Matches: Users can see their own matches
CREATE POLICY "Users can view own matches"
  ON matches FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Conversations: Users can view conversations from their matches
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = conversations.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

-- Messages: Users can view messages in their conversations
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN matches m ON m.id = c.match_id
      WHERE c.id = messages.conversation_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- Messages: Users can insert messages in their conversations
CREATE POLICY "Users can send messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN matches m ON m.id = c.match_id
      WHERE c.id = conversation_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

-- Service role can do everything
CREATE POLICY "Service role full access matches"
  ON matches FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access conversations"
  ON conversations FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access messages"
  ON messages FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access gallery_views"
  ON gallery_views FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to create a match (ensures user1_id < user2_id)
CREATE OR REPLACE FUNCTION create_match(
  p_user1_id UUID,
  p_user2_id UUID,
  p_person1_id UUID DEFAULT NULL,
  p_person2_id UUID DEFAULT NULL,
  p_compatibility_score NUMERIC DEFAULT NULL,
  p_match_reason TEXT DEFAULT NULL,
  p_systems_matched JSONB DEFAULT '[]'
)
RETURNS UUID AS $$
DECLARE
  v_match_id UUID;
  v_ordered_user1 UUID;
  v_ordered_user2 UUID;
  v_ordered_person1 UUID;
  v_ordered_person2 UUID;
BEGIN
  -- Ensure consistent ordering
  IF p_user1_id < p_user2_id THEN
    v_ordered_user1 := p_user1_id;
    v_ordered_user2 := p_user2_id;
    v_ordered_person1 := p_person1_id;
    v_ordered_person2 := p_person2_id;
  ELSE
    v_ordered_user1 := p_user2_id;
    v_ordered_user2 := p_user1_id;
    v_ordered_person1 := p_person2_id;
    v_ordered_person2 := p_person1_id;
  END IF;
  
  INSERT INTO matches (
    user1_id, user2_id, person1_id, person2_id,
    compatibility_score, match_reason, systems_matched
  ) VALUES (
    v_ordered_user1, v_ordered_user2, v_ordered_person1, v_ordered_person2,
    p_compatibility_score, p_match_reason, p_systems_matched
  )
  ON CONFLICT (user1_id, user2_id) DO UPDATE SET
    compatibility_score = EXCLUDED.compatibility_score,
    match_reason = EXCLUDED.match_reason,
    systems_matched = EXCLUDED.systems_matched,
    updated_at = NOW()
  RETURNING id INTO v_match_id;
  
  -- Create conversation if it doesn't exist
  INSERT INTO conversations (match_id)
  VALUES (v_match_id)
  ON CONFLICT (match_id) DO NOTHING;
  
  RETURN v_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send welcome message when match is created
CREATE OR REPLACE FUNCTION send_match_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
  v_conversation_id UUID;
  v_welcome_messages TEXT[] := ARRAY[
    'Good luck with this new soul connection. Only God knows where this is heading towards and what it will bring to you.',
    'Two souls have found resonance across the cosmic web. May this connection reveal what you both need to see.',
    'The universe has conspired to bring you together. What unfolds from here is yours to discover.',
    'A rare alignment has been detected. This connection carries the potential for profound mutual understanding.',
    'Somewhere in the vast tapestry of existence, your threads have crossed. Honor this moment of recognition.'
  ];
  v_message TEXT;
BEGIN
  -- Get the conversation
  SELECT id INTO v_conversation_id FROM conversations WHERE match_id = NEW.id;
  
  -- Pick a random welcome message
  v_message := v_welcome_messages[1 + floor(random() * array_length(v_welcome_messages, 1))::int];
  
  -- Insert system message
  INSERT INTO messages (conversation_id, sender_id, content, message_type, is_system_message)
  VALUES (v_conversation_id, NEW.user1_id, v_message, 'system', true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for welcome message
DROP TRIGGER IF EXISTS match_welcome_message ON matches;
CREATE TRIGGER match_welcome_message
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION send_match_welcome_message();

-- Update conversation last_message when new message is sent
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_updates_conversation ON messages;
CREATE TRIGGER message_updates_conversation
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

GRANT SELECT ON matches TO authenticated;
GRANT SELECT ON conversations TO authenticated;
GRANT SELECT, INSERT ON messages TO authenticated;
GRANT SELECT, INSERT ON gallery_views TO authenticated;

GRANT ALL ON matches TO service_role;
GRANT ALL ON conversations TO service_role;
GRANT ALL ON messages TO service_role;
GRANT ALL ON gallery_views TO service_role;

GRANT EXECUTE ON FUNCTION create_match TO service_role;

COMMIT;
