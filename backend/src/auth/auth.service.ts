import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { TokenResponseDto } from './dto/token-response.dto';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usersService.findByEmail(email);
        if (user && await bcrypt.compare(pass, user.passwordHash)) {
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(loginDto: LoginDto): Promise<TokenResponseDto> {
        const user = await this.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        return this.generateTokens(user);
    }

    async register(createUserDto: CreateUserDto): Promise<TokenResponseDto> {
        const existingUser = await this.usersService.findByEmail(createUserDto.email);
        if (existingUser) {
            throw new BadRequestException('Email already in use');
        }
        const user = await this.usersService.create(createUserDto);
        return this.generateTokens(user);
    }

    async refresh(refreshToken: string): Promise<TokenResponseDto> {
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            });
            const user = await this.usersService.findById(payload.sub);
            if (!user) {
                throw new UnauthorizedException('User not found');
            }
            return this.generateTokens(user);
        } catch (e) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    private async generateTokens(user: any): Promise<TokenResponseDto> {
        const payload = { sub: user.id, email: user.email, role: user.role };

        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get<string>('JWT_SECRET'),
            expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m') as any,
        });

        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
        });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
            },
        };
    }
}
