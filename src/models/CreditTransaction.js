import mongoose from "mongoose";

const creditTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" }, // nullable if not task-related
    creditBatch: { type: mongoose.Schema.Types.ObjectId, ref: "Credit" }, // which batch credits came from
    change: { type: Number, required: true }, // +10, -1, -2, etc.
    reason: { type: String, required: true }, // "Purchase", "Task Creation", "Refund"
  },
  { timestamps: true }
);

// Use explicit connection to avoid buffering issues
export default mongoose.connection.model("CreditTransaction", creditTransactionSchema);
