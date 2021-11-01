import { Device, Account } from "@tago-io/sdk";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams, company_dev: Device) => {
  const { serie: building_id } = scope[0];

  await config_dev.deleteData({ values: building_id, qty: 9000 });

  await company_dev.deleteData({ series: building_id, qty: 9999 });
  await company_dev.deleteData({ variables: "device_building", values: building_id, qty: 999 });

  const device_info = await account.devices.info(building_id);
  await account.devices.delete(building_id);
  await account.buckets.delete(device_info.bucket.id);

  return;
};
