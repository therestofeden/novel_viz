-- Follow-up to 20261118181330_discovery_guardrails: shelf_recommendations
-- stores the whole tool payload ({mode, rationale, recommendations: [...]}),
-- not a bare array, so guard_recommendation_list must also filter the
-- array inside that object.
CREATE OR REPLACE FUNCTION public.guard_recommendation_list(p_list jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT CASE
    WHEN p_list IS NULL THEN p_list
    WHEN jsonb_typeof(p_list) = 'object' AND jsonb_typeof(p_list->'recommendations') = 'array'
      THEN jsonb_set(p_list, '{recommendations}', public.guard_recommendation_list(p_list->'recommendations'))
    WHEN jsonb_typeof(p_list) <> 'array' THEN p_list
    ELSE coalesce(
      (SELECT jsonb_agg(e ORDER BY ord)
       FROM jsonb_array_elements(p_list) WITH ORDINALITY AS x(e, ord)
       WHERE NOT (jsonb_typeof(e) = 'object' AND public.is_discovery_blocked(e->>'title', e->>'author'))),
      '[]'::jsonb)
  END;
$$;

SELECT public.refresh_discovery_guardrails();
