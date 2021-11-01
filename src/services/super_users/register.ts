import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";
import validation from "../../lib/validation";
import inviteUser from "../../lib/registerUser";
import { parseTagoObject } from "../../lib/data.logic";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  //managers are not deleted when building is deleted
  const validate = validation("new_user_validation", config_dev);
  validate("Inviting...", "warning");

  const new_user_type = scope.find((x) => x.variable === "new_user_type");
  const new_user_phone = scope.find((x) => x.variable === "new_user_phone"); //still got to work
  const new_user_name = scope.find((x) => x.variable === "new_user_name");
  const new_user_email = scope.find((x) => x.variable === "new_user_email");
  const new_user_company = scope.find((x) => x.variable === "new_user_company");

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

  const [user_exists] = await config_dev.getData({ variables: ["user_email", "admin_email"], values: new_user_email.value, qty: 1 });
  if (user_exists) {
    validate("The user is already registered", "danger");
    throw "<New Device> User already exist.";
  }

  const { timezone } = await account.info();
  const domain_url = environment.run_url;

  let device_data;

  if (new_user_type.value === "admin") {
    const user_data = {
      name: new_user_name.value as string,
      email: new_user_email.value as string,
      phone: new_user_phone?.value as string,
      type: new_user_type.value as string,
      tags: [{ key: "access", value: "admin" }],
      timezone,
    };

    const new_user_id = await inviteUser(context, account, user_data, domain_url);

    device_data = parseTagoObject(
      {
        user_id: {
          value: new_user_id,
          metadata: {
            label: new_user_name.value,
          },
        },
        admin_name: new_user_name.value,
        admin_email: new_user_email.value,
        admin_phone: new_user_phone?.value,
      },
      new_user_id
    );
  } else {
    const user_data = {
      name: new_user_name.value as string,
      email: new_user_email.value as string,
      phone: new_user_phone?.value as string,
      type: new_user_type.value as string,
      timezone,
      company: new_user_company.value as string,
      tags: [
        { key: "access", value: "manager" },
        // { key: "company_id", value: new_user_company.value as string },
      ],
    };

    user_data.tags = user_data.tags.concat((new_user_company.metadata.sentValues as any).map((x: { key: string; value: string }) => ({ key: "company_id", value: x.value })));
    const new_user_id = await inviteUser(context, account, user_data, domain_url);

    device_data = parseTagoObject(
      {
        user_id: {
          value: new_user_id,
          metadata: {
            label: new_user_name.value,
          },
        },
        user_name: new_user_name.value,
        user_email: new_user_email.value,
        user_company: new_user_company,
        user_phone: new_user_phone?.value,
      },
      new_user_id
    );
  }

  await config_dev.sendData(device_data);

  validate("User successfully added", "success");
};
