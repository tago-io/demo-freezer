import { Utils, Services, Account, Device, Types, Analysis } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { ConfigurationParams } from "@tago-io/sdk/out/modules/Account/devices.types";
import getDevice from "./lib/getDevice";
import { ServiceParams, TagoContext, ServicesAnalysis, TagoData } from "./types";
import getPushMessage from "./lib/getPushMessage";

interface IAlertResult {
  sms?: boolean;
  email?: boolean;
  notif?: boolean;
  message?: string;
  subject?: string;
  reset?: boolean;
  location?: string;
  device_name?: string;
  percent?: string;
  current_temp?: string;
  temperature_threshold?: string;
  unit?: string;
}

async function sendMessage(
  context: TagoContext,
  account: Account,
  alerts: Array<IAlertResult & { variable?: string }>,
  company_dev: Device,
  device_name: string,
  company_id: string
) {
  const smsService = new Services({ token: context.token }).sms;
  const emailService = new Services({ token: context.token }).email;

  const smsList = alerts.filter((item) => item.sms);
  const emailList = alerts.filter((item) => item.email);
  const notifList = alerts.filter((item) => item.notif);

  if (!smsList.length && !emailList.length && !notifList.length) return context.log("No alert");

  //fetching sms and email of super users
  const smsSupersList = [];
  const emailSupersList = [];

  const manager_list = await account.run.listUsers({
    page: 1,
    fields: ["id", "phone", "email", "tags"],
    filter: {
      tags: [
        // { key: "access", value: "manager" },
        { key: "company_id", value: company_id },
      ],
    },
    amount: 10000,
  });

  //this line is because theres a bug on SDK
  const manager_list_trick = manager_list.filter((x) => x.tags.find((y) => y.value === "manager"));

  const admin_list = await account.run.listUsers({
    page: 1,
    fields: ["id", "phone", "email"],
    filter: {
      tags: [{ key: "access", value: "admin" }],
    },
    amount: 10000,
  });

  for (const admin of admin_list) {
    smsSupersList.push(admin?.phone);
    emailSupersList.push(admin.email);
  }

  for (const manager of manager_list_trick) {
    smsSupersList.push(manager?.phone);
    emailSupersList.push(manager.email);
  }
  context.log(emailSupersList);

  const message = alerts.find((x) => x?.message)?.message;

  if (!message) return "No message";

  let template_name: string;

  if (message.includes("Low")) template_name = "device_alert_battery";
  else if (message.includes("threshold")) template_name = "device_alert_temperature";
  else if (message.includes("normal")) template_name = "device_alert_normal";

  const message_builder = {
    device: alerts[0].device_name,
    location: alerts[0].location,
    percent: alerts[0].percent,
    current_temp: alerts[0]?.current_temp,
    threshold_temperature: alerts[0]?.temperature_threshold,
    unit: alerts[0]?.unit,
  };

  //SMS
  if ((smsList.length || smsSupersList.length) && alerts.find((x) => x.sms)) {
    const [sms_targets] = (await company_dev.getData({ variables: "alerts_sms", qty: 1 })) as any as [{ value: string }];

    const builded_template = await getPushMessage(account, message_builder, template_name);

    if (sms_targets?.value) {
      sms_targets.value.split(",").forEach((phone) => {
        smsService
          .send({
            message: builded_template.value,
            to: phone,
          })
          .catch(context.log);
      });
    }
    smsSupersList.forEach((phone) => {
      smsService
        .send({
          message: builded_template.value,
          to: phone,
        })
        .catch(context.log);
    });
  }

  //EMAIL
  if ((emailList.length || emailSupersList.length) && alerts.find((x) => x.email)) {
    const [email_target] = (await company_dev.getData({ variables: "alerts_email", qty: 1 })) as any as [{ value: string }];

    if (email_target?.value) {
      const external_email_list = email_target.value.split(";");

      external_email_list.forEach((email) =>
        emailService
          .send({
            to: email,
            template: {
              name: template_name,
              params: message_builder,
            },
          })
          .then(context.log)
          .catch(context.log)
      );
    }

    emailSupersList.forEach((email) => {
      emailService
        .send({
          to: email,
          template: {
            name: template_name,
            params: message_builder,
          },
        })
        .then(context.log)
        .catch(context.log);
    });
  }

  //NOTIFICATION
  if (alerts.find((x) => x.notif)) {
    const builded_template = await getPushMessage(account, message_builder, template_name);
    const notif_message = builded_template.value.substr(15, builded_template.value.length - 59);
    admin_list.forEach(({ id: user_id }) => {
      account.run
        .notificationCreate(user_id, {
          message: notif_message,
          title: "Your sensor triggered an alert!",
        })
        .then(console.log, console.log)
        .catch((msg) => console.log(msg));
    });
    manager_list_trick.forEach(({ id: user_id }) => {
      account.run
        .notificationCreate(user_id, {
          message: notif_message,
          title: "Your sensor triggered an alert!",
        })
        .then(console.log, console.log)
        .catch((msg) => console.log(msg));
    });
  }
}

