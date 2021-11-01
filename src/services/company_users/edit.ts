import { Device, Account } from "@tago-io/sdk";
import { ServiceParams, TagoContext, TagoData, DeviceCreated } from "../../types";

export default async ({ config_dev, context, scope, account, environment }: ServiceParams) => {
  const { serie: user_id } = scope[0];
  const user_name = scope.find((x) => x.variable === "company_user_name");
  const user_phone = scope.find((x) => x.variable === "company_user_phone");
  const user_building = scope.find((x) => x.variable === "company_user_building");
  let { name, phone, tags } = await account.run.userInfo(user_id);

  if (user_building) {
    const buildings: { key: string; value: string }[] = (user_building.metadata?.sentValues as any)?.map((x: { key: String; value: string }) => ({
      key: "building_id",
      value: x.value,
    }));

    tags = tags.filter((x) => !["building_id"].includes(x.key));
    if (buildings) tags = tags.concat(buildings);
  }

  if (user_phone) {
    phone = user_phone.value as string;
  }

  if (user_name) {
    name = user_name.value as string;
  }

  await account.run.userEdit(user_id, { tags, name, phone });
};
