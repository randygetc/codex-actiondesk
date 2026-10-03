-- Deliberate step 1.4 violation. Never merge or apply to the normal local database.
create table public.guardrail_missing_rls_probe (
  id bigint generated always as identity primary key
);
