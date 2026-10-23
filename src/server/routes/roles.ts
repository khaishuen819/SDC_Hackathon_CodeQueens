import { Router } from "express";
import { prisma } from "../db/client.ts";
import { RolesResponse } from "../contracts/index.ts";

export const rolesRouter = Router();

// GET /api/roles: roles with their skills and weights, read from the database.
rolesRouter.get("/api/roles", async (_req, res) => {
  const rows = await prisma.role.findMany({
    orderBy: { id: "asc" },
    include: {
      skills: {
        include: { skill: true },
        orderBy: [{ weight: "desc" }, { skillId: "asc" }],
      },
    },
  });

  const roles = rows.map((role) => ({
    roleId: role.id,
    name: role.name,
    description: role.description,
    skills: role.skills.map((rs) => ({
      skillId: rs.skillId,
      name: rs.skill.name,
      weight: rs.weight,
      isRequired: rs.isRequired,
    })),
    isPlaceholder:
      role.isPlaceholder || role.skills.some((rs) => rs.isPlaceholder || rs.skill.isPlaceholder),
  }));

  // Check our own output against the contract before sending it.
  res.json(RolesResponse.parse({ isPlaceholder: roles.some((r) => r.isPlaceholder), roles }));
});
