import { Device, Account } from "@tago-io/sdk";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const { serie: user_id } = scope[0];

  const user_company = scope.find((x) => x.variable === "user_company");
  const user_name = scope.find((x) => x.variable === "user_name") || scope.find((x) => x.variable === "admin_name");
  const user_phone = scope.find((x) => x.variable === "user_phone") || scope.find((x) => x.variable === "admin_phone");

  let { name, phone, tags } = await account.run.userInfo(user_id);

  tags = tags.filter((x) => !["company_id"].includes(x.key));
  if (user_company?.value) {
    const user_companies = (user_company.value as string).split(";");
    user_companies.forEach((company_id) => tags.push({ key: "company_id", value: company_id }));
    // tags.push({ key: "company_id", value: user_company.value as string });
  }

  if (user_phone) {
    phone = user_phone.value as string;
  }

  if (user_name) {
    name = user_name.value as string;
  }

  await account.run.userEdit(user_id, { tags, name, phone });
};
