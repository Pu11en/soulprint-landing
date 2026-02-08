-- Backfill default conversations and assign all existing chat messages
-- Purpose: Migrate existing chat messages into default conversations for multi-conversation support
-- This is Phase 8 migration 3 of 3 - creates default conversations and validates data integrity

-- ============================================
-- STEP 1: CREATE DEFAULT CONVERSATIONS
-- ============================================

-- Create one default conversation per user who has existing messages
-- Use earliest message date as conversation start, latest as updated time
-- Use WHERE NOT EXISTS instead of ON CONFLICT since there's no unique constraint on user_id
INSERT INTO public.conversations (user_id, title, created_at, updated_at)
SELECT
  cm.user_id,
  'Chat History' AS title,
  MIN(cm.created_at) AS created_at,
  MAX(cm.created_at) AS updated_at
FROM public.chat_messages cm
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversations c WHERE c.user_id = cm.user_id
)
GROUP BY cm.user_id;

-- ============================================
-- STEP 2: ASSIGN MESSAGES TO CONVERSATIONS
-- ============================================

-- Assign all messages with NULL conversation_id to their user's default conversation
-- Use ORDER BY created_at ASC LIMIT 1 to pick earliest conversation (important for Phase 10)
UPDATE public.chat_messages cm
SET conversation_id = (
  SELECT c.id
  FROM public.conversations c
  WHERE c.user_id = cm.user_id
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE cm.conversation_id IS NULL;

-- ============================================
-- STEP 3: VALIDATE FOREIGN KEY CONSTRAINT
-- ============================================

-- Now that all rows have valid conversation_ids, validate the FK constraint
-- This enables PostgreSQL to enforce the constraint on future inserts/updates
ALTER TABLE public.chat_messages VALIDATE CONSTRAINT fk_chat_messages_conversation;

-- ============================================
-- STEP 4: VERIFICATION AND INTEGRITY CHECKS
-- ============================================

-- Run comprehensive verification to ensure migration succeeded
DO $$
DECLARE
  total_messages INTEGER;
  assigned_messages INTEGER;
  orphaned_messages INTEGER;
  total_users INTEGER;
  users_with_conversations INTEGER;
BEGIN
  -- Count messages
  SELECT COUNT(*) INTO total_messages FROM public.chat_messages;
  SELECT COUNT(*) INTO assigned_messages
    FROM public.chat_messages
    WHERE conversation_id IS NOT NULL;
  SELECT COUNT(*) INTO orphaned_messages
    FROM public.chat_messages
    WHERE conversation_id IS NULL;

  -- Count users
  SELECT COUNT(DISTINCT user_id) INTO total_users
    FROM public.chat_messages;
  SELECT COUNT(*) INTO users_with_conversations
    FROM public.conversations;

  -- Log migration statistics
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Statistics:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Total messages: %', total_messages;
  RAISE NOTICE '  Assigned messages: %', assigned_messages;
  RAISE NOTICE '  Orphaned messages: %', orphaned_messages;
  RAISE NOTICE '  Total users with messages: %', total_users;
  RAISE NOTICE '  Users with conversations: %', users_with_conversations;
  RAISE NOTICE '========================================';

  -- CRITICAL CHECK 1: No orphaned messages
  IF orphaned_messages > 0 THEN
    RAISE EXCEPTION 'Migration FAILED: % messages without conversation_id', orphaned_messages;
  END IF;

  -- CRITICAL CHECK 2: User count match
  IF total_users != users_with_conversations THEN
    RAISE EXCEPTION 'Migration FAILED: User count mismatch (% message users vs % conversation users)',
      total_users, users_with_conversations;
  END IF;

  -- Success message
  RAISE NOTICE '';
  RAISE NOTICE 'Migration verification PASSED';
  RAISE NOTICE 'All % messages successfully assigned to conversations', total_messages;
  RAISE NOTICE '';
END $$;
