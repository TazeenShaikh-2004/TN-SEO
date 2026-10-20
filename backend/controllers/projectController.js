import mongoose from "mongoose";
import Project from "../models/Project.js";

const FAV_STYLE_COUNT = 4; // keep in sync with favoriteStyles in Projects.jsx

/* ---------------------------------- helpers --------------------------------- */

function badRequest(res, message) {
    return res.status(400).json({ success: false, message });
}

/** Adds a scheme if missing and validates the result is a usable http(s) URL. */
function normalizeUrl(raw) {
    let url = raw.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".")) {
        return null;
    }
    return parsed.toString();
}

/* ---------------------------------- create ---------------------------------- */

export async function createProject(req, res, next) {
    try {
        const name = (req.body.name || "").trim();
        const keyword = (req.body.keyword || "").trim() || "—";
        const url = normalizeUrl(req.body.url || "");

        if (!name) return badRequest(res, "Project name is required.");
        if (!url) return badRequest(res, "Please provide a valid website URL.");

        const existing = await Project.findOne({ user: req.user._id, url }).select("_id");
        if (existing) {
            return res.status(409).json({
                success: false,
                message: "A project for this website already exists.",
            });
        }

        const count = await Project.countDocuments({ user: req.user._id });

        const project = await Project.create({
            user: req.user._id,
            name,
            url,
            keyword,
            fav: count % FAV_STYLE_COUNT,
        });

        res.status(201).json({ success: true, project: project.toPublic() });
    } catch (error) {
        next(error);
    }
}

/* ----------------------------------- list ----------------------------------- */

export async function listProjects(req, res, next) {
    try {
        const projects = await Project.find({ user: req.user._id }).sort({ updatedAt: -1 });
        res.json({ success: true, projects: projects.map((project) => project.toPublic()) });
    } catch (error) {
        next(error);
    }
}

/* ---------------------------------- delete ---------------------------------- */

export async function deleteProject(req, res, next) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return badRequest(res, "Invalid project id.");

        // scope by user so nobody can delete someone else's project
        const project = await Project.findOneAndDelete({ _id: id, user: req.user._id });
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found." });
        }

        res.json({ success: true, message: "Project deleted." });
    } catch (error) {
        next(error);
    }
}
