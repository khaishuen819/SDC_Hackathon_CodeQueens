-- CreateTable
CREATE TABLE "CriteriaSnapshot" (
    "id" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "CriteriaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriteriaHead" (
    "key" TEXT NOT NULL DEFAULT 'pilot',
    "snapshotId" TEXT,
    "nextGeneration" BIGINT NOT NULL DEFAULT 0,
    "publishedGeneration" BIGINT NOT NULL DEFAULT 0,
    "leaseGeneration" BIGINT,
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "nextAllowedAt" TIMESTAMPTZ(3),
    "lastAttemptAt" TIMESTAMPTZ(3),
    "lastSuccessAt" TIMESTAMPTZ(3),
    "state" JSONB NOT NULL,

    CONSTRAINT "CriteriaHead_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "CriteriaHead" ADD CONSTRAINT "CriteriaHead_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CriteriaSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Feature 2: a single head row only.
ALTER TABLE "CriteriaHead" ADD CONSTRAINT "CriteriaHead_single_pilot" CHECK ("key" = 'pilot');

-- Feature 2: snapshots are immutable history. Reject UPDATE, DELETE and TRUNCATE
-- for every role that is subject to triggers (a superuser can still disable them).
CREATE FUNCTION "criteria_snapshot_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CriteriaSnapshot rows are immutable';
END
$$;

CREATE TRIGGER "CriteriaSnapshot_no_update_delete" BEFORE UPDATE OR DELETE ON "CriteriaSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "criteria_snapshot_immutable"();

CREATE TRIGGER "CriteriaSnapshot_no_truncate" BEFORE TRUNCATE ON "CriteriaSnapshot"
  FOR EACH STATEMENT EXECUTE FUNCTION "criteria_snapshot_immutable"();
