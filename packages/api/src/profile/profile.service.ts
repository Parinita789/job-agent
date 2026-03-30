import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ProfileService {
  private getProfilePath(): string {
    return path.resolve(__dirname, '../../../scraper/profile/candidate.json');
  }

  getProfile(): any {
    const filePath = this.getProfilePath();
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('candidate.json not found. Copy candidate.example.json to candidate.json and fill in your details.');
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  updateProfile(profile: any): any {
    const filePath = this.getProfilePath();
    profile.meta = {
      ...profile.meta,
      last_updated: new Date().toISOString().split('T')[0],
    };
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));
    return profile;
  }
}
