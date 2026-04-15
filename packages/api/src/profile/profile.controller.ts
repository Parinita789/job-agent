import { Controller, Get, Put, Post, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile() {
    return this.profileService.getProfile();
  }

  @Put()
  updateProfile(@Body() profile: any) {
    return this.profileService.updateProfile(profile);
  }

  @Post('upload-resume')
  @UseInterceptors(FileInterceptor('resume', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        cb(new BadRequestException('Only PDF files are allowed') as any, false);
        return;
      }
      cb(null, true);
    },
  }))
  async uploadResume(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No file uploaded' };
    }
    try {
      // Sanitize filename — strip path traversal, special chars
      const safeName = (file.originalname || 'resume.pdf')
        .replace(/\.\./g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-50);
      return await this.profileService.parseResumeAndCreateProfile(file.buffer, safeName);
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
}
