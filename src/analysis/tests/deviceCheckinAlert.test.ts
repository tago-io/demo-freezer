import { Account, Device } from "@tago-io/sdk";
import { Data, GenericID, TagsObj } from "@tago-io/sdk/out/common/common.types";
import { ConfigurationParams, DeviceListItem } from "@tago-io/sdk/out/modules/Account/devices.types";
import { DataQuery, DataToSend } from "@tago-io/sdk/out/modules/Device/device.types";
import getDevice from "../../lib/getDevice";
import { resolveCheckinSensor } from "../deviceCheckinAlert";

jest.mock("@tago-io/sdk", () => {
  const func2 = () => Promise.resolve([{ key: "checkin", value: "checkin", sent: false }]); //CHANGE HERE

  class DeviceAccount {
    // constructor() {}
    paramList(deviceID: GenericID) {
      return func2();
    }

    paramSet(deviceID: GenericID, configObj: Partial<ConfigurationParams>, paramID?: GenericID) {
      return Promise.resolve();
    }
    info(id: string) {
      return Promise.resolve({ name: "" });
    }
  }

  class Account {
    public devices = new DeviceAccount();
  }

  const func = jest.fn(() => {
    return Promise.resolve([
      [
        {
          id: "603ce11a8baf460014f8ad21",
          origin: "03cde5a3ecafb00126c3cf7",
          serie: "603ce11961a29e0011d079ed",
          value: "true",
          variable: "external_input",
          metadata: {
            url:
              "https://admin.tago.io/dashboards/info/602a5848ddb6c600186a9e6f?company_device=603cde5a3ecafb00126c3cf7&building_device=603cde9b8baf460014f86618&leak_sensor=603ce11961a29e0011d079ed",
          },
        },
      ],
    ]);
  });

  class Device {
    info() {
      return Promise.resolve({
        tags: [
          { key: "company_id", value: "603cde5a3ecafb00126c3cf7" },
          { key: "building_id", value: "603cde5a3ecafb00126c3cf7" },
        ],
        name: "",
        last_input: "2021-03-01T12:38:11.472Z",
      });
    }
    getData(queryParams?: DataQuery) {
      return func();
    }

    deleteData(queryParams?: DataQuery) {
      return Promise.resolve();
    }
    sendData(data: DataToSend | DataToSend[]) {
      return Promise.resolve();
    }
  }

  class Utils {
    getTokenByName(account: Account, device_id: string) {
      return Promise.resolve("7364ed6c-68ac-48b9-aaf5-f2bdba073"); //building
    }
  }

  return { Account, Device, Utils };
});

jest.mock("../../lib/getDevice", () => {
  return jest.fn(async (account: Account, device_id: string) => {
    return Promise.resolve(new Device({ token: "7364ed6c-68ac-48b9-aaf5-f2bdba073" }));
  });
});

const account = new Account({ token: "" });
const company_id: string = "";
const device_list: DeviceListItem[] = [
  {
    id: "603ce11961a29e0011d079ed",
  } as DeviceListItem,
];
const config_dev = new Device({ token: "" });

const checkin_time = "2";

const startingTest = () => console.log("**Starting new test**");
const endingTest = () => console.log("**Test ended**");

describe("Company Checkin Sensors Test", () => {
  beforeEach(() => startingTest());
  afterEach(() => endingTest());

  test("Sensor Checkin status -> Inactivity", async () => {
    const result = await resolveCheckinSensor(account, config_dev, device_list[0], checkin_time, company_id);

    expect(result).toBe("checkin warning");
  });
});
