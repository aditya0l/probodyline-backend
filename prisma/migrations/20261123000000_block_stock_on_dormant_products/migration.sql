-- A dormant product cannot take any stock IN or OUT.
-- Enforced in the database so every path (stock page, POs, sales orders,
-- dispatch, PI bookings, imports) is covered. The API maps the error to a 400.
CREATE OR REPLACE FUNCTION block_stock_on_dormant_product() RETURNS trigger AS $$
DECLARE
  dormant_model TEXT;
BEGIN
  SELECT "modelNumber" INTO dormant_model
  FROM "products"
  WHERE "id" = NEW."productId" AND "isDormant" = true;

  IF FOUND THEN
    RAISE EXCEPTION 'PRODUCT_DORMANT: % is dormant and cannot take stock in or out', dormant_model
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stock_transactions_block_dormant ON "stock_transactions";
CREATE TRIGGER stock_transactions_block_dormant
  BEFORE INSERT OR UPDATE OF "productId" ON "stock_transactions"
  FOR EACH ROW EXECUTE FUNCTION block_stock_on_dormant_product();
