export interface RowNode {
  __typename: "Transaction"
  id: string
  createdAt: number
  settlementDisplayAmount: string
  settlementDisplayCurrency: string
  status: string
  settlementFee: number
  settlementCurrency: string
  settlementAmount: number
}

export interface TransactionDetailsProps {
  rows: ReadonlyArray<{ node: RowNode }>
}
