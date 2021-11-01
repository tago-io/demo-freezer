import { Device } from "@tago-io/sdk";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";
import validation from "../../lib/validation";
import inviteUser from "../../lib/registerUser";
import { parseTagoObject } from "../../lib/data.logic";
import getDevice from "../../lib/getDevice";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams, customer_dev: Device) => {
  const validate = validation("new_company_user_validation", config_dev);
  validate("Inviting...", "warning");

  const new_user_phone = scope.find((x) => x.variable === "new_company_user_phone");
  const new_user_name = scope.find((x) => x.variable === "new_company_user_name");
  const new_user_email = scope.find((x) => x.variable === "new_company_user_email");
  const new_user_company = scope.find((x) => x.variable === "new_company_user_company") || { value: scope[0].origin };
  const new_user_building = scope.find((x) => x.variable === "new_company_user_building" && x.metadata.sentValues);

  if (customer_dev === null) {
    customer_dev = await getDevice(account, new_user_company?.value as string);
  }

  if (!new_user_name.value) {
    validate("Missing user's name", "danger");
    throw "<New Device> Missing user's name";
  }

  if (!new_user_email.value) {
    validate("Missing user's email", "danger");
    throw "<New Device> Missing user's email";
  }

  if (new_user_phone?.value) {
    if (!(new_user_phone.value as string).includes("+")) {
      new_user_phone.value = `+1${new_user_phone.value}`;
    }
  }

  new_user_email.value = String(new_user_email.value).toLowerCase();

  const [user_exists] = await customer_dev.getData({ variables: ["user_email", "admin_email"], values: new_user_email.value, qty: 1 });
  if (user_exists) {
    validate("The user is already registered", "danger");
    throw "<New Device> User already exist.";
  }

  const { timezone } = await account.info();
  const domain_url = environment.run_url;

  const user_data = {
    name: new_user_name.value as string,
    email: new_user_email.value as string,
    timezone,
    company: new_user_company.value as string,
    phone: new_user_phone.value as string,
    tags: [
      { key: "access", value: "apartmentUser" },
      { key: "company_id", value: new_user_company.value as string },
    ],
  };

  user_data.tags = user_data.tags.concat((new_user_building.metadata.sentValues as any).map((x: { key: string; value: string }) => ({ key: "building_id", value: x.value })));
  const new_user_id = await inviteUser(context, account, user_data, domain_url);

  const device_data = parseTagoObject(
    {
      company_user_name: new_user_name.value,
      company_user_email: new_user_email.value,
      company_user_phone: new_user_phone.value,
      company_user_company: new_user_company.value,
      company_user_building: new_user_building,
    },
    new_user_id
  );

  await customer_dev?.sendData(device_data);
  await config_dev.sendData(device_data);

  validate("User successfully added", "success");
};
