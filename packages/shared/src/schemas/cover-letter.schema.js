"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoverLetterModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const coverLetterSchema = new mongoose_1.default.Schema({
    jobId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    externalJobId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });
exports.CoverLetterModel = mongoose_1.default.model('CoverLetter', coverLetterSchema);
//# sourceMappingURL=cover-letter.schema.js.map