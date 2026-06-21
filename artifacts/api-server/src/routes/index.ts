import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import voicesRouter from "./voices";
import ttsRouter from "./tts";
import generationsRouter from "./generations";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/voices", voicesRouter);
router.use("/tts", ttsRouter);
router.use("/generations", generationsRouter);

export default router;
