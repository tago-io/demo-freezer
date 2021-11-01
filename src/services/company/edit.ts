import { Device, Account } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import getDevice from "../../lib/getDevice";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const name = scope.find((x) => x.variable === "company_name");
  const address = scope.find((x) => x.variable === "company_address");

  const { serie: company_id } = scope[0];
  const company_dev = await getDevice(account, company_id);

  if (name) {
    await account.devices.edit(company_id, { name: name.value as string });
    const bucket_id = (await account.devices.info(company_id)).bucket.id;
    await account.buckets.edit(bucket_id, { name: name.value as string });

    const [company_data] = await config_dev.getData({ variables: "company_id", qty: 1, series: company_id });
    await config_dev.deleteData({ ids: company_data.id });
    company_data.metadata.label = name.value as string;
    delete company_data.time;
    delete company_data.id;
    await config_dev.sendData(company_data);

    const devs_company = await account.devices.list({
      page: 1,
      fields: ["id", "name", "tags"],
      filter: { tags: [{ key: "company_id", value: company_id }] },
      amount: 10000,
    });

    const id_list: Array<string> = [];

    devs_company.forEach((dev) => {
      id_list.push(dev.id);
    });

    const device_company_data = await config_dev.getData({ variables: "device_company", series: id_list });
    const valve_company_data = await config_dev.getData({ variables: "valve_company", series: id_list });
    await config_dev.deleteData({ variables: "device_company", series: id_list });
    await config_dev.deleteData({ variables: "valve_company", series: id_list });

    for (const obj of device_company_data) {
      (obj.metadata as any).label = name.value;
      await config_dev.sendData(obj);
    }
    for (const obj of valve_company_data) {
      (obj.metadata as any).label = name.value;
      await config_dev.sendData(obj);
    }
  }

  if (address) {
    const [company_name] = await config_dev.getData({ variables: "company_name", qty: 1, series: company_id });
    await config_dev.deleteData({ ids: company_name.id });

    company_name.location = address.location;
    await config_dev.sendData(company_name);
  }
};
