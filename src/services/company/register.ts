import { Device, Account } from "@tago-io/sdk";
import { DeviceCreateInfo, ConfigurationParams } from "@tago-io/sdk/out/modules/Account/devices.types";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";
import validation from "../../lib/validation";
import { parseTagoObject } from "../../lib/data.logic";
import findDashboardByExportID from "../../lib/getDashboardByExportID";

async function installDevice(account: Account, new_company_name: string) {
  const device_data: DeviceCreateInfo = {
    name: new_company_name,
  };

  const new_company = await account.devices.create(device_data);

  await account.devices.edit(new_company.device_id, {
    tags: [
      { key: "company_id", value: new_company.device_id },
      { key: "device_type", value: "company" },
    ],
  });

  const new_company_dev = new Device({ token: new_company.token });

  return { ...new_company, device: new_company_dev } as DeviceCreated & { device: Device };
}

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const validate = validation("new_company_validation", config_dev);
  validate("Resgistering...", "warning");

  const settings_id = (await config_dev.info()).id;

  const new_company_name = scope.find((x) => x.variable === "new_company_name");
  const new_company_address = scope.find((x) => x.variable === "new_company_address");

  if (!new_company_name?.value) {
    validate("Missing Building's name", "danger");
    throw "<New Device> Missing company's name";
  } else if ((new_company_name.value as string).length < 3) {
    throw validate("Building name must be greater than 3 characters", "danger");
  } else if (!new_company_address?.value) {
    validate("Missing Building's address", "danger");
    throw "<New Device> Missing company's address";
  }

  const [company_exists] = await config_dev.getData({ variables: "company_name", values: new_company_name.value, qty: 1 });
  if (company_exists) {
    validate("The Building is already registered", "danger");
    throw "<New Device> Company already exist.";
  }

  const { bucket_id, device_id, device: company_dev }: DeviceCreated = await installDevice(account, new_company_name.value as string);

  const serie = device_id;

  const dash_locations = await findDashboardByExportID(account, "602511d67cb78b001351dbca");

  const url = `https://admin.tago.io/dashboards/info/${dash_locations}?company_dev=${serie}&settings_dev=${settings_id}`;

  const device_data = parseTagoObject(
    {
      company_id: {
        value: serie,
        metadata: {
          label: new_company_name.value,
          url,
        },
      },
      company_name: {
        value: new_company_name.value,
        location: new_company_address.location,
        metadata: {
          url,
          status: "No data",
        },
      },
      company_address: {
        value: new_company_address.value,
        location: new_company_address.location,
      },
    },
    serie
  );

  await config_dev.sendData(device_data);
  // await company_dev.sendData(device_data[1]); //send company_name as fallback

  validate("Building successfully added", "success");
};
