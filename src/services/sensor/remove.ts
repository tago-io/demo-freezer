import { Device, Account } from "@tago-io/sdk";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";
import getDevice from "../../lib/getDevice";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const { serie, id } = scope[0];
  const device_company = scope.find((x) => x.variable === "device_company");
  const device_building = scope.find((x) => x.variable === "device_building");
  const device_eui = scope.find((x) => x.variable === "device_eui");

  if (device_company) {
    const company_device = await getDevice(account, device_company.value as string);
    await company_device.deleteData({ series: serie, qty: 9999 });
  }

  if (device_building) {
    const building_device = await getDevice(account, device_building.value as string);
    await building_device.deleteData({ series: serie, qty: 9999 });
  }

  await config_dev.deleteData({ series: serie, qty: 9999 });
  await config_dev.deleteData({ variables: "move_device_id", values: id }); //not working

  await config_dev.deleteData({ variables: "filter_device_eui", values: [device_eui.value, (device_eui.value as string).toUpperCase()] });

  const device_info = await account.devices.info(serie);
  await account.devices.delete(serie).then((msg) => console.log(msg));
  await account.buckets.delete(device_info.bucket.id);
};
