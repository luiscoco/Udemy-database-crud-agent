-- Teaching baseline: PostgreSQL 17+. Run migrations with a separate owner role.
-- Model tools never execute this file or accept arbitrary SQL.
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sku varchar(32) NOT NULL CHECK (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  name varchar(120) NOT NULL CHECK (length(btrim(name)) > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  stock integer NOT NULL CHECK (stock >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_tenant_sku_key UNIQUE (tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS products_active_tenant_page_idx
  ON products (tenant_id, created_at, id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor_id varchar(128) NOT NULL,
  request_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  product_id uuid NOT NULL REFERENCES products(id),
  before_data jsonb,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_product_idx
  ON audit_logs (tenant_id, product_id, created_at);

-- Deliberately scoped to an exact normalized tool call within one host request.
-- This is not end-to-end deduplication across independently submitted user turns.
CREATE TABLE IF NOT EXISTS operation_receipts (
  tenant_id uuid NOT NULL,
  request_key char(64) NOT NULL,
  actor_id varchar(128) NOT NULL,
  request_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, request_key)
);

-- No database RLS is configured in this starter. Tenant isolation is enforced by
-- repository predicates and tested; add RLS as a separate defense-in-depth lesson.
-- A deployed runtime role should receive only SELECT/INSERT/UPDATE on products,
-- SELECT/INSERT on operation_receipts, and INSERT on audit_logs. No DDL or DELETE.
