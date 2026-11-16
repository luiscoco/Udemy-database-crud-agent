-- Local course bootstrap. The fixed password is for the loopback-only demo.
-- Use a secrets manager and separate migration identity in a deployed service.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inventory_app') THEN
    CREATE ROLE inventory_app LOGIN PASSWORD 'inventory_app_demo'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO inventory_app;
GRANT CONNECT ON DATABASE inventory TO inventory_app;

GRANT SELECT, INSERT, UPDATE ON products TO inventory_app;
GRANT SELECT, INSERT ON operation_receipts TO inventory_app;
GRANT INSERT ON audit_logs TO inventory_app;
-- The application is not the table owner and receives no DELETE, TRUNCATE,
-- audit UPDATE/DELETE, schema CREATE, or role administration privileges.
