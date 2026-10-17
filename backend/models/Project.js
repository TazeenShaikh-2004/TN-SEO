import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      maxlength: 100,
    },

    url: {
      type: String,
      required: [true, "Website URL is required"],
      trim: true,
    },

    keyword: {
      type: String,
      required: [true, "Primary keyword is required"],
      trim: true,
      maxlength: 200,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "crawling", "completed", "failed"],
      default: "pending",
    },

    lastCrawledAt: {
      type: Date,
      default: null,
    },

    pageCount: {
      type: Number,
      default: 0,
    },

    crawlData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ userId: 1, createdAt: -1 });

const Project = mongoose.model("Project", projectSchema);

export default Project;
