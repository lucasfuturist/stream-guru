create extension if not exists "pg_trgm" with schema "public" version '1.6';

create extension if not exists "unaccent" with schema "public" version '1.1';

drop policy "allow insert" on "public"."query_log";

drop function if exists "public"."match_media"(in_actor_name text, in_genre text, in_user_vector vector, in_year_max integer, in_year_min integer, match_count integer, match_threshold numeric);

create table "public"."media_cast" (
    "tmdb_id" integer not null,
    "person_id" integer not null,
    "name" text not null,
    "character" text,
    "order" integer
);


alter table "public"."media" add column "adult" boolean;

alter table "public"."media" add column "belongs_to_collection" jsonb;

alter table "public"."media" add column "cert_country" text;

alter table "public"."media" add column "cert_rating" text;

alter table "public"."media" add column "cert_source" text;

alter table "public"."media" add column "episode_run_time" integer[];

alter table "public"."media" add column "external_ids" jsonb;

alter table "public"."media" add column "first_air_date" date;

alter table "public"."media" add column "homepage" text;

alter table "public"."media" add column "images" jsonb;

alter table "public"."media" add column "imdb_id" text;

alter table "public"."media" add column "in_production" boolean;

alter table "public"."media" add column "keywords" jsonb;

alter table "public"."media" add column "last_air_date" date;

alter table "public"."media" add column "moderated_at" timestamp with time zone;

alter table "public"."media" add column "nsfw_flag" boolean not null default false;

alter table "public"."media" add column "nsfw_level" text;

alter table "public"."media" add column "nsfw_reason" text;

alter table "public"."media" add column "nsfw_score" numeric;

alter table "public"."media" add column "number_of_episodes" integer;

alter table "public"."media" add column "number_of_seasons" integer;

alter table "public"."media" add column "origin_country" text[];

alter table "public"."media" add column "original_language" text;

alter table "public"."media" add column "original_title" text;

alter table "public"."media" add column "overview" text;

alter table "public"."media" add column "production_companies" jsonb;

alter table "public"."media" add column "production_countries" jsonb;

alter table "public"."media" add column "ratings_payload" jsonb;

alter table "public"."media" add column "recommendations" jsonb;

alter table "public"."media" add column "reviews" jsonb;

alter table "public"."media" add column "search_title" text;

alter table "public"."media" add column "similar" jsonb;

alter table "public"."media" add column "status" text;

alter table "public"."media" add column "translations" jsonb;

alter table "public"."media" add column "type" text;

alter table "public"."media" add column "updated_from_tmdb_at" timestamp with time zone;

alter table "public"."media" add column "videos" jsonb;

alter table "public"."media" add column "vote_average" numeric;

alter table "public"."media" add column "vote_count" integer;

CREATE INDEX idx_media_director_trgm ON public.media USING gin (director gin_trgm_ops);

CREATE INDEX idx_media_genres ON public.media USING gin (genres);

CREATE INDEX idx_media_media_type ON public.media USING btree (media_type);

CREATE INDEX idx_media_release_date ON public.media USING btree (release_date);

CREATE INDEX idx_media_runtime ON public.media USING btree (runtime);

CREATE INDEX idx_media_top_cast_gin ON public.media USING gin (top_cast jsonb_path_ops);

CREATE INDEX media_cast_name_trgm_idx ON public.media_cast USING gin (search_normalize(name) gin_trgm_ops);

CREATE UNIQUE INDEX media_cast_pkey ON public.media_cast USING btree (tmdb_id, person_id);

CREATE INDEX media_cert_idx ON public.media USING btree (cert_country, cert_rating);

CREATE INDEX media_cert_rating_idx ON public.media USING btree (cert_rating);

CREATE INDEX media_media_type_idx ON public.media USING btree (media_type);

CREATE INDEX media_nsfw_flag_idx ON public.media USING btree (nsfw_flag);

CREATE INDEX media_safe_popularity_idx ON public.media USING btree (popularity DESC) WHERE ((COALESCE(adult, false) = false) AND (COALESCE(nsfw_flag, false) = false));

CREATE INDEX media_safe_type_pop_idx ON public.media USING btree (media_type, popularity DESC) WHERE ((COALESCE(adult, false) = false) AND (COALESCE(nsfw_flag, false) = false));

CREATE INDEX media_search_title_gin_like_idx ON public.media USING gin (search_title gin_trgm_ops);

CREATE INDEX media_search_title_gist_idx ON public.media USING gist (search_title gist_trgm_ops);

CREATE INDEX media_search_title_trgm_idx ON public.media USING gin (search_title gin_trgm_ops);

CREATE INDEX media_sort_filter_idx ON public.media USING btree (media_type, release_date, popularity DESC, vote_count DESC);

CREATE INDEX media_title_trgm_idx ON public.media USING gin (title gin_trgm_ops) WITH (fastupdate=off);

CREATE INDEX media_trending_cover_idx ON public.media USING btree (popularity DESC, tmdb_id DESC) INCLUDE (media_type, title, poster_path, backdrop_path, release_date) WHERE (popularity IS NOT NULL);

alter table "public"."media_cast" add constraint "media_cast_pkey" PRIMARY KEY using index "media_cast_pkey";

alter table "public"."media" add constraint "media_nsfw_level_check" CHECK ((nsfw_level = ANY (ARRAY['none'::text, 'soft'::text, 'hard'::text]))) not valid;

alter table "public"."media" validate constraint "media_nsfw_level_check";

alter table "public"."media_cast" add constraint "media_cast_tmdb_id_fkey" FOREIGN KEY (tmdb_id) REFERENCES media(tmdb_id) ON DELETE CASCADE not valid;

alter table "public"."media_cast" validate constraint "media_cast_tmdb_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.filter_media(in_genre text DEFAULT NULL::text, in_actor_name text DEFAULT NULL::text, in_max_runtime integer DEFAULT NULL::integer)
 RETURNS TABLE(tmdb_id integer, media_type text, title text, poster_path text)
 LANGUAGE sql
