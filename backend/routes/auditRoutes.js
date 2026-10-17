import express from "express";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import Audit from "../models/Audit.js";
import { protect } from "../middleware/authMiddleware.js";
import { runSeoAudit } from "../services/seoAuditService.js";

const router = express.Router();

router.use(protect);

function validId(id) {
  return mongoose.isValidObjectId(id);
}

// POST /api/audits/:projectId/run
// Run a new audit for a project belonging to the logged-in user.
router.post("/:projectId/run", async (req, res, next) => {
  let audit;

  try {
    const { projectId } = req.params;

    if (!validId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findOne({
      _id: projectId,
      userId: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    audit = await Audit.create({
      projectId: project._id,
      userId: req.user._id,
      websiteUrl: project.url,
      status: "running",
    });

    try {
      const result = await runSeoAudit(project.url);

      audit.websiteUrl = result.websiteUrl;
      audit.seoScore = result.seoScore;
      audit.pagesCrawled = result.pagesCrawled;
      audit.checks = result.checks;
      audit.status = "completed";
      audit.completedAt = new Date();

      await audit.save();

      return res.status(201).json({
        success: true,
        message: "SEO audit completed successfully.",
        audit,
      });
    } catch (error) {
      audit.status = "failed";
      audit.errorMessage = error.message || "Unable to audit this website.";
      audit.completedAt = new Date();
      await audit.save();

      return res.status(422).json({
        success: false,
        message: audit.errorMessage,
        auditId: audit._id,
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/audits/:projectId
// Get audit history for a project.
router.get("/:projectId", async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!validId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findOne({
      _id: projectId,
      userId: req.user._id,
    }).select("_id");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const audits = await Audit.find({
      projectId: project._id,
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, audits });
  } catch (error) {
    next(error);
  }
});

// GET /api/audits/:projectId/latest
// Get the latest audit for a project.
router.get("/:projectId/latest", async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!validId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findOne({
      _id: projectId,
      userId: req.user._id,
    }).select("_id");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const audit = await Audit.findOne({
      projectId: project._id,
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: "No audit has been run for this project yet.",
      });
    }

    return res.json({ success: true, audit });
  } catch (error) {
    next(error);
  }
});

// GET /api/audits/:projectId/:auditId
// Get one specific audit.
router.get("/:projectId/:auditId", async (req, res, next) => {
  try {
    const { projectId, auditId } = req.params;

    if (!validId(projectId) || !validId(auditId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project or audit ID.",
      });
    }

    const audit = await Audit.findOne({
      _id: auditId,
      projectId,
      userId: req.user._id,
    });

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: "Audit not found.",
      });
    }

    return res.json({ success: true, audit });
  } catch (error) {
    next(error);
  }
});

export default router;
