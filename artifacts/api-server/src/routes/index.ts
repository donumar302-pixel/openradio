import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import voicesRouter from "./voices";
import ttsRouter from "./tts";
import generationsRouter from "./generations";
import minimaxRouter from "./minimax";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/voices", voicesRouter);
router.use("/tts", ttsRouter);
router.use("/generations", generationsRouter);
router.use("/minimax", minimaxRouter);

export default router;
