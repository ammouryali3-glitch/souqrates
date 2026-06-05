import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminAuthRouter from "./admin-auth";
import adminStateRouter from "./admin-state";
import adminEntitiesRouter from "./admin-entities";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminAuthRouter);
router.use("/admin", adminStateRouter);
router.use("/admin", adminEntitiesRouter);

export default router;
