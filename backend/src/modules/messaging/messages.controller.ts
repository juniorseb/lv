import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';
import { ConversationView, MessageView } from './messages.view';

// Conversation d'une mission (spec-communication). Rattachée à une livraison ;
// accessible uniquement à ses deux participants (client + livreur assigné).
@Controller('deliveries/:id/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  conversation(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationView> {
    return this.messages.getConversation(id, current.id);
  }

  // Coordonnées de l'interlocuteur (appel direct).
  @Get('contact')
  contact(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ name: string; phone: string }> {
    return this.messages.getContact(id, current.id);
  }

  @Post()
  send(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageView> {
    return this.messages.send(id, current.id, dto.body);
  }
}
