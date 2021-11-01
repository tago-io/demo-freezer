import { Device, Account, Utils } from "@tago-io/sdk";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";
import getDevice from "../../lib/getDevice";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const { serie } = scope[0]; //device_id
  const device_name = scope.find((x) => x.variable === "device_name");

  const sensor_dev = await getDevice(account, serie);

  if (device_name) {
    const data = await config_dev.getData({ variables: ["device_id", "device_company", "device_building"], series: serie, qty: 1 });
    const device_id = data.find((x) => x.variable === "device_id");
    const device_company = data.find((x) => x.variable === "device_company");
    const device_building = data.find((x) => x.variable === "device_building");
    await config_dev.deleteData({ ids: device_id.id });

    device_id.metadata.label = device_name.value as string;
    config_dev.sendData(device_id);

    await account.devices.edit(serie, { name: device_name.value as string });

    const bucket_id = (await sensor_dev.info()).bucket;
    await account.buckets.edit(bucket_id.id, { name: device_name.value as string });
    if (device_company?.value) {
      const company_dev = await getDevice(account, device_company.value as string);
      await company_dev.deleteData({ variables: "device_id", series: serie });
      company_dev.sendData(device_id);

      if (device_building?.value) {
        const building_dev = await getDevice(account, device_building.value as string);
        const [dev_name] = await building_dev.getData({ variables: "device_name", qty: 1, series: serie });
        dev_name.value = device_name.value;
        await building_dev.deleteData({ variables: ["device_id", "device_name"], series: serie });
        building_dev.sendData([device_id, dev_name]);
      }
    }

    const [sensor_name_fallback] = await sensor_dev.getData({ variables: "device_name", qty: 1, series: serie });
    await sensor_dev.deleteData({ variables: "device_name", qty: 1, series: serie });
    sensor_name_fallback.value = device_name.value;
    delete sensor_name_fallback.time;
    delete sensor_name_fallback.id;
    await sensor_dev.sendData(sensor_name_fallback);

    //edit also valve details -> tied sensors name
    //edit also filter_device_eui label
  }
};
