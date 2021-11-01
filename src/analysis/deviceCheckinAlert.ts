import { Utils, Services, Account, Device, Types, Analysis } from "@tago-io/sdk";
import { Data, TagsObj } from "@tago-io/sdk/out/common/common.types";
import { ConfigurationParams, DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
import moment from "moment-timezone";
import { parseTagoObject } from "../lib/data.logic";
import getDevice from "../lib/getDevice";
import { TagoContext } from "../types";

async function updateSensorStatus(account: Account, config_dev: Device, dev: DeviceListItem, tags: TagsObj[], status: string) {
  const building_id = tags.find((x) => x.key === "building_id").value as string;

  const [device_name_settings] = await config_dev.getData({ variables: "device_name", series: dev.id });

  const building_dev = await getDevice(account, building_id);

  const [device_name_building] = await building_dev.getData({ variables: "device_name", series: dev.id });

  if (device_name_settings.metadata && device_name_building.metadata) {
    await config_dev.deleteData({ variables: "device_name", series: dev.id });
    await building_dev.deleteData({ variables: "device_name", series: dev.id });

    await config_dev.sendData({ ...device_name_settings, metadata: { ...device_name_settings.metadata, status: status, color: "" } });
    await building_dev.sendData({ ...device_name_building, metadata: { ...device_name_building.metadata, status: status, color: "" } });
  }
}

async function resolveCheckinSensor(account: Account, config_dev: Device, dev: DeviceListItem, checkin_time: string, company_id: string) {
  const sensor_dev = await getDevice(account, dev.id);
  const { last_input: lastcheckin, tags, name: sensor_name } = await sensor_dev.info();

  const diff = moment().diff(moment(lastcheckin), "hours");

  console.log(diff);
  console.log(checkin_time);

  const sensor_params = await account.devices.paramList(dev.id);
  const checkin_param = sensor_params.find((x) => x.key === "checkin");

  if (Number(checkin_time) < Number(diff) && checkin_time && !checkin_param?.sent) {
    // console.log(`Last input time greater than Checkin time -> ${checkin_time}`);

    const building_id = tags.find((x) => x.key === "building_id").value as string;
    const { name: company_name } = await account.devices.info(company_id);
    const { name: building_name } = await account.devices.info(building_id);

    await account.devices.paramSet(dev.id, { ...checkin_param, sent: true });

    config_dev.sendData({
      variable: "alert_history",
      value: `Device "${sensor_name}" inactivity warning. Located on: ${company_name} - ${building_name}`,
      metadata: { color: "moccasin", company: company_id, bldg: building_id, sensor: sensor_name },
    });

    await updateSensorStatus(account, config_dev, dev, tags, "inactive");

    return "checkin warning";
  } else if (Number(checkin_time) > Number(diff) && checkin_param?.sent) {
    //checkin back to normal
    await account.devices.paramSet(dev.id, { ...checkin_param, sent: false });

    await updateSensorStatus(account, config_dev, dev, tags, "No data");

    return "back to normal";
  }

  return "Device is normal";
}

async function resolveCompanySensors(account: Account, config_dev: Device, company_id: string) {
  const params = await account.devices.paramList(company_id);
  const checkin_time = params.find((x) => x.key === "checkin")?.value as string;

  if (!checkin_time) return;

  const device_list = await account.devices.list({
    page: 1,
    fields: ["id", "name", "tags", "last_input"],
    filter: {
      tags: [
        { key: "device_type", value: "freezer" },
        { key: "company_id", value: company_id },
      ],
    },
    amount: 10000,
  });

  device_list.forEach(async (dev) => {
    await resolveCheckinSensor(account, config_dev, dev, checkin_time, company_id);
  });
}

async function handler(context: TagoContext, scope: Data[]): Promise<void> {
  context.log("Running Analysis");

  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  } else if (!environment.config_token) {
    throw "Missing config_token environment var";
  } else if (!environment.account_token) {
    throw "Missing account_token environment var";
  }

  const config_dev = new Device({ token: environment.config_token });
  const account = new Account({ token: environment.account_token });

  // if (scope[0]) {
  //   const company_id = (scope[0] as any).company_id as string;
  //   const device_list = (scope[0] as any).device_list as DeviceListItem[];
  //   //call function

  //   await resolveCompanySensors(account, company_id, device_list, config_dev);

  //   return;
  // }

  const company_devices = await account.devices.list({
    page: 1,
    fields: ["id", "name", "tags", "last_input"],
    filter: { tags: [{ key: "device_type", value: "company" }] },
    amount: 10000,
  });

  company_devices.map(async (company) => {
    await resolveCompanySensors(account, config_dev, company.id);
  });

  // const companyDevices = sensorList.reduce((final, dev) => {
  //   const tag_type = dev.tags.find((item) => item.key === "company_id")?.value as string;
  //   if (!tag_type) return final;

  //   if (!final[tag_type]) final[tag_type] = [];
  //   final[tag_type].push(dev);

  //   return final;
  // }, {} as { [key: string]: DeviceListItem[] });

  // companyDevices.f

  // Object.keys(companyDevices).forEach((company_id) => {
  //   account.analysis.run(environment.analysis_id, [{ company_id, device_list: companyDevices[company_id] }]);
  // });
}

async function startAnalysis(context: TagoContext, scope: any) {
  try {
    await handler(context, scope);
    context.log("Analysis finished");
  } catch (error) {
    console.log(error);
    context.log(error.message || JSON.stringify(error));
  }
}

export { startAnalysis, resolveCheckinSensor };
