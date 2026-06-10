ALTER TABLE public.upload_usage
  ADD COLUMN IF NOT EXISTS period_key TEXT NOT NULL DEFAULT 'forever';

DROP FUNCTION IF EXISTS public.consume_upload_credit(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.consume_upload_credit(
  p_user_id UUID,
  p_limit INTEGER,
  p_period_key TEXT DEFAULT 'forever'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  safe_period_key TEXT := COALESCE(NULLIF(p_period_key, ''), 'forever');
  used_after INTEGER;
  did_consume BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    SELECT COALESCE(uploads_used, 0)
    INTO used_after
    FROM public.upload_usage
    WHERE user_id = p_user_id
      AND period_key = safe_period_key;

    used_after := COALESCE(used_after, 0);

    RETURN jsonb_build_object(
      'allowed', FALSE,
      'used', used_after,
      'remaining', 0,
      'periodKey', safe_period_key
    );
  END IF;

  INSERT INTO public.upload_usage AS usage (user_id, period_key, uploads_used, last_upload_at, updated_at)
  VALUES (p_user_id, safe_period_key, 1, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET uploads_used = CASE
          WHEN usage.period_key = safe_period_key THEN usage.uploads_used + 1
          ELSE 1
        END,
        period_key = safe_period_key,
        last_upload_at = NOW(),
        updated_at = NOW()
    WHERE usage.period_key <> safe_period_key
       OR usage.uploads_used < p_limit
  RETURNING uploads_used INTO used_after;

  IF FOUND THEN
    did_consume := TRUE;
  ELSE
    SELECT COALESCE(u.uploads_used, 0)
    INTO used_after
    FROM public.upload_usage u
    WHERE u.user_id = p_user_id
      AND u.period_key = safe_period_key;

    used_after := COALESCE(used_after, 0);
  END IF;

  RETURN jsonb_build_object(
    'allowed', did_consume,
    'used', used_after,
    'remaining', GREATEST(p_limit - used_after, 0),
    'periodKey', safe_period_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_upload_credit(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_upload_credit(UUID, INTEGER, TEXT) TO service_role;
