import { Controller, Get, Put, Body } from '@nestjs/common';
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
}
