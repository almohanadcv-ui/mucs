import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SearchService } from "./search.service";

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  search(@Query("q") q = "") {
    return this.service.search(q);
  }
}
