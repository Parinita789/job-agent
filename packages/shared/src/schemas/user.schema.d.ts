import mongoose from 'mongoose';
export declare const UserModel: mongoose.Model<{
    top_achievements: mongoose.Types.DocumentArray<{
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }> & {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }>;
    work_history: mongoose.Types.DocumentArray<{
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }> & {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }>;
    deal_breakers: string[];
    meta?: {
        version?: string | null | undefined;
        last_updated?: string | null | undefined;
        agent?: string | null | undefined;
    } | null | undefined;
    personal?: {
        linkedin?: string | null | undefined;
        location?: string | null | undefined;
        name?: string | null | undefined;
        email?: string | null | undefined;
        phone?: string | null | undefined;
        github?: string | null | undefined;
    } | null | undefined;
    experience?: {
        total_years?: number | null | undefined;
        current_level?: string | null | undefined;
        summary?: string | null | undefined;
    } | null | undefined;
    skills?: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        messaging: string[];
        cloud: string[];
        devops: string[];
        architecture: string[];
        ai: string[];
        tools: string[];
        methodologies: string[];
    } | null | undefined;
    preferences?: {
        employment_type: string[];
        target_roles: string[];
        excluded_industries: string[];
        preferred_domains: string[];
        location?: {
            remote?: boolean | null | undefined;
            current_city?: string | null | undefined;
            hybrid_us?: boolean | null | undefined;
            onsite?: boolean | null | undefined;
            international_remote?: boolean | null | undefined;
        } | null | undefined;
        visa_sponsorship_required?: boolean | null | undefined;
        company_size?: any;
    } | null | undefined;
    compensation?: {
        notes?: string | null | undefined;
        currency?: string | null | undefined;
        base_salary_min?: number | null | undefined;
        base_salary_preferred?: number | null | undefined;
        equity?: string | null | undefined;
    } | null | undefined;
    strengths_for_agent?: {
        use_for_cover_letter: string[];
        ats_keywords: string[];
    } | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    top_achievements: mongoose.Types.DocumentArray<{
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }> & {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }>;
    work_history: mongoose.Types.DocumentArray<{
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }> & {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }>;
    deal_breakers: string[];
    meta?: {
        version?: string | null | undefined;
        last_updated?: string | null | undefined;
        agent?: string | null | undefined;
    } | null | undefined;
    personal?: {
        linkedin?: string | null | undefined;
        location?: string | null | undefined;
        name?: string | null | undefined;
        email?: string | null | undefined;
        phone?: string | null | undefined;
        github?: string | null | undefined;
    } | null | undefined;
    experience?: {
        total_years?: number | null | undefined;
        current_level?: string | null | undefined;
        summary?: string | null | undefined;
    } | null | undefined;
    skills?: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        messaging: string[];
        cloud: string[];
        devops: string[];
        architecture: string[];
        ai: string[];
        tools: string[];
        methodologies: string[];
    } | null | undefined;
    preferences?: {
        employment_type: string[];
        target_roles: string[];
        excluded_industries: string[];
        preferred_domains: string[];
        location?: {
            remote?: boolean | null | undefined;
            current_city?: string | null | undefined;
            hybrid_us?: boolean | null | undefined;
            onsite?: boolean | null | undefined;
            international_remote?: boolean | null | undefined;
        } | null | undefined;
        visa_sponsorship_required?: boolean | null | undefined;
        company_size?: any;
    } | null | undefined;
    compensation?: {
        notes?: string | null | undefined;
        currency?: string | null | undefined;
        base_salary_min?: number | null | undefined;
        base_salary_preferred?: number | null | undefined;
        equity?: string | null | undefined;
    } | null | undefined;
    strengths_for_agent?: {
        use_for_cover_letter: string[];
        ats_keywords: string[];
    } | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    top_achievements: mongoose.Types.DocumentArray<{
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }> & {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }>;
    work_history: mongoose.Types.DocumentArray<{
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }> & {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }>;
    deal_breakers: string[];
    meta?: {
        version?: string | null | undefined;
        last_updated?: string | null | undefined;
        agent?: string | null | undefined;
    } | null | undefined;
    personal?: {
        linkedin?: string | null | undefined;
        location?: string | null | undefined;
        name?: string | null | undefined;
        email?: string | null | undefined;
        phone?: string | null | undefined;
        github?: string | null | undefined;
    } | null | undefined;
    experience?: {
        total_years?: number | null | undefined;
        current_level?: string | null | undefined;
        summary?: string | null | undefined;
    } | null | undefined;
    skills?: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        messaging: string[];
        cloud: string[];
        devops: string[];
        architecture: string[];
        ai: string[];
        tools: string[];
        methodologies: string[];
    } | null | undefined;
    preferences?: {
        employment_type: string[];
        target_roles: string[];
        excluded_industries: string[];
        preferred_domains: string[];
        location?: {
            remote?: boolean | null | undefined;
            current_city?: string | null | undefined;
            hybrid_us?: boolean | null | undefined;
            onsite?: boolean | null | undefined;
            international_remote?: boolean | null | undefined;
        } | null | undefined;
        visa_sponsorship_required?: boolean | null | undefined;
        company_size?: any;
    } | null | undefined;
    compensation?: {
        notes?: string | null | undefined;
        currency?: string | null | undefined;
        base_salary_min?: number | null | undefined;
        base_salary_preferred?: number | null | undefined;
        equity?: string | null | undefined;
    } | null | undefined;
    strengths_for_agent?: {
        use_for_cover_letter: string[];
        ats_keywords: string[];
    } | null | undefined;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    top_achievements: mongoose.Types.DocumentArray<{
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }> & {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }>;
    work_history: mongoose.Types.DocumentArray<{
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }> & {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }>;
    deal_breakers: string[];
    meta?: {
        version?: string | null | undefined;
        last_updated?: string | null | undefined;
        agent?: string | null | undefined;
    } | null | undefined;
    personal?: {
        linkedin?: string | null | undefined;
        location?: string | null | undefined;
        name?: string | null | undefined;
        email?: string | null | undefined;
        phone?: string | null | undefined;
        github?: string | null | undefined;
    } | null | undefined;
    experience?: {
        total_years?: number | null | undefined;
        current_level?: string | null | undefined;
        summary?: string | null | undefined;
    } | null | undefined;
    skills?: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        messaging: string[];
        cloud: string[];
        devops: string[];
        architecture: string[];
        ai: string[];
        tools: string[];
        methodologies: string[];
    } | null | undefined;
    preferences?: {
        employment_type: string[];
        target_roles: string[];
        excluded_industries: string[];
        preferred_domains: string[];
        location?: {
            remote?: boolean | null | undefined;
            current_city?: string | null | undefined;
            hybrid_us?: boolean | null | undefined;
            onsite?: boolean | null | undefined;
            international_remote?: boolean | null | undefined;
        } | null | undefined;
        visa_sponsorship_required?: boolean | null | undefined;
        company_size?: any;
    } | null | undefined;
    compensation?: {
        notes?: string | null | undefined;
        currency?: string | null | undefined;
        base_salary_min?: number | null | undefined;
        base_salary_preferred?: number | null | undefined;
        equity?: string | null | undefined;
    } | null | undefined;
    strengths_for_agent?: {
        use_for_cover_letter: string[];
        ats_keywords: string[];
    } | null | undefined;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    top_achievements: mongoose.Types.DocumentArray<{
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }> & {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }>;
    work_history: mongoose.Types.DocumentArray<{
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }> & {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }>;
    deal_breakers: string[];
    meta?: {
        version?: string | null | undefined;
        last_updated?: string | null | undefined;
        agent?: string | null | undefined;
    } | null | undefined;
    personal?: {
        linkedin?: string | null | undefined;
        location?: string | null | undefined;
        name?: string | null | undefined;
        email?: string | null | undefined;
        phone?: string | null | undefined;
        github?: string | null | undefined;
    } | null | undefined;
    experience?: {
        total_years?: number | null | undefined;
        current_level?: string | null | undefined;
        summary?: string | null | undefined;
    } | null | undefined;
    skills?: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        messaging: string[];
        cloud: string[];
        devops: string[];
        architecture: string[];
        ai: string[];
        tools: string[];
        methodologies: string[];
    } | null | undefined;
    preferences?: {
        employment_type: string[];
        target_roles: string[];
        excluded_industries: string[];
        preferred_domains: string[];
        location?: {
            remote?: boolean | null | undefined;
            current_city?: string | null | undefined;
            hybrid_us?: boolean | null | undefined;
            onsite?: boolean | null | undefined;
            international_remote?: boolean | null | undefined;
        } | null | undefined;
        visa_sponsorship_required?: boolean | null | undefined;
        company_size?: any;
    } | null | undefined;
    compensation?: {
        notes?: string | null | undefined;
        currency?: string | null | undefined;
        base_salary_min?: number | null | undefined;
        base_salary_preferred?: number | null | undefined;
        equity?: string | null | undefined;
    } | null | undefined;
    strengths_for_agent?: {
        use_for_cover_letter: string[];
        ats_keywords: string[];
    } | null | undefined;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
}>> & mongoose.FlatRecord<{
    top_achievements: mongoose.Types.DocumentArray<{
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }> & {
        company?: string | null | undefined;
        impact?: string | null | undefined;
    }>;
    work_history: mongoose.Types.DocumentArray<{
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }> & {
        location?: string | null | undefined;
        title?: string | null | undefined;
        company?: string | null | undefined;
        start?: string | null | undefined;
        end?: string | null | undefined;
        duration_years?: number | null | undefined;
    }>;
    deal_breakers: string[];
    meta?: {
        version?: string | null | undefined;
        last_updated?: string | null | undefined;
        agent?: string | null | undefined;
    } | null | undefined;
    personal?: {
        linkedin?: string | null | undefined;
        location?: string | null | undefined;
        name?: string | null | undefined;
        email?: string | null | undefined;
        phone?: string | null | undefined;
        github?: string | null | undefined;
    } | null | undefined;
    experience?: {
        total_years?: number | null | undefined;
        current_level?: string | null | undefined;
        summary?: string | null | undefined;
    } | null | undefined;
    skills?: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        messaging: string[];
        cloud: string[];
        devops: string[];
        architecture: string[];
        ai: string[];
        tools: string[];
        methodologies: string[];
    } | null | undefined;
    preferences?: {
        employment_type: string[];
        target_roles: string[];
        excluded_industries: string[];
        preferred_domains: string[];
        location?: {
            remote?: boolean | null | undefined;
            current_city?: string | null | undefined;
            hybrid_us?: boolean | null | undefined;
            onsite?: boolean | null | undefined;
            international_remote?: boolean | null | undefined;
        } | null | undefined;
        visa_sponsorship_required?: boolean | null | undefined;
        company_size?: any;
    } | null | undefined;
    compensation?: {
        notes?: string | null | undefined;
        currency?: string | null | undefined;
        base_salary_min?: number | null | undefined;
        base_salary_preferred?: number | null | undefined;
        equity?: string | null | undefined;
    } | null | undefined;
    strengths_for_agent?: {
        use_for_cover_letter: string[];
        ats_keywords: string[];
    } | null | undefined;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=user.schema.d.ts.map