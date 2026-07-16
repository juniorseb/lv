import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateSavedAddressDto } from './dto/create-saved-address.dto';
import { SavedAddress } from './entities/saved-address.entity';
import { SavedAddressesService } from './saved-addresses.service';

// Adresses enregistrées du compte connecté (spec-app-navigation-roles §3).
@Controller('users/me/addresses')
@UseGuards(JwtAuthGuard)
export class SavedAddressesController {
  constructor(private readonly addresses: SavedAddressesService) {}

  @Get()
  list(@CurrentUser() current: AuthenticatedUser): Promise<SavedAddress[]> {
    return this.addresses.listForUser(current.id);
  }

  @Post()
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateSavedAddressDto,
  ): Promise<SavedAddress> {
    return this.addresses.create(current.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.addresses.delete(current.id, id);
  }
}
