import { Account, Device } from "@tago-io/sdk";
import { parseTagoObject } from "./data.logic";

export default function auditLogSetup(account: Account, device: Device) {
  return async function _(new_value: string, old_value?: string, user_id?: string) {
    if (!new_value) throw "Missing new_value";
    let name = "Administrador";
    if (user_id) {
      ({ name } = (await account.run.userInfo(user_id)) || { name: "Administrator" });
      if (name === "Administrador") user_id = "Administrador";
    }

    device.sendData(
      parseTagoObject(
        {
          audit_user: { value: user_id || "Administrador", metadata: { label: name } },
          audit_new_value: new_value,
          audit_old_value: old_value,
        },
        String(new Date().getTime())
      )
    );
  };
}
