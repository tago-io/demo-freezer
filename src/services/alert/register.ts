import { Device, Account } from "@tago-io/sdk";
import { DeviceCreateInfo, ConfigurationParams } from "@tago-io/sdk/out/modules/Account/devices.types";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";
import validation from "../../lib/validation";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams, company_id: string) => {
  const checkin_time = scope.find((x) => x.variable === "alert_checkin");

  const params = await account.devices.paramList(company_id);

  const checkin_param = params.find((x) => x.key === "checkin");

  if (!checkin_time.value && !checkin_param) return;

  if (checkin_param) {
    await account.devices.paramSet(company_id, { ...checkin_param, value: String(checkin_time?.value) || "" });
  } else {
    await account.devices.paramSet(company_id, { key: "checkin", value: String(checkin_time?.value), sent: false });
  }
};
