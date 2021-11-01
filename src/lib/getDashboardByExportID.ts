import { Account } from "@tago-io/sdk";

async function findDashboardByExportID(account: Account, export_id: string) {
  const [dash] = await account.dashboards.list({ amount: 1, fields: ["id", "tags"], filter: { tags: [{ key: "export_id", value: export_id }] } });
  if (!dash) throw `Dashboard ${export_id} not found`;

  return dash?.id;
}

export default findDashboardByExportID;
