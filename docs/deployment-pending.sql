-- Lesson 19 reference schema. Applied only in disposable integration tests.
-- No HTTP endpoints, encryption service, outbox worker or runtime grants are installed by this file.
CREATE TABLE pending_approvals (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  actor_id text NOT NULL,
  session_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  request_id uuid NOT NULL,
  tool_call_id text NOT NULL,
  tool_name text NOT NULL,
  raw_arguments text NOT NULL,
  proposal_digest char(64) NOT NULL,
  state_ciphertext bytea NOT NULL,
  encryption_key_id text NOT NULL,
  sdk_version text NOT NULL,
  agent_revision text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','completed','unknown')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (tenant_id, request_id, tool_call_id)
);
CREATE TABLE approval_outbox (
  pending_id uuid PRIMARY KEY REFERENCES pending_approvals(id),
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
-- Store AEAD-encrypted RunState with bound metadata, not a plaintext SDK snapshot.
-- Only a backend adapter writes immutable proposal/identity fields. Protect them with DB privileges.
-- Decision transaction: reauthorize current session/membership, then conditional UPDATE
-- WHERE id/tenant/actor/session/conversation/revision match, status='pending', expires_at>now().
-- Insert outbox only for the one row returned; commit both together.
-- A worker revalidates authorization, loads/decrypts state, verifies exact pending call,
-- and resumes the original request. Add lease/fencing columns in the chosen worker adapter.
-- A crash after mutation commit but before completion requires receipt reconciliation.
-- This schema/outbox alone does not provide end-to-end exactly-once execution.
