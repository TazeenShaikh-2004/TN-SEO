import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // fast lookup of "my projects"
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
            trim: true,
            default: "—",
            maxlength: [200, "Primary keyword must be at most 200 characters."],
        },
        status: {
            type: String,
            enum: ["active", "paused", "issues"],
            default: "paused", // a freshly created project has not been audited yet
        },
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
        pages: {
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
            default: 0, // index into the card gradient palette
        },
    },
    { timestamps: true } // adds createdAt + updatedAt
);

// One project per website per user.
projectSchema.index({ user: 1, url: 1 }, { unique: true });

/** Public representation sent to the frontend. */
projectSchema.methods.toPublic = function () {
    return {
        id: this._id.toString(),
        name: this.name,
        url: this.url,
        keyword: this.keyword,
        status: this.status,
        score: this.score,
        keywords: this.keywords,
        pages: this.pages,
        issues: this.issues,
        fav: this.fav,
        updatedAt: this.updatedAt,
        createdAt: this.createdAt,
    };
};

export default mongoose.model("Project", projectSchema);
