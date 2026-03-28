import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private usersService: UsersService,
    ) {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: any) {
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (user.status === UserStatus.BANNED) {
            throw new ForbiddenException('Your account has been banned');
        }

        if (user.status === UserStatus.SUSPENDED) {
            if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
                throw new ForbiddenException('Your account is suspended until ' + user.suspendedUntil.toISOString());
            }
            // Auto-reactivate if suspension period has passed
            if (user.suspendedUntil && new Date(user.suspendedUntil) <= new Date()) {
                await this.usersService.reactivateUser(user.id);
            }
        }

        return user;
    }
}
