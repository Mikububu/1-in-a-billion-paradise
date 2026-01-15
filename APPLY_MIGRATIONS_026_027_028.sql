-- ═══════════════════════════════════════════════════════════════════════════
-- COMBINED MIGRATIONS: 026, 027, 028
-- Apply this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 026: COST TRACKING
-- ═══════════════════════════════════════════════════════════════════════════

-- Add cost tracking to job_tasks
ALTER TABLE job_tasks ADD COLUMN IF NOT EXISTS cost_data JSONB DEFAULT '{}';

-- Add total cost to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(10, 6) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cost_breakdown JSONB DEFAULT '{}';

-- Create cost_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS cost_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES job_tasks(id) ON DELETE SET NULL,
  
  -- Provider info
  provider TEXT NOT NULL, -- 'claude', 'deepseek', 'openai', 'runpod'
  model TEXT,
  
  -- Usage metrics
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  execution_time_ms INTEGER DEFAULT 0,
  
  -- Cost calculation
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  
  -- Context
  label TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_logs_job_id ON cost_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_cost_logs_provider ON cost_logs(provider);
CREATE INDEX IF NOT EXISTS idx_cost_logs_created_at ON cost_logs(created_at DESC);

-- RLS for cost_logs (service role only)
ALTER TABLE cost_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can do everything on cost_logs') THEN
    CREATE POLICY "Service role can do everything on cost_logs"
      ON cost_logs FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- Function to update job total cost when tasks complete
CREATE OR REPLACE FUNCTION update_job_total_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_total NUMERIC(10, 6);
  v_breakdown JSONB;
BEGIN
  -- Calculate total cost from cost_logs
  SELECT 
    COALESCE(SUM(cost_usd), 0),
    jsonb_object_agg(provider, provider_cost) 
  INTO v_total, v_breakdown
  FROM (
    SELECT provider, SUM(cost_usd) as provider_cost
    FROM cost_logs
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
    GROUP BY provider
  ) sub;
  
  -- Update job
  UPDATE jobs
  SET 
    total_cost_usd = v_total,
    cost_breakdown = COALESCE(v_breakdown, '{}') || jsonb_build_object('total', v_total)
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_job_cost_on_log_insert ON cost_logs;
CREATE TRIGGER update_job_cost_on_log_insert
  AFTER INSERT ON cost_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_total_cost();

-- Grant permissions
GRANT SELECT ON cost_logs TO authenticated;
GRANT ALL ON cost_logs TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 027: CLAYMATION PORTRAIT URL
-- ═══════════════════════════════════════════════════════════════════════════

-- Add claymation_url to library_people
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS claymation_url TEXT;

-- Add original_photo_url to library_people (stores the uploaded photo)
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS original_photo_url TEXT;

COMMENT ON COLUMN library_people.claymation_url IS 'URL to the AI-generated claymation portrait image (OpenAI DALL-E 3)';
COMMENT ON COLUMN library_people.original_photo_url IS 'URL to the original uploaded portrait photo (stored for reference)';


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 028: MATCHES AND CHAT SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- Add gallery visibility to library_people (for self profiles)
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS show_in_gallery BOOLEAN DEFAULT true;
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS gallery_bio TEXT;
ALTER TABLE library_people ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The two matched users (always user1_id < user2_id for uniqueness)
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The library_people records for each (their "self" profiles)
  person1_id UUID REFERENCES library_people(id) ON DELETE SET NULL,
  person2_id UUID REFERENCES library_people(id) ON DELETE SET NULL,
  
  -- Match quality metrics from the algorithm
  compatibility_score NUMERIC(5, 2),
  match_reason TEXT,
  systems_matched JSONB DEFAULT '[]',
  
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

-- CONVERSATIONS TABLE
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

-- MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Sender
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'image', 'audio')),
  
  -- For system messages
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

-- GALLERY VIEWS TABLE
CREATE TABLE IF NOT EXISTS gallery_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_person_id UUID NOT NULL REFERENCES library_people(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_views_viewer ON gallery_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_gallery_views_viewed ON gallery_views(viewed_person_id);

-- ROW LEVEL SECURITY
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ 
BEGIN
  -- Matches policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own matches') THEN
    CREATE POLICY "Users can view own matches"
      ON matches FOR SELECT
      USING (auth.uid() = user1_id OR auth.uid() = user2_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access matches') THEN
    CREATE POLICY "Service role full access matches"
      ON matches FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;
  
  -- Conversations policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own conversations') THEN
    CREATE POLICY "Users can view own conversations"
      ON conversations FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM matches 
          WHERE matches.id = conversations.match_id 
          AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
        )
      );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access conversations') THEN
    CREATE POLICY "Service role full access conversations"
      ON conversations FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;
  
  -- Messages policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view messages in own conversations') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can send messages in own conversations') THEN
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
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access messages') THEN
    CREATE POLICY "Service role full access messages"
      ON messages FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;
  
  -- Gallery views policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access gallery_views') THEN
    CREATE POLICY "Service role full access gallery_views"
      ON gallery_views FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- FUNCTIONS

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
  SELECT id INTO v_conversation_id FROM conversations WHERE match_id = NEW.id;
  v_message := v_welcome_messages[1 + floor(random() * array_length(v_welcome_messages, 1))::int];
  
  INSERT INTO messages (conversation_id, sender_id, content, message_type, is_system_message)
  VALUES (v_conversation_id, NEW.user1_id, v_message, 'system', true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- GRANTS
GRANT SELECT ON matches TO authenticated;
GRANT SELECT ON conversations TO authenticated;
GRANT SELECT, INSERT ON messages TO authenticated;
GRANT SELECT, INSERT ON gallery_views TO authenticated;

GRANT ALL ON matches TO service_role;
GRANT ALL ON conversations TO service_role;
GRANT ALL ON messages TO service_role;
GRANT ALL ON gallery_views TO service_role;
GRANT ALL ON cost_logs TO service_role;

GRANT EXECUTE ON FUNCTION create_match TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! All migrations applied.
-- ═══════════════════════════════════════════════════════════════════════════
