import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get Hello Message' })
  @ApiOperation({ description: 'Returns a hello message from the application' })
  @ApiResponse({ status: 200, description: 'Hello message returned successfully' })
  getHello(): string {
    return this.appService.getHello();
  }
}
