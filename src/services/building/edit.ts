import { Device, Account } from "@tago-io/sdk";
import { parseTagoObject } from "../../lib/data.logic";
import getDevice from "../../lib/getDevice";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams, company_dev: Device) => {
  const name = scope.find((x) => x.variable === "building_name");

  const { serie, origin: company_id } = scope[0]; //serie -> building_id
  const building_dev = await getDevice(account, serie);

  if (name) {
    const [building_data] = await company_dev.getData({ variables: "building_id", qty: 1, series: serie });
    await company_dev.deleteData({ ids: building_data.id });
    await config_dev.deleteData({ variables: "building_id", values: serie });
    building_data.metadata.label = name.value as string;
    delete building_data.time;
    delete building_data.id;
    await company_dev.sendData(building_data);
    await config_dev.sendData({
      variable: "building_id",
      value: serie,
      serie: company_id, //
      metadata: { url: building_data.metadata.url, label: name.value as string },
    });

    await account.devices.edit(serie, { name: name.value as string });
    const bucket_id = (await account.devices.info(serie)).bucket.id;
    await account.buckets.edit(bucket_id, { name: name.value as string });

    //

    const devs_building = await account.devices.list({
      page: 1,
      fields: ["id", "name", "tags"],
      filter: {
        tags: [
          { key: "building_id", value: building_data.value as string },
          { key: "device_type", value: "freezer" },
        ],
      },
      amount: 10000,
    });

    const id_list: Array<string> = [];

    devs_building.forEach((dev) => {
      id_list.push(dev.id);
    });

    const device_company_data = await config_dev.getData({ variables: "device_building", series: id_list });
    await config_dev.deleteData({ variables: "device_building", series: id_list });

    for (const obj of device_company_data) {
      (obj.metadata as any).label = name.value;
      await config_dev.sendData(obj);
    }
  }
};
