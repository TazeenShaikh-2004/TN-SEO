import express from "express";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Validate a website URL before saving it.
function validateWebsiteUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    const hostname = url.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

// GET /api/projects
// Return projects belonging to the logged-in user.
router.get("/", protect, async (req, res, next) => {
  try {
    const projects = await Project.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      projects,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects
// Create a project for the logged-in user.
router.post("/", protect, async (req, res, next) => {
  try {
    const { name, url, keyword } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof keyword !== "string" ||
      !keyword.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Project name and primary keyword are required.",
      });
    }

    if (name.trim().length > 100 || keyword.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: "Project name or keyword is too long.",
      });
    }

    const validUrl = validateWebsiteUrl(url);

    if (!validUrl) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid public website URL using HTTP or HTTPS.",
      });
    }

    const project = await Project.create({
      name: name.trim(),
      url: validUrl,
      keyword: keyword.trim(),
      userId: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully.",
      project,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id
// Delete only a project owned by the logged-in user.
router.delete("/:id", protect, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    res.json({
      success: true,
      message: "Project deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
