export type JobStatus = 'to_apply' | 'applied' | 'rejected' | 'no_response' | 'interviewing';
export type JobSource = 'linkedin' | 'greenhouse' | 'lever' | 'indeed';
export interface JobListing {
    id: string;
    title: string;
    company: string;
    location: string;
    remote: boolean;
    employment_type: string;
    salary_min?: number;
    salary_max?: number;
    description: string;
    url: string;
    source: JobSource;
    scraped_at: string;
}
export interface ScoredJob extends JobListing {
    fit_score: number;
    apply: boolean;
    matched_skills: string[];
    missing_skills: string[];
    reason: string;
    deal_breaker?: string;
    status: JobStatus;
    applied_at?: string;
    applied_via?: 'auto' | 'manual';
    cover_letter?: string;
    notes?: string;
}
export interface CandidateProfile {
    meta: {
        version: string;
        last_updated: string;
    };
    personal: {
        name: string;
        email: string;
        phone: string;
        location: string;
        linkedin: string;
        github: string;
    };
    experience: {
        total_years: number;
        current_level: string;
        summary: string;
    };
    skills: {
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
    };
    top_achievements: Array<{
        company: string;
        impact: string;
    }>;
    work_history: Array<{
        company: string;
        location: string;
        title: string;
        start: string;
        end: string;
        duration_years: number;
    }>;
    preferences: {
        target_roles: string[];
        location: {
            current_city: string;
            remote: boolean;
            hybrid_us: boolean;
            onsite: boolean;
            international_remote: boolean;
        };
        employment_type: string[];
        visa_sponsorship_required: boolean;
        company_size: Record<string, boolean>;
        excluded_industries: string[];
        preferred_domains: string[];
    };
    compensation: {
        currency: string;
        base_salary_min: number;
        base_salary_preferred: number;
        equity: string;
        notes: string;
    };
    deal_breakers: string[];
    strengths_for_agent: {
        use_for_cover_letter: string[];
        ats_keywords: string[];
    };
}
//# sourceMappingURL=job.types.d.ts.map