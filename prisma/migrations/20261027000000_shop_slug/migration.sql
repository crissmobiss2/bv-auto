-- Public URL key for each shop (booking and sign-up links).
ALTER TABLE "Shop" ADD COLUMN "slug" TEXT;

WITH base AS (
  SELECT "id",
         coalesce(nullif(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'shop') AS s,
         row_number() OVER (
           PARTITION BY coalesce(nullif(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'shop')
           ORDER BY "createdAt", "id"
         ) AS rn
  FROM "Shop"
)
UPDATE "Shop" SET "slug" = CASE WHEN base.rn = 1 THEN base.s ELSE base.s || '-' || base.rn END
FROM base WHERE base."id" = "Shop"."id";

CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");
