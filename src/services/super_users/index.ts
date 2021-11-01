import { ServiceParams, TagoData, EnvironmentItemObject } from "../../types";
import add from "./register";
import remove from "./remove";
import editUser from "./edit";

/**
 * Check each variable sent in the scope of the analysis.
 * Compare by variable name (since each widget have their correct variables)
 * Actions like delete and edit does send the internal environment variable _widget_exec when the user take this kind of action.
 */
function checkType(scope: TagoData[], environment: EnvironmentItemObject) {
  if (scope.find((x) => x.variable === "new_user_name")) return "add";
  else if (scope.find((x) => ["admin_name", "user_name"].includes(x.variable)) && environment._widget_exec === "delete") return "remove";
  else if (scope.find((x) => ["user_company", "user_name", "admin_name", "user_phone", "admin_phone"].includes(x.variable)) && environment._widget_exec === "edit") return "edit";
}

/**
 * Simple service controller to find the function for given variables.
 */
async function controller(params: ServiceParams) {
  const type = checkType(params.scope, params.environment);
  if (type === "add") await add(params);
  else if (type === "remove") await remove(params);
  else if (type === "edit") await editUser(params);
}

export { checkType, controller };
