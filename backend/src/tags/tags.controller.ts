import { Controller, Get, Query } from '@nestjs/common';
import { TagsService } from './tags.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
    constructor(private readonly tagsService: TagsService) { }

    @Public()
    @Get()
    @ApiOperation({ summary: 'Get all tags, optionally filtered by certification' })
    @ApiQuery({ name: 'certificationId', required: false })
    findAll(@Query('certificationId') certificationId?: string) {
        return this.tagsService.findAll(certificationId);
    }
}
