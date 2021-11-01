import { Utils, Services, Account, Device, Analysis, Types } from "@tago-io/sdk";
import { ServiceParams, TagoContext, ServicesAnalysis, TagoData } from "./types";

const servicesCollection = Promise.all([
  import("./services/super_users"),
  import("./services/sensor"),
  import("./services/company"),
  import("./services/building"),
  import("./services/company_users"),
  import("./services/alert"),
]) as Promise<ServicesAnalysis[]>;

async function handler(context: TagoContext, scope: TagoData[]): Promise<void> {
  context.log(JSON.stringify(scope));
  context.log("Running Analysis");

  const environment = Utils.envToJson(context.environment);
  if (!environment) {
    return;
  }

  if (!environment.config_token) {
    throw "Missing config_token environment var";
  } else if (!environment.account_token) {
    throw "Missing account_token environment var";
  }

  const config_dev = new Device({ token: environment.config_token });
  const account = new Account({ token: environment.account_token });
  const notification = new Services({ token: context.token }).Notification;

  const serviceParams: ServiceParams = { context, account, config_dev, scope, notification, environment };

  const service = (await servicesCollection).find((x) => x.checkType(scope, environment));
  if (service) {
    await service.controller(serviceParams);
  }
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
export default new Analysis(startAnalysis, { token: "7327d9c7-6810-4dee-a7ee-0b5fe09991ba" });
