import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ErrorLogAccessGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (this.hasViewToken(req)) {
      return true;
    }

    try {
      const authHeader = req.headers.authorization;
      const [bearer, token] = authHeader?.split(' ') ?? [];

      if (bearer !== 'Bearer' || !token) {
        throw new Error('Missing bearer token');
      }

      req.user = this.jwtService.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException({
        message: 'User not authorized',
        status: HttpStatus.UNAUTHORIZED,
      });
    }
  }

  private hasViewToken(req: any) {
    const token = process.env.ERROR_LOG_VIEW_TOKEN;

    if (!token) {
      return false;
    }

    return req.query?.token === token || req.headers?.['x-error-log-token'] === token;
  }
}
