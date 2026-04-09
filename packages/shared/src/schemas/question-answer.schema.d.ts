import mongoose from 'mongoose';
export declare const QuestionAnswerModel: mongoose.Model<{
    title: string;
    company: string;
    externalJobId: string;
    appliedAt: NativeDate;
    answers: mongoose.Types.DocumentArray<{
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }> & {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }>;
} & mongoose.DefaultTimestampProps, {}, {}, {}, mongoose.Document<unknown, {}, {
    title: string;
    company: string;
    externalJobId: string;
    appliedAt: NativeDate;
    answers: mongoose.Types.DocumentArray<{
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }> & {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }>;
} & mongoose.DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    title: string;
    company: string;
    externalJobId: string;
    appliedAt: NativeDate;
    answers: mongoose.Types.DocumentArray<{
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }> & {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }>;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    title: string;
    company: string;
    externalJobId: string;
    appliedAt: NativeDate;
    answers: mongoose.Types.DocumentArray<{
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }> & {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }>;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    title: string;
    company: string;
    externalJobId: string;
    appliedAt: NativeDate;
    answers: mongoose.Types.DocumentArray<{
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }> & {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }>;
} & mongoose.DefaultTimestampProps>, {}, mongoose.MergeType<mongoose.DefaultSchemaOptions, {
    timestamps: true;
}>> & mongoose.FlatRecord<{
    title: string;
    company: string;
    externalJobId: string;
    appliedAt: NativeDate;
    answers: mongoose.Types.DocumentArray<{
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }, mongoose.Types.Subdocument<mongoose.mongo.BSON.ObjectId, any, {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }> & {
        source: "rule" | "llm";
        question: string;
        options: string[];
        answer: string;
        type?: "text" | "select" | "textarea" | "radio" | null | undefined;
    }>;
} & mongoose.DefaultTimestampProps> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=question-answer.schema.d.ts.map