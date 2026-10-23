-- CreateEnum
CREATE TYPE "ResourceCost" AS ENUM ('free', 'paid', 'unknown');

-- CreateEnum
CREATE TYPE "TrendDirection" AS ENUM ('rising', 'declining');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleSkill" (
    "roleId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoleSkill_pkey" PRIMARY KEY ("roleId","skillId")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cost" "ResourceCost" NOT NULL,
    "estimatedHours" INTEGER NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SdgGoal" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SdgGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleSdg" (
    "roleId" TEXT NOT NULL,
    "sdgId" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoleSdg_pkey" PRIMARY KEY ("roleId","sdgId")
);

-- CreateTable
CREATE TABLE "SkillSdg" (
    "skillId" TEXT NOT NULL,
    "sdgId" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SkillSdg_pkey" PRIMARY KEY ("skillId","sdgId")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedDate" DATE NOT NULL,
    "retrievedAt" DATE NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendEvidence" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "direction" "TrendDirection" NOT NULL,
    "summary" TEXT NOT NULL,
    "supportedClaim" TEXT NOT NULL,
    "limitation" TEXT NOT NULL,
    "priorityAdjustment" DOUBLE PRECISION,
    "adjustmentExplanation" TEXT,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrendEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SdgGoal_number_key" ON "SdgGoal"("number");

-- AddForeignKey
ALTER TABLE "RoleSkill" ADD CONSTRAINT "RoleSkill_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleSkill" ADD CONSTRAINT "RoleSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleSdg" ADD CONSTRAINT "RoleSdg_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleSdg" ADD CONSTRAINT "RoleSdg_sdgId_fkey" FOREIGN KEY ("sdgId") REFERENCES "SdgGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSdg" ADD CONSTRAINT "SkillSdg_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSdg" ADD CONSTRAINT "SkillSdg_sdgId_fkey" FOREIGN KEY ("sdgId") REFERENCES "SdgGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendEvidence" ADD CONSTRAINT "TrendEvidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendEvidence" ADD CONSTRAINT "TrendEvidence_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
