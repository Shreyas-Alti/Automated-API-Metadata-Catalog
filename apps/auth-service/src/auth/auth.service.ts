import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  organisationName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; name: string; organisationId: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, orgId: user.organisationId });
    return { accessToken, user: { id: user.id, email: user.email, name: user.name, organisationId: user.organisationId } };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    // Always create a NEW organisation for each registration.
    // Joining an existing org requires an explicit invite (Phase 3).
    // Handle slug collisions by appending a numeric suffix — never silently
    // add a registrant to an unrelated org that happens to share a slug.
    const baseSlug = dto.organisationName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    let finalSlug = baseSlug;
    let attempt = 0;
    while (await this.prisma.organisation.findUnique({ where: { slug: finalSlug } })) {
      attempt++;
      finalSlug = `${baseSlug}-${attempt}`;
    }

    const org = await this.prisma.organisation.create({
      data: { name: dto.organisationName, slug: finalSlug },
    });

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name, organisationId: org.id },
    });

    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, orgId: user.organisationId });
    return { accessToken, user: { id: user.id, email: user.email, name: user.name, organisationId: user.organisationId } };
  }

  async validateUser(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
