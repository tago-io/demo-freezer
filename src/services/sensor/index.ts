import { ServiceParams, TagoData, EnvironmentItemObject } from "../../types";
import getDevice from "../../lib/getDevice";
import add from "./register";
import remove from "./remove";
import editUser from "./edit";
import moveDevice from "./moveDevice";

/**
 * Check each variable sent in the scope of the analysis.
 * Compare by variable name (since each widget have their correct variables)
 * Actions like delete and edit does send the internal environment variable _widget_exec when the user take this kind of action.
 */
function checkType(scope: TagoData[], environment: EnvironmentItemObject) {
  if (scope.find((x) => x.variable === "new_device_eui")) return "add";
  else if (scope.find((x) => x.variable === "device_eui") && environment._widget_exec === "delete") return "remove";
  else if (scope.find((x) => x.variable === "device_name") && environment._widget_exec === "edit") return "edit";
  else if (scope.find((x) => x.variable === "move_device_eui")) return "movedevice";
}

/**
 * Get the tago device class from the origin of the variable in the scope.
 * Service controller to find the function for given variables.
 */
async function controller(params: ServiceParams) {
  const type = checkType(params.scope, params.environment);

  if (type === "add") await add(params);
  else if (type === "remove") await remove(params);
  else if (type === "edit") await editUser(params);
  else if (type === "movedevice") await moveDevice(params);
}

export { checkType, controller };
