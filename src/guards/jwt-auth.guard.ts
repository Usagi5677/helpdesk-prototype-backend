import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_, user, __) {
    if (user.isDeleted) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
