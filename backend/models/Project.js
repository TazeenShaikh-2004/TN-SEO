
import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Project name is required."],
      trim: true,
      minlength: [2, "Project name must be at least 2 characters."],
      maxlength: [120, "Project name must be at most 120 characters."],
    },

    url: {
      type: String,
      required: [true, "Website URL is required."],
      trim: true,
      maxlength: [500, "Website URL must be at most 500 characters."],
    },

    keyword: {
      type: String,
      required: [true, "Primary keyword is required."],
      trim: true,
      maxlength: [200, "Primary keyword must be at most 200 characters."],
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
      min: 0,
    },

    crawlData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Dashboard values: update these only from real audit data.
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    keywords: {
      type: Number,
      default: 0,
      min: 0,
    },

    issues: {
      type: Number,
      default: 0,
      min: 0,
    },

    fav: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Avoid duplicate projects for the same user and URL.
projectSchema.index(
  { userId: 1, url: 1 },
  { unique: true }
);

// Standard response format for the frontend.
projectSchema.methods.toPublic = function () {
  return {
    _id: this._id.toString(),
    id: this._id.toString(),
    name: this.name,
    url: this.url,
    keyword: this.keyword,
    status: this.status,
    score: this.score,
    keywords: this.keywords,
    pages: this.pageCount,
    pageCount: this.pageCount,
    issues: this.issues,
    fav: this.fav,
    lastCrawledAt: this.lastCrawledAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Project = mongoose.model("Project", projectSchema);

export default Project;
