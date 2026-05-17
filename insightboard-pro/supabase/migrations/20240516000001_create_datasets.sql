-- Optional: run on Supabase Postgres if using hosted DB (public schema)
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(512) NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_count INTEGER NOT NULL DEFAULT 0,
  columns_metadata JSONB,
  eda_profile JSONB,
  status VARCHAR(32) NOT NULL DEFAULT 'processing',
  storage_path VARCHAR(1024) NOT NULL DEFAULT '',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_datasets_user_id ON public.datasets(user_id);
