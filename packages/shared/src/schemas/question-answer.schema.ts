import mongoose from 'mongoose';

const qaEntrySchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    type:     { type: String, enum: ['text', 'textarea', 'select', 'radio'] },
    options:  [String],
    answer:   { type: String, required: true },
    source:   { type: String, enum: ['rule', 'llm'], required: true },
  },
  { _id: false }
);

const questionAnswerSchema = new mongoose.Schema(
  {
    externalJobId: { type: String, required: true, index: true },
    title:         { type: String, required: true },
    company:       { type: String, required: true },
    appliedAt:     { type: Date, default: Date.now },
    answers:       [qaEntrySchema],
  },
  { timestamps: true }
);

export const QuestionAnswerModel = mongoose.model('QuestionAnswer', questionAnswerSchema);
