import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminAuthRouter from "./admin-auth";
import adminStateRouter from "./admin-state";
import adminEntitiesRouter from "./admin-entities";
import userRouter from "./user";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminAuthRouter);
router.use("/admin", adminStateRouter);
router.use("/admin", adminEntitiesRouter);
router.use("/user", userRouter);
router.use("/bot", botRouter);

export default router;
