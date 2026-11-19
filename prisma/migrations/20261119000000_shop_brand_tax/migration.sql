-- Shop-facing branding and the shop's sales-tax rule.
-- Only rewrite the default shop's old seeded values; custom names/rates stay.
UPDATE "Shop"
SET "name" = 'B&V Mobile Mechanic'
WHERE "name" IN ('B&V Mobile Auto', 'My Shop');

UPDATE "Shop"
SET "taxRate" = 0.105
WHERE "isDefault" = true
  AND "taxRate" IN (0, 0.0825, 8.25);
