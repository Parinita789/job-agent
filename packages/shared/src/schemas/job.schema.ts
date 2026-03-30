import mongoose from 'mongoose';
import { JobStatus, JobSource } from '../types/job.types';

const jobSchema = new mongoose.Schema(
  {
    linkedinId:                { type: String, unique: true, required: true },
    title:                     { type: String, required: true },
    company:                   { type: String, required: true },
    location:                  String,
    remote:                    Boolean,
    employment_type:           String,
    salary_min:                Number,
    salary_max:                Number,
    description:               String,
    url:                       String,
    source:                    { type: String, enum: ['linkedin'] as JobSource[] },
    scraped_at:                Date,
    fit_score:                 Number,
    apply:                     Boolean,
    matched_skills:            [String],
    missing_skills:            [String],
    reason:                    String,
    deal_breaker:              String,
    status: {
      type: String,
      enum: [
        'to_apply', 'applied', 'rejected',
        'no_response', 'interviewing'
      ] as JobStatus[],
      default: 'to_apply'
    },
    applied_at:                { type: Date, default: null },
    status_updated_at:         { type: Date, default: Date.now },
    cover_letter:              { type: String, default: '' },
    cover_letter_generated_at: { type: Date, default: null },
    notes:                     { type: String, default: '' },
  },
  { timestamps: true }
);

export const JobModel = mongoose.model('Job', jobSchema);