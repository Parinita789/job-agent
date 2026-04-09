"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
exports.disconnectDatabase = disconnectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
async function connectToDatabase(uri) {
    const mongoUri = uri || process.env.MONGO_URI || 'mongodb://localhost:27017/job-tracker';
    if (mongoose_1.default.connection.readyState === 1)
        return mongoose_1.default;
    return mongoose_1.default.connect(mongoUri);
}
async function disconnectDatabase() {
    if (mongoose_1.default.connection.readyState !== 0) {
        await mongoose_1.default.disconnect();
    }
}
//# sourceMappingURL=connection.js.map