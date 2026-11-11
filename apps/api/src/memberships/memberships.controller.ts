import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { CreateMembershipDto } from "./dto/create-membership.dto";
import { MembershipsService } from "./memberships.service";

@Controller("memberships")
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  create(@Body() input: CreateMembershipDto) {
    return this.membershipsService.create(input);
  }

  @Get("organization/:organizationId")
  findByOrganization(@Param("organizationId", ParseUUIDPipe) organizationId: string) {
    return this.membershipsService.findByOrganization(organizationId);
  }
}
