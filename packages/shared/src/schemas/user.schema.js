"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    meta: {
        version: String,
        last_updated: String,
        agent: String,
    },
    personal: {
        name: String,
        email: String,
        phone: String,
        location: String,
        linkedin: String,
        github: String,
    },
    experience: {
        total_years: Number,
        current_level: String,
        summary: String,
    },
    skills: {
        languages: [String],
        frameworks: [String],
        databases: [String],
        messaging: [String],
        cloud: [String],
        devops: [String],
        architecture: [String],
        ai: [String],
        tools: [String],
        methodologies: [String],
    },
    top_achievements: [{ company: String, impact: String }],
    work_history: [{
            company: String,
            location: String,
            title: String,
            start: String,
            end: String,
            duration_years: Number,
        }],
    preferences: {
        target_roles: [String],
        location: {
            current_city: String,
            remote: Boolean,
            hybrid_us: Boolean,
            onsite: Boolean,
            international_remote: Boolean,
        },
        employment_type: [String],
        visa_sponsorship_required: Boolean,
        company_size: mongoose_1.default.Schema.Types.Mixed,
        excluded_industries: [String],
        preferred_domains: [String],
    },
    compensation: {
        currency: String,
        base_salary_min: Number,
        base_salary_preferred: Number,
        equity: String,
        notes: String,
    },
    deal_breakers: [String],
    strengths_for_agent: {
        use_for_cover_letter: [String],
        ats_keywords: [String],
    },
}, { timestamps: true });
exports.UserModel = mongoose_1.default.model('User', userSchema);
//# sourceMappingURL=user.schema.js.map