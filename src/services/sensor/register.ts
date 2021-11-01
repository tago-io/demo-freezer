import { Device, Account, Types, Utils } from "@tago-io/sdk";
import { DeviceCreateInfo, ConfigurationParams } from "@tago-io/sdk/out/modules/Account/devices.types";
import { TagsObj } from "@tago-io/sdk/out/common/common.types";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";
import validation from "../../lib/validation";
import getDevice from "../../lib/getDevice";
import findDashboardByExportID from "../../lib/getDashboardByExportID";

interface DeviceCreationData {
  device_name: string;
  connector_network: string;
  device_eui: string;
  company_id: string;
  building_id?: string;
}

async function installDevice(account: Account, { device_name, device_eui, connector_network, company_id, building_id }: DeviceCreationData) {
  const [network, connector] = connector_network.split(",");

  const device_data: DeviceCreateInfo = {
    name: device_name,
    active: true,
    serie_number: device_eui,
    connector,
    network,
    tags: [
      { key: "device_type", value: "freezer" },
      { key: "device_eui", value: device_eui },
      { key: "company_id", value: company_id },
    ],
  };

  if (building_id) {
    device_data.tags.push({ key: "building_id", value: building_id });
  }

  const new_device = await account.devices.create(device_data);
  const device = new Device({ token: new_device.token });

  const params = [
    { key: "battery_voltage", value: "false", sent: false },
    { key: "external_input", value: "false", sent: false },
    { key: "checkin", value: "checkin", sent: false },
  ];

  params.forEach((item) => account.devices.paramSet(new_device.device_id, item));

  return { ...new_device, device } as DeviceCreated & { device: Device };
}

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const validate = validation("new_device_validation", config_dev);
  validate("Resgistering...", "warning");

  const new_device_name = scope.find((x) => x.variable === "new_device_name");
  const new_device_company = scope.find((x) => x.variable === "new_device_company");
  const new_device_building = scope.find((x) => x.variable === "new_device_building");
  const new_device_type = scope.find((x) => x.variable === "new_device_type");
  const new_device_eui = scope.find((x) => x.variable === "new_device_eui"); //str.slice(23,39)

  // const new_device_type = { value: "5ed7ccd5427104001cf00183,5f5a8f3351d4db99c40ded32", metadata: { label: "Tektelic Smart Home Sensor", meter_type: "leak" } }

  if (!new_device_name?.value) {
    throw validate("Missing device's name", "danger");
  } else if ((new_device_name?.value as string).length < 3) {
    throw validate("Device name must be greater than 3 characters", "danger");
  } else if (!new_device_company?.value) {
    throw validate("Missing device's company", "danger");
  } else if (!new_device_type?.value) {
    throw validate("Missing device's type", "danger");
  } else if (!new_device_eui?.value) {
    throw validate("Missing device's EUI", "danger");
  }

  if ((new_device_eui.value as string).length > 16) {
    // URN:LWDP:647FDA8010000000:647FDA00000073C6:SMTBBUS915:NNNNNNNN
    new_device_eui.value = (new_device_eui.value as string).slice(26, 42);
  }

  const [already_exist] = await config_dev.getData({ variables: ["device_eui", "device_name"], values: [new_device_name.value, new_device_eui.value], qty: 1 });
  if (already_exist?.variable === "device_eui") {
    throw validate("Device EUI already registered.", "danger");
  }
  // else if (already_exist?.variable === "device_name") {
  //   throw validate("Device reference already registered", "danger");
  // }
  const device_creation: DeviceCreationData = {
    device_name: new_device_name.value as string,
    device_eui: (new_device_eui.value as string).toUpperCase(),
    connector_network: new_device_type.value as string,
    company_id: new_device_company.value as string,
    building_id: new_device_building.value as string,
  };

  const { device_id, device } = await installDevice(account, device_creation)
    .catch((error) => {
      throw validate(error, "danger");
    })
    .catch((error) => {
      validate(error, "danger");
      throw error;
    });

  const dash_freezer_details = await findDashboardByExportID(account, "60195f92090d3600184cc54f");

  const url = `https://admin.tago.io/dashboards/info/${dash_freezer_details}?building_device=${new_device_building.value}&company_device=${new_device_company.value}&freezer_sensor=${device_id}`;

  const serie = device_id;
  const device_data = [
    {
      variable: "device_id",
      value: serie,
      serie,
      metadata: {
        label: new_device_name.value,
      },
    },
    {
      variable: "device_name",
      value: new_device_name.value,
      serie,
      metadata: {
        url,
        status: "No data",
      },
    },
    {
      variable: "device_eui",
      value: new_device_eui.value,
      serie,
      metadata: {
        label: `${new_device_name.value} - ${new_device_eui.value}`,
      },
    },
    {
      variable: "device_company",
      value: new_device_company.value,
      serie,
      metadata: new_device_company.metadata,
    },
    {
      variable: "device_type",
      value: new_device_type.value,
      serie,
      metadata: new_device_type.metadata,
    },
  ];

  if (new_device_building?.value) {
    device_data.push({
      variable: "device_building",
      serie,
      value: new_device_building.value,
      metadata: new_device_building.metadata,
    });

    const building_dev = await getDevice(account, new_device_building.value as string);
    const building_data = device_data.filter((x) => ["device_id", "device_name", "device_type"].includes(x.variable));
    building_dev.sendData(building_data);
  }

  await config_dev.sendData(device_data);

  //filter purposes
  config_dev.sendData({
    variable: "filter_device_eui",
    value: new_device_eui.value as string,
    serie: new_device_company.value as string,
    metadata: {
      dev_serie: serie,
      label: `${new_device_name.value} - ${new_device_eui.value}`,
    },
  });

  const company_data = device_data.filter((x) => ["device_name", "device_type", "device_eui", "device_building"].includes(x.variable));
  const company_device = await getDevice(account, new_device_company.value as string);
  await company_device.sendData(company_data);

  //keeping device_name at sensor_dev (problem with deleting device_name and not sending an updating)
  const sensor_dev = await getDevice(account, device_id);
  await sensor_dev.sendData({
    variable: "device_name",
    value: new_device_name.value,
    serie,
    metadata: {
      url,
      status: "No data",
    },
  });

  validate("Device successfully added", "success");
};
