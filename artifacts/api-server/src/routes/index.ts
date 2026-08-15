import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import voicesRouter from "./voices";
import ttsRouter from "./tts";
import generationsRouter from "./generations";
import minimaxRouter from "./minimax";
import fishAudioRouter from "./fishaudio";
import plansRouter from "./plans";
import edgeTtsRouter from "./edgetts";
import accountExtrasRouter from "./account-extras";
import { requireAdmin } from "../middleware/require-admin";
import { requireFeature } from "../middleware/require-feature";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/plans", plansRouter);
router.use("/auth", authRouter);
router.use("/admin", requireAdmin, adminRouter);
router.use("/voices", voicesRouter);
router.use("/tts", requireFeature("elevenlabs"), ttsRouter);
router.use("/generations", generationsRouter);
router.use("/minimax", requireFeature("minimax"), minimaxRouter);
router.use("/fishaudio", requireFeature("fishaudio"), fishAudioRouter);
router.use("/edge", requireFeature("edge"), edgeTtsRouter);
router.use(accountExtrasRouter);

export default router;
