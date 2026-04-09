import mongoose from 'mongoose';
export declare const ProfileAnswerModel: mongoose.Model<{
    source: "auto" | "manual";
    answer: string;
    question_pattern: string;
    times_used: number;
    confirmed: boolean;
    last_used_at?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    source: "auto" | "manual";
    answer: string;
    question_pattern: string;
    times_used: number;
    confirmed: boolean;
    last_used_at?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    source: "auto" | "manual";
    answer: string;
    question_pattern: string;
    times_used: number;
    confirmed: boolean;
    last_used_at?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    source: "auto" | "manual";
    answer: string;
    question_pattern: string;
    times_used: number;
    confirmed: boolean;
    last_used_at?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    source: "auto" | "manual";
    answer: string;
    question_pattern: string;
    times_used: number;
    confirmed: boolean;
    last_used_at?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
}>> & mongoose.FlatRecord<{
    source: "auto" | "manual";
    answer: string;
    question_pattern: string;
    times_used: number;
    confirmed: boolean;
    last_used_at?: NativeDate | null | undefined;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=profile-answer.schema.d.ts.map