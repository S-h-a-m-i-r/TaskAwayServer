import mongoose from "mongoose";

const creditSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    totalCredits: { type: Number, required: true }, // purchased credits
    remainingCredits: { type: Number, required: true },
    expiresAt: { type: Date, required: true }, // = createdAt + 2 months
  },
  { timestamps: true }
);

// Use explicit connection to avoid buffering issues
export default mongoose.connection.model("Credit", creditSchema);
