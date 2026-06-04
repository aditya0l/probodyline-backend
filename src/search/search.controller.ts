import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async globalSearch(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      return { results: [] };
    }
    return this.searchService.globalSearch(query.trim());
  }
}
