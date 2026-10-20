import { Router } from "express";
import {
    createProject,
    listProjects,
    deleteProject,
} from "../controllers/projectController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect); // every project route requires a logged-in user

router.get("/", listProjects);
router.post("/", createProject);
router.delete("/:id", deleteProject);

export default router;
