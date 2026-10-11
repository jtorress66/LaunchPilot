import { container } from "../../../container";
import { createHealthHandler } from "../../../server/health-handler";

export const dynamic = "force-dynamic";

export const GET = createHealthHandler(container);
