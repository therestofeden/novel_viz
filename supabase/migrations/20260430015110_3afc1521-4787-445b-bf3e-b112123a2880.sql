ALTER TABLE public.shelf_clusters
  ADD COLUMN IF NOT EXISTS shelf_id uuid;

UPDATE public.shelf_clusters c
SET shelf_id = s.id
FROM public.shelves s
WHERE c.shelf_id IS NULL
  AND s.user_id = c.user_id
  AND s.is_default = true;

CREATE INDEX IF NOT EXISTS idx_shelf_clusters_user_shelf
  ON public.shelf_clusters(user_id, shelf_id);

CREATE INDEX IF NOT EXISTS idx_shelf_cluster_members_cluster
  ON public.shelf_cluster_members(cluster_id);