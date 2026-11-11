import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { memberships, organizations, users, type Database } from "@smartdocs/db";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../database/database.module";
import type { CreateMembershipDto } from "./dto/create-membership.dto";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  return candidate.code === "23505" || isUniqueViolation(candidate.cause);
}

@Injectable()
export class MembershipsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(input: CreateMembershipDto) {
    const [user] = await this.database.db.select({ id: users.id }).from(users).where(eq(users.id, input.userId));
    const [organization] = await this.database.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId));

    if (!user || !organization) {
      throw new NotFoundException("User or organization not found");
    }

    try {
      const [membership] = await this.database.db.insert(memberships).values(input).returning();
      return membership;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("This user is already a member of the organization");
      }
      throw error;
    }
  }

  findByOrganization(organizationId: string) {
    return this.database.db
      .select({
        id: memberships.id,
        role: memberships.role,
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.organizationId, organizationId), eq(users.isActive, true)));
  }
}
