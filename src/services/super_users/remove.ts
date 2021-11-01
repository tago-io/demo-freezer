import { Device, Account } from "@tago-io/sdk";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const { serie: user_id } = scope[0];

  const user_exists = await account.run.userInfo(user_id);
  if (!user_exists) throw "User does not exist";

  await config_dev.deleteData({ series: user_id, qty: 9999 });

  await account.run.userDelete(user_id);
};
