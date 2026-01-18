import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  CircleNotchIcon,
  PlayIcon,
  WarningCircleIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_CHAINS } from "@/lib/chains";

export interface TransactionPanelProps {
  chainId: number;
  isSwitching: boolean;
  onSwitchChain: (chainId: number) => Promise<void>;
  networkSwitchError: string | null;
  to: string;
  setTo: (val: string) => void;
  valueEth: string;
  setValueEth: (val: string) => void;
  calldata: string;
  setCalldata: (val: string) => void;
  gasLimit: string;
  setGasLimit: (val: string) => void;
  ethPrice: number | undefined;
  walletEthBalance: string | undefined;
  toEnsName: string | undefined;
  isToEnsFetching: boolean;
  toFieldError: string | undefined;
  simulateFrom: string;
  setSimulateFrom: (val: string) => void;
  simulateFromError: string | undefined;
  dataBytes: number;
  formError: string | undefined;
  sendError: Error | null;
  canSimulate: boolean;
  isSimulating: boolean;
  onSimulate: () => void;
  onClearTransaction: () => void;
  onClearResults: () => void;
  canSend: boolean;
  isSending: boolean;
  onSend: () => void;
}

export function TransactionPanel({
  chainId,
  isSwitching,
  onSwitchChain,
  networkSwitchError,
  to,
  setTo,
  valueEth,
  setValueEth,
  calldata,
  setCalldata,
  gasLimit,
  setGasLimit,
  ethPrice,
  walletEthBalance,
  toEnsName,
  isToEnsFetching,
  toFieldError,
  simulateFrom,
  setSimulateFrom,
  simulateFromError,
  dataBytes,
  sendError,
  canSimulate,
  isSimulating,
  onSimulate,
  onClearTransaction,
  onClearResults,
  canSend,
  isSending,
  onSend,
}: TransactionPanelProps) {
  const walletEthBalanceNum = walletEthBalance
    ? parseFloat(walletEthBalance)
    : undefined;
  const walletEthBalanceDisplay =
    walletEthBalanceNum !== undefined && Number.isFinite(walletEthBalanceNum)
      ? walletEthBalanceNum.toLocaleString(undefined, {
          maximumFractionDigits: 4,
        })
      : undefined;
  const hasTo = to.trim().length > 0;
  const isIntrinsicGas = gasLimit.trim() === "";

  return (
    <div className="space-y-6">
      {/* Network */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Network</Label>
        </div>
        <Select
          value={String(chainId)}
          onValueChange={(val) => onSwitchChain(Number(val))}
          disabled={isSwitching}
        >
          <SelectTrigger className="w-full font-medium">
            <SelectValue placeholder="Select network" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Networks</SelectLabel>
              {SUPPORTED_CHAINS.map((chain) => (
                <SelectItem key={chain.id} value={String(chain.id)}>
                  {chain.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {networkSwitchError && (
          <p className="text-xs text-destructive">{networkSwitchError}</p>
        )}
      </div>

      {/* Destination */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Destination</Label>
          <InfoIcon
            weight="bold"
            size={14}
            className="shrink-0 text-muted-foreground"
          />
        </div>
        <InputGroup>
          <InputGroupInput
            className="font-mono text-sm text-foreground border-none"
            placeholder="0x..."
            value={to}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setTo(e.target.value)
            }
          />
          {hasTo && (
            <InputGroupAddon
              align="inline-end"
              className="gap-1 border-none px-1"
            >
              {isToEnsFetching ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/50 border border-border/50 shadow-none font-medium gap-1"
                >
                  <CircleNotchIcon
                    weight="bold"
                    size={12}
                    className="shrink-0 animate-spin"
                  />
                  ENS…
                </Badge>
              ) : toFieldError ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 text-destructive bg-destructive/10 border border-destructive/20 shadow-none font-medium"
                >
                  Invalid
                </Badge>
              ) : toEnsName ? (
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 px-1.5 border-success/30 text-success bg-success/10 shadow-none"
                >
                  ENS
                </Badge>
              ) : isToEnsFetching ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/50 border border-border/50 shadow-none font-medium gap-1"
                >
                  <CircleNotchIcon
                    weight="bold"
                    size={12}
                    className="shrink-0 animate-spin"
                  />
                  ENS…
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 gap-1 text-muted-foreground bg-muted/50 border-none shadow-none font-medium rounded tabular-nums"
                >
                  Address
                </Badge>
              )}
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>
      {/* Value */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="value-eth" className="text-sm text-muted-foreground">
            Amount
          </Label>
          {walletEthBalanceDisplay !== undefined && (
            <span className="text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/50 border-none shadow-none font-medium rounded tabular-nums">
              Bal: {walletEthBalanceDisplay} ETH
            </span>
          )}
          <InfoIcon
            weight="bold"
            size={14}
            className="shrink-0 text-muted-foreground"
          />
        </div>
        <InputGroup>
          <InputGroupInput
            id="value-eth"
            className="font-mono h-10 flex-1 text-foreground border-none"
            placeholder="0.0"
            value={valueEth}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const val = e.target.value;
              const parts = val.split(".");
              if (parts[1] && parts[1].length > 18) {
                setValueEth(parts[0] + "." + parts[1].slice(0, 18));
              } else {
                setValueEth(val);
              }
            }}
          />
          <InputGroupAddon align="block-end" className="gap-1 border-none px-2">
            <span className="text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/50 border-none shadow-none font-medium rounded">
              ETH ≈ $
              {((parseFloat(valueEth) || 0) * (ethPrice ?? 0)).toLocaleString(
                undefined,
                {
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Calldata */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="calldata" className="text-sm text-muted-foreground">
              Calldata
            </Label>
            <InfoIcon
              weight="bold"
              size={14}
              className="shrink-0 text-muted-foreground"
            />
          </div>
        </div>
        <InputGroup className="flex-col items-stretch relative">
          <InputGroupTextarea
            id="calldata"
            className="min-h-[140px] font-mono text-sm resize-none text-foreground border-none focus-visible:ring-0 custom-scrollbar"
            placeholder="0x"
            value={calldata}
            onChange={(e) => setCalldata(e.target.value)}
          />
          <InputGroupAddon
            align="inline-end"
            className="absolute bottom-1 right-1 gap-1 border-none px-1 h-auto"
          >
            <span className="text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/50 border-none shadow-none font-medium rounded">
              {dataBytes} bytes
            </span>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* Advanced Section */}
      <Accordion
        type="single"
        collapsible
        className="border-2 border-border/60 rounded-lg overflow-hidden"
      >
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium text-muted-foreground hover:no-underline">
            Advanced Options
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="gas-limit"
                    className="text-sm text-muted-foreground"
                  >
                    Gas Limit
                  </Label>
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-5 px-1.5 text-muted-foreground bg-muted/50 border-none shadow-none font-medium rounded tabular-nums"
                  >
                    {isIntrinsicGas ? "Intrinsic" : "Custom"}
                  </Badge>
                  <InfoIcon
                    weight="bold"
                    size={14}
                    className="shrink-0 text-muted-foreground"
                  />
                </div>
                <InputGroup>
                  <InputGroupInput
                    id="gas-limit"
                    className="font-mono h-10 flex-1 text-foreground border-none"
                    placeholder="Intrinsic"
                    value={gasLimit}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setGasLimit(e.target.value)
                    }
                  />
                  <InputGroupAddon
                    align="inline-end"
                    className="gap-1 border-none px-1"
                  >
                    <span className="text-xs text-muted-foreground px-1">
                      GAS
                    </span>
                  </InputGroupAddon>
                </InputGroup>
                <div className="text-xs text-muted-foreground">
                  Leave blank to use intrinsic (auto) gas.
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="simulate-from"
                    className="text-sm text-muted-foreground"
                  >
                    Simulate From
                  </Label>
                  <InfoIcon
                    weight="bold"
                    size={14}
                    className="shrink-0 text-muted-foreground"
                  />
                </div>
                <InputGroup>
                  <InputGroupInput
                    id="simulate-from"
                    className="font-mono h-10 flex-1 text-foreground border-none"
                    placeholder="Defaults to connected wallet"
                    value={simulateFrom}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSimulateFrom(e.target.value)
                    }
                  />
                  <InputGroupAddon
                    align="inline-end"
                    className="gap-1 border-none px-1"
                  >
                    <span className="text-xs text-muted-foreground px-1">
                      SIM
                    </span>
                  </InputGroupAddon>
                </InputGroup>
                {simulateFromError && (
                  <div className="text-xs text-destructive">
                    {simulateFromError}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Overrides <code className="rounded bg-muted px-1">from</code>{" "}
                  only for simulation.
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {sendError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive shadow-sm">
          <WarningCircleIcon
            weight="bold"
            size={14}
            className="shrink-0 text-destructive"
          />
          <span className="truncate">Send failed: {sendError.message}</span>
        </div>
      )}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          className="shrink min-w-0 h-9 px-3 text-xs font-bold gap-1.5 rounded-lg"
          onClick={() => {
            onClearTransaction();
            onClearResults();
          }}
        >
          <span>Clear</span>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="shrink min-w-0 h-9 px-3 text-xs font-bold gap-1.5 rounded-lg"
            onClick={onSimulate}
            disabled={!canSimulate || isSimulating}
          >
            {isSimulating ? (
              <CircleNotchIcon
                weight="bold"
                size={14}
                className="shrink-0 text-white animate-spin"
              />
            ) : (
              <PlayIcon
                weight="bold"
                size={14}
                className="shrink-0 text-muted-foreground"
              />
            )}
            <span className="truncate">Simulate</span>
            <Kbd className="ml-2 hidden sm:inline-flex bg-background/50">
              Enter
            </Kbd>
          </Button>
          <Button
            variant="default"
            size="sm"
            className="shrink min-w-0 h-9 px-3 text-xs font-bold gap-1.5 rounded-lg"
            onClick={onSend}
            disabled={!canSend || isSending}
          >
            {isSending && (
              <CircleNotchIcon
                weight="bold"
                className="h-3.5 w-3.5 animate-spin shrink-0"
              />
            )}
            <span className="truncate">Submit</span>
            <Kbd className="hidden lg:inline-flex bg-background/20 text-primary-foreground/80 border-white/20">
              ⌘
            </Kbd>
            <Kbd className=" hidden sm:inline-flex bg-background/20 text-primary-foreground/80 border-white/20">
              Enter
            </Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
