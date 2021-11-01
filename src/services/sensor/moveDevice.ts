import { Device, Account, Utils } from "@tago-io/sdk";
import { DataToSend } from "@tago-io/sdk/out/modules/Device/device.types";
import { ServiceParams, TagoContext, TagoData, DeviceCreated, Metadata } from "../../types";
import getDevice from "../../lib/getDevice";
import validation from "../../lib/validation";
import findDashboardByExportID from "../../lib/getDashboardByExportID";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const validate = validation("move_device_validation", config_dev);
  validate("Moving...", "warning");

  const device_move_eui = scope.find((x) => x.variable === "move_device_eui"); //edit on the widget seems to have different serie
  const [device_eui] = await config_dev.getData({ variables: "device_eui", values: device_move_eui.value, qty: 1 });
  const [dev_id_data] = await config_dev.getData({ series: device_eui.serie, variables: "device_id", qty: 1 });
  const device_id = dev_id_data?.value as string; //device_eui.serie is device_id -> correct

  const { value: company_id, metadata: company_metadata } = scope.find((x) => x.variable === "move_device_company") as { value: string; metadata: Metadata };
  const { value: building_id, metadata: build_metadata } = scope.find((x) => x.variable === "move_device_building") as { value: string; metadata: Metadata };

  let { tags } = await account.devices.info(device_id);
  const old_company = tags.find((tag) => tag.key === "company_id");
  const old_building = tags.find((tag) => tag.key === "building_id");

  if (old_company?.value === company_id && old_building?.value === building_id) {
    return validate("Device is already in this building and apartment", "warning");
  }

  tags = tags.filter((tag) => !["company_id", "building_id"].includes(tag.key));
  tags.push({ key: "company_id", value: company_id });
  tags.push({ key: "building_id", value: building_id });
  account.devices.edit(device_id, { tags });

  await config_dev.deleteData({ variables: ["device_company", "device_building"], series: device_id });
  const new_data: any = [
    { variable: "device_company", value: company_id, metadata: company_metadata, serie: device_id },
    { variable: "device_building", value: building_id, metadata: build_metadata, serie: device_id },
  ];

  config_dev.sendData(new_data);

  let device_data = await config_dev.getData({ variables: ["device_name", "device_type", "device_eui"], series: device_id, qty: 1 });
  const device_name = device_data.find((data) => data.variable === "device_name");

  // if (device_name.metadata?.url) {
  // device_name.metadata.url = (device_name.metadata.url as string).replace(old_company?.value as string, company_id).replace(old_building?.value as string, building_id);
  const dash_freezer_details = await findDashboardByExportID(account, "60195f92090d3600184cc54f");
  const url = `https://admin.tago.io/dashboards/info/${dash_freezer_details}?company_device=${company_id}&building_device=${building_id}&freezer_sensor=${device_id}`;

  device_name.metadata.url = url;
  // }

  await config_dev.deleteData({ variables: "device_name", series: device_id });
  config_dev.sendData({ ...device_name, time: null });

  device_data = device_data.filter((x) => x.variable !== "device_name");
  device_data = device_data.concat(device_name);

  if (company_id !== old_company?.value) {
    if (old_company) {
      const old_company_dev = await getDevice(account, old_company.value as string).catch(() => null);
      if (old_company_dev) old_company_dev.deleteData({ serie: device_id, qty: 9000 });
    }

    const company_dev = await getDevice(account, company_id);
    company_dev.sendData(device_data.concat(new_data));
  }

  if (old_building?.value) {
    const old_build_dev = await getDevice(account, old_building.value as string).catch(() => null);
    if (old_build_dev) old_build_dev.deleteData({ serie: device_id, qty: 9000 });
  }

  const building_dev = await getDevice(account, building_id);
  //device_name.metadata.url prob
  building_dev.sendData(device_data.concat(new_data));

  config_dev.sendData({
    variable: "filter_device_eui",
    value: device_move_eui.value as string,
    serie: company_id as string,
  });

  validate("Device succesfully moved!", "success");
};
