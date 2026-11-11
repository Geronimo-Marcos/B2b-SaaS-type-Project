import { IsIn, IsUUID } from "class-validator";

export class CreateMembershipDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  organizationId!: string;

  @IsIn(["admin", "editor", "viewer"])
  role!: "admin" | "editor" | "viewer";
}
