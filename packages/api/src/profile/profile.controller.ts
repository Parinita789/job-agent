import { Controller, Get, Put, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';

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
  @UseInterceptors(FileInterceptor('resume'))
  async uploadResume(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No file uploaded' };
    }
    try {
      return await this.profileService.parseResumeAndCreateProfile(file.buffer, file.originalname || 'resume.pdf');
    } catch (err) {
      return { error: (err as Error).message };
    }
  }
}
