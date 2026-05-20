import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import submissionsRouter from "./submissions";
import withdrawalsRouter from "./withdrawals";
import settingsRouter from "./settings";
import adminRouter from "./admin";
import referralRouter from "./referral";
import telegramRouter from "./telegram";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(submissionsRouter);
router.use(withdrawalsRouter);
router.use(settingsRouter);
router.use(adminRouter);
router.use(referralRouter);
router.use(telegramRouter);

export default router;
