import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { CreateMembershipDto } from "./dto/create-membership.dto";
import { MembershipsService } from "./memberships.service";

@Controller("memberships")
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  create(@Body() input: CreateMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membershipsService.create(input, user.sub);
  }

  @Get("organization/:organizationId")
  findByOrganization(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membershipsService.findByOrganization(organizationId, user.sub);
  }
}