AS $function$
  SELECT
    m.tmdb_id,
    m.media_type,
    m.title,
    m.poster_path
  FROM public.media AS m
  WHERE
    -- Each clause only applies if the corresponding parameter is provided
    (in_genre IS NULL OR EXISTS (SELECT 1 FROM unnest(m.genres) AS g WHERE g ILIKE in_genre))
    AND
    (in_actor_name IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(m.top_cast) AS actor WHERE actor->>'name' ILIKE '%' || in_actor_name || '%'))
    AND
    (in_max_runtime IS NULL OR m.runtime <= in_max_runtime)
  ORDER BY m.popularity DESC
  LIMIT 50;
$function$
;

CREATE OR REPLACE FUNCTION public.filter_media(in_genre text DEFAULT NULL::text, in_actor_name text DEFAULT NULL::text, in_max_runtime integer DEFAULT NULL::integer, page_number integer DEFAULT 1, page_size integer DEFAULT 21)
 RETURNS SETOF media
 LANGUAGE sql
 STABLE
AS $function$
  select m.*
  from public.media m
  where
    (in_genre is null
      or m.genres @> array[in_genre]) -- exact-genre match; switch to ILIKE if you want fuzzy
  and (in_actor_name is null
      or exists (select 1
                 from jsonb_array_elements(m.top_cast) a
                 where (a->>'name') ilike '%' || in_actor_name || '%'))
  and (in_max_runtime is null or m.runtime <= in_max_runtime)
  order by m.popularity desc nulls last
  offset greatest(0, (page_number - 1) * page_size)
  limit page_size;
$function$
;

CREATE OR REPLACE FUNCTION public.final_match_media(in_user_vector vector, in_genres text[] DEFAULT NULL::text[], in_actor_name text DEFAULT NULL::text, in_max_runtime integer DEFAULT NULL::integer, in_year_min integer DEFAULT NULL::integer, in_year_max integer DEFAULT NULL::integer, match_count integer DEFAULT 10)
 RETURNS SETOF media
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM public.media m
  WHERE
    -- Hard filter for structured data
    (in_genres IS NULL OR m.genres && in_genres) AND
    (in_max_runtime IS NULL OR m.runtime <= in_max_runtime) AND
    (in_year_min IS NULL OR EXTRACT(YEAR FROM m.release_date) >= in_year_min) AND
    (in_year_max IS NULL OR EXTRACT(YEAR FROM m.release_date) <= in_year_max) AND
    -- Robust hard filter for the actor's name within the JSONB array
    (in_actor_name IS NULL OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(m.top_cast) actor
      WHERE actor->>'name' ILIKE '%' || in_actor_name || '%'
    ))
  -- Soft ranking for semantic relevance on the remaining candidates
  ORDER BY
    m.embedding <=> in_user_vector
  LIMIT
    match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.final_match_media(in_user_vector vector, in_media_type text DEFAULT NULL::text, in_genres text[] DEFAULT NULL::text[], in_actor_name text DEFAULT NULL::text, in_max_runtime integer DEFAULT NULL::integer, in_year_min integer DEFAULT NULL::integer, in_year_max integer DEFAULT NULL::integer, match_count integer DEFAULT 10)
 RETURNS SETOF media
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM public.media m
  WHERE
    -- Hard filter for all structured data
    (in_media_type IS NULL OR m.media_type = in_media_type) AND
    (in_genres IS NULL OR m.genres && in_genres) AND
    (in_max_runtime IS NULL OR m.runtime <= in_max_runtime) AND
    (in_year_min IS NULL OR EXTRACT(YEAR FROM m.release_date) >= in_year_min) AND
    (in_year_max IS NULL OR EXTRACT(YEAR FROM m.release_date) <= in_year_max) AND
    (in_actor_name IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(m.top_cast) actor WHERE actor->>'name' ILIKE '%' || in_actor_name || '%'
    ))
  ORDER BY
    m.embedding <=> in_user_vector
  LIMIT
    match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fuzzy_search_media(search_term text, in_genre text DEFAULT NULL::text, in_actor_name text DEFAULT NULL::text, in_max_runtime integer DEFAULT NULL::integer, page_number integer DEFAULT 1, page_size integer DEFAULT 20)
 RETURNS TABLE(id uuid, tmdb_id integer, media_type text, title text, poster_path text, popularity numeric, similarity double precision)
 LANGUAGE plpgsql
AS $function$
DECLARE
    search_offset int;
BEGIN
    -- Calculate the starting point for the results
    search_offset := (page_number - 1) * page_size;

    RETURN QUERY
    SELECT 
        m.id,
        m.tmdb_id,
        m.media_type,
        m.title,
        m.poster_path,
        m.popularity,
        similarity(m.title, search_term) AS similarity
    FROM 
        public.media m
    WHERE
        -- Apply fuzzy search on title with a minimum similarity threshold
        similarity(m.title, search_term) > 0.1
        -- Apply additional filters if provided
        AND (in_genre IS NULL OR genres @> ARRAY[in_genre])
        AND (in_actor_name IS NULL OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(top_cast) AS actor
            WHERE actor->>'name' ILIKE ('%' || in_actor_name || '%')
        ))
        AND (in_max_runtime IS NULL OR runtime <= in_max_runtime)
    ORDER BY
        similarity DESC, -- Sort by similarity first
        popularity DESC  -- Then by popularity
    LIMIT page_size
    OFFSET search_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_decade_counts()
 RETURNS TABLE(decade text, count bigint)
 LANGUAGE plpgsql
AS $function$
  BEGIN
    RETURN QUERY
    SELECT
      (FLOOR(EXTRACT(YEAR FROM release_date) / 10) * 10)::TEXT || 's' AS decade,
      COUNT(*) AS count
    FROM public.media
    WHERE release_date IS NOT NULL
    GROUP BY FLOOR(EXTRACT(YEAR FROM release_date) / 10) * 10
    ORDER BY FLOOR(EXTRACT(YEAR FROM release_date) / 10) * 10;
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.get_genre_counts()
 RETURNS TABLE(genre text, count bigint)
 LANGUAGE plpgsql
