import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

  async assertMember(userId: string, organizationId: string, requiredRole?: "admin" | "editor" | "viewer") {
    const [membership] = await this.database.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId)));

    if (!membership) {
      throw new ForbiddenException("You do not belong to this organization");
    }

    if (requiredRole && membership.role !== requiredRole && membership.role !== "admin") {
      throw new ForbiddenException(`The ${requiredRole} role is required`);
    }

    return membership;
  }

  async create(input: CreateMembershipDto, actorUserId: string) {
    await this.assertMember(actorUserId, input.organizationId, "admin");

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

  async findByOrganization(organizationId: string, actorUserId: string) {
    await this.assertMember(actorUserId, organizationId);

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
