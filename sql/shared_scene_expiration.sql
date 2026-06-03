ALTER TABLE public.shared_scenes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.shared_scenes
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days');

DROP INDEX IF EXISTS public.idx_shared_scenes_expires_at;

ALTER TABLE public.shared_scenes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shared_scenes FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.shared_scenes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shared_scenes TO service_role;

DROP POLICY IF EXISTS "Allow public insert" ON public.shared_scenes;
DROP POLICY IF EXISTS "Allow public select" ON public.shared_scenes;
DROP POLICY IF EXISTS "Public can create expiring shared scenes" ON public.shared_scenes;
DROP POLICY IF EXISTS "Public can read valid shared scenes" ON public.shared_scenes;

CREATE POLICY "Public can create expiring shared scenes"
  ON public.shared_scenes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    expires_at IS NOT NULL
    AND expires_at > NOW()
    AND expires_at <= NOW() + INTERVAL '30 days' + INTERVAL '5 minutes'
  );

CREATE POLICY "Public can read valid shared scenes"
  ON public.shared_scenes
  FOR SELECT
  TO anon, authenticated
  USING (expires_at IS NULL OR expires_at > NOW());
