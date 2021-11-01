import { Device, Account } from "@tago-io/sdk";
import { DeviceCreateInfo, ConfigurationParams } from "@tago-io/sdk/out/modules/Account/devices.types";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";
import validation from "../../lib/validation";
import { parseTagoObject } from "../../lib/data.logic";
import findDashboardByExportID from "../../lib/getDashboardByExportID";

async function installDevice(account: Account, { building_name, company_id, building_category }: any) {
  const device_data: DeviceCreateInfo = {
    name: building_name,
  };

  const new_building = await account.devices.create(device_data);

  await account.devices.edit(new_building.device_id, {
    tags: [
      { key: "building_id", value: new_building.device_id },
      { key: "company_id", value: company_id },
      { key: "device_type", value: "building" },
      { key: "building_category", value: building_category },
    ],
  });

  const new_building_dev = new Device({ token: new_building.token });

  return { ...new_building, device: new_building_dev } as DeviceCreated & { device: Device };
}

export default async ({ config_dev, context, scope, account, environment }: ServiceParams, company_dev: Device) => {
  const validate = validation("new_building_validation", company_dev);
  validate("Resgistering...", "warning");

  const settings_id = (await config_dev.info()).id;

  const new_building_name = scope.find((x) => x.variable === "new_building_name");
  const new_building_category = scope.find((x) => x.variable === "new_building_category");
  const company_id = scope[0].origin as string;

  if (!new_building_name.value) {
    throw validate("Missing building's name", "danger");
  } else if ((new_building_name.value as string).length < 3) {
    throw validate("Apartment name must be greater than 3 characters", "danger");
  } else if (!new_building_category.value) {
    throw validate("Missing building's category", "danger");
  }

  const [building_exists] = await company_dev.getData({ variables: "building_name", values: new_building_name.value, qty: 1 });
  if (building_exists) {
    throw validate("This Apartment is already registered", "danger");
  }

  const {
    bucket_id,
    device_id,
    device: building_dev,
  }: DeviceCreated = await installDevice(account, {
    building_name: new_building_name.value as string,
    company_id,
    building_category: new_building_category.value as string,
  });

  const { timezone } = await account.info();

  const serie = device_id;

  const dash_location_summary = await findDashboardByExportID(account, "60195e9f66fd8200111fb117");

  const url = `https://admin.tago.io/dashboards/info/${dash_location_summary}?company_device=${company_id}&building_device=${device_id}`;

  const device_data = parseTagoObject(
    {
      building_id: {
        value: serie,
        metadata: {
          label: new_building_name.value,
          url,
        },
      },
      building_name: {
        value: new_building_name.value,
        location: new_building_name.location,
        metadata: {
          url,
          status: "No data",
        },
      },
      building_category: new_building_category.value,
    },
    device_id
  );

  await company_dev.sendData(device_data);

  //send fallback to building_dev
  await building_dev.sendData(device_data);

  //dropdown filter
  await config_dev.sendData({
    variable: "building_id",
    value: device_id,
    serie: company_id,
    metadata: {
      label: new_building_name.value as string,
      url: `https://admin.tago.io/dashboards/info/${environment.dash_apt_summary}?company_device=${company_id}&building_device=${device_id}`,
    },
  });

  validate("Location successfully added", "success");
};
