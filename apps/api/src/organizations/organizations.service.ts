import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { organizations, type Database } from "@smartdocs/db";
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

  async create(input: CreateOrganizationDto) {
    try {
      const [organization] = await this.database.db
        .insert(organizations)
        .values({ name: input.name.trim(), slug: input.slug.trim() })
        .returning();

      return organization;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("An organization with this slug already exists");
      }

      throw error;
    }
  }

  async findAll() {
    return this.database.db
      .select()
      .from(organizations)
      .where(eq(organizations.status, "active"))
      .orderBy(asc(organizations.createdAt));
  }
}

