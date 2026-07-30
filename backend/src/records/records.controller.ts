import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RecordsService } from './records.service';

@Controller('records')
export class RecordsController {
  constructor(
    private readonly recordsService: RecordsService,
    private readonly authService: AuthService
  ) {}

  @Get('month/:month')
  getMonth(@Headers('authorization') authorization: string | undefined, @Param('month') month: string) {
    const user = this.authService.verifyAuthorizationHeader(authorization);
    return this.recordsService.getMonth(user.sub, month);
  }

  @Get('day/:date')
  getDay(@Headers('authorization') authorization: string | undefined, @Param('date') date: string) {
    const user = this.authService.verifyAuthorizationHeader(authorization);
    return this.recordsService.getDay(user.sub, date);
  }

  @Get('sales')
  getSales(@Headers('authorization') authorization: string | undefined) {
    const user = this.authService.verifyAuthorizationHeader(authorization);
    return this.recordsService.getSales(user.sub);
  }

  @Post('day/:date/sales')
  addSale(
    @Headers('authorization') authorization: string | undefined,
    @Param('date') date: string,
    @Body() body: { item?: unknown; price?: unknown } | undefined
  ) {
    const user = this.authService.verifyAuthorizationHeader(authorization);
    return this.recordsService.addSale(user.sub, date, body?.item, body?.price);
  }

  @Post('day/:date/sales/bulk')
  addSales(
    @Headers('authorization') authorization: string | undefined,
    @Param('date') date: string,
    @Body() body: { sales?: unknown; paidAmount?: unknown } | undefined
  ) {
    const user = this.authService.verifyAuthorizationHeader(authorization);
    return this.recordsService.addSales(user.sub, date, body?.sales, body?.paidAmount);
  }

  @Post('sales/:number/payments')
  addReceiptPayment(
    @Headers('authorization') authorization: string | undefined,
    @Param('number') number: string,
    @Body() body: { amount?: unknown; date?: unknown } | undefined
  ) {
    const user = this.authService.verifyAuthorizationHeader(authorization);
    return this.recordsService.addReceiptPayment(user.sub, number, body?.amount, body?.date);
  }

  @Post('day/:date/adjustments')
  addAdjustment(
    @Headers('authorization') authorization: string | undefined,
    @Param('date') date: string,
    @Body() body: { amount?: unknown; reason?: unknown; direction?: unknown } | undefined
  ) {
    const user = this.authService.verifyAuthorizationHeader(authorization);
    return this.recordsService.addAdjustment(
      user.sub,
      date,
      body?.amount,
      body?.reason,
      body?.direction
    );
  }
}
