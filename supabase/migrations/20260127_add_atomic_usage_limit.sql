-- Add atomic usage limit function to prevent race conditions
-- This function checks and increments usage_count atomically

CREATE OR REPLACE FUNCTION increment_usage_if_under_limit(
  p_user_id UUID,
  p_limit INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INT;
  result BOOLEAN;
BEGIN
  -- Lock the row and check current count
  SELECT usage_count INTO current_count
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- If user not found, assume no usage
  IF current_count IS NULL THEN
    current_count := 0;
  END IF;

  -- Check if under limit
  IF current_count >= p_limit THEN
    RETURN FALSE;
  END IF;

  -- Increment count atomically
  UPDATE profiles
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_usage_if_under_limit(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_usage_if_under_limit(UUID, INT) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION increment_usage_if_under_limit IS
'Atomically check and increment usage count for rate limiting. Returns TRUE if increment succeeded, FALSE if limit exceeded.';
