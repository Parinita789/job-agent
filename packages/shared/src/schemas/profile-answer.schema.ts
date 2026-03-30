import mongoose from 'mongoose';

const profileAnswerSchema = new mongoose.Schema(
  {
    question_pattern: { type: String, required: true, unique: true },
    answer:           { type: String, required: true },
    times_used:       { type: Number, default: 0 },
    last_used_at:     Date,
    source:           { type: String, enum: ['auto', 'manual'], default: 'auto' },
    confirmed:        { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ProfileAnswerModel = mongoose.model(
  'ProfileAnswer',
  profileAnswerSchema
);