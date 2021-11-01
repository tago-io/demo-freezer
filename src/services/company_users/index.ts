import { Device } from "@tago-io/sdk";
import { ServiceParams, TagoData, EnvironmentItemObject } from "../../types";
import getDevice from "../../lib/getDevice";
import add from "./register";
import remove from "./remove";
import editUser from "./edit";

/**
 * Check each variable sent in the scope of the analysis.
 * Compare by variable name (since each widget have their correct variables)
 * Actions like delete and edit does send the internal environment variable _widget_exec when the user take this kind of action.
 */
function checkType(scope: TagoData[], environment: EnvironmentItemObject) {
  if (scope.find((x) => x.variable === "new_company_user_name")) return "add";
  else if (scope.find((x) => x.variable === "company_user_name") && environment._widget_exec === "delete") return "remove";
  else if (scope.find((x) => x.variable.includes("company_user_")) && environment._widget_exec === "edit") return "edit";
}

/**
 * Simple service controller to find the function for given variables.
 */
async function controller(params: ServiceParams) {
  const type = checkType(params.scope, params.environment);

  let customer_dev: Device = null;

  if (params.scope.find((x) => x.variable === "hidden")) customer_dev = await getDevice(params.account, params.scope[0].origin);

  if (type === "add") await add(params, customer_dev);
  else if (type === "remove") await remove(params, customer_dev);
  else if (type === "edit") await editUser(params);
}

export { checkType, controller };
