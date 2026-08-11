import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { WholesaleService } from './wholesale.service';

@Controller('wholesale')
export class WholesaleController {
  constructor(
    private readonly wholesaleService: WholesaleService,
    private readonly authService: AuthService
  ) {}

  @Get('history')
  getHistory(
    @Headers('authorization') authorization: string | undefined,
    @Query('kind') kind: string | undefined,
    @Query('scope') scope: string | undefined,
    @Query('date') date: string | undefined,
    @Query('month') month: string | undefined
  ) {
    return this.wholesaleService.getHistory(this.authService.verifyAuthorizationHeader(authorization).sub, { kind, scope, date, month });
  }

  @Get('parties')
  listParties(
    @Headers('authorization') authorization: string | undefined,
    @Query('kind') kind: string | undefined,
    @Query('scope') scope: string | undefined
  ) {
    return this.wholesaleService.listParties(this.authService.verifyAuthorizationHeader(authorization).sub, kind, scope);
  }

  @Post('parties')
  createParty(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { kind?: unknown; scope?: unknown; name?: unknown; phone?: unknown } | undefined
  ) {
    return this.wholesaleService.createParty(this.authService.verifyAuthorizationHeader(authorization).sub, body?.kind, body?.name, body?.phone, body?.scope);
  }

  @Get('parties/:partyId/account')
  getAccount(@Headers('authorization') authorization: string | undefined, @Param('partyId') partyId: string) {
    return this.wholesaleService.getAccount(this.authService.verifyAuthorizationHeader(authorization).sub, partyId);
  }

  @Post('parties/:partyId/transactions')
  addTransaction(
    @Headers('authorization') authorization: string | undefined,
    @Param('partyId') partyId: string,
    @Body() body: { date?: unknown; type?: unknown; items?: unknown; paidAmount?: unknown; amount?: unknown } | undefined
  ) {
    return this.wholesaleService.addTransaction(this.authService.verifyAuthorizationHeader(authorization).sub, partyId, body);
  }
}
