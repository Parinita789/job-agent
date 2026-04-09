import mongoose from 'mongoose';
export declare const CoverLetterModel: mongoose.Model<{
    jobId: mongoose.Types.ObjectId;
    externalJobId: string;
    content: string;
    generatedAt: NativeDate;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    jobId: mongoose.Types.ObjectId;
    externalJobId: string;
    content: string;
    generatedAt: NativeDate;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    jobId: mongoose.Types.ObjectId;
    externalJobId: string;
    content: string;
    generatedAt: NativeDate;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    jobId: mongoose.Types.ObjectId;
    externalJobId: string;
    content: string;
    generatedAt: NativeDate;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    jobId: mongoose.Types.ObjectId;
    externalJobId: string;
    content: string;
    generatedAt: NativeDate;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
}>> & mongoose.FlatRecord<{
    jobId: mongoose.Types.ObjectId;
    externalJobId: string;
    content: string;
    generatedAt: NativeDate;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=cover-letter.schema.d.ts.map