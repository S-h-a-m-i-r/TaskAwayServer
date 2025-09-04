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

export default mongoose.model("Credit", creditSchema);
