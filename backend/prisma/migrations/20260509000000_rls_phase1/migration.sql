-- RFC-006 Phase-1: Row-Level Security on org_members and org_questions

-- Enable RLS on org_members table
ALTER TABLE "public"."org_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."org_members" FORCE ROW LEVEL SECURITY;

-- Create policy for org_members: users can only see/modify members of their org
CREATE POLICY org_members_org_isolation ON "public"."org_members"
  FOR ALL
  USING (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  )
  WITH CHECK (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  );

-- Enable RLS on org_questions table
ALTER TABLE "public"."org_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."org_questions" FORCE ROW LEVEL SECURITY;

-- Create policy for org_questions: users can only see/modify questions in their org
CREATE POLICY org_questions_org_isolation ON "public"."org_questions"
  FOR ALL
  USING (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  )
  WITH CHECK (
    org_id::text = COALESCE(current_setting('app.org_id', true), '')
  );

-- Log successful migration
DO $$ BEGIN
  RAISE NOTICE 'RFC-006 Phase-1 RLS enabled on org_members and org_questions';
END $$;
