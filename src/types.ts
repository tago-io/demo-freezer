// ? ==================================== (c) TagoIO ====================================
// ? What is this file?
// * This file is global types, it's used to remove "implicitly has an 'any' type" errors.
// ? ====================================================================================

import { Types, Device, Account } from "@tago-io/sdk";

interface ServicesAnalysis {
  checkType: (scope: TagoData[] | InputScope[], environment: EnvironmentItemObject) => void;
  controller: (params: ServiceParams) => void;
}

interface Metadata {
  [key: string]: string | number | boolean | Metadata | void;
}

interface TagoData {
  id?: string;
  variable: string;
  value?: string | number | boolean | void;
  location?: { lat: number; lng: number };
  metadata?: Metadata;
  serie?: string;
  origin?: string;
  time?: Date | string;
  unit?: string;
  created_at?: Date;
}

interface EnvironmentItem {
  key: string;
  value: string;
}

interface EnvironmentItemObject {
  [key: string]: string;
}

interface InputScope {
  id: string;
  created_at: Date;
  time: Date;
  bucket: string;
  variable: string;
  origin: string;
  unit: string;
  serie: string;
  value: string | number | boolean | void;
  metadata: Metadata;
}

type Token = string;
type AnalysisID = string;

interface TagoContext {
  token: Token;
  analysis_id: AnalysisID;
  environment: Types.Analysis.Analysis.AnalysisEnvironment[];
  log: (...args: any[]) => void;
}

interface ServiceParams {
  context: TagoContext;
  account: Account; // ! We need migrate SDK to better hightlight
  config_dev: Device; // ! We need migrate SDK to better hightlight
  notification: any; // ! We need migrate SDK to better hightlight
  scope: TagoData[];
  environment: EnvironmentItemObject;
}

interface DeviceCreated {
  bucket_id: string;
  device_id: string;
  device: Device;
}

export { ServicesAnalysis, ServiceParams, TagoContext, Token, AnalysisID, InputScope, EnvironmentItem, EnvironmentItemObject, TagoData, Metadata, DeviceCreated };
