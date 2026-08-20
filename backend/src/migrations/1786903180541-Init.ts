import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1786903180541 implements MigrationInterface {
  name = 'Init1786903180541';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('HIKER', 'GUIDE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "displayName" character varying(80) NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."routes_difficulty_enum" AS ENUM('Easy', 'Moderate', 'Hard')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."routes_activity_enum" AS ENUM('Hiking', 'Biking')`,
    );
    await queryRunner.query(
      `CREATE TABLE "routes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "description" text NOT NULL, "difficulty" "public"."routes_difficulty_enum" NOT NULL, "activity" "public"."routes_activity_enum" NOT NULL, "authorId" uuid NOT NULL, "waypoints" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_76100511cdfa1d013c859f01d8b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tours" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "routeId" uuid NOT NULL, "guideId" uuid NOT NULL, "date" date NOT NULL, "startTime" TIME NOT NULL, "capacity" integer NOT NULL, "bookedCount" integer NOT NULL DEFAULT '0', "meetingPoint" character varying(200) NOT NULL, "pace" character varying(100) NOT NULL, "notes" text NOT NULL DEFAULT '', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2202ba445792c1ad0edf2de8de2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "tourId" uuid NOT NULL, "hikerId" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'CONFIRMED', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2f0d8fe10f7fb507f4559a15e90" UNIQUE ("tourId", "hikerId"), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" ADD CONSTRAINT "FK_a41500fa5bdec5f0e0ca6ecd968" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tours" ADD CONSTRAINT "FK_eb44bf767180867ac56654b8973" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tours" ADD CONSTRAINT "FK_93b0c06924a04d70e3426d73d7a" FOREIGN KEY ("guideId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_1dcbd171601b61419854320c1b1" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_eb903b64968b5a557fe28022bc5" FOREIGN KEY ("hikerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_eb903b64968b5a557fe28022bc5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_1dcbd171601b61419854320c1b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT "FK_93b0c06924a04d70e3426d73d7a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT "FK_eb44bf767180867ac56654b8973"`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" DROP CONSTRAINT "FK_a41500fa5bdec5f0e0ca6ecd968"`,
    );
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TABLE "tours"`);
    await queryRunner.query(`DROP TABLE "routes"`);
    await queryRunner.query(`DROP TYPE "public"."routes_activity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."routes_difficulty_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
