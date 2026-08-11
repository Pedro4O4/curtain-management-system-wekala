import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly authService: AuthService
  ) {}

  @Get()
  list(@Headers('authorization') authorization: string | undefined) {
    return this.productsService.list(this.authService.verifyAuthorizationHeader(authorization).sub);
  }

  @Post()
  create(@Headers('authorization') authorization: string | undefined, @Body() body: { name?: unknown; wholesalePrice?: unknown } | undefined) {
    return this.productsService.create(this.authService.verifyAuthorizationHeader(authorization).sub, body?.name, body?.wholesalePrice);
  }

  @Patch('bulk-price')
  adjustWholesalePrices(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { productIds?: unknown; adjustment?: unknown } | undefined
  ) {
    return this.productsService.adjustWholesalePrices(
      this.authService.verifyAuthorizationHeader(authorization).sub,
      body?.productIds,
      body?.adjustment
    );
  }

  @Delete('bulk')
  removeMany(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { productIds?: unknown } | undefined
  ) {
    return this.productsService.removeMany(
      this.authService.verifyAuthorizationHeader(authorization).sub,
      body?.productIds
    );
  }

  @Patch(':id')
  update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: { name?: unknown; wholesalePrice?: unknown } | undefined
  ) {
    return this.productsService.update(
      this.authService.verifyAuthorizationHeader(authorization).sub,
      id,
      body?.name,
      body?.wholesalePrice
    );
  }

  @Delete(':id')
  remove(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.productsService.remove(this.authService.verifyAuthorizationHeader(authorization).sub, id);
  }
}
