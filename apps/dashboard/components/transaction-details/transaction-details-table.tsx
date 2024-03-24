import * as React from "react"
import Table from "@mui/joy/Table"
import Typography from "@mui/joy/Typography"
import { Sheet } from "@mui/joy"
import Chip from "@mui/joy/Chip"

import { TransactionDetailsProps } from "./index.types"

import { getTransactionStatusColor } from "@/components/utils"

export default function TransactionTableComponent({ rows }: TransactionDetailsProps) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        display: { xs: "none", sm: "initial" },
        width: "100%",
        borderRadius: "sm",
        flexShrink: 1,
        overflow: "auto",
        minHeight: 0,
      }}
    >
      <Table
        aria-labelledby="tableTitle"
        stickyHeader
        hoverRow
        sx={{
          "--TableCell-headBackground": "var(--joy-palette-background-level2)",
          "--Table-headerUnderlineThickness": "1px",
          "--TableRow-hoverBackground": "var(--joy-palette-background-level1)",
          "--TableCell-paddingY": "12px",
          "--TableCell-paddingX": "8px",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: 200,
                padding: "12px 6px",
              }}
            >
              Transaction Date
            </th>
            <th
              style={{
                width: 140,
                padding: "12px 6px",
              }}
            >
              Payment Amount
            </th>

            <th
              style={{
                width: 140,
                padding: "12px 6px",
              }}
            >
              Settlement Amount
            </th>

            <th
              style={{
                width: 100,
                padding: "12px 6px",
              }}
            >
              Wallet Type
            </th>

            <th
              style={{
                width: 100,
                padding: "12px 6px",
              }}
            >
              Status
            </th>

            <th
              style={{
                width: 100,
                padding: "12px 6px",
              }}
            >
              Fees
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} style={{}}>
              <td style={{ padding: "12px 6px" }}>
                <Typography level="body-md">
                  {new Date(row.node.createdAt * 1000).toLocaleString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Typography>
              </td>
              <td
                style={{
                  padding: "12px 6px",
                }}
              >
                <Typography level="body-md">
                  {row.node.settlementDisplayAmount} {row.node.settlementDisplayCurrency}
                </Typography>
              </td>

              <td
                style={{
                  padding: "12px 6px",
                }}
              >
                <Typography level="body-md">
                  {row.node.settlementAmount}{" "}
                  {row.node.settlementCurrency === "BTC" ? "sats" : "cents"}
                </Typography>
              </td>

              <td style={{ padding: "12px 6px" }}>
                <Typography level="body-md">{row.node.settlementCurrency}</Typography>
              </td>

              <td style={{ padding: "12px 6px" }}>
                <Chip color={getTransactionStatusColor(row.node.status)}>
                  {row.node.status.toLowerCase()}
                </Chip>
              </td>
              <td style={{ padding: "12px 6px" }}>
                <Typography level="body-md">{row.node.settlementFee} sats</Typography>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Sheet>
  )
}
