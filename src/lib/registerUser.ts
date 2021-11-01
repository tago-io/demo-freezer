import { Account, Services, Device, Types } from "@tago-io/sdk";
import { TagoContext } from "../types";

/** Account Summary
 * @param  {Object} context analysis context
 * @param  {TagoAccount} account account object from TagoIO
 * @param  {Object} user user object with their data
 * Example: { name: 'John Doe', phone: '+1444562367', email: 'johndoe@tago.io', timezone: 'America/Chicago' }
 * @param  {Array} tags tags to be added/update in to the user
 * Example: [{ key: 'country', value: 'United States' }]
 * @return {Promise}
 */

interface UserData {
  email: string;
  name: string;
  phone?: string | number | boolean | void;
  timezone: string;
  tags?: Types.Common.TagsObj[];
  password?: string;
}

async function inviteUser(context: TagoContext, account: Account, user_data: UserData, domain_url: string) {
  user_data.email = user_data.email.toLowerCase();
  user_data.tags = user_data.tags.map((x, i) => ({ ...x, __rowManipulatorKey: i + 1 }));

  // Generate a Random Password
  const password = user_data.password || String(new Date().getTime());

  // Try to create the user.
  const result = await account.run
    .userCreate({
      active: true,
      company: "",
      email: user_data.email,
      language: "en",
      name: user_data.name,
      phone: String(user_data.phone) || "",
      tags: user_data.tags,
      timezone: user_data.timezone || "America/New_York",
      password,
    })
    .catch(() => null);

  if (!result) {
    // If got an error, try to find the user_data.
    // const [user_data] = await account.run.listUsers(1, ["id", "email", "tags"], { email: user_data.email }, 1);
    const [user] = await account.run.listUsers({ page: 1, amount: 1, filter: { email: user_data.email }, fields: ["id", "name", "email", "tags"] });
    if (!user) throw "Couldn`t find user data";

    // If found, update the tags.
    user.tags = user.tags.filter((x) => user_data.tags.find((y) => x.key !== y.key));
    user.tags = user.tags.concat(user_data.tags);

    await account.run.userEdit(user.id, { tags: user_data.tags });
    return user.id;
  }

  let user_type = "Administrator";

  if ((user_data?.tags.find((x) => x.key === "access").value as string) === "manager") user_type = "Manager";
  if ((user_data?.tags.find((x) => x.key === "access").value as string) === "apartmentUser") user_type = "End-user";

  const user_company = (user_data as any)?.company || "";

  // If success, send an email with the password
  const emailService = new Services({ token: context.token }).email;
  emailService.send({
    to: user_data.email,
    subject: "Account Details",
    message: `Your account for the application was created! \n\n User type: ${user_type} \nYour Login is: ${user_data.email}\nYour password is: ${password}\n\n In order to access it, visit our website ${domain_url}`,
  });

  const [user] = await account.run.listUsers({ page: 1, amount: 1, filter: { email: user_data.email } });
  if (!user) throw "Couldn`t find user data";

  return user.id;
}

export default inviteUser;
