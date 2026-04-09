"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileAnswerModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const profileAnswerSchema = new mongoose_1.default.Schema({
    question_pattern: { type: String, required: true, unique: true },
    answer: { type: String, required: true },
    times_used: { type: Number, default: 0 },
    last_used_at: Date,
    source: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    confirmed: { type: Boolean, default: false },
}, { timestamps: true });
exports.ProfileAnswerModel = mongoose_1.default.model('ProfileAnswer', profileAnswerSchema);
//# sourceMappingURL=profile-answer.schema.js.map