async function batteryAlert(
  account: Account,
  company_dev: Device,
  device: Device,
  data: TagoData,
  device_name: string,
  company_name: string,
  building_name: string,
  allow_email: boolean,
  allow_sms: boolean,
  allow_notif: boolean
): Promise<IAlertResult> {
  const [battery_alert] = await company_dev.getData({ variables: "alert_low_battery", qty: 1 });

  if (!battery_alert?.value) console.log("NO BATTERY ALERT SETUP YET");

  const percent = data.value; //decide to not use percent, only V

  let message;
  if (Number(percent) <= Number(battery_alert?.value)) {
    message = `* Low battery: ${percent}V. Located on: ${company_name} - ${building_name}`;
  } else {
    return {
      sms: allow_sms as boolean,
      email: allow_email as boolean,
      notif: allow_notif as boolean,
      reset: true,
      message: `Device "${device_name}" battery is back to normal`,
      device_name: device_name,
      location: `${company_name} - ${building_name}`,
    };
  }

  return {
    sms: allow_sms as boolean,
    email: allow_email as boolean,
    notif: allow_notif as boolean,
    message,
    subject: "Sensor battery alert!",
    device_name: device_name,
    location: `${company_name} - ${building_name}`,
    percent: `${percent}V`,
  };
}

async function temperatureAlert(
  account: Account,
  company_dev: Device,
  device: Device,
  data: TagoData,
  device_name: string,
  company_name: string,
  building_name: string,
  allow_email: boolean,
  allow_sms: boolean,
  allow_notif: boolean
): Promise<IAlertResult> {
  let message;
  let temperature_threshold = "";
  let current_temperature = Number(data.value);

  const alert_data = await company_dev.getData({ variables: ["alert_temp_max", "alert_temp_min", "alert_temp_unit"], qty: 1 });
  const alert_temp_max = alert_data.find((x) => x.variable === "alert_temp_max")?.value;
  const alert_temp_min = alert_data.find((x) => x.variable === "alert_temp_min")?.value;
  const alert_temp_unit = alert_data.find((x) => x.variable === "alert_temp_unit")?.value || "F";

  //handling all data in celcius
  if (alert_temp_unit === "F") {
    current_temperature = Number(data.value) * (9 / 5) + 32;
  }

  if (alert_temp_max && current_temperature > alert_temp_max) {
    message = `* Sensor "${device_name}" reported a high temperature. Current temperature: ${current_temperature} ${alert_temp_unit} / Maximum temperature threshold: ${alert_temp_max} ${alert_temp_unit}. Located on: ${company_name} - ${building_name}`;
    temperature_threshold = alert_temp_max as string;
  } else if (alert_temp_min && current_temperature < alert_temp_min) {
    message = `* Sensor "${device_name}" reported a low temperature. Current temperature: ${current_temperature} ${alert_temp_unit} / Minimum temperature threshold: ${alert_temp_min} ${alert_temp_unit}. Located on: ${company_name} - ${building_name}`;
    temperature_threshold = alert_temp_min as string;
  } else {
    return {
      sms: allow_sms,
      email: allow_email,
      notif: allow_notif,
      reset: true,
      message: `Sensor "${device_name}" temperature status is back to normal.`,
      device_name: device_name,
      location: `${company_name} - ${building_name}`,
    };
  }

  return {
    sms: allow_sms,
    email: allow_email,
    notif: allow_notif,
    message,
    subject: "Sensor triggered a temperature alert!",
    device_name: device_name,
    location: `${company_name} - ${building_name}`,
    current_temp: String(current_temperature),
    temperature_threshold,
    unit: alert_temp_unit as string,
  };
}

