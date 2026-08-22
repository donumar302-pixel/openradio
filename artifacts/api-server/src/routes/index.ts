import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import generationsRouter from "./generations";
import plansRouter from "./plans";
import accountExtrasRouter from "./account-extras";
import resellerRouter from "./reseller";
import openspeakerRouter from "./openspeaker";
import ordersRouter from "./orders";
import apiKeysRouter from "./api-keys";
import devApiRouter from "./dev-api";
import scriptRouter from "./script";
import { requireAdmin } from "../middleware/require-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/plans", plansRouter);
router.use("/auth", authRouter);
router.use("/admin", requireAdmin, adminRouter);
router.use("/generations", generationsRouter);
router.use(accountExtrasRouter);
router.use("/reseller", resellerRouter);
router.use("/os", openspeakerRouter);
router.use("/orders", ordersRouter);
router.use("/keys", apiKeysRouter);
router.use("/v1", devApiRouter);
router.use("/script", scriptRouter);

export default router;
