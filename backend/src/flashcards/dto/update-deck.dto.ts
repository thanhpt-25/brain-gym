import { PartialType } from '@nestjs/swagger';
import { CreateDeckDto } from './create-deck.dto';

export class UpdateDeckDto extends PartialType(CreateDeckDto) {}
