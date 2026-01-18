import type { Hex } from "viem";

/**
 * Represents a standard JSON-RPC error object returned by the Tenderly API.
 */
export type TenderlyRpcError = {
  /** The error code identifying the type of error. */
  code: number;
  /** A human-readable message describing the error. */
  message: string;
  /** Additional data associated with the error, if any. */
  data?: unknown;
};

/**
 * Represents a decoded parameter from a smart contract call or event log.
 */
export type TenderlyDecodedParam = {
  /** The decoded value of the parameter. */
  value?: unknown;
  /** The Solidity type of the parameter (e.g., 'uint256', 'address'). */
  type?: string;
  /** The name of the parameter, if available. */
  name?: string;
  /** Indicates if the parameter is indexed (for event logs). */
  indexed?: boolean;
};

/**
 * Represents a log emitted during the simulation.
 */
export type TenderlyLog = {
  /** The name of the event emitted. */
  name?: string;
  /** Indicates if the event is anonymous. */
  anonymous?: boolean;
  /** The decoded inputs/parameters of the event. */
  inputs?: TenderlyDecodedParam[];
  /** The raw log data. */
  raw?: {
    /** The address of the contract that emitted the log. */
    address?: string;
    /** The topics of the log. */
    topics?: string[];
    /** The data field of the log. */
    data?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * Represents a single step in the execution trace.
 */
export type TenderlyTraceEntry = {
  /** The type of call (e.g., 'CALL', 'DELEGATECALL'). */
  type?: string;
  /** The address initiating the call. */
  from?: string;
  /** The address receiving the call. */
  to?: string;
  /** The gas provided for the call. */
  gas?: Hex | string;
  /** The gas used by the call. */
  gasUsed?: Hex | string;
  /** The value transferred in the call. */
  value?: Hex | string;
  /** The input data for the call. */
  input?: Hex | string;
  /** The decoded input parameters, if decoding was successful. */
  decodedInput?: TenderlyDecodedParam[];
  /** The name of the method called. */
  method?: string;
  /** The output data returned by the call. */
  output?: Hex | string;
  /** The decoded output parameters, if decoding was successful. */
  decodedOutput?: TenderlyDecodedParam[];
  /** The number of subtraces created by this call. */
  subtraces?: number;
  /** The trace address indicating the position of this call in the trace tree. */
  traceAddress?: number[];
  /** The error message if the call failed. */
  error?: string;
  [key: string]: unknown;
};

/**
 * Represents a change in token allowance/approval.
 */
export type TenderlyExposureChange = {
  /** The type of exposure change (e.g., 'Approval'). */
  type?: string;
  /** The address of the token owner. */
  owner?: string;
  /** The address of the spender. */
  spender?: string;
  /** The formatted amount of the allowance. */
  amount?: string;
  /** The raw amount of the allowance. */
  rawAmount?: Hex | string;
  /** The dollar value of the allowance, if available. */
  dollarValue?: string;
  /** Information about the asset involved. */
  assetInfo?: {
    standard?: string;
    contractAddress?: string;
    symbol?: string;
    name?: string;
    decimals?: number;
    dollarValue?: string;
    logo?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * Represents a state change in the simulation (storage, nonce, balance).
 */
export type TenderlyStateChange = {
  /** The address of the account whose state changed. */
  address?: string;
  /** The change in the account's nonce. */
  nonce?: { previousValue?: Hex | string; newValue?: Hex | string };
  /** The changes in the account's storage slots. */
  storage?: Array<{
    slot?: Hex | string;
    previousValue?: Hex | string;
    newValue?: Hex | string;
  }>;
  /** The change in the account's balance. */
  balance?: { previousValue?: Hex | string; newValue?: Hex | string };
  [key: string]: unknown;
};

/**
 * Represents a change in asset holdings (ERC20, ERC721, etc.).
 */
export type TenderlyAssetChange = {
  /** Information about the asset involved. */
  assetInfo?: {
    standard?: string;
    type?: string;
    symbol?: string;
    name?: string;
    logo?: string;
    decimals?: number;
    dollarValue?: string;
    [key: string]: unknown;
  };
  /** The type of asset change (e.g., 'Transfer'). */
  type?: string;
  /** The address sending the asset. */
  from?: string;
  /** The address receiving the asset. */
  to?: string;
  /** The raw amount of the asset transferred. */
  rawAmount?: Hex | string;
  /** The formatted amount of the asset transferred. */
  amount?: string;
  /** The dollar value of the asset transferred. */
  dollarValue?: string;
  [key: string]: unknown;
};

/**
 * Represents a change in native token balance.
 */
export type TenderlyBalanceChange = {
  /** The address whose balance changed. */
  address?: string;
  /** The dollar value of the balance change. */
  dollarValue?: string;
  /** A list of transfer indices or IDs related to this balance change. */
  transfers?: number[];
  [key: string]: unknown;
};

/**
 * Metadata for a contract involved in the simulation.
 */
export type TenderlyContract = {
  /** The address of the contract. */
  address: string;
  /** The name of the contract. */
  contract_name: string;
  /** Supported standards (e.g., 'ERC20'). */
  standards?: string[];
  /** Token-specific data if the contract is a token. */
  token_data?: {
    symbol: string;
    name: string;
    decimals: number;
  };
  [key: string]: unknown;
};

/**
 * Metadata regarding the simulation execution.
 */
export type TenderlySimulationMetadata = {
  /** The unique identifier of the simulation. */
  id: string;
  /** The project ID associated with the simulation. */
  project_id: string;
  /** The owner ID of the simulation. */
  owner_id: string;
  /** The network ID where the simulation ran. */
  network_id: string;
  /** The block number used for the simulation. */
  block_number: number;
  /** The transaction index in the block. */
  transaction_index: number;
  /** The address initiating the simulation. */
  from: string;
  /** The target address of the simulation. */
  to: string;
  /** The input data for the simulation. */
  input: string;
  /** The gas limit provided. */
  gas: number;
  /** The gas price used. */
  gas_price: string;
  /** The value transferred in the simulation. */
  value: string;
  /** The method called, if known. */
  method: string;
  /** The status of the simulation (true for success, false for failure). */
  status: boolean;
  /** The access list used or generated. */
  access_list: unknown[];
  /** The origin of the simulation request. */
  queue_origin: string;
  /** The timestamp when the simulation was created. */
  created_at: string;
  [key: string]: unknown;
};

/**
 * Details of the transaction simulated.
 */
export type TenderlyTransaction = {
  /** The hash of the transaction. */
  hash: string;
  /** The hash of the block containing the transaction. */
  block_hash: string;
  /** The block number. */
  block_number: number;
  /** The sender address. */
  from: string;
  /** The gas limit. */
  gas: number;
  /** The gas price. */
  gas_price: number;
  /** The gas fee cap (EIP-1559). */
  gas_fee_cap: number;
  /** The gas tip cap (EIP-1559). */
  gas_tip_cap: number;
  /** The input data. */
  input: string;
  /** The nonce of the sender. */
  nonce: number;
  /** The recipient address. */
  to: string;
  /** The transaction index. */
  index: number;
  /** The value transferred. */
  value: string;
  /** The access list included in the transaction. */
  access_list: unknown[];
  [key: string]: unknown;
};

/**
 * The core result object from a Tenderly simulation.
 */
export type TenderlySimulateResult = {
  /** Whether the simulation succeeded. */
  status?: boolean;
  /** The amount of gas used. */
  gasUsed?: Hex;
  /** The cumulative gas used. */
  cumulativeGasUsed?: Hex;
  /** The block number where the simulation occurred. */
  blockNumber?: Hex;
  /** The transaction type. */
  type?: Hex;
  /** The logs bloom filter. */
  logsBloom?: Hex;
  /** The logs emitted during simulation. */
  logs?: TenderlyLog[];
  /** The execution trace. */
  trace?: TenderlyTraceEntry[];
  /** Contracts involved in the simulation. */
  contracts?: TenderlyContract[];
  /** Metadata about the simulation. */
  simulation?: TenderlySimulationMetadata;
  /** Details of the simulated transaction. */
  transaction?: TenderlyTransaction;
  /** The access list generated by the simulation. */
  generated_access_list?: { address: string; storage_keys: string[] }[];
  /** Changes in token allowances/approvals. */
  exposureChanges?: TenderlyExposureChange[];
  /** State changes (storage, balance, nonce). */
  stateChanges?: TenderlyStateChange[];
  /** Changes in asset holdings. */
  assetChanges?: TenderlyAssetChange[];
  /** Changes in native token balances. */
  balanceChanges?: TenderlyBalanceChange[];
  /** Top-level revert reason, if any. */
  errorMessage?: string;
  [key: string]: unknown;
};

/**
 * The full JSON-RPC response from the Tenderly simulation API.
 */
export type TenderlySimulateResponse = {
  /** The JSON-RPC request ID. */
  id: number;
  /** The JSON-RPC version. */
  jsonrpc: string;
  /** The simulation result, if successful. */
  result?: TenderlySimulateResult;
  /** The error object, if the request failed. */
  error?: TenderlyRpcError;
};
