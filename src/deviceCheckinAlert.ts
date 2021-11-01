import { Analysis } from "@tago-io/sdk";
import { startAnalysis } from "./analysis/deviceCheckinAlert";

export default new Analysis(startAnalysis, { token: "731a761e-4018-433f-9db9-c621a7806111" });
