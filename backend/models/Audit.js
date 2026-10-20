import mongoose from "mongoose";

const auditCheckSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["passed", "warning", "failed"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    points: {
      type: Number,
      default: 0,
    },
    maxPoints: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const auditSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    websiteUrl: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },

    seoScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    pagesCrawled: {
      type: Number,
      default: 0,
    },

    checks: {
      type: [auditCheckSchema],
      default: [],
    },

    errorMessage: {
      type: String,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

auditSchema.index({ userId: 1, projectId: 1, createdAt: -1 });

export default mongoose.model("Audit", auditSchema);
