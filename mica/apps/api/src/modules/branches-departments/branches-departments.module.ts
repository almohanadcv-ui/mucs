import { Module } from "@nestjs/common";
import { BranchesController } from "./branches.controller";
import { BranchesService } from "./branches.service";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";
import { TeamsController } from "./teams.controller";
import { TeamsService } from "./teams.service";

@Module({
  controllers: [BranchesController, DepartmentsController, TeamsController],
  providers: [BranchesService, DepartmentsService, TeamsService],
  exports: [BranchesService, DepartmentsService, TeamsService],
})
export class BranchesDepartmentsModule {}
