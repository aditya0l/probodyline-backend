import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { CalendarEventsService } from './calendar-events.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('calendar-events')
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Get('aggregated')
  getAggregatedEvents(@Query('month') month: string) {
    if (!month) throw new Error('Month is required (YYYY-MM)');
    return this.calendarEventsService.getAggregatedEvents(month);
  }

  @Get()
  findAll(@Query('month') month: string) {
    if (!month) throw new Error('Month is required (YYYY-MM)');
    return this.calendarEventsService.getCustomEvents(month);
  }

  @Post()
  create(@Body() createCalendarEventDto: CreateCalendarEventDto, @CurrentUser() user: any) {
    return this.calendarEventsService.createEvent(createCalendarEventDto, user?.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCalendarEventDto: UpdateCalendarEventDto) {
    return this.calendarEventsService.updateEvent(id, updateCalendarEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.calendarEventsService.deleteEvent(id);
  }
}
