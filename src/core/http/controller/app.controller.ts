import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Hello world health check' })
  hello() {
    return {
      message: 'Hello from JiuJi Partner API!',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