AS $function$
  BEGIN
    RETURN QUERY
    SELECT UNNEST(genres) AS genre, COUNT(*) AS count
    FROM public.media
    GROUP BY UNNEST(genres);
  END;
  $function$
;

CREATE OR REPLACE FUNCTION public.get_trending(page_number integer DEFAULT 1, page_size integer DEFAULT 21)
 RETURNS TABLE(tmdb_id integer, media_type text, title text, poster_path text, backdrop_path text, release_date date, popularity numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
begin
  set local statement_timeout = '8s';

  return query
  select m.tmdb_id, m.media_type, m.title, m.poster_path,
         m.backdrop_path, m.release_date, m.popularity
  from public.media m
  where m.popularity is not null
  order by m.popularity desc nulls last
  offset greatest(0, (page_number - 1) * page_size)
  limit page_size;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_trending(page_size integer DEFAULT 21, last_popularity numeric DEFAULT NULL::numeric, last_tmdb_id integer DEFAULT NULL::integer)
 RETURNS TABLE(tmdb_id integer, media_type text, title text, poster_path text, backdrop_path text, release_date date, popularity numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
begin
  if last_popularity is null or last_tmdb_id is null then
    return query
      select m.tmdb_id, m.media_type, m.title, m.poster_path,
             m.backdrop_path, m.release_date, m.popularity
      from public.media m
      where m.popularity is not null
      order by m.popularity desc, m.tmdb_id desc
      limit page_size;
  else
    return query
      select m.tmdb_id, m.media_type, m.title, m.poster_path,
             m.backdrop_path, m.release_date, m.popularity
      from public.media m
      where m.popularity is not null
        and (
          m.popularity < last_popularity
          or (m.popularity = last_popularity and m.tmdb_id < last_tmdb_id)
        )
      order by m.popularity desc, m.tmdb_id desc
      limit page_size;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search(in_media_type text DEFAULT NULL::text, in_genres text[] DEFAULT NULL::text[], in_not_genres text[] DEFAULT NULL::text[], in_actor_name text DEFAULT NULL::text, in_not_actor_name text DEFAULT NULL::text, in_director_name text DEFAULT NULL::text, in_not_director_name text DEFAULT NULL::text, in_release_year_min integer DEFAULT NULL::integer, in_release_year_max integer DEFAULT NULL::integer, in_max_runtime integer DEFAULT NULL::integer, in_spoken_language text DEFAULT NULL::text, in_user_vector vector DEFAULT NULL::vector, in_match_threshold double precision DEFAULT 0.5, in_limit integer DEFAULT 21)
 RETURNS TABLE(id uuid, tmdb_id integer, media_type text, title text, synopsis text, genres text[], runtime integer, poster_path text, release_date date, popularity numeric, embedding vector, created_at timestamp with time zone, director text, tagline text, trailer_key text, backdrop_path text, logo_path text, top_cast jsonb, watch_providers jsonb, spoken_languages jsonb, score double precision)
 LANGUAGE plpgsql
AS $function$
begin
  -- Check if user vector is provided, as it's required for semantic search
  if in_user_vector is null then
    raise exception 'User vector is required for semantic search';
  end if;

  return query
  select
    m.*,
    1 - (m.embedding <=> in_user_vector) as score
  from
    public.media m
  where
    (in_media_type is null or m.media_type = in_media_type) and
    (in_genres is null or m.genres @> in_genres) and
    (in_not_genres is null or not (m.genres && in_not_genres)) and
    (in_release_year_min is null or extract(year from m.release_date) >= in_release_year_min) and
    (in_release_year_max is null or extract(year from m.release_date) <= in_release_year_max) and
    (in_max_runtime is null or m.runtime <= in_max_runtime) and
    (in_spoken_language is null or exists (
        select 1 from jsonb_array_elements(m.spoken_languages) as lang
        where lower(lang->>'english_name') = lower(in_spoken_language)
    )) and
    (in_actor_name is null or exists (
        select 1 from jsonb_array_elements(m.top_cast) as actor
        where lower(actor->>'name') ilike '%' || lower(in_actor_name) || '%'
    )) and
    (in_not_actor_name is null or not exists (
        select 1 from jsonb_array_elements(m.top_cast) as actor
        where lower(actor->>'name') ilike '%' || lower(in_not_actor_name) || '%'
    )) and
    (in_director_name is null or lower(m.director) ilike '%' || lower(in_director_name) || '%') and
    (in_not_director_name is null or lower(m.director) not ilike '%' || lower(in_not_director_name) || '%') and
    m.embedding is not null
  
  -- The WHERE clause now also checks against the new, more lenient threshold
  and (1 - (m.embedding <=> in_user_vector)) >= in_match_threshold

  order by
    score desc
  
  limit in_limit;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search(in_media_type text DEFAULT NULL::text, in_genres text[] DEFAULT NULL::text[], in_not_genres text[] DEFAULT NULL::text[], in_actor_name text DEFAULT NULL::text, in_not_actor_name text DEFAULT NULL::text, in_director_name text DEFAULT NULL::text, in_not_director_name text DEFAULT NULL::text, in_release_year_min integer DEFAULT NULL::integer, in_release_year_max integer DEFAULT NULL::integer, in_max_runtime integer DEFAULT NULL::integer, in_spoken_language text DEFAULT NULL::text, in_user_vector vector DEFAULT NULL::vector, in_match_threshold double precision DEFAULT 0.5, in_limit integer DEFAULT 21, in_rank_only_mode boolean DEFAULT false)
 RETURNS TABLE(id uuid, tmdb_id integer, media_type text, title text, synopsis text, genres text[], runtime integer, poster_path text, release_date date, popularity numeric, embedding vector, created_at timestamp with time zone, director text, tagline text, trailer_key text, backdrop_path text, logo_path text, top_cast jsonb, watch_providers jsonb, spoken_languages jsonb, score double precision)
 LANGUAGE plpgsql
AS $function$
begin
  -- Check if user vector is provided, as it's required for semantic search
  if in_user_vector is null then
    raise exception 'User vector is required for semantic search';
  end if;

  return query
  select
    m.*,
    1 - (m.embedding <=> in_user_vector) as score
  from
    public.media m
  where
    -- All the hard filters remain the same
    (in_media_type is null or m.media_type = in_media_type) and
    (in_genres is null or m.genres @> in_genres) and
    (in_not_genres is null or not (m.genres && in_not_genres)) and
    (in_release_year_min is null or extract(year from m.release_date) >= in_release_year_min) and
    (in_release_year_max is null or extract(year from m.release_date) <= in_release_year_max) and
    (in_max_runtime is null or m.runtime <= in_max_runtime) and
    (in_spoken_language is null or exists (select 1 from jsonb_array_elements(m.spoken_languages) as lang where lower(lang->>'english_name') = lower(in_spoken_language))) and
    (in_actor_name is null or exists (select 1 from jsonb_array_elements(m.top_cast) as actor where lower(actor->>'name') ilike '%' || lower(in_actor_name) || '%')) and
    (in_not_actor_name is null or not exists (select 1 from jsonb_array_elements(m.top_cast) as actor where lower(actor->>'name') ilike '%' || lower(in_not_actor_name) || '%')) and
    (in_director_name is null or lower(m.director) ilike '%' || lower(in_director_name) || '%') and
    (in_not_director_name is null or lower(m.director) not ilike '%' || lower(in_not_director_name) || '%') and
    m.embedding is not null
  
  -- --- THIS IS THE CRITICAL CHANGE ---
  -- We now only apply the semantic filter IF 'rank only' mode is OFF.
  and (
    in_rank_only_mode = true OR (1 - (m.embedding <=> in_user_vector)) >= in_match_threshold
  )
  -- --- END OF CHANGE ---

  order by score desc
  limit in_limit;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search(in_media_type text DEFAULT NULL::text, in_genres text[] DEFAULT NULL::text[], in_not_genres text[] DEFAULT NULL::text[], in_actor_name text DEFAULT NULL::text, in_not_actor_name text DEFAULT NULL::text, in_director_name text DEFAULT NULL::text, in_not_director_name text DEFAULT NULL::text, in_release_year_min integer DEFAULT NULL::integer, in_release_year_max integer DEFAULT NULL::integer, in_max_runtime integer DEFAULT NULL::integer, in_spoken_language text DEFAULT NULL::text, in_user_vector vector DEFAULT NULL::vector, in_match_threshold double precision DEFAULT 0.5, in_limit integer DEFAULT 21, in_rank_only_mode boolean DEFAULT false, in_page_number integer DEFAULT 1, in_page_size integer DEFAULT 21)
 RETURNS TABLE(id uuid, tmdb_id integer, media_type text, title text, synopsis text, genres text[], runtime integer, poster_path text, release_date date, popularity numeric, embedding vector, created_at timestamp with time zone, director text, tagline text, trailer_key text, backdrop_path text, logo_path text, top_cast jsonb, watch_providers jsonb, spoken_languages jsonb, score double precision)
 LANGUAGE plpgsql
AS $function$
begin
  -- Check if user vector is provided, as it's required for semantic search
  if in_user_vector is null then
    raise exception 'User vector is required for semantic search';
  end if;

  return query
  -- Stage 2: Join the initial vector matches with the full media table and apply hard filters.
  select
    m.*,
    vector_matches.score
  from
    public.media m
  inner join (
    -- Stage 1: Find the top 500 most semantically similar items using the vector index.
    -- This is extremely fast and creates our candidate pool.
    select
      sub.id,
      (1 - (sub.embedding <=> in_user_vector)) as score
    from
      public.media as sub
    where sub.embedding is not null
    order by
      sub.embedding <=> in_user_vector
    limit 500
  ) as vector_matches on m.id = vector_matches.id
  where
    -- All the hard filters are now applied to the small candidate pool of 500.
    (in_media_type is null or m.media_type = in_media_type) and
    (in_genres is null or m.genres @> in_genres) and
    (in_not_genres is null or not (m.genres && in_not_genres)) and
    (in_release_year_min is null or extract(year from m.release_date) >= in_release_year_min) and
    (in_release_year_max is null or extract(year from m.release_date) <= in_release_year_max) and
    (in_max_runtime is null or m.runtime <= in_max_runtime) and
    (in_spoken_language is null or exists (select 1 from jsonb_array_elements(m.spoken_languages) as lang where lower(lang->>'english_name') = lower(in_spoken_language))) and
    (in_actor_name is null or exists (select 1 from jsonb_array_elements(m.top_cast) as actor where lower(actor->>'name') ilike '%' || lower(in_actor_name) || '%')) and
    (in_not_actor_name is null or not exists (select 1 from jsonb_array_elements(m.top_cast) as actor where lower(actor->>'name') ilike '%' || lower(in_not_actor_name) || '%')) and
    (in_director_name is null or lower(m.director) ilike '%' || lower(in_director_name) || '%') and
    (in_not_director_name is null or lower(m.director) not ilike '%' || lower(in_not_director_name) || '%') and
    -- Apply the match threshold if not in rank-only mode
    (in_rank_only_mode = true OR vector_matches.score >= in_match_threshold)
  -- Stage 3: Order the final, filtered results and apply pagination.
  order by
    vector_matches.score desc
  limit
    in_page_size
  offset
    (in_page_number - 1) * in_page_size;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search(in_media_type text DEFAULT NULL::text, in_genres text[] DEFAULT NULL::text[], in_not_genres text[] DEFAULT NULL::text[], in_actor_name text DEFAULT NULL::text, in_not_actor_name text DEFAULT NULL::text, in_director_name text DEFAULT NULL::text, in_not_director_name text DEFAULT NULL::text, in_release_year_min integer DEFAULT NULL::integer, in_release_year_max integer DEFAULT NULL::integer, in_max_runtime integer DEFAULT NULL::integer, in_spoken_language text DEFAULT NULL::text, in_user_vector vector DEFAULT NULL::vector, in_page_number integer DEFAULT 1, in_page_size integer DEFAULT 21)
 RETURNS TABLE(id uuid, tmdb_id integer, media_type text, title text, synopsis text, genres text[], runtime integer, poster_path text, release_date date, popularity numeric, embedding vector, created_at timestamp with time zone, director text, tagline text, trailer_key text, backdrop_path text, logo_path text, top_cast jsonb, watch_providers jsonb, spoken_languages jsonb, score double precision)
 LANGUAGE plpgsql
AS $function$
begin
  -- Check if user vector is provided, as it's required for the search
  if in_user_vector is null then
    raise exception 'User vector is required for semantic search';
  end if;

  return query
  select
    m.*,
    vector_matches.score
  from
    public.media m
  inner join (
    -- Stage 1: Fast vector index scan for the top 500 candidates
    select sub.id, (1 - (sub.embedding <=> in_user_vector)) as score
    from public.media as sub
    where sub.embedding is not null
    order by sub.embedding <=> in_user_vector
    limit 500
  ) as vector_matches on m.id = vector_matches.id
  where
    -- Stage 2: Apply all hard filters to the small candidate pool
    (in_media_type is null or m.media_type = in_media_type) and
    (in_genres is null or m.genres @> in_genres) and
    (in_not_genres is null or not (m.genres && in_not_genres)) and
    (in_release_year_min is null or extract(year from m.release_date) >= in_release_year_min) and
    (in_release_year_max is null or extract(year from m.release_date) <= in_release_year_max) and
    (in_max_runtime is null or m.runtime <= in_max_runtime) and
    (in_spoken_language is null or exists (select 1 from jsonb_array_elements(m.spoken_languages) as lang where lower(lang->>'english_name') = lower(in_spoken_language))) and
    (in_actor_name is null or exists (select 1 from jsonb_array_elements(m.top_cast) as actor where lower(actor->>'name') ilike '%' || lower(in_actor_name) || '%')) and
    (in_not_actor_name is null or not exists (select 1 from jsonb_array_elements(m.top_cast) as actor where lower(actor->>'name') ilike '%' || lower(in_not_actor_name) || '%')) and
    (in_director_name is null or lower(m.director) ilike '%' || lower(in_director_name) || '%') and
    (in_not_director_name is null or lower(m.director) not ilike '%' || lower(in_not_director_name) || '%')
  order by
    vector_matches.score desc
  limit in_page_size
  offset (in_page_number - 1) * in_page_size;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search(in_media_type text DEFAULT NULL::text, in_genres text[] DEFAULT NULL::text[], in_not_genres text[] DEFAULT NULL::text[], in_actor_name text DEFAULT NULL::text, in_not_actor_name text DEFAULT NULL::text, in_director_name text DEFAULT NULL::text, in_not_director_name text DEFAULT NULL::text, in_release_year_min integer DEFAULT NULL::integer, in_release_year_max integer DEFAULT NULL::integer, in_max_runtime integer DEFAULT NULL::integer, in_spoken_language text DEFAULT NULL::text, in_user_vector vector DEFAULT NULL::vector, in_page_number integer DEFAULT 1, in_page_size integer DEFAULT 21, in_exclude_nsfw boolean DEFAULT true)
 RETURNS TABLE(tmdb_id integer, media_type text, title text, poster_path text, release_date date, popularity numeric, score numeric)
 LANGUAGE sql
AS $function$
with base as (
  select
    m.*,
    case
      when in_user_vector is null or m.embedding is null then 0
      else 1 - (m.embedding <=> in_user_vector)     -- cosine sim
    end as sim
  from public.media m
  where (in_media_type is null or m.media_type = in_media_type)
    and (in_genres is null or m.genres @> in_genres)
    and (in_not_genres is null or not (m.genres && in_not_genres))
    and (in_actor_name is null or exists (
          select 1 from jsonb_array_elements(m.top_cast) a
          where a->>'name' ilike '%'||in_actor_name||'%'
        ))
    and (in_not_actor_name is null or not exists (
          select 1 from jsonb_array_elements(m.top_cast) a
          where a->>'name' ilike '%'||in_not_actor_name||'%'
        ))
    and (in_director_name is null or m.director ilike '%'||in_director_name||'%')
    and (in_not_director_name is null or (m.director is null or m.director not ilike '%'||in_not_director_name||'%'))
    and (in_release_year_min is null or extract(year from m.release_date) >= in_release_year_min)
    and (in_release_year_max is null or extract(year from m.release_date) <= in_release_year_max)
    and (in_max_runtime is null or m.runtime <= in_max_runtime)
    and (
      in_spoken_language is null or exists (
        select 1 from jsonb_array_elements(m.spoken_languages) sl
        where lower(sl->>'english_name') = lower(in_spoken_language)
           or lower(sl->>'name') = lower(in_spoken_language)
           or lower(sl->>'iso_639_1') = lower(in_spoken_language)
      )
    )
    and (case when in_exclude_nsfw then coalesce(m.nsfw_flag,false) = false else true end)
),
ranked as (
  select
    tmdb_id, media_type, title, poster_path, release_date, popularity,
    (0.7*sim + 0.3*least(coalesce(popularity,0)/1000.0, 1.0)) as score
  from base
)
select *
from ranked
order by score desc nulls last, popularity desc nulls last
limit in_page_size
offset greatest(in_page_number-1,0) * in_page_size;
$function$
;

CREATE OR REPLACE FUNCTION public.hybrid_search(in_media_type text DEFAULT NULL::text, in_genres text[] DEFAULT NULL::text[], in_not_genres text[] DEFAULT NULL::text[], in_actor_name text DEFAULT NULL::text, in_not_actor_name text DEFAULT NULL::text, in_director_name text DEFAULT NULL::text, in_not_director_name text DEFAULT NULL::text, in_release_year_min integer DEFAULT NULL::integer, in_release_year_max integer DEFAULT NULL::integer, in_max_runtime integer DEFAULT NULL::integer, in_spoken_language text DEFAULT NULL::text, in_user_vector vector DEFAULT NULL::vector, in_rank_only_mode boolean DEFAULT false, in_page_number integer DEFAULT 1, in_page_size integer DEFAULT 21)
 RETURNS TABLE(id uuid, tmdb_id integer, media_type text, title text, synopsis text, genres text[], runtime integer, poster_path text, release_date date, popularity numeric, embedding vector, created_at timestamp with time zone, director text, tagline text, trailer_key text, backdrop_path text, logo_path text, top_cast jsonb, watch_providers jsonb, spoken_languages jsonb, score double precision)
 LANGUAGE plpgsql
AS $function$
begin
  -- This function now has two distinct paths based on the query type.

  if in_rank_only_mode then
    -- PATH A: For simple genre queries. "Filter-First" then "Rank".
    -- This is less strict and ensures we get all items of the correct genre.
    return query
    select
      m.*,
      (1 - (m.embedding <=> in_user_vector)) as score
    from public.media m
    where
      (in_media_type is null or m.media_type = in_media_type) and
      (in_genres is null or m.genres @> in_genres) and
      -- All other hard filters...
      (in_not_genres is null or not (m.genres && in_not_genres)) and
      (in_release_year_min is null or extract(year from m.release_date) >= in_release_year_min) and
      (in_release_year_max is null or extract(year from m.release_date) <= in_release_year_max) and
      -- Add check for null vector to avoid errors
      in_user_vector is not null
    order by
      score desc
    limit
      in_page_size
    offset
      (in_page_number - 1) * in_page_size;

  else
    -- PATH B: For complex, thematic queries. "Index-First" then "Filter".
    -- This is stricter and faster for queries without a simple genre filter.
    return query
    select
      m.*,
      vector_matches.score
    from public.media m
    inner join (
      select sub.id, (1 - (sub.embedding <=> in_user_vector)) as score
      from public.media as sub
      where 
        sub.embedding is not null and
        in_user_vector is not null -- Add check for null vector
      order by sub.embedding <=> in_user_vector
      limit 500 -- Create the initial candidate pool
    ) as vector_matches on m.id = vector_matches.id
    where
      (in_media_type is null or m.media_type = in_media_type) and
      (in_genres is null or m.genres @> in_genres) and
      -- All other hard filters...
      (in_not_genres is null or not (m.genres && in_not_genres)) and
      (in_release_year_min is null or extract(year from m.release_date) >= in_release_year_min) and
      (in_release_year_max is null or extract(year from m.release_date) <= in_release_year_max)
    order by
      vector_matches.score desc
    limit
      in_page_size
    offset
      (in_page_number - 1) * in_page_size;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.master_search(search_term text, in_genre text DEFAULT NULL::text, in_actor_name text DEFAULT NULL::text, in_max_runtime integer DEFAULT NULL::integer, page_number integer DEFAULT 1, page_size integer DEFAULT 21)
 RETURNS TABLE(id uuid, tmdb_id integer, media_type text, title text, poster_path text, popularity numeric, rank real, match_type text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    search_offset INT;
BEGIN
    search_offset := (page_number - 1) * page_size;

    RETURN QUERY
    SELECT
        m.id,
        m.tmdb_id,
        m.media_type,
        m.title,
        m.poster_path,
        m.popularity,
        -- --- THIS IS THE FIX ---
        -- Explicitly cast the result of the CASE statement to REAL to match the RETURNS TABLE definition.
        (CASE
            WHEN similarity(m.title, search_term) > 0.3 THEN 1.0
            WHEN similarity(m.title, search_term) > 0.1 THEN 0.8
            ELSE 0.5
        END)::real AS rank, -- The fix: add ::real
        -- --- END OF FIX ---
        CASE
            WHEN similarity(m.title, search_term) > 0.1 THEN 'title'
            ELSE 'actor'
        END AS match_type
    FROM
        public.media AS m
    WHERE
        (
            similarity(m.title, search_term) > 0.1
            OR
            (
                jsonb_typeof(m.top_cast) = 'array' AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(m.top_cast) AS actor
                    WHERE actor->>'name' ILIKE ('%' || search_term || '%')
                )
            )
        )
        AND (in_genre IS NULL OR m.genres @> ARRAY[in_genre])
        AND (in_actor_name IS NULL OR (
            jsonb_typeof(m.top_cast) = 'array' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(m.top_cast) AS actor
                WHERE actor->>'name' ILIKE ('%' || in_actor_name || '%')
            )
        ))
        AND (in_max_runtime IS NULL OR m.runtime <= in_max_runtime)
    ORDER BY
        rank DESC,
        popularity DESC
    LIMIT page_size
    OFFSET search_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_media(in_actor_name text DEFAULT NULL::text, in_genre text DEFAULT NULL::text, in_user_vector vector DEFAULT NULL::vector, in_year_max integer DEFAULT NULL::integer, in_year_min integer DEFAULT NULL::integer, in_max_runtime integer DEFAULT NULL::integer, match_count integer DEFAULT 10, match_threshold real DEFAULT 0.7)
 RETURNS SETOF media
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM public.media AS m
  WHERE
    -- The WHERE clause is now more flexible. It checks if the provided filters match.
    -- This is no longer strictly tied to the vector search.
    (in_genre IS NULL OR m.genres @> ARRAY[in_genre])
    AND (in_max_runtime IS NULL OR m.runtime <= in_max_runtime)
    AND (in_year_min IS NULL OR EXTRACT(YEAR FROM m.release_date) >= in_year_min)
    AND (in_year_max IS NULL OR EXTRACT(YEAR FROM m.release_date) <= in_year_max)
    AND (
      -- The actor search is now case-insensitive (ILIKE) and handles partial matches.
      in_actor_name IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(m.top_cast) a
        WHERE a->>'name' ILIKE '%' || in_actor_name || '%'
      )
    )
  ORDER BY
    -- We now use the vector embedding as the PRIMARY sorting criteria to rank the results,
    -- ensuring the most semantically relevant results appear first.
    (m.embedding <=> in_user_vector) ASC,
    -- Popularity is used as a secondary tie-breaker.
    m.popularity DESC
  LIMIT match_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.match_media(in_user_vector vector, in_genres text[] DEFAULT NULL::text[], in_max_runtime integer DEFAULT NULL::integer, in_year_min integer DEFAULT NULL::integer, in_year_max integer DEFAULT NULL::integer, match_count integer DEFAULT 10)
 RETURNS SETOF media
 LANGUAGE plpgsql
