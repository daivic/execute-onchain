"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Play,
  Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContractAddress } from "@/components/app/shared/ContractAddress";
import {
  getExplorerTxUrl,
  getExplorerName,
  getExplorerIcon,
} from "@/lib/chains";
import { toast } from "sonner";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ArrowElbowDownRightIcon } from "@phosphor-icons/react";

export interface HistoryItem {
  /** Tenderly simulation ID (present for saved simulations). */
  simulationId?: string;
  method: string;
  from?: string;
  to: string;
  value?: string;
  calldata?: string;
  gasLimit?: string;
  timestamp: number;
  status: "success" | "reverted" | "unknown";
  type: "simulation" | "execution";
  hash?: string;
  chainId: number;
}

interface HistoryDataTableProps {
  data: HistoryItem[];
  onLoadHistoryItem: (item: HistoryItem) => void;
  onViewSimulation?: (item: HistoryItem) => void;
  onResimulate?: (item: HistoryItem) => void;
  onClearExecutions?: () => void;
  ethPrice?: number;
}

export function HistoryDataTable({
  data,
  onLoadHistoryItem,
  onViewSimulation,
  onResimulate,
  onClearExecutions,
  ethPrice,
}: HistoryDataTableProps) {
  const formatStatus = React.useCallback((status: HistoryItem["status"]) => {
    if (status === "success") {
      return (
        <span className="rounded-full bg-emerald-100  text-emerald-700 p-1">
          <CheckCircle2 className="h-3 w-3" />
        </span>
      );
    }

    if (status === "reverted") {
      return (
        <span className="rounded-full bg-red-100  text-red-700 p-1">
          <XCircle className="h-3 w-3" />
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        <AlertCircle className="h-3 w-3" />
        Unknown
      </span>
    );
  }, []);

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "timestamp", desc: true }, // Default sort by timestamp desc
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      method: false,
      timestamp: true,
    });

  const columns: ColumnDef<HistoryItem>[] = [
    {
      accessorKey: "method",
      header: "Method",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="sr-only">{row.getValue("method") as string}</span>
      ),
    },
    {
      id: "timestamp",
      header: "Time",
      enableHiding: true,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(item.timestamp).toLocaleTimeString()}
          </span>
        );
      },
    },
    {
      id: "summary",
      header: "Transaction",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {formatStatus(item.status)}
                <span className="text-sm font-bold font-mono lowercase">
                  {item.method} to
                </span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowElbowDownRightIcon
                  size={16}
                  className="text-muted-foreground"
                />
                <ContractAddress
                  address={item.to}
                  className="text-2xs text-muted-foreground font-mono"
                  chainId={item.chainId}
                />
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-end justify-end gap-1.5">
            {item.type === "simulation" &&
              item.simulationId &&
              onResimulate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResimulate(item);
                  }}
                  title="Re-simulate"
                >
                  <HoverCard>
                    <HoverCardTrigger>
                      <Play className="h-4 w-4" />
                    </HoverCardTrigger>
                    <HoverCardContent>
                      <span className="flex text-center gap-1">
                        <Play className="h-4 w-4" />
                        Re-simulate
                      </span>
                    </HoverCardContent>
                  </HoverCard>
                </Button>
              )}
            {item.type === "simulation" &&
              item.simulationId &&
              onViewSimulation && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewSimulation(item);
                  }}
                  title="View simulation dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                </Button>
              )}
            {item.hash && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(item.hash!);
                  toast.success("Tx hash copied");
                }}
                title="Copy tx hash"
                aria-label="Copy transaction hash"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {item.hash && (
              <Button
                asChild
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title={`View on ${getExplorerName(item.chainId)}`}
                aria-label={`View on ${getExplorerName(item.chainId)}`}
              >
                <a
                  href={getExplorerTxUrl(item.chainId, item.hash)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={getExplorerIcon(item.chainId)}
                    className="h-4 w-4"
                  />
                </a>
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-2">
        <Input
          placeholder="Filter methods..."
          value={(table.getColumn("method")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("method")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <div className="flex-1" />
        {onClearExecutions && data.some((d) => d.type === "execution") && (
          <Button variant="outline" size="sm" onClick={onClearExecutions}>
            Clear Executions
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onLoadHistoryItem(row.original)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3 align-top">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
