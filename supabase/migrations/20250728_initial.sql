-- enable pgvector (only installs once)
create extension if not exists "vector";

-- ────────────────────────────
-- media table
-- ────────────────────────────
create table public.media (
  id           uuid primary key default gen_random_uuid(),
  tmdb_id      integer not null unique,
  media_type   text    not null check (media_type in ('movie','tv')),
  title        text    not null,
  synopsis     text    not null,
  genres       text[]  not null,
  runtime      integer,
  poster_path  text,
  release_date date,
  popularity   numeric,
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);

-- exact-search / ANN index (pgvector IVF)
create index if not exists media_vec_ivf
  on public.media using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ────────────────────────────
-- rpc: match_media
-- returns top-N similar rows to an embedding
-- ────────────────────────────
create or replace function public.match_media(
    in_query_embedding vector,
    in_genres         text[]   default null,
    in_max_runtime    integer  default null,
    in_limit          integer  default 5
) returns table (
    id           uuid,
    tmdb_id      integer,
    media_type   text,
    title        text,
    synopsis     text,
    genres       text[],
    runtime      integer,
    poster_path  text,
    release_date date,
    score        float
)
language plpgsql security definer as $$
begin
  return query
  select  m.id,
          m.tmdb_id,
          m.media_type,
          m.title,
          m.synopsis,
          m.genres,
          m.runtime,
          m.poster_path,
          m.release_date,
          1 - (m.embedding <=> in_query_embedding) as score
  from    public.media m
  where   m.embedding is not null
      and (in_genres      is null or m.genres && in_genres)
      and (in_max_runtime is null or m.runtime <= in_max_runtime)
  order by m.embedding <=> in_query_embedding
  limit   in_limit;
end;
$$;

-- allow callers (anon/auth) to execute the rpc
grant execute on function public.match_media(
  vector, text[], integer, integer
) to anon, authenticated, service_role;