AS $function$
begin
  return query
  select
    m.*
  from
    public.media m
  where
    -- Apply simple, structured filters first.
    (in_genres is null or m.genres && in_genres) and
    (in_max_runtime is null or m.runtime <= in_max_runtime) and
    (in_year_min is null or extract(year from m.release_date) >= in_year_min) and
    (in_year_max is null or extract(year from m.release_date) <= in_year_max)
  -- Then, find the nearest neighbors within that filtered set.
  order by
    m.embedding <=> in_user_vector
  limit
    match_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.media_search_title_sync()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.search_title := public.search_normalize(new.title);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.search_media(in_query text, page_number integer DEFAULT 1, page_size integer DEFAULT 21, adult_mode boolean DEFAULT false)
 RETURNS TABLE(tmdb_id integer, media_type text, title text, poster_path text, backdrop_path text, release_date date, popularity numeric, similarity numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with q as (select public.search_normalize(trim(in_query)) as q),
  toks as (
    select tok from regexp_split_to_table((select q from q), '\s+') as tok
    where length(tok) >= 2
  ),
  tok_stats as (select count(*)::int as tok_count from toks),
  params as (
    select greatest(300, page_size * 60) as k
    from (values (page_size)) v(page_size)
  ),

  -- KNN pool (GiST trigram)
  title_cand as (
    select
      m.tmdb_id, m.media_type, m.title, m.poster_path, m.backdrop_path,
      m.release_date, m.popularity, m.search_title,
      similarity(m.search_title, (select q from q)) as phrase_sim,
      m.search_title <-> (select q from q)         as phrase_dist
    from public.media m
    where (select q from q) <> '' and m.popularity is not null
    order by m.search_title <-> (select q from q)
    limit (select k from params)
  ),

  -- token filters inside the KNN pool
  title_and as (
    select c.tmdb_id, c.media_type, c.title, c.poster_path, c.backdrop_path,
           c.release_date, c.popularity, c.phrase_sim, c.phrase_dist,
           3 as tier
    from title_cand c
    where (select tok_count from tok_stats) = 0
       or (select count(*) from toks t
           where c.search_title like '%'||t.tok||'%')
          = (select tok_count from tok_stats)
  ),
  title_or as (
    select c.tmdb_id, c.media_type, c.title, c.poster_path, c.backdrop_path,
           c.release_date, c.popularity, c.phrase_sim, c.phrase_dist,
           2 as tier
    from title_cand c
    where (select tok_count from tok_stats) > 0
      and (select count(*) from toks t
           where c.search_title like '%'||t.tok||'%') >= 1
  ),

  -- substring LIKE (GIN trigram), not limited by KNN pool
  title_like as (
    select
      m.tmdb_id, m.media_type, m.title, m.poster_path, m.backdrop_path,
      m.release_date, m.popularity,
      similarity(m.search_title, (select q from q)) as phrase_sim,
      m.search_title <-> (select q from q)         as phrase_dist,
      2 as tier
    from public.media m
    where (select q from q) <> ''
      and m.popularity is not null
      and m.search_title like '%' || (select q from q) || '%'
    order by m.popularity desc
    limit (select k from params)
  ),

  -- guarded KNN fallback (only if LIKE finds nothing)
  title_knn_fallback as (
    select c.tmdb_id, c.media_type, c.title, c.poster_path, c.backdrop_path,
           c.release_date, c.popularity, c.phrase_sim, c.phrase_dist,
           1 as tier
    from title_cand c
    where c.phrase_sim >= 0.20
  ),

  -- cast matches
  cast_matches as (
    select
      m.tmdb_id, m.media_type, m.title, m.poster_path, m.backdrop_path,
      m.release_date, m.popularity,
      similarity(public.search_normalize(c.name), (select q from q)) as phrase_sim,
      public.search_normalize(c.name) <-> (select q from q)          as phrase_dist,
      4 as tier
    from public.media m
    join public.media_cast c on c.tmdb_id = m.tmdb_id
    where (select q from q) <> ''
      and (
        public.search_normalize(c.name) % (select q from q)
        or exists (select 1 from toks t
                   where public.search_normalize(c.name) like '%'||t.tok||'%')
      )
  ),

  have_like as (select count(*)::int as n from title_like),

  unioned as (
    select tmdb_id, media_type, title, poster_path, backdrop_path,
           release_date, popularity, phrase_sim, phrase_dist, tier from cast_matches
    union all
    select tmdb_id, media_type, title, poster_path, backdrop_path,
           release_date, popularity, phrase_sim, phrase_dist, tier from title_and
    union all
    select tmdb_id, media_type, title, poster_path, backdrop_path,
           release_date, popularity, phrase_sim, phrase_dist, tier from title_like
    union all
    select tmdb_id, media_type, title, poster_path, backdrop_path,
           release_date, popularity, phrase_sim, phrase_dist, tier from title_or
    union all
    select tmdb_id, media_type, title, poster_path, backdrop_path,
           release_date, popularity, phrase_sim, phrase_dist, tier
    from title_knn_fallback
    where (select n from have_like) = 0
  ),

  ranked as (
    select distinct on (tmdb_id)
      tmdb_id, media_type, title, poster_path, backdrop_path,
      release_date, popularity, phrase_sim, phrase_dist, tier
    from unioned
    order by tmdb_id, tier desc, phrase_dist asc, popularity desc
  )

  select
    tmdb_id, media_type, title, poster_path, backdrop_path,
    release_date, popularity, phrase_sim as similarity
  from ranked
  order by tier desc, phrase_dist asc, similarity desc, popularity desc, tmdb_id desc
  offset greatest(0, (page_number - 1) * page_size)
  limit page_size;
$function$
;

CREATE OR REPLACE FUNCTION public.search_media_by_keyword(keyword text)
 RETURNS TABLE(tmdb_id integer, media_type text, title text, poster_path text)
 LANGUAGE sql
AS $function$
  -- This CTE finds all possible matches and assigns a rank.
  -- Rank 1 is the best.
  WITH ranked_results AS (
    -- Tier 1: Exact title match
    SELECT m.tmdb_id, m.media_type, m.title, m.poster_path, m.popularity, 1 AS rank
    FROM public.media m
    WHERE m.title ILIKE keyword

    UNION ALL

    -- Tier 2: Actor match
    SELECT m.tmdb_id, m.media_type, m.title, m.poster_path, m.popularity, 2 AS rank
    FROM public.media m
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(m.top_cast) AS actor WHERE actor->>'name' ILIKE '%' || keyword || '%'
    )

    UNION ALL

    -- Tier 3: Genre match
    SELECT m.tmdb_id, m.media_type, m.title, m.poster_path, m.popularity, 3 AS rank
    FROM public.media m
    WHERE EXISTS (
        SELECT 1 FROM unnest(m.genres) AS g WHERE g ILIKE keyword
    )

    UNION ALL

    -- Tier 4: Partial title keyword match
    SELECT m.tmdb_id, m.media_type, m.title, m.poster_path, m.popularity, 4 AS rank
    FROM public.media m
    WHERE m.title ILIKE '%' || keyword || '%'

    UNION ALL

    -- Tier 5: Synopsis keyword match
    SELECT m.tmdb_id, m.media_type, m.title, m.poster_path, m.popularity, 5 AS rank
    FROM public.media m
    WHERE m.synopsis ILIKE '%' || keyword || '%'
  )
  -- This final query makes sure each movie appears only once,
  -- and then sorts the entire list by the best rank found for that movie.
  SELECT
    r.tmdb_id,
    r.media_type,
    r.title,
    r.poster_path
  FROM (
    -- Use a window function to find the best rank for each movie
    SELECT
      tmdb_id, media_type, title, poster_path, popularity,
      ROW_NUMBER() OVER(PARTITION BY tmdb_id ORDER BY rank ASC) as rn
    FROM ranked_results
  ) r
  WHERE r.rn = 1 -- Only take the best rank for each movie
  ORDER BY
    (SELECT MIN(rank) FROM ranked_results WHERE tmdb_id = r.tmdb_id), -- Sort by the best rank
    r.popularity DESC -- Then by popularity
  LIMIT 50;
