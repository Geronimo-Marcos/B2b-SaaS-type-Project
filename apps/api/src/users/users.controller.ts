import { Body, Controller, Get, Post } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Public()
  create(@Body() input: CreateUserDto) {
    return this.usersService.create(input);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
