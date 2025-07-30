-- First, we need to create a custom data type that matches the structure of our updates.
-- This makes the function safer and easier to use.
CREATE TYPE public.embedding_update AS (
    id_to_update UUID,
    embedding_vector VECTOR(1536)
);

-- Now, create the function that accepts an array of our new custom type.
CREATE OR REPLACE FUNCTION public.update_media_embeddings(updates embedding_update[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  -- Declare the loop variable
  update_item embedding_update;
BEGIN
  -- This loop iterates through the array of updates we send from our script
  -- and performs an UPDATE for each one. This is extremely fast because
  -- it all happens directly inside the database.
  FOREACH update_item IN ARRAY updates
  LOOP
    UPDATE public.media
    SET embedding = update_item.embedding_vector
    WHERE id = update_item.id_to_update;
  END LOOP;
END;
$$;