$function$
;

CREATE OR REPLACE FUNCTION public.search_normalize(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select lower(public.unaccent(coalesce(t,'')));
$function$
;

CREATE OR REPLACE FUNCTION public.v2_match_media(in_user_vector vector, in_genres text[] DEFAULT NULL::text[], in_max_runtime integer DEFAULT NULL::integer, in_year_min integer DEFAULT NULL::integer, in_year_max integer DEFAULT NULL::integer, match_count integer DEFAULT 10)
 RETURNS SETOF media
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM public.media m
  WHERE
    (in_genres IS NULL OR m.genres && in_genres) AND
    (in_max_runtime IS NULL OR m.runtime <= in_max_runtime) AND
    (in_year_min IS NULL OR EXTRACT(YEAR FROM m.release_date) >= in_year_min) AND
    (in_year_max IS NULL OR EXTRACT(YEAR FROM m.release_date) <= in_year_max)
  ORDER BY
    m.embedding <=> in_user_vector
  LIMIT
    match_count;
END;
$function$
;

grant delete on table "public"."media_cast" to "anon";

grant insert on table "public"."media_cast" to "anon";

grant references on table "public"."media_cast" to "anon";

grant select on table "public"."media_cast" to "anon";

grant trigger on table "public"."media_cast" to "anon";

grant truncate on table "public"."media_cast" to "anon";

grant update on table "public"."media_cast" to "anon";

grant delete on table "public"."media_cast" to "authenticated";

grant insert on table "public"."media_cast" to "authenticated";

grant references on table "public"."media_cast" to "authenticated";

grant select on table "public"."media_cast" to "authenticated";

grant trigger on table "public"."media_cast" to "authenticated";

grant truncate on table "public"."media_cast" to "authenticated";

grant update on table "public"."media_cast" to "authenticated";

grant delete on table "public"."media_cast" to "service_role";

grant insert on table "public"."media_cast" to "service_role";

grant references on table "public"."media_cast" to "service_role";

grant select on table "public"."media_cast" to "service_role";

grant trigger on table "public"."media_cast" to "service_role";

grant truncate on table "public"."media_cast" to "service_role";

grant update on table "public"."media_cast" to "service_role";

create policy "anon_safe_only"
on "public"."media"
as permissive
for select
to anon
using ((COALESCE(nsfw_flag, false) = false));


create policy "auth_safe_only"
on "public"."media"
as permissive
for select
to authenticated
using ((COALESCE(nsfw_flag, false) = false));


create policy "allow insert"
on "public"."query_log"
as permissive
for insert
to anon, authenticated
with check (true);


CREATE TRIGGER media_search_title_fill BEFORE INSERT OR UPDATE OF title ON public.media FOR EACH ROW EXECUTE FUNCTION media_search_title_sync();


