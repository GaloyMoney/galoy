import { wrapAsyncToRunInSpan } from "@services/tracing"

import * as AccountsMod from "./accounts"
import * as AdminMod from "./admin"
import * as ColdStorageMod from "./cold-storage"
import * as LightningMod from "./lightning"
import * as PricesMod from "./prices"
import * as UsersMod from "./users"
import * as WalletsMod from "./wallets"
import * as PaymentsMod from "./payments"
import * as SwapMod from "./swap"

const allFunctions = {
  Accounts: { ...AccountsMod },
  Admin: { ...AdminMod },
  ColdStorage: { ...ColdStorageMod },
  Lightning: { ...LightningMod },
  Prices: { ...PricesMod },
  Users: { ...UsersMod },
  Wallets: { ...WalletsMod },
  Payments: { ...PaymentsMod },
  Swap: { ...SwapMod },
} as const

let subModule: keyof typeof allFunctions
for (subModule in allFunctions) {
  for (const fn in allFunctions[subModule]) {
    allFunctions[subModule][fn] = wrapAsyncToRunInSpan({
      namespace: `app.${subModule.toLowerCase()}`,
      fn: allFunctions[subModule][fn],
    })
  }
}

export const {
  Accounts,
  Admin,
  ColdStorage,
  Lightning,
  Prices,
  Users,
  Wallets,
  Payments,
  Swap,
} = allFunctions
