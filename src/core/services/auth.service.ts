import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { OnboardingData } from '../../../const';
import { UserRepository } from '../repository/user.repository';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(email: string, password: string): Promise<{ accessToken: string }> {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomUUID();
    const verificationTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const user = await this.userRepository.create({
      email,
      passwordHash,
      verificationToken,
      verificationTokenExpiresAt,
    });

    await this.mailService.sendVerificationEmail(email, verificationToken);

    const accessToken = await this.generateTokenForUser(user.id, user.email);
    return { accessToken };
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.generateTokenForUser(user.id, user.email);
    return { accessToken };
  }

  async completeOnboarding(userId: string, dto: OnboardingData): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.userRepository.update(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      age: dto.age,
      belt: dto.belt as any,
      stripes: dto.stripes,
      bjjAcademy: dto.bjjAcademy,
      timeTraining: dto.timeTraining,
      trainingsPerWeek: dto.trainingsPerWeek,
      objective: dto.objective as any,
      intensity: dto.intensity as any,
      weight: dto.weight ?? null,
    });

    this.logger.log(`Onboarding completed for user ${userId}`);
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired. Request a new one.');
    }

    await this.userRepository.update(user.id, {
      isVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    });

    this.logger.log(`Email verified for user ${user.id}`);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException('No account found with this email');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const verificationToken = crypto.randomUUID();
    const verificationTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.userRepository.update(user.id, {
      verificationToken,
      verificationTokenExpiresAt,
    });

    await this.mailService.sendVerificationEmail(email, verificationToken);
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const { passwordHash, verificationToken, verificationTokenExpiresAt, ...profile } = user;
    return profile;
  }

  private generateToken(sub: string, email: string, role?: string): string {
    const payload: Record<string, any> = { sub, email };
    if (role) payload.role = role;
    return this.jwtService.sign(payload);
  }

  private async generateTokenForUser(userId: string, email: string): Promise<string> {
    const user = await this.userRepository.findById(userId);
    const role = user?.role || 'USER';
    return this.generateToken(userId, email, role);
  }
}
