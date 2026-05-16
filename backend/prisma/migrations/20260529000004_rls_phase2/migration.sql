-- RFC-006 Phase-2: Row-Level Security on org_groups, org_invites, and assessments

-- Enable RLS on org_groups table
ALTER TABLE "public"."org_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."org_groups" FORCE ROW LEVEL SECURITY;

-- Create policy for org_groups: users can only see/modify groups of their org
CREATE POLICY org_groups_org_isolation ON "public"."org_groups"
  FOR ALL
  USING (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  )
  WITH CHECK (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  );

-- Enable RLS on org_invites table
ALTER TABLE "public"."org_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."org_invites" FORCE ROW LEVEL SECURITY;

-- Create policy for org_invites: users can only see/modify invites of their org
CREATE POLICY org_invites_org_isolation ON "public"."org_invites"
  FOR ALL
  USING (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  )
  WITH CHECK (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  );

-- Enable RLS on assessments table
ALTER TABLE "public"."assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."assessments" FORCE ROW LEVEL SECURITY;

-- Create policy for assessments: users can only see/modify assessments of their org
CREATE POLICY assessments_org_isolation ON "public"."assessments"
  FOR ALL
  USING (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  )
  WITH CHECK (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  );

-- Log successful migration
DO $$ BEGIN
  RAISE NOTICE 'RFC-006 Phase-2 RLS enabled on org_groups, org_invites, and assessments';
END $$;
