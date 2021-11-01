import { ServiceParams, TagoData, EnvironmentItemObject } from "../../types";
import getDevice from "../../lib/getDevice";
import add from "./register";

/**
 * Check each variable sent in the scope of the analysis.
 * Compare by variable name (since each widget have their correct variables)
 * Actions like delete and edit does send the internal environment variable _widget_exec when the user take this kind of action.
 */
function checkType(scope: TagoData[], environment: EnvironmentItemObject) {
  if (scope.find((x) => x.variable === "alert_checkin")) return "add";
}

/**
 * Get the tago device class from the origin of the variable in the scope.
 * Service controller to find the function for given variables.
 */
async function controller(params: ServiceParams) {
  const type = checkType(params.scope, params.environment);
  // const company_dev = await getDevice(params.account, params.scope[0].origin);

  if (type === "add") await add(params, params.scope[0].origin);
}

export { checkType, controller };
