import { Account, Utils, Device } from "@tago-io/sdk";

/**
 * Get the tago device class from the device id
 */
async function getDevice(account: Account, device_id: string) {
  const customer_token = await Utils.getTokenByName(account, device_id);
  const customer_dev = new Device({ token: customer_token });
  return customer_dev;
}

export default getDevice;
