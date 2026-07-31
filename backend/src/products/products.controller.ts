import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
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
  create(@Headers('authorization') authorization: string | undefined, @Body() body: { name?: unknown } | undefined) {
    return this.productsService.create(this.authService.verifyAuthorizationHeader(authorization).sub, body?.name);
  }

  @Delete(':id')
  remove(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.productsService.remove(this.authService.verifyAuthorizationHeader(authorization).sub, id);
  }
}
