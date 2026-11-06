import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDatabase, type Database } from "@smartdocs/db";

export const DATABASE = Symbol("DATABASE");

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Database => {
        const databaseUrl = configService.get<string>("DATABASE_URL");

        if (!databaseUrl) {
          throw new Error("DATABASE_URL is required to initialize the database");
        }

        return createDatabase(databaseUrl);
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
