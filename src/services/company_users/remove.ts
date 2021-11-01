import { Device, Account } from "@tago-io/sdk";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams, customer_dev: Device) => {
  const { serie: user_id } = scope[0];

  const user_exists = await account.run.userInfo(user_id);
  if (!user_exists) throw "User does not exist";
  await account.run.userDelete(user_id);
  await config_dev.deleteData({ series: user_id, qty: 9999 });
  if (customer_dev) await customer_dev.deleteData({ series: user_id, qty: 9999 });
};
