"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionAnswerModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const qaEntrySchema = new mongoose_1.default.Schema({
    question: { type: String, required: true },
    type: { type: String, enum: ['text', 'textarea', 'select', 'radio'] },
    options: [String],
    answer: { type: String, required: true },
    source: { type: String, enum: ['rule', 'llm'], required: true },
}, { _id: false });
const questionAnswerSchema = new mongoose_1.default.Schema({
    externalJobId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    appliedAt: { type: Date, default: Date.now },
    answers: [qaEntrySchema],
}, { timestamps: true });
exports.QuestionAnswerModel = mongoose_1.default.model('QuestionAnswer', questionAnswerSchema);
//# sourceMappingURL=question-answer.schema.js.map