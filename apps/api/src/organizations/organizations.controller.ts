import { Body, Controller, Get, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Body() input: CreateOrganizationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.create(input, user.sub);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findAll(user.sub);
  }
}