const alertFunctions: any = {
  battery: batteryAlert,
  temp_sht: temperatureAlert,
  temp_ds: temperatureAlert,
};

async function handler(context: TagoContext, scope: TagoData[]) {
  context.log("Running Analysis");

  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  } else if (!environment.config_token) {
    throw "Missing config_token environment var";
  } else if (!environment.account_token) {
    throw "Missing account_token environment var";
  }

  const { origin: device_id } = scope[0] as { origin: string };

  const config_dev = new Device({ token: environment.config_token });
  const account = new Account({ token: environment.account_token });

  const device = await getDevice(account, device_id);

  const { tags, name: device_name } = await account.devices.info(device_id);
  const { value: company_id } = (tags.find((tag) => tag.key === "company_id") as { value: string }) || {};
  const { value: bldg_id } = (tags.find((tag) => tag.key === "building_id") as { value: string }) || {};

  if (!company_id) return context.log(`Sensor ${device_id} has no building`);
  if (!bldg_id) return context.log(`Sensor ${device_id} has no apartment`);

  const company_dev = await getDevice(account, company_id);

  const [company_name] = await config_dev.getData({ variables: "company_name", series: company_id, qty: 1 });
  const [building_name] = await company_dev.getData({ variables: "building_name", series: bldg_id, qty: 1 });
  // const phone_numbers = await company_dev.getData({ variables: ["building_phone1", "building_phone2", "building_phone3"], series: bldg_id, qty: 1 });

  const alerts: Array<IAlertResult & { variable?: string }> = [];
  const params = await account.devices.paramList(device_id);

  const setup = await company_dev.getData({ variables: ["alert_send_email", "alert_send_sms", "alert_send_notif"], qty: 1 });
  const allow_email = setup.find((item) => item.variable.includes("email"));
  const allow_sms = setup.find((item) => item.variable.includes("sms"));
  const allow_notif = setup.find((item) => item.variable.includes("notif"));

  for (const item of scope) {
    if (item.variable in alertFunctions) {
      const param_key = (item.variable as string).includes("temp") ? "temp" : item.variable;
      const trigger: ConfigurationParams = params.find((param) => param.key === param_key) || { key: param_key, sent: false, value: "false" }; //PARAM VALUE CAN ONLY BE STRING

      const result = (await alertFunctions[item.variable](
        account,
        company_dev,
        device,
        item,
        device_name,
        company_name.value as string,
        building_name.value as string,
        allow_email?.value as boolean,
        allow_sms?.value as boolean,
        allow_notif?.value as boolean
      )) as IAlertResult;

      if (result.reset) {
        if (trigger.sent) {
          //if is back to normal and the notif has been sent
          await account.devices.paramSet(device_id, { ...trigger, sent: false, value: "false" });
          const alert_history = {
            variable: "alert_history",
            value: result.message,
            metadata: {
              color: "lightgreen",
              company: company_id,
              bldg: bldg_id,
              sensor: device_name,
              link: `https://admin.tago.io/dashboards/info/${environment.dash_freezer_sensor}?company_device=${company_id}&building_device=${bldg_id}&freezer_sensor=${device_id}`,
            },
          };
          await device.sendData(alert_history);
          //Audit Logs (global)
          company_dev.sendData(alert_history);
          config_dev.sendData(alert_history);
          alerts.push(result);
        }
      } else if (!result.reset && !trigger.sent) {
        await account.devices.paramSet(device_id, { ...trigger, sent: true, value: "true" }).catch((e) => console.log(e));
        alerts.push(result);
      }
    }
  }

  if (!alerts.length) return;
  console.log(alerts);
  const history = alerts.map((item) =>
    item?.reset
      ? null
      : {
          variable: "alert_history",
          value: item.message.replace("* ", ""),
          metadata: {
            color: "pink",
            company: company_id,
            bldg: bldg_id,
            sensor: device_name,
            link: `https://admin.tago.io/dashboards/info/${environment.dash_freezer_sensor}?company_device=${company_id}&building_device=${bldg_id}&freezer_sensor=${device_id}`,
          },
        }
  );
  //sensor details auditlog
  device.sendData(history);

  //company summary
  company_dev.sendData(history);

  //summary auditlog
  config_dev.sendData(history);

  sendMessage(context, account, alerts, company_dev, device_name, company_id);
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

export default new Analysis(startAnalysis, { token: "32fd3ab6-47b4-43e2-b622-b7b9521b7c6b" });
