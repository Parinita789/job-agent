import mongoose from 'mongoose';

const coverLetterSchema = new mongoose.Schema(
  {
    jobId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    externalJobId: { type: String, required: true, index: true },
    content:     { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const CoverLetterModel = mongoose.model('CoverLetter', coverLetterSchema);
