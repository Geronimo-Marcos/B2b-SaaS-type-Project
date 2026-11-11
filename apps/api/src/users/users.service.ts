import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { users, type Database } from "@smartdocs/db";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { DATABASE } from "../database/database.module";
import type { CreateUserDto } from "./dto/create-user.dto";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  return candidate.code === "23505" || isUniqueViolation(candidate.cause);
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(input: CreateUserDto) {
    try {
      const passwordHash = await hash(input.password, 12);
      const [user] = await this.database.db
        .insert(users)
        .values({
          email: input.email.trim().toLowerCase(),
          fullName: input.fullName.trim(),
          passwordHash,
        })
        .returning({ id: users.id, email: users.email, fullName: users.fullName, createdAt: users.createdAt });

      return user;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A user with this email already exists");
      }
      throw error;
    }
  }

  findAll() {
    return this.database.db
      .select({ id: users.id, email: users.email, fullName: users.fullName, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.isActive, true));
  }
}
