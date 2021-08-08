import * as mongoose from 'mongoose';
const Schema = mongoose.Schema;

export const lastParsedBlockSchema = new Schema({
    lastBlock: {
        type: Number,
        required: true
    },
    type: {
        type: String
    }
}, {
    versionKey: false,
});

export const LastParsedBlock = mongoose.model("LastParsedBlock", lastParsedBlockSchema );
