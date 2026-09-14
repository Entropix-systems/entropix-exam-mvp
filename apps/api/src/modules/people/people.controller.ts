import type { AuthenticatedContext } from '@entropix/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Authenticated, CurrentAuthContext } from '../identity/authorization/decorators.js';
import { PeopleService } from './people.service.js';

@Authenticated()
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get('students')
  listStudents(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.people.listStudents(context, search, cursor, pageSize);
  }

  @Get('students/:id')
  getStudent(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Param('id') id: string,
  ) {
    return this.people.getStudent(context, id);
  }

  @Get('faculty')
  listFaculty(@CurrentAuthContext() context: AuthenticatedContext) {
    return this.people.listFaculty(context);
  }

  @Post('student-imports/preview')
  previewImport(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Body() body: unknown,
  ) {
    return this.people.previewImport(context, body);
  }

  @Post('student-imports/commit')
  commitImport(
    @CurrentAuthContext() context: AuthenticatedContext,
    @Body() body: unknown,
  ) {
    return this.people.commitImport(context, body);
  }
}
