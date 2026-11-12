import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { memberships, organizations, type Database } from "@smartdocs/db";
import { asc, eq } from "drizzle-orm";
import { DATABASE } from "../database/database.module";
import type { CreateOrganizationDto } from "./dto/create-organization.dto";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };

  return candidate.code === "23505" || isUniqueViolation(candidate.cause);
}

@Injectable()
export class OrganizationsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(input: CreateOrganizationDto, userId: string) {
    try {
      return await this.database.db.transaction(async (transaction) => {
        const [organization] = await transaction
          .insert(organizations)
          .values({ name: input.name.trim(), slug: input.slug.trim() })
          .returning();

        await transaction.insert(memberships).values({
          userId,
          organizationId: organization.id,
          role: "admin",
        });

        return organization;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("An organization with this slug already exists");
      }

      throw error;
    }
  }

  async findAll(userId: string) {
    return this.database.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .innerJoin(memberships, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(organizations.createdAt));
  }
}
