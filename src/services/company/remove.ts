import { ServiceParams } from "../../types";

async function remove({ config_dev, context, scope, account, environment }: ServiceParams) {
  const { serie: company_id } = scope[0];

  await config_dev.deleteData({ series: company_id, qty: 9999 });
  await config_dev.deleteData({ values: company_id, qty: 9999 });

  const devices = await account.devices.list({
    amount: 9999,
    page: 1,
    filter: { tags: [{ key: "company_id", value: company_id }] },
    fields: ["id", "bucket", "tags", "name"],
  });

  const remove_devices = devices.filter((device) => !device.tags.find((tag) => tag.value === "freezer"));
  const freezer = devices.filter((device) => device.tags.find((tag) => tag.value === "freezer"));

  remove_devices.forEach((x) => {
    account.devices.delete(x.id);
    account.buckets.delete(x.bucket);
  });

  freezer.forEach(async (x) => {
    const [device_name] = await config_dev.getData({ variables: "device_name", series: x.id, qty: 1 });
    await config_dev.deleteData({ variables: ["device_company", "device_building", "device_name"], series: x.id, qty: 999 }); //
    delete device_name.metadata.url;
    await config_dev.sendData({ ...device_name });
    await account.devices.edit(x.id, { tags: x.tags.filter((y) => !["company_id", "building_id"].includes(y.key)) });
  });

  //delete end users (end users are related to one company only)
  const end_users = await account.run.listUsers({
    amount: 9999,
    page: 1,
    filter: {
      tags: [
        { key: "access", value: "apartmentUser" },
        { key: "company_id", value: company_id },
      ],
    },
    fields: ["id"],
  });

  end_users.forEach(async (user) => {
    await account.run.userDelete(user.id);
    await config_dev.deleteData({ series: user.id, qty: 9999 });
  });
  //remove from building manager table and tag
  const manager_users = await account.run.listUsers({
    amount: 9999,
    page: 1,
    filter: {
      tags: [
        { key: "access", value: "manager" },
        { key: "company_id", value: company_id },
      ],
    },
    fields: ["id", "tags"],
  });

  manager_users.forEach(async (user) => {
    const [user_company] = await config_dev.getData({ variables: "user_company", series: user.id, qty: 1 });
    await config_dev.deleteData({ variables: "user_company", values: company_id, series: user.id, qty: 999 }); //
    if ((user_company.value as string).includes(";")) user_company.value = (user_company.value as string).replace(`;${company_id}`, "");
    //multiple buildings
    else user_company.value = (user_company.value as string).replace(`${company_id}`, ""); //single buildings

    user_company.metadata.sentValues = user_company.metadata.sentValues.filter((x) => !(x.value === company_id)) as any;

    await config_dev.sendData({ ...user_company });
    await account.devices.edit(user.id, { tags: user.tags.filter((y) => !["company_id"].includes(y.key)) });
  });

  await config_dev.deleteData({ variables: "device_company", values: company_id, qty: 9000 });
}

export default remove;
