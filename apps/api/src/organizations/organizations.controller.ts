import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Body() input: CreateOrganizationDto) {
    return this.organizationsService.create(input);
  }

  @Get()
  findAll() {
    return this.organizationsService.findAll();
  }
}
