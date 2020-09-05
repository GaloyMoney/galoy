import { LightningMixin } from "./Lightning";
import { disposer } from "./lock";
import { User } from "./mongodb";
import { Currency, OnboardingEarn } from "./types";
import { UserWallet } from "./wallet";
const using = require('bluebird').using

interface ILightningWalletUser {
  uid: string,
  currency?: Currency
}

/**
 * this represents a user wallet
 */
export class LightningUserWallet extends LightningMixin(UserWallet) {
  constructor({ uid, currency = "BTC" }: ILightningWalletUser) {
    super({ uid, currency })
  }

  async addEarn(ids) {

    // TODO: there should be a "funding" role, instead of admin
    const admin = await User.findOne({ role: "admin" })
    const lightningFundingWallet = new LightningUserWallet({ uid: admin._id })

    const result: object[] = []

    return await using(disposer(this.uid), async (lock) => {

      for (const id of ids) {
        const amount = OnboardingEarn[id]

        const userPastState = await User.findOneAndUpdate(
          { _id: this.uid },
          { $push: { earn: id } },
          { upsert: true }
        )

        if (userPastState.earn.findIndex(item => item === id) === -1) {
          const invoice = await this.addInvoice({memo: id, value: amount})
          await lightningFundingWallet.pay({invoice})
        }

        result.push({ id, value: amount, completed: true })
      }

      return result
    })
  }

  async setLevel({ level }) {
    // FIXME this should be in User and not tight to Lightning // use Mixins instead
    return await User.findOneAndUpdate({ _id: this.uid }, { level }, { new: true, upsert: true })
  }
}