import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserService } from 'src/services/user.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) {
      return true;
    }
    const user = GqlExecutionContext.create(context).getContext().req.user;
    if (roles.includes('SuperAdmin') && user.isSuperAdmin) {
      return true;
    }
    const userRoles = await this.userService.getUserRolesList(user.id);
    return roles.some((r) => userRoles.includes(r));
  }
}
