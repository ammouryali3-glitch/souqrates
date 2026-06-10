import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminAuthRouter from "./admin-auth";
import adminStateRouter from "./admin-state";
import adminEntitiesRouter from "./admin-entities";
import adminIntegrationsRouter from "./admin-integrations";
import userRouter from "./user";
import botRouter from "./bot";
import emailAuthRouter from "./email-auth";
import browserAuthRouter from "./browser-auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminAuthRouter);
router.use("/admin", adminStateRouter);
router.use("/admin", adminEntitiesRouter);
router.use("/admin", adminIntegrationsRouter);
router.use("/user", userRouter);
router.use("/user/email", emailAuthRouter);
router.use("/user/browser-auth", browserAuthRouter);
router.use("/bot", botRouter);

export default router;
