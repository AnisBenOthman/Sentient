import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leaveRequestsRouter from "./leave-requests";
import positionsRouter from "./positions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leaveRequestsRouter);
router.use(positionsRouter);

export default router